/**
 * IDs Stripe Checkout Session (`cs_test_…` / `cs_live_…` / `cs_…`).
 * Rejette les placeholders type `/claim/session/invalid` pour éviter le polling « Paiement reçu ».
 */
export function isStripeCheckoutSessionId(value: string): boolean {
  return /^cs_[A-Za-z0-9_]+$/.test(value.trim());
}
