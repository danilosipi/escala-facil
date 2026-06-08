import type { EmployeeData, ScheduleConflict, StoreConfigData } from "./types";
import { DAY_NAMES_FULL } from "@/lib/utils";
import { canEmployeeWorkOnDayOfWeek } from "./employee-availability";

export type DayOfWeekCapacityStatus = "sufficient" | "exact_limit" | "insufficient";

export interface DayOfWeekCapacityDiagnosis {
  dayOfWeek: number;
  dayName: string;
  eligibleEmployees: number;
  eligibleEmployeeNames: string[];
  requiredWorkers: number;
  surplus: number;
  deficit: number;
  status: DayOfWeekCapacityStatus;
}

export interface ScheduleCapacityDiagnosis {
  activeEmployees: number;
  workDaysPerCycle: number;
  operatingDaysInCycle: number;
  activeShifts: number;
  minEmployeesPerShift: number;
  availableCapacity: number;
  minimumRequired: number;
  deficit: number;
  surplus: number;
  isSufficient: boolean;
  dayOfWeekDiagnosis: DayOfWeekCapacityDiagnosis[];
  hasDayOfWeekDeficit: boolean;
}

export function getOperatingDaysInCycle(
  operatingDays: number[],
  cycleLengthDays: number
): number {
  return Math.round((operatingDays.length / 7) * cycleLengthDays);
}

export function buildDayOfWeekCapacityDiagnosis(
  employees: EmployeeData[],
  config: Pick<StoreConfigData, "operatingDays" | "minEmployeesPerShift">,
  activeShifts: number
): DayOfWeekCapacityDiagnosis[] {
  const activeEmployees = employees.filter((employee) => employee.active);
  const requiredWorkers = activeShifts * config.minEmployeesPerShift;

  return [...config.operatingDays]
    .sort((a, b) => a - b)
    .map((dayOfWeek) => {
      const eligible = activeEmployees.filter((employee) =>
        canEmployeeWorkOnDayOfWeek(employee, dayOfWeek, config)
      );
      const balance = eligible.length - requiredWorkers;

      return {
        dayOfWeek,
        dayName: DAY_NAMES_FULL[dayOfWeek],
        eligibleEmployees: eligible.length,
        eligibleEmployeeNames: eligible.map((employee) => employee.name),
        requiredWorkers,
        surplus: balance > 0 ? balance : 0,
        deficit: balance < 0 ? -balance : 0,
        status:
          balance < 0 ? "insufficient" : balance === 0 ? "exact_limit" : "sufficient",
      };
    });
}

export function buildScheduleCapacityDiagnosis(input: {
  employees: EmployeeData[];
  workDaysPerCycle: number;
  operatingDays: number[];
  cycleLengthDays: number;
  activeShifts: number;
  minEmployeesPerShift: number;
}): ScheduleCapacityDiagnosis {
  const activeEmployees = input.employees.filter((employee) => employee.active);
  const operatingDaysInCycle = getOperatingDaysInCycle(
    input.operatingDays,
    input.cycleLengthDays
  );
  const availableCapacity = activeEmployees.length * input.workDaysPerCycle;
  const minimumRequired =
    operatingDaysInCycle * input.activeShifts * input.minEmployeesPerShift;
  const balance = availableCapacity - minimumRequired;

  const dayOfWeekDiagnosis = buildDayOfWeekCapacityDiagnosis(
    input.employees,
    {
      operatingDays: input.operatingDays,
      minEmployeesPerShift: input.minEmployeesPerShift,
    },
    input.activeShifts
  );

  return {
    activeEmployees: activeEmployees.length,
    workDaysPerCycle: input.workDaysPerCycle,
    operatingDaysInCycle,
    activeShifts: input.activeShifts,
    minEmployeesPerShift: input.minEmployeesPerShift,
    availableCapacity,
    minimumRequired,
    deficit: balance < 0 ? -balance : 0,
    surplus: balance > 0 ? balance : 0,
    isSufficient: balance >= 0,
    dayOfWeekDiagnosis,
    hasDayOfWeekDeficit: dayOfWeekDiagnosis.some((day) => day.status === "insufficient"),
  };
}

export function buildScheduleCapacityFromConfig(
  config: Pick<
    StoreConfigData,
    "workDaysPerCycle" | "operatingDays" | "cycleLengthDays" | "minEmployeesPerShift"
  >,
  employees: EmployeeData[],
  activeShifts: number
): ScheduleCapacityDiagnosis {
  return buildScheduleCapacityDiagnosis({
    employees,
    workDaysPerCycle: config.workDaysPerCycle,
    operatingDays: config.operatingDays,
    cycleLengthDays: config.cycleLengthDays,
    activeShifts,
    minEmployeesPerShift: config.minEmployeesPerShift,
  });
}

export function hasCapacityDeficit(diagnosis: ScheduleCapacityDiagnosis): boolean {
  return diagnosis.deficit > 0 || diagnosis.hasDayOfWeekDeficit;
}

export function markExpectedCapacityConflicts(
  conflicts: ScheduleConflict[],
  diagnosis: ScheduleCapacityDiagnosis
): void {
  if (!hasCapacityDeficit(diagnosis)) return;

  for (const conflict of conflicts) {
    if (conflict.type === "SHIFT_UNDERSTAFFED") {
      conflict.expected = true;
    }
  }
}
