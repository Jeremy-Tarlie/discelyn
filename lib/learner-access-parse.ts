import type Stripe from "stripe";

/** Ref price sur un line item (expandé ou id string Stripe). */
type LineItemPriceRef = string | { id: string } | null | undefined;

/**
 * Price réellement payé — uniquement depuis les line items Stripe.
 * Jamais depuis metadata (forgeable côté Payment Link / Checkout).
 */
export function extractPaidPriceIdFromLineItems(
  lineItems: ReadonlyArray<{ price?: LineItemPriceRef }> | null | undefined
): string | null {
  if (!lineItems || lineItems.length === 0) return null;
  const price = lineItems[0]?.price;
  if (typeof price === "string" && price.startsWith("price_")) {
    return price;
  }
  if (price && typeof price === "object" && "id" in price) {
    const id = price.id;
    if (typeof id === "string" && id.startsWith("price_")) return id;
  }
  return null;
}

/**
 * Hint metadata uniquement (lookup / rétrocompat) — ne pas utiliser pour autoriser un accès.
 * Canonique : `discelyn_price_id` (puis `stripe_price_id` / `priceId`).
 */
export function extractPriceIdFromSession(
  session: Stripe.Checkout.Session
): string | null {
  const fromMeta =
    session.metadata?.discelyn_price_id ??
    session.metadata?.stripe_price_id ??
    session.metadata?.priceId;
  if (fromMeta && fromMeta.startsWith("price_")) return fromMeta;
  return null;
}

/**
 * Le price réellement payé doit correspondre au price de l’AccessProduct.
 * Évite l’escalade via metadata `discelyn_access_product_id` / `discelyn_price_id`.
 */
export function checkoutPriceMatchesProduct(input: {
  paidPriceId: string | null;
  productStripePriceId: string;
}): "ok" | "missing_paid_price" | "mismatch" {
  if (!input.paidPriceId || !input.paidPriceId.startsWith("price_")) {
    return "missing_paid_price";
  }
  if (input.paidPriceId !== input.productStripePriceId) {
    return "mismatch";
  }
  return "ok";
}

/** Canonique : `discelyn_access_product_id`. */
export function extractAccessProductIdFromSession(
  session: Stripe.Checkout.Session
): string | null {
  const id =
    session.metadata?.discelyn_access_product_id ??
    session.metadata?.access_product_id;
  if (!id || typeof id !== "string") return null;
  const trimmed = id.trim();
  return trimmed.length >= 8 ? trimmed : null;
}

export function extractDiscordUserIdFromSession(
  session: Stripe.Checkout.Session
): string | null {
  const raw =
    session.metadata?.discord_user_id ??
    session.metadata?.discordUserId ??
    session.client_reference_id;
  if (!raw || !/^\d{17,20}$/.test(raw)) return null;
  return raw;
}
