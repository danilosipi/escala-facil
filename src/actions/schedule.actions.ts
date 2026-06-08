"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  generateMonthlySchedule,
  getSchedule,
  listSchedules,
  revalidateSchedule,
} from "@/services/schedule.service";

export async function getScheduleAction(month: number, year: number) {
  return getSchedule(month, year);
}

export async function listSchedulesAction() {
  return listSchedules();
}

export async function generateScheduleAction(formData: FormData) {
  const month = Number(formData.get("month"));
  const year = Number(formData.get("year"));

  await generateMonthlySchedule(month, year);

  revalidatePath("/escala");
  redirect(`/escala?month=${month}&year=${year}`);
}

export async function revalidateScheduleAction(month: number, year: number) {
  const conflicts = await revalidateSchedule(month, year);
  revalidatePath("/escala");
  return conflicts;
}
