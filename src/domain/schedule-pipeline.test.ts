import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateSchedule } from "./schedule-generator";
import { buildScheduleCapacityDiagnosis } from "./schedule-capacity";
import { getFixedCycleWindows } from "./cycle-patterns";
import { getDayOfWeek, getMonthDates } from "@/lib/utils";
import { DEFAULT_LABOR_RULES } from "./labor-rules/config";
import type { EmployeeData, ShiftData, StoreConfigData } from "./types";

const CONFIG: StoreConfigData = {
  id: "test-config",
  name: "Loja Teste",
  openTime: "07:00",
  closeTime: "22:00",
  operatingDays: [0, 1, 2, 3, 4, 5, 6],
  dailyWorkHours: 6,
  workDaysPerCycle: 5,
  offDaysPerCycle: 2,
  cycleLengthDays: 7,
  consecutiveOffDaysRequired: false,
  minEmployeesPerShift: 1,
  minSundayOffsPerMonth: 0,
  holidayDates: [],
  laborRules: DEFAULT_LABOR_RULES,
};

const SHIFTS: ShiftData[] = [
  {
    id: "shift-manha",
    name: "Manhã",
    startTime: "07:00",
    endTime: "15:00",
    durationMinutes: 480,
    breakMinutes: 60,
    active: true,
  },
  {
    id: "shift-tarde",
    name: "Tarde",
    startTime: "14:00",
    endTime: "22:00",
    durationMinutes: 480,
    breakMinutes: 60,
    active: true,
  },
];

function buildEmployee(
  id: string,
  name: string,
  overrides: Partial<EmployeeData> = {}
): EmployeeData {
  return {
    id,
    name,
    role: null,
    active: true,
    notes: null,
    preferredOffDays: [],
    unavailableDates: [],
    canWorkWeekend: true,
    cycleOffset: 0,
    ...overrides,
  };
}

function countShiftOnDate(
  assignments: ReturnType<typeof generateSchedule>["assignments"],
  date: string,
  shiftId: string
): number {
  return assignments.filter((a) => a.date === date && !a.isOff && a.shiftId === shiftId).length;
}

function assert5x2InAllCycles(
  assignments: ReturnType<typeof generateSchedule>["assignments"],
  employees: EmployeeData[],
  operatingDates: string[],
  cycleLengthDays: number
): void {
  const cycles = getFixedCycleWindows(operatingDates, cycleLengthDays);
  for (const employee of employees) {
    for (const cycle of cycles) {
      const empAssignments = assignments.filter((a) => a.employeeId === employee.id);
      const work = cycle.filter((date) => {
        const assignment = empAssignments.find((a) => a.date === date);
        return assignment && !assignment.isOff && assignment.shiftId;
      }).length;
      const off = cycle.filter((date) => {
        const assignment = empAssignments.find((a) => a.date === date);
        return assignment?.isOff;
      }).length;

      assert.equal(work, 5, `${employee.name} deve trabalhar 5 dias no ciclo ${cycle[0]}`);
      assert.equal(off, 2, `${employee.name} deve folgar 2 dias no ciclo ${cycle[0]}`);
    }
  }
}

function isOffOnDate(
  assignments: ReturnType<typeof generateSchedule>["assignments"],
  employeeId: string,
  date: string
): boolean {
  const assignment = assignments.find(
    (item) => item.employeeId === employeeId && item.date === date
  );
  return Boolean(assignment?.isOff);
}

describe("pipeline de geração de escala", () => {
  it("cenário 1: 3 funcionários, 2 turnos, 5x2 — cobertura e preferência de segunda", () => {
    const employees: EmployeeData[] = [
      buildEmployee("emp-danilo", "Danilo", { preferredOffDays: [1], cycleOffset: 0 }),
      buildEmployee("emp-cristina", "Cristina", { preferredOffDays: [4], cycleOffset: 1 }),
      buildEmployee("emp-renata", "Renata", { cycleOffset: 2 }),
    ];

    const month = 6;
    const year = 2026;
    const { assignments, conflicts } = generateSchedule(CONFIG, employees, SHIFTS, month, year);

    const operatingDates = getMonthDates(year, month).filter((date) =>
      CONFIG.operatingDays.includes(getDayOfWeek(date))
    );

    assert5x2InAllCycles(assignments, employees, operatingDates, CONFIG.cycleLengthDays);

    for (const date of operatingDates) {
      assert.ok(
        countShiftOnDate(assignments, date, "shift-manha") >= CONFIG.minEmployeesPerShift,
        `Manhã descoberta em ${date}`
      );
      assert.ok(
        countShiftOnDate(assignments, date, "shift-tarde") >= CONFIG.minEmployeesPerShift,
        `Tarde descoberta em ${date}`
      );
    }

    const mondays = operatingDates.filter((date) => getDayOfWeek(date) === 1);
    for (const monday of mondays) {
      assert.equal(
        isOffOnDate(assignments, "emp-danilo", monday),
        true,
        `Danilo deveria folgar na segunda ${monday}`
      );
    }

    const preferenceWarnings = conflicts.filter(
      (conflict) => conflict.type === "PREFERRED_OFF_NOT_HONORED"
    );
    assert.equal(
      preferenceWarnings.filter((conflict) => conflict.employeeId === "emp-danilo").length,
      0
    );
  });

  it("cenário 2: 3 funcionários, 1 sem fim de semana — cobertura sábado/domingo", () => {
    const employees: EmployeeData[] = [
      buildEmployee("emp-cristina", "Cristina", {
        preferredOffDays: [0, 6],
        canWorkWeekend: false,
        cycleOffset: 0,
      }),
      buildEmployee("emp-danilo", "Danilo", { preferredOffDays: [1], cycleOffset: 1 }),
      buildEmployee("emp-renata", "Renata", { cycleOffset: 2 }),
    ];

    const month = 6;
    const year = 2026;
    const { assignments, conflicts } = generateSchedule(CONFIG, employees, SHIFTS, month, year);

    const operatingDates = getMonthDates(year, month).filter((date) =>
      CONFIG.operatingDays.includes(getDayOfWeek(date))
    );

    assert5x2InAllCycles(assignments, employees, operatingDates, CONFIG.cycleLengthDays);

    const weekendDates = operatingDates.filter((date) => {
      const day = getDayOfWeek(date);
      return day === 0 || day === 6;
    });

    for (const date of weekendDates) {
      assert.equal(countShiftOnDate(assignments, date, "shift-manha"), 1);
      assert.equal(countShiftOnDate(assignments, date, "shift-tarde"), 1);

      const cristinaWorks = assignments.some(
        (a) =>
          a.employeeId === "emp-cristina" &&
          a.date === date &&
          !a.isOff &&
          a.shiftId
      );
      assert.equal(
        cristinaWorks,
        false,
        `Cristina não deveria trabalhar no fim de semana (${date})`
      );
    }

    const unexpectedCoverage = conflicts.filter(
      (conflict) =>
        !conflict.expected &&
        (conflict.type === "DAY_WITHOUT_COVERAGE" || conflict.type === "SHIFT_UNDERSTAFFED")
    );
    assert.equal(unexpectedCoverage.length, 0);
  });

  it("cenário 3: 2 funcionários, 2 turnos — déficit real e cobertura parcial", () => {
    const employees: EmployeeData[] = [
      buildEmployee("emp-a", "Ana", { cycleOffset: 0 }),
      buildEmployee("emp-b", "Bruno", { cycleOffset: 1 }),
    ];

    const diagnosis = buildScheduleCapacityDiagnosis({
      employees,
      workDaysPerCycle: CONFIG.workDaysPerCycle,
      operatingDays: CONFIG.operatingDays,
      cycleLengthDays: CONFIG.cycleLengthDays,
      activeShifts: 2,
      minEmployeesPerShift: 1,
    });

    assert.equal(diagnosis.isSufficient, false);
    assert.ok(diagnosis.deficit > 0);

    const month = 6;
    const year = 2026;
    const { assignments, conflicts } = generateSchedule(CONFIG, employees, SHIFTS, month, year);

    const operatingDates = getMonthDates(year, month).filter((date) =>
      CONFIG.operatingDays.includes(getDayOfWeek(date))
    );

    const dayWithoutCoverage = conflicts.filter(
      (conflict) => conflict.type === "DAY_WITHOUT_COVERAGE"
    );
    assert.equal(dayWithoutCoverage.length, 0, "Não deve haver dia inteiro sem cobertura");

    for (const date of operatingDates) {
      const working = assignments.filter((a) => a.date === date && !a.isOff && a.shiftId).length;
      assert.ok(working >= 1, `Dia ${date} deveria ter ao menos 1 funcionário`);
    }

    const understaffed = conflicts.filter((conflict) => conflict.type === "SHIFT_UNDERSTAFFED");
    assert.ok(understaffed.length > 0, "Deveria haver turnos subdimensionados");
    assert.ok(
      understaffed.every((conflict) => conflict.expected === true),
      "Turnos subdimensionados devem ser marcados como déficit esperado"
    );
  });

  it("cenário 4: preferência de folga — troca viável ou aviso explicativo", () => {
    const swapScenario: EmployeeData[] = [
      buildEmployee("emp-danilo", "Danilo", { preferredOffDays: [1], cycleOffset: 0 }),
      buildEmployee("emp-cristina", "Cristina", { preferredOffDays: [4], cycleOffset: 1 }),
      buildEmployee("emp-renata", "Renata", { cycleOffset: 2 }),
    ];

    const month = 6;
    const year = 2026;
    const swapResult = generateSchedule(CONFIG, swapScenario, SHIFTS, month, year);

    const operatingDates = getMonthDates(year, month).filter((date) =>
      CONFIG.operatingDays.includes(getDayOfWeek(date))
    );
    const mondays = operatingDates.filter((date) => getDayOfWeek(date) === 1);

    for (const monday of mondays) {
      assert.equal(
        isOffOnDate(swapResult.assignments, "emp-danilo", monday),
        true,
        `Troca viável: Danilo deveria folgar na segunda ${monday}`
      );
    }

    assert.equal(
      swapResult.conflicts.filter((c) => c.type === "PREFERRED_OFF_NOT_HONORED").length,
      0
    );

    const impossibleScenario: EmployeeData[] = [
      buildEmployee("emp-a", "Ana", { preferredOffDays: [1], cycleOffset: 0 }),
      buildEmployee("emp-b", "Bruno", { preferredOffDays: [1], cycleOffset: 1 }),
      buildEmployee("emp-c", "Carla", { preferredOffDays: [1], cycleOffset: 2 }),
    ];

    const impossibleResult = generateSchedule(
      CONFIG,
      impossibleScenario,
      SHIFTS,
      month,
      year
    );

    const warnings = impossibleResult.conflicts.filter(
      (conflict) => conflict.type === "PREFERRED_OFF_NOT_HONORED"
    );

    assert.ok(warnings.length > 0, "Deveria haver aviso quando troca não é possível");
    assert.ok(
      warnings.some((conflict) =>
        conflict.message.includes(
          "impossibilidade de remanejamento sem violar cobertura ou 5x2"
        )
      ),
      "Aviso deve explicar impossibilidade de remanejamento"
    );
  });
});
