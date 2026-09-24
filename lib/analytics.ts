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

export async function trackEvent(input: {
  name: AnalyticsEventName | string;
  userId?: string | null;
  sessionId?: string | null;
  path?: string | null;
  meta?: Record<string, string | number | boolean | null>;
}): Promise<void> {
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
