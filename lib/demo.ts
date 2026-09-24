/**
 * Environnement applicatif (séparé de NODE_ENV Next.js).
 * - development : local, clés Stripe test uniquement
 * - staging : préprod, clés Stripe test uniquement + bandeau
 * - production : live autorisé
 */

export type AppEnvironment = "development" | "staging" | "production";

export function getAppEnvironment(): AppEnvironment {
  const raw = (process.env.APP_ENV ?? "").toLowerCase().trim();
  if (raw === "production" || raw === "staging" || raw === "development") {
    return raw;
  }
  if (process.env.DEMO_MODE === "1") return "staging";
  if (process.env.NODE_ENV === "production") return "production";
  return "development";
}

export function isNonProductionEnvironment(): boolean {
  return getAppEnvironment() !== "production";
}

/** Bandeau visible hors production. */
export function shouldShowEnvironmentBanner(): boolean {
  return isNonProductionEnvironment();
}

/** @deprecated Utiliser shouldShowEnvironmentBanner */
export function isDemoMode(): boolean {
  return shouldShowEnvironmentBanner();
}

export function assertStripeKeyAllowedForEnvironment(secretKey: string): void {
  const env = getAppEnvironment();
  if (env !== "production" && secretKey.startsWith("sk_live_")) {
    throw new Error(
      `APP_ENV=${env} : STRIPE_SECRET_KEY live (sk_live_) refusée. Utilisez sk_test_ en développement/staging.`
    );
  }
  if (
    env === "production" &&
    secretKey.startsWith("sk_test_") &&
    process.env.ALLOW_STRIPE_TEST_IN_PROD !== "1"
  ) {
    throw new Error(
      "APP_ENV=production : clé Stripe test (sk_test_) refusée. Définir ALLOW_STRIPE_TEST_IN_PROD=1 uniquement pour un dry-run temporaire."
    );
  }
}
