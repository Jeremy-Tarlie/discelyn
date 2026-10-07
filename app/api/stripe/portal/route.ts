import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireOrg, getOrgSubscription } from "@/lib/access";
import { getStripe } from "@/lib/stripe";
import { rateLimit } from "@/lib/rate-limit";
import { trackEvent } from "@/lib/analytics";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";
import { ownerHasMfaEnabled } from "@/lib/mfa-guards";
import { deniedAuthResponse } from "@/lib/http-auth";

export async function POST(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "stripe-portal",
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

  const subscription = await getOrgSubscription(org.organizationId);
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
    userId: org.userId,
    path: "/api/stripe/portal",
    meta: { organizationId: org.organizationId },
  });

  return NextResponse.json({ url: portal.url });
}
