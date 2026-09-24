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
