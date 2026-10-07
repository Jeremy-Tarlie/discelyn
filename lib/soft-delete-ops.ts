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
export async function purgeOrgAccessInfrastructure(
  organizationId: string
): Promise<{
  productsDeactivated: number;
  codesDeactivated: number;
  affiliatesDeactivated: number;
  outboundDisabled: number;
  orgStripeDeleted: boolean;
}> {
  const [products, codes, affiliates, outbound] = await Promise.all([
    prisma.accessProduct.updateMany({
      where: { organizationId, active: true },
      data: { active: false, paymentLinkUrl: null, paymentLinkId: null },
    }),
    prisma.accessCode.updateMany({
      where: { product: { organizationId }, active: true },
      data: { active: false },
    }),
    prisma.affiliate.updateMany({
      where: { organizationId, active: true },
      data: { active: false },
    }),
    prisma.orgOutboundWebhook.updateMany({
      where: { organizationId, active: true },
      data: { active: false, secret: "revoked" },
    }),
  ]);

  const existingStripe = await prisma.orgStripeConfig.findUnique({
    where: { organizationId },
    select: { id: true },
  });
  if (existingStripe) {
    await prisma.orgStripeConfig.delete({ where: { organizationId } });
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
 * Soft-delete organisation : bots → purge infra → abonnement FREE/CANCELED
 * → anonymisation LearnerAccess (PII) → org.deletedAt.
 */
export async function softDeleteOrganization(
  organizationId: string
): Promise<void> {
  const bots = await prisma.bot.findMany({
    where: { organizationId, deletedAt: null },
    select: { id: true, guildId: true },
  });

  for (const bot of bots) {
    await softDeleteBot({
      botId: bot.id,
      guildId: bot.guildId,
      revokeReason: "org_deleted",
    });
  }

  await purgeOrgAccessInfrastructure(organizationId);

  await prisma.subscription.updateMany({
    where: { organizationId },
    data: {
      status: "CANCELED",
      plan: "FREE",
      stripeSubscriptionId: null,
      cancelAtPeriodEnd: false,
    },
  });

  const botIds = (
    await prisma.bot.findMany({
      where: { organizationId },
      select: { id: true },
    })
  ).map((b) => b.id);

  if (botIds.length > 0) {
    await prisma.learnerAccess.updateMany({
      where: { botId: { in: botIds } },
      data: {
        customerEmail: null,
        discordUserId: null,
        claimToken: null,
        claimTokenExpiresAt: null,
        stripeCustomerId: null,
        inviteUrl: null,
      },
    });
  }

  await prisma.organization.update({
    where: { id: organizationId },
    data: { deletedAt: new Date() },
  });
}

/**
 * Soft-delete compte utilisateur : pour chaque membership OWNER, soft-delete
 * l’orga si seul OWNER restant, sinon retire la membership ; puis anonymise
 * le user + invalide sessions.
 * Stripe SaaS Discelyn doit déjà être annulé par l’appelant pour les orgs concernées.
 */
export async function softDeleteUserAccount(input: {
  userId: string;
  email: string | null;
}): Promise<void> {
  const memberships = await prisma.organizationMembership.findMany({
    where: { userId: input.userId },
    select: {
      id: true,
      role: true,
      organizationId: true,
    },
  });

  for (const membership of memberships) {
    if (membership.role === "OWNER") {
      const otherOwners = await prisma.organizationMembership.count({
        where: {
          organizationId: membership.organizationId,
          role: "OWNER",
          userId: { not: input.userId },
        },
      });
      if (otherOwners === 0) {
        await softDeleteOrganization(membership.organizationId);
        continue;
      }
    }
    await prisma.organizationMembership.delete({
      where: { id: membership.id },
    });
  }

  await prisma.analyticsEvent.deleteMany({ where: { userId: input.userId } });
  await prisma.cookieConsentLog.updateMany({
    where: { userId: input.userId },
    data: { userId: null },
  });
  if (input.email) {
    await prisma.lead.deleteMany({ where: { email: input.email } });
  }

  const deletedAt = new Date();

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
