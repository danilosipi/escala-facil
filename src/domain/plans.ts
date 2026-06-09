/**
 * Planos comerciais previstos para o micro-SaaS.
 * Pagamento não implementado — apenas base de configuração.
 */
export const PLAN_TYPES = [
  "FREE",
  "ESSENTIAL",
  "STORE",
  "SMALL_NETWORK",
  "CUSTOM",
] as const;

export type PlanType = (typeof PLAN_TYPES)[number];

export interface PlanConfig {
  type: PlanType;
  label: string;
  description: string;
  maxEmployees: number | null;
  maxStores: number | null;
}

export const PLAN_CONFIGS: Record<PlanType, PlanConfig> = {
  FREE: {
    type: "FREE",
    label: "Grátis",
    description: "Para testar com uma loja pequena",
    maxEmployees: 5,
    maxStores: 1,
  },
  ESSENTIAL: {
    type: "ESSENTIAL",
    label: "Essencial",
    description: "Para lojas com equipe enxuta",
    maxEmployees: 15,
    maxStores: 1,
  },
  STORE: {
    type: "STORE",
    label: "Loja",
    description: "Para lojas com até 30 funcionários",
    maxEmployees: 30,
    maxStores: 1,
  },
  SMALL_NETWORK: {
    type: "SMALL_NETWORK",
    label: "Rede pequena",
    description: "Para redes com poucas unidades",
    maxEmployees: 30,
    maxStores: 5,
  },
  CUSTOM: {
    type: "CUSTOM",
    label: "Personalizado",
    description: "Limites sob medida",
    maxEmployees: null,
    maxStores: null,
  },
};

/** Plano padrão enquanto billing não estiver ativo */
export const DEFAULT_PLAN: PlanType = "FREE";
