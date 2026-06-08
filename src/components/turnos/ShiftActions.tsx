"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { ShiftForm } from "./ShiftForm";
import { updateShiftAction, deleteShiftAction } from "@/actions/shift.actions";
import type { ShiftData } from "@/domain/types";

export function ShiftActions({ shift }: { shift: ShiftData }) {
  const [editing, setEditing] = useState(false);

  async function handleDelete() {
    if (confirm(`Excluir turno ${shift.name}?`)) {
      await deleteShiftAction(shift.id);
    }
  }

  async function handleUpdate(formData: FormData) {
    await updateShiftAction(shift.id, formData);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="w-full max-w-md">
        <ShiftForm shift={shift} action={handleUpdate} submitLabel="Salvar alterações" />
        <Button variant="secondary" className="mt-2" onClick={() => setEditing(false)}>
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Button variant="secondary" onClick={() => setEditing(true)}>
        Editar
      </Button>
      <Button variant="danger" onClick={handleDelete}>
        Excluir
      </Button>
    </div>
  );
}
