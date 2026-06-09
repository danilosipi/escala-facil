import type { ScheduleConflict } from "../types";
import type { LaborValidationIssue } from "./types";
import { getLaborViolationLabel } from "./labor-rules-validator";

export function laborIssueToScheduleConflict(issue: LaborValidationIssue): ScheduleConflict {
  return {
    type: "LABOR_RULE_VIOLATION",
    code: issue.code,
    severity: issue.severity,
    message: issue.message,
    date: issue.date,
    employeeId: issue.employeeId,
    employeeName: issue.employeeName,
    shiftId: issue.shiftId,
    shiftName: issue.shiftName,
    expectedValue: issue.expectedValue,
    actualValue: issue.actualValue,
  };
}

export function laborIssuesToScheduleConflicts(
  issues: LaborValidationIssue[]
): ScheduleConflict[] {
  return issues.map(laborIssueToScheduleConflict);
}

export function getLaborConflictLabel(conflict: ScheduleConflict): string {
  if (conflict.code) {
    return getLaborViolationLabel(conflict.code);
  }
  return "Regra trabalhista";
}
