import type { ScheduleCapacityDiagnosis } from "@/domain/schedule-capacity";
import type { ScheduleConflict } from "@/domain/types";

const conflictLabels: Record<ScheduleConflict["type"], string> = {
  DAY_WITHOUT_COVERAGE: "Dia sem cobertura",
  SHIFT_UNDERSTAFFED: "Turno subdimensionado",
  EMPLOYEE_UNDER_WORK_DAYS: "Poucos dias trabalhados",
  EMPLOYEE_OVER_WORK_DAYS: "Excesso de dias trabalhados",
  EMPLOYEE_UNDER_OFF_DAYS: "Poucas folgas",
  EMPLOYEE_OVER_OFF_DAYS: "Excesso de folgas",
  EMPLOYEE_UNAVAILABLE_DAY: "Dia indisponível",
  EMPLOYEE_DOUBLE_SHIFT: "Dois turnos no mesmo dia",
  EMPLOYEE_WITHOUT_SCHEDULE: "Sem escala",
  PREFERRED_OFF_NOT_HONORED: "Preferência de folga não atendida",
  INSUFFICIENT_SUNDAY_OFFS: "Domingos de folga insuficientes",
};

export function ConflictsList({
  conflicts,
  diagnosis,
}: {
  conflicts: ScheduleConflict[];
  diagnosis?: ScheduleCapacityDiagnosis;
}) {
  const warnings = conflicts.filter(
    (c) => c.type === "PREFERRED_OFF_NOT_HONORED" || c.type === "INSUFFICIENT_SUNDAY_OFFS"
  );
  const expected = conflicts.filter((c) => c.expected);
  const unexpected = conflicts.filter(
    (c) =>
      !c.expected &&
      c.type !== "PREFERRED_OFF_NOT_HONORED" &&
      c.type !== "INSUFFICIENT_SUNDAY_OFFS"
  );

  if (conflicts.length === 0) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        Nenhum conflito encontrado na escala.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {unexpected.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-red-700">
            {unexpected.length} conflito(s) encontrado(s)
          </p>
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {unexpected.map((conflict, index) => (
              <ConflictItem key={`unexpected-${conflict.type}-${index}`} conflict={conflict} />
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-blue-800">
            {warnings.length} aviso(s) operacional(is)
          </p>
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {warnings.map((conflict, index) => (
              <ConflictItem key={`warning-${conflict.type}-${index}`} conflict={conflict} warning />
            ))}
          </ul>
        </div>
      )}

      {expected.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-amber-800">
            {expected.length} turno(s) descoberto(s) por falta de capacidade
            {diagnosis?.deficit
              ? ` (déficit geral de ${diagnosis.deficit} jornadas no ciclo)`
              : ""}
          </p>
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {expected.map((conflict, index) => (
              <ConflictItem key={`expected-${conflict.type}-${index}`} conflict={conflict} expected />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ConflictItem({
  conflict,
  expected = false,
  warning = false,
}: {
  conflict: ScheduleConflict;
  expected?: boolean;
  warning?: boolean;
}) {
  const className = warning
    ? "rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900"
    : expected
      ? "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
      : "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800";

  return (
    <li className={className}>
      <span className="font-medium">
        {expected ? "Esperado — " : warning ? "Aviso — " : ""}
        {conflictLabels[conflict.type]}:
      </span>{" "}
      {conflict.message}
    </li>
  );
}

export function hasDateConflict(conflicts: ScheduleConflict[], date: string): boolean {
  return conflicts.some(
    (c) =>
      c.date === date &&
      !c.expected &&
      c.type !== "PREFERRED_OFF_NOT_HONORED" &&
      c.type !== "INSUFFICIENT_SUNDAY_OFFS"
  );
}

export function hasEmployeeConflict(
  conflicts: ScheduleConflict[],
  employeeId: string,
  date?: string
): boolean {
  return conflicts.some(
    (c) =>
      !c.expected &&
      c.type !== "PREFERRED_OFF_NOT_HONORED" &&
      c.type !== "INSUFFICIENT_SUNDAY_OFFS" &&
      c.employeeId === employeeId &&
      (date === undefined || c.date === date || c.date === undefined)
  );
}
