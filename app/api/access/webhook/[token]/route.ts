import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { requireUnsealSecret } from "@/lib/token-crypto";
import { extractDiscordUserIdFromSession } from "@/lib/learner-access-parse";
import {
  shouldOpenAccessFromCheckout,
  shouldRevokeOnSubscriptionStatus,
} from "@/lib/access-lifecycle-pure";
import {
  openLearnerAccessFromCheckout,
  recordSubscriptionEvent,
  revokeByPaymentIntentId,
  revokeBySubscriptionId,
} from "@/lib/learner-access";
import { rateLimit } from "@/lib/rate-limit";
import {
  claimStripeEvent,
  releaseStripeEventClaim,
} from "@/lib/stripe-idempotency";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ token: string }>;
};

function asCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): string | null {
  if (!customer) return null;
  if (typeof customer === "string") return customer;
  if ("deleted" in customer && customer.deleted) return null;
  return customer.id;
}

async function resolvePriceId(input: {
  session: Stripe.Checkout.Session;
  apiKey: string | null;
}): Promise<string | null> {
  const meta =
    input.session.metadata?.botly_price_id ??
    input.session.metadata?.stripe_price_id ??
    input.session.metadata?.priceId;
  if (meta && meta.startsWith("price_")) return meta;

  if (!input.apiKey) return null;

  const stripe = new Stripe(input.apiKey, {
    apiVersion: "2025-08-27.basil",
    typescript: true,
  });
  const full = await stripe.checkout.sessions.retrieve(input.session.id, {
    expand: ["line_items.data.price"],
  });
  const price = full.line_items?.data[0]?.price;
  if (price && typeof price === "object" && "id" in price) {
    return price.id;
  }
  return null;
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  orgUserId: string,
  apiKey: string | null
): Promise<void> {
  if (
    !shouldOpenAccessFromCheckout({
      paymentStatus: session.payment_status,
    })
  ) {
    return;
  }

  const priceId = await resolvePriceId({ session, apiKey });
  if (!priceId) {
    console.warn(
      `[access-webhook] price introuvable session=${session.id}`
    );
    return;
  }

  const product = await prisma.accessProduct.findFirst({
    where: {
      userId: orgUserId,
      stripePriceId: priceId,
      active: true,
    },
    include: {
      bot: { select: { id: true, guildId: true, status: true } },
    },
  });

  if (!product?.bot.guildId) {
    console.warn(
      `[access-webhook] produit inconnu ou guild manquante price=${priceId}`
    );
    return;
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  const affiliateCode =
    session.metadata?.botly_affiliate ??
    session.client_reference_id ??
    null;
  let affiliateId: string | null = null;
  if (affiliateCode) {
    const aff = await prisma.affiliate.findFirst({
      where: {
        userId: orgUserId,
        code: affiliateCode,
        active: true,
      },
      select: { id: true },
    });
    affiliateId = aff?.id ?? null;
  }

  const result = await openLearnerAccessFromCheckout({
    productId: product.id,
    botId: product.botId,
    guildId: product.bot.guildId,
    customerEmail:
      session.customer_details?.email ?? session.customer_email ?? null,
    discordUserIdFromMetadata: extractDiscordUserIdFromSession(session),
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: paymentIntentId,
    stripeSubscriptionId: subscriptionId,
    stripeCustomerId: asCustomerId(session.customer),
    amountTotal: session.amount_total ?? null,
    amountSubtotal: session.amount_subtotal ?? null,
    currency: session.currency ?? null,
    affiliateId,
    userId: orgUserId,
  });

  if (result.soldOut) {
    console.error(
      `[access-webhook] OVERSOLD product=${product.id} session=${session.id} — remboursement auto tenté`
    );
  }
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription): Promise<void> {
  const status = sub.status;
  await recordSubscriptionEvent(sub.id, "subscription_updated", {
    status,
  });
  if (shouldRevokeOnSubscriptionStatus(status)) {
    await revokeBySubscriptionId(sub.id, `subscription_${status}`);
  }
}

function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const raw = invoice as Stripe.Invoice & {
    subscription?: string | { id: string } | null;
  };
  const sub = raw.subscription;
  if (!sub) return null;
  if (typeof sub === "string") return sub;
  if (typeof sub === "object" && "id" in sub) return sub.id;
  return null;
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const sub = subscriptionIdFromInvoice(invoice);
  if (!sub) return;
  await recordSubscriptionEvent(sub, "invoice_paid", {
    invoiceId: invoice.id ?? null,
    amountPaid: invoice.amount_paid ?? null,
  });
}

async function handleInvoiceFailed(invoice: Stripe.Invoice): Promise<void> {
  const sub = subscriptionIdFromInvoice(invoice);
  if (!sub) return;
  await recordSubscriptionEvent(sub, "invoice_payment_failed", {
    invoiceId: invoice.id ?? null,
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const limited = await rateLimit(request, {
    namespace: "access-org-webhook",
    limit: 120,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const { token } = await context.params;
  const config = await prisma.orgStripeConfig.findUnique({
    where: { webhookPathToken: token },
  });
  if (!config) {
    return NextResponse.json({ error: "unknown webhook" }, { status: 404 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  let webhookSecret: string;
  let apiKey: string | null = null;
  try {
    webhookSecret = requireUnsealSecret(config.webhookSecret, "whsec_");
    if (config.stripeSecretKey) {
      apiKey = requireUnsealSecret(config.stripeSecretKey, "sk_");
    }
  } catch {
    return NextResponse.json({ error: "secret unseal failed" }, { status: 500 });
  }

  const rawBody = await request.text();
  const verifier = new Stripe(apiKey ?? "sk_test_webhook_verify_only", {
    apiVersion: "2025-08-27.basil",
    typescript: true,
  });

  let event: Stripe.Event;
  try {
    event = verifier.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const claimed = await claimStripeEvent(event);
  if (!claimed) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
          config.userId,
          apiKey
        );
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await revokeBySubscriptionId(sub.id, "subscription_ended");
        break;
      }
      case "customer.subscription.updated": {
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription
        );
        break;
      }
      case "invoice.paid": {
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      }
      case "invoice.payment_failed": {
        await handleInvoiceFailed(event.data.object as Stripe.Invoice);
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const pi =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id ?? null;
        if (pi) {
          await revokeByPaymentIntentId(pi, "refund");
        }
        break;
      }
      default:
        break;
    }
  } catch (error) {
    await releaseStripeEventClaim(event.id);
    console.error("[access-webhook] handler error", error);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
