import { prisma } from "@/lib/prisma";
import { mapStoreConfig } from "@/lib/mappers";
import type { StoreConfigData } from "@/domain/types";

export async function getStoreConfig(): Promise<StoreConfigData | null> {
  const config = await prisma.storeConfig.findFirst();
  return config ? mapStoreConfig(config) : null;
}

export async function upsertStoreConfig(
  data: Omit<StoreConfigData, "id"> & { id?: string }
): Promise<StoreConfigData> {
  const existing = await prisma.storeConfig.findFirst();

  const payload = {
    name: data.name,
    openTime: data.openTime,
    closeTime: data.closeTime,
    operatingDays: JSON.stringify(data.operatingDays),
    dailyWorkHours: data.dailyWorkHours,
    workDaysPerCycle: data.workDaysPerCycle,
    offDaysPerCycle: data.offDaysPerCycle,
    cycleLengthDays: data.cycleLengthDays,
    consecutiveOffDaysRequired: data.consecutiveOffDaysRequired,
    minEmployeesPerShift: data.minEmployeesPerShift,
  };

  const config = existing
    ? await prisma.storeConfig.update({ where: { id: existing.id }, data: payload })
    : await prisma.storeConfig.create({ data: payload });

  return mapStoreConfig(config);
}

export async function ensureStoreConfig(): Promise<StoreConfigData> {
  const config = await getStoreConfig();
  if (config) return config;
  return upsertStoreConfig({
    name: "Minha Loja",
    openTime: "07:00",
    closeTime: "22:00",
    operatingDays: [0, 1, 2, 3, 4, 5, 6],
    dailyWorkHours: 8,
    workDaysPerCycle: 5,
    offDaysPerCycle: 2,
    cycleLengthDays: 7,
    consecutiveOffDaysRequired: false,
    minEmployeesPerShift: 1,
  });
}
