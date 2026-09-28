import { prisma } from "@/lib/prisma";

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
  const result = await prisma.analyticsEvent.deleteMany({
    where: { createdAt: { lt: analyticsCutoff(now) } },
  });
  return result.count;
}

/** Rétention leads commerciaux : 24 mois. */
export const LEAD_RETENTION_DAYS = 730;

export function leadCutoff(now = new Date()): Date {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - LEAD_RETENTION_DAYS);
  return d;
}

export async function purgeExpiredLeads(now = new Date()): Promise<number> {
  const result = await prisma.lead.deleteMany({
    where: { createdAt: { lt: leadCutoff(now) } },
  });
  return result.count;
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

const LEARNER_PII_NULL = {
  customerEmail: null,
  discordUserId: null,
  claimToken: null,
  claimTokenExpiresAt: null,
  stripeCustomerId: null,
  inviteUrl: null,
} as const;

export async function anonymizeExpiredLearnerPii(
  now = new Date()
): Promise<number> {
  const cutoff = learnerPiiCutoff(now);
  const result = await prisma.learnerAccess.updateMany({
    where: {
      status: { in: ["REVOKED", "EXPIRED"] },
      AND: [
        {
          OR: [
            { revokedAt: { lt: cutoff } },
            { AND: [{ revokedAt: null }, { updatedAt: { lt: cutoff } }] },
          ],
        },
        {
          OR: [
            { customerEmail: { not: null } },
            { discordUserId: { not: null } },
            { claimToken: { not: null } },
            { inviteUrl: { not: null } },
            { stripeCustomerId: { not: null } },
          ],
        },
      ],
    },
    data: LEARNER_PII_NULL,
  });
  return result.count;
}
