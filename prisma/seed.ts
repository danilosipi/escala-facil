import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

const EMPLOYEES = [
  { name: "Ana Silva", cycleOffset: 0, preferredOffDays: [0, 6], canWorkWeekend: true },
  { name: "Bruno Costa", cycleOffset: 1, preferredOffDays: [1, 3], canWorkWeekend: true },
  { name: "Carla Mendes", cycleOffset: 2, preferredOffDays: [2, 5], canWorkWeekend: false },
  { name: "Diego Alves", cycleOffset: 3, preferredOffDays: [0, 4], canWorkWeekend: true },
  { name: "Elena Rocha", cycleOffset: 4, preferredOffDays: [3, 6], canWorkWeekend: true },
  { name: "Felipe Nunes", cycleOffset: 5, preferredOffDays: [1, 5], canWorkWeekend: false },
  { name: "Gabriela Lima", cycleOffset: 6, preferredOffDays: [2, 4], canWorkWeekend: true },
  { name: "Henrique Souza", cycleOffset: 7, preferredOffDays: [0, 3], canWorkWeekend: true },
];

async function main() {
  const existing = await prisma.storeConfig.findFirst();
  if (existing) {
    console.log("Seed já aplicado, pulando.");
    return;
  }

  await prisma.storeConfig.create({
    data: {
      name: "Loja Central",
      openTime: "07:00",
      closeTime: "22:00",
      operatingDays: JSON.stringify([0, 1, 2, 3, 4, 5, 6]),
      dailyWorkHours: 8,
      workDaysPerCycle: 5,
      offDaysPerCycle: 2,
      cycleLengthDays: 7,
      consecutiveOffDaysRequired: false,
      minEmployeesPerShift: 1,
      minSundayOffsPerMonth: 2,
    },
  });

  await prisma.shift.createMany({
    data: [
      { name: "Manhã", startTime: "07:00", endTime: "15:00", breakMinutes: 60, active: true },
      { name: "Tarde", startTime: "14:00", endTime: "22:00", breakMinutes: 60, active: true },
    ],
  });

  for (const emp of EMPLOYEES) {
    await prisma.employee.create({
      data: {
        name: emp.name,
        active: true,
        notes: null,
        preferredOffDays: JSON.stringify(emp.preferredOffDays),
        unavailableDates: JSON.stringify([]),
        canWorkWeekend: emp.canWorkWeekend,
        cycleOffset: emp.cycleOffset,
      },
    });
  }

  console.log("Seed concluído: 1 loja, 8 funcionários, 2 turnos.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
