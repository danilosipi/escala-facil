import type { EmployeeData, StoreConfigData } from "./types";
import { getDayOfWeek, isWeekend } from "@/lib/utils";

export function canEmployeeWorkOnDayOfWeek(
  employee: EmployeeData,
  dayOfWeek: number,
  config: Pick<StoreConfigData, "operatingDays">
): boolean {
  if (!config.operatingDays.includes(dayOfWeek)) return false;
  if (!employee.canWorkWeekend && isWeekend(dayOfWeek)) return false;
  return true;
}

export function getEligibleEmployeesForDate(
  employees: EmployeeData[],
  date: string,
  config: Pick<StoreConfigData, "operatingDays">
): EmployeeData[] {
  return employees.filter((employee) => !isForcedOffDay(employee, date, config));
}

export function isForcedOffDay(
  employee: EmployeeData,
  date: string,
  config: Pick<StoreConfigData, "operatingDays">
): boolean {
  const dayOfWeek = getDayOfWeek(date);
  if (employee.unavailableDates.includes(date)) return true;
  if (!employee.canWorkWeekend && isWeekend(dayOfWeek)) return true;
  if (!config.operatingDays.includes(dayOfWeek)) return true;
  return false;
}

export function isCriticalCoverageDate(
  employees: EmployeeData[],
  date: string,
  config: StoreConfigData,
  minWorkersPerDay: number
): boolean {
  const eligible = getEligibleEmployeesForDate(employees, date, config);
  return eligible.length > 0 && eligible.length <= minWorkersPerDay;
}

export function isEmployeeRequiredOnDate(
  employeeId: string,
  date: string,
  employees: EmployeeData[],
  config: StoreConfigData,
  minWorkersPerDay: number
): boolean {
  if (!isCriticalCoverageDate(employees, date, config, minWorkersPerDay)) return false;
  return getEligibleEmployeesForDate(employees, date, config).some((e) => e.id === employeeId);
}

export function countWorkingOnDate(
  plans: Map<string, Map<string, boolean>>,
  date: string
): number {
  let count = 0;
  for (const plan of plans.values()) {
    if (plan.get(date) === true) count++;
  }
  return count;
}

export function countEligibleAvailableOnDate(
  plans: Map<string, Map<string, boolean>>,
  date: string,
  employees: EmployeeData[],
  config: StoreConfigData,
  excludeEmployeeId?: string
): number {
  return employees.filter((employee) => {
    if (excludeEmployeeId && employee.id === excludeEmployeeId) return false;
    if (isForcedOffDay(employee, date, config)) return false;
    return plans.get(employee.id)?.get(date) !== false;
  }).length;
}

export function countWorkingOnDateIfEmployeeSet(
  plans: Map<string, Map<string, boolean>>,
  date: string,
  employeeId: string,
  works: boolean
): number {
  let count = 0;
  for (const [id, plan] of plans) {
    if (id === employeeId) {
      if (works) count++;
      continue;
    }
    if (plan.get(date) === true) count++;
  }
  return count;
}

export function getCycleCounts(
  plan: Map<string, boolean>,
  cycleDates: string[]
): { work: number; off: number } {
  let work = 0;
  let off = 0;
  for (const d of cycleDates) {
    if (plan.get(d) === true) work++;
    else if (plan.get(d) === false) off++;
  }
  return { work, off };
}

function scoreOffCandidate(
  employee: EmployeeData,
  date: string,
  baseOffDates: Set<string>,
  cycleIndex: number,
  surplus: number,
  isPreferred: boolean
): number {
  let score = surplus * 10;
  if (isPreferred) score += 1000;
  if (baseOffDates.has(date)) score += 25;
  score -= cycleIndex;
  return score;
}

function canEmployeeTakeOffOnDate(
  employeeId: string,
  date: string,
  plan: Map<string, boolean>,
  plans: Map<string, Map<string, boolean>>,
  flexibleDates: string[],
  config: StoreConfigData,
  minWorkersPerDay: number,
  workCount: number,
  offCount: number
): boolean {
  if (offCount >= config.offDaysPerCycle) return false;
  if (plan.get(date) === true) return false;

  if (
    countWorkingOnDateIfEmployeeSet(plans, date, employeeId, false) < minWorkersPerDay
  ) {
    return false;
  }

  const remainingWorkSlots = flexibleDates.filter(
    (flexDate) => flexDate !== date && plan.get(flexDate) !== false
  ).length;

  if (workCount + remainingWorkSlots < config.workDaysPerCycle) {
    return false;
  }

  return true;
}

export function isPreferredOffDate(employee: EmployeeData, date: string): boolean {
  return employee.preferredOffDays.includes(getDayOfWeek(date));
}

function buildMandatoryAssignments(
  employees: EmployeeData[],
  cycleDates: string[],
  config: StoreConfigData,
  minWorkersPerDay: number
): {
  mandatoryWork: Map<string, Set<string>>;
  mandatoryOff: Map<string, Set<string>>;
} {
  const mandatoryWork = new Map<string, Set<string>>();
  const mandatoryOff = new Map<string, Set<string>>();

  for (const date of cycleDates) {
    const eligible = getEligibleEmployeesForDate(employees, date, config);

    for (const employee of employees) {
      if (isForcedOffDay(employee, date, config)) {
        if (!mandatoryOff.has(employee.id)) mandatoryOff.set(employee.id, new Set());
        mandatoryOff.get(employee.id)!.add(date);
      }
    }

    if (eligible.length > 0 && eligible.length <= minWorkersPerDay) {
      for (const employee of eligible) {
        if (!mandatoryWork.has(employee.id)) mandatoryWork.set(employee.id, new Set());
        mandatoryWork.get(employee.id)!.add(date);
      }
    }
  }

  return { mandatoryWork, mandatoryOff };
}

function fillEmployeeRemainingCycleDays(
  employee: EmployeeData,
  employeeIndex: number,
  cycleDates: string[],
  cycleIndex: number,
  plans: Map<string, Map<string, boolean>>,
  config: StoreConfigData,
  mandatoryWork: Set<string>,
  mandatoryOff: Set<string>,
  minWorkersPerDay: number,
  employees: EmployeeData[]
): void {
  const plan = plans.get(employee.id)!;
  const flexibleDates = cycleDates.filter(
    (date) => !mandatoryWork.has(date) && !mandatoryOff.has(date)
  );

  const baseOffPositions = getOffDaysInCycle(employeeIndex + employee.cycleOffset, config);
  const baseOffDates = new Set(
    baseOffPositions.map((pos) => cycleDates[pos]).filter(Boolean)
  );

  const scoreOffDate = (date: string) => {
    const surplus = countEligibleAvailableOnDate(plans, date, employees, config, employee.id);
    const preferred = isPreferredOffDate(employee, date);
    return scoreOffCandidate(employee, date, baseOffDates, cycleIndex, surplus, preferred);
  };

  let { work: workCount, off: offCount } = getCycleCounts(plan, cycleDates);

  const preferredOffCandidates = flexibleDates
    .filter((date) => isPreferredOffDate(employee, date) && plan.get(date) !== true)
    .map((date) => ({
      date,
      surplus: countEligibleAvailableOnDate(plans, date, employees, config, employee.id),
    }))
    .sort((a, b) => b.surplus - a.surplus || a.date.localeCompare(b.date));

  for (const { date } of preferredOffCandidates) {
    if (offCount >= config.offDaysPerCycle) break;
    if (
      !canEmployeeTakeOffOnDate(
        employee.id,
        date,
        plan,
        plans,
        flexibleDates,
        config,
        minWorkersPerDay,
        workCount,
        offCount
      )
    ) {
      continue;
    }

    plan.set(date, false);
    offCount++;
  }

  const otherOffCandidates = flexibleDates
    .filter((date) => !isPreferredOffDate(employee, date) && plan.get(date) !== true)
    .map((date) => ({ date, score: scoreOffDate(date) }))
    .sort((a, b) => b.score - a.score || a.date.localeCompare(b.date));

  for (const { date } of otherOffCandidates) {
    if (offCount >= config.offDaysPerCycle) break;
    if (
      !canEmployeeTakeOffOnDate(
        employee.id,
        date,
        plan,
        plans,
        flexibleDates,
        config,
        minWorkersPerDay,
        workCount,
        offCount
      )
    ) {
      continue;
    }

    plan.set(date, false);
    offCount++;
  }

  ({ work: workCount, off: offCount } = getCycleCounts(plan, cycleDates));

  for (const date of flexibleDates) {
    if (workCount >= config.workDaysPerCycle) break;
    if (plan.get(date) === false) continue;
    plan.set(date, true);
    workCount++;
  }

  for (const date of flexibleDates) {
    if (plan.has(date)) continue;
    if (workCount < config.workDaysPerCycle) {
      plan.set(date, true);
      workCount++;
    } else {
      plan.set(date, false);
      offCount++;
    }
  }

  if (workCount > config.workDaysPerCycle) {
    const trimCandidates = flexibleDates
      .filter((date) => plan.get(date) === true)
      .map((date) => ({
        date,
        score: scoreOffDate(date),
        preferred: isPreferredOffDate(employee, date),
      }))
      .sort((a, b) => {
        if (a.preferred !== b.preferred) return a.preferred ? -1 : 1;
        return b.score - a.score || a.date.localeCompare(b.date);
      });

    for (const { date } of trimCandidates) {
      if (workCount <= config.workDaysPerCycle) break;
      if (
        countWorkingOnDateIfEmployeeSet(plans, date, employee.id, false) < minWorkersPerDay
      ) {
        continue;
      }
      plan.set(date, false);
      workCount--;
      offCount++;
    }
  }

  if (workCount < config.workDaysPerCycle) {
    const workCandidates = flexibleDates
      .filter((date) => plan.get(date) === false)
      .sort((a, b) => {
        const aPreferred = isPreferredOffDate(employee, a) ? 1 : 0;
        const bPreferred = isPreferredOffDate(employee, b) ? 1 : 0;
        if (aPreferred !== bPreferred) return aPreferred - bPreferred;
        return scoreOffDate(a) - scoreOffDate(b) || a.localeCompare(b);
      });

    for (const date of workCandidates) {
      if (workCount >= config.workDaysPerCycle) break;
      plan.set(date, true);
      workCount++;
      offCount = Math.max(0, offCount - 1);
    }
  }
}

export function buildCyclePlansWithAvailability(
  employees: EmployeeData[],
  cycleDates: string[],
  cycleIndex: number,
  config: StoreConfigData,
  activeShiftCount: number
): Map<string, Map<string, boolean>> {
  const minWorkersPerDay = config.minEmployeesPerShift * activeShiftCount;
  const plans = new Map<string, Map<string, boolean>>();

  for (const employee of employees) {
    plans.set(employee.id, new Map());
  }

  const { mandatoryWork, mandatoryOff } = buildMandatoryAssignments(
    employees,
    cycleDates,
    config,
    minWorkersPerDay
  );

  for (const employee of employees) {
    const plan = plans.get(employee.id)!;
    for (const date of mandatoryOff.get(employee.id) ?? []) plan.set(date, false);
    for (const date of mandatoryWork.get(employee.id) ?? []) plan.set(date, true);
  }

  const orderedEmployees = [...employees].sort((a, b) => {
    if (a.preferredOffDays.length !== b.preferredOffDays.length) {
      return b.preferredOffDays.length - a.preferredOffDays.length;
    }
    return 0;
  });

  orderedEmployees.forEach((employee) => {
    const index = employees.findIndex((item) => item.id === employee.id);
    fillEmployeeRemainingCycleDays(
      employee,
      index,
      cycleDates,
      cycleIndex,
      plans,
      config,
      mandatoryWork.get(employee.id) ?? new Set(),
      mandatoryOff.get(employee.id) ?? new Set(),
      minWorkersPerDay,
      employees
    );
  });

  return plans;
}

export function enforceCriticalDayWork(
  plans: Map<string, Map<string, boolean>>,
  cycleDates: string[],
  employees: EmployeeData[],
  config: StoreConfigData,
  activeShiftCount: number
): void {
  const minWorkersPerDay = config.minEmployeesPerShift * activeShiftCount;

  for (const date of cycleDates) {
    if (!isCriticalCoverageDate(employees, date, config, minWorkersPerDay)) continue;

    for (const employee of getEligibleEmployeesForDate(employees, date, config)) {
      plans.get(employee.id)!.set(date, true);
    }
  }
}

export function getOffDaysInCycle(
  employeeIndex: number,
  config: Pick<
    StoreConfigData,
    "consecutiveOffDaysRequired" | "offDaysPerCycle" | "cycleLengthDays"
  >
): number[] {
  const { consecutiveOffDaysRequired, offDaysPerCycle, cycleLengthDays } = config;

  if (consecutiveOffDaysRequired) {
    const start = (employeeIndex * offDaysPerCycle) % cycleLengthDays;
    return Array.from({ length: offDaysPerCycle }, (_, i) => (start + i) % cycleLengthDays);
  }

  const nonConsecutivePatterns: number[][] = [
    [5, 6],
    [0, 3],
    [1, 4],
    [2, 5],
    [3, 6],
    [0, 4],
    [1, 5],
    [2, 6],
  ];

  const pattern = nonConsecutivePatterns[employeeIndex % nonConsecutivePatterns.length];
  return pattern.slice(0, offDaysPerCycle);
}
