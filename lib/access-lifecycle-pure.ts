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

/** Paiement formation en retard (accès encore possible tant que non unpaid/canceled). */
export function isLearnerPaymentPastDue(
  billingStatus: string | null | undefined
): boolean {
  return billingStatus === "past_due";
}

/** Badge UI : past_due ou unpaid (si encore visible avant revoke). */
export function isLearnerPaymentAtRisk(
  billingStatus: string | null | undefined
): boolean {
  return billingStatus === "past_due" || billingStatus === "unpaid";
}

/**
 * Révocation sur refund : uniquement si le remboursement est total
 * (amount_refunded >= amount). Un remboursement partiel / geste commercial
 * ne doit pas couper l’accès Discord.
 */
export function shouldRevokeOnRefund(input: {
  revokeOnRefund: boolean;
  refunded: boolean;
  /** Montant charge en centimes (Stripe). */
  amount?: number | null;
  /** Cumul remboursé en centimes. */
  amountRefunded?: number | null;
}): boolean {
  if (!input.revokeOnRefund || !input.refunded) return false;
  if (
    typeof input.amount === "number" &&
    typeof input.amountRefunded === "number" &&
    input.amount > 0
  ) {
    return input.amountRefunded >= input.amount;
  }
  // Sans montants (tests / events incomplets) : conserver l’ancien comportement.
  return true;
}
