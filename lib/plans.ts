export type PlanId = "FREE" | "STARTER" | "OPS" | "SCALE";

export type BotModuleId =
  | "welcome"
  | "roles"
  | "moderation"
  | "logs"
  | "tickets"
  | "automod"
  | "custom_commands";

/** Socle ops formation — visible dès l’essai (sauf automod Scale). */
export const OPS_CORE_MODULES: BotModuleId[] = [
  "welcome",
  "roles",
  "moderation",
  "logs",
  "tickets",
  "custom_commands",
];

export type PlanDefinition = {
  id: PlanId;
  name: string;
  priceMonthlyEur: number;
  description: string;
  maxBots: number;
  maxGuilds: number;
  maxCustomCommands: number;
  modules: BotModuleId[];
  forceBranding: boolean;
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
  status: "available" | "beta";
};

/**
 * Offres self-serve + packs installation optionnels.
 * Setup / Diagnostic (one-shot) ne sont pas des PlanId — voir STRIPE_PRICE_*.
 *
 * Freemium poussé : l’essai livre le socle ops + 1 mapping paiement→rôle.
 * Paywall : export audit (Starter+), volume produits accès / commandes, multi-serveurs.
 */
export const PLANS: Record<PlanId, PlanDefinition> = {
  FREE: {
    id: "FREE",
    name: "Essai",
    priceMonthlyEur: 0,
    description:
      "Socle ops + contrôle d’accès : 1 produit Stripe→rôle Discord. Preview warns — export = Starter.",
    maxBots: 1,
    maxGuilds: 1,
    maxCustomCommands: 5,
    modules: [...OPS_CORE_MODULES],
    forceBranding: false,
    prioritySupport: false,
    auditExport: false,
    maxAccessProducts: 1,
    dpaAvailable: false,
    commercial: false,
    stripePriceEnvKey: null,
    status: "available",
  },
  STARTER: {
    id: "STARTER",
    name: "Starter",
    priceMonthlyEur: 19.99,
    description:
      "Jusqu’à 5 produits accès, export audit, 15 commandes FAQ.",
    maxBots: 1,
    maxGuilds: 1,
    maxCustomCommands: 15,
    modules: [...OPS_CORE_MODULES],
    forceBranding: false,
    prioritySupport: false,
    auditExport: true,
    maxAccessProducts: 5,
    dpaAvailable: false,
    commercial: true,
    stripePriceEnvKey: "STRIPE_PRICE_STARTER",
    status: "available",
  },
  OPS: {
    id: "OPS",
    name: "Ops",
    priceMonthlyEur: 49,
    description:
      "Jusqu’à 20 produits accès, export audit, 40 commandes — pack ops formation.",
    maxBots: 1,
    maxGuilds: 1,
    maxCustomCommands: 40,
    modules: [...OPS_CORE_MODULES],
    forceBranding: false,
    prioritySupport: false,
    auditExport: true,
    maxAccessProducts: 20,
    dpaAvailable: false,
    highlighted: true,
    commercial: true,
    stripePriceEnvKey: "STRIPE_PRICE_OPS",
    status: "available",
  },
  SCALE: {
    id: "SCALE",
    name: "Scale",
    priceMonthlyEur: 99,
    description:
      "Jusqu’à 5 serveurs, 100 produits accès, automod, DPA sur demande, support prioritaire.",
    maxBots: 5,
    maxGuilds: 5,
    maxCustomCommands: 100,
    modules: [...OPS_CORE_MODULES, "automod"],
    forceBranding: false,
    prioritySupport: true,
    auditExport: true,
    maxAccessProducts: 100,
    dpaAvailable: true,
    commercial: true,
    stripePriceEnvKey: "STRIPE_PRICE_SCALE",
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

export function getPlan(planId: PlanId): PlanDefinition {
  return PLANS[planId];
}

export function planAllowsModule(
  planId: PlanId,
  moduleId: BotModuleId
): boolean {
  return PLANS[planId].modules.includes(moduleId);
}

export function getStripePriceId(planId: PlanId): string | null {
  const plan = PLANS[planId];
  if (!plan.stripePriceEnvKey) return null;
  const value = process.env[plan.stripePriceEnvKey];
  return value && value.length > 0 ? value : null;
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
