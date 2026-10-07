import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type Stripe from "stripe";
import { requireOrg, getOrgSubscription } from "@/lib/access";
import { getStripe } from "@/lib/stripe";
import {
  getStripePriceId,
  type BillingInterval,
  type PlanId,
} from "@/lib/plans";
import { changePlanSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";
import { enforcePlanLimits } from "@/lib/plan-enforcement";
import { notifyRuntimeReload } from "@/lib/runtime-notify";
import {
  mapStripeSubscriptionStatus,
  resolveSubscriptionPlan,
} from "@/lib/stripe-plans";
import { prisma } from "@/lib/prisma";
import { ownerHasMfaEnabled } from "@/lib/mfa-guards";
import { deniedAuthResponse } from "@/lib/http-auth";

async function assertPriceMatchesInterval(
  stripe: Stripe,
  priceId: string,
  interval: BillingInterval
): Promise<boolean> {
  const price = await stripe.prices.retrieve(priceId);
  if (!price.active || price.type !== "recurring") return false;
  return price.recurring?.interval === interval;
}

async function syncLocalSubscription(
  organizationId: string,
  stripeSubscription: Stripe.Subscription
) {
  const priceId = stripeSubscription.items.data[0]?.price.id ?? null;
  const existing = await prisma.subscription.findUnique({
    where: { organizationId },
    select: { plan: true },
  });
  const { plan } = resolveSubscriptionPlan({
    metadata: stripeSubscription.metadata,
    priceId,
    existingPlan: existing?.plan,
  });
  const periodEndUnix = (
    stripeSubscription as Stripe.Subscription & {
      current_period_end?: number;
    }
  ).current_period_end;

  await prisma.subscription.update({
    where: { organizationId },
    data: {
      plan,
      status: mapStripeSubscriptionStatus(stripeSubscription.status),
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
  return plan;
}

export async function POST(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "stripe-change-plan",
    limit: 10,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const org = await requireOrg({ minRole: "OWNER" });
  if (!org) {
    return deniedAuthResponse(locale);
  }

  if (!(await ownerHasMfaEnabled(org.userId))) {
    return NextResponse.json(
      { error: tApi(locale, "mfaRequiredForOwner") },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: tApi(locale, "invalidJson") },
      { status: 400 }
    );
  }

  const parsed = changePlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: tApi(locale, "invalidOffer") },
      { status: 400 }
    );
  }

  const planId = parsed.data.planId as PlanId;
  const interval: BillingInterval = parsed.data.interval;
  const priceId = getStripePriceId(planId, interval);
  if (!priceId) {
    return NextResponse.json(
      { error: tApi(locale, "priceNotConfigured") },
      { status: 500 }
    );
  }

  const subscription = await getOrgSubscription(org.organizationId);
  const activeStatuses = new Set(["ACTIVE", "TRIALING", "PAST_DUE"]);
  if (
    !subscription.stripeSubscriptionId ||
    !activeStatuses.has(subscription.status)
  ) {
    return NextResponse.json(
      { error: tApi(locale, "noActiveSubscription") },
      { status: 400 }
    );
  }

  if (
    subscription.plan === planId &&
    subscription.stripePriceId === priceId
  ) {
    return NextResponse.json(
      { error: tApi(locale, "samePlan") },
      { status: 409 }
    );
  }

  const stripe = getStripe();
  const ok = await assertPriceMatchesInterval(stripe, priceId, interval);
  if (!ok) {
    console.error(
      `[stripe] change-plan price mismatch plan=${planId} interval=${interval} price=${priceId}`
    );
    return NextResponse.json(
      { error: tApi(locale, "priceNotConfigured") },
      { status: 500 }
    );
  }

  try {
    const current = await stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId
    );
    const itemId = current.items.data[0]?.id;
    if (!itemId) {
      return NextResponse.json(
        { error: tApi(locale, "changePlanFailed") },
        { status: 500 }
      );
    }

    const updated = await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        items: [{ id: itemId, price: priceId }],
        proration_behavior: "create_prorations",
        cancel_at_period_end: false,
        metadata: {
          ...current.metadata,
          organizationId: org.organizationId,
          userId: org.userId,
          planId,
          billingInterval: interval,
        },
      }
    );

    const plan = await syncLocalSubscription(org.organizationId, updated);
    const { logUserActivity } = await import("@/lib/activity-log");
    await logUserActivity({
      userId: org.userId,
      action: "plan_changed",
      meta: { plan, interval },
    });
    return NextResponse.json({ ok: true, plan });
  } catch (error) {
    console.error("[stripe] change-plan failed", error);
    return NextResponse.json(
      { error: tApi(locale, "changePlanFailed") },
      { status: 500 }
    );
  }
}
