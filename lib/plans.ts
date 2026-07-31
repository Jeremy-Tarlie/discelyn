export type PlanId = "FREE" | "STARTER" | "PRO" | "BUSINESS";

export type BotModuleId =
  | "welcome"
  | "roles"
  | "moderation"
  | "logs"
  | "tickets"
  | "automod"
  | "custom_commands";

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
  highlighted?: boolean;
  stripePriceEnvKey: string | null;
};

export const PLANS: Record<PlanId, PlanDefinition> = {
  FREE: {
    id: "FREE",
    name: "Free",
    priceMonthlyEur: 0,
    description: "Pour tester Botly sur un serveur.",
    maxBots: 1,
    maxGuilds: 1,
    maxCustomCommands: 0,
    modules: ["welcome"],
    forceBranding: true,
    prioritySupport: false,
    stripePriceEnvKey: null,
  },
  STARTER: {
    id: "STARTER",
    name: "Starter",
    priceMonthlyEur: 2.99,
    description: "Modération légère et rôles automatiques.",
    maxBots: 1,
    maxGuilds: 1,
    maxCustomCommands: 3,
    modules: ["welcome", "roles", "moderation", "custom_commands"],
    forceBranding: false,
    prioritySupport: false,
    stripePriceEnvKey: "STRIPE_PRICE_STARTER",
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    priceMonthlyEur: 6.99,
    description: "Logs, tickets et plus de custom.",
    maxBots: 2,
    maxGuilds: 3,
    maxCustomCommands: 15,
    modules: [
      "welcome",
      "roles",
      "moderation",
      "logs",
      "tickets",
      "custom_commands",
    ],
    forceBranding: false,
    prioritySupport: false,
    highlighted: true,
    stripePriceEnvKey: "STRIPE_PRICE_PRO",
  },
  BUSINESS: {
    id: "BUSINESS",
    name: "Business",
    priceMonthlyEur: 12.99,
    description: "Automod, multi-bots et support prioritaire.",
    maxBots: 5,
    maxGuilds: 10,
    maxCustomCommands: 100,
    modules: [
      "welcome",
      "roles",
      "moderation",
      "logs",
      "tickets",
      "automod",
      "custom_commands",
    ],
    forceBranding: false,
    prioritySupport: true,
    stripePriceEnvKey: "STRIPE_PRICE_BUSINESS",
  },
};

export const MODULE_CATALOG: Record<
  BotModuleId,
  { label: string; description: string }
> = {
  welcome: {
    label: "Welcome",
    description: "Message et rôle à l'arrivée d'un membre.",
  },
  roles: {
    label: "Rôles auto",
    description: "Attribution de rôles via réactions ou règles.",
  },
  moderation: {
    label: "Modération",
    description: "Kick, ban, mute et warnings.",
  },
  logs: {
    label: "Logs",
    description: "Journal des actions serveur dans un salon.",
  },
  tickets: {
    label: "Tickets",
    description: "Support privé par salon temporaire.",
  },
  automod: {
    label: "Automod",
    description: "Filtres spam, liens et mots interdits.",
  },
  custom_commands: {
    label: "Commandes custom",
    description: "Réponses slash personnalisées.",
  },
};

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
