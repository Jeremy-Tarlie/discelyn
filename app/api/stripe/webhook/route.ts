import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import type { PlanId } from "@/lib/plans";
import { PLANS } from "@/lib/plans";

export const runtime = "nodejs";

function planFromPriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  for (const plan of Object.values(PLANS)) {
    if (!plan.stripePriceEnvKey) continue;
    const envPrice = process.env[plan.stripePriceEnvKey];
    if (envPrice && envPrice === priceId) {
      return plan.id;
    }
  }
  return null;
}

function planFromMetadata(metadata: Stripe.Metadata | null): PlanId | null {
  const raw = metadata?.planId;
  if (raw === "STARTER" || raw === "PRO" || raw === "BUSINESS") {
    return raw;
  }
  return null;
}

async function syncSubscription(stripeSubscription: Stripe.Subscription) {
  const userId = stripeSubscription.metadata.userId;
  if (!userId) return;

  const priceId = stripeSubscription.items.data[0]?.price.id ?? null;
  const plan =
    planFromMetadata(stripeSubscription.metadata) ??
    planFromPriceId(priceId) ??
    "STARTER";

  const statusMap: Record<string, "ACTIVE" | "PAST_DUE" | "CANCELED" | "INCOMPLETE" | "TRIALING"> =
    {
      active: "ACTIVE",
      past_due: "PAST_DUE",
      canceled: "CANCELED",
      incomplete: "INCOMPLETE",
      incomplete_expired: "CANCELED",
      trialing: "TRIALING",
      unpaid: "PAST_DUE",
      paused: "CANCELED",
    };

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
      status: statusMap[stripeSubscription.status] ?? "ACTIVE",
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
      status: statusMap[stripeSubscription.status] ?? "ACTIVE",
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
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Webhook non configuré" },
      { status: 400 }
    );
  }

  const rawBody = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
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
      const userId = deleted.metadata.userId;
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
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
