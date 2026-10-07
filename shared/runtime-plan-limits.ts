/**
 * Source unique des limites runtime (guilds / commandes / modules).
 * Consommée par `lib/plans.ts` (web) et `bot-runtime/src/plan-limits.ts`.
 */

export type RuntimePlanId = "FREE" | "STARTER" | "OPS" | "SCALE";

export type RuntimeBotModuleId =
  | "welcome"
  | "roles"
  | "moderation"
  | "logs"
  | "tickets"
  | "automod"
  | "custom_commands";

export type RuntimePlanLimits = {
  maxGuilds: number;
  maxCustomCommands: number;
  modules: readonly RuntimeBotModuleId[];
};

const OPS_CORE = [
  "welcome",
  "roles",
  "moderation",
  "logs",
  "tickets",
  "custom_commands",
] as const satisfies readonly RuntimeBotModuleId[];

export const RUNTIME_PLAN_LIMITS: Record<RuntimePlanId, RuntimePlanLimits> = {
  FREE: {
    maxGuilds: 1,
    maxCustomCommands: 5,
    modules: [...OPS_CORE],
  },
  STARTER: {
    maxGuilds: 1,
    maxCustomCommands: 15,
    modules: [...OPS_CORE],
  },
  OPS: {
    maxGuilds: 1,
    maxCustomCommands: 40,
    modules: [...OPS_CORE],
  },
  SCALE: {
    maxGuilds: 5,
    maxCustomCommands: 100,
    modules: [...OPS_CORE, "automod"],
  },
};
