import { getDaysInMonth } from "@/lib/utils";
import type { ScheduleConflict } from "@/domain/types";
import { hasEmployeeConflict } from "./ConflictsList";
import { cn } from "@/lib/utils";

interface TableProps {
  month: number;
  year: number;
  employees: Array<{ id: string; name: string }>;
  assignments: Array<{
    date: string;
    employeeId: string;
    shiftName: string | null;
    isOff: boolean;
  }>;
  conflicts: ScheduleConflict[];
}

export function ScheduleTable({ month, year, employees, assignments, conflicts }: TableProps) {
  const daysInMonth = getDaysInMonth(year, month);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  function getDateStr(day: number) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function getCell(employeeId: string, date: string) {
    const assignment = assignments.find((a) => a.employeeId === employeeId && a.date === date);
    if (!assignment) return "—";
    if (assignment.isOff) return "Folga";
    return assignment.shiftName ?? "Trabalho";
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full text-xs">
        <thead className="bg-slate-50">
          <tr>
            <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-700">
              Funcionário
            </th>
            {days.map((day) => (
              <th key={day} className="px-2 py-2 font-semibold text-slate-600">
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.id} className="border-t border-slate-100">
              <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-slate-800">
                {employee.name}
              </td>
              {days.map((day) => {
                const date = getDateStr(day);
                const value = getCell(employee.id, date);
                const hasConflict = hasEmployeeConflict(conflicts, employee.id, date);

                return (
                  <td
                    key={date}
                    className={cn(
                      "px-2 py-2 text-center",
                      value === "Folga" && "text-slate-400",
                      value !== "Folga" && value !== "—" && "text-blue-700",
                      hasConflict && "bg-red-100 font-medium text-red-800"
                    )}
                  >
                    {value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
