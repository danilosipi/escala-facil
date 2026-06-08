"use client";

import { Alert, Button, Input, Label } from "@/components/ui";
import type { ScheduleCapacityDiagnosis } from "@/domain/schedule-capacity";

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

interface GenerateScheduleFormProps {
  month: number;
  year: number;
  diagnosis: ScheduleCapacityDiagnosis;
  generateAction: (formData: FormData) => Promise<void>;
}

export function GenerateScheduleForm({
  month,
  year,
  diagnosis,
  generateAction,
}: GenerateScheduleFormProps) {
  const exactLimitDays = diagnosis.dayOfWeekDiagnosis.filter(
    (day) => day.status === "exact_limit"
  );
  const insufficientDays = diagnosis.dayOfWeekDiagnosis.filter(
    (day) => day.status === "insufficient"
  );

  return (
    <div className="space-y-4">
      {insufficientDays.length > 0 && (
        <Alert variant="warning">
          <p className="font-medium">Capacidade insuficiente em dias específicos</p>
          <ul className="mt-2 list-disc pl-5">
            {insufficientDays.map((day) => (
              <li key={day.dayOfWeek}>
                {day.dayName}: {day.eligibleEmployees} apto(s), {day.requiredWorkers} necessário(s)
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {diagnosis.deficit > 0 && (
        <Alert variant="warning">
          <p className="font-medium">Capacidade geral insuficiente</p>
          <p className="mt-1">
            Jornadas disponíveis: {diagnosis.availableCapacity} · Necessárias:{" "}
            {diagnosis.minimumRequired} · Déficit: {diagnosis.deficit}
          </p>
        </Alert>
      )}

      {exactLimitDays.length > 0 && insufficientDays.length === 0 && diagnosis.deficit === 0 && (
        <Alert variant="info">
          <p className="font-medium">Dias no limite exato de capacidade</p>
          <p className="mt-1">
            {exactLimitDays.map((day) => day.dayName).join(", ")}: todos os funcionários aptos
            precisarão trabalhar nesses dias.
          </p>
        </Alert>
      )}

      {(diagnosis.deficit > 0 || insufficientDays.length > 0) && (
        <p className="text-sm text-slate-600">
          A escala pode ser gerada, mas alguns turnos podem ficar descobertos. Ajuste a equipe em{" "}
          <a href="/funcionarios" className="font-medium text-blue-600 underline">
            Funcionários
          </a>{" "}
          ou a configuração em{" "}
          <a href="/configuracoes" className="font-medium text-blue-600 underline">
            Configurações
          </a>
          .
        </p>
      )}

      <form action={generateAction} className="flex flex-wrap items-end gap-4">
        <div>
          <Label htmlFor="month">Mês</Label>
          <select
            id="month"
            name="month"
            defaultValue={month}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {MONTH_NAMES.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="year">Ano</Label>
          <Input id="year" name="year" type="number" defaultValue={year} min={2020} max={2100} />
        </div>
        <Button type="submit">Gerar escala</Button>
      </form>
    </div>
  );
}
