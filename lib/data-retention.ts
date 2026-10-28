import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const DELETE_BATCH_SIZE = 1000;

async function batchedDeleteByIds(
  findIds: () => Promise<string[]>,
  deleteIds: (ids: string[]) => Promise<number>
): Promise<number> {
  let total = 0;
  for (;;) {
    const ids = await findIds();
    if (ids.length === 0) break;
    total += await deleteIds(ids);
    if (ids.length < DELETE_BATCH_SIZE) break;
  }
  return total;
}

/** Rétention analytics produit : 24 mois. */
export const ANALYTICS_RETENTION_DAYS = 730;

export function analyticsCutoff(now = new Date()): Date {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - ANALYTICS_RETENTION_DAYS);
  return d;
}

export async function purgeExpiredAnalyticsEvents(
  now = new Date()
): Promise<number> {
  const cutoff = analyticsCutoff(now);
  return batchedDeleteByIds(
    async () => {
      const rows = await prisma.analyticsEvent.findMany({
        where: { createdAt: { lt: cutoff } },
        select: { id: true },
        take: DELETE_BATCH_SIZE,
        orderBy: { createdAt: "asc" },
      });
      return rows.map((r) => r.id);
    },
    async (ids) => {
      const result = await prisma.analyticsEvent.deleteMany({
        where: { id: { in: ids } },
      });
      return result.count;
    }
  );
}

/** Rétention leads commerciaux : 24 mois. */
export const LEAD_RETENTION_DAYS = 730;

export function leadCutoff(now = new Date()): Date {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - LEAD_RETENTION_DAYS);
  return d;
}

export async function purgeExpiredLeads(now = new Date()): Promise<number> {
  const cutoff = leadCutoff(now);
  return batchedDeleteByIds(
    async () => {
      const rows = await prisma.lead.findMany({
        where: { createdAt: { lt: cutoff } },
        select: { id: true },
        take: DELETE_BATCH_SIZE,
        orderBy: { createdAt: "asc" },
      });
      return rows.map((r) => r.id);
    },
    async (ids) => {
      const result = await prisma.lead.deleteMany({
        where: { id: { in: ids } },
      });
      return result.count;
    }
  );
}

/** Rétention journal consentements cookies : 24 mois. */
export const COOKIE_CONSENT_RETENTION_DAYS = 730;

export function cookieConsentCutoff(now = new Date()): Date {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - COOKIE_CONSENT_RETENTION_DAYS);
  return d;
}

export async function purgeExpiredCookieConsents(
  now = new Date()
): Promise<number> {
  const cutoff = cookieConsentCutoff(now);
  return batchedDeleteByIds(
    async () => {
      const rows = await prisma.cookieConsentLog.findMany({
        where: { createdAt: { lt: cutoff } },
        select: { id: true },
        take: DELETE_BATCH_SIZE,
        orderBy: { createdAt: "asc" },
      });
      return rows.map((r) => r.id);
    },
    async (ids) => {
      const result = await prisma.cookieConsentLog.deleteMany({
        where: { id: { in: ids } },
      });
      return result.count;
    }
  );
}

/**
 * Anonymisation PII apprenants après révocation / expiration.
 * Soft-delete orga anonymise immédiatement (voir softDeleteOrganization).
 */
export const LEARNER_PII_RETENTION_DAYS = 365;

export function learnerPiiCutoff(now = new Date()): Date {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - LEARNER_PII_RETENTION_DAYS);
  return d;
}

export const LEARNER_PII_NULL = {
  customerEmail: null,
  discordUserId: null,
  claimToken: null,
  claimTokenExpiresAt: null,
  stripeCustomerId: null,
  stripeCheckoutSessionId: null,
  stripePaymentIntentId: null,
  stripeSubscriptionId: null,
  inviteUrl: null,
} as const;

const LEARNER_PII_PRESENT_OR = [
  { customerEmail: { not: null } },
  { discordUserId: { not: null } },
  { claimToken: { not: null } },
  { inviteUrl: { not: null } },
  { stripeCustomerId: { not: null } },
  { stripeCheckoutSessionId: { not: null } },
  { stripePaymentIntentId: { not: null } },
  { stripeSubscriptionId: { not: null } },
] as const;

export async function anonymizeExpiredLearnerPii(
  now = new Date()
): Promise<number> {
  const cutoff = learnerPiiCutoff(now);
  let total = 0;

  for (;;) {
    // REVOKED/EXPIRED après TTL + ACTIVE dont accessEndsAt dépassé depuis TTL
    // (accès contractuel terminé non encore basculé EXPIRED).
    const candidates = await prisma.learnerAccess.findMany({
      where: {
        AND: [
          { OR: [...LEARNER_PII_PRESENT_OR] },
          {
            OR: [
              {
                AND: [
                  { status: { in: ["REVOKED", "EXPIRED"] } },
                  {
                    OR: [
                      { revokedAt: { lt: cutoff } },
                      {
                        AND: [
                          { revokedAt: null },
                          { updatedAt: { lt: cutoff } },
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                AND: [
                  { status: "ACTIVE" },
                  { product: { accessEndsAt: { lt: cutoff } } },
                ],
              },
            ],
          },
        ],
      },
      select: { id: true },
      take: DELETE_BATCH_SIZE,
    });

    if (candidates.length === 0) break;

    const ids = candidates.map((c) => c.id);
    const result = await prisma.learnerAccess.updateMany({
      where: { id: { in: ids } },
      data: LEARNER_PII_NULL,
    });
    total += result.count;

    await prisma.learnerAccessEvent.updateMany({
      where: { learnerAccessId: { in: ids } },
      data: { meta: Prisma.DbNull },
    });

    if (candidates.length < DELETE_BATCH_SIZE) break;
  }

  await anonymizeExpiredOversoldEmails(now);

  return total;
}

/** Anonymise l’e-mail des événements oversold au-delà de la rétention LEARNER_PII. */
export async function anonymizeExpiredOversoldEmails(
  now = new Date()
): Promise<number> {
  const cutoff = learnerPiiCutoff(now);
  const result = await prisma.accessOversoldEvent.updateMany({
    where: {
      createdAt: { lt: cutoff },
      customerEmail: { not: null },
    },
    data: { customerEmail: null },
  });
  return result.count;
}

/** Rétention livraisons webhooks sortants : 90 jours. */
export const OUTBOUND_WEBHOOK_DELIVERY_RETENTION_DAYS = 90;

export function outboundWebhookDeliveryCutoff(now = new Date()): Date {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - OUTBOUND_WEBHOOK_DELIVERY_RETENTION_DAYS);
  return d;
}

export async function purgeExpiredOutboundWebhookDeliveries(
  now = new Date()
): Promise<number> {
  const cutoff = outboundWebhookDeliveryCutoff(now);
  return batchedDeleteByIds(
    async () => {
      const rows = await prisma.outboundWebhookDelivery.findMany({
        where: { createdAt: { lt: cutoff } },
        select: { id: true },
        take: DELETE_BATCH_SIZE,
        orderBy: { createdAt: "asc" },
      });
      return rows.map((r) => r.id);
    },
    async (ids) => {
      const result = await prisma.outboundWebhookDelivery.deleteMany({
        where: { id: { in: ids } },
      });
      return result.count;
    }
  );
}

/** Rétention événements email marketing (opens/clicks) : 13 mois. */
export const EMAIL_EVENT_RETENTION_DAYS = 396;

export function emailEventCutoff(now = new Date()): Date {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - EMAIL_EVENT_RETENTION_DAYS);
  return d;
}

export async function purgeExpiredEmailEvents(
  now = new Date()
): Promise<number> {
  const cutoff = emailEventCutoff(now);
  return batchedDeleteByIds(
    async () => {
      const rows = await prisma.emailEvent.findMany({
        where: { createdAt: { lt: cutoff } },
        select: { id: true },
        take: DELETE_BATCH_SIZE,
        orderBy: { createdAt: "asc" },
      });
      return rows.map((r) => r.id);
    },
    async (ids) => {
      const result = await prisma.emailEvent.deleteMany({
        where: { id: { in: ids } },
      });
      return result.count;
    }
  );
}

/** Journal d’activité compte : 24 mois. */
export const USER_ACTIVITY_RETENTION_DAYS = 730;

export async function purgeExpiredUserActivityLogs(
  now = new Date()
): Promise<number> {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - USER_ACTIVITY_RETENTION_DAYS);
  return batchedDeleteByIds(
    async () => {
      const rows = await prisma.userActivityLog.findMany({
        where: { createdAt: { lt: cutoff } },
        select: { id: true },
        take: DELETE_BATCH_SIZE,
        orderBy: { createdAt: "asc" },
      });
      return rows.map((r) => r.id);
    },
    async (ids) => {
      const result = await prisma.userActivityLog.deleteMany({
        where: { id: { in: ids } },
      });
      return result.count;
    }
  );
}

/** Clics affiliés : 24 mois (aligné analytics). */
export async function purgeExpiredAffiliateClicks(
  now = new Date()
): Promise<number> {
  const cutoff = analyticsCutoff(now);
  return batchedDeleteByIds(
    async () => {
      const rows = await prisma.affiliateClick.findMany({
        where: { createdAt: { lt: cutoff } },
        select: { id: true },
        take: DELETE_BATCH_SIZE,
        orderBy: { createdAt: "asc" },
      });
      return rows.map((r) => r.id);
    },
    async (ids) => {
      const result = await prisma.affiliateClick.deleteMany({
        where: { id: { in: ids } },
      });
      return result.count;
    }
  );
}

/** Destinataires campagne terminés (sent/failed) : 90 jours. */
export const MARKETING_RECIPIENT_RETENTION_DAYS = 90;

export async function purgeExpiredMarketingRecipients(
  now = new Date()
): Promise<number> {
  const cutoff = new Date(now);
  cutoff.setUTCDate(
    cutoff.getUTCDate() - MARKETING_RECIPIENT_RETENTION_DAYS
  );
  return batchedDeleteByIds(
    async () => {
      const rows = await prisma.marketingCampaignRecipient.findMany({
        where: {
          status: { in: ["sent", "failed"] },
          updatedAt: { lt: cutoff },
        },
        select: { id: true },
        take: DELETE_BATCH_SIZE,
        orderBy: { updatedAt: "asc" },
      });
      return rows.map((r) => r.id);
    },
    async (ids) => {
      const result = await prisma.marketingCampaignRecipient.deleteMany({
        where: { id: { in: ids } },
      });
      return result.count;
    }
  );
}
