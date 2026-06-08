"use client";

import { Alert, Badge, Card } from "@/components/ui";
import type { ScheduleCapacityDiagnosis as Diagnosis } from "@/domain/schedule-capacity";

export function ScheduleCapacityDiagnosisPanel({
  diagnosis,
}: {
  diagnosis: Diagnosis;
}) {
  const overallOk = diagnosis.isSufficient && !diagnosis.hasDayOfWeekDeficit;

  return (
    <Card className="md:col-span-2">
      <h2 className="text-lg font-semibold text-slate-900">Diagnóstico da escala</h2>
      <p className="mt-1 text-sm text-slate-500">
        Capacidade geral do ciclo e disponibilidade por dia da semana
      </p>

      <h3 className="mt-5 text-sm font-semibold text-slate-800">Capacidade geral do ciclo</h3>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Metric label="Funcionários ativos" value={diagnosis.activeEmployees} />
        <Metric label="Dias trabalhados por ciclo" value={diagnosis.workDaysPerCycle} />
        <Metric label="Dias de funcionamento no ciclo" value={diagnosis.operatingDaysInCycle} />
        <Metric label="Turnos ativos" value={diagnosis.activeShifts} />
        <Metric
          label="Mínimo de funcionários por turno"
          value={diagnosis.minEmployeesPerShift}
        />
        <Metric label="Jornadas disponíveis no ciclo" value={diagnosis.availableCapacity} />
        <Metric label="Jornadas necessárias no ciclo" value={diagnosis.minimumRequired} />
        {diagnosis.isSufficient ? (
          <Metric label="Sobra de jornadas" value={diagnosis.surplus} highlight="success" />
        ) : (
          <Metric label="Déficit de jornadas" value={diagnosis.deficit} highlight="danger" />
        )}
      </dl>

      <h3 className="mt-6 text-sm font-semibold text-slate-800">Capacidade por dia da semana</h3>
      <div className="mt-3 space-y-3">
        {diagnosis.dayOfWeekDiagnosis.map((day) => (
          <div
            key={day.dayOfWeek}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-slate-900">{day.dayName}</span>
              <DayStatusBadge status={day.status} />
            </div>
            <div className="mt-2 grid gap-1 text-slate-600 sm:grid-cols-2">
              <span>Funcionários aptos: {day.eligibleEmployees}</span>
              <span>Turnos necessários: {day.requiredWorkers}</span>
              {day.status === "insufficient" && <span className="text-red-700">Déficit: {day.deficit}</span>}
              {day.status === "exact_limit" && (
                <span className="text-amber-700">Limite exato — todos os aptos precisam trabalhar</span>
              )}
              {day.status === "sufficient" && <span className="text-green-700">Sobra: {day.surplus}</span>}
            </div>
            {day.eligibleEmployeeNames.length > 0 && (
              <p className="mt-1 text-xs text-slate-500">
                Aptos: {day.eligibleEmployeeNames.join(", ")}
              </p>
            )}
            {day.status === "insufficient" && (
              <p className="mt-2 text-xs font-medium text-red-700">
                Capacidade insuficiente para este dia da semana.
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {overallOk ? (
          <Alert variant="success">
            A configuração possui capacidade suficiente para cobrir os turnos mínimos.
          </Alert>
        ) : (
          <>
            {!diagnosis.isSufficient && (
              <Alert variant="warning">
                A configuração atual não possui funcionários suficientes para cobrir todos os
                turnos. A escala poderá ser gerada, mas alguns turnos ficarão descobertos.
              </Alert>
            )}
            {diagnosis.hasDayOfWeekDeficit && (
              <Alert variant="warning">
                Alguns dias da semana não possuem funcionários aptos suficientes para cobrir todos
                os turnos mínimos.
              </Alert>
            )}
          </>
        )}
        {!diagnosis.hasDayOfWeekDeficit &&
          diagnosis.dayOfWeekDiagnosis.some((day) => day.status === "exact_limit") && (
            <Alert variant="info">
              Há dias no limite exato de capacidade (ex.: fim de semana). Todos os funcionários
              aptos nesses dias precisarão trabalhar obrigatoriamente.
            </Alert>
          )}
      </div>
    </Card>
  );
}

function DayStatusBadge({
  status,
}: {
  status: Diagnosis["dayOfWeekDiagnosis"][number]["status"];
}) {
  if (status === "insufficient") return <Badge variant="danger">Insuficiente</Badge>;
  if (status === "exact_limit") return <Badge variant="warning">Limite exato</Badge>;
  return <Badge variant="success">Suficiente</Badge>;
}

function Metric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: "success" | "danger";
}) {
  const valueClass =
    highlight === "success"
      ? "text-green-700"
      : highlight === "danger"
        ? "text-red-700"
        : "text-slate-900";

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`mt-0.5 text-xl font-bold ${valueClass}`}>{value}</dd>
    </div>
  );
}
