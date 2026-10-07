import type Stripe from "stripe";

/**
 * Résout le price ID depuis metadata / line items.
 * Canonique : `discelyn_price_id`. Alias `botly_price_id` conservé pour
 * Payment Links / Checkouts créés avant le rename — ne plus écrire botly_*.
 */
export function extractPriceIdFromSession(
  session: Stripe.Checkout.Session,
  lineItems?: Stripe.LineItem[] | null
): string | null {
  const fromMeta =
    session.metadata?.discelyn_price_id ??
    session.metadata?.botly_price_id ??
    session.metadata?.stripe_price_id ??
    session.metadata?.priceId;
  if (fromMeta && fromMeta.length > 0) return fromMeta;

  if (lineItems && lineItems.length > 0) {
    const price = lineItems[0]?.price;
    if (price && typeof price === "object" && "id" in price) {
      return price.id;
    }
  }
  return null;
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
