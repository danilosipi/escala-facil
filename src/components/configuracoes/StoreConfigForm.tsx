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
  const [cycleLengthDays, setCycleLengthDays] = useState(config.cycleLengthDays);
  const [minEmployeesPerShift, setMinEmployeesPerShift] = useState(config.minEmployeesPerShift);
  const [operatingDays, setOperatingDays] = useState<number[]>(config.operatingDays);

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
          defaultValue={config.offDaysPerCycle}
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
