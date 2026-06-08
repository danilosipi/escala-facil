import { prisma } from "@/lib/prisma";
import { generateSchedule } from "@/domain/schedule-generator";
import { validateSchedule } from "@/domain/schedule-validator";
import {
  buildScheduleCapacityFromConfig,
  markExpectedCapacityConflicts,
} from "@/domain/schedule-capacity";
import { detectUnmetPreferredOffConflicts } from "@/domain/preferred-off-validator";
import type { ScheduleConflict, ScheduleAssignmentData } from "@/domain/types";
import { ensureStoreConfig } from "./store.service";
import { listActiveEmployees } from "./employee.service";
import { listActiveShifts } from "./shift.service";
import { getDayOfWeek, getMonthDates, parseJsonArray } from "@/lib/utils";

export interface ScheduleView {
  id: string;
  month: number;
  year: number;
  generatedAt: Date;
  conflicts: ScheduleConflict[];
  assignments: Array<
    ScheduleAssignmentData & {
      id: string;
      employeeName: string;
      shiftName: string | null;
    }
  >;
}

export async function getSchedule(month: number, year: number): Promise<ScheduleView | null> {
  const schedule = await prisma.schedule.findUnique({
    where: { month_year: { month, year } },
    include: {
      assignments: {
        include: { employee: true, shift: true },
      },
    },
  });

  if (!schedule) return null;

  return {
    id: schedule.id,
    month: schedule.month,
    year: schedule.year,
    generatedAt: schedule.generatedAt,
    conflicts: parseJsonArray<ScheduleConflict>(schedule.conflicts),
    assignments: schedule.assignments.map((a) => ({
      id: a.id,
      employeeId: a.employeeId,
      shiftId: a.shiftId,
      date: a.date,
      isOff: a.isOff,
      employeeName: a.employee.name,
      shiftName: a.shift?.name ?? null,
    })),
  };
}

export async function generateMonthlySchedule(
  month: number,
  year: number
): Promise<ScheduleView> {
  const config = await ensureStoreConfig();
  const employees = await listActiveEmployees();
  const shifts = await listActiveShifts();

  const { assignments, conflicts } = generateSchedule(config, employees, shifts, month, year);

  const existing = await prisma.schedule.findUnique({
    where: { month_year: { month, year } },
  });

  if (existing) {
    await prisma.scheduleAssignment.deleteMany({ where: { scheduleId: existing.id } });
    await prisma.schedule.update({
      where: { id: existing.id },
      data: {
        generatedAt: new Date(),
        conflicts: JSON.stringify(conflicts),
        assignments: {
          create: assignments.map((a) => ({
            employeeId: a.employeeId,
            shiftId: a.shiftId,
            date: a.date,
            isOff: a.isOff,
          })),
        },
      },
    });
  } else {
    await prisma.schedule.create({
      data: {
        month,
        year,
        conflicts: JSON.stringify(conflicts),
        assignments: {
          create: assignments.map((a) => ({
            employeeId: a.employeeId,
            shiftId: a.shiftId,
            date: a.date,
            isOff: a.isOff,
          })),
        },
      },
    });
  }

  const result = await getSchedule(month, year);
  if (!result) throw new Error("Falha ao gerar escala");
  return result;
}

export async function revalidateSchedule(month: number, year: number): Promise<ScheduleConflict[]> {
  const schedule = await getSchedule(month, year);
  if (!schedule) return [];

  const config = await ensureStoreConfig();
  const employees = await listActiveEmployees();
  const shifts = await listActiveShifts();

  const conflicts = validateSchedule({
    config,
    employees,
    shifts,
    assignments: schedule.assignments,
    month,
    year,
  });

  const operatingDates = getMonthDates(year, month).filter((date) =>
    config.operatingDays.includes(getDayOfWeek(date))
  );

  conflicts.push(
    ...detectUnmetPreferredOffConflicts(
      employees,
      schedule.assignments,
      operatingDates,
      config,
      shifts.length
    )
  );

  const capacity = buildScheduleCapacityFromConfig(config, employees, shifts.length);
  markExpectedCapacityConflicts(conflicts, capacity);

  await prisma.schedule.update({
    where: { month_year: { month, year } },
    data: { conflicts: JSON.stringify(conflicts) },
  });

  return conflicts;
}

export async function listSchedules(): Promise<Array<{ month: number; year: number; id: string }>> {
  const schedules = await prisma.schedule.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }],
    select: { id: true, month: true, year: true },
  });
  return schedules;
}
