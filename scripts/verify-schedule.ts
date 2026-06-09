import "dotenv/config";
import { createPrismaClient } from "../src/lib/prisma";
import { mapEmployee, mapShift, mapStoreConfig } from "../src/lib/mappers";
import { generateSchedule } from "../src/domain/schedule-generator";
import { validateSchedule, countCycleWorkJourneys } from "../src/domain/schedule-validator";
import { getFixedCycleWindows } from "../src/domain/cycle-patterns";
import { getDayOfWeek, getMonthDates } from "../src/lib/utils";
import type { EmployeeData, ShiftData, StoreConfigData } from "../src/domain/types";

const SEED_EMPLOYEES: Omit<EmployeeData, "id" | "active" | "notes">[] = [
  { name: "Ana Silva", cycleOffset: 0, preferredOffDays: [0, 6], unavailableDates: [], canWorkWeekend: true },
  { name: "Bruno Costa", cycleOffset: 1, preferredOffDays: [1, 3], unavailableDates: [], canWorkWeekend: true },
  { name: "Carla Mendes", cycleOffset: 2, preferredOffDays: [2, 5], unavailableDates: [], canWorkWeekend: false },
  { name: "Diego Alves", cycleOffset: 3, preferredOffDays: [0, 4], unavailableDates: [], canWorkWeekend: true },
  { name: "Elena Rocha", cycleOffset: 4, preferredOffDays: [3, 6], unavailableDates: [], canWorkWeekend: true },
  { name: "Felipe Nunes", cycleOffset: 5, preferredOffDays: [1, 5], unavailableDates: [], canWorkWeekend: false },
  { name: "Gabriela Lima", cycleOffset: 6, preferredOffDays: [2, 4], unavailableDates: [], canWorkWeekend: true },
  { name: "Henrique Souza", cycleOffset: 7, preferredOffDays: [0, 3], unavailableDates: [], canWorkWeekend: true },
];

const PROBLEM_DATES = [
  "2026-06-05",
  "2026-06-06",
  "2026-06-07",
  "2026-06-12",
  "2026-06-13",
  "2026-06-14",
  "2026-06-19",
  "2026-06-20",
  "2026-06-21",
  "2026-06-26",
  "2026-06-27",
  "2026-06-28",
];

function buildMockEmployees(): EmployeeData[] {
  return SEED_EMPLOYEES.map((emp, index) => ({
    ...emp,
    id: `mock-emp-${index}`,
    active: true,
    notes: null,
  }));
}

function buildMockShifts(): ShiftData[] {
  return [
    {
      id: "mock-shift-manha",
      name: "Manhã",
      startTime: "07:00",
      endTime: "15:00",
      durationMinutes: 480,
      active: true,
    },
    {
      id: "mock-shift-tarde",
      name: "Tarde",
      startTime: "14:00",
      endTime: "22:00",
      durationMinutes: 480,
      active: true,
    },
  ];
}

function buildMockConfig(): StoreConfigData {
  return {
    id: "mock-config",
    name: "Loja Central",
    openTime: "07:00",
    closeTime: "22:00",
    operatingDays: [0, 1, 2, 3, 4, 5, 6],
    dailyWorkHours: 8,
    workDaysPerCycle: 5,
    offDaysPerCycle: 2,
    cycleLengthDays: 7,
    consecutiveOffDaysRequired: false,
    minEmployeesPerShift: 1,
    minSundayOffsPerMonth: 2,
  };
}

async function main() {
  const month = 6;
  const year = 2026;

  const prisma = createPrismaClient();
  const configRow = await prisma.storeConfig.findFirst();
  const dbEmployees = await prisma.employee.findMany({ where: { active: true } });
  const dbShifts = await prisma.shift.findMany({ where: { active: true } });

  const useMock = dbEmployees.length < 8;
  const config = configRow ? mapStoreConfig(configRow) : buildMockConfig();
  const employeeData = useMock ? buildMockEmployees() : dbEmployees.map(mapEmployee);
  const shiftData = dbShifts.length > 0 ? dbShifts.map(mapShift) : buildMockShifts();

  if (useMock) {
    console.log("Usando 8 funcionários mock (seed) para verificação.");
  }

  const { assignments, conflicts } = generateSchedule(
    config,
    employeeData,
    shiftData,
    month,
    year
  );

  const operatingDates = getMonthDates(year, month).filter((d) =>
    config.operatingDays.includes(getDayOfWeek(d))
  );
  const cycles = getFixedCycleWindows(operatingDates, config.cycleLengthDays);

  console.log("=== Verificação escala 06/2026 ===");
  console.log(`Funcionários ativos: ${employeeData.length}`);
  console.log(`Ciclos completos: ${cycles.length}`);
  console.log(
    `Jornadas por ciclo (esperado ${employeeData.length * config.workDaysPerCycle}):`
  );

  for (const cycle of cycles) {
    const cycleWork = assignments.filter(
      (a) => cycle.includes(a.date) && !a.isOff && a.shiftId
    ).length;
    console.log(`  ${cycle[0]} a ${cycle[cycle.length - 1]}: ${cycleWork} jornadas`);
  }

  console.log(
    `Total jornadas em ciclos completos: ${countCycleWorkJourneys(assignments, operatingDates, config.cycleLengthDays)}`
  );

  let cycleErrors = 0;
  for (const employee of employeeData) {
    for (const cycle of cycles) {
      const empAssignments = assignments.filter((a) => a.employeeId === employee.id);
      const work = cycle.filter((date) => {
        const a = empAssignments.find((x) => x.date === date);
        return a && !a.isOff && a.shiftId;
      }).length;
      const off = cycle.filter((date) => {
        const a = empAssignments.find((x) => x.date === date);
        return a?.isOff;
      }).length;

      if (work !== config.workDaysPerCycle || off !== config.offDaysPerCycle) {
        cycleErrors++;
        console.log(
          `  ERRO ${employee.name} [${cycle[0]}..${cycle[cycle.length - 1]}]: ${work} trabalho, ${off} folga`
        );
      }
    }
  }

  const coverageConflicts = conflicts.filter(
    (c) =>
      !c.expected &&
      (c.type === "DAY_WITHOUT_COVERAGE" || c.type === "SHIFT_UNDERSTAFFED")
  );
  const cycleConflicts = conflicts.filter(
    (c) =>
      c.type.startsWith("EMPLOYEE_") &&
      (c.type.includes("WORK") || c.type.includes("OFF"))
  );

  console.log(`\nErros 5x2 por funcionário/ciclo: ${cycleErrors}`);
  console.log(`Conflitos 5x2 consolidados: ${cycleConflicts.length}`);
  console.log(`Conflitos de cobertura: ${coverageConflicts.length}`);
  console.log(`Total conflitos: ${conflicts.length}`);

  console.log("\nFuncionários por turno nos dias problemáticos:");
  for (const date of PROBLEM_DATES) {
    const byShift = shiftData.map((shift) => ({
      shift: shift.name,
      count: assignments.filter(
        (a) => a.date === date && !a.isOff && a.shiftId === shift.id
      ).length,
    }));
    const total = byShift.reduce((sum, item) => sum + item.count, 0);
    const summary = byShift.map((item) => `${item.shift}=${item.count}`).join(", ");
    console.log(`  ${date}: total=${total} (${summary})`);
  }

  if (coverageConflicts.length > 0) {
    console.log("\nConflitos de cobertura:");
    coverageConflicts.forEach((c) => console.log(`  - [${c.type}] ${c.message}`));
  }

  if (cycleConflicts.length > 0) {
    console.log("\nConflitos 5x2:");
    cycleConflicts.forEach((c) => console.log(`  - ${c.message}`));
  }

  const otherConflicts = conflicts.filter(
    (c) => !coverageConflicts.includes(c) && !cycleConflicts.includes(c)
  );
  if (otherConflicts.length > 0) {
    console.log("\nOutros conflitos:");
    otherConflicts.forEach((c) => console.log(`  - [${c.type}] ${c.message}`));
  }

  await prisma.$disconnect();

  if (cycleErrors > 0 || coverageConflicts.length > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
