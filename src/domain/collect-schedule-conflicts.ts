import type {
  EmployeeData,
  ScheduleAssignmentData,
  ScheduleConflict,
  ShiftData,
  StoreConfigData,
} from "./types";
import { validateSchedule } from "./schedule-validator";
import { detectUnmetPreferredOffConflicts } from "./preferred-off-validator";
import { detectInsufficientSundayOffConflicts } from "./sunday-off-validator";
import {
  buildScheduleCapacityFromConfig,
  markExpectedCapacityConflicts,
} from "./schedule-capacity";
import { buildLaborValidationInput } from "./labor-rules/config";
import { validateLaborRules } from "./labor-rules/labor-rules-validator";
import { laborIssuesToScheduleConflicts } from "./labor-rules/to-schedule-conflict";
import { getDayOfWeek, getMonthDates } from "@/lib/utils";

export function collectScheduleConflicts(input: {
  config: StoreConfigData;
  employees: EmployeeData[];
  shifts: ShiftData[];
  assignments: ScheduleAssignmentData[];
  month: number;
  year: number;
}): ScheduleConflict[] {
  const { config, employees, shifts, assignments, month, year } = input;
  const operatingDates = getMonthDates(year, month).filter((date) =>
    config.operatingDays.includes(getDayOfWeek(date))
  );

  const conflicts = validateSchedule({
    config,
    employees,
    shifts,
    assignments,
    month,
    year,
  });

  conflicts.push(
    ...detectUnmetPreferredOffConflicts(
      employees,
      assignments,
      operatingDates,
      config,
      shifts.length
    )
  );

  conflicts.push(
    ...detectInsufficientSundayOffConflicts(employees, assignments, operatingDates, config)
  );

  const laborInput = buildLaborValidationInput(
    config,
    employees,
    shifts,
    assignments,
    month,
    year
  );
  conflicts.push(...laborIssuesToScheduleConflicts(validateLaborRules(laborInput)));

  const capacity = buildScheduleCapacityFromConfig(config, employees, shifts.length);
  markExpectedCapacityConflicts(conflicts, capacity);

  return conflicts;
}
