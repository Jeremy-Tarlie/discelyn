import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireUser,
  getUserSubscription,
  canUseProduct,
} from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { assertBotInGuild, assertUserManagesGuild } from "@/lib/discord";
import { getPlatformInviteUrl } from "@/lib/invite";
import { provisionBot, deprovisionBot } from "@/lib/provisioning";
import { rateLimit } from "@/lib/rate-limit";
import { trackEvent } from "@/lib/analytics";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function linkSchemaFor(locale: ReturnType<typeof getRequestLocale>) {
  return z.object({
    guildId: z
      .string()
      .trim()
      .regex(/^\d{17,20}$/, tApi(locale, "invalidGuildId")),
  });
}

/**
 * Lie un serveur Discord à une config Botly.
 * Exige que l'utilisateur OAuth administre le serveur (scope guilds).
 * Le bot peut être invité avant ou après le lien.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "bots-guild",
    limit: 5,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: tApi(locale, "unauthenticated") }, { status: 401 });
  }

  const subscription = await getUserSubscription(user.id);
  const usable = canUseProduct(subscription);
  if (!usable.ok) {
    return NextResponse.json(
      { error: tApi(locale, usable.code, usable.params) },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  const bot = await prisma.bot.findFirst({
    where: { id, userId: user.id },
  });

  if (!bot) {
    return NextResponse.json({ error: tApi(locale, "botNotFound") }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: tApi(locale, "invalidJson") }, { status: 400 });
  }

  const parsed = linkSchemaFor(locale).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? tApi(locale, "invalidData") },
      { status: 400 }
    );
  }

  const ownership = await assertUserManagesGuild(user.id, parsed.data.guildId);
  if (!ownership.ok) {
    const error =
      "code" in ownership
        ? tApi(locale, ownership.code)
        : ownership.error;
    return NextResponse.json({ error }, { status: 403 });
  }

  const conflict = await prisma.bot.findFirst({
    where: {
      guildId: parsed.data.guildId,
      NOT: { id: bot.id },
    },
    select: { id: true },
  });
  if (conflict) {
    return NextResponse.json(
      { error: tApi(locale, "guildAlreadyLinked") },
      { status: 409 }
    );
  }

  const membership = await assertBotInGuild(parsed.data.guildId);
  const botPresentInGuild = membership.ok;
  const inviteUrl = getPlatformInviteUrl(parsed.data.guildId);
  const guildLinkedMessage = tApi(locale, "guildLinked");

  await prisma.bot.update({
    where: { id: bot.id },
    data: {
      guildId: parsed.data.guildId,
      inviteUrl,
      status: botPresentInGuild ? "PROVISIONING" : "PENDING",
      lastError: botPresentInGuild ? null : guildLinkedMessage,
    },
  });

  const provision = await provisionBot({
    botId: bot.id,
    guildId: parsed.data.guildId,
    guildLinked: true,
    botPresentInGuild,
  });
  const finalBot = await prisma.bot.update({
    where: { id: bot.id },
    data: {
      status: provision.status,
      inviteUrl: provision.inviteUrl,
      lastError:
        provision.error ??
        (botPresentInGuild ? null : guildLinkedMessage),
    },
    select: {
      id: true,
      name: true,
      status: true,
      guildId: true,
      inviteUrl: true,
      lastError: true,
    },
  });

  await trackEvent({
    name: "guild_linked",
    userId: user.id,
    meta: { botId: bot.id, guildId: parsed.data.guildId },
  });

  return NextResponse.json({ bot: finalBot });
}

/** Délie le serveur et demande au runtime de quitter le guild. */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "bots-guild-unlink",
    limit: 10,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: tApi(locale, "unauthenticated") }, { status: 401 });
  }

  const { id } = await context.params;
  const bot = await prisma.bot.findFirst({
    where: { id, userId: user.id },
  });

  if (!bot) {
    return NextResponse.json({ error: tApi(locale, "botNotFound") }, { status: 404 });
  }

  if (!bot.guildId) {
    return NextResponse.json({ error: tApi(locale, "noGuildLinked") }, { status: 400 });
  }

  const guildId = bot.guildId;
  const inviteUrl = getPlatformInviteUrl();

  const updated = await prisma.bot.update({
    where: { id: bot.id },
    data: {
      guildId: null,
      status: "PENDING",
      inviteUrl,
      lastError: null,
    },
    select: {
      id: true,
      name: true,
      status: true,
      guildId: true,
      inviteUrl: true,
      lastError: true,
    },
  });

  await deprovisionBot(bot.id, guildId);

  return NextResponse.json({ bot: updated });
}
