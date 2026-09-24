import { prisma } from "@/lib/prisma";
import { getPlan, type PlanId } from "@/lib/plans";
import { filterModulesForPlan } from "@/lib/billing-guards";
import { notifyRuntimeStop } from "@/lib/runtime-notify";

type CustomCommand = { name: string; response: string };

function parseCustomCommands(value: unknown): CustomCommand[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is CustomCommand => {
    if (typeof item !== "object" || item === null) return false;
    const record = item as Record<string, unknown>;
    return typeof record.name === "string" && typeof record.response === "string";
  });
}

/**
 * Applique les plafonds du plan : pause/délie les configs en trop,
 * reprend les configs dans le quota (guild encore liée),
 * trim modules et commandes custom sur les configs restantes.
 */
export async function enforcePlanLimits(
  userId: string,
  planId: PlanId
): Promise<void> {
  const plan = getPlan(planId);
  const bots = await prisma.bot.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  for (let index = 0; index < bots.length; index += 1) {
    const bot = bots[index];
    if (!bot) continue;

    if (index >= plan.maxBots) {
      const guildId = bot.guildId;
      await prisma.bot.update({
        where: { id: bot.id },
        data: {
          status: "PAUSED",
          guildId: null,
          lastError: `Limite plan ${plan.name} dépassée (${plan.maxBots} serveur${plan.maxBots > 1 ? "s" : ""}).`,
        },
      });
      await notifyRuntimeStop(bot.id, guildId);
      continue;
    }

    const enabledModules = filterModulesForPlan(planId, bot.enabledModules);
    let customCommands = parseCustomCommands(bot.customCommands);
    if (!plan.modules.includes("custom_commands")) {
      customCommands = [];
    } else if (customCommands.length > plan.maxCustomCommands) {
      customCommands = customCommands.slice(0, plan.maxCustomCommands);
    }

    const modulesChanged =
      enabledModules.length !== bot.enabledModules.length ||
      enabledModules.some((id, i) => id !== bot.enabledModules[i]);
    const previousCommands = parseCustomCommands(bot.customCommands);
    const commandsChanged =
      customCommands.length !== previousCommands.length ||
      customCommands.some(
        (cmd, i) =>
          cmd.name !== previousCommands[i]?.name ||
          cmd.response !== previousCommands[i]?.response
      );

    // Reprise après PAST_DUE / limite : le runtime remontera ONLINE au sync.
    const shouldResume = bot.status === "PAUSED" && bot.guildId !== null;

    if (modulesChanged || commandsChanged || shouldResume) {
      await prisma.bot.update({
        where: { id: bot.id },
        data: {
          enabledModules,
          customCommands,
          ...(shouldResume
            ? { status: "PENDING" as const, lastError: null }
            : modulesChanged || commandsChanged
              ? { lastError: `Config ajustée au plan ${plan.name}.` }
              : {}),
        },
      });
    }
  }
}
