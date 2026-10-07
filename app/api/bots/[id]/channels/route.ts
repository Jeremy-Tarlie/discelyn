import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireOrg, getOrgSubscription, canUseProduct } from "@/lib/access";
import { fetchGuildTextChannels } from "@/lib/discord";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";
import { deniedAuthResponse } from "@/lib/http-auth";

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

  const org = await requireOrg({ minRole: "MEMBER" });
  if (!org) {
    return deniedAuthResponse(locale);
  }

  const subscription = await getOrgSubscription(org.organizationId);
  const usable = canUseProduct(subscription);
  if (!usable.ok) {
    return NextResponse.json(
      { error: tApi(locale, usable.code, usable.params) },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  const bot = await prisma.bot.findFirst({
    where: { id, organizationId: org.organizationId, deletedAt: null },
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
