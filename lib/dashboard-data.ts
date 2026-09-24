import type {
  LearnerAccessSource,
  LearnerAccessStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { affiliateRefUrl, claimUrl } from "@/lib/learner-access";
import { unsealToken } from "@/lib/token-crypto";

export type AccessStatsData = {
  periodDays: number;
  paid: number;
  claimed: number;
  active: number;
  pending: number;
  revoked: number;
  refunds: number;
  oversold: number;
  gmvCents: number;
  conversionPaidToClaimed: number;
  recurringActiveApprox: number;
  products: Array<{
    id: string;
    name: string;
    billingMode: string;
    maxSeats: number | null;
    seatsUsed: number;
    paymentLinkUrl: string | null;
    soldOut: boolean;
  }>;
  oversoldEvents: Array<{
    id: string;
    productName: string;
    customerEmail: string | null;
    amountTotal: number | null;
    currency: string | null;
    refundStatus: string;
    createdAt: string;
  }>;
};

export async function getAccessStatsForUser(
  userId: string,
  days = 30
): Promise<AccessStatsData> {
  const periodDays = Math.min(Math.max(days, 1), 365);
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
  const baseWhere = { bot: { userId }, createdAt: { gte: since } };

  const [
    paid,
    active,
    pending,
    revoked,
    gmvAgg,
    refundEvents,
    products,
    oversoldCount,
    oversoldRecent,
    claimed,
    recurringActive,
  ] = await Promise.all([
    prisma.learnerAccess.count({ where: baseWhere }),
    prisma.learnerAccess.count({
      where: { bot: { userId }, status: "ACTIVE" },
    }),
    prisma.learnerAccess.count({
      where: {
        bot: { userId },
        status: { in: ["PENDING_CLAIM", "AWAITING_JOIN"] },
      },
    }),
    prisma.learnerAccess.count({
      where: {
        bot: { userId },
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
        access: { bot: { userId } },
        meta: { path: ["reason"], equals: "refund" },
      },
    }),
    prisma.accessProduct.findMany({
      where: { userId, active: true },
      select: {
        id: true,
        name: true,
        billingMode: true,
        maxSeats: true,
        seatsUsed: true,
        paymentLinkUrl: true,
      },
    }),
    prisma.accessOversoldEvent.count({
      where: { userId, createdAt: { gte: since } },
    }),
    prisma.accessOversoldEvent.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        customerEmail: true,
        amountTotal: true,
        currency: true,
        refundStatus: true,
        createdAt: true,
        product: { select: { name: true } },
      },
    }),
    prisma.learnerAccess.count({
      where: {
        bot: { userId },
        createdAt: { gte: since },
        status: { in: ["ACTIVE", "AWAITING_JOIN", "REVOKED", "EXPIRED"] },
        grantedAt: { not: null },
      },
    }),
    prisma.learnerAccess.count({
      where: {
        bot: { userId },
        status: "ACTIVE",
        product: { billingMode: "RECURRING" },
        stripeSubscriptionId: { not: null },
      },
    }),
  ]);

  return {
    periodDays,
    paid,
    claimed,
    active,
    pending,
    revoked,
    refunds: refundEvents,
    oversold: oversoldCount,
    gmvCents: gmvAgg._sum.amountTotal ?? 0,
    conversionPaidToClaimed:
      paid > 0 ? Math.round((claimed / paid) * 1000) / 10 : 0,
    recurringActiveApprox: recurringActive,
    products: products.map((p) => ({
      ...p,
      soldOut: p.maxSeats != null && p.seatsUsed >= p.maxSeats,
    })),
    oversoldEvents: oversoldRecent.map((e) => ({
      id: e.id,
      productName: e.product.name,
      customerEmail: e.customerEmail,
      amountTotal: e.amountTotal,
      currency: e.currency,
      refundStatus: e.refundStatus,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

export type DashboardLearner = {
  id: string;
  status: string;
  source: string;
  customerEmail: string | null;
  discordUserId: string | null;
  amountTotal: number | null;
  currency: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  claimUrl: string | null;
  claimReminderCount: number;
  grantedAt: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
  createdAt: string;
  product: {
    id: string;
    name: string;
    billingMode: string;
  };
  affiliate: { id: string; code: string; label: string } | null;
  accessEndsAt: string | null;
};

export async function listLearnersForUser(
  userId: string,
  filters: {
    status?: string | null;
    productId?: string | null;
    q?: string | null;
    source?: string | null;
    take?: number;
  } = {}
): Promise<DashboardLearner[]> {
  const where = {
    bot: { userId },
    ...(filters.status
      ? { status: filters.status as LearnerAccessStatus }
      : {}),
    ...(filters.productId ? { accessProductId: filters.productId } : {}),
    ...(filters.source
      ? { source: filters.source as LearnerAccessSource }
      : {}),
    ...(filters.q
      ? {
          OR: [
            {
              customerEmail: {
                contains: filters.q,
                mode: "insensitive" as const,
              },
            },
            { discordUserId: { contains: filters.q } },
          ],
        }
      : {}),
  };

  const rows = await prisma.learnerAccess.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: filters.take ?? 100,
    include: {
      product: {
        select: {
          id: true,
          name: true,
          accessEndsAt: true,
          billingMode: true,
        },
      },
      affiliate: { select: { id: true, code: true, label: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    source: row.source,
    customerEmail: row.customerEmail,
    discordUserId: row.discordUserId,
    amountTotal: row.amountTotal,
    currency: row.currency,
    stripeCustomerId: row.stripeCustomerId,
    stripeSubscriptionId: row.stripeSubscriptionId,
    claimUrl: row.claimToken ? claimUrl(row.claimToken) : null,
    claimReminderCount: row.claimReminderCount,
    grantedAt: row.grantedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    revokeReason: row.revokeReason,
    createdAt: row.createdAt.toISOString(),
    product: {
      id: row.product.id,
      name: row.product.name,
      billingMode: row.product.billingMode,
    },
    affiliate: row.affiliate,
    accessEndsAt: row.product.accessEndsAt?.toISOString() ?? null,
  }));
}

export type DashboardAffiliate = {
  id: string;
  code: string;
  label: string;
  commissionBps: number;
  refUrl: string;
  clicks: number;
  paid: number;
  claimed: number;
  createdAt: string;
};

export async function listAffiliatesForUser(
  userId: string
): Promise<DashboardAffiliate[]> {
  const affiliates = await prisma.affiliate.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return Promise.all(
    affiliates.map(async (aff) => {
      const [clicks, paid, claimed] = await Promise.all([
        prisma.affiliateClick.count({ where: { affiliateId: aff.id } }),
        prisma.learnerAccess.count({ where: { affiliateId: aff.id } }),
        prisma.learnerAccess.count({
          where: {
            affiliateId: aff.id,
            status: { in: ["ACTIVE", "AWAITING_JOIN"] },
          },
        }),
      ]);
      return {
        id: aff.id,
        code: aff.code,
        label: aff.label,
        commissionBps: aff.commissionBps,
        refUrl: affiliateRefUrl(aff.code),
        clicks,
        paid,
        claimed,
        createdAt: aff.createdAt.toISOString(),
      };
    })
  );
}

export type DashboardWebhook = {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  secret: string;
  createdAt: string;
};

export async function listOutboundWebhooksForUser(
  userId: string
): Promise<DashboardWebhook[]> {
  const webhooks = await prisma.orgOutboundWebhook.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      url: true,
      events: true,
      active: true,
      secret: true,
      createdAt: true,
    },
  });

  return webhooks.map((w) => ({
    id: w.id,
    url: w.url,
    events: w.events,
    active: w.active,
    secret: unsealToken(w.secret) ?? w.secret,
    createdAt: w.createdAt.toISOString(),
  }));
}
