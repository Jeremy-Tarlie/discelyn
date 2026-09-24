import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import {
  appBaseUrl,
  newWebhookPathToken,
  orgWebhookUrl,
} from "@/lib/learner-access";
import {
  isTokenEncryptionEnabled,
  requireSealToken,
  requireUnsealSecret,
} from "@/lib/token-crypto";

const ACCESS_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  "checkout.session.completed",
  "customer.subscription.deleted",
  "customer.subscription.updated",
  "invoice.paid",
  "invoice.payment_failed",
  "charge.refunded",
];

export function stripeFromSecretKey(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: "2025-08-27.basil",
    typescript: true,
  });
}

export async function getOrgStripeClient(userId: string): Promise<Stripe | null> {
  const config = await prisma.orgStripeConfig.findUnique({
    where: { userId },
    select: { stripeSecretKey: true },
  });
  if (!config?.stripeSecretKey) return null;
  const key = requireUnsealSecret(config.stripeSecretKey, "sk_ formation");
  return stripeFromSecretKey(key);
}

/**
 * Setup 1 clic : enregistre la sk_ (chiffrée), crée (ou réutilise) le webhook Stripe → Botly.
 */
export async function bootstrapOrgStripe(input: {
  userId: string;
  stripeSecretKey: string;
  label?: string | null;
}): Promise<{ webhookUrl: string; createdWebhook: boolean }> {
  if (!isTokenEncryptionEnabled()) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY requis avant de brancher le Stripe formation"
    );
  }

  const stripe = stripeFromSecretKey(input.stripeSecretKey);

  await stripe.balance.retrieve();

  const existing = await prisma.orgStripeConfig.findUnique({
    where: { userId: input.userId },
    select: { webhookPathToken: true, webhookSecret: true },
  });
  const pathToken = existing?.webhookPathToken ?? newWebhookPathToken();
  const webhookUrl = orgWebhookUrl(pathToken);

  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  let endpoint = endpoints.data.find((e) => e.url === webhookUrl);
  let createdWebhook = false;
  let signingSecret: string | null = null;

  if (!endpoint) {
    endpoint = await stripe.webhookEndpoints.create({
      url: webhookUrl,
      enabled_events: ACCESS_EVENTS,
      description: "Botly — accès Discord formation",
    });
    createdWebhook = true;
    signingSecret = endpoint.secret ?? null;
  } else {
    await stripe.webhookEndpoints.update(endpoint.id, {
      enabled_events: ACCESS_EVENTS,
    });
  }

  if (!signingSecret && !existing?.webhookSecret) {
    if (endpoint) {
      await stripe.webhookEndpoints.del(endpoint.id);
    }
    endpoint = await stripe.webhookEndpoints.create({
      url: webhookUrl,
      enabled_events: ACCESS_EVENTS,
      description: "Botly — accès Discord formation",
    });
    createdWebhook = true;
    signingSecret = endpoint.secret ?? null;
  }

  if (!signingSecret && !existing?.webhookSecret) {
    throw new Error("Impossible d’obtenir le secret webhook Stripe");
  }

  const sealedKey = requireSealToken(input.stripeSecretKey, "sk_");
  const sealedWhsec = signingSecret
    ? requireSealToken(signingSecret, "whsec_")
    : existing!.webhookSecret;

  await prisma.orgStripeConfig.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      webhookPathToken: pathToken,
      webhookSecret: sealedWhsec,
      stripeSecretKey: sealedKey,
      label: input.label ?? "Stripe formation",
    },
    update: {
      webhookSecret: sealedWhsec,
      stripeSecretKey: sealedKey,
      label: input.label ?? "Stripe formation",
    },
  });

  return { webhookUrl, createdWebhook };
}

export async function listOrgPrices(userId: string): Promise<
  Array<{
    id: string;
    label: string;
    unitAmount: number | null;
    currency: string;
    type: string;
  }>
> {
  const stripe = await getOrgStripeClient(userId);
  if (!stripe) return [];

  const prices = await stripe.prices.list({
    active: true,
    limit: 50,
    expand: ["data.product"],
  });

  return prices.data.map((price) => {
    const product = price.product;
    const productName =
      typeof product === "object" &&
      product &&
      !("deleted" in product && product.deleted)
        ? product.name
        : price.id;
    const amount =
      price.unit_amount != null
        ? (price.unit_amount / 100).toFixed(2)
        : "?";
    return {
      id: price.id,
      label: `${productName} — ${amount} ${price.currency.toUpperCase()}${
        price.type === "recurring" && price.recurring
          ? ` / ${price.recurring.interval}`
          : ""
      }`,
      unitAmount: price.unit_amount,
      currency: price.currency,
      type: price.type,
    };
  });
}

export async function detectBillingMode(
  userId: string,
  stripePriceId: string
): Promise<"ONE_TIME" | "RECURRING"> {
  const stripe = await getOrgStripeClient(userId);
  if (!stripe) return "ONE_TIME";
  try {
    const price = await stripe.prices.retrieve(stripePriceId);
    return price.type === "recurring" ? "RECURRING" : "ONE_TIME";
  } catch {
    return "ONE_TIME";
  }
}

export async function createAccessPaymentLink(input: {
  userId: string;
  stripePriceId: string;
  productName: string;
  customText?: string | null;
}): Promise<{ url: string; id: string }> {
  const stripe = await getOrgStripeClient(input.userId);
  if (!stripe) {
    throw new Error("Stripe formation non configuré");
  }

  const successUrl = `${appBaseUrl()}/claim/session/{CHECKOUT_SESSION_ID}`;
  const price = await stripe.prices.retrieve(input.stripePriceId);
  const isRecurring = price.type === "recurring";

  const link = await stripe.paymentLinks.create({
    line_items: [{ price: input.stripePriceId, quantity: 1 }],
    after_completion: {
      type: "redirect",
      redirect: { url: successUrl },
    },
    allow_promotion_codes: true,
    metadata: {
      botly_price_id: input.stripePriceId,
      botly_product: input.productName.slice(0, 400),
    },
    ...(isRecurring
      ? {
          subscription_data: {
            metadata: {
              botly_price_id: input.stripePriceId,
            },
          },
        }
      : {}),
    ...(input.customText
      ? {
          custom_text: {
            submit: { message: input.customText.slice(0, 1200) },
          },
        }
      : {}),
  });

  if (!link.url) {
    throw new Error("Payment Link sans URL");
  }
  return { url: link.url, id: link.id };
}
