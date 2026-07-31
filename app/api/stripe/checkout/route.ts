import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireUser, getUserSubscription } from "@/lib/access";
import { getStripe } from "@/lib/stripe";
import { getStripePriceId, type PlanId } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { checkoutSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, {
    namespace: "stripe-checkout",
    limit: 10,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Plan invalide" }, { status: 400 });
  }

  const priceId = getStripePriceId(parsed.data.planId as PlanId);
  if (!priceId) {
    return NextResponse.json(
      { error: "Prix Stripe non configuré pour ce plan" },
      { status: 500 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const subscription = await getUserSubscription(user.id);
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

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard/billing?success=1`,
    cancel_url: `${appUrl}/pricing?canceled=1`,
    allow_promotion_codes: true,
    metadata: {
      userId: user.id,
      planId: parsed.data.planId,
    },
    subscription_data: {
      metadata: {
        userId: user.id,
        planId: parsed.data.planId,
      },
    },
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Impossible de créer la session Stripe" },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: session.url });
}
