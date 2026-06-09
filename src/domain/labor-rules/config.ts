import type { LaborRulesConfig, LaborValidationInput, ScheduleScaleType } from "./types";
import type { StoreConfigData } from "../types";

export const DEFAULT_LABOR_RULES: LaborRulesConfig = {
  maxDailyMinutes: 480,
  maxWeeklyMinutes: 2640,
  maxOvertimeDailyMinutes: 120,
  minRestBetweenShiftsMinutes: 660,
  minWeeklyRestMinutes: 1440,
  minBreakForShiftOver4hMinutes: 15,
  minBreakForShiftOver6hMinutes: 60,
  allowSundayWork: true,
  allowHolidayWork: true,
  strictWeeklyHours: false,
};

export function mergeLaborRulesConfig(
  partial?: Partial<LaborRulesConfig> | null
): LaborRulesConfig {
  return { ...DEFAULT_LABOR_RULES, ...partial };
}

export function deriveScheduleType(
  config: Pick<StoreConfigData, "workDaysPerCycle" | "offDaysPerCycle" | "cycleLengthDays">
): ScheduleScaleType {
  if (
    config.workDaysPerCycle === 6 &&
    config.offDaysPerCycle === 1 &&
    config.cycleLengthDays === 7
  ) {
    return "6x1";
  }
  if (
    config.workDaysPerCycle === 5 &&
    config.offDaysPerCycle === 2 &&
    config.cycleLengthDays === 7
  ) {
    return "5x2";
  }
  return "custom";
}

export function buildLaborValidationInput(
  config: StoreConfigData,
  employees: Array<{ id: string; name: string }>,
  shifts: Array<{
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    breakMinutes: number;
  }>,
  assignments: LaborValidationInput["assignments"],
  month: number,
  year: number
): LaborValidationInput {
  return {
    config: {
      workDaysPerCycle: config.workDaysPerCycle,
      offDaysPerCycle: config.offDaysPerCycle,
      cycleLengthDays: config.cycleLengthDays,
      holidayDates: config.holidayDates,
    },
    laborRules: config.laborRules,
    scheduleType: deriveScheduleType(config),
    employees,
    shifts,
    assignments,
    month,
    year,
  };
}
