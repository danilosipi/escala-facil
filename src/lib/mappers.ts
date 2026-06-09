import type { Employee, Shift, StoreConfig } from "@/generated/prisma/client";
import type { EmployeeData, ShiftData, StoreConfigData } from "@/domain/types";
import { mergeLaborRulesConfig } from "@/domain/labor-rules/config";
import type { LaborRulesConfig } from "@/domain/labor-rules/types";
import { calculateDurationMinutes, parseJsonArray } from "@/lib/utils";

function parseLaborRulesConfig(value: string): LaborRulesConfig {
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return mergeLaborRulesConfig(parsed as Partial<LaborRulesConfig>);
    }
  } catch {
    // usa padrões
  }
  return mergeLaborRulesConfig();
}

export function mapStoreConfig(config: StoreConfig): StoreConfigData {
  return {
    id: config.id,
    name: config.name,
    openTime: config.openTime,
    closeTime: config.closeTime,
    operatingDays: parseJsonArray<number>(config.operatingDays, [0, 1, 2, 3, 4, 5, 6]),
    dailyWorkHours: config.dailyWorkHours,
    workDaysPerCycle: config.workDaysPerCycle,
    offDaysPerCycle: config.offDaysPerCycle,
    cycleLengthDays: config.cycleLengthDays,
    consecutiveOffDaysRequired: config.consecutiveOffDaysRequired,
    minEmployeesPerShift: config.minEmployeesPerShift,
    minSundayOffsPerMonth: config.minSundayOffsPerMonth ?? 2,
    holidayDates: parseJsonArray<string>(config.holidayDates ?? "[]"),
    laborRules: parseLaborRulesConfig(config.laborRulesConfig ?? "{}"),
  };
}

export function mapEmployee(employee: Employee): EmployeeData {
  return {
    id: employee.id,
    name: employee.name,
    role: employee.role ?? null,
    active: employee.active,
    notes: employee.notes,
    preferredOffDays: parseJsonArray<number>(employee.preferredOffDays),
    unavailableDates: parseJsonArray<string>(employee.unavailableDates),
    canWorkWeekend: employee.canWorkWeekend,
    cycleOffset: employee.cycleOffset,
  };
}

export function mapShift(shift: Shift): ShiftData {
  return {
    id: shift.id,
    name: shift.name,
    startTime: shift.startTime,
    endTime: shift.endTime,
    durationMinutes: calculateDurationMinutes(shift.startTime, shift.endTime),
    breakMinutes: shift.breakMinutes ?? 60,
    active: shift.active,
  };
}
