"use client";

import { DAY_NAMES_FULL } from "@/lib/utils";
import { Input, Label, Button } from "@/components/ui";
import { createEmployeeAction } from "@/actions/employee.actions";
import type { EmployeeData } from "@/domain/types";

interface Props {
  employee?: EmployeeData;
  action?: (formData: FormData) => Promise<void>;
  submitLabel?: string;
}

export function EmployeeForm({ employee, action, submitLabel = "Cadastrar" }: Props) {
  const formAction = action ?? createEmployeeAction;

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="name">Nome</Label>
        <Input id="name" name="name" defaultValue={employee?.name ?? ""} required />
      </div>

      <div>
        <Label htmlFor="role">Cargo / função</Label>
        <Input
          id="role"
          name="role"
          defaultValue={employee?.role ?? ""}
          placeholder="Ex.: Caixa, Estoquista, Gerente"
        />
      </div>

      <div>
        <Label htmlFor="notes">Observação</Label>
        <Input id="notes" name="notes" defaultValue={employee?.notes ?? ""} />
      </div>

      <div>
        <Label htmlFor="cycleOffset">Deslocamento do ciclo de folgas</Label>
        <Input
          id="cycleOffset"
          name="cycleOffset"
          type="number"
          min={0}
          defaultValue={employee?.cycleOffset ?? 0}
        />
      </div>

      <div>
        <Label htmlFor="unavailableDates">Dias indisponíveis (AAAA-MM-DD, separados por vírgula)</Label>
        <Input
          id="unavailableDates"
          name="unavailableDates"
          defaultValue={employee?.unavailableDates.join(", ") ?? ""}
          placeholder="2026-06-15, 2026-06-20"
        />
      </div>

      <div>
        <Label>Dias preferenciais de folga</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {DAY_NAMES_FULL.map((day, index) => (
            <label key={day} className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                name="preferredOffDays"
                value={index}
                defaultChecked={employee?.preferredOffDays.includes(index)}
                className="rounded border-slate-300"
              />
              {day.slice(0, 3)}
            </label>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={employee?.active ?? true}
          className="rounded border-slate-300"
        />
        Ativo
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="canWorkWeekend"
          defaultChecked={employee?.canWorkWeekend ?? true}
          className="rounded border-slate-300"
        />
        Pode trabalhar fim de semana
      </label>

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
