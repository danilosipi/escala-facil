import type {
  EmployeeData,
  GeneratedSchedule,
  ShiftData,
  StoreConfigData,
} from "./types";
import { runSchedulePipeline } from "./schedule-pipeline";

export { repairCycleCoverage, buildAssignmentsFromPlans } from "./schedule-pipeline";

export function generateSchedule(
  config: StoreConfigData,
  employees: EmployeeData[],
  shifts: ShiftData[],
  month: number,
  year: number
): GeneratedSchedule {
  return runSchedulePipeline({ config, employees, shifts, month, year });
}
