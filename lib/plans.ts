import {
  RUNTIME_PLAN_LIMITS,
  type RuntimeBotModuleId,
  type RuntimePlanId,
} from "@/shared/runtime-plan-limits";

export type PlanId = RuntimePlanId;

/** Intervalle d’abonnement SaaS (jamais un Price ID client). */
export type BillingInterval = "month" | "year";

/** 2 mois offerts à l’année (= 10 × mensuel). */
export const YEARLY_BILLED_MONTHS = 10;

export type BotModuleId = RuntimeBotModuleId;

/** Socle ops formation — visible dès l’essai (sauf automod Scale). */
export const OPS_CORE_MODULES: BotModuleId[] = [
  ...RUNTIME_PLAN_LIMITS.FREE.modules,
];

export type PlanDefinition = {
  id: PlanId;
  name: string;
  priceMonthlyEur: number;
  /** Prix annuel affiché (2 mois offerts). */
  priceYearlyEur: number;
  description: string;
  /** Nombre max de bindings guild (modèle Prisma `Bot`). */
  maxGuilds: number;
  maxCustomCommands: number;
  modules: BotModuleId[];
  prioritySupport: boolean;
  /** Inclut export audit modération (JSON warns). */
  auditExport: boolean;
  /** Nombre max de produits accès (Stripe price → rôle Discord). */
  maxAccessProducts: number;
  /** DPA contractuel sur demande (Scale) — process commercial, pas un PDF in-app. */
  dpaAvailable: boolean;
  highlighted?: boolean;
  commercial: boolean;
  stripePriceEnvKey: string | null;
  stripePriceYearlyEnvKey: string | null;
  status: "available" | "beta";
};

function yearlyFromMonthly(monthly: number): number {
  return Math.round(monthly * YEARLY_BILLED_MONTHS * 100) / 100;
}

/**
 * Offres self-serve + packs installation optionnels.
 * Setup / Diagnostic (one-shot) ne sont pas des PlanId — voir STRIPE_PRICE_*.
 *
 * Freemium : l’essai livre le socle ops + 1 mapping paiement→rôle.
 * Paywall : export audit (Starter+), volume produits accès / commandes, multi-serveurs.
 */
function runtimeSlice(planId: PlanId): Pick<
  PlanDefinition,
  "maxGuilds" | "maxCustomCommands" | "modules"
> {
  const limits = RUNTIME_PLAN_LIMITS[planId];
  return {
    maxGuilds: limits.maxGuilds,
    maxCustomCommands: limits.maxCustomCommands,
    modules: [...limits.modules],
  };
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  FREE: {
    id: "FREE",
    name: "Essai",
    priceMonthlyEur: 0,
    priceYearlyEur: 0,
    description:
      "Socle ops + contrôle d’accès : 1 produit Stripe→rôle Discord. Preview warns — export = Starter.",
    ...runtimeSlice("FREE"),
    prioritySupport: false,
    auditExport: false,
    maxAccessProducts: 1,
    dpaAvailable: false,
    commercial: false,
    stripePriceEnvKey: null,
    stripePriceYearlyEnvKey: null,
    status: "available",
  },
  STARTER: {
    id: "STARTER",
    name: "Starter",
    priceMonthlyEur: 19.99,
    priceYearlyEur: yearlyFromMonthly(19.99),
    description:
      "Jusqu’à 5 produits accès, export audit, 15 commandes FAQ.",
    ...runtimeSlice("STARTER"),
    prioritySupport: false,
    auditExport: true,
    maxAccessProducts: 5,
    dpaAvailable: false,
    commercial: true,
    stripePriceEnvKey: "STRIPE_PRICE_STARTER",
    stripePriceYearlyEnvKey: "STRIPE_PRICE_STARTER_YEARLY",
    status: "available",
  },
  OPS: {
    id: "OPS",
    name: "Ops",
    priceMonthlyEur: 49,
    priceYearlyEur: yearlyFromMonthly(49),
    description:
      "Jusqu’à 20 produits accès, export audit, 40 commandes — pack ops formation.",
    ...runtimeSlice("OPS"),
    prioritySupport: false,
    auditExport: true,
    maxAccessProducts: 20,
    dpaAvailable: false,
    highlighted: true,
    commercial: true,
    stripePriceEnvKey: "STRIPE_PRICE_OPS",
    stripePriceYearlyEnvKey: "STRIPE_PRICE_OPS_YEARLY",
    status: "available",
  },
  SCALE: {
    id: "SCALE",
    name: "Scale",
    priceMonthlyEur: 99,
    priceYearlyEur: yearlyFromMonthly(99),
    description:
      "Jusqu’à 5 serveurs, 100 produits accès, automod, DPA sur demande, support prioritaire.",
    ...runtimeSlice("SCALE"),
    prioritySupport: true,
    auditExport: true,
    maxAccessProducts: 100,
    dpaAvailable: true,
    commercial: true,
    stripePriceEnvKey: "STRIPE_PRICE_SCALE",
    stripePriceYearlyEnvKey: "STRIPE_PRICE_SCALE_YEARLY",
    status: "available",
  },
};

/** Pack installation one-shot (Stripe mode payment). */
export const SETUP_OFFER = {
  id: "SETUP" as const,
  name: "Setup Pilot",
  priceEur: 290,
  description:
    "Sous 10 jours ouvrés : serveur configuré (welcome/rôles/tickets), modération traçable, 1 h de formation. Le diagnostic est déduit si déjà payé.",
  stripePriceEnvKey: "STRIPE_PRICE_SETUP",
  status: "available" as const,
};

/**
 * Diagnostic payant — ouvre-porte commercial.
 * One-shot Stripe ; montant déduit manuellement du Setup (promo code / ajustement).
 */
export const DIAGNOSTIC_OFFER = {
  id: "DIAGNOSTIC" as const,
  name: "Diagnostic Discord",
  priceEur: 49,
  description:
    "Cadrage 90 min : risques, gaps modération/RGPD, plan d’action. Déduit du Setup si vous enchaînez.",
  stripePriceEnvKey: "STRIPE_PRICE_DIAGNOSTIC",
  setupCreditEur: 49,
  status: "available" as const,
};

export type OneShotOfferId = "SETUP" | "DIAGNOSTIC";

export const MODULE_CATALOG: Record<
  BotModuleId,
  { label: string; description: string }
> = {
  welcome: {
    label: "Welcome",
    description: "Accueil apprenant + rôle promo à l’arrivée.",
  },
  roles: {
    label: "Rôles auto",
    description: "Rôles via réactions (cohortes / parcours).",
  },
  moderation: {
    label: "Modération",
    description: "Warn / kick / ban avec historique persisté (litiges).",
  },
  logs: {
    label: "Logs",
    description: "Journal join/leave et actions de modération.",
  },
  tickets: {
    label: "Tickets",
    description: "Support formation (/ticket + sujet : accès, factu, contenu).",
  },
  automod: {
    label: "Automod",
    description: "Mots interdits, invitations, liens, mentions, anti-spam.",
  },
  custom_commands: {
    label: "Commandes custom",
    description: "FAQ formation (horaires, liens) via préfixe.",
  },
};

export function formatPriceEur(amount: number): string {
  if (Number.isInteger(amount)) return `${amount}`;
  return amount.toFixed(2).replace(".", ",");
}

export function maxAccessProductsForPlan(planId: PlanId): number {
  return getPlan(planId).maxAccessProducts;
}

export function getPlan(planId: PlanId): PlanDefinition {
  return PLANS[planId];
}

export function planAllowsModule(
  planId: PlanId,
  moduleId: BotModuleId
): boolean {
  return PLANS[planId].modules.includes(moduleId);
}

function envPrice(key: string | null): string | null {
  if (!key) return null;
  const value = process.env[key];
  return value && value.length > 0 ? value : null;
}

/**
 * Résout le Price ID Stripe côté serveur uniquement.
 * Le client n’envoie jamais de price_ — seulement planId + interval.
 */
export function getStripePriceId(
  planId: PlanId,
  interval: BillingInterval = "month"
): string | null {
  const plan = PLANS[planId];
  if (interval === "year") {
    return envPrice(plan.stripePriceYearlyEnvKey);
  }
  return envPrice(plan.stripePriceEnvKey);
}

export function planDisplayPriceEur(
  planId: PlanId,
  interval: BillingInterval
): number {
  const plan = PLANS[planId];
  return interval === "year" ? plan.priceYearlyEur : plan.priceMonthlyEur;
}

/** Économie vs 12 × mensuel (2 mois offerts). 0 pour FREE. */
export function planYearlySavingsEur(planId: PlanId): number {
  const plan = PLANS[planId];
  if (plan.priceMonthlyEur <= 0) return 0;
  return (
    Math.round((plan.priceMonthlyEur * 12 - plan.priceYearlyEur) * 100) / 100
  );
}

export function getSetupStripePriceId(): string | null {
  const value = process.env[SETUP_OFFER.stripePriceEnvKey];
  return value && value.length > 0 ? value : null;
}

export function getDiagnosticStripePriceId(): string | null {
  const value = process.env[DIAGNOSTIC_OFFER.stripePriceEnvKey];
  return value && value.length > 0 ? value : null;
}

export function getOneShotStripePriceId(
  offerId: OneShotOfferId
): string | null {
  if (offerId === "SETUP") return getSetupStripePriceId();
  return getDiagnosticStripePriceId();
}

const PAID_PLAN_ORDER: PlanId[] = ["STARTER", "OPS", "SCALE"];

export function cheapestPlanForModule(moduleId: BotModuleId): PlanId | null {
  for (const planId of PAID_PLAN_ORDER) {
    if (PLANS[planId].modules.includes(moduleId)) return planId;
  }
  return null;
}

/** Plan payant le moins cher qui débloque l’export audit. */
export function cheapestPlanForAuditExport(): PlanId {
  for (const planId of PAID_PLAN_ORDER) {
    if (PLANS[planId].auditExport) return planId;
  }
  return "STARTER";
}
