import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_LABOR_RULES } from "./config";
import { validateLaborRules } from "./labor-rules-validator";
import type { LaborValidationInput } from "./types";

const EMPLOYEE = { id: "emp-1", name: "Ana" };

function shift(
  id: string,
  startTime: string,
  endTime: string,
  breakMinutes: number
): LaborValidationInput["shifts"][number] {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  let durationMinutes = eh * 60 + em - (sh * 60 + sm);
  if (durationMinutes <= 0) durationMinutes += 24 * 60;

  return {
    id,
    name: id,
    startTime,
    endTime,
    durationMinutes,
    breakMinutes,
  };
}

function buildInput(
  overrides: Partial<LaborValidationInput> & {
    assignments: LaborValidationInput["assignments"];
  }
): LaborValidationInput {
  return {
    config: {
      workDaysPerCycle: 5,
      offDaysPerCycle: 2,
      cycleLengthDays: 7,
      holidayDates: [],
      ...overrides.config,
    },
    laborRules: { ...DEFAULT_LABOR_RULES, ...overrides.laborRules },
    scheduleType: overrides.scheduleType ?? "5x2",
    employees: overrides.employees ?? [EMPLOYEE],
    shifts: overrides.shifts ?? [shift("s1", "08:00", "16:00", 60)],
    assignments: overrides.assignments,
    month: overrides.month ?? 6,
    year: overrides.year ?? 2026,
  };
}

function hasCode(
  issues: ReturnType<typeof validateLaborRules>,
  code: LaborValidationInput extends never ? never : string
) {
  return issues.some((issue) => issue.code === code);
}

describe("validateLaborRules", () => {
  it("aceita jornada diária dentro do limite de 8h", () => {
    const issues = validateLaborRules(
      buildInput({
        assignments: [
          { employeeId: "emp-1", shiftId: "s1", date: "2026-06-02", isOff: false },
        ],
        shifts: [shift("s1", "08:00", "16:00", 60)],
      })
    );

    assert.equal(hasCode(issues, "DAILY_HOURS_EXCEEDED"), false);
    assert.equal(hasCode(issues, "DAILY_HOURS_OVERTIME_POSSIBLE"), false);
  });

  it("alerta jornada diária acima de 8h", () => {
    const issues = validateLaborRules(
      buildInput({
        assignments: [
          { employeeId: "emp-1", shiftId: "s1", date: "2026-06-02", isOff: false },
        ],
        shifts: [shift("s1", "08:00", "16:30", 0)],
      })
    );

    const overtime = issues.find((issue) => issue.code === "DAILY_HOURS_OVERTIME_POSSIBLE");
    assert.ok(overtime);
    assert.equal(overtime?.severity, "warning");
  });

  it("erro em jornada acima de 10h líquidas", () => {
    const issues = validateLaborRules(
      buildInput({
        assignments: [
          { employeeId: "emp-1", shiftId: "s1", date: "2026-06-02", isOff: false },
        ],
        shifts: [shift("s1", "07:00", "18:00", 0)],
      })
    );

    const exceeded = issues.find((issue) => issue.code === "DAILY_HOURS_EXCEEDED");
    assert.ok(exceeded);
    assert.equal(exceeded?.severity, "error");
  });

  it("alerta semana acima de 44h", () => {
    const assignments = ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05", "2026-06-06"].map(
      (date) => ({
        employeeId: "emp-1",
        shiftId: "s1",
        date,
        isOff: false,
      })
    );

    const issues = validateLaborRules(
      buildInput({
        assignments,
        shifts: [shift("s1", "08:00", "16:00", 0)],
      })
    );

    const weekly = issues.find((issue) => issue.code === "WEEKLY_HOURS_EXCEEDED");
    assert.ok(weekly);
    assert.equal(weekly?.severity, "warning");
  });

  it("erro quando intervalo ausente em jornada acima de 6h", () => {
    const issues = validateLaborRules(
      buildInput({
        assignments: [
          { employeeId: "emp-1", shiftId: "s1", date: "2026-06-02", isOff: false },
        ],
        shifts: [shift("s1", "08:00", "17:00", 0)],
      })
    );

    const breakIssue = issues.find((issue) => issue.code === "BREAK_INSUFFICIENT");
    assert.ok(breakIssue);
    assert.equal(breakIssue?.expectedValue, 60);
  });

  it("exige intervalo de 15min em jornada entre 4h e 6h", () => {
    const issues = validateLaborRules(
      buildInput({
        assignments: [
          { employeeId: "emp-1", shiftId: "s1", date: "2026-06-02", isOff: false },
        ],
        shifts: [shift("s1", "08:00", "13:00", 0)],
      })
    );

    const breakIssue = issues.find((issue) => issue.code === "BREAK_INSUFFICIENT");
    assert.ok(breakIssue);
    assert.equal(breakIssue?.expectedValue, 15);

    const okIssues = validateLaborRules(
      buildInput({
        assignments: [
          { employeeId: "emp-1", shiftId: "s1", date: "2026-06-02", isOff: false },
        ],
        shifts: [shift("s1", "08:00", "13:00", 15)],
      })
    );
    assert.equal(hasCode(okIssues, "BREAK_INSUFFICIENT"), false);
  });

  it("erro quando descanso entre jornadas é menor que 11h", () => {
    const issues = validateLaborRules(
      buildInput({
        assignments: [
          { employeeId: "emp-1", shiftId: "s1", date: "2026-06-02", isOff: false },
          { employeeId: "emp-1", shiftId: "s2", date: "2026-06-03", isOff: false },
        ],
        shifts: [
          shift("s1", "14:00", "22:00", 60),
          shift("s2", "07:00", "15:00", 60),
        ],
      })
    );

    const restIssue = issues.find(
      (issue) => issue.code === "REST_BETWEEN_SHIFTS_INSUFFICIENT"
    );
    assert.ok(restIssue);
    assert.equal(restIssue?.severity, "error");
  });

  it("erro em semana sem folga", () => {
    const assignments = [
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
      "2026-06-04",
      "2026-06-05",
      "2026-06-06",
      "2026-06-07",
    ].map((date) => ({
      employeeId: "emp-1",
      shiftId: "s1",
      date,
      isOff: false,
    }));

    const issues = validateLaborRules(buildInput({ assignments }));
    assert.ok(hasCode(issues, "WEEKLY_REST_MISSING"));
  });

  it("aceita escala 6x1 válida", () => {
    const dates = [
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
      "2026-06-04",
      "2026-06-05",
      "2026-06-06",
      "2026-06-07",
    ];
    const assignments = dates.map((date, index) => ({
      employeeId: "emp-1",
      shiftId: index < 6 ? "s1" : null,
      date,
      isOff: index === 6,
    }));

    const issues = validateLaborRules(
      buildInput({
        scheduleType: "6x1",
        config: { workDaysPerCycle: 6, offDaysPerCycle: 1, cycleLengthDays: 7, holidayDates: [] },
        assignments,
      })
    );

    assert.equal(hasCode(issues, "SCALE_6X1_VIOLATION"), false);
  });

  it("erro em escala 6x1 inválida", () => {
    const dates = [
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
      "2026-06-04",
      "2026-06-05",
      "2026-06-06",
      "2026-06-07",
    ];
    const assignments = dates.map((date) => ({
      employeeId: "emp-1",
      shiftId: "s1",
      date,
      isOff: false,
    }));

    const issues = validateLaborRules(
      buildInput({
        scheduleType: "6x1",
        config: { workDaysPerCycle: 6, offDaysPerCycle: 1, cycleLengthDays: 7, holidayDates: [] },
        assignments,
      })
    );

    assert.ok(hasCode(issues, "SCALE_6X1_VIOLATION"));
  });

  it("aceita escala 5x2 válida", () => {
    const week = [
      "2026-06-08",
      "2026-06-09",
      "2026-06-10",
      "2026-06-11",
      "2026-06-12",
      "2026-06-13",
      "2026-06-14",
    ];
    const assignments = week.map((date, index) => ({
      employeeId: "emp-1",
      shiftId: index < 5 ? "s1" : null,
      date,
      isOff: index >= 5,
    }));

    const issues = validateLaborRules(buildInput({ assignments }));
    assert.equal(hasCode(issues, "SCALE_5X2_VIOLATION"), false);
  });

  it("registra trabalho em domingo", () => {
    const issues = validateLaborRules(
      buildInput({
        assignments: [
          { employeeId: "emp-1", shiftId: "s1", date: "2026-06-07", isOff: false },
        ],
      })
    );

    const sunday = issues.find((issue) => issue.code === "SUNDAY_WORK");
    assert.ok(sunday);
    assert.equal(sunday?.severity, "info");
  });

  it("alerta trabalho em feriado", () => {
    const issues = validateLaborRules(
      buildInput({
        config: {
          workDaysPerCycle: 5,
          offDaysPerCycle: 2,
          cycleLengthDays: 7,
          holidayDates: ["2026-06-02"],
        },
        assignments: [
          { employeeId: "emp-1", shiftId: "s1", date: "2026-06-02", isOff: false },
        ],
      })
    );

    const holiday = issues.find((issue) => issue.code === "HOLIDAY_WORK");
    assert.ok(holiday);
    assert.equal(holiday?.severity, "warning");
    assert.match(holiday?.message ?? "", /convenção coletiva/i);
  });

  it("erro em escala 5x2 sem folga suficiente na semana", () => {
    const week = [
      "2026-06-07",
      "2026-06-08",
      "2026-06-09",
      "2026-06-10",
      "2026-06-11",
      "2026-06-12",
      "2026-06-13",
    ];
    const assignments = week.map((date) => ({
      employeeId: "emp-1",
      shiftId: "s1",
      date,
      isOff: false,
    }));

    const issues = validateLaborRules(buildInput({ assignments }));
    const scaleIssue = issues.find((issue) => issue.code === "SCALE_5X2_VIOLATION");
    assert.ok(scaleIssue);
    assert.match(scaleIssue?.message ?? "", /folga/i);
  });

  it("alerta domingos consecutivos com mensagem compreensível", () => {
    const issues = validateLaborRules(
      buildInput({
        assignments: [
          { employeeId: "emp-1", shiftId: "s1", date: "2026-06-07", isOff: false },
          { employeeId: "emp-1", shiftId: "s1", date: "2026-06-14", isOff: false },
        ],
      })
    );

    const consecutive = issues.find((issue) => issue.code === "CONSECUTIVE_SUNDAYS_WORKED");
    assert.ok(consecutive);
    assert.match(consecutive?.message ?? "", /domingos consecutivos/i);
    assert.match(consecutive?.message ?? "", /Revise o revezamento/i);
  });

  it("mensagem de semana acima de 44h é clara para usuário leigo", () => {
    const assignments = ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05", "2026-06-06"].map(
      (date) => ({
        employeeId: "emp-1",
        shiftId: "s1",
        date,
        isOff: false,
      })
    );

    const issues = validateLaborRules(
      buildInput({
        assignments,
        shifts: [shift("s1", "08:00", "16:00", 0)],
      })
    );

    const weekly = issues.find((issue) => issue.code === "WEEKLY_HOURS_EXCEEDED");
    assert.ok(weekly);
    assert.match(weekly?.message ?? "", /Ana trabalhou mais de 44h nesta semana/i);
  });

  it("mensagem de semana sem folga é clara para usuário leigo", () => {
    const assignments = [
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
      "2026-06-04",
      "2026-06-05",
      "2026-06-06",
      "2026-06-07",
    ].map((date) => ({
      employeeId: "emp-1",
      shiftId: "s1",
      date,
      isOff: false,
    }));

    const issues = validateLaborRules(buildInput({ assignments }));
    const restIssue = issues.find((issue) => issue.code === "WEEKLY_REST_MISSING");
    assert.ok(restIssue);
    assert.match(restIssue?.message ?? "", /Ana está sem folga nesta semana/i);
  });

  it("mensagem de descanso menor que 11h é clara para usuário leigo", () => {
    const issues = validateLaborRules(
      buildInput({
        assignments: [
          { employeeId: "emp-1", shiftId: "s1", date: "2026-06-02", isOff: false },
          { employeeId: "emp-1", shiftId: "s2", date: "2026-06-03", isOff: false },
        ],
        shifts: [
          shift("s1", "14:00", "22:00", 60),
          shift("s2", "07:00", "15:00", 60),
        ],
      })
    );

    const restIssue = issues.find(
      (issue) => issue.code === "REST_BETWEEN_SHIFTS_INSUFFICIENT"
    );
    assert.ok(restIssue);
    assert.match(restIssue?.message ?? "", /menos de 11h de descanso entre dois turnos/i);
  });
});
