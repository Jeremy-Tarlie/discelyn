import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "access-stats",
    limit: 60,
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

  const days = Number(request.nextUrl.searchParams.get("days") ?? "30");
  const since = new Date(
    Date.now() - Math.min(Math.max(days, 1), 365) * 24 * 60 * 60 * 1000
  );

  const baseWhere = { bot: { userId: user.id }, createdAt: { gte: since } };

  const [
    paid,
    active,
    pending,
    revoked,
    gmvAgg,
    refundEvents,
    products,
  ] = await Promise.all([
    prisma.learnerAccess.count({ where: baseWhere }),
    prisma.learnerAccess.count({
      where: { bot: { userId: user.id }, status: "ACTIVE" },
    }),
    prisma.learnerAccess.count({
      where: {
        bot: { userId: user.id },
        status: { in: ["PENDING_CLAIM", "AWAITING_JOIN"] },
      },
    }),
    prisma.learnerAccess.count({
      where: {
        bot: { userId: user.id },
        status: { in: ["REVOKED", "EXPIRED"] },
        createdAt: { gte: since },
      },
    }),
    prisma.learnerAccess.aggregate({
      where: { ...baseWhere, amountTotal: { not: null } },
      _sum: { amountTotal: true },
    }),
    prisma.learnerAccessEvent.count({
      where: {
        type: "access_revoked",
        createdAt: { gte: since },
        access: { bot: { userId: user.id } },
        meta: { path: ["reason"], equals: "refund" },
      },
    }),
    prisma.accessProduct.findMany({
      where: { userId: user.id, active: true },
      select: {
        id: true,
        name: true,
        billingMode: true,
        maxSeats: true,
        seatsUsed: true,
        paymentLinkUrl: true,
      },
    }),
  ]);

  const claimed = await prisma.learnerAccess.count({
    where: {
      bot: { userId: user.id },
      createdAt: { gte: since },
      status: { in: ["ACTIVE", "AWAITING_JOIN", "REVOKED", "EXPIRED"] },
      grantedAt: { not: null },
    },
  });

  const recurringActive = await prisma.learnerAccess.count({
    where: {
      bot: { userId: user.id },
      status: "ACTIVE",
      product: { billingMode: "RECURRING" },
      stripeSubscriptionId: { not: null },
    },
  });

  const conversionPaidToClaimed =
    paid > 0 ? Math.round((claimed / paid) * 1000) / 10 : 0;

  return NextResponse.json({
    periodDays: days,
    paid,
    claimed,
    active,
    pending,
    revoked,
    refunds: refundEvents,
    gmvCents: gmvAgg._sum.amountTotal ?? 0,
    conversionPaidToClaimed,
    recurringActiveApprox: recurringActive,
    products: products.map((p) => ({
      ...p,
      soldOut: p.maxSeats != null && p.seatsUsed >= p.maxSeats,
    })),
  });
}
