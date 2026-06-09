import type { EmployeeData, ScheduleConflict, StoreConfigData } from "./types";
import { getDayOfWeek } from "@/lib/utils";

type AssignmentLike = {
  employeeId: string;
  date: string;
  isOff: boolean;
  shiftId: string | null;
};

export function getOperatingSundays(operatingDates: string[]): string[] {
  return operatingDates.filter((date) => getDayOfWeek(date) === 0);
}

export function countSundayOffsForEmployee(
  employeeId: string,
  assignments: AssignmentLike[],
  sundayDates: string[]
): number {
  return sundayDates.filter((date) => {
    const assignment = assignments.find(
      (item) => item.employeeId === employeeId && item.date === date
    );
    return Boolean(assignment?.isOff);
  }).length;
}

function isWorkAssignment(
  assignments: AssignmentLike[],
  employeeId: string,
  date: string
): boolean {
  const assignment = assignments.find(
    (item) => item.employeeId === employeeId && item.date === date
  );
  return Boolean(assignment && !assignment.isOff && assignment.shiftId);
}

export function detectInsufficientSundayOffConflicts(
  employees: EmployeeData[],
  assignments: AssignmentLike[],
  operatingDates: string[],
  config: StoreConfigData
): ScheduleConflict[] {
  const minRequired = config.minSundayOffsPerMonth;
  if (minRequired <= 0) return [];

  const sundays = getOperatingSundays(operatingDates);
  if (sundays.length === 0) return [];

  const effectiveMin = Math.min(minRequired, sundays.length);
  const conflicts: ScheduleConflict[] = [];

  for (const employee of employees) {
    if (!employee.canWorkWeekend) continue;

    const count = countSundayOffsForEmployee(employee.id, assignments, sundays);
    if (count >= effectiveMin) continue;

    const workedSundays = sundays.filter((date) =>
      isWorkAssignment(assignments, employee.id, date)
    );

    conflicts.push({
      type: "INSUFFICIENT_SUNDAY_OFFS",
      message: `${employee.name} folgou apenas ${count} domingo(s) no mês (mínimo ${effectiveMin}).${
        workedSundays.length > 0
          ? ` Trabalhou em: ${workedSundays.join(", ")}.`
          : ""
      }`,
      employeeId: employee.id,
      employeeName: employee.name,
      date: workedSundays[0],
    });
  }

  return conflicts;
}
