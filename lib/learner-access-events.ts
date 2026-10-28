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

/**
 * Dispatch non-bloquant : le money path Stripe / claim ne doit pas attendre
 * les webhooks sortants (timeouts HTTP jusqu’à 8 s × retries).
 */
export async function notifyOutbound(
  organizationId: string,
  event: OutboundEvent,
  payload: Record<string, string | number | boolean | null>
): Promise<void> {
  void dispatchOutboundWebhooks({ organizationId, event, payload }).catch(
    (err: unknown) => {
      console.warn("[outbound] dispatch failed", err);
    }
  );
}
