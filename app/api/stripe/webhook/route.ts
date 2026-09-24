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

async function resolveUserIdFromSubscription(
  stripeSubscription: Stripe.Subscription
): Promise<string | null> {
  if (stripeSubscription.metadata.userId) {
    return stripeSubscription.metadata.userId;
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
    select: { userId: true },
  });
  return existing?.userId ?? null;
}

async function syncSubscription(stripeSubscription: Stripe.Subscription) {
  const userId = await resolveUserIdFromSubscription(stripeSubscription);
  if (!userId) return;

  const priceId = stripeSubscription.items.data[0]?.price.id ?? null;
  const existing = await prisma.subscription.findUnique({
    where: { userId },
    select: { plan: true },
  });

  const { plan, conserved } = resolveSubscriptionPlan({
    metadata: stripeSubscription.metadata,
    priceId,
    existingPlan: existing?.plan,
  });

  if (conserved) {
    console.warn(
      `[stripe] plan inconnu pour user=${userId} price=${priceId ?? "null"} — conservation ${plan}`
    );
  }

  const mappedStatus = mapStripeSubscriptionStatus(stripeSubscription.status);

  const periodEndUnix = (
    stripeSubscription as Stripe.Subscription & {
      current_period_end?: number;
    }
  ).current_period_end;

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
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

  await enforcePlanLimits(userId, plan);
  await notifyRuntimeReload({ userId });
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
          },
        });
        if (session.mode === "subscription" && session.subscription) {
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
          const subscription = await stripe.subscriptions.retrieve(subId);
          if (session.metadata?.userId) {
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
        const userId = await resolveUserIdFromSubscription(deleted);
        if (userId) {
          await prisma.subscription.update({
            where: { userId },
            data: {
              plan: "FREE",
              status: "CANCELED",
              stripeSubscriptionId: null,
              stripePriceId: null,
              cancelAtPeriodEnd: false,
            },
          });
          await enforcePlanLimits(userId, "FREE");
          await notifyRuntimeReload({ userId });
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
