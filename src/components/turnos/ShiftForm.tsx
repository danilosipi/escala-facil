"use client";

import { Input, Label, Button } from "@/components/ui";
import { createShiftAction } from "@/actions/shift.actions";
import type { ShiftData } from "@/domain/types";

interface Props {
  shift?: ShiftData;
  action?: (formData: FormData) => Promise<void>;
  submitLabel?: string;
}

export function ShiftForm({ shift, action, submitLabel = "Cadastrar" }: Props) {
  const formAction = action ?? createShiftAction;

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="name">Nome</Label>
        <Input id="name" name="name" defaultValue={shift?.name ?? ""} required />
      </div>

      <div>
        <Label htmlFor="startTime">Início</Label>
        <Input
          id="startTime"
          name="startTime"
          type="time"
          defaultValue={shift?.startTime ?? "07:00"}
          required
        />
      </div>

      <div>
        <Label htmlFor="endTime">Fim</Label>
        <Input
          id="endTime"
          name="endTime"
          type="time"
          defaultValue={shift?.endTime ?? "15:00"}
          required
        />
      </div>

      <div>
        <Label htmlFor="breakMinutes">Intervalo (minutos)</Label>
        <Input
          id="breakMinutes"
          name="breakMinutes"
          type="number"
          min={0}
          max={180}
          defaultValue={shift?.breakMinutes ?? 60}
          required
        />
        <p className="mt-1 text-xs text-slate-500">
          Jornadas acima de 4h exigem intervalo mínimo (15 min até 6h, 1h acima de 6h).
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={shift?.active ?? true}
          className="rounded border-slate-300"
        />
        Ativo
      </label>

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
