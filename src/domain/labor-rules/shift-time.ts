import { addDaysISO, getDayOfWeek, timeToMinutes } from "@/lib/utils";
import type { LaborRulesConfig } from "./types";
import type { DayType } from "./types";

export interface ShiftLike {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  breakMinutes: number;
}

export function getNetWorkMinutes(shift: ShiftLike): number {
  return Math.max(0, shift.durationMinutes - shift.breakMinutes);
}

export function getRequiredBreakMinutes(
  grossMinutes: number,
  rules: LaborRulesConfig
): number {
  if (grossMinutes <= 4 * 60) return 0;
  if (grossMinutes <= 6 * 60) return rules.minBreakForShiftOver4hMinutes;
  return rules.minBreakForShiftOver6hMinutes;
}

export function getShiftStartTimestamp(date: string, shift: ShiftLike): number {
  const [year, month, day] = date.split("-").map(Number);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  start.setMinutes(start.getMinutes() + timeToMinutes(shift.startTime));
  return start.getTime();
}

export function getShiftEndTimestamp(date: string, shift: ShiftLike): number {
  const startMins = timeToMinutes(shift.startTime);
  const endMins = timeToMinutes(shift.endTime);
  const endDate = endMins <= startMins ? addDaysISO(date, 1) : date;
  const [year, month, day] = endDate.split("-").map(Number);
  const end = new Date(year, month - 1, day, 0, 0, 0, 0);
  end.setMinutes(end.getMinutes() + endMins);
  return end.getTime();
}

export function getDayType(date: string, holidayDates: string[]): DayType {
  if (holidayDates.includes(date)) return "holiday";
  if (getDayOfWeek(date) === 0) return "sunday";
  return "normal";
}

/** Domingo que inicia a semana civil (domingo a sábado). */
export function getWeekStartSunday(date: string): string {
  const dayOfWeek = getDayOfWeek(date);
  return addDaysISO(date, -dayOfWeek);
}

export function formatMinutesAsHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h${String(mins).padStart(2, "0")}`;
}
