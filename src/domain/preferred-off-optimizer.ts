import type { EmployeeData, ScheduleAssignmentData, ShiftData, StoreConfigData } from "./types";
import { getDayOfWeek, DAY_NAMES_FULL } from "@/lib/utils";
import {
  countWorkingOnDate,
  getCycleCounts,
  getFixedCycleWindows,
  isEmployeeRequiredOnDate,
  isForcedOffDay,
  trySwapWorkOffInCyclePlan,
} from "./cycle-patterns";
import { isPreferredOffDate } from "./employee-availability";
import { optimizeSundayOffPlans } from "./sunday-off-optimizer";

const LOG_PREFIX = "[preferencia-remanejamento]";

export function isPreferredOffOptimizationDebugEnabled(): boolean {
  return process.env.SCHEDULE_DEBUG === "1";
}

function debugLog(enabled: boolean, message: string, data?: Record<string, unknown>): void {
  if (!enabled) return;
  if (data) {
    console.debug(LOG_PREFIX, message, data);
  } else {
    console.debug(LOG_PREFIX, message);
  }
}

export function isWorkingInPlan(
  plans: Map<string, Map<string, boolean>>,
  employeeId: string,
  date: string
): boolean {
  return plans.get(employeeId)?.get(date) === true;
}

export function isOffInPlan(
  plans: Map<string, Map<string, boolean>>,
  employeeId: string,
  date: string
): boolean {
  return plans.get(employeeId)?.get(date) === false;
}

function validateCycleCoverage(
  plans: Map<string, Map<string, boolean>>,
  cycleDates: string[],
  minWorkersPerDay: number
): boolean {
  return cycleDates.every((date) => countWorkingOnDate(plans, date) >= minWorkersPerDay);
}

type SwapRejectionReason =
  | "estado_invalido_no_plano"
  | "indisponibilidade_ou_fim_de_semana"
  | "obrigatorio_por_cobertura_critica"
  | "quebra_regra_5x2"
  | "cobertura_insuficiente_no_ciclo"
  | "dia_preferencial_de_folga";

export function tryCrossEmployeeWorkOffSwap(
  plans: Map<string, Map<string, boolean>>,
  preferringEmployee: EmployeeData,
  coverEmployee: EmployeeData,
  preferredDate: string,
  compensationDate: string,
  cycleDates: string[],
  employees: EmployeeData[],
  config: StoreConfigData,
  minWorkersPerDay: number,
  skipPreferredOffChecks = false
): { applied: boolean; reason?: SwapRejectionReason } {
  const preferringPlan = plans.get(preferringEmployee.id);
  const coverPlan = plans.get(coverEmployee.id);
  if (!preferringPlan || !coverPlan) {
    return { applied: false, reason: "estado_invalido_no_plano" };
  }

  if (
    preferringPlan.get(preferredDate) !== true ||
    preferringPlan.get(compensationDate) !== false ||
    coverPlan.get(preferredDate) !== false ||
    coverPlan.get(compensationDate) !== true
  ) {
    return { applied: false, reason: "estado_invalido_no_plano" };
  }

  if (
    isForcedOffDay(coverEmployee, preferredDate, config) ||
    isForcedOffDay(preferringEmployee, compensationDate, config)
  ) {
    return { applied: false, reason: "indisponibilidade_ou_fim_de_semana" };
  }

  if (
    !skipPreferredOffChecks &&
    (isPreferredOffDate(preferringEmployee, compensationDate) ||
      isPreferredOffDate(coverEmployee, preferredDate))
  ) {
    return { applied: false, reason: "dia_preferencial_de_folga" };
  }

  if (
    isEmployeeRequiredOnDate(
      preferringEmployee.id,
      preferredDate,
      employees,
      config,
      minWorkersPerDay
    ) ||
    isEmployeeRequiredOnDate(
      coverEmployee.id,
      compensationDate,
      employees,
      config,
      minWorkersPerDay
    )
  ) {
    return { applied: false, reason: "obrigatorio_por_cobertura_critica" };
  }

  preferringPlan.set(preferredDate, false);
  preferringPlan.set(compensationDate, true);
  coverPlan.set(preferredDate, true);
  coverPlan.set(compensationDate, false);

  const preferringCounts = getCycleCounts(preferringPlan, cycleDates);
  const coverCounts = getCycleCounts(coverPlan, cycleDates);
  const coverageOk = validateCycleCoverage(plans, cycleDates, minWorkersPerDay);

  const valid =
    coverageOk &&
    preferringCounts.work === config.workDaysPerCycle &&
    preferringCounts.off === config.offDaysPerCycle &&
    coverCounts.work === config.workDaysPerCycle &&
    coverCounts.off === config.offDaysPerCycle;

  if (valid) {
    return { applied: true };
  }

  preferringPlan.set(preferredDate, true);
  preferringPlan.set(compensationDate, false);
  coverPlan.set(preferredDate, false);
  coverPlan.set(compensationDate, true);

  if (
    preferringCounts.work !== config.workDaysPerCycle ||
    preferringCounts.off !== config.offDaysPerCycle ||
    coverCounts.work !== config.workDaysPerCycle ||
    coverCounts.off !== config.offDaysPerCycle
  ) {
    return { applied: false, reason: "quebra_regra_5x2" };
  }

  return { applied: false, reason: "cobertura_insuficiente_no_ciclo" };
}

function getUnmetPreferredOffDatesInCycle(
  employee: EmployeeData,
  cycleDates: string[],
  plans: Map<string, Map<string, boolean>>,
  config: StoreConfigData
): string[] {
  return cycleDates.filter(
    (date) =>
      employee.preferredOffDays.includes(getDayOfWeek(date)) &&
      !isForcedOffDay(employee, date, config) &&
      isWorkingInPlan(plans, employee.id, date)
  );
}

function getCoverCandidates(
  employees: EmployeeData[],
  preferringEmployeeId: string,
  preferredDate: string,
  plans: Map<string, Map<string, boolean>>,
  config: StoreConfigData
): EmployeeData[] {
  return employees.filter(
    (employee) =>
      employee.id !== preferringEmployeeId &&
      isOffInPlan(plans, employee.id, preferredDate) &&
      !isForcedOffDay(employee, preferredDate, config)
  );
}

function getCompensationDates(
  cycleDates: string[],
  preferredDate: string,
  preferringEmployee: EmployeeData,
  coverEmployee: EmployeeData,
  plans: Map<string, Map<string, boolean>>,
  config: StoreConfigData
): string[] {
  return cycleDates
    .filter((date) => {
      if (date === preferredDate) return false;
      if (isForcedOffDay(preferringEmployee, date, config)) return false;
      if (isForcedOffDay(coverEmployee, date, config)) return false;
      if (isPreferredOffDate(preferringEmployee, date)) return false;
      return (
        isOffInPlan(plans, preferringEmployee.id, date) &&
        isWorkingInPlan(plans, coverEmployee.id, date)
      );
    })
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Etapa pós-geração: tenta remanejar folgas/trabalho no mesmo ciclo para honrar preferências.
 * Retorna as datas cujos planos foram alterados.
 */
export function optimizePreferredOffPlans(
  plans: Map<string, Map<string, boolean>>,
  employees: EmployeeData[],
  operatingDates: string[],
  config: StoreConfigData,
  activeShiftCount: number,
  debug = isPreferredOffOptimizationDebugEnabled()
): Set<string> {
  const changedDates = new Set<string>();
  const minWorkersPerDay = config.minEmployeesPerShift * activeShiftCount;
  const cycles = getFixedCycleWindows(operatingDates, config.cycleLengthDays);

  for (const cycleDates of cycles) {
    const cycleLabel = `${cycleDates[0]} a ${cycleDates[cycleDates.length - 1]}`;
    let cycleChanged = true;

    while (cycleChanged) {
      cycleChanged = false;

      for (const employee of employees) {
        if (employee.preferredOffDays.length === 0) continue;

        const unmetDates = getUnmetPreferredOffDatesInCycle(
          employee,
          cycleDates,
          plans,
          config
        );

        for (const preferredDate of unmetDates) {
          const dayName = DAY_NAMES_FULL[getDayOfWeek(preferredDate)];
          debugLog(debug, "preferência analisada", {
            employee: employee.name,
            employeeId: employee.id,
            date: preferredDate,
            dayName,
            cycle: cycleLabel,
          });

          const coverCandidates = getCoverCandidates(
            employees,
            employee.id,
            preferredDate,
            plans,
            config
          );

          debugLog(debug, "candidatos à troca", {
            employee: employee.name,
            date: preferredDate,
            candidates: coverCandidates.map((candidate) => candidate.name),
          });

          if (coverCandidates.length === 0) {
            debugLog(debug, "nenhum candidato de folga apto", {
              employee: employee.name,
              date: preferredDate,
            });
            continue;
          }

          let applied = false;

          for (const coverEmployee of coverCandidates) {
            const compensationDates = getCompensationDates(
              cycleDates,
              preferredDate,
              employee,
              coverEmployee,
              plans,
              config
            );

            for (const compensationDate of compensationDates) {
              const result = tryCrossEmployeeWorkOffSwap(
                plans,
                employee,
                coverEmployee,
                preferredDate,
                compensationDate,
                cycleDates,
                employees,
                config,
                minWorkersPerDay
              );

              if (result.applied) {
                changedDates.add(preferredDate);
                changedDates.add(compensationDate);
                cycleChanged = true;
                applied = true;

                debugLog(debug, "troca aplicada", {
                  preferringEmployee: employee.name,
                  coverEmployee: coverEmployee.name,
                  preferredDate,
                  compensationDate,
                  cycle: cycleLabel,
                });
                break;
              }

              debugLog(debug, "candidato rejeitado", {
                preferringEmployee: employee.name,
                coverEmployee: coverEmployee.name,
                preferredDate,
                compensationDate,
                reason: result.reason,
              });
            }

            if (applied) break;
          }

          if (!applied) {
            debugLog(debug, "troca não aplicada", {
              employee: employee.name,
              date: preferredDate,
              reason: "nenhuma combinação viável no ciclo",
            });
          }
        }
      }
    }
  }

  return changedDates;
}

function getSingleEmployeeCompensationDates(
  cycleDates: string[],
  preferredDate: string,
  employee: EmployeeData,
  plans: Map<string, Map<string, boolean>>,
  config: StoreConfigData
): string[] {
  return cycleDates
    .filter((date) => {
      if (date === preferredDate) return false;
      if (isForcedOffDay(employee, date, config)) return false;
      if (isPreferredOffDate(employee, date)) return false;
      return isOffInPlan(plans, employee.id, date);
    })
    .sort((a, b) => a.localeCompare(b));
}

/** Troca folga/trabalho do mesmo funcionário no ciclo quando há folga sobrando no dia preferido. */
export function optimizeSingleEmployeePreferredOffPlans(
  plans: Map<string, Map<string, boolean>>,
  employees: EmployeeData[],
  operatingDates: string[],
  config: StoreConfigData,
  activeShiftCount: number
): Set<string> {
  const changedDates = new Set<string>();
  const minWorkersPerDay = config.minEmployeesPerShift * activeShiftCount;
  const cycles = getFixedCycleWindows(operatingDates, config.cycleLengthDays);

  for (const cycleDates of cycles) {
    let cycleChanged = true;

    while (cycleChanged) {
      cycleChanged = false;

      for (const employee of employees) {
        if (employee.preferredOffDays.length === 0) continue;

        const unmetDates = getUnmetPreferredOffDatesInCycle(
          employee,
          cycleDates,
          plans,
          config
        );

        for (const preferredDate of unmetDates) {
          if (countWorkingOnDate(plans, preferredDate) <= minWorkersPerDay) continue;

          const compensationDates = getSingleEmployeeCompensationDates(
            cycleDates,
            preferredDate,
            employee,
            plans,
            config
          );

          for (const compensationDate of compensationDates) {
            if (
              !trySwapWorkOffInCyclePlan(
                plans,
                employee,
                preferredDate,
                compensationDate,
                cycleDates,
                employees,
                config,
                minWorkersPerDay
              )
            ) {
              continue;
            }

            if (countWorkingOnDate(plans, preferredDate) < minWorkersPerDay) {
              const employeePlan = plans.get(employee.id)!;
              employeePlan.set(preferredDate, true);
              employeePlan.set(compensationDate, false);
              continue;
            }

            changedDates.add(preferredDate);
            changedDates.add(compensationDate);
            cycleChanged = true;
            break;
          }

          if (cycleChanged) break;
        }

        if (cycleChanged) break;
      }
    }
  }

  return changedDates;
}

/** Verifica se ainda existe troca viável para atender a preferência no ciclo. */
export function canResolvePreferredOffWithSwap(
  plans: Map<string, Map<string, boolean>>,
  employee: EmployeeData,
  preferredDate: string,
  cycleDates: string[],
  employees: EmployeeData[],
  config: StoreConfigData,
  activeShiftCount: number
): boolean {
  const minWorkersPerDay = config.minEmployeesPerShift * activeShiftCount;
  const plan = plans.get(employee.id);
  if (!plan || plan.get(preferredDate) !== true) return false;

  if (countWorkingOnDate(plans, preferredDate) > minWorkersPerDay) {
    for (const compensationDate of getSingleEmployeeCompensationDates(
      cycleDates,
      preferredDate,
      employee,
      plans,
      config
    )) {
      const snapshot = new Map(
        [...plans.entries()].map(([id, dateMap]) => [id, new Map(dateMap)])
      );

      if (
        trySwapWorkOffInCyclePlan(
          snapshot,
          employee,
          preferredDate,
          compensationDate,
          cycleDates,
          employees,
          config,
          minWorkersPerDay
        ) &&
        countWorkingOnDate(snapshot, preferredDate) >= minWorkersPerDay
      ) {
        return true;
      }
    }
  }

  const coverCandidates = getCoverCandidates(
    employees,
    employee.id,
    preferredDate,
    plans,
    config
  );

  for (const coverEmployee of coverCandidates) {
    for (const compensationDate of getCompensationDates(
      cycleDates,
      preferredDate,
      employee,
      coverEmployee,
      plans,
      config
    )) {
      const snapshot = new Map(
        [...plans.entries()].map(([id, dateMap]) => [id, new Map(dateMap)])
      );

      if (
        tryCrossEmployeeWorkOffSwap(
          snapshot,
          employee,
          coverEmployee,
          preferredDate,
          compensationDate,
          cycleDates,
          employees,
          config,
          minWorkersPerDay
        ).applied
      ) {
        return true;
      }
    }
  }

  return false;
}

export interface LocalSwapOptimizerInput {
  plans: Map<string, Map<string, boolean>>;
  assignments: ScheduleAssignmentData[];
  operatingDates: string[];
  employees: EmployeeData[];
  shifts: ShiftData[];
  config: StoreConfigData;
  repairCoverage: (assignments: ScheduleAssignmentData[]) => ScheduleAssignmentData[];
  rebuildDates: (
    assignments: ScheduleAssignmentData[],
    changedDates: string[]
  ) => ScheduleAssignmentData[];
}

function applyPlanChanges(
  input: LocalSwapOptimizerInput,
  currentAssignments: ScheduleAssignmentData[],
  changedDates: Set<string>
): ScheduleAssignmentData[] {
  if (changedDates.size === 0) return currentAssignments;

  let result = input.rebuildDates(currentAssignments, [...changedDates]);
  result = input.repairCoverage(result);
  return result;
}

/**
 * Etapa 7 do pipeline: otimizador de trocas locais em múltiplas passadas.
 * - troca folga/trabalho no mesmo ciclo (mesmo funcionário e entre funcionários)
 * - preserva 5x2, cobertura, indisponibilidades e restrição de fim de semana
 * - tenta atender preferências e domingos de folga antes de gerar avisos
 */
export function runLocalSwapOptimizer(input: LocalSwapOptimizerInput): ScheduleAssignmentData[] {
  const activeShiftCount = input.shifts.length;
  let result = input.assignments;

  const optimizers = [
    () => optimizeSingleEmployeePreferredOffPlans(
      input.plans,
      input.employees,
      input.operatingDates,
      input.config,
      activeShiftCount
    ),
    () => optimizePreferredOffPlans(
      input.plans,
      input.employees,
      input.operatingDates,
      input.config,
      activeShiftCount
    ),
    () => optimizeSundayOffPlans(
      input.plans,
      input.employees,
      input.operatingDates,
      input.config,
      activeShiftCount
    ),
  ];

  const maxRounds = Math.max(3, input.employees.length * 3);

  for (let round = 0; round < maxRounds; round++) {
    let roundChanged = false;

    for (const optimize of optimizers) {
      const changedDates = optimize();
      if (changedDates.size === 0) continue;

      result = applyPlanChanges(input, result, changedDates);
      roundChanged = true;
    }

    if (!roundChanged) break;
  }

  return result;
}
