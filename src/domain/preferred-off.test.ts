import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateSchedule } from "./schedule-generator";
import { getFixedCycleWindows } from "./cycle-patterns";
import { getDayOfWeek, getMonthDates } from "@/lib/utils";
import { optimizePreferredOffPlans } from "./preferred-off-optimizer";
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
};

const SHIFTS: ShiftData[] = [
  {
    id: "shift-manha",
    name: "Manhã",
    startTime: "07:00",
    endTime: "15:00",
    durationMinutes: 480,
    active: true,
  },
  {
    id: "shift-tarde",
    name: "Tarde",
    startTime: "14:00",
    endTime: "22:00",
    durationMinutes: 480,
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
    active: true,
    notes: null,
    preferredOffDays: [],
    unavailableDates: [],
    canWorkWeekend: true,
    cycleOffset: 0,
    ...overrides,
  };
}

function getMondays(year: number, month: number): string[] {
  return getMonthDates(year, month).filter((date) => getDayOfWeek(date) === 1);
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

describe("preferências de folga", () => {
  it("prioriza segunda-feira como folga quando há capacidade suficiente", () => {
    const employees: EmployeeData[] = [
      buildEmployee("emp-cristina", "Cristina", {
        preferredOffDays: [0, 6],
        canWorkWeekend: false,
        cycleOffset: 0,
      }),
      buildEmployee("emp-danilo", "Danilo Pinto", {
        preferredOffDays: [1],
        cycleOffset: 1,
      }),
      buildEmployee("emp-renata", "Renata", {
        preferredOffDays: [2, 4],
        cycleOffset: 2,
      }),
      buildEmployee("emp-paulo", "Paulo", {
        preferredOffDays: [3, 5],
        cycleOffset: 3,
      }),
    ];

    const month = 6;
    const year = 2026;
    const { assignments, conflicts } = generateSchedule(
      CONFIG,
      employees,
      SHIFTS,
      month,
      year
    );

    const mondays = getMondays(year, month);
    const preferenceWarnings = conflicts.filter(
      (conflict) => conflict.type === "PREFERRED_OFF_NOT_HONORED"
    );

    for (const monday of mondays) {
      assert.equal(
        isOffOnDate(assignments, "emp-danilo", monday),
        true,
        `Danilo deveria folgar na segunda ${monday}`
      );
    }

    assert.equal(
      preferenceWarnings.filter((conflict) => conflict.employeeId === "emp-danilo").length,
      0
    );
  });

  it("gera aviso quando a preferência de folga na segunda não puder ser atendida", () => {
    const employees: EmployeeData[] = [
      buildEmployee("emp-a", "Ana", { preferredOffDays: [1], cycleOffset: 0 }),
      buildEmployee("emp-b", "Bruno", { preferredOffDays: [1], cycleOffset: 1 }),
      buildEmployee("emp-c", "Carla", { preferredOffDays: [1], cycleOffset: 2 }),
    ];

    const tightConfig: StoreConfigData = {
      ...CONFIG,
      minEmployeesPerShift: 1,
    };

    const month = 6;
    const year = 2026;
    const { conflicts } = generateSchedule(tightConfig, employees, SHIFTS, month, year);

    const warnings = conflicts.filter(
      (conflict) => conflict.type === "PREFERRED_OFF_NOT_HONORED"
    );

    assert.ok(warnings.length > 0, "Deveria haver aviso de preferência não atendida");
    assert.ok(
      warnings.some((conflict) =>
        conflict.message.includes(
          "impossibilidade de remanejamento sem violar cobertura ou 5x2"
        )
      ),
      "Aviso deve indicar impossibilidade de remanejamento"
    );
  });

  it("remaneja preferência de folga quando outro funcionário de folga pode cobrir", () => {
    const employees: EmployeeData[] = [
      buildEmployee("emp-danilo", "Danilo Pinto", {
        preferredOffDays: [1],
        cycleOffset: 0,
      }),
      buildEmployee("emp-cristina", "Cristina", {
        preferredOffDays: [4],
        cycleOffset: 1,
      }),
      buildEmployee("emp-renata", "Renata", {
        preferredOffDays: [6],
        cycleOffset: 2,
      }),
    ];

    const operatingDates = getMonthDates(2026, 6).filter((date) =>
      CONFIG.operatingDays.includes(getDayOfWeek(date))
    );
    const cycleDates = getFixedCycleWindows(operatingDates, CONFIG.cycleLengthDays)[0];
    const monday = cycleDates.find((date) => getDayOfWeek(date) === 1)!;

    const plans = new Map<string, Map<string, boolean>>();
    for (const employee of employees) {
      plans.set(employee.id, new Map());
    }

    const workDaysByEmployee: Record<string, string[]> = {
      "emp-danilo": cycleDates.filter(
        (date) => {
          const day = getDayOfWeek(date);
          return day !== 0 && day !== 2;
        }
      ),
      "emp-cristina": cycleDates.filter(
        (date) => {
          const day = getDayOfWeek(date);
          return day !== 1 && day !== 4;
        }
      ),
      "emp-renata": cycleDates.filter(
        (date) => {
          const day = getDayOfWeek(date);
          return day !== 3 && day !== 6;
        }
      ),
    };

    for (const employee of employees) {
      const plan = plans.get(employee.id)!;
      for (const date of cycleDates) {
        plan.set(date, workDaysByEmployee[employee.id].includes(date));
      }
    }

    assert.equal(
      plans.get("emp-danilo")!.get(monday),
      true,
      "Pré-condição: Danilo escalado na segunda"
    );
    assert.equal(
      plans.get("emp-cristina")!.get(monday),
      false,
      "Pré-condição: Cristina de folga na segunda"
    );

    const changedDates = optimizePreferredOffPlans(
      plans,
      employees,
      operatingDates,
      CONFIG,
      SHIFTS.length,
      false
    );

    assert.ok(changedDates.has(monday), "Remanejamento deve alterar a segunda-feira");
    assert.equal(
      plans.get("emp-danilo")!.get(monday),
      false,
      "Danilo deve folgar na segunda após remanejamento"
    );
    assert.equal(
      plans.get("emp-cristina")!.get(monday),
      true,
      "Cristina deve cobrir a segunda após remanejamento"
    );

    for (const employee of employees) {
      const work = cycleDates.filter((date) => plans.get(employee.id)!.get(date) === true)
        .length;
      const off = cycleDates.filter((date) => plans.get(employee.id)!.get(date) === false)
        .length;
      assert.equal(work, 5, `${employee.name} deve manter 5 dias trabalhados`);
      assert.equal(off, 2, `${employee.name} deve manter 2 folgas`);
    }
  });

  it("mantém 5x2 ao honrar folga preferencial na segunda", () => {
    const employees: EmployeeData[] = [
      buildEmployee("emp-cristina", "Cristina", {
        preferredOffDays: [0, 6],
        canWorkWeekend: false,
        cycleOffset: 0,
      }),
      buildEmployee("emp-danilo", "Danilo Pinto", {
        preferredOffDays: [1],
        cycleOffset: 1,
      }),
      buildEmployee("emp-renata", "Renata", {
        preferredOffDays: [2],
        cycleOffset: 2,
      }),
      buildEmployee("emp-paulo", "Paulo", {
        cycleOffset: 3,
      }),
    ];

    const month = 6;
    const year = 2026;
    const { assignments } = generateSchedule(CONFIG, employees, SHIFTS, month, year);

    const operatingDates = getMonthDates(year, month).filter((date) =>
      CONFIG.operatingDays.includes(getDayOfWeek(date))
    );
    const cycles = getFixedCycleWindows(operatingDates, CONFIG.cycleLengthDays);

    for (const employee of employees) {
      for (const cycle of cycles) {
        const work = cycle.filter((date) => {
          const assignment = assignments.find(
            (item) => item.employeeId === employee.id && item.date === date
          );
          return assignment && !assignment.isOff && assignment.shiftId;
        }).length;
        const off = cycle.filter((date) => {
          const assignment = assignments.find(
            (item) => item.employeeId === employee.id && item.date === date
          );
          return assignment?.isOff;
        }).length;

        assert.equal(work, 5, `${employee.name} deve trabalhar 5 dias no ciclo`);
        assert.equal(off, 2, `${employee.name} deve folgar 2 dias no ciclo`);
      }
    }
  });
});
