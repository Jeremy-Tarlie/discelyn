import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  requireUser,
  getUserSubscription,
  canCreateBot,
} from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { provisionBot } from "@/lib/provisioning";
import type { PlanId } from "@/lib/plans";
import { createBotSchemaFor } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { getPlatformInviteUrl } from "@/lib/invite";
import { trackEvent } from "@/lib/analytics";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";

export async function GET(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "bots-list",
    limit: 60,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: tApi(locale, "unauthenticated") }, { status: 401 });
  }

  const bots = await prisma.bot.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      guildId: true,
      inviteUrl: true,
      enabledModules: true,
      lastError: true,
      lastSeenAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ bots });
}

export async function POST(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "bots-create",
    limit: 10,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: tApi(locale, "unauthenticated") }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: tApi(locale, "invalidJson") }, { status: 400 });
  }

  const parsed = createBotSchemaFor(locale).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? tApi(locale, "invalidData") },
      { status: 400 }
    );
  }

  const subscription = await getUserSubscription(user.id);
  const botCount = await prisma.bot.count({ where: { userId: user.id } });
  const limit = canCreateBot(subscription, botCount);
  if (!limit.ok) {
    return NextResponse.json(
      { error: tApi(locale, limit.code, limit.params) },
      { status: 403 }
    );
  }

  const inviteUrl = getPlatformInviteUrl();

  const bot = await prisma.bot.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      status: "PENDING",
      enabledModules: [
        "welcome",
        "tickets",
        "moderation",
        "roles",
        "logs",
        "custom_commands",
      ],
      inviteUrl,
    },
  });

  const provision = await provisionBot({
    botId: bot.id,
    guildLinked: false,
    botPresentInGuild: false,
  });

  const updated = await prisma.bot.update({
    where: { id: bot.id },
    data: {
      status: provision.status,
      inviteUrl: provision.inviteUrl,
      lastError: provision.error,
    },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      guildId: true,
      inviteUrl: true,
      enabledModules: true,
      lastError: true,
      createdAt: true,
    },
  });

  await trackEvent({
    name: "bot_created",
    userId: user.id,
    meta: { botId: bot.id },
  });

  return NextResponse.json({
    bot: updated,
    plan: subscription.plan as PlanId,
  });
}
