import { prisma } from "@/lib/prisma";
import {
  dispatchOutboundWebhooks,
  type OutboundEvent,
} from "@/lib/outbound-webhooks";

export async function recordEvent(
  learnerAccessId: string,
  type: string,
  meta?: Record<string, string | number | boolean | null>
): Promise<void> {
  await prisma.learnerAccessEvent.create({
    data: {
      learnerAccessId,
      type,
      meta: meta ?? undefined,
    },
  });
}

export async function notifyOutbound(
  organizationId: string,
  event: OutboundEvent,
  payload: Record<string, string | number | boolean | null>
): Promise<void> {
  try {
    await dispatchOutboundWebhooks({ organizationId, event, payload });
  } catch (err) {
    console.warn("[outbound] dispatch failed", err);
  }
}
