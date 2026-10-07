import { prisma } from "@/lib/prisma";
import { revokeGuildRole } from "@/lib/discord-roles";
import { releaseSeat } from "@/lib/access-seats";
import { syncPaymentLinkAvailability } from "@/lib/access-payment-link";
import { expandGuildRoleTargets } from "@/lib/guild-grants-pure";
import { type OutboundEvent } from "@/lib/outbound-webhooks";
import { loadGuildGrants } from "@/lib/learner-access-fulfill";
import { notifyOutbound, recordEvent } from "@/lib/learner-access-events";

export async function revokeLearnerAccess(
  learnerAccessId: string,
  reason: string
): Promise<void> {
  const access = await prisma.learnerAccess.findUnique({
    where: { id: learnerAccessId },
    include: {
      product: true,
      bot: { select: { organizationId: true } },
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
  await notifyOutbound(access.bot.organizationId, event, {
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

/**
 * Révoque tous les accès ouverts liés à un bot (primaire ou produit)
 * avant suppression cascade — retire les rôles Discord tant que les rows existent.
 */
export async function revokeAllAccessesForBot(
  botId: string,
  reason: string
): Promise<number> {
  const rows = await prisma.learnerAccess.findMany({
    where: {
      status: { in: ["PENDING_CLAIM", "AWAITING_JOIN", "ACTIVE"] },
      OR: [{ botId }, { product: { botId } }],
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
