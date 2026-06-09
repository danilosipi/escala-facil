"use client";

import { Button } from "@/components/ui";
import type { EmployeeData, ScheduleAssignmentData, ShiftData } from "@/domain/types";

interface ExportScheduleButtonProps {
  month: number;
  year: number;
  storeName: string;
  employees: EmployeeData[];
  shifts: ShiftData[];
  assignments: ScheduleAssignmentData[];
}

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function ExportScheduleButton({
  month,
  year,
  storeName,
  employees,
  shifts,
  assignments,
}: ExportScheduleButtonProps) {
  function handleExport() {
    const shiftMap = new Map(shifts.map((shift) => [shift.id, shift]));
    const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));

    const header = ["Data", "Funcionário", "Cargo", "Turno", "Folga"];
    const rows = assignments
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date) || a.employeeId.localeCompare(b.employeeId))
      .map((assignment) => {
        const employee = employeeMap.get(assignment.employeeId);
        const shift = assignment.shiftId ? shiftMap.get(assignment.shiftId) : null;
        return [
          assignment.date,
          employee?.name ?? assignment.employeeId,
          employee?.role ?? "",
          assignment.isOff ? "Folga" : (shift?.name ?? ""),
          assignment.isOff ? "Sim" : "Não",
        ];
      });

    const csv = [
      `# Escala — ${storeName} — ${MONTH_NAMES[month - 1]} ${year}`,
      header.join(","),
      ...rows.map((row) => row.map((cell) => escapeCsv(String(cell))).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `escala-${storeName.toLowerCase().replace(/\s+/g, "-")}-${year}-${String(month).padStart(2, "0")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button type="button" variant="secondary" onClick={handleExport}>
      Exportar escala (CSV)
    </Button>
  );
}
