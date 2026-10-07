import { prisma } from "@/lib/prisma";

/**
 * OWNER : 2FA obligatoire pour les actions sensibles (billing SaaS, équipe, secrets).
 * Retourne true si MFA activée, false sinon (appelant → 403).
 */
export async function ownerHasMfaEnabled(userId: string): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { totpEnabled: true },
  });
  return Boolean(user?.totpEnabled);
}

type CheckoutSubscriptionSnapshot = {
  plan: string;
  status: string;
  stripeSubscriptionId: string | null;
};

/**
 * MFA requise pour checkout sauf premier abonnement (org FREE sans abo Stripe bloquant).
 * One-shot (SETUP / DIAGNOSTIC) : toujours MFA.
 */
export function requiresMfaForCheckout(input: {
  oneShot: boolean;
  subscription: CheckoutSubscriptionSnapshot;
}): boolean {
  if (input.oneShot) return true;

  const blockingStatuses = new Set(["ACTIVE", "TRIALING", "PAST_DUE"]);
  const hasBlockingSub =
    Boolean(input.subscription.stripeSubscriptionId) &&
    blockingStatuses.has(input.subscription.status);

  if (input.subscription.plan === "FREE" && !hasBlockingSub) {
    return false;
  }

  return true;
}
