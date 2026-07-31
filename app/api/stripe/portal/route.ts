import { NextResponse } from "next/server";
import { requireUser, getUserSubscription } from "@/lib/access";
import { getStripe } from "@/lib/stripe";

export async function POST() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const subscription = await getUserSubscription(user.id);
  if (!subscription.stripeCustomerId) {
    return NextResponse.json(
      { error: "Aucun client Stripe. Passe d'abord sur un plan payant." },
      { status: 400 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const stripe = getStripe();

  const portal = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${appUrl}/dashboard/billing`,
  });

  return NextResponse.json({ url: portal.url });
}
