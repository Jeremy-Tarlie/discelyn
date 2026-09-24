import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireUser, getUserSubscription } from "@/lib/access";
import { getStripe } from "@/lib/stripe";
import {
  getOneShotStripePriceId,
  getStripePriceId,
  type OneShotOfferId,
  type PlanId,
} from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { checkoutSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { trackEvent } from "@/lib/analytics";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";

function isOneShotOffer(offerId: string): offerId is OneShotOfferId {
  return offerId === "SETUP" || offerId === "DIAGNOSTIC";
}

export async function POST(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "stripe-checkout",
    limit: 10,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: tApi(locale, "unauthenticated") }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: tApi(locale, "invalidJson") }, { status: 400 });
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: tApi(locale, "invalidOffer") }, { status: 400 });
  }

  const offerId = parsed.data.planId;
  const oneShot = isOneShotOffer(offerId);
  const priceId = oneShot
    ? getOneShotStripePriceId(offerId)
    : getStripePriceId(offerId as PlanId);

  if (!priceId) {
    return NextResponse.json(
      { error: tApi(locale, "priceNotConfigured") },
      { status: 500 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const subscription = await getUserSubscription(user.id);

  if (!oneShot) {
    const blockingStatuses = new Set(["ACTIVE", "TRIALING", "PAST_DUE"]);
    if (
      subscription.stripeSubscriptionId &&
      blockingStatuses.has(subscription.status)
    ) {
      return NextResponse.json(
        { error: tApi(locale, "alreadySubscribed") },
        { status: 409 }
      );
    }
  }

  const stripe = getStripe();

  let customerId = subscription.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: user.name ?? undefined,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await prisma.subscription.update({
      where: { userId: user.id },
      data: { stripeCustomerId: customerId },
    });
  }

  await trackEvent({
    name: "checkout_started",
    userId: user.id,
    path: "/api/stripe/checkout",
    meta: { offerId },
  });

  const successPath =
    offerId === "DIAGNOSTIC"
      ? "/dashboard?diagnostic=1"
      : offerId === "SETUP"
        ? "/dashboard?setup=1"
        : "/dashboard/billing?success=1";

  const session = oneShot
    ? await stripe.checkout.sessions.create({
        mode: "payment",
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${appUrl}${successPath}`,
        cancel_url: `${appUrl}/#offres?canceled=1`,
        allow_promotion_codes: true,
        metadata: {
          userId: user.id,
          planId: offerId,
        },
      })
    : await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${appUrl}${successPath}`,
        cancel_url: `${appUrl}/#offres?canceled=1`,
        allow_promotion_codes: true,
        metadata: {
          userId: user.id,
          planId: offerId,
        },
        subscription_data: {
          metadata: {
            userId: user.id,
            planId: offerId,
          },
        },
      });

  if (!session.url) {
    return NextResponse.json(
      { error: tApi(locale, "stripeSessionFailed") },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: session.url });
}
