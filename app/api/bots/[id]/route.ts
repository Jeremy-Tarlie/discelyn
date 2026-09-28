import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import {
  requireOrg,
  getOrgSubscription,
  filterModulesForPlan,
  canUseProduct,
} from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getPlan, type PlanId, type BotModuleId } from "@/lib/plans";
import { softDeleteBot } from "@/lib/soft-delete-ops";
import { rateLimit } from "@/lib/rate-limit";
import { notifyRuntimeReload } from "@/lib/runtime-notify";
import { parseBotConfig } from "@/lib/bot-config";
import { sanitizeBotConfig, updateBotSchemaFor } from "@/lib/validation";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "bots-get",
    limit: 60,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const org = await requireOrg({ minRole: "MEMBER" });
  if (!org) {
    return NextResponse.json({ error: tApi(locale, "unauthenticated") }, { status: 401 });
  }

  const { id } = await context.params;
  const bot = await prisma.bot.findFirst({
    where: { id, organizationId: org.organizationId, deletedAt: null },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      guildId: true,
      inviteUrl: true,
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
    return NextResponse.json({ error: tApi(locale, "botNotFound") }, { status: 404 });
  }

  const subscription = await getOrgSubscription(org.organizationId);
  return NextResponse.json({
    bot,
    plan: getPlan(subscription.plan as PlanId),
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "bots-patch",
    limit: 30,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const org = await requireOrg({ minRole: "ADMIN" });
  if (!org) {
    return NextResponse.json({ error: tApi(locale, "unauthenticated") }, { status: 401 });
  }

  const { id } = await context.params;
  const bot = await prisma.bot.findFirst({
    where: { id, organizationId: org.organizationId, deletedAt: null },
  });

  if (!bot) {
    return NextResponse.json({ error: tApi(locale, "botNotFound") }, { status: 404 });
  }

  const subscription = await getOrgSubscription(org.organizationId);
  const usable = canUseProduct(subscription);
  if (!usable.ok) {
    return NextResponse.json(
      { error: tApi(locale, usable.code, usable.params) },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: tApi(locale, "invalidJson") }, { status: 400 });
  }

  const parsed = updateBotSchemaFor(locale).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? tApi(locale, "invalidData") },
      { status: 400 }
    );
  }

  const planId = subscription.plan as PlanId;
  const plan = getPlan(planId);

  const enabledModules = filterModulesForPlan(
    planId,
    parsed.data.enabledModules ?? bot.enabledModules
  );

  let customCommands: Prisma.InputJsonValue =
    bot.customCommands === null
      ? []
      : (bot.customCommands as Prisma.InputJsonValue);

  if (parsed.data.customCommands) {
    if (parsed.data.customCommands.length > plan.maxCustomCommands) {
      return NextResponse.json(
        {
          error: tApi(locale, "customCommandsMax", {
            n: plan.maxCustomCommands,
            plan: plan.name,
          }),
        },
        { status: 403 }
      );
    }
    if (
      parsed.data.customCommands.length > 0 &&
      !plan.modules.includes("custom_commands" as BotModuleId)
    ) {
      return NextResponse.json(
        { error: tApi(locale, "customCommandsUnavailable") },
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
    const existing = parseBotConfig(bot.config);
    const merged = {
      ...existing,
      ...parsed.data.config,
    };
    data.config = sanitizeBotConfig(merged) as Prisma.InputJsonValue;
  }

  const updated = await prisma.bot.update({
    where: { id: bot.id },
    data,
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      guildId: true,
      inviteUrl: true,
      enabledModules: true,
      config: true,
      customCommands: true,
      lastError: true,
      updatedAt: true,
    },
  });

  await notifyRuntimeReload({ botId: bot.id });

  return NextResponse.json({ bot: updated, plan });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "bots-delete",
    limit: 10,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const org = await requireOrg({ minRole: "OWNER" });
  if (!org) {
    return NextResponse.json({ error: tApi(locale, "unauthenticated") }, { status: 401 });
  }

  const { id } = await context.params;
  const bot = await prisma.bot.findFirst({
    where: { id, organizationId: org.organizationId, deletedAt: null },
  });

  if (!bot) {
    return NextResponse.json({ error: tApi(locale, "botNotFound") }, { status: 404 });
  }

  await softDeleteBot({
    botId: bot.id,
    guildId: bot.guildId,
    revokeReason: "bot_deleted",
  });
  return NextResponse.json({ ok: true });
}
