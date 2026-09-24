import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  requireUser,
  getUserSubscription,
  canUseProduct,
} from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getPlan, type PlanId } from "@/lib/plans";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const PREVIEW_LIMIT = 20;
const EXPORT_LIMIT = 5_000;

/**
 * Historique warns : preview (tous plans) ou export JSON complet (Starter+).
 * `?export=1` exige `plan.auditExport`.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "bots-audit",
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

  const plan = getPlan(subscription.plan as PlanId);
  const wantExport = request.nextUrl.searchParams.get("export") === "1";

  if (wantExport && !plan.auditExport) {
    return NextResponse.json(
      { error: tApi(locale, "auditExportUnavailable") },
      { status: 403 }
    );
  }

  const { id } = await context.params;
  const bot = await prisma.bot.findFirst({
    where: { id, userId: user.id },
    select: { id: true, name: true, guildId: true },
  });
  if (!bot) {
    return NextResponse.json(
      { error: tApi(locale, "botNotFound") },
      { status: 404 }
    );
  }

  const take = wantExport ? EXPORT_LIMIT : PREVIEW_LIMIT;
  const [warningCount, warnings] = await Promise.all([
    prisma.moderationWarning.count({ where: { botId: bot.id } }),
    prisma.moderationWarning.findMany({
      where: { botId: bot.id },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        guildId: true,
        targetUserId: true,
        reason: true,
        moderatorTag: true,
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    mode: wantExport ? "export" : "preview",
    exportAvailable: plan.auditExport,
    purpose: wantExport
      ? "Audit modération — export Starter+"
      : "Preview historique warns (20 derniers)",
    bot: {
      id: bot.id,
      name: bot.name,
      guildId: bot.guildId,
    },
    warningCount,
    warnings,
    previewLimit: wantExport ? null : PREVIEW_LIMIT,
  });
}
