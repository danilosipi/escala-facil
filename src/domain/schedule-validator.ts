import type {
  EmployeeData,
  ScheduleAssignmentData,
  ScheduleConflict,
  ShiftData,
  StoreConfigData,
  ValidationInput,
} from "./types";
import { getFixedCycleWindows } from "./cycle-patterns";
import { getDayOfWeek, getMonthDates } from "@/lib/utils";

function getEmployeeAssignments(
  assignments: ScheduleAssignmentData[],
  employeeId: string
): ScheduleAssignmentData[] {
  return assignments.filter((a) => a.employeeId === employeeId);
}

function isWorkAssignment(assignment: ScheduleAssignmentData): boolean {
  return !assignment.isOff && Boolean(assignment.shiftId);
}

function validateEmployeeCycleRules(
  employee: EmployeeData,
  employeeAssignments: ScheduleAssignmentData[],
  operatingDates: string[],
  config: StoreConfigData,
  conflicts: ScheduleConflict[]
): void {
  const cycles = getFixedCycleWindows(operatingDates, config.cycleLengthDays);

  for (const cycle of cycles) {
    const workCount = cycle.filter((date) => {
      const a = employeeAssignments.find((x) => x.date === date);
      return a && isWorkAssignment(a);
    }).length;

    const offCount = cycle.filter((date) => {
      const a = employeeAssignments.find((x) => x.date === date);
      return a?.isOff;
    }).length;

    const label = `${cycle[0]} a ${cycle[cycle.length - 1]}`;

    if (
      workCount !== config.workDaysPerCycle ||
      offCount !== config.offDaysPerCycle
    ) {
      let type: ScheduleConflict["type"] = "EMPLOYEE_UNDER_WORK_DAYS";
      if (workCount > config.workDaysPerCycle) type = "EMPLOYEE_OVER_WORK_DAYS";
      else if (offCount > config.offDaysPerCycle) type = "EMPLOYEE_OVER_OFF_DAYS";
      else if (offCount < config.offDaysPerCycle) type = "EMPLOYEE_UNDER_OFF_DAYS";

      conflicts.push({
        type,
        message: `${employee.name} no ciclo ${label}: ${workCount} dia(s) trabalhado(s) e ${offCount} folga(s); esperado ${config.workDaysPerCycle} trabalho(s) e ${config.offDaysPerCycle} folga(s).`,
        employeeId: employee.id,
        employeeName: employee.name,
        date: cycle[0],
      });
    }
  }
}

export function validateSchedule(input: ValidationInput): ScheduleConflict[] {
  const { config, employees, shifts, assignments, month, year } = input;
  const conflicts: ScheduleConflict[] = [];
  const dates = getMonthDates(year, month);
  const operatingDates = dates.filter((d) =>
    config.operatingDays.includes(getDayOfWeek(d))
  );

  for (const date of operatingDates) {
    const workingAssignments = assignments.filter(
      (a) => a.date === date && isWorkAssignment(a)
    );

    if (workingAssignments.length === 0) {
      conflicts.push({
        type: "DAY_WITHOUT_COVERAGE",
        message: `Dia ${date} sem cobertura: nenhum funcionário em nenhum turno.`,
        date,
      });
      continue;
    }

    for (const shift of shifts) {
      const count = workingAssignments.filter((a) => a.shiftId === shift.id).length;
      if (count < config.minEmployeesPerShift) {
        conflicts.push({
          type: "SHIFT_UNDERSTAFFED",
          message: `Turno ${shift.name} em ${date} subdimensionado: ${count} funcionário(s), mínimo ${config.minEmployeesPerShift}.`,
          date,
          shiftId: shift.id,
          shiftName: shift.name,
        });
      }
    }
  }

  employees.forEach((employee) => {
    const employeeAssignments = getEmployeeAssignments(assignments, employee.id);
    const scheduledDates = new Set(employeeAssignments.map((a) => a.date));

    for (const date of operatingDates) {
      if (!scheduledDates.has(date)) {
        conflicts.push({
          type: "EMPLOYEE_WITHOUT_SCHEDULE",
          message: `${employee.name} sem escala em ${date}.`,
          date,
          employeeId: employee.id,
          employeeName: employee.name,
        });
      }
    }

    validateEmployeeCycleRules(
      employee,
      employeeAssignments,
      operatingDates,
      config,
      conflicts
    );

    for (const assignment of employeeAssignments) {
      if (employee.unavailableDates.includes(assignment.date) && !assignment.isOff) {
        conflicts.push({
          type: "EMPLOYEE_UNAVAILABLE_DAY",
          message: `${employee.name} escalado em dia indisponível (${assignment.date}).`,
          date: assignment.date,
          employeeId: employee.id,
          employeeName: employee.name,
        });
      }
    }

    const shiftsByDate = new Map<string, number>();
    for (const assignment of employeeAssignments.filter((a) => a.shiftId)) {
      const count = shiftsByDate.get(assignment.date) ?? 0;
      shiftsByDate.set(assignment.date, count + 1);
    }
    for (const [date, count] of shiftsByDate) {
      if (count > 1) {
        conflicts.push({
          type: "EMPLOYEE_DOUBLE_SHIFT",
          message: `${employee.name} escalado em ${count} turnos no dia ${date}.`,
          date,
          employeeId: employee.id,
          employeeName: employee.name,
        });
      }
    }
  });

  return conflicts;
}

export function countCycleWorkJourneys(
  assignments: ScheduleAssignmentData[],
  operatingDates: string[],
  cycleLengthDays: number
): number {
  const cycles = getFixedCycleWindows(operatingDates, cycleLengthDays);
  let total = 0;
  for (const cycle of cycles) {
    total += assignments.filter(
      (a) => cycle.includes(a.date) && !a.isOff && a.shiftId
    ).length;
  }
  return total;
}
