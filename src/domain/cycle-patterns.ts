import type { EmployeeData, StoreConfigData } from "./types";
import {
  buildCyclePlansWithAvailability,
  countWorkingOnDate,
  countWorkingOnDateIfEmployeeSet,
  enforceCriticalDayWork,
  getCycleCounts,
  getEligibleEmployeesForDate,
  isCriticalCoverageDate,
  isEmployeeRequiredOnDate,
  isForcedOffDay,
  isPreferredOffDate,
} from "./employee-availability";
import { getDayOfWeek } from "@/lib/utils";

export {
  buildCyclePlansWithAvailability,
  canEmployeeWorkOnDayOfWeek,
  countEligibleAvailableOnDate,
  countWorkingOnDate,
  enforceCriticalDayWork,
  getCycleCounts,
  getEligibleEmployeesForDate,
  getOffDaysInCycle,
  isCriticalCoverageDate,
  isEmployeeRequiredOnDate,
  isForcedOffDay,
} from "./employee-availability";

/** Ciclos fixos e consecutivos de N dias a partir do início da escala (1º dia operacional do mês). */
export function getFixedCycleWindows(
  operatingDates: string[],
  cycleLengthDays: number
): string[][] {
  const cycles: string[][] = [];
  for (let i = 0; i + cycleLengthDays <= operatingDates.length; i += cycleLengthDays) {
    cycles.push(operatingDates.slice(i, i + cycleLengthDays));
  }
  return cycles;
}

/** Dias operacionais restantes que não formam um ciclo completo. */
export function getPartialCycleDates(
  operatingDates: string[],
  cycleLengthDays: number
): string[] {
  const completeCount =
    Math.floor(operatingDates.length / cycleLengthDays) * cycleLengthDays;
  return operatingDates.slice(completeCount);
}

export function trySwapWorkOffInCyclePlan(
  plans: Map<string, Map<string, boolean>>,
  employee: EmployeeData,
  workDate: string,
  offDate: string,
  cycleDates: string[],
  employees: EmployeeData[],
  config: StoreConfigData,
  minWorkersPerDay: number
): boolean {
  const plan = plans.get(employee.id);
  if (!plan) return false;
  if (plan.get(workDate) !== true || plan.get(offDate) !== false) return false;
  if (isForcedOffDay(employee, offDate, config)) return false;
  if (isForcedOffDay(employee, workDate, config)) return false;
  if (
    isEmployeeRequiredOnDate(employee.id, workDate, employees, config, minWorkersPerDay)
  ) {
    return false;
  }

  plan.set(workDate, false);
  plan.set(offDate, true);

  const counts = getCycleCounts(plan, cycleDates);
  if (
    counts.work === config.workDaysPerCycle &&
    counts.off === config.offDaysPerCycle
  ) {
    return true;
  }

  plan.set(workDate, true);
  plan.set(offDate, false);
  return false;
}

export function tryAddWorkerToDateInPlan(
  plans: Map<string, Map<string, boolean>>,
  targetDate: string,
  cycleDates: string[],
  employees: EmployeeData[],
  config: StoreConfigData,
  minWorkersPerDay: number
): boolean {
  const candidates = employees
    .filter((employee) => {
      const plan = plans.get(employee.id);
      return (
        plan?.get(targetDate) === false &&
        !isForcedOffDay(employee, targetDate, config)
      );
    })
    .flatMap((employee) => {
      const plan = plans.get(employee.id)!;
      return cycleDates
        .filter((date) => {
          if (date === targetDate) return false;
          if (plan.get(date) !== true) return false;
          if (isForcedOffDay(employee, date, config)) return false;
          if (
            isEmployeeRequiredOnDate(employee.id, date, employees, config, minWorkersPerDay)
          ) {
            return false;
          }
          return true;
        })
        .map((fromDate) => ({
          employee,
          fromDate,
          targetIsPreferred: employee.preferredOffDays.includes(getDayOfWeek(targetDate)),
          fromIsPreferred: employee.preferredOffDays.includes(getDayOfWeek(fromDate)),
          surplus: countWorkingOnDate(plans, fromDate) - minWorkersPerDay,
        }))
        .filter((item) => item.surplus > 0);
    })
    .sort((a, b) => {
      if (a.targetIsPreferred !== b.targetIsPreferred) {
        return a.targetIsPreferred ? 1 : -1;
      }
      if (a.fromIsPreferred !== b.fromIsPreferred) {
        return a.fromIsPreferred ? 1 : -1;
      }
      return b.surplus - a.surplus || a.fromDate.localeCompare(b.fromDate);
    });

  for (const { employee, fromDate } of candidates) {
    if (
      trySwapWorkOffInCyclePlan(
        plans,
        employee,
        fromDate,
        targetDate,
        cycleDates,
        employees,
        config,
        minWorkersPerDay
      )
    ) {
      return true;
    }
  }

  return false;
}

/** Ajusta folgas dentro do ciclo para atingir cobertura mínima diária sem quebrar 5x2. */
export function rebalanceCycleDailyCoverage(
  plans: Map<string, Map<string, boolean>>,
  cycleDates: string[],
  employees: EmployeeData[],
  config: StoreConfigData,
  activeShiftCount: number
): void {
  const minWorkersPerDay = config.minEmployeesPerShift * activeShiftCount;

  for (let pass = 0; pass < employees.length * cycleDates.length; pass++) {
    let changed = false;

    const datesByCoverage = [...cycleDates].sort(
      (a, b) => countWorkingOnDate(plans, a) - countWorkingOnDate(plans, b)
    );

    for (const date of datesByCoverage) {
      while (countWorkingOnDate(plans, date) < minWorkersPerDay) {
        if (
          !tryAddWorkerToDateInPlan(
            plans,
            date,
            cycleDates,
            employees,
            config,
            minWorkersPerDay
          )
        ) {
          break;
        }
        changed = true;
      }
    }

    if (!changed) break;
  }
}

function applyPartialCycleWithAvailability(
  employees: EmployeeData[],
  partialDates: string[],
  plans: Map<string, Map<string, boolean>>,
  config: StoreConfigData,
  activeShiftCount: number
): void {
  const minWorkersPerDay = config.minEmployeesPerShift * activeShiftCount;
  const orderedEmployees = [...employees].sort((a, b) => {
    if (a.preferredOffDays.length !== b.preferredOffDays.length) {
      return b.preferredOffDays.length - a.preferredOffDays.length;
    }
    return 0;
  });

  for (const date of partialDates) {
    for (const employee of employees) {
      if (isForcedOffDay(employee, date, config)) {
        plans.get(employee.id)!.set(date, false);
      }
    }

    if (isCriticalCoverageDate(employees, date, config, minWorkersPerDay)) {
      for (const employee of getEligibleEmployeesForDate(employees, date, config)) {
        plans.get(employee.id)!.set(date, true);
      }
      continue;
    }

    for (const employee of orderedEmployees) {
      const plan = plans.get(employee.id)!;
      if (plan.has(date)) continue;
      if (isForcedOffDay(employee, date, config)) continue;

      if (
        isPreferredOffDate(employee, date) &&
        countWorkingOnDateIfEmployeeSet(plans, date, employee.id, false) > 0
      ) {
        plan.set(date, false);
      }
    }

    while (countWorkingOnDate(plans, date) < minWorkersPerDay) {
      const candidate =
        orderedEmployees.find(
          (employee) =>
            !isForcedOffDay(employee, date, config) &&
            plans.get(employee.id)?.get(date) !== true &&
            !isPreferredOffDate(employee, date)
        ) ??
        orderedEmployees.find(
          (employee) =>
            !isForcedOffDay(employee, date, config) &&
            plans.get(employee.id)?.get(date) !== true
        );

      if (!candidate) break;
      plans.get(candidate.id)!.set(date, true);
    }

    for (const employee of employees) {
      const plan = plans.get(employee.id)!;
      if (!plan.has(date)) {
        plan.set(date, false);
      }
    }
  }

  enforceCriticalDayWork(plans, partialDates, employees, config, activeShiftCount);
}

export function buildAllWorkOffPlans(
  employees: EmployeeData[],
  operatingDates: string[],
  config: StoreConfigData,
  activeShiftCount: number
): Map<string, Map<string, boolean>> {
  const plans = new Map<string, Map<string, boolean>>();
  employees.forEach((employee) => plans.set(employee.id, new Map()));

  const cycles = getFixedCycleWindows(operatingDates, config.cycleLengthDays);
  for (const [cycleIndex, cycleDates] of cycles.entries()) {
    const cyclePlans = buildCyclePlansWithAvailability(
      employees,
      cycleDates,
      cycleIndex,
      config,
      activeShiftCount
    );

    for (const [employeeId, dateMap] of cyclePlans) {
      for (const [date, works] of dateMap) {
        plans.get(employeeId)!.set(date, works);
      }
    }
  }

  const partial = getPartialCycleDates(operatingDates, config.cycleLengthDays);
  if (partial.length > 0) {
    applyPartialCycleWithAvailability(
      employees,
      partial,
      plans,
      config,
      activeShiftCount
    );
  }

  for (const cycleDates of cycles) {
    rebalanceCycleDailyCoverage(plans, cycleDates, employees, config, activeShiftCount);
    enforceCriticalDayWork(plans, cycleDates, employees, config, activeShiftCount);
  }

  if (partial.length > 0) {
    enforceCriticalDayWork(plans, partial, employees, config, activeShiftCount);
  }

  return plans;
}
