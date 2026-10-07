import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireOrg } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { listGuildRoles } from "@/lib/discord-roles";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";
import { rateLimit } from "@/lib/rate-limit";
import { deniedAuthResponse } from "@/lib/http-auth";

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

  const org = await requireOrg({ minRole: "MEMBER" });
  if (!org) {
    return deniedAuthResponse(locale);
  }

  const { id: botId } = await context.params;
  const bot = await prisma.bot.findFirst({
    where: { id: botId, organizationId: org.organizationId, deletedAt: null },
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
