import type { EmployeeData, ScheduleConflict, StoreConfigData } from "./types";
import { DAY_NAMES_FULL, getDayOfWeek } from "@/lib/utils";
import { getFixedCycleWindows } from "./cycle-patterns";
import { isForcedOffDay } from "./employee-availability";

function isWorkAssignment(
  assignments: Array<{ employeeId: string; date: string; isOff: boolean; shiftId: string | null }>,
  employeeId: string,
  date: string
): boolean {
  const assignment = assignments.find(
    (item) => item.employeeId === employeeId && item.date === date
  );
  return Boolean(assignment && !assignment.isOff && assignment.shiftId);
}

export function detectUnmetPreferredOffConflicts(
  employees: EmployeeData[],
  assignments: Array<{ employeeId: string; date: string; isOff: boolean; shiftId: string | null }>,
  operatingDates: string[],
  config: StoreConfigData,
  _activeShiftCount: number
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const cycles = getFixedCycleWindows(operatingDates, config.cycleLengthDays);

  for (const employee of employees) {
    if (employee.preferredOffDays.length === 0) continue;

    for (const cycle of cycles) {
      const cycleLabel = `${cycle[0]} a ${cycle[cycle.length - 1]}`;
      const preferredDates = cycle.filter(
        (date) =>
          employee.preferredOffDays.includes(getDayOfWeek(date)) &&
          !isForcedOffDay(employee, date, config)
      );

      for (const date of preferredDates) {
        if (!isWorkAssignment(assignments, employee.id, date)) continue;

        const dayName = DAY_NAMES_FULL[getDayOfWeek(date)];

        conflicts.push({
          type: "PREFERRED_OFF_NOT_HONORED",
          message: `Preferência não atendida por impossibilidade de remanejamento sem violar cobertura ou 5x2: ${employee.name} preferia folgar ${dayName} no ciclo ${cycleLabel}.`,
          date,
          employeeId: employee.id,
          employeeName: employee.name,
        });
      }
    }
  }

  return conflicts;
}
