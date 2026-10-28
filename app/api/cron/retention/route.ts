import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authorizeCronRequest } from "@/lib/cron-http";
import {
  anonymizeExpiredLearnerPii,
  anonymizeExpiredOversoldEmails,
  purgeExpiredAffiliateClicks,
  purgeExpiredAnalyticsEvents,
  purgeExpiredCookieConsents,
  purgeExpiredEmailEvents,
  purgeExpiredLeads,
  purgeExpiredMarketingRecipients,
  purgeExpiredOutboundWebhookDeliveries,
  purgeExpiredUserActivityLogs,
} from "@/lib/data-retention";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Job rétention RGPD : analytics, leads, consentements cookies, anonymisation PII apprenants,
 * oversold emails, livraisons webhooks sortants, activity logs, affiliés, file campagnes.
 */
export async function POST(request: NextRequest) {
  const denied = await authorizeCronRequest(request, "cron-retention");
  if (denied) return denied;

  const [
    analytics,
    leads,
    cookieConsents,
    learnerPii,
    emailEvents,
    oversoldEmails,
    outboundDeliveries,
    activityLogs,
    affiliateClicks,
    marketingRecipients,
  ] = await Promise.all([
    purgeExpiredAnalyticsEvents(),
    purgeExpiredLeads(),
    purgeExpiredCookieConsents(),
    anonymizeExpiredLearnerPii(),
    purgeExpiredEmailEvents(),
    anonymizeExpiredOversoldEmails(),
    purgeExpiredOutboundWebhookDeliveries(),
    purgeExpiredUserActivityLogs(),
    purgeExpiredAffiliateClicks(),
    purgeExpiredMarketingRecipients(),
  ]);

  return NextResponse.json({
    ok: true,
    purged: {
      analytics,
      leads,
      cookieConsents,
      learnerPii,
      emailEvents,
      oversoldEmails,
      outboundDeliveries,
      activityLogs,
      affiliateClicks,
      marketingRecipients,
    },
    time: new Date().toISOString(),
  });
}
