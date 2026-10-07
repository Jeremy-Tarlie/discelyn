import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  isProductSoldOut,
  releaseSeat,
  tryReserveSeat,
} from "@/lib/access-seats";
import { syncPaymentLinkAvailability } from "@/lib/access-payment-link";
import { hashAccessCode, normalizeAccessCode } from "@/lib/access-code-crypto";
import { claimUrl } from "@/lib/access-urls";
import { CLAIM_TTL_MS, newClaimToken } from "@/lib/access-tokens";
import { getOrgStripeClient } from "@/lib/org-stripe";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { captureMoneyPathError } from "@/lib/money-path-sentry";
import { notifyOutbound, recordEvent } from "@/lib/learner-access-events";
import { fulfillDiscordAccess } from "@/lib/learner-access-fulfill";

type CheckoutOpenResult =
  | { accessId: string; claimToken: string | null; soldOut?: false }
  | { accessId: ""; claimToken: null; soldOut: true };

/**
 * Après paiement : crée l’accès + claim, ou grant immédiat si discord_user_id connu.
 * Réservation siège + create dans une transaction (évite compteur dérivé).
 */
export async function openLearnerAccessFromCheckout(input: {
  productId: string;
  botId: string;
  guildId: string;
  customerEmail: string | null;
  discordUserIdFromMetadata: string | null;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  amountTotal?: number | null;
  amountSubtotal?: number | null;
  currency?: string | null;
  affiliateId?: string | null;
  organizationId: string;
}): Promise<CheckoutOpenResult> {
  type TxResult =
    | { kind: "existing"; accessId: string; claimToken: string | null }
    | { kind: "created"; accessId: string; claimToken: string }
    | { kind: "sold_out" };

  let txResult: TxResult;
  try {
    txResult = await prisma.$transaction(async (tx) => {
      const existing = await tx.learnerAccess.findUnique({
        where: { stripeCheckoutSessionId: input.stripeCheckoutSessionId },
        select: { id: true, claimToken: true },
      });
      if (existing) {
        return {
          kind: "existing" as const,
          accessId: existing.id,
          claimToken: existing.claimToken,
        };
      }

      const reserved = await tryReserveSeat(input.productId, tx);
      if (!reserved) {
        return { kind: "sold_out" as const };
      }

      const claimToken = newClaimToken();
      try {
        const access = await tx.learnerAccess.create({
          data: {
            accessProductId: input.productId,
            botId: input.botId,
            guildId: input.guildId,
            status: "PENDING_CLAIM",
            source: "STRIPE",
            customerEmail: input.customerEmail,
            discordUserId: input.discordUserIdFromMetadata,
            claimToken,
            claimTokenExpiresAt: new Date(Date.now() + CLAIM_TTL_MS),
            stripeCheckoutSessionId: input.stripeCheckoutSessionId,
            stripePaymentIntentId: input.stripePaymentIntentId,
            stripeSubscriptionId: input.stripeSubscriptionId,
            stripeCustomerId: input.stripeCustomerId,
            stripeBillingStatus: input.stripeSubscriptionId ? "active" : null,
            lastPaymentAt: new Date(),
            amountTotal: input.amountTotal ?? null,
            amountSubtotal: input.amountSubtotal ?? null,
            currency: input.currency ?? null,
            affiliateId: input.affiliateId ?? null,
          },
        });
        return {
          kind: "created" as const,
          accessId: access.id,
          claimToken,
        };
      } catch (err) {
        await releaseSeat(input.productId, tx);
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          const raced = await tx.learnerAccess.findUnique({
            where: { stripeCheckoutSessionId: input.stripeCheckoutSessionId },
            select: { id: true, claimToken: true },
          });
          if (raced) {
            return {
              kind: "existing" as const,
              accessId: raced.id,
              claimToken: raced.claimToken,
            };
          }
        }
        throw err;
      }
    });
  } catch (err) {
    throw err;
  }

  if (txResult.kind === "sold_out") {
    await recordOversoldCheckout(input);
    await syncPaymentLinkAvailability(input.productId);
    return { accessId: "", claimToken: null, soldOut: true };
  }

  if (txResult.kind === "existing") {
    const existing = await prisma.learnerAccess.findUnique({
      where: { id: txResult.accessId },
      select: { status: true, discordUserId: true },
    });
    const discordUserId =
      input.discordUserIdFromMetadata ?? existing?.discordUserId ?? null;
    if (
      existing &&
      discordUserId &&
      (existing.status === "PENDING_CLAIM" ||
        existing.status === "AWAITING_JOIN")
    ) {
      try {
        await fulfillDiscordAccess(txResult.accessId, discordUserId);
      } catch (err) {
        captureMoneyPathError(err, {
          area: "access.refulfill",
          accessId: txResult.accessId,
        });
      }
    }
    return { accessId: txResult.accessId, claimToken: txResult.claimToken };
  }

  await recordEvent(txResult.accessId, "payment_received", {
    sessionId: input.stripeCheckoutSessionId,
    amountTotal: input.amountTotal ?? null,
  });
  await notifyOutbound(input.organizationId, "payment_received", {
    accessId: txResult.accessId,
    productId: input.productId,
    email: input.customerEmail,
    amountTotal: input.amountTotal ?? null,
  });

  await syncPaymentLinkAvailability(input.productId);

  if (input.discordUserIdFromMetadata) {
    try {
      await fulfillDiscordAccess(txResult.accessId);
    } catch (err) {
      // Accès créé + siège réservé : ne pas faire échouer le webhook.
      // retryStuckGrants (cron) reprendra.
      captureMoneyPathError(err, {
        area: "access.fulfill_after_checkout",
        accessId: txResult.accessId,
      });
    }
  } else if (input.customerEmail && txResult.claimToken) {
    await sendImmediateClaimInvite({
      organizationId: input.organizationId,
      accessId: txResult.accessId,
      productId: input.productId,
      customerEmail: input.customerEmail,
      claimToken: txResult.claimToken,
    });
  } else if (!input.customerEmail && !input.discordUserIdFromMetadata) {
    console.warn(
      `[access] checkout sans email ni discord_user_id access=${txResult.accessId} — claim uniquement via session Stripe / lien manuel`
    );
  }

  return { accessId: txResult.accessId, claimToken: txResult.claimToken };
}

/** Email claim immédiat + webhook orga (best-effort, ne bloque pas le webhook Stripe). */
async function sendImmediateClaimInvite(input: {
  organizationId: string;
  accessId: string;
  productId: string;
  customerEmail: string;
  claimToken: string;
}): Promise<void> {
  const product = await prisma.accessProduct.findUnique({
    where: { id: input.productId },
    select: { name: true },
  });
  const productName = product?.name ?? "formation";
  const url = claimUrl(input.claimToken);

  if (isEmailConfigured()) {
    const mail = await sendEmail({
      to: input.customerEmail,
      subject: `Finalise ton accès « ${productName} »`,
      text: `Bonjour,\n\nTon paiement est confirmé. Finalise ton accès Discord « ${productName} » :\n${url}\n\n— Discelyn`,
      html: `<p>Bonjour,</p><p>Ton paiement est confirmé. Finalise ton accès Discord <strong>${productName}</strong> :</p><p><a href="${url}">${url}</a></p><p>— Discelyn</p>`,
    });
    if (!mail.ok) {
      console.warn("[access] claim invite email failed", mail.error);
    }
  } else {
    console.warn(
      `[access] claim invite: RESEND_API_KEY/EMAIL_FROM absents — email non envoyé access=${input.accessId}`
    );
  }

  try {
    await notifyOutbound(input.organizationId, "claim_reminder", {
      accessId: input.accessId,
      productId: input.productId,
      email: input.customerEmail,
      claimUrl: url,
      productName,
      reminderCount: 0,
    });
  } catch (err) {
    captureMoneyPathError(err, {
      area: "access.claim_invite_outbound",
      accessId: input.accessId,
    });
  }

  await recordEvent(input.accessId, "claim_invite_sent", {
    channel: isEmailConfigured() ? "email" : "outbound_only",
  });
}

async function attemptOversoldRefund(input: {
  organizationId: string;
  stripePaymentIntentId: string | null;
  stripeSubscriptionId: string | null;
}): Promise<{
  refundStatus: "refunded" | "refund_failed" | "skipped";
  stripeRefundId: string | null;
  refundError: string | null;
}> {
  const stripe = await getOrgStripeClient(input.organizationId);
  if (!stripe) {
    return {
      refundStatus: "skipped",
      stripeRefundId: null,
      refundError: "stripe_not_configured",
    };
  }

  try {
    if (input.stripeSubscriptionId) {
      await stripe.subscriptions.cancel(input.stripeSubscriptionId, {
        invoice_now: false,
        prorate: false,
      });
    }

    if (!input.stripePaymentIntentId) {
      return {
        refundStatus: "skipped",
        stripeRefundId: null,
        refundError: "no_payment_intent",
      };
    }

    const refund = await stripe.refunds.create({
      payment_intent: input.stripePaymentIntentId,
      reason: "requested_by_customer",
      metadata: { discelyn_reason: "oversold" },
    });
    return {
      refundStatus: "refunded",
      stripeRefundId: refund.id,
      refundError: null,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message.slice(0, 500) : "refund_failed";
    captureMoneyPathError(new Error(message), {
      area: "access.oversold_refund",
      extra: {
        message,
        organizationId: input.organizationId,
        paymentIntentId: input.stripePaymentIntentId,
      },
    });
    return {
      refundStatus: "refund_failed",
      stripeRefundId: null,
      refundError: message,
    };
  }
}

/**
 * Relance les remboursements oversold en échec / pending (cron).
 * Skip `skipped` et `refunded`.
 */
export async function retryOversoldRefunds(): Promise<number> {
  const rows = await prisma.accessOversoldEvent.findMany({
    where: { refundStatus: { in: ["pending", "refund_failed"] } },
    select: {
      id: true,
      organizationId: true,
      stripePaymentIntentId: true,
      stripeCheckoutSessionId: true,
    },
    take: 30,
    orderBy: { createdAt: "asc" },
  });

  let fixed = 0;
  for (const row of rows) {
    // Subscription id non stocké sur l’event — cancel déjà tenté à la création.
    const refund = await attemptOversoldRefund({
      organizationId: row.organizationId,
      stripePaymentIntentId: row.stripePaymentIntentId,
      stripeSubscriptionId: null,
    });
    await prisma.accessOversoldEvent.update({
      where: { id: row.id },
      data: {
        refundStatus: refund.refundStatus,
        stripeRefundId: refund.stripeRefundId,
        refundError: refund.refundError,
      },
    });
    if (refund.refundStatus === "refunded") fixed += 1;
  }
  return fixed;
}

async function recordOversoldCheckout(input: {
  productId: string;
  botId: string;
  organizationId: string;
  customerEmail: string | null;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  stripeSubscriptionId: string | null;
  amountTotal?: number | null;
  currency?: string | null;
}): Promise<void> {
  console.error(
    `[access] OVERSOLD product=${input.productId} session=${input.stripeCheckoutSessionId}`
  );

  // Claim d’abord (unique session) pour éviter double-refund sur retry Stripe.
  let claimed = false;
  try {
    await prisma.accessOversoldEvent.create({
      data: {
        organizationId: input.organizationId,
        accessProductId: input.productId,
        botId: input.botId,
        stripeCheckoutSessionId: input.stripeCheckoutSessionId,
        stripePaymentIntentId: input.stripePaymentIntentId,
        customerEmail: input.customerEmail,
        amountTotal: input.amountTotal ?? null,
        currency: input.currency ?? null,
        refundStatus: "pending",
      },
    });
    claimed = true;
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return;
    }
    console.warn("[access] oversold persist failed", err);
    return;
  }

  if (!claimed) return;

  const refund = await attemptOversoldRefund({
    organizationId: input.organizationId,
    stripePaymentIntentId: input.stripePaymentIntentId,
    stripeSubscriptionId: input.stripeSubscriptionId,
  });

  await prisma.accessOversoldEvent.update({
    where: { stripeCheckoutSessionId: input.stripeCheckoutSessionId },
    data: {
      refundStatus: refund.refundStatus,
      stripeRefundId: refund.stripeRefundId,
      refundError: refund.refundError,
    },
  });

  await notifyOutbound(input.organizationId, "sold_out", {
    productId: input.productId,
    sessionId: input.stripeCheckoutSessionId,
    email: input.customerEmail,
    amountTotal: input.amountTotal ?? null,
    refundStatus: refund.refundStatus,
  });
}

/** Redeem code manuel → PENDING_CLAIM ou grant. */
export async function openLearnerAccessFromCode(input: {
  code: string;
  discordUserId?: string | null;
}): Promise<{
  ok: boolean;
  accessId?: string;
  claimToken?: string | null;
  error?: string;
}> {
  const row = await prisma.accessCode.findUnique({
    where: { codeHash: hashAccessCode(normalizeAccessCode(input.code)) },
    include: {
      product: {
        include: {
          bot: { select: { id: true, guildId: true, organizationId: true } },
        },
      },
    },
  });
  if (!row || !row.active) {
    return { ok: false, error: "invalid_code" };
  }
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "code_expired" };
  }
  if (row.redemptions >= row.maxRedemptions) {
    return { ok: false, error: "code_exhausted" };
  }
  if (!row.product.active || !row.product.bot.guildId) {
    return { ok: false, error: "product_unavailable" };
  }
  if (isProductSoldOut(row.product)) {
    return { ok: false, error: "sold_out" };
  }

  const claimToken = newClaimToken();
  const guildId = row.product.bot.guildId;

  let accessId: string;
  try {
    accessId = await prisma.$transaction(async (tx) => {
      const reserved = await tryReserveSeat(row.product.id, tx);
      if (!reserved) {
        throw new Error("sold_out");
      }

      const updated = await tx.accessCode.updateMany({
        where: {
          id: row.id,
          redemptions: { lt: row.maxRedemptions },
          active: true,
        },
        data: { redemptions: { increment: 1 } },
      });
      if (updated.count === 0) {
        await releaseSeat(row.product.id, tx);
        throw new Error("code_exhausted");
      }

      const access = await tx.learnerAccess.create({
        data: {
          accessProductId: row.product.id,
          botId: row.product.botId,
          guildId,
          status: "PENDING_CLAIM",
          source: "ACCESS_CODE",
          discordUserId: input.discordUserId ?? null,
          claimToken,
          claimTokenExpiresAt: new Date(Date.now() + CLAIM_TTL_MS),
        },
      });
      return access.id;
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "create_failed";
    if (msg === "sold_out" || msg === "code_exhausted") {
      return { ok: false, error: msg };
    }
    console.warn("[access] code redeem create failed", err);
    return { ok: false, error: "create_failed" };
  }

  await recordEvent(accessId, "code_redeemed", { codeId: row.id });
  await syncPaymentLinkAvailability(row.product.id);

  if (input.discordUserId) {
    await fulfillDiscordAccess(accessId);
  }

  return { ok: true, accessId, claimToken };
}
