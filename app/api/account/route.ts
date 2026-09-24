import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { deprovisionBot } from "@/lib/provisioning";
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

  const full = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      subscription: true,
      bots: {
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
    subscription: full.subscription,
    leads,
    bots: full.bots.map((bot) => ({
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

/** Suppression du compte, bots, et résiliation Stripe si présent. */
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

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true },
  });

  const subscription = await prisma.subscription.findUnique({
    where: { userId: user.id },
    select: { stripeSubscriptionId: true, stripeCustomerId: true },
  });

  const cancel = await cancelStripeSubscription(
    locale,
    subscription?.stripeSubscriptionId ?? null
  );
  if (!cancel.ok) {
    return NextResponse.json({ error: cancel.error }, { status: 502 });
  }

  const bots = await prisma.bot.findMany({
    where: { userId: user.id },
    select: { id: true, guildId: true },
  });

  // DB d'abord, puis leave Discord — évite que le stop resync la config.
  await prisma.analyticsEvent.deleteMany({ where: { userId: user.id } });
  if (account?.email) {
    await prisma.lead.deleteMany({ where: { email: account.email } });
  }
  await prisma.user.delete({ where: { id: user.id } });

  for (const bot of bots) {
    await deprovisionBot(bot.id, bot.guildId);
  }

  await deleteStripeCustomer(subscription?.stripeCustomerId ?? null);

  return NextResponse.json({ ok: true });
}
