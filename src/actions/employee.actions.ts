"use server";

import { revalidatePath } from "next/cache";
import {
  createEmployee,
  updateEmployee,
  deleteEmployee,
  listEmployees,
} from "@/services/employee.service";

export async function listEmployeesAction() {
  return listEmployees();
}

export async function createEmployeeAction(formData: FormData) {
  const preferredOffDays = formData.getAll("preferredOffDays").map((v) => Number(v));
  const unavailableDatesRaw = String(formData.get("unavailableDates") ?? "");
  const unavailableDates = unavailableDatesRaw
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);

  await createEmployee({
    name: String(formData.get("name")),
    role: String(formData.get("role") ?? "") || null,
    active: formData.get("active") === "on",
    notes: String(formData.get("notes") ?? "") || null,
    preferredOffDays,
    unavailableDates,
    canWorkWeekend: formData.get("canWorkWeekend") === "on",
    cycleOffset: Number(formData.get("cycleOffset") ?? 0),
  });

  revalidatePath("/funcionarios");
  revalidatePath("/escala");
}

export async function updateEmployeeAction(id: string, formData: FormData) {
  const preferredOffDays = formData.getAll("preferredOffDays").map((v) => Number(v));
  const unavailableDatesRaw = String(formData.get("unavailableDates") ?? "");
  const unavailableDates = unavailableDatesRaw
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);

  await updateEmployee(id, {
    name: String(formData.get("name")),
    role: String(formData.get("role") ?? "") || null,
    active: formData.get("active") === "on",
    notes: String(formData.get("notes") ?? "") || null,
    preferredOffDays,
    unavailableDates,
    canWorkWeekend: formData.get("canWorkWeekend") === "on",
    cycleOffset: Number(formData.get("cycleOffset") ?? 0),
  });

  revalidatePath("/funcionarios");
  revalidatePath("/escala");
}

export async function deleteEmployeeAction(id: string) {
  await deleteEmployee(id);
  revalidatePath("/funcionarios");
  revalidatePath("/escala");
}
