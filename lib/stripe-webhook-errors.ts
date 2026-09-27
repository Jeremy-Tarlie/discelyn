/**
 * Erreurs métier des webhooks Stripe (formation + SaaS).
 * Module pur — pas d’import Prisma (testable sans DATABASE_URL).
 */

/**
 * Échec temporaire / config incomplete : libérer le claim pour que Stripe retente.
 */
export class StripeWebhookRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeWebhookRetryableError";
  }
}

/**
 * Orga / produit / bot définitivement indisponible (soft-delete, inactif).
 * Le claim reste : Stripe ne doit PAS retenter en boucle.
 */
export class StripeWebhookPermanentIgnore extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = "StripeWebhookPermanentIgnore";
    this.reason = reason;
  }
}
