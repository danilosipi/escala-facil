import type { ScheduleCapacityDiagnosis } from "@/domain/schedule-capacity";
import { getLaborConflictLabel } from "@/domain/labor-rules/to-schedule-conflict";
import type { ScheduleConflict } from "@/domain/types";

const conflictLabels: Record<Exclude<ScheduleConflict["type"], "LABOR_RULE_VIOLATION">, string> = {
  DAY_WITHOUT_COVERAGE: "Dia sem funcionário na loja",
  SHIFT_UNDERSTAFFED: "Turno com poucos funcionários",
  EMPLOYEE_UNDER_WORK_DAYS: "Poucos dias de trabalho no ciclo",
  EMPLOYEE_OVER_WORK_DAYS: "Muitos dias de trabalho no ciclo",
  EMPLOYEE_UNDER_OFF_DAYS: "Poucas folgas no ciclo",
  EMPLOYEE_OVER_OFF_DAYS: "Muitas folgas no ciclo",
  EMPLOYEE_UNAVAILABLE_DAY: "Escalado em dia indisponível",
  EMPLOYEE_DOUBLE_SHIFT: "Dois turnos no mesmo dia",
  EMPLOYEE_WITHOUT_SCHEDULE: "Funcionário sem escala",
  PREFERRED_OFF_NOT_HONORED: "Folga preferida não atendida",
  INSUFFICIENT_SUNDAY_OFFS: "Poucos domingos de folga no mês",
};

function getConflictLabel(conflict: ScheduleConflict): string {
  if (conflict.type === "LABOR_RULE_VIOLATION") {
    return getLaborConflictLabel(conflict);
  }
  return conflictLabels[conflict.type];
}

function isLaborInfo(conflict: ScheduleConflict): boolean {
  return conflict.type === "LABOR_RULE_VIOLATION" && conflict.severity === "info";
}

function isLaborWarning(conflict: ScheduleConflict): boolean {
  return conflict.type === "LABOR_RULE_VIOLATION" && conflict.severity === "warning";
}

function isLaborError(conflict: ScheduleConflict): boolean {
  return conflict.type === "LABOR_RULE_VIOLATION" && conflict.severity === "error";
}

export function ConflictsList({
  conflicts,
  diagnosis,
}: {
  conflicts: ScheduleConflict[];
  diagnosis?: ScheduleCapacityDiagnosis;
}) {
  const operationalWarnings = conflicts.filter(
    (c) => c.type === "PREFERRED_OFF_NOT_HONORED" || c.type === "INSUFFICIENT_SUNDAY_OFFS"
  );
  const laborWarnings = conflicts.filter((c) => isLaborWarning(c));
  const laborInfos = conflicts.filter((c) => isLaborInfo(c));
  const expected = conflicts.filter((c) => c.expected);
  const unexpected = conflicts.filter(
    (c) =>
      !c.expected &&
      c.type !== "PREFERRED_OFF_NOT_HONORED" &&
      c.type !== "INSUFFICIENT_SUNDAY_OFFS" &&
      !isLaborWarning(c) &&
      !isLaborInfo(c)
  );

  if (conflicts.length === 0) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        Nenhum alerta encontrado — a escala está dentro dos parâmetros configurados.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {unexpected.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-red-700">
            {unexpected.length} problema(s) que precisam de atenção
          </p>
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {unexpected.map((conflict, index) => (
              <ConflictItem key={`unexpected-${conflict.type}-${index}`} conflict={conflict} />
            ))}
          </ul>
        </div>
      )}

      {(operationalWarnings.length > 0 || laborWarnings.length > 0) && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-blue-800">
            {operationalWarnings.length + laborWarnings.length} alerta(s) para revisar
          </p>
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {[...operationalWarnings, ...laborWarnings].map((conflict, index) => (
              <ConflictItem key={`warning-${conflict.type}-${index}`} conflict={conflict} warning />
            ))}
          </ul>
        </div>
      )}

      {laborInfos.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">
            {laborInfos.length} ponto(s) para conferência
          </p>
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {laborInfos.map((conflict, index) => (
              <ConflictItem key={`info-${conflict.type}-${index}`} conflict={conflict} info />
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
  info = false,
}: {
  conflict: ScheduleConflict;
  expected?: boolean;
  warning?: boolean;
  info?: boolean;
}) {
  const className = info
    ? "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
    : warning
      ? "rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900"
      : expected
        ? "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        : "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800";

  const prefix = expected
    ? "Capacidade — "
    : warning
      ? "Alerta — "
      : info
        ? "Conferir — "
        : "";

  return (
    <li className={className}>
      <span className="font-medium">
        {prefix}
        {getConflictLabel(conflict)}:
      </span>{" "}
      {conflict.message}
      {conflict.expectedValue !== undefined && conflict.actualValue !== undefined && (
        <span className="mt-1 block text-xs opacity-80">
          Esperado: {conflict.expectedValue} · Encontrado: {conflict.actualValue}
        </span>
      )}
    </li>
  );
}

export function hasDateConflict(conflicts: ScheduleConflict[], date: string): boolean {
  return conflicts.some(
    (c) =>
      c.date === date &&
      !c.expected &&
      c.type !== "PREFERRED_OFF_NOT_HONORED" &&
      c.type !== "INSUFFICIENT_SUNDAY_OFFS" &&
      !isLaborInfo(c) &&
      (c.type !== "LABOR_RULE_VIOLATION" || isLaborError(c))
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
      !isLaborInfo(c) &&
      (c.type !== "LABOR_RULE_VIOLATION" || isLaborError(c)) &&
      c.employeeId === employeeId &&
      (date === undefined || c.date === date || c.date === undefined)
  );
}
