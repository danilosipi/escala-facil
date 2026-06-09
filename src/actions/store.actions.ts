"use server";

import { revalidatePath } from "next/cache";
import { upsertStoreConfig, getStoreConfig } from "@/services/store.service";

export async function getStoreConfigAction() {
  return getStoreConfig();
}

export async function saveStoreConfigAction(formData: FormData) {
  const operatingDays = formData.getAll("operatingDays").map((v) => Number(v));

  await upsertStoreConfig({
    name: String(formData.get("name") ?? "Minha Loja"),
    openTime: String(formData.get("openTime") ?? "07:00"),
    closeTime: String(formData.get("closeTime") ?? "22:00"),
    operatingDays,
    dailyWorkHours: Number(formData.get("dailyWorkHours") ?? 8),
    workDaysPerCycle: Number(formData.get("workDaysPerCycle") ?? 5),
    offDaysPerCycle: Number(formData.get("offDaysPerCycle") ?? 2),
    cycleLengthDays: Number(formData.get("cycleLengthDays") ?? 7),
    consecutiveOffDaysRequired: formData.get("consecutiveOffDaysRequired") === "on",
    minEmployeesPerShift: Number(formData.get("minEmployeesPerShift") ?? 1),
    minSundayOffsPerMonth: Number(formData.get("minSundayOffsPerMonth") ?? 2),
  });

  revalidatePath("/configuracoes");
  revalidatePath("/escala");
}
