import { randomBytes } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createSingleUseInvite,
  grantGuildRole,
  postGuildLog,
  revokeGuildRole,
  sendUserDm,
} from "@/lib/discord-roles";
import { getPlan, type PlanId } from "@/lib/plans";
import { parseBotConfig } from "@/lib/bot-config";
import {
  isProductSoldOut,
  parseOnboardingSteps,
  releaseSeat,
  tryReserveSeat,
} from "@/lib/access-seats";
import { syncPaymentLinkAvailability } from "@/lib/access-payment-link";
import { hashAccessCode, normalizeAccessCode } from "@/lib/access-code-crypto";
import {
  expandGuildRoleTargets,
} from "@/lib/guild-grants-pure";
import { decideGrantOutcome, type GrantAttemptKind } from "@/lib/grant-outcome-pure";
import {
  dispatchOutboundWebhooks,
  type OutboundEvent,
} from "@/lib/outbound-webhooks";
import { getOrgStripeClient } from "@/lib/org-stripe";

export {
  extractDiscordUserIdFromSession,
  extractPriceIdFromSession,
} from "@/lib/learner-access-parse";

export {
  isProductSoldOut,
  parseOnboardingSteps,
  releaseSeat,
  tryReserveSeat,
  newAccessCodePlain,
} from "@/lib/access-seats";

const CLAIM_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function newClaimToken(): string {
  return randomBytes(24).toString("base64url");
}

export function newWebhookPathToken(): string {
  return randomBytes(24).toString("base64url");
}

export function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export function orgWebhookUrl(pathToken: string): string {
  return `${appBaseUrl()}/api/access/webhook/${pathToken}`;
}

export function claimUrl(claimToken: string): string {
  return `${appBaseUrl()}/claim/${claimToken}`;
}

export function affiliateRefUrl(code: string, productId?: string): string {
  const base = `${appBaseUrl()}/r/${encodeURIComponent(code)}`;
  return productId ? `${base}?product=${encodeURIComponent(productId)}` : base;
}

export function maxAccessProductsForPlan(planId: PlanId): number {
  return getPlan(planId).maxAccessProducts;
}

async function recordEvent(
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

async function notifyOutbound(
  userId: string,
  event: OutboundEvent,
  payload: Record<string, string | number | boolean | null>
): Promise<void> {
  try {
    await dispatchOutboundWebhooks({ userId, event, payload });
  } catch (err) {
    console.warn("[outbound] dispatch failed", err);
  }
}

type GuildGrantRow = {
  guildId: string;
  discordRoleId: string;
  botId: string;
  bot: { config: unknown };
};

async function loadGuildGrants(productId: string): Promise<GuildGrantRow[]> {
  const grants = await prisma.accessProductGuildGrant.findMany({
    where: { accessProductId: productId },
    include: { bot: { select: { config: true } } },
  });
  return grants.map((g) => ({
    guildId: g.guildId,
    discordRoleId: g.discordRoleId,
    botId: g.botId,
    bot: g.bot,
  }));
}

async function ensurePrimaryGrant(input: {
  productId: string;
  botId: string;
  guildId: string;
  discordRoleId: string;
}): Promise<void> {
  await prisma.accessProductGuildGrant.upsert({
    where: {
      accessProductId_botId: {
        accessProductId: input.productId,
        botId: input.botId,
      },
    },
    create: {
      accessProductId: input.productId,
      botId: input.botId,
      guildId: input.guildId,
      discordRoleId: input.discordRoleId,
    },
    update: {
      guildId: input.guildId,
      discordRoleId: input.discordRoleId,
    },
  });
}

export { ensurePrimaryGrant };

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
  userId: string;
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
    return { accessId: txResult.accessId, claimToken: txResult.claimToken };
  }

  await recordEvent(txResult.accessId, "payment_received", {
    sessionId: input.stripeCheckoutSessionId,
    amountTotal: input.amountTotal ?? null,
  });
  await notifyOutbound(input.userId, "payment_received", {
    accessId: txResult.accessId,
    productId: input.productId,
    email: input.customerEmail,
    amountTotal: input.amountTotal ?? null,
  });

  await syncPaymentLinkAvailability(input.productId);

  if (input.discordUserIdFromMetadata) {
    await fulfillDiscordAccess(txResult.accessId);
  }

  return { accessId: txResult.accessId, claimToken: txResult.claimToken };
}

async function attemptOversoldRefund(input: {
  userId: string;
  stripePaymentIntentId: string | null;
  stripeSubscriptionId: string | null;
}): Promise<{
  refundStatus: "refunded" | "refund_failed" | "skipped";
  stripeRefundId: string | null;
  refundError: string | null;
}> {
  const stripe = await getOrgStripeClient(input.userId);
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
      metadata: { botly_reason: "oversold" },
    });
    return {
      refundStatus: "refunded",
      stripeRefundId: refund.id,
      refundError: null,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message.slice(0, 500) : "refund_failed";
    console.error("[access] oversold refund failed", message);
    return {
      refundStatus: "refund_failed",
      stripeRefundId: null,
      refundError: message,
    };
  }
}

async function recordOversoldCheckout(input: {
  productId: string;
  botId: string;
  userId: string;
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
        userId: input.userId,
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
    userId: input.userId,
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

  await notifyOutbound(input.userId, "sold_out", {
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
          bot: { select: { id: true, guildId: true, userId: true } },
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

/** Claim OAuth ou metadata : tente le grant de rôle (tous les guild grants). */
export async function fulfillDiscordAccess(
  learnerAccessId: string,
  discordUserId?: string
): Promise<{
  status: "ACTIVE" | "AWAITING_JOIN" | "EXPIRED" | "REVOKED" | "PENDING_CLAIM";
  inviteUrl: string | null;
  error: string | null;
}> {
  const access = await prisma.learnerAccess.findUnique({
    where: { id: learnerAccessId },
    include: {
      product: { include: { bot: { select: { userId: true } } } },
      bot: { select: { config: true, guildId: true, userId: true } },
    },
  });
  if (!access) {
    return { status: "PENDING_CLAIM", inviteUrl: null, error: "not_found" };
  }
  if (access.status === "REVOKED" || access.status === "EXPIRED") {
    return {
      status: access.status,
      inviteUrl: null,
      error: "access_closed",
    };
  }
  if (
    access.product.accessEndsAt &&
    access.product.accessEndsAt.getTime() < Date.now()
  ) {
    await revokeLearnerAccess(access.id, "cohort_ended");
    return { status: "EXPIRED", inviteUrl: null, error: "cohort_ended" };
  }

  const userId = discordUserId ?? access.discordUserId;
  if (!userId) {
    return {
      status: "PENDING_CLAIM",
      inviteUrl: null,
      error: "discord_required",
    };
  }

  const grantRows = await loadGuildGrants(access.accessProductId);
  const targets = expandGuildRoleTargets({
    primaryGuildId: access.guildId,
    primaryRoleId: access.product.discordRoleId,
    grants: grantRows.map((g) => ({
      guildId: g.guildId,
      discordRoleId: g.discordRoleId,
    })),
  }).map((t) => {
    const row = grantRows.find((g) => g.guildId === t.guildId);
    return {
      guildId: t.guildId,
      discordRoleId: t.discordRoleId,
      bot: row?.bot ?? access.bot,
    };
  });

  const attempts: GrantAttemptKind[] = [];
  let primaryInvite: string | null = null;
  let lastError: string | null = null;

  for (const grant of targets) {
    const result = await grantGuildRole({
      guildId: grant.guildId,
      discordUserId: userId,
      roleId: grant.discordRoleId,
    });
    if (!result.ok) {
      lastError = result.error;
      attempts.push("failed");
      await recordEvent(access.id, "role_grant_failed", {
        error: result.error,
        guildId: grant.guildId,
      });
      continue;
    }
    if (result.inGuild) {
      attempts.push("granted");
    } else {
      attempts.push("absent");
      if (!primaryInvite) {
        const config = parseBotConfig(grant.bot.config);
        primaryInvite =
          access.inviteUrl ??
          (await createSingleUseInvite(
            grant.guildId,
            config.welcomeChannelId || null
          ));
      }
    }
  }

  const outcome = decideGrantOutcome(attempts);

  if (outcome.status === "AWAITING_JOIN") {
    const invite = primaryInvite ?? access.inviteUrl;
    await prisma.learnerAccess.update({
      where: { id: access.id },
      data: {
        discordUserId: userId,
        status: "AWAITING_JOIN",
        inviteUrl: invite,
        claimToken: null,
        claimTokenExpiresAt: null,
      },
    });
    await recordEvent(access.id, "awaiting_join", {
      discordUserId: userId,
      grantedCount: outcome.grantedCount,
      absentCount: outcome.absentCount,
    });
    return {
      status: "AWAITING_JOIN",
      inviteUrl: invite,
      error: null,
    };
  }

  if (outcome.status === "blocked") {
    return {
      status: access.status,
      inviteUrl: access.inviteUrl,
      error: lastError ?? "grant_incomplete",
    };
  }

  const steps = parseOnboardingSteps(access.product.onboardingSteps);
  const welcomeDm =
    steps[0]?.trim() ||
    access.product.welcomeDm?.trim() ||
    `Bienvenue — ton accès « ${access.product.name} » est actif sur Discord.`;

  await prisma.learnerAccess.update({
    where: { id: access.id },
    data: {
      discordUserId: userId,
      status: "ACTIVE",
      grantedAt: new Date(),
      claimToken: null,
      claimTokenExpiresAt: null,
      inviteUrl: null,
      onboardingStep: steps.length > 0 ? 1 : 0,
      onboardingLastSentAt: new Date(),
    },
  });
  await recordEvent(access.id, "role_granted", {
    discordUserId: userId,
    grantedCount: outcome.grantedCount,
  });
  await notifyOutbound(access.bot.userId, "role_granted", {
    accessId: access.id,
    productId: access.accessProductId,
    discordUserId: userId,
  });

  await sendUserDm({ discordUserId: userId, content: welcomeDm });

  for (const grant of targets) {
    const logsChannelId = parseBotConfig(grant.bot.config).logsChannelId;
    if (logsChannelId) {
      await postGuildLog({
        channelId: logsChannelId,
        content: `💳 Accès activé : <@${userId}> → **${access.product.name}**`,
      });
    }
  }

  return { status: "ACTIVE", inviteUrl: null, error: null };
}

/** Appelé au join Discord (runtime) pour les AWAITING_JOIN. */
export async function grantPendingOnJoin(input: {
  guildId: string;
  discordUserId: string;
}): Promise<number> {
  const pending = await prisma.learnerAccess.findMany({
    where: {
      status: "AWAITING_JOIN",
      discordUserId: input.discordUserId,
      OR: [
        { guildId: input.guildId },
        { product: { guildGrants: { some: { guildId: input.guildId } } } },
      ],
    },
    include: {
      product: true,
      bot: { select: { config: true, userId: true } },
    },
  });

  let granted = 0;
  for (const access of pending) {
    const result = await fulfillDiscordAccess(
      access.id,
      input.discordUserId
    );
    if (result.status === "ACTIVE") granted += 1;
  }
  return granted;
}

export async function revokeLearnerAccess(
  learnerAccessId: string,
  reason: string
): Promise<void> {
  const access = await prisma.learnerAccess.findUnique({
    where: { id: learnerAccessId },
    include: {
      product: true,
      bot: { select: { userId: true } },
    },
  });
  if (!access) return;
  if (access.status === "REVOKED" || access.status === "EXPIRED") return;

  const nextStatus = reason === "cohort_ended" ? "EXPIRED" : "REVOKED";

  // Claim atomique du revoke : un seul gagnant libère le siège.
  const claimed = await prisma.$transaction(async (tx) => {
    const updated = await tx.learnerAccess.updateMany({
      where: {
        id: access.id,
        status: { in: ["PENDING_CLAIM", "AWAITING_JOIN", "ACTIVE"] },
      },
      data: {
        status: nextStatus,
        revokedAt: new Date(),
        revokeReason: reason,
        claimToken: null,
      },
    });
    if (updated.count === 0) return false;
    await releaseSeat(access.accessProductId, tx);
    return true;
  });

  if (!claimed) return;

  const grantRows = await loadGuildGrants(access.accessProductId);
  const targets = expandGuildRoleTargets({
    primaryGuildId: access.guildId,
    primaryRoleId: access.product.discordRoleId,
    grants: grantRows.map((g) => ({
      guildId: g.guildId,
      discordRoleId: g.discordRoleId,
    })),
  });

  if (access.discordUserId) {
    for (const grant of targets) {
      await revokeGuildRole({
        guildId: grant.guildId,
        discordUserId: access.discordUserId,
        roleId: grant.discordRoleId,
      });
    }
  }

  await recordEvent(access.id, "access_revoked", { reason });
  await syncPaymentLinkAvailability(access.accessProductId);

  const event: OutboundEvent =
    reason === "cohort_ended" ? "expired" : "revoked";
  await notifyOutbound(access.bot.userId, event, {
    accessId: access.id,
    productId: access.accessProductId,
    reason,
  });
}

export async function revokeBySubscriptionId(
  stripeSubscriptionId: string,
  reason: string
): Promise<number> {
  const rows = await prisma.learnerAccess.findMany({
    where: {
      stripeSubscriptionId,
      status: { in: ["PENDING_CLAIM", "AWAITING_JOIN", "ACTIVE"] },
    },
    select: { id: true },
  });
  for (const row of rows) {
    await revokeLearnerAccess(row.id, reason);
  }
  return rows.length;
}

export async function revokeByPaymentIntentId(
  paymentIntentId: string,
  reason: string
): Promise<number> {
  const rows = await prisma.learnerAccess.findMany({
    where: {
      stripePaymentIntentId: paymentIntentId,
      status: { in: ["PENDING_CLAIM", "AWAITING_JOIN", "ACTIVE"] },
      product: { revokeOnRefund: true },
    },
    select: { id: true },
  });
  for (const row of rows) {
    await revokeLearnerAccess(row.id, reason);
  }
  return rows.length;
}

export async function expireCohortAccesses(): Promise<number> {
  const now = new Date();
  const rows = await prisma.learnerAccess.findMany({
    where: {
      status: { in: ["PENDING_CLAIM", "AWAITING_JOIN", "ACTIVE"] },
      product: { accessEndsAt: { lte: now } },
    },
    select: { id: true },
  });
  for (const row of rows) {
    await revokeLearnerAccess(row.id, "cohort_ended");
  }
  return rows.length;
}

/** Relances claim 24h / 48h (#5). */
export async function sendClaimReminders(): Promise<number> {
  const now = Date.now();
  const day1 = new Date(now - 24 * 60 * 60 * 1000);
  const day2 = new Date(now - 48 * 60 * 60 * 1000);

  const pending = await prisma.learnerAccess.findMany({
    where: {
      status: "PENDING_CLAIM",
      claimToken: { not: null },
      createdAt: { lte: day1 },
      claimReminderCount: { lt: 2 },
    },
    include: { product: { select: { name: true } } },
    take: 100,
  });

  let sent = 0;
  for (const access of pending) {
    const needsSecond =
      access.claimReminderCount >= 1 && access.createdAt <= day2;
    const needsFirst = access.claimReminderCount === 0;
    if (!needsFirst && !needsSecond) continue;

    if (access.discordUserId && access.claimToken) {
      const url = claimUrl(access.claimToken);
      await sendUserDm({
        discordUserId: access.discordUserId,
        content: `Rappel — finalise ton accès « ${access.product.name} » : ${url}`,
      });
    }
    await prisma.learnerAccess.update({
      where: { id: access.id },
      data: {
        claimReminderSentAt: new Date(),
        claimReminderCount: { increment: 1 },
      },
    });
    await recordEvent(access.id, "claim_reminder_sent", {
      count: access.claimReminderCount + 1,
    });
    sent += 1;
  }
  return sent;
}

/** Rappels J-N avant accessEndsAt (#12). */
export async function sendExpiryReminders(): Promise<number> {
  const now = new Date();
  const active = await prisma.learnerAccess.findMany({
    where: {
      status: "ACTIVE",
      expiryReminderSentAt: null,
      discordUserId: { not: null },
      product: { accessEndsAt: { not: null } },
    },
    include: {
      product: {
        select: {
          name: true,
          accessEndsAt: true,
          reminderDaysBefore: true,
        },
      },
    },
    take: 200,
  });

  let sent = 0;
  for (const access of active) {
    const endsAt = access.product.accessEndsAt;
    if (!endsAt || !access.discordUserId) continue;
    const days = access.product.reminderDaysBefore ?? 7;
    const reminderAt = new Date(endsAt.getTime() - days * 24 * 60 * 60 * 1000);
    if (now < reminderAt || now >= endsAt) continue;

    await sendUserDm({
      discordUserId: access.discordUserId,
      content: `Ton accès « ${access.product.name} » expire le ${endsAt.toISOString().slice(0, 10)}.`,
    });
    await prisma.learnerAccess.update({
      where: { id: access.id },
      data: { expiryReminderSentAt: new Date() },
    });
    await recordEvent(access.id, "expiry_reminder_sent", {});
    sent += 1;
  }
  return sent;
}

/** Envoie l’étape onboarding suivante (#6). */
export async function advanceOnboardingSteps(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await prisma.learnerAccess.findMany({
    where: {
      status: "ACTIVE",
      discordUserId: { not: null },
      onboardingLastSentAt: { lte: cutoff },
    },
    include: {
      product: { select: { onboardingSteps: true, name: true } },
    },
    take: 100,
  });

  let sent = 0;
  for (const access of rows) {
    const steps = parseOnboardingSteps(access.product.onboardingSteps);
    if (steps.length === 0) continue;
    if (access.onboardingStep >= steps.length) continue;
    const message = steps[access.onboardingStep];
    if (!message || !access.discordUserId) continue;

    await sendUserDm({
      discordUserId: access.discordUserId,
      content: message,
    });
    await prisma.learnerAccess.update({
      where: { id: access.id },
      data: {
        onboardingStep: { increment: 1 },
        onboardingLastSentAt: new Date(),
      },
    });
    await recordEvent(access.id, "onboarding_step_sent", {
      step: access.onboardingStep,
    });
    sent += 1;
  }
  return sent;
}

export async function recordSubscriptionEvent(
  stripeSubscriptionId: string,
  type: string,
  meta?: Record<string, string | number | boolean | null>
): Promise<void> {
  const rows = await prisma.learnerAccess.findMany({
    where: { stripeSubscriptionId },
    select: { id: true },
  });
  for (const row of rows) {
    await recordEvent(row.id, type, meta);
  }
}
