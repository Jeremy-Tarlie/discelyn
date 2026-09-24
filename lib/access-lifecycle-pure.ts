/**
 * Décisions pures de la boucle paiement → accès (testables sans Stripe/Discord).
 */

export {
  decideGrantOutcome,
  type GrantAttemptKind,
  type GrantOutcome,
} from "@/lib/grant-outcome-pure";

export function shouldOpenAccessFromCheckout(input: {
  paymentStatus: string | null | undefined;
  sessionStatus: string | null | undefined;
}): boolean {
  return (
    input.paymentStatus === "paid" || input.sessionStatus === "complete"
  );
}

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
