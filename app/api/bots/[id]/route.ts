import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import {
  requireUser,
  getUserSubscription,
  filterModulesForPlan,
  canUseProduct,
} from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getPlan, type PlanId, type BotModuleId } from "@/lib/plans";
import { deprovisionBot } from "@/lib/provisioning";
import { rateLimit } from "@/lib/rate-limit";
import { notifyRuntimeReload } from "@/lib/runtime-notify";

const updateBotSchema = z.object({
  name: z.string().trim().min(2).max(32).optional(),
  description: z.string().trim().max(300).nullable().optional(),
  enabledModules: z.array(z.string()).max(20).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  customCommands: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(32),
        response: z.string().trim().min(1).max(500),
      })
    )
    .optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const limited = rateLimit(request, {
    namespace: "bots-get",
    limit: 60,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await context.params;
  const bot = await prisma.bot.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      hasToken: true,
      inviteUrl: true,
      discordAppId: true,
      enabledModules: true,
      config: true,
      customCommands: true,
      lastError: true,
      lastSeenAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!bot) {
    return NextResponse.json({ error: "Bot introuvable" }, { status: 404 });
  }

  const subscription = await getUserSubscription(user.id);
  return NextResponse.json({
    bot,
    plan: getPlan(subscription.plan as PlanId),
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const limited = rateLimit(request, {
    namespace: "bots-patch",
    limit: 30,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await context.params;
  const bot = await prisma.bot.findFirst({
    where: { id, userId: user.id },
  });

  if (!bot) {
    return NextResponse.json({ error: "Bot introuvable" }, { status: 404 });
  }

  const subscription = await getUserSubscription(user.id);
  const usable = canUseProduct(subscription);
  if (!usable.ok) {
    return NextResponse.json({ error: usable.reason }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = updateBotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides" },
      { status: 400 }
    );
  }

  const planId = subscription.plan as PlanId;
  const plan = getPlan(planId);

  let enabledModules = bot.enabledModules;
  if (parsed.data.enabledModules) {
    enabledModules = filterModulesForPlan(planId, parsed.data.enabledModules);
  }

  let customCommands: Prisma.InputJsonValue =
    bot.customCommands === null
      ? []
      : (bot.customCommands as Prisma.InputJsonValue);

  if (parsed.data.customCommands) {
    if (parsed.data.customCommands.length > plan.maxCustomCommands) {
      return NextResponse.json(
        {
          error: `Max ${plan.maxCustomCommands} commandes custom sur le plan ${plan.name}.`,
        },
        { status: 403 }
      );
    }
    if (
      parsed.data.customCommands.length > 0 &&
      !plan.modules.includes("custom_commands" as BotModuleId)
    ) {
      return NextResponse.json(
        { error: "Commandes custom non disponibles sur ton plan." },
        { status: 403 }
      );
    }
    customCommands = parsed.data.customCommands;
  }

  const data: Prisma.BotUpdateInput = {
    name: parsed.data.name ?? bot.name,
    description:
      parsed.data.description === undefined
        ? bot.description
        : parsed.data.description,
    enabledModules,
    customCommands,
  };

  if (parsed.data.config) {
    data.config = parsed.data.config as Prisma.InputJsonValue;
  }

  const updated = await prisma.bot.update({
    where: { id: bot.id },
    data,
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      hasToken: true,
      inviteUrl: true,
      discordAppId: true,
      enabledModules: true,
      config: true,
      customCommands: true,
      lastError: true,
      updatedAt: true,
    },
  });

  await notifyRuntimeReload(bot.id);

  return NextResponse.json({ bot: updated, plan });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const limited = rateLimit(request, {
    namespace: "bots-delete",
    limit: 10,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await context.params;
  const bot = await prisma.bot.findFirst({
    where: { id, userId: user.id },
  });

  if (!bot) {
    return NextResponse.json({ error: "Bot introuvable" }, { status: 404 });
  }

  await deprovisionBot(bot.id);
  await prisma.bot.delete({ where: { id: bot.id } });
  return NextResponse.json({ ok: true });
}
