import {
  buildAllWorkOffPlans,
  countWorkingOnDate,
  getFixedCycleWindows,
  tryAddWorkerToDateInPlan,
} from "./cycle-patterns";
import type {
  EmployeeData,
  GeneratedSchedule,
  ScheduleAssignmentData,
  ShiftData,
  StoreConfigData,
} from "./types";
import { getDayOfWeek, getMonthDates } from "@/lib/utils";
import { collectScheduleConflicts } from "./collect-schedule-conflicts";
import { runLocalSwapOptimizer } from "./preferred-off-optimizer";

function sortShifts(shifts: ShiftData[]): ShiftData[] {
  return [...shifts].sort((a, b) => a.startTime.localeCompare(b.startTime));
}

function getMinWorkersPerDay(config: StoreConfigData, shiftCount: number): number {
  return config.minEmployeesPerShift * shiftCount;
}

function getWorkingAssignmentsOnDate(
  assignments: ScheduleAssignmentData[],
  date: string
): ScheduleAssignmentData[] {
  return assignments.filter((a) => a.date === date && !a.isOff && a.shiftId);
}

function countShiftWorkers(
  assignments: ScheduleAssignmentData[],
  date: string,
  shiftId: string
): number {
  return getWorkingAssignmentsOnDate(assignments, date).filter((a) => a.shiftId === shiftId)
    .length;
}

function removeDateAssignments(
  assignments: ScheduleAssignmentData[],
  date: string
): ScheduleAssignmentData[] {
  return assignments.filter((a) => a.date !== date);
}

function rebalanceShiftsWithinDay(
  dayAssignments: ScheduleAssignmentData[],
  shifts: ShiftData[],
  config: StoreConfigData
): boolean {
  const sortedShifts = sortShifts(shifts);
  let changed = false;

  for (const shift of sortedShifts) {
    let count = dayAssignments.filter((a) => a.shiftId === shift.id).length;

    while (count < config.minEmployeesPerShift) {
      const donor = sortedShifts
        .map((s) => ({
          shift: s,
          count: dayAssignments.filter((a) => a.shiftId === s.id).length,
        }))
        .filter((s) => s.shift.id !== shift.id && s.count > config.minEmployeesPerShift)
        .sort((a, b) => b.count - a.count)[0];

      if (!donor) break;

      const movable = dayAssignments.find((a) => a.shiftId === donor.shift.id);
      if (!movable) break;

      movable.shiftId = shift.id;
      count++;
      changed = true;
    }
  }

  return changed;
}

function assignShiftsForDay(
  date: string,
  workingEmployees: EmployeeData[],
  shifts: ShiftData[],
  config: StoreConfigData
): ScheduleAssignmentData[] {
  const dayAssignments: ScheduleAssignmentData[] = [];
  if (shifts.length === 0 || workingEmployees.length === 0) return dayAssignments;

  const sortedShifts = sortShifts(shifts);
  const shiftCounts = new Map(sortedShifts.map((s) => [s.id, 0]));
  const assignedEmployees = new Set<string>();

  for (const shift of sortedShifts) {
    for (const employee of workingEmployees) {
      if ((shiftCounts.get(shift.id) ?? 0) >= config.minEmployeesPerShift) break;
      if (assignedEmployees.has(employee.id)) continue;

      dayAssignments.push({
        employeeId: employee.id,
        shiftId: shift.id,
        date,
        isOff: false,
      });
      assignedEmployees.add(employee.id);
      shiftCounts.set(shift.id, (shiftCounts.get(shift.id) ?? 0) + 1);
    }
  }

  let shiftIdx = 0;
  for (const employee of workingEmployees) {
    if (assignedEmployees.has(employee.id)) continue;
    const shift = sortedShifts[shiftIdx % sortedShifts.length];
    dayAssignments.push({
      employeeId: employee.id,
      shiftId: shift.id,
      date,
      isOff: false,
    });
    assignedEmployees.add(employee.id);
    shiftIdx++;
  }

  rebalanceShiftsWithinDay(dayAssignments, shifts, config);
  return dayAssignments;
}

function buildDayAssignments(
  date: string,
  employees: EmployeeData[],
  plans: Map<string, Map<string, boolean>>,
  shifts: ShiftData[],
  config: StoreConfigData
): ScheduleAssignmentData[] {
  const dayAssignments: ScheduleAssignmentData[] = [];
  const workingEmployees: EmployeeData[] = [];

  for (const employee of employees) {
    const shouldWork = plans.get(employee.id)?.get(date) ?? false;

    if (shouldWork) {
      workingEmployees.push(employee);
    } else {
      dayAssignments.push({
        employeeId: employee.id,
        shiftId: null,
        date,
        isOff: true,
      });
    }
  }

  if (shifts.length > 0 && workingEmployees.length > 0) {
    dayAssignments.push(
      ...assignShiftsForDay(date, workingEmployees, shifts, config)
    );
  } else if (workingEmployees.length > 0) {
    for (const employee of workingEmployees) {
      dayAssignments.push({
        employeeId: employee.id,
        shiftId: null,
        date,
        isOff: false,
      });
    }
  }

  return dayAssignments;
}

function rebuildDatesAssignments(
  assignments: ScheduleAssignmentData[],
  dates: string[],
  employees: EmployeeData[],
  plans: Map<string, Map<string, boolean>>,
  shifts: ShiftData[],
  config: StoreConfigData
): ScheduleAssignmentData[] {
  let result = assignments;
  for (const date of dates) {
    result = removeDateAssignments(result, date);
    result.push(...buildDayAssignments(date, employees, plans, shifts, config));
  }
  return result;
}

function getDayCoverageScore(
  assignments: ScheduleAssignmentData[],
  date: string,
  shifts: ShiftData[],
  config: StoreConfigData
): number {
  const workingCount = getWorkingAssignmentsOnDate(assignments, date).length;
  if (workingCount === 0) return -1000;

  let score = workingCount;
  for (const shift of shifts) {
    const count = countShiftWorkers(assignments, date, shift.id);
    if (count < config.minEmployeesPerShift) {
      score -= (config.minEmployeesPerShift - count) * 100;
    }
  }
  return score;
}

function applyPlanSwapForDate(
  plans: Map<string, Map<string, boolean>>,
  assignments: ScheduleAssignmentData[],
  targetDate: string,
  cycleDates: string[],
  employees: EmployeeData[],
  shifts: ShiftData[],
  config: StoreConfigData,
  minWorkersPerDay: number
): { assignments: ScheduleAssignmentData[]; changed: boolean } {
  const before = countWorkingOnDate(plans, targetDate);
  const donorDatesBefore = new Map(
    cycleDates.map((date) => [date, countWorkingOnDate(plans, date)])
  );

  if (
    !tryAddWorkerToDateInPlan(
      plans,
      targetDate,
      cycleDates,
      employees,
      config,
      minWorkersPerDay
    )
  ) {
    return { assignments, changed: false };
  }

  if (countWorkingOnDate(plans, targetDate) <= before) {
    return { assignments, changed: false };
  }

  const datesToRebuild = new Set<string>([targetDate]);
  for (const date of cycleDates) {
    if (countWorkingOnDate(plans, date) !== donorDatesBefore.get(date)) {
      datesToRebuild.add(date);
    }
  }

  return {
    assignments: rebuildDatesAssignments(
      assignments,
      [...datesToRebuild],
      employees,
      plans,
      shifts,
      config
    ),
    changed: true,
  };
}

/** Etapa 5–6: garante cobertura mínima diária e por turno nos planos e atribuições. */
export function repairCycleCoverage(
  plans: Map<string, Map<string, boolean>>,
  assignments: ScheduleAssignmentData[],
  cycleDates: string[],
  employees: EmployeeData[],
  shifts: ShiftData[],
  config: StoreConfigData
): ScheduleAssignmentData[] {
  const minWorkersPerDay = getMinWorkersPerDay(config, shifts.length);
  let result = [...assignments];

  for (let pass = 0; pass < employees.length * cycleDates.length; pass++) {
    let changed = false;

    const problemDates = [...cycleDates].sort(
      (a, b) =>
        getDayCoverageScore(result, a, shifts, config) -
        getDayCoverageScore(result, b, shifts, config)
    );

    for (const date of problemDates) {
      while (getWorkingAssignmentsOnDate(result, date).length < minWorkersPerDay) {
        const swapResult = applyPlanSwapForDate(
          plans,
          result,
          date,
          cycleDates,
          employees,
          shifts,
          config,
          minWorkersPerDay
        );
        result = swapResult.assignments;
        if (!swapResult.changed) break;
        changed = true;
      }

      const dayWorking = getWorkingAssignmentsOnDate(result, date);
      if (rebalanceShiftsWithinDay(dayWorking, shifts, config)) {
        changed = true;
      }

      for (const shift of shifts) {
        while (countShiftWorkers(result, date, shift.id) < config.minEmployeesPerShift) {
          const swapResult = applyPlanSwapForDate(
            plans,
            result,
            date,
            cycleDates,
            employees,
            shifts,
            config,
            minWorkersPerDay
          );
          result = swapResult.assignments;
          if (!swapResult.changed) break;
          changed = true;
        }
      }
    }

    if (!changed) break;
  }

  return result;
}

/** Etapas 1–6: monta atribuições a partir dos planos 5x2 com cobertura. */
export function buildAssignmentsFromPlans(
  plans: Map<string, Map<string, boolean>>,
  operatingDates: string[],
  employees: EmployeeData[],
  shifts: ShiftData[],
  config: StoreConfigData
): ScheduleAssignmentData[] {
  const assignments: ScheduleAssignmentData[] = [];

  for (const date of operatingDates) {
    assignments.push(...buildDayAssignments(date, employees, plans, shifts, config));
  }

  const cycles = getFixedCycleWindows(operatingDates, config.cycleLengthDays);
  let result = assignments;

  for (const cycleDates of cycles) {
    result = repairCycleCoverage(plans, result, cycleDates, employees, shifts, config);
  }

  return result;
}

export function repairAllCyclesCoverage(
  plans: Map<string, Map<string, boolean>>,
  assignments: ScheduleAssignmentData[],
  operatingDates: string[],
  employees: EmployeeData[],
  shifts: ShiftData[],
  config: StoreConfigData
): ScheduleAssignmentData[] {
  const cycles = getFixedCycleWindows(operatingDates, config.cycleLengthDays);
  let result = assignments;
  for (const cycleDates of cycles) {
    result = repairCycleCoverage(plans, result, cycleDates, employees, shifts, config);
  }
  return result;
}

export interface SchedulePipelineInput {
  config: StoreConfigData;
  employees: EmployeeData[];
  shifts: ShiftData[];
  month: number;
  year: number;
}

/**
 * Pipeline determinístico de geração de escala:
 * 1. Preparar ciclos fixos
 * 2. Restrições obrigatórias (inativo, indisponibilidade, fim de semana, dias críticos)
 * 3. Preferências de folga (prioridade, não obrigação)
 * 4. Completar 5x2 por funcionário
 * 5. Cobertura mínima diária
 * 6. Cobertura mínima por turno
 * 7. Otimizador de trocas locais
 * 8. Conflitos somente após todas as tentativas de reparo
 */
export function runSchedulePipeline(input: SchedulePipelineInput): GeneratedSchedule {
  const { config, employees, shifts, month, year } = input;

  const activeEmployees = employees.filter((e) => e.active);
  const activeShifts = shifts.filter((s) => s.active);
  const dates = getMonthDates(year, month);
  const operatingDates = dates.filter((d) =>
    config.operatingDays.includes(getDayOfWeek(d))
  );

  // Etapas 1–4 + 5 (cobertura diária nos planos): buildAllWorkOffPlans
  const plans = buildAllWorkOffPlans(
    activeEmployees,
    operatingDates,
    config,
    activeShifts.length
  );

  // Etapas 5–6: atribuições com cobertura diária e por turno
  let assignments = buildAssignmentsFromPlans(
    plans,
    operatingDates,
    activeEmployees,
    activeShifts,
    config
  );

  // Etapa 7: otimizador de trocas locais (preferências, domingos, reparo de cobertura)
  assignments = runLocalSwapOptimizer({
    plans,
    assignments,
    operatingDates,
    employees: activeEmployees,
    shifts: activeShifts,
    config,
    repairCoverage: (current) =>
      repairAllCyclesCoverage(
        plans,
        current,
        operatingDates,
        activeEmployees,
        activeShifts,
        config
      ),
    rebuildDates: (current, changedDates) =>
      rebuildDatesAssignments(
        current,
        changedDates,
        activeEmployees,
        plans,
        activeShifts,
        config
      ),
  });

  // Etapa 8: conflitos somente após reparos
  const conflicts = collectScheduleConflicts({
    config,
    employees: activeEmployees,
    shifts: activeShifts,
    assignments,
    month,
    year,
    plans,
  });

  return { assignments, conflicts };
}
