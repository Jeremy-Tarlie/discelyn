import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  requireUser,
  getUserSubscription,
  canUseProduct,
} from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { evaluateGuildHealth } from "@/lib/guild-health";
import { getPlatformInviteUrl } from "@/lib/invite";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "bots-health",
    limit: 30,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const user = await requireUser();
  if (!user) {
    return NextResponse.json(
      { error: tApi(locale, "unauthenticated") },
      { status: 401 }
    );
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
    select: {
      id: true,
      guildId: true,
      config: true,
      accessProducts: {
        where: { active: true },
        select: { discordRoleId: true },
        take: 20,
      },
    },
  });

  if (!bot) {
    return NextResponse.json(
      { error: tApi(locale, "botNotFound") },
      { status: 404 }
    );
  }

  const roleIds = [
    ...new Set(bot.accessProducts.map((p) => p.discordRoleId)),
  ];
  const checks = await evaluateGuildHealth({
    guildId: bot.guildId,
    botConfig: bot.config,
    productRoleIds: roleIds,
  });

  return NextResponse.json({
    guildId: bot.guildId,
    inviteUrl: getPlatformInviteUrl(bot.guildId ?? undefined),
    checks,
  });
}
