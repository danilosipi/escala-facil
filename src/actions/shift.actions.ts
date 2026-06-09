"use server";

import { revalidatePath } from "next/cache";
import { createShift, updateShift, deleteShift, listShifts } from "@/services/shift.service";

export async function listShiftsAction() {
  return listShifts();
}

export async function createShiftAction(formData: FormData) {
  await createShift({
    name: String(formData.get("name")),
    startTime: String(formData.get("startTime")),
    endTime: String(formData.get("endTime")),
    breakMinutes: Number(formData.get("breakMinutes") ?? 60),
    active: formData.get("active") === "on",
  });

  revalidatePath("/turnos");
  revalidatePath("/escala");
}

export async function updateShiftAction(id: string, formData: FormData) {
  await updateShift(id, {
    name: String(formData.get("name")),
    startTime: String(formData.get("startTime")),
    endTime: String(formData.get("endTime")),
    breakMinutes: Number(formData.get("breakMinutes") ?? 60),
    active: formData.get("active") === "on",
  });

  revalidatePath("/turnos");
  revalidatePath("/escala");
}

export async function deleteShiftAction(id: string) {
  await deleteShift(id);
  revalidatePath("/turnos");
  revalidatePath("/escala");
}
