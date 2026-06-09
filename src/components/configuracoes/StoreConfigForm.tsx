"use client";

import { useMemo, useState } from "react";
import { Button, Input, Label } from "@/components/ui";
import { DAY_NAMES_FULL } from "@/lib/utils";
import { buildScheduleCapacityDiagnosis } from "@/domain/schedule-capacity";
import type { EmployeeData, StoreConfigData } from "@/domain/types";
import { ScheduleCapacityDiagnosisPanel } from "./ScheduleCapacityDiagnosis";

interface StoreConfigFormProps {
  config: StoreConfigData;
  employees: EmployeeData[];
  activeShifts: number;
  saveAction: (formData: FormData) => Promise<void>;
}

export function StoreConfigForm({
  config,
  employees,
  activeShifts,
  saveAction,
}: StoreConfigFormProps) {
  const [workDaysPerCycle, setWorkDaysPerCycle] = useState(config.workDaysPerCycle);
  const [offDaysPerCycle, setOffDaysPerCycle] = useState(config.offDaysPerCycle);
  const [cycleLengthDays, setCycleLengthDays] = useState(config.cycleLengthDays);
  const [minEmployeesPerShift, setMinEmployeesPerShift] = useState(config.minEmployeesPerShift);
  const [operatingDays, setOperatingDays] = useState<number[]>(config.operatingDays);

  function applyScalePreset(preset: "5x2" | "6x1" | "custom") {
    if (preset === "5x2") {
      setWorkDaysPerCycle(5);
      setOffDaysPerCycle(2);
      setCycleLengthDays(7);
      return;
    }
    if (preset === "6x1") {
      setWorkDaysPerCycle(6);
      setOffDaysPerCycle(1);
      setCycleLengthDays(7);
    }
  }

  const diagnosis = useMemo(
    () =>
      buildScheduleCapacityDiagnosis({
        employees,
        workDaysPerCycle,
        operatingDays,
        cycleLengthDays,
        activeShifts,
        minEmployeesPerShift,
      }),
    [
      employees,
      workDaysPerCycle,
      operatingDays,
      cycleLengthDays,
      activeShifts,
      minEmployeesPerShift,
    ]
  );

  function toggleOperatingDay(day: number) {
    setOperatingDays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort()
    );
  }

  return (
    <form action={saveAction} className="grid gap-6 md:grid-cols-2">
      <div className="md:col-span-2">
        <Label htmlFor="name">Nome da loja</Label>
        <Input id="name" name="name" defaultValue={config.name} required />
      </div>

      <div>
        <Label htmlFor="openTime">Horário de abertura</Label>
        <Input
          id="openTime"
          name="openTime"
          type="time"
          defaultValue={config.openTime}
          required
        />
      </div>

      <div>
        <Label htmlFor="closeTime">Horário de fechamento</Label>
        <Input
          id="closeTime"
          name="closeTime"
          type="time"
          defaultValue={config.closeTime}
          required
        />
      </div>

      <div className="md:col-span-2">
        <Label>Modelo de escala</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => applyScalePreset("5x2")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
          >
            5x2 — 5 dias de trabalho, 2 de folga
          </button>
          <button
            type="button"
            onClick={() => applyScalePreset("6x1")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
          >
            6x1 — 6 dias de trabalho, 1 de folga
          </button>
          <button
            type="button"
            onClick={() => applyScalePreset("custom")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
          >
            Personalizada — ajuste manual abaixo
          </button>
        </div>
      </div>

      <div>
        <Label htmlFor="dailyWorkHours">Carga horária diária (horas)</Label>
        <Input
          id="dailyWorkHours"
          name="dailyWorkHours"
          type="number"
          min={1}
          max={24}
          defaultValue={config.dailyWorkHours}
          required
        />
      </div>

      <div>
        <Label htmlFor="minEmployeesPerShift">Mínimo de funcionários por turno</Label>
        <Input
          id="minEmployeesPerShift"
          name="minEmployeesPerShift"
          type="number"
          min={1}
          value={minEmployeesPerShift}
          onChange={(e) => setMinEmployeesPerShift(Number(e.target.value) || 1)}
          required
        />
      </div>

      <div className="md:col-span-2">
        <Label htmlFor="holidayDates">Feriados (datas AAAA-MM-DD, uma por linha)</Label>
        <textarea
          id="holidayDates"
          name="holidayDates"
          rows={3}
          defaultValue={config.holidayDates.join("\n")}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder={"2026-01-01\n2026-04-21"}
        />
      </div>

      <div>
        <Label htmlFor="maxWeeklyMinutes">Limite semanal (minutos)</Label>
        <Input
          id="maxWeeklyMinutes"
          name="maxWeeklyMinutes"
          type="number"
          min={1}
          defaultValue={config.laborRules.maxWeeklyMinutes}
          required
        />
        <p className="mt-1 text-xs text-slate-500">
          Padrão: 2640 min (44h por semana). Ajuste conforme a realidade da sua loja.
        </p>
      </div>

      <div>
        <Label htmlFor="minSundayOffsPerMonth">Mínimo de domingos de folga por mês</Label>
        <Input
          id="minSundayOffsPerMonth"
          name="minSundayOffsPerMonth"
          type="number"
          min={0}
          max={5}
          defaultValue={config.minSundayOffsPerMonth}
          required
        />
        <p className="mt-1 text-xs text-slate-500">
          Aplica-se a funcionários que podem trabalhar fim de semana.
        </p>
      </div>

      <div>
        <Label htmlFor="cycleLengthDays">Tamanho do ciclo (dias)</Label>
        <Input
          id="cycleLengthDays"
          name="cycleLengthDays"
          type="number"
          min={1}
          value={cycleLengthDays}
          onChange={(e) => setCycleLengthDays(Number(e.target.value) || 1)}
          required
        />
      </div>

      <div>
        <Label htmlFor="workDaysPerCycle">Dias trabalhados por ciclo</Label>
        <Input
          id="workDaysPerCycle"
          name="workDaysPerCycle"
          type="number"
          min={1}
          value={workDaysPerCycle}
          onChange={(e) => setWorkDaysPerCycle(Number(e.target.value) || 1)}
          required
        />
      </div>

      <div>
        <Label htmlFor="offDaysPerCycle">Dias de folga por ciclo</Label>
        <Input
          id="offDaysPerCycle"
          name="offDaysPerCycle"
          type="number"
          min={0}
          value={offDaysPerCycle}
          onChange={(e) => setOffDaysPerCycle(Number(e.target.value) || 0)}
          required
        />
      </div>

      <div className="md:col-span-2">
        <Label>Dias de funcionamento</Label>
        <div className="mt-2 flex flex-wrap gap-3">
          {DAY_NAMES_FULL.map((day, index) => (
            <label key={day} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="operatingDays"
                value={index}
                checked={operatingDays.includes(index)}
                onChange={() => toggleOperatingDay(index)}
                className="rounded border-slate-300"
              />
              {day}
            </label>
          ))}
        </div>
      </div>

      <div className="md:col-span-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="consecutiveOffDaysRequired"
            defaultChecked={config.consecutiveOffDaysRequired}
            className="rounded border-slate-300"
          />
          Folgas consecutivas obrigatórias
        </label>
      </div>

      <ScheduleCapacityDiagnosisPanel diagnosis={diagnosis} />

      <div className="md:col-span-2">
        <Button type="submit">Salvar configurações</Button>
      </div>
    </form>
  );
}
