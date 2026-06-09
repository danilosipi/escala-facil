/**
 * Mapeamento das entidades de domínio do MVP para os modelos persistidos.
 *
 * O sistema é single-tenant: uma instalação representa uma loja.
 * Empresa e Unidade/Loja são representadas por StoreConfig.
 */

import type {
  EmployeeData,
  ScheduleAssignmentData,
  ShiftData,
  StoreConfigData,
  ScheduleConflict,
} from "./types";
import type { LaborRulesConfig, LaborValidationIssue } from "./labor-rules/types";

/** Empresa — implícita no tenant único; nome em StoreConfig.name */
export type Empresa = Pick<StoreConfigData, "id" | "name">;

/** Unidade/Loja — configuração operacional da loja */
export type Loja = StoreConfigData;

/** Funcionário da loja */
export type Funcionario = EmployeeData;

/** Cargo/função do funcionário (campo role) */
export type CargoFuncao = string | null;

/** Turno de trabalho */
export type Turno = ShiftData;

/** Escala mensal (cabeçalho) — persistida como Schedule */
export interface Escala {
  month: number;
  year: number;
  generatedAt: Date;
}

/** Item da escala — alocação diária de funcionário */
export type ItemEscala = ScheduleAssignmentData;

/** Folga — representada por isOff=true em ItemEscala */
export type Folga = Pick<ScheduleAssignmentData, "employeeId" | "date" | "isOff">;

/** Feriado — datas cadastradas em StoreConfig.holidayDates */
export type Feriado = string;

/** Regras trabalhistas configuráveis */
export type RegraTrabalhista = LaborRulesConfig;

/** Resultado de validação trabalhista */
export type ResultadoValidacao = LaborValidationIssue | ScheduleConflict;
