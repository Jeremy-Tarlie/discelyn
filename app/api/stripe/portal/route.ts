import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireUser, getUserSubscription } from "@/lib/access";
import { getStripe } from "@/lib/stripe";
import { rateLimit } from "@/lib/rate-limit";
import { trackEvent } from "@/lib/analytics";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";

export async function POST(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "stripe-portal",
    limit: 10,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: tApi(locale, "unauthenticated") }, { status: 401 });
  }

  const subscription = await getUserSubscription(user.id);
  if (!subscription.stripeCustomerId) {
    return NextResponse.json(
      { error: tApi(locale, "noStripeCustomer") },
      { status: 400 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const stripe = getStripe();

  const portal = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${appUrl}/dashboard/billing`,
  });

  await trackEvent({
    name: "portal_opened",
    userId: user.id,
    path: "/api/stripe/portal",
  });

  return NextResponse.json({ url: portal.url });
}
