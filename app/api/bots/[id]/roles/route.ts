import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { listGuildRoles } from "@/lib/discord-roles";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "bot-roles",
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

  const { id: botId } = await context.params;
  const bot = await prisma.bot.findFirst({
    where: { id: botId, userId: user.id },
    select: { guildId: true },
  });
  if (!bot) {
    return NextResponse.json(
      { error: tApi(locale, "botNotFound") },
      { status: 404 }
    );
  }
  if (!bot.guildId) {
    return NextResponse.json(
      { error: tApi(locale, "noGuildOnConfig") },
      { status: 400 }
    );
  }

  const roles = await listGuildRoles(bot.guildId);
  if (!roles) {
    return NextResponse.json(
      { error: tApi(locale, "discordRolesUnavailable") },
      { status: 502 }
    );
  }

  return NextResponse.json({ roles });
}
