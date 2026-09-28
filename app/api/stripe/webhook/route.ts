import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { enforcePlanLimits } from "@/lib/plan-enforcement";
import { notifyRuntimeReload } from "@/lib/runtime-notify";
import { trackEvent } from "@/lib/analytics";
import {
  mapStripeSubscriptionStatus,
  resolveSubscriptionPlan,
} from "@/lib/stripe-plans";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";
import {
  claimStripeEvent,
  releaseStripeEventClaim,
} from "@/lib/stripe-idempotency";

export const runtime = "nodejs";

/**
 * Résout l’organisation pour un abonnement Stripe SaaS.
 * Priorité : metadata.organizationId → subscription.organizationId →
 * legacy metadata.userId via membership OWNER.
 */
async function resolveOrganizationIdFromSubscription(
  stripeSubscription: Stripe.Subscription
): Promise<string | null> {
  if (stripeSubscription.metadata.organizationId) {
    return stripeSubscription.metadata.organizationId;
  }

  const customerId =
    typeof stripeSubscription.customer === "string"
      ? stripeSubscription.customer
      : stripeSubscription.customer.id;

  const existing = await prisma.subscription.findFirst({
    where: {
      OR: [
        { stripeSubscriptionId: stripeSubscription.id },
        { stripeCustomerId: customerId },
      ],
    },
    select: { organizationId: true },
  });
  if (existing?.organizationId) return existing.organizationId;

  // Legacy checkouts : metadata.userId → org OWNER active.
  const legacyUserId = stripeSubscription.metadata.userId;
  if (legacyUserId) {
    const membership = await prisma.organizationMembership.findFirst({
      where: {
        userId: legacyUserId,
        role: "OWNER",
        organization: { deletedAt: null },
      },
      orderBy: { createdAt: "asc" },
      select: { organizationId: true },
    });
    return membership?.organizationId ?? null;
  }

  return null;
}

async function syncSubscription(stripeSubscription: Stripe.Subscription) {
  const organizationId =
    await resolveOrganizationIdFromSubscription(stripeSubscription);
  if (!organizationId) return;

  const priceId = stripeSubscription.items.data[0]?.price.id ?? null;
  const existing = await prisma.subscription.findUnique({
    where: { organizationId },
    select: { plan: true },
  });

  const { plan, conserved } = resolveSubscriptionPlan({
    metadata: stripeSubscription.metadata,
    priceId,
    existingPlan: existing?.plan,
  });

  if (conserved) {
    console.warn(
      `[stripe] plan inconnu pour org=${organizationId} price=${priceId ?? "null"} — conservation ${plan}`
    );
  }

  const mappedStatus = mapStripeSubscriptionStatus(stripeSubscription.status);

  const periodEndUnix = (
    stripeSubscription as Stripe.Subscription & {
      current_period_end?: number;
    }
  ).current_period_end;

  await prisma.subscription.upsert({
    where: { organizationId },
    create: {
      organizationId,
      plan,
      status: mappedStatus,
      stripeCustomerId:
        typeof stripeSubscription.customer === "string"
          ? stripeSubscription.customer
          : stripeSubscription.customer.id,
      stripeSubscriptionId: stripeSubscription.id,
      stripePriceId: priceId,
      currentPeriodEnd: periodEndUnix
        ? new Date(periodEndUnix * 1000)
        : null,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    },
    update: {
      plan,
      status: mappedStatus,
      stripeCustomerId:
        typeof stripeSubscription.customer === "string"
          ? stripeSubscription.customer
          : stripeSubscription.customer.id,
      stripeSubscriptionId: stripeSubscription.id,
      stripePriceId: priceId,
      currentPeriodEnd: periodEndUnix
        ? new Date(periodEndUnix * 1000)
        : null,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    },
  });

  await enforcePlanLimits(organizationId, plan);
  await notifyRuntimeReload({ organizationId });
}

export async function POST(request: NextRequest) {
  const locale = getRequestLocale(request);
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: tApi(locale, "webhookNotConfigured") },
      { status: 400 }
    );
  }

  const rawBody = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json(
      { error: tApi(locale, "invalidSignature") },
      { status: 400 }
    );
  }

  const claimed = await claimStripeEvent(event);
  if (!claimed) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const metaUserId = session.metadata?.userId ?? null;
        await trackEvent({
          name: "checkout_completed",
          userId: metaUserId,
          meta: {
            mode: session.mode,
            planId: session.metadata?.planId ?? null,
            organizationId: session.metadata?.organizationId ?? null,
          },
        });
        if (session.mode === "subscription" && session.subscription) {
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
          const subscription = await stripe.subscriptions.retrieve(subId);
          const orgMeta =
            session.metadata?.organizationId ??
            subscription.metadata.organizationId;
          if (orgMeta) {
            subscription.metadata = {
              ...subscription.metadata,
              organizationId: orgMeta,
              planId: session.metadata?.planId ?? subscription.metadata.planId,
            };
          } else if (session.metadata?.userId) {
            // Legacy checkout : propage userId pour résolution OWNER.
            subscription.metadata = {
              ...subscription.metadata,
              userId: session.metadata.userId,
              planId: session.metadata.planId ?? subscription.metadata.planId,
            };
          }
          await syncSubscription(subscription);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      case "customer.subscription.deleted": {
        const deleted = event.data.object as Stripe.Subscription;
        const organizationId =
          await resolveOrganizationIdFromSubscription(deleted);
        if (organizationId) {
          await prisma.subscription.update({
            where: { organizationId },
            data: {
              plan: "FREE",
              status: "CANCELED",
              stripeSubscriptionId: null,
              stripePriceId: null,
              cancelAtPeriodEnd: false,
            },
          });
          await enforcePlanLimits(organizationId, "FREE");
          await notifyRuntimeReload({ organizationId });
        }
        break;
      }
      default:
        break;
    }
  } catch (error) {
    await releaseStripeEventClaim(event.id);
    console.error("[stripe-webhook] handler error", error);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
