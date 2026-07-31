import type { Subscription, SubscriptionStatus } from "@/generated/prisma/client";
import { getPlan, type PlanId } from "@/lib/plans";

const ACTIVE_STATUSES: SubscriptionStatus[] = ["ACTIVE", "TRIALING"];

export function isSubscriptionActive(
  subscription: Pick<Subscription, "status">
): boolean {
  return ACTIVE_STATUSES.includes(subscription.status);
}

export function canUseProduct(
  subscription: Pick<Subscription, "plan" | "status">
): { ok: true } | { ok: false; reason: string } {
  if (!isSubscriptionActive(subscription)) {
    return {
      ok: false,
      reason:
        "Abonnement inactif ou en retard. Mets à jour ton paiement dans Billing.",
    };
  }
  return { ok: true };
}

export function canCreateBot(
  subscription: Pick<Subscription, "plan" | "status">,
  currentBotCount: number
): { ok: true } | { ok: false; reason: string } {
  const product = canUseProduct(subscription);
  if (!product.ok) return product;

  const plan = getPlan(subscription.plan as PlanId);
  if (currentBotCount >= plan.maxBots) {
    return {
      ok: false,
      reason: `Limite atteinte (${plan.maxBots} bot${plan.maxBots > 1 ? "s" : ""} sur le plan ${plan.name}).`,
    };
  }
  return { ok: true };
}

export function filterModulesForPlan(
  planId: PlanId,
  requested: string[]
): string[] {
  const allowed = new Set(getPlan(planId).modules);
  return requested.filter((moduleId) => allowed.has(moduleId as never));
}
