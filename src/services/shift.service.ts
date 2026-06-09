import { prisma } from "@/lib/prisma";
import { mapShift } from "@/lib/mappers";
import type { ShiftData } from "@/domain/types";

export async function listShifts(): Promise<ShiftData[]> {
  const shifts = await prisma.shift.findMany({ orderBy: { startTime: "asc" } });
  return shifts.map(mapShift);
}

export async function getShift(id: string): Promise<ShiftData | null> {
  const shift = await prisma.shift.findUnique({ where: { id } });
  return shift ? mapShift(shift) : null;
}

export async function createShift(data: {
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
  active?: boolean;
}): Promise<ShiftData> {
  const shift = await prisma.shift.create({
    data: {
      name: data.name,
      startTime: data.startTime,
      endTime: data.endTime,
      breakMinutes: data.breakMinutes ?? 60,
      active: data.active ?? true,
    },
  });
  return mapShift(shift);
}

export async function updateShift(
  id: string,
  data: Partial<{
    name: string;
    startTime: string;
    endTime: string;
    breakMinutes: number;
    active: boolean;
  }>
): Promise<ShiftData> {
  const shift = await prisma.shift.update({ where: { id }, data });
  return mapShift(shift);
}

export async function deleteShift(id: string): Promise<void> {
  await prisma.shift.delete({ where: { id } });
}

export async function listActiveShifts(): Promise<ShiftData[]> {
  const shifts = await prisma.shift.findMany({
    where: { active: true },
    orderBy: { startTime: "asc" },
  });
  return shifts.map(mapShift);
}
