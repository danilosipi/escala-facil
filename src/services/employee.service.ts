import { prisma } from "@/lib/prisma";
import { mapEmployee } from "@/lib/mappers";
import type { EmployeeData } from "@/domain/types";

export async function listEmployees(): Promise<EmployeeData[]> {
  const employees = await prisma.employee.findMany({ orderBy: { name: "asc" } });
  return employees.map(mapEmployee);
}

export async function getEmployee(id: string): Promise<EmployeeData | null> {
  const employee = await prisma.employee.findUnique({ where: { id } });
  return employee ? mapEmployee(employee) : null;
}

export async function createEmployee(data: {
  name: string;
  active?: boolean;
  notes?: string | null;
  preferredOffDays?: number[];
  unavailableDates?: string[];
  canWorkWeekend?: boolean;
  cycleOffset?: number;
}): Promise<EmployeeData> {
  const employee = await prisma.employee.create({
    data: {
      name: data.name,
      active: data.active ?? true,
      notes: data.notes ?? null,
      preferredOffDays: JSON.stringify(data.preferredOffDays ?? []),
      unavailableDates: JSON.stringify(data.unavailableDates ?? []),
      canWorkWeekend: data.canWorkWeekend ?? true,
      cycleOffset: data.cycleOffset ?? 0,
    },
  });
  return mapEmployee(employee);
}

export async function updateEmployee(
  id: string,
  data: Partial<{
    name: string;
    active: boolean;
    notes: string | null;
    preferredOffDays: number[];
    unavailableDates: string[];
    canWorkWeekend: boolean;
    cycleOffset: number;
  }>
): Promise<EmployeeData> {
  const employee = await prisma.employee.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.active !== undefined && { active: data.active }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.preferredOffDays !== undefined && {
        preferredOffDays: JSON.stringify(data.preferredOffDays),
      }),
      ...(data.unavailableDates !== undefined && {
        unavailableDates: JSON.stringify(data.unavailableDates),
      }),
      ...(data.canWorkWeekend !== undefined && { canWorkWeekend: data.canWorkWeekend }),
      ...(data.cycleOffset !== undefined && { cycleOffset: data.cycleOffset }),
    },
  });
  return mapEmployee(employee);
}

export async function deleteEmployee(id: string): Promise<void> {
  await prisma.employee.delete({ where: { id } });
}

export async function listActiveEmployees(): Promise<EmployeeData[]> {
  const employees = await prisma.employee.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
  return employees.map(mapEmployee);
}
