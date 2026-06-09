import type { LaborRulesConfig, LaborViolationCode, ValidationSeverity } from "./labor-rules/types";

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type { LaborRulesConfig, LaborViolationCode, ValidationSeverity };

export interface StoreConfigData {
  id: string;
  name: string;
  openTime: string;
  closeTime: string;
  operatingDays: number[];
  dailyWorkHours: number;
  workDaysPerCycle: number;
  offDaysPerCycle: number;
  cycleLengthDays: number;
  consecutiveOffDaysRequired: boolean;
  minEmployeesPerShift: number;
  minSundayOffsPerMonth: number;
  holidayDates: string[];
  laborRules: LaborRulesConfig;
}

export interface EmployeeData {
  id: string;
  name: string;
  role: string | null;
  active: boolean;
  notes: string | null;
  preferredOffDays: number[];
  unavailableDates: string[];
  canWorkWeekend: boolean;
  cycleOffset: number;
}

export interface ShiftData {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  breakMinutes: number;
  active: boolean;
}

export interface ScheduleAssignmentData {
  employeeId: string;
  shiftId: string | null;
  date: string;
  isOff: boolean;
}

export type ConflictType =
  | "DAY_WITHOUT_COVERAGE"
  | "SHIFT_UNDERSTAFFED"
  | "EMPLOYEE_UNDER_WORK_DAYS"
  | "EMPLOYEE_OVER_WORK_DAYS"
  | "EMPLOYEE_UNDER_OFF_DAYS"
  | "EMPLOYEE_OVER_OFF_DAYS"
  | "EMPLOYEE_UNAVAILABLE_DAY"
  | "EMPLOYEE_DOUBLE_SHIFT"
  | "EMPLOYEE_WITHOUT_SCHEDULE"
  | "PREFERRED_OFF_NOT_HONORED"
  | "INSUFFICIENT_SUNDAY_OFFS"
  | "LABOR_RULE_VIOLATION";

export interface ScheduleConflict {
  type: ConflictType;
  message: string;
  date?: string;
  employeeId?: string;
  employeeName?: string;
  shiftId?: string;
  shiftName?: string;
  /** Conflito esperado por falta de capacidade da equipe */
  expected?: boolean;
  /** Regras trabalhistas */
  code?: LaborViolationCode;
  severity?: ValidationSeverity;
  expectedValue?: string | number;
  actualValue?: string | number;
}

export interface GeneratedSchedule {
  assignments: ScheduleAssignmentData[];
  conflicts: ScheduleConflict[];
}

export interface ValidationInput {
  config: StoreConfigData;
  employees: EmployeeData[];
  shifts: ShiftData[];
  assignments: ScheduleAssignmentData[];
  month: number;
  year: number;
}
