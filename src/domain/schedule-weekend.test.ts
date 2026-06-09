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
  minSundayOffsPerMonth: 2,
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

const EMPLOYEES: EmployeeData[] = [
  {
    id: "emp-cristina",
    name: "Cristina",
    role: null,
    active: true,
    notes: null,
    preferredOffDays: [0, 6],
    unavailableDates: [],
    canWorkWeekend: false,
    cycleOffset: 0,
  },
  {
    id: "emp-danilo",
    name: "Danilo",
    role: null,
    active: true,
    notes: null,
    preferredOffDays: [1, 3],
    unavailableDates: [],
    canWorkWeekend: true,
    cycleOffset: 1,
  },
  {
    id: "emp-renata",
    name: "Renata",
    role: null,
    active: true,
    notes: null,
    preferredOffDays: [2, 4],
    unavailableDates: [],
    canWorkWeekend: true,
    cycleOffset: 2,
  },
];

function countShiftOnDate(
  assignments: ReturnType<typeof generateSchedule>["assignments"],
  date: string,
  shiftId: string
): number {
  return assignments.filter((a) => a.date === date && !a.isOff && a.shiftId === shiftId).length;
}

describe("escala com disponibilidade por dia da semana", () => {
  it("diagnóstico geral suficiente e fim de semana no limite exato", () => {
    const diagnosis = buildScheduleCapacityDiagnosis({
      employees: EMPLOYEES,
      workDaysPerCycle: 5,
      operatingDays: CONFIG.operatingDays,
      cycleLengthDays: 7,
      activeShifts: 2,
      minEmployeesPerShift: 1,
    });

    assert.equal(diagnosis.availableCapacity, 15);
    assert.equal(diagnosis.minimumRequired, 14);
    assert.equal(diagnosis.surplus, 1);
    assert.equal(diagnosis.isSufficient, true);
    assert.equal(diagnosis.hasDayOfWeekDeficit, false);

    const saturday = diagnosis.dayOfWeekDiagnosis.find((day) => day.dayOfWeek === 6);
    const sunday = diagnosis.dayOfWeekDiagnosis.find((day) => day.dayOfWeek === 0);

    assert.ok(saturday);
    assert.ok(sunday);
    assert.equal(saturday.eligibleEmployees, 2);
    assert.equal(sunday.eligibleEmployees, 2);
    assert.equal(saturday.requiredWorkers, 2);
    assert.equal(sunday.requiredWorkers, 2);
    assert.equal(saturday.status, "exact_limit");
    assert.equal(sunday.status, "exact_limit");
  });

  it("cobre Manhã e Tarde em todos os sábados e domingos de junho/2026", () => {
    const month = 6;
    const year = 2026;
    const { assignments, conflicts } = generateSchedule(
      CONFIG,
      EMPLOYEES,
      SHIFTS,
      month,
      year
    );

    const operatingDates = getMonthDates(year, month).filter((date) =>
      CONFIG.operatingDays.includes(getDayOfWeek(date))
    );
    const cycles = getFixedCycleWindows(operatingDates, CONFIG.cycleLengthDays);

    for (const employee of EMPLOYEES) {
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

        assert.equal(
          work,
          5,
          `${employee.name} deve trabalhar 5 dias no ciclo ${cycle[0]}..${cycle.at(-1)}`
        );
        assert.equal(
          off,
          2,
          `${employee.name} deve folgar 2 dias no ciclo ${cycle[0]}..${cycle.at(-1)}`
        );
      }
    }

    const weekendDates = operatingDates.filter((date) => {
      const day = getDayOfWeek(date);
      return day === 0 || day === 6;
    });

    for (const date of weekendDates) {
      const manha = countShiftOnDate(assignments, date, "shift-manha");
      const tarde = countShiftOnDate(assignments, date, "shift-tarde");
      const dayWorking = assignments.filter(
        (a) => a.date === date && !a.isOff && a.shiftId
      ).length;

      assert.ok(dayWorking >= 1, `Dia ${date} sem cobertura`);
      assert.equal(manha, 1, `Manhã descoberta em ${date}`);
      assert.equal(tarde, 1, `Tarde descoberta em ${date}`);
    }

    const unexpected = conflicts.filter((conflict) => !conflict.expected);
    const dayCoverageIssues = unexpected.filter(
      (conflict) =>
        conflict.type === "DAY_WITHOUT_COVERAGE" || conflict.type === "SHIFT_UNDERSTAFFED"
    );

    assert.equal(
      dayCoverageIssues.length,
      0,
      `Conflitos inesperados de cobertura: ${dayCoverageIssues.map((c) => c.message).join("; ")}`
    );
  });
});
