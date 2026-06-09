import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateSchedule } from "./schedule-generator";
import { getOperatingSundays, countSundayOffsForEmployee } from "./sunday-off-validator";
import { detectInsufficientSundayOffConflicts } from "./sunday-off-validator";
import { getDayOfWeek, getMonthDates } from "@/lib/utils";
import { DEFAULT_LABOR_RULES } from "./labor-rules/config";
import type { EmployeeData, ShiftData, StoreConfigData } from "./types";

const CONFIG: StoreConfigData = {
  id: "test-config",
  name: "Loja Teste",
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
    id: "emp-1",
    name: "Ana",
    role: null,
    active: true,
    notes: null,
    preferredOffDays: [0, 6],
    unavailableDates: [],
    canWorkWeekend: true,
    cycleOffset: 0,
  },
  {
    id: "emp-2",
    name: "Bruno",
    role: null,
    active: true,
    notes: null,
    preferredOffDays: [1, 3],
    unavailableDates: [],
    canWorkWeekend: true,
    cycleOffset: 1,
  },
  {
    id: "emp-3",
    name: "Carla",
    role: null,
    active: true,
    notes: null,
    preferredOffDays: [2, 5],
    unavailableDates: [],
    canWorkWeekend: false,
    cycleOffset: 2,
  },
  {
    id: "emp-4",
    name: "Diego",
    role: null,
    active: true,
    notes: null,
    preferredOffDays: [0, 4],
    unavailableDates: [],
    canWorkWeekend: true,
    cycleOffset: 3,
  },
  {
    id: "emp-5",
    name: "Elena",
    active: true,
    notes: null,
    preferredOffDays: [3, 6],
    unavailableDates: [],
    canWorkWeekend: true,
    cycleOffset: 4,
  },
  {
    id: "emp-6",
    name: "Felipe",
    active: true,
    notes: null,
    preferredOffDays: [1, 5],
    unavailableDates: [],
    canWorkWeekend: false,
    cycleOffset: 5,
  },
  {
    id: "emp-7",
    name: "Gabriela",
    active: true,
    notes: null,
    preferredOffDays: [2, 4],
    unavailableDates: [],
    canWorkWeekend: true,
    cycleOffset: 6,
  },
  {
    id: "emp-8",
    name: "Henrique",
    active: true,
    notes: null,
    preferredOffDays: [0, 3],
    unavailableDates: [],
    canWorkWeekend: true,
    cycleOffset: 7,
  },
];

describe("regra de domingos de folga por mês", () => {
  it("equipe pequena cumpre mínimo de domingos de folga em junho/2026", () => {
    const employees: EmployeeData[] = [0, 1, 2, 3].map((index) => ({
      id: `emp-${index}`,
      name: `Funcionário ${index + 1}`,
      role: null,
      active: true,
      notes: null,
      preferredOffDays: [],
      unavailableDates: [],
      canWorkWeekend: true,
      cycleOffset: index,
    }));

    const singleShift: ShiftData[] = [SHIFTS[0]];
    const month = 6;
    const year = 2026;
    const { assignments, conflicts } = generateSchedule(
      CONFIG,
      employees,
      singleShift,
      month,
      year
    );

    const operatingDates = getMonthDates(year, month).filter((date) =>
      CONFIG.operatingDays.includes(getDayOfWeek(date))
    );
    const sundays = getOperatingSundays(operatingDates);

    for (const employee of employees) {
      const count = countSundayOffsForEmployee(employee.id, assignments, sundays);
      assert.ok(
        count >= CONFIG.minSundayOffsPerMonth,
        `${employee.name} folgou ${count} domingo(s), mínimo ${CONFIG.minSundayOffsPerMonth}`
      );
    }

    assert.equal(
      conflicts.filter((c) => c.type === "INSUFFICIENT_SUNDAY_OFFS").length,
      0
    );
  });

  it("escala grande gera aviso quando mínimo de domingos não é atingido", () => {
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
    const sundays = getOperatingSundays(operatingDates);

    for (const employee of EMPLOYEES) {
      if (!employee.canWorkWeekend) continue;

      const count = countSundayOffsForEmployee(employee.id, assignments, sundays);
      const hasWarning = conflicts.some(
        (conflict) =>
          conflict.type === "INSUFFICIENT_SUNDAY_OFFS" &&
          conflict.employeeId === employee.id
      );

      if (count < CONFIG.minSundayOffsPerMonth) {
        assert.equal(
          hasWarning,
          true,
          `${employee.name} deveria gerar aviso com ${count} domingo(s) de folga`
        );
      } else {
        assert.equal(hasWarning, false, `${employee.name} não deveria gerar aviso`);
      }
    }
  });

  it("validador detecta quando mínimo mensal de domingos não é atingido", () => {
    const operatingDates = ["2026-06-07", "2026-06-14", "2026-06-21", "2026-06-28"];
    const assignments = operatingDates.flatMap((date) => [
      {
        employeeId: "emp-1",
        date,
        isOff: false,
        shiftId: "shift-manha",
      },
    ]);

    const conflicts = detectInsufficientSundayOffConflicts(
      [EMPLOYEES[0]],
      assignments,
      operatingDates,
      CONFIG
    );

    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0]?.type, "INSUFFICIENT_SUNDAY_OFFS");
    assert.match(conflicts[0]?.message ?? "", /Ana folgou apenas 0 domingo/);
  });

  it("não exige domingos de folga quando mínimo configurado é zero", () => {
    const config: StoreConfigData = { ...CONFIG, minSundayOffsPerMonth: 0 };
    const operatingDates = ["2026-06-07", "2026-06-14"];
    const assignments = [
      {
        employeeId: "emp-1",
        date: "2026-06-07",
        isOff: false,
        shiftId: "shift-manha",
      },
      {
        employeeId: "emp-1",
        date: "2026-06-14",
        isOff: false,
        shiftId: "shift-manha",
      },
    ];

    const conflicts = detectInsufficientSundayOffConflicts(
      [EMPLOYEES[0]],
      assignments,
      operatingDates,
      config
    );

    assert.equal(conflicts.length, 0);
  });
});
