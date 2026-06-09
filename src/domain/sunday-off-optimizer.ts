import type { EmployeeData, StoreConfigData } from "./types";
import { getDayOfWeek } from "@/lib/utils";
import { getFixedCycleWindows, trySwapWorkOffInCyclePlan } from "./cycle-patterns";
import { isForcedOffDay } from "./employee-availability";
import {
  tryCrossEmployeeWorkOffSwap,
  isOffInPlan,
  isWorkingInPlan,
} from "./preferred-off-optimizer";
import { getOperatingSundays } from "./sunday-off-validator";

function countSundayOffsInPlan(
  plans: Map<string, Map<string, boolean>>,
  employeeId: string,
  sundayDates: string[]
): number {
  return sundayDates.filter((date) => isOffInPlan(plans, employeeId, date)).length;
}

function getCoverCandidatesForSunday(
  employees: EmployeeData[],
  employeeId: string,
  sundayDate: string,
  plans: Map<string, Map<string, boolean>>,
  config: StoreConfigData,
  sundays: string[],
  effectiveMin: number
): EmployeeData[] {
  return employees.filter(
    (employee) =>
      employee.id !== employeeId &&
      employee.canWorkWeekend &&
      isOffInPlan(plans, employee.id, sundayDate) &&
      !isForcedOffDay(employee, sundayDate, config) &&
      countSundayOffsInPlan(plans, employee.id, sundays) > effectiveMin
  );
}

function getCompensationDatesInCycle(
  cycleDates: string[],
  sundayDate: string,
  needingEmployee: EmployeeData,
  coverEmployee: EmployeeData,
  plans: Map<string, Map<string, boolean>>,
  config: StoreConfigData
): string[] {
  return cycleDates
    .filter((date) => {
      if (date === sundayDate) return false;
      if (isForcedOffDay(needingEmployee, date, config)) return false;
      if (isForcedOffDay(coverEmployee, date, config)) return false;
      if (needingEmployee.preferredOffDays.includes(getDayOfWeek(date))) return false;
      return (
        isOffInPlan(plans, needingEmployee.id, date) &&
        isWorkingInPlan(plans, coverEmployee.id, date)
      );
    })
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Tenta remanejar folgas/trabalho para garantir o mínimo de domingos de folga no mês.
 */
export function optimizeSundayOffPlans(
  plans: Map<string, Map<string, boolean>>,
  employees: EmployeeData[],
  operatingDates: string[],
  config: StoreConfigData,
  activeShiftCount: number
): Set<string> {
  const minRequired = config.minSundayOffsPerMonth;
  if (minRequired <= 0) return new Set();

  const sundays = getOperatingSundays(operatingDates);
  if (sundays.length === 0) return new Set();

  const effectiveMin = Math.min(minRequired, sundays.length);
  const minWorkersPerDay = config.minEmployeesPerShift * activeShiftCount;
  const cycles = getFixedCycleWindows(operatingDates, config.cycleLengthDays);
  const changedDates = new Set<string>();
  const eligibleEmployees = employees.filter((employee) => employee.canWorkWeekend);
  const maxPasses = Math.max(1, eligibleEmployees.length * sundays.length);

  for (let pass = 0; pass < maxPasses; pass++) {
    let passChanged = false;

    for (const employee of eligibleEmployees) {
      if (countSundayOffsInPlan(plans, employee.id, sundays) >= effectiveMin) {
        continue;
      }

      const workingSundays = sundays.filter((date) =>
        isWorkingInPlan(plans, employee.id, date)
      );

      for (const sundayDate of workingSundays) {
        const cycleDates = cycles.find((cycle) => cycle.includes(sundayDate));
        if (!cycleDates) continue;

        let applied = false;

        const selfOffDates = cycleDates
          .filter(
            (date) =>
              date !== sundayDate &&
              getDayOfWeek(date) !== 0 &&
              isOffInPlan(plans, employee.id, date) &&
              !isForcedOffDay(employee, date, config) &&
              !employee.preferredOffDays.includes(getDayOfWeek(date))
          )
          .sort((a, b) => a.localeCompare(b));

        for (const offDate of selfOffDates) {
          if (
            trySwapWorkOffInCyclePlan(
              plans,
              employee,
              sundayDate,
              offDate,
              cycleDates,
              employees,
              config,
              minWorkersPerDay
            )
          ) {
            changedDates.add(sundayDate);
            changedDates.add(offDate);
            passChanged = true;
            applied = true;
            break;
          }
        }

        if (applied) break;

        const coverCandidates = getCoverCandidatesForSunday(
          employees,
          employee.id,
          sundayDate,
          plans,
          config,
          sundays,
          effectiveMin
        );

        for (const coverEmployee of coverCandidates) {
          const compensationDates = getCompensationDatesInCycle(
            cycleDates,
            sundayDate,
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
              sundayDate,
              compensationDate,
              cycleDates,
              employees,
              config,
              minWorkersPerDay,
              true
            );

            if (result.applied) {
              changedDates.add(sundayDate);
              changedDates.add(compensationDate);
              passChanged = true;
              applied = true;
              break;
            }
          }

          if (applied) break;
        }

        if (applied) break;
      }
    }

    if (!passChanged) break;
  }

  return changedDates;
}

export function countSundayOffsFromPlans(
  plans: Map<string, Map<string, boolean>>,
  employeeId: string,
  operatingDates: string[]
): number {
  const sundays = getOperatingSundays(operatingDates);
  return countSundayOffsInPlan(plans, employeeId, sundays);
}
