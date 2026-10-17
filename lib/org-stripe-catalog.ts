import type Stripe from "stripe";
import type { ApiMessageKey } from "@/lib/i18n-api";
import { createAccessPaymentLink, getOrgStripeClient } from "@/lib/org-stripe";
import { prisma } from "@/lib/prisma";

export type CreateOrgStripeOfferInput = {
  organizationId: string;
  name: string;
  amountCents: number;
  currency: "eur" | "usd";
  billingMode: "ONE_TIME" | "RECURRING";
  recurringInterval?: "month" | "year";
};

export type CreateOrgStripeOfferResult = {
  stripeProductId: string;
  stripePriceId: string;
  billingMode: "ONE_TIME" | "RECURRING";
  recurringInterval: "month" | "year" | null;
  amountCents: number;
  currency: string;
};

/** Erreurs catalogue orga → messages API stables (pas de fuite Stripe brute). */
export type OrgStripeCatalogErrorCode =
  | "orgStripeMissing"
  | "invalidData"
  | "invalidStripePrice"
  | "paymentLinkNotFound"
  | "paymentLinkNoPrice"
  | "stripePriceInactive";

export class OrgStripeCatalogError extends Error {
  readonly code: OrgStripeCatalogErrorCode;

  constructor(code: OrgStripeCatalogErrorCode) {
    super(code);
    this.name = "OrgStripeCatalogError";
    this.code = code;
  }

  apiKey(): ApiMessageKey {
    return this.code;
  }
}

/**
 * Extrait un price_… depuis une URL Payment Link / Checkout Stripe connue.
 * Retourne null si le format n’est pas reconnaissable (résolution API ensuite).
 */
export function extractPriceIdFromPaymentLinkUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^price_[a-zA-Z0-9]+$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const fromQuery =
      url.searchParams.get("price") ??
      url.searchParams.get("price_id") ??
      url.searchParams.get("stripe_price_id");
    if (fromQuery && /^price_[a-zA-Z0-9]+$/.test(fromQuery)) return fromQuery;
  } catch {
    /* not a URL */
  }
  return null;
}

async function orgStripe(organizationId: string): Promise<Stripe> {
  const client = await getOrgStripeClient(organizationId);
  if (!client) {
    throw new OrgStripeCatalogError("orgStripeMissing");
  }
  return client;
}

/** Crée Product + Price sur le Stripe orga (pas le SaaS Discelyn). */
export async function createOrgStripeOffer(
  input: CreateOrgStripeOfferInput
): Promise<CreateOrgStripeOfferResult> {
  if (input.amountCents < 50) {
    throw new OrgStripeCatalogError("invalidData");
  }

  const stripe = await orgStripe(input.organizationId);
  const product = await stripe.products.create({
    name: input.name.slice(0, 250),
    metadata: { discelyn: "1" },
  });

  const priceParams: Stripe.PriceCreateParams = {
    product: product.id,
    currency: input.currency,
    unit_amount: input.amountCents,
    metadata: { discelyn: "1" },
  };

  let recurringInterval: "month" | "year" | null = null;
  if (input.billingMode === "RECURRING") {
    const interval = input.recurringInterval;
    if (interval !== "month" && interval !== "year") {
      throw new OrgStripeCatalogError("invalidData");
    }
    priceParams.recurring = { interval };
    recurringInterval = interval;
  }

  const price = await stripe.prices.create(priceParams);

  return {
    stripeProductId: product.id,
    stripePriceId: price.id,
    billingMode: input.billingMode,
    recurringInterval,
    amountCents: input.amountCents,
    currency: input.currency,
  };
}

/**
 * Résout un price_… depuis un id ou une URL Payment Link (via API Stripe orga).
 */
export async function resolveOrgStripePriceId(input: {
  organizationId: string;
  stripePriceId?: string | null;
  paymentLinkUrl?: string | null;
}): Promise<{
  stripePriceId: string;
  billingMode: "ONE_TIME" | "RECURRING";
  amountCents: number | null;
  currency: string | null;
  recurringInterval: "month" | "year" | null;
  existingPaymentLinkUrl: string | null;
  existingPaymentLinkId: string | null;
}> {
  const fromField = input.stripePriceId?.trim() ?? "";
  if (/^price_[a-zA-Z0-9]+$/.test(fromField)) {
    return retrievePriceDetails(input.organizationId, fromField, null, null);
  }

  const url = input.paymentLinkUrl?.trim() ?? "";
  if (!url) {
    throw new OrgStripeCatalogError("invalidStripePrice");
  }

  const embedded = extractPriceIdFromPaymentLinkUrl(url);
  if (embedded) {
    return retrievePriceDetails(input.organizationId, embedded, url, null);
  }

  const stripe = await orgStripe(input.organizationId);
  const links = await stripe.paymentLinks.list({ limit: 100, active: true });
  const match = links.data.find((l) => l.url === url);
  if (!match) {
    throw new OrgStripeCatalogError("paymentLinkNotFound");
  }

  const lineItems = await stripe.paymentLinks.listLineItems(match.id, {
    limit: 1,
  });
  const priceRef = lineItems.data[0]?.price;
  const priceId =
    typeof priceRef === "string"
      ? priceRef
      : priceRef && typeof priceRef === "object"
        ? priceRef.id
        : null;
  if (!priceId) {
    throw new OrgStripeCatalogError("paymentLinkNoPrice");
  }

  return retrievePriceDetails(
    input.organizationId,
    priceId,
    match.url ?? url,
    match.id
  );
}

async function retrievePriceDetails(
  organizationId: string,
  stripePriceId: string,
  existingPaymentLinkUrl: string | null,
  existingPaymentLinkId: string | null
) {
  const stripe = await orgStripe(organizationId);
  const price = await stripe.prices.retrieve(stripePriceId);
  if (!price.active) {
    throw new OrgStripeCatalogError("stripePriceInactive");
  }
  const interval = price.recurring?.interval;
  return {
    stripePriceId: price.id,
    billingMode:
      price.type === "recurring"
        ? ("RECURRING" as const)
        : ("ONE_TIME" as const),
    amountCents: price.unit_amount,
    currency: price.currency,
    recurringInterval:
      interval === "month" || interval === "year" ? interval : null,
    existingPaymentLinkUrl,
    existingPaymentLinkId,
  };
}

/** Après insert DB : Payment Link Discelyn avec metadata product id. */
export async function attachDiscelynPaymentLink(input: {
  organizationId: string;
  accessProductId: string;
  stripePriceId: string;
  productName: string;
}): Promise<{ url: string; id: string }> {
  const brand = await prisma.orgStripeConfig.findUnique({
    where: { organizationId: input.organizationId },
    select: { displayName: true },
  });
  return createAccessPaymentLink({
    organizationId: input.organizationId,
    stripePriceId: input.stripePriceId,
    productName: input.productName,
    accessProductId: input.accessProductId,
    customText: brand?.displayName
      ? `Accès Discord — ${brand.displayName}`
      : null,
  });
}
