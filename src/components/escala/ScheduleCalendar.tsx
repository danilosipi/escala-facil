import { DAY_NAMES, getDayOfWeek, getDaysInMonth } from "@/lib/utils";
import type { ScheduleConflict } from "@/domain/types";
import { hasDateConflict } from "./ConflictsList";
import { cn } from "@/lib/utils";

interface CalendarProps {
  month: number;
  year: number;
  assignments: Array<{
    date: string;
    employeeName: string;
    shiftName: string | null;
    isOff: boolean;
    employeeId: string;
  }>;
  shifts: Array<{ id: string; name: string }>;
  conflicts: ScheduleConflict[];
}

export function ScheduleCalendar({ month, year, assignments, shifts, conflicts }: CalendarProps) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfWeek = getDayOfWeek(`${year}-${String(month).padStart(2, "0")}-01`);

  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  while (cells.length % 7 !== 0) cells.push(null);

  function getDateStr(day: number) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return (
    <div className="overflow-x-auto">
      <div className="mb-4 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500">
        {DAY_NAMES.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {cells.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} className="min-h-28" />;

          const date = getDateStr(day);
          const dayAssignments = assignments.filter((a) => a.date === date);
          const hasConflict = hasDateConflict(conflicts, date);

          return (
            <div
              key={date}
              className={cn(
                "min-h-28 rounded-lg border p-2 text-xs",
                hasConflict ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"
              )}
            >
              <div className={cn("mb-1 font-bold", hasConflict && "text-red-700")}>{day}</div>
              <div className="space-y-1">
                {shifts.map((shift) => {
                  const shiftAssignments = dayAssignments.filter(
                    (a) => !a.isOff && a.shiftName === shift.name
                  );
                  return (
                    <div key={shift.id}>
                      <div className="font-medium text-slate-500">{shift.name}</div>
                      {shiftAssignments.length === 0 ? (
                        <div className="text-red-500">—</div>
                      ) : (
                        shiftAssignments.map((a, i) => (
                          <div key={i} className="text-slate-700">
                            {a.employeeName}
                          </div>
                        ))
                      )}
                    </div>
                  );
                })}
                {dayAssignments
                  .filter((a) => a.isOff)
                  .map((a, i) => (
                    <div key={i} className="text-slate-400">
                      {a.employeeName}: folga
                    </div>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
