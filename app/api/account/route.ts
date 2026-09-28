import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { softDeleteUserAccount } from "@/lib/soft-delete-ops";
import { getStripe } from "@/lib/stripe";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";
import type { Locale } from "@/i18n/config";

/** Export RGPD — portable JSON des données personnelles (sans données tiers détaillées). */
export async function GET(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "account-export",
    limit: 5,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: tApi(locale, "unauthenticated") }, { status: 401 });
  }

  const full = await prisma.user.findFirst({
    where: { id: user.id, deletedAt: null },
    include: {
      memberships: {
        where: { organization: { deletedAt: null } },
        select: {
          id: true,
          role: true,
          createdAt: true,
          organization: {
            select: {
              id: true,
              name: true,
              createdAt: true,
              updatedAt: true,
              subscription: true,
              bots: {
                where: { deletedAt: null },
                select: {
                  id: true,
                  name: true,
                  description: true,
                  status: true,
                  guildId: true,
                  enabledModules: true,
                  config: true,
                  customCommands: true,
                  createdAt: true,
                  updatedAt: true,
                  _count: { select: { warnings: true } },
                },
              },
            },
          },
        },
      },
      accounts: {
        select: {
          provider: true,
          providerAccountId: true,
          type: true,
        },
      },
    },
  });

  if (!full) {
    return NextResponse.json({ error: tApi(locale, "accountNotFound") }, { status: 404 });
  }

  const leads = full.email
    ? await prisma.lead.findMany({
        where: { email: full.email },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    purpose: "RGPD — droit d'accès / portabilité",
    note:
      "Les warns de modération concernent d'autres utilisateurs Discord ; seul le nombre par config est exporté.",
    user: {
      id: full.id,
      name: full.name,
      email: full.email,
      discordId: full.discordId,
      image: full.image,
      createdAt: full.createdAt,
      updatedAt: full.updatedAt,
    },
    accounts: full.accounts,
    oauthNote:
      "Des jetons OAuth Discord (access/refresh) sont stockés pour la session NextAuth — non inclus dans cet export.",
    memberships: full.memberships.map((m) => ({
      id: m.id,
      role: m.role,
      createdAt: m.createdAt,
      organization: {
        id: m.organization.id,
        name: m.organization.name,
        createdAt: m.organization.createdAt,
        updatedAt: m.organization.updatedAt,
        subscription: m.organization.subscription,
        bots: m.organization.bots.map((bot) => ({
          id: bot.id,
          name: bot.name,
          description: bot.description,
          status: bot.status,
          guildId: bot.guildId,
          enabledModules: bot.enabledModules,
          config: bot.config,
          customCommands: bot.customCommands,
          createdAt: bot.createdAt,
          updatedAt: bot.updatedAt,
          moderationWarningCount: bot._count.warnings,
        })),
      },
    })),
    leads,
  });
}

async function cancelStripeSubscription(
  locale: Locale,
  stripeSubscriptionId: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!stripeSubscriptionId) return { ok: true };
  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      ok: false,
      error:
        "Abonnement Stripe actif mais STRIPE_SECRET_KEY manquant — suppression refusée.",
    };
  }
  try {
    const stripe = getStripe();
    await stripe.subscriptions.cancel(stripeSubscriptionId);
    return { ok: true };
  } catch (error) {
    console.error("[account] stripe cancel failed", error);
    return {
      ok: false,
      error: tApi(locale, "stripeCancelFailed"),
    };
  }
}

async function deleteStripeCustomer(stripeCustomerId: string | null): Promise<void> {
  if (!stripeCustomerId || !process.env.STRIPE_SECRET_KEY) return;
  try {
    const stripe = getStripe();
    await stripe.customers.del(stripeCustomerId);
  } catch (error) {
    console.error("[account] stripe customer delete failed", error);
  }
}

/**
 * Soft-delete compte : cancel Stripe SaaS des orgs où l’user est seul OWNER
 * → revoke Discord → purge secrets formation → anonymisation.
 */
export async function DELETE(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "account-delete",
    limit: 3,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: tApi(locale, "unauthenticated") }, { status: 401 });
  }

  const account = await prisma.user.findFirst({
    where: { id: user.id, deletedAt: null },
    select: { email: true },
  });
  if (!account) {
    return NextResponse.json({ error: tApi(locale, "accountNotFound") }, { status: 404 });
  }

  const ownerMemberships = await prisma.organizationMembership.findMany({
    where: { userId: user.id, role: "OWNER" },
    select: { organizationId: true },
  });

  const stripeCustomersToDelete: string[] = [];

  for (const membership of ownerMemberships) {
    const otherOwners = await prisma.organizationMembership.count({
      where: {
        organizationId: membership.organizationId,
        role: "OWNER",
        userId: { not: user.id },
      },
    });
    if (otherOwners > 0) continue;

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId: membership.organizationId },
      select: { stripeSubscriptionId: true, stripeCustomerId: true },
    });

    const cancel = await cancelStripeSubscription(
      locale,
      subscription?.stripeSubscriptionId ?? null
    );
    if (!cancel.ok) {
      return NextResponse.json({ error: cancel.error }, { status: 502 });
    }
    if (subscription?.stripeCustomerId) {
      stripeCustomersToDelete.push(subscription.stripeCustomerId);
    }
  }

  await softDeleteUserAccount({
    userId: user.id,
    email: account.email,
  });

  for (const customerId of stripeCustomersToDelete) {
    await deleteStripeCustomer(customerId);
  }

  return NextResponse.json({ ok: true });
}
