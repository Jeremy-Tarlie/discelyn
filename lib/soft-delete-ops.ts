/**
 * Ops soft-delete (Prisma) — purge money path + anonymisation compte.
 * Importé uniquement depuis les API routes / tests DB.
 */

import { prisma } from "@/lib/prisma";
import { revokeAllAccessesForBot } from "@/lib/learner-access";
import { deprovisionBot } from "@/lib/provisioning";

/**
 * Coupe l’infra accès formation d’une orga : produits, codes, affiliés,
 * webhooks sortants, config Stripe formation (sk_/whsec_).
 * Ne soft-delete pas les bots — appelant séparé.
 */
export async function purgeOrgAccessInfrastructure(userId: string): Promise<{
  productsDeactivated: number;
  codesDeactivated: number;
  affiliatesDeactivated: number;
  outboundDisabled: number;
  orgStripeDeleted: boolean;
}> {
  const [products, codes, affiliates, outbound] = await Promise.all([
    prisma.accessProduct.updateMany({
      where: { userId, active: true },
      data: { active: false, paymentLinkUrl: null, paymentLinkId: null },
    }),
    prisma.accessCode.updateMany({
      where: { createdByUserId: userId, active: true },
      data: { active: false },
    }),
    prisma.affiliate.updateMany({
      where: { userId, active: true },
      data: { active: false },
    }),
    prisma.orgOutboundWebhook.updateMany({
      where: { userId, active: true },
      data: { active: false, secret: "revoked" },
    }),
  ]);

  const existingStripe = await prisma.orgStripeConfig.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (existingStripe) {
    await prisma.orgStripeConfig.delete({ where: { userId } });
  }

  return {
    productsDeactivated: products.count,
    codesDeactivated: codes.count,
    affiliatesDeactivated: affiliates.count,
    outboundDisabled: outbound.count,
    orgStripeDeleted: Boolean(existingStripe),
  };
}

/** Soft-delete un bot : revoke Discord → inactive produits → null guildId. */
export async function softDeleteBot(input: {
  botId: string;
  guildId: string | null;
  revokeReason: "bot_deleted" | "org_deleted";
}): Promise<void> {
  await revokeAllAccessesForBot(input.botId, input.revokeReason);
  await prisma.accessProduct.updateMany({
    where: { botId: input.botId, active: true },
    data: { active: false, paymentLinkUrl: null, paymentLinkId: null },
  });
  await prisma.bot.update({
    where: { id: input.botId },
    data: {
      deletedAt: new Date(),
      guildId: null,
      inviteUrl: null,
      status: "OFFLINE",
    },
  });
  await deprovisionBot(input.botId, input.guildId);
}

/**
 * Soft-delete compte orga : revoke accès → soft-delete bots → purge secrets
 * → anonymisation user + invalidation sessions.
 * Stripe SaaS Botly doit déjà être annulé par l’appelant.
 */
export async function softDeleteUserAccount(input: {
  userId: string;
  email: string | null;
}): Promise<void> {
  const bots = await prisma.bot.findMany({
    where: { userId: input.userId, deletedAt: null },
    select: { id: true, guildId: true },
  });

  for (const bot of bots) {
    await softDeleteBot({
      botId: bot.id,
      guildId: bot.guildId,
      revokeReason: "org_deleted",
    });
  }

  await purgeOrgAccessInfrastructure(input.userId);

  await prisma.analyticsEvent.deleteMany({ where: { userId: input.userId } });
  if (input.email) {
    await prisma.lead.deleteMany({ where: { email: input.email } });
  }

  await prisma.subscription.updateMany({
    where: { userId: input.userId },
    data: {
      status: "CANCELED",
      plan: "FREE",
      stripeSubscriptionId: null,
      cancelAtPeriodEnd: false,
    },
  });

  const deletedAt = new Date();
  await prisma.bot.updateMany({
    where: { userId: input.userId, deletedAt: null },
    data: {
      deletedAt,
      guildId: null,
      inviteUrl: null,
      status: "OFFLINE",
    },
  });

  await prisma.session.deleteMany({ where: { userId: input.userId } });
  await prisma.account.deleteMany({ where: { userId: input.userId } });
  await prisma.user.update({
    where: { id: input.userId },
    data: {
      deletedAt,
      email: null,
      name: null,
      image: null,
      discordId: null,
      emailVerified: null,
    },
  });
}
