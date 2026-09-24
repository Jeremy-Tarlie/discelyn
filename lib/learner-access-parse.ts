import type Stripe from "stripe";

export function extractPriceIdFromSession(
  session: Stripe.Checkout.Session,
  lineItems?: Stripe.LineItem[] | null
): string | null {
  const fromMeta =
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
