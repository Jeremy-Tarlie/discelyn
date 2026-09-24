/** Miroir de lib/plans — parité testée. */
export type RuntimePlanId = "FREE" | "STARTER" | "OPS" | "SCALE";

export type RuntimePlanLimits = {
  maxGuilds: number;
  maxCustomCommands: number;
  forceBranding: boolean;
  modules: readonly string[];
};

const OPS_CORE = [
  "welcome",
  "roles",
  "moderation",
  "logs",
  "tickets",
  "custom_commands",
] as const;

export const RUNTIME_PLAN_LIMITS: Record<RuntimePlanId, RuntimePlanLimits> = {
  FREE: {
    maxGuilds: 1,
    maxCustomCommands: 5,
    forceBranding: false,
    modules: [...OPS_CORE],
  },
  STARTER: {
    maxGuilds: 1,
    maxCustomCommands: 15,
    forceBranding: false,
    modules: [...OPS_CORE],
  },
  OPS: {
    maxGuilds: 1,
    maxCustomCommands: 40,
    forceBranding: false,
    modules: [...OPS_CORE],
  },
  SCALE: {
    maxGuilds: 5,
    maxCustomCommands: 100,
    forceBranding: false,
    modules: [...OPS_CORE, "automod"],
  },
};

export function resolvePlanLimits(
  plan: string | null | undefined
): RuntimePlanLimits {
  if (plan && plan in RUNTIME_PLAN_LIMITS) {
    return RUNTIME_PLAN_LIMITS[plan as RuntimePlanId];
  }
  return RUNTIME_PLAN_LIMITS.FREE;
}

export function filterModulesForLimits(
  limits: RuntimePlanLimits,
  enabledModules: string[]
): string[] {
  const allowed = new Set(limits.modules);
  return enabledModules.filter((moduleId) => allowed.has(moduleId));
}

export function trimCustomCommands(
  limits: RuntimePlanLimits,
  commands: Array<{ name: string; response: string }>
): Array<{ name: string; response: string }> {
  if (!limits.modules.includes("custom_commands")) return [];
  if (commands.length <= limits.maxCustomCommands) return commands;
  return commands.slice(0, limits.maxCustomCommands);
}
