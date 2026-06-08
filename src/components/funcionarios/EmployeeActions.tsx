"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { EmployeeForm } from "./EmployeeForm";
import { updateEmployeeAction, deleteEmployeeAction } from "@/actions/employee.actions";
import type { EmployeeData } from "@/domain/types";

export function EmployeeActions({ employee }: { employee: EmployeeData }) {
  const [editing, setEditing] = useState(false);

  async function handleDelete() {
    if (confirm(`Excluir ${employee.name}?`)) {
      await deleteEmployeeAction(employee.id);
    }
  }

  async function handleUpdate(formData: FormData) {
    await updateEmployeeAction(employee.id, formData);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="w-full max-w-md">
        <EmployeeForm
          employee={employee}
          action={handleUpdate}
          submitLabel="Salvar alterações"
        />
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
