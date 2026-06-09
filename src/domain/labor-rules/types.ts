export type ScheduleScaleType = "5x2" | "6x1" | "custom";

export type DayType = "normal" | "sunday" | "holiday";

export type ValidationSeverity = "error" | "warning" | "info";

export type LaborViolationCode =
  | "DAILY_HOURS_OVERTIME_POSSIBLE"
  | "DAILY_HOURS_EXCEEDED"
  | "WEEKLY_HOURS_EXCEEDED"
  | "BREAK_INSUFFICIENT"
  | "REST_BETWEEN_SHIFTS_INSUFFICIENT"
  | "WEEKLY_REST_MISSING"
  | "SCALE_6X1_VIOLATION"
  | "SCALE_5X2_VIOLATION"
  | "SUNDAY_WORK"
  | "CONSECUTIVE_SUNDAYS_WORKED"
  | "HOLIDAY_WORK";

export interface LaborRulesConfig {
  maxDailyMinutes: number;
  maxWeeklyMinutes: number;
  maxOvertimeDailyMinutes: number;
  minRestBetweenShiftsMinutes: number;
  minWeeklyRestMinutes: number;
  minBreakForShiftOver4hMinutes: number;
  minBreakForShiftOver6hMinutes: number;
  allowSundayWork: boolean;
  allowHolidayWork: boolean;
  /** Quando true, excesso semanal gera erro; caso contrário, alerta */
  strictWeeklyHours: boolean;
}

export interface LaborValidationIssue {
  code: LaborViolationCode;
  severity: ValidationSeverity;
  message: string;
  employeeId?: string;
  employeeName?: string;
  date?: string;
  shiftId?: string;
  shiftName?: string;
  expectedValue?: string | number;
  actualValue?: string | number;
}

export interface LaborValidationInput {
  config: {
    workDaysPerCycle: number;
    offDaysPerCycle: number;
    cycleLengthDays: number;
    holidayDates: string[];
  };
  laborRules: LaborRulesConfig;
  scheduleType: ScheduleScaleType;
  employees: Array<{ id: string; name: string }>;
  shifts: Array<{
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    breakMinutes: number;
  }>;
  assignments: Array<{
    employeeId: string;
    shiftId: string | null;
    date: string;
    isOff: boolean;
  }>;
  month: number;
  year: number;
}
