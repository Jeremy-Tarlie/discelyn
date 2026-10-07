/**
 * Limites plan côté runtime — données dans `shared/runtime-plan-limits.ts`.
 */
export {
  RUNTIME_PLAN_LIMITS,
  type RuntimePlanId,
  type RuntimePlanLimits,
} from "../../shared/runtime-plan-limits.js";

import {
  RUNTIME_PLAN_LIMITS,
  type RuntimePlanId,
  type RuntimePlanLimits,
} from "../../shared/runtime-plan-limits.js";

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
  const allowed = new Set<string>(limits.modules);
  return enabledModules.filter((moduleId) => allowed.has(moduleId));
}

export function trimCustomCommands(
  limits: RuntimePlanLimits,
  commands: Array<{ name: string; response: string }>
): Array<{ name: string; response: string }> {
  const hasCustomCommands = limits.modules.some(
    (moduleId) => moduleId === "custom_commands"
  );
  if (!hasCustomCommands) return [];
  if (commands.length <= limits.maxCustomCommands) return commands;
  return commands.slice(0, limits.maxCustomCommands);
}
