import { createHmac, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { assertSafeOutboundWebhookUrl } from "@/lib/webhook-url-safety";
import { unsealToken } from "@/lib/token-crypto";

export const OUTBOUND_EVENTS = [
  "payment_received",
  "role_granted",
  "revoked",
  "expired",
  "sold_out",
] as const;

export type OutboundEvent = (typeof OUTBOUND_EVENTS)[number];

export function newOutboundWebhookSecret(): string {
  return randomBytes(24).toString("hex");
}

function signPayload(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export async function dispatchOutboundWebhooks(input: {
  userId: string;
  event: OutboundEvent;
  payload: Record<string, string | number | boolean | null>;
}): Promise<void> {
  const hooks = await prisma.orgOutboundWebhook.findMany({
    where: {
      userId: input.userId,
      active: true,
      events: { has: input.event },
    },
  });
  if (hooks.length === 0) return;

  const envelope = {
    event: input.event,
    sentAt: new Date().toISOString(),
    data: input.payload,
  };
  const body = JSON.stringify(envelope);

  for (const hook of hooks) {
    let ok = false;
    let statusCode: number | null = null;
    let lastError: string | null = null;
    let attempts = 0;

    let safeUrl: string;
    try {
      safeUrl = assertSafeOutboundWebhookUrl(hook.url);
    } catch (err) {
      await prisma.outboundWebhookDelivery.create({
        data: {
          webhookId: hook.id,
          event: input.event,
          payload: envelope,
          statusCode: null,
          ok: false,
          attempts: 0,
          lastError:
            err instanceof Error ? err.message : "unsafe_webhook_url",
        },
      });
      continue;
    }

    for (let i = 0; i < 2; i += 1) {
      attempts += 1;
      try {
        const plainSecret = unsealToken(hook.secret);
        if (typeof plainSecret !== "string" || plainSecret.length === 0) {
          lastError = "secret_unseal_failed";
          break;
        }
        const signature = signPayload(plainSecret, body);
        const res = await fetch(safeUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Botly-Signature": signature,
            "X-Botly-Event": input.event,
          },
          body,
          signal: AbortSignal.timeout(8_000),
          redirect: "error",
        });
        statusCode = res.status;
        ok = res.ok;
        if (ok) break;
        lastError = `HTTP ${res.status}`;
      } catch (err) {
        lastError = err instanceof Error ? err.message : "fetch_failed";
      }
    }

    await prisma.outboundWebhookDelivery.create({
      data: {
        webhookId: hook.id,
        event: input.event,
        payload: envelope,
        statusCode,
        ok,
        attempts,
        lastError,
      },
    });
  }
}
