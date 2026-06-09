import { getMonthDates } from "@/lib/utils";
import type {
  LaborValidationInput,
  LaborValidationIssue,
  LaborViolationCode,
} from "./types";
import {
  formatMinutesAsHours,
  getDayType,
  getNetWorkMinutes,
  getRequiredBreakMinutes,
  getShiftEndTimestamp,
  getShiftStartTimestamp,
  getWeekStartSunday,
  type ShiftLike,
} from "./shift-time";

interface WorkEntry {
  date: string;
  shift: ShiftLike;
  assignment: LaborValidationInput["assignments"][number];
}

function isWorkAssignment(
  assignment: LaborValidationInput["assignments"][number]
): boolean {
  return !assignment.isOff && Boolean(assignment.shiftId);
}

function pushIssue(
  issues: LaborValidationIssue[],
  issue: LaborValidationIssue
): void {
  issues.push(issue);
}

function getEmployeeWorkEntries(
  input: LaborValidationInput,
  employeeId: string,
  shiftMap: Map<string, ShiftLike>
): WorkEntry[] {
  return input.assignments
    .filter((a) => a.employeeId === employeeId && isWorkAssignment(a))
    .map((assignment) => {
      const shift = shiftMap.get(assignment.shiftId!);
      if (!shift) return null;
      return { date: assignment.date, shift, assignment };
    })
    .filter((entry): entry is WorkEntry => entry !== null)
    .sort((a, b) => {
      const timeDiff =
        getShiftStartTimestamp(a.date, a.shift) - getShiftStartTimestamp(b.date, b.shift);
      return timeDiff !== 0 ? timeDiff : a.date.localeCompare(b.date);
    });
}

function validateDailyHours(
  employee: { id: string; name: string },
  workEntries: WorkEntry[],
  rules: LaborValidationInput["laborRules"],
  issues: LaborValidationIssue[]
): void {
  const maxAllowed = rules.maxDailyMinutes + rules.maxOvertimeDailyMinutes;

  for (const entry of workEntries) {
    const netMinutes = getNetWorkMinutes(entry.shift);

    if (netMinutes > maxAllowed) {
      pushIssue(issues, {
        code: "DAILY_HOURS_EXCEEDED",
        severity: "error",
        message: `${employee.name} trabalhou mais de ${formatMinutesAsHours(maxAllowed)} em ${entry.date} — acima do limite diário com hora extra.`,
        employeeId: employee.id,
        employeeName: employee.name,
        date: entry.date,
        shiftId: entry.shift.id,
        shiftName: entry.shift.name,
        expectedValue: maxAllowed,
        actualValue: netMinutes,
      });
    } else if (netMinutes > rules.maxDailyMinutes) {
      pushIssue(issues, {
        code: "DAILY_HOURS_OVERTIME_POSSIBLE",
        severity: "warning",
        message: `${employee.name} trabalhou mais de ${formatMinutesAsHours(rules.maxDailyMinutes)} em ${entry.date} — verifique se há hora extra.`,
        employeeId: employee.id,
        employeeName: employee.name,
        date: entry.date,
        shiftId: entry.shift.id,
        shiftName: entry.shift.name,
        expectedValue: rules.maxDailyMinutes,
        actualValue: netMinutes,
      });
    }
  }
}

function validateWeeklyHours(
  employee: { id: string; name: string },
  workEntries: WorkEntry[],
  rules: LaborValidationInput["laborRules"],
  issues: LaborValidationIssue[]
): void {
  const minutesByWeek = new Map<string, number>();

  for (const entry of workEntries) {
    const weekKey = getWeekStartSunday(entry.date);
    const current = minutesByWeek.get(weekKey) ?? 0;
    minutesByWeek.set(weekKey, current + getNetWorkMinutes(entry.shift));
  }

  for (const [weekStart, totalMinutes] of minutesByWeek) {
    if (totalMinutes <= rules.maxWeeklyMinutes) continue;

    pushIssue(issues, {
      code: "WEEKLY_HOURS_EXCEEDED",
      severity: rules.strictWeeklyHours ? "error" : "warning",
      message: `${employee.name} trabalhou mais de ${formatMinutesAsHours(rules.maxWeeklyMinutes)} nesta semana (início em ${weekStart}).`,
      employeeId: employee.id,
      employeeName: employee.name,
      date: weekStart,
      expectedValue: rules.maxWeeklyMinutes,
      actualValue: totalMinutes,
    });
  }
}

function validateBreaks(
  employee: { id: string; name: string },
  workEntries: WorkEntry[],
  rules: LaborValidationInput["laborRules"],
  issues: LaborValidationIssue[]
): void {
  for (const entry of workEntries) {
    const requiredBreak = getRequiredBreakMinutes(entry.shift.durationMinutes, rules);
    if (requiredBreak === 0) continue;

    if (entry.shift.breakMinutes < requiredBreak) {
      pushIssue(issues, {
        code: "BREAK_INSUFFICIENT",
        severity: "error",
        message: `${employee.name} está sem intervalo suficiente no turno ${entry.shift.name} em ${entry.date} — mínimo de ${requiredBreak} min para jornada de ${formatMinutesAsHours(entry.shift.durationMinutes)}.`,
        employeeId: employee.id,
        employeeName: employee.name,
        date: entry.date,
        shiftId: entry.shift.id,
        shiftName: entry.shift.name,
        expectedValue: requiredBreak,
        actualValue: entry.shift.breakMinutes,
      });
    }
  }
}

function validateRestBetweenShifts(
  employee: { id: string; name: string },
  workEntries: WorkEntry[],
  rules: LaborValidationInput["laborRules"],
  issues: LaborValidationIssue[]
): void {
  for (let i = 1; i < workEntries.length; i++) {
    const previous = workEntries[i - 1]!;
    const current = workEntries[i]!;
    const previousEnd = getShiftEndTimestamp(previous.date, previous.shift);
    const currentStart = getShiftStartTimestamp(current.date, current.shift);
    const restMinutes = Math.floor((currentStart - previousEnd) / (60 * 1000));

    if (restMinutes < rules.minRestBetweenShiftsMinutes) {
      pushIssue(issues, {
        code: "REST_BETWEEN_SHIFTS_INSUFFICIENT",
        severity: "error",
        message: `${employee.name} ficou com menos de ${formatMinutesAsHours(rules.minRestBetweenShiftsMinutes)} de descanso entre dois turnos (${previous.date} e ${current.date}).`,
        employeeId: employee.id,
        employeeName: employee.name,
        date: current.date,
        shiftId: current.shift.id,
        shiftName: current.shift.name,
        expectedValue: rules.minRestBetweenShiftsMinutes,
        actualValue: restMinutes,
      });
    }
  }
}

function validateWeeklyRest(
  employee: { id: string; name: string },
  employeeAssignments: LaborValidationInput["assignments"],
  monthDates: string[],
  rules: LaborValidationInput["laborRules"],
  issues: LaborValidationIssue[]
): void {
  const weeks = new Map<string, string[]>();

  for (const date of monthDates) {
    const weekKey = getWeekStartSunday(date);
    const dates = weeks.get(weekKey) ?? [];
    dates.push(date);
    weeks.set(weekKey, dates);
  }

  for (const [weekStart, dates] of weeks) {
    const hasFullDayOff = dates.some((date) => {
      const assignment = employeeAssignments.find(
        (a) => a.employeeId === employee.id && a.date === date
      );
      return assignment?.isOff === true;
    });

    if (!hasFullDayOff) {
      pushIssue(issues, {
        code: "WEEKLY_REST_MISSING",
        severity: "error",
        message: `${employee.name} está sem folga nesta semana (início em ${weekStart}).`,
        employeeId: employee.id,
        employeeName: employee.name,
        date: weekStart,
        expectedValue: rules.minWeeklyRestMinutes,
        actualValue: 0,
      });
    }
  }
}

function validateScalePattern(
  employee: { id: string; name: string },
  employeeAssignments: LaborValidationInput["assignments"],
  monthDates: string[],
  scheduleType: LaborValidationInput["scheduleType"],
  config: LaborValidationInput["config"],
  issues: LaborValidationIssue[]
): void {
  if (scheduleType === "6x1") {
    let consecutiveWork = 0;
    for (const date of monthDates) {
      const assignment = employeeAssignments.find(
        (a) => a.employeeId === employee.id && a.date === date
      );
      const isWork = assignment ? isWorkAssignment(assignment) : false;

      if (isWork) {
        consecutiveWork += 1;
        if (consecutiveWork > config.workDaysPerCycle) {
          pushIssue(issues, {
            code: "SCALE_6X1_VIOLATION",
            severity: "error",
            message: `${employee.name} trabalhou mais de ${config.workDaysPerCycle} dias seguidos sem folga (escala 6x1) — revise a partir de ${date}.`,
            employeeId: employee.id,
            employeeName: employee.name,
            date,
            expectedValue: config.workDaysPerCycle,
            actualValue: consecutiveWork,
          });
        }
      } else {
        consecutiveWork = 0;
      }
    }
    return;
  }

  if (scheduleType === "5x2") {
    const weeks = new Map<string, string[]>();
    for (const date of monthDates) {
      const weekKey = getWeekStartSunday(date);
      const dates = weeks.get(weekKey) ?? [];
      dates.push(date);
      weeks.set(weekKey, dates);
    }

    for (const [weekStart, dates] of weeks) {
      const scheduledDates = dates.filter((date) =>
        employeeAssignments.some((a) => a.employeeId === employee.id && a.date === date)
      );

      if (scheduledDates.length < config.cycleLengthDays) {
        continue;
      }

      const offDays = scheduledDates.filter((date) => {
        const assignment = employeeAssignments.find(
          (a) => a.employeeId === employee.id && a.date === date
        );
        return assignment?.isOff === true;
      }).length;

      if (offDays < config.offDaysPerCycle) {
        pushIssue(issues, {
          code: "SCALE_5X2_VIOLATION",
          severity: "error",
          message: `${employee.name} ficou com apenas ${offDays} folga(s) na semana (início em ${weekStart}) — escala 5x2 exige ${config.offDaysPerCycle}.`,
          employeeId: employee.id,
          employeeName: employee.name,
          date: weekStart,
          expectedValue: config.offDaysPerCycle,
          actualValue: offDays,
        });
      }
    }
  }
}

function validateSundays(
  employee: { id: string; name: string },
  workEntries: WorkEntry[],
  holidayDates: string[],
  rules: LaborValidationInput["laborRules"],
  issues: LaborValidationIssue[]
): void {
  const sundayWorkDates = workEntries
    .filter((entry) => getDayType(entry.date, holidayDates) === "sunday")
    .map((entry) => entry.date)
    .sort();

  for (const date of sundayWorkDates) {
    pushIssue(issues, {
      code: "SUNDAY_WORK",
      severity: rules.allowSundayWork ? "info" : "warning",
      message: `${employee.name} foi escalado no domingo ${date}.`,
      employeeId: employee.id,
      employeeName: employee.name,
      date,
    });
  }

  for (let i = 1; i < sundayWorkDates.length; i++) {
    const previous = sundayWorkDates[i - 1]!;
    const current = sundayWorkDates[i]!;
    const previousSunday = new Date(previous + "T00:00:00");
    const currentSunday = new Date(current + "T00:00:00");
    const diffDays = Math.round(
      (currentSunday.getTime() - previousSunday.getTime()) / (24 * 60 * 60 * 1000)
    );

    if (diffDays === 7) {
      pushIssue(issues, {
        code: "CONSECUTIVE_SUNDAYS_WORKED",
        severity: "warning",
        message: `${employee.name} trabalhou domingos consecutivos (${previous} e ${current}). Revise o revezamento.`,
        employeeId: employee.id,
        employeeName: employee.name,
        date: current,
        expectedValue: "folga dominical",
        actualValue: "domingos consecutivos trabalhados",
      });
    }
  }
}

function validateHolidays(
  employee: { id: string; name: string },
  workEntries: WorkEntry[],
  holidayDates: string[],
  rules: LaborValidationInput["laborRules"],
  issues: LaborValidationIssue[]
): void {
  for (const entry of workEntries) {
    if (getDayType(entry.date, holidayDates) !== "holiday") continue;

    pushIssue(issues, {
      code: "HOLIDAY_WORK",
      severity: rules.allowHolidayWork ? "warning" : "error",
      message: `${employee.name} foi escalado em feriado (${entry.date}). Verifique a convenção coletiva e regra municipal.`,
      employeeId: employee.id,
      employeeName: employee.name,
      date: entry.date,
      shiftId: entry.shift.id,
      shiftName: entry.shift.name,
    });
  }
}

export function validateLaborRules(input: LaborValidationInput): LaborValidationIssue[] {
  const issues: LaborValidationIssue[] = [];
  const shiftMap = new Map(input.shifts.map((shift) => [shift.id, shift]));
  const monthDates = getMonthDates(input.year, input.month);

  for (const employee of input.employees) {
    const employeeAssignments = input.assignments.filter((a) => a.employeeId === employee.id);
    const workEntries = getEmployeeWorkEntries(input, employee.id, shiftMap);

    validateDailyHours(employee, workEntries, input.laborRules, issues);
    validateWeeklyHours(employee, workEntries, input.laborRules, issues);
    validateBreaks(employee, workEntries, input.laborRules, issues);
    validateRestBetweenShifts(employee, workEntries, input.laborRules, issues);
    validateWeeklyRest(employee, employeeAssignments, monthDates, input.laborRules, issues);
    validateScalePattern(
      employee,
      employeeAssignments,
      monthDates,
      input.scheduleType,
      input.config,
      issues
    );
    validateSundays(employee, workEntries, input.config.holidayDates, input.laborRules, issues);
    validateHolidays(employee, workEntries, input.config.holidayDates, input.laborRules, issues);
  }

  return issues;
}

export function getLaborViolationLabel(code: LaborViolationCode): string {
  const labels: Record<LaborViolationCode, string> = {
    DAILY_HOURS_OVERTIME_POSSIBLE: "Jornada acima de 8h",
    DAILY_HOURS_EXCEEDED: "Jornada diária acima do limite",
    WEEKLY_HOURS_EXCEEDED: "Semana acima de 44h",
    BREAK_INSUFFICIENT: "Intervalo ausente ou curto",
    REST_BETWEEN_SHIFTS_INSUFFICIENT: "Descanso menor que 11h",
    WEEKLY_REST_MISSING: "Sem folga na semana",
    SCALE_6X1_VIOLATION: "Escala 6x1 fora do padrão",
    SCALE_5X2_VIOLATION: "Escala 5x2 fora do padrão",
    SUNDAY_WORK: "Domingo trabalhado",
    CONSECUTIVE_SUNDAYS_WORKED: "Domingos consecutivos",
    HOLIDAY_WORK: "Feriado trabalhado",
  };
  return labels[code];
}
