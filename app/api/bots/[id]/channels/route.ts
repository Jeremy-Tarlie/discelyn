import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireUser, getUserSubscription, canUseProduct } from "@/lib/access";
import { fetchGuildTextChannels } from "@/lib/discord";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Salons textuels du serveur lié (bot plateforme présent requis). */
export async function GET(request: NextRequest, context: RouteContext) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "bots-channels",
    limit: 30,
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
    select: { id: true, guildId: true },
  });

  if (!bot) {
    return NextResponse.json({ error: tApi(locale, "botNotFound") }, { status: 404 });
  }
  if (!bot.guildId) {
    return NextResponse.json(
      { error: tApi(locale, "noGuildOnConfig") },
      { status: 400 }
    );
  }

  const result = await fetchGuildTextChannels(bot.guildId);
  if (!result.ok) {
    const error =
      "code" in result ? tApi(locale, result.code) : result.error;
    return NextResponse.json({ error }, { status: 403 });
  }

  return NextResponse.json({ channels: result.channels });
}
