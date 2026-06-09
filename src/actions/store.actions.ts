"use server";

import { revalidatePath } from "next/cache";
import { mergeLaborRulesConfig } from "@/domain/labor-rules/config";
import { upsertStoreConfig, getStoreConfig } from "@/services/store.service";

export async function getStoreConfigAction() {
  return getStoreConfig();
}

export async function saveStoreConfigAction(formData: FormData) {
  const operatingDays = formData.getAll("operatingDays").map((v) => Number(v));

  const holidayDatesRaw = String(formData.get("holidayDates") ?? "");
  const holidayDates = holidayDatesRaw
    .split(/[\n,;]+/)
    .map((value) => value.trim())
    .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value));

  const existing = await getStoreConfig();

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
    holidayDates,
    laborRules: mergeLaborRulesConfig({
      ...(existing?.laborRules ?? {}),
      maxWeeklyMinutes: Number(formData.get("maxWeeklyMinutes") ?? 2640),
    }),
  });

  revalidatePath("/configuracoes");
  revalidatePath("/escala");
}
