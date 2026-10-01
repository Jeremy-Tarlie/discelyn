import { cookies } from "next/headers";
import { CONSENT_COOKIE } from "@/i18n/config";
import { parseConsent } from "@/lib/consent";
import { prisma } from "@/lib/prisma";

export type AnalyticsEventName =
  | "landing_view"
  | "lead_submitted"
  | "signup"
  | "bot_created"
  | "guild_linked"
  | "checkout_started"
  | "checkout_completed"
  | "portal_opened";

type TrackEventInput = {
  name: AnalyticsEventName | string;
  userId?: string | null;
  sessionId?: string | null;
  path?: string | null;
  meta?: Record<string, string | number | boolean | null>;
  /**
   * Server jobs / Stripe webhooks without a browser consent cookie.
   * Do not use for browser-initiated routes.
   */
  bypassConsent?: boolean;
};

async function hasOptionalConsentInRequest(): Promise<boolean> {
  try {
    const jar = await cookies();
    return parseConsent(jar.get(CONSENT_COOKIE)?.value) === "all";
  } catch {
    return false;
  }
}

export async function trackEvent(input: TrackEventInput): Promise<void> {
  if (!input.bypassConsent) {
    const allowed = await hasOptionalConsentInRequest();
    if (!allowed) return;
  }

  try {
    await prisma.analyticsEvent.create({
      data: {
        name: input.name,
        userId: input.userId ?? null,
        sessionId: input.sessionId ?? null,
        path: input.path ?? null,
        meta: input.meta ?? undefined,
      },
    });
  } catch (error) {
    console.error("[analytics] track failed", error);
  }
}
