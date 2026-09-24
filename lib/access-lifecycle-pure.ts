/**
 * Décisions pures de la boucle paiement → accès (testables sans Stripe/Discord).
 */

export {
  decideGrantOutcome,
  type GrantAttemptKind,
  type GrantOutcome,
} from "@/lib/grant-outcome-pure";

/**
 * Ouvre l’accès uniquement si Stripe confirme le paiement
 * (ou qu’aucun paiement n’est requis — $0 / trial).
 * `session.status === "complete"` seul ne suffit PAS (unpaid + complete possible).
 */
export function shouldOpenAccessFromCheckout(input: {
  paymentStatus: string | null | undefined;
}): boolean {
  return (
    input.paymentStatus === "paid" ||
    input.paymentStatus === "no_payment_required"
  );
}

/**
 * Révocation hard : unpaid / canceled seulement.
 * `past_due` laisse une fenêtre de retry Stripe — on n’ôte pas le rôle tout de suite.
 */
export function shouldRevokeOnSubscriptionStatus(
  status: string
): status is "unpaid" | "canceled" {
  return status === "unpaid" || status === "canceled";
}

export function shouldRevokeOnRefund(input: {
  revokeOnRefund: boolean;
  refunded: boolean;
}): boolean {
  return input.revokeOnRefund && input.refunded;
}
