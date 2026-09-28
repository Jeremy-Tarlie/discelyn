import type { Subscription, SubscriptionStatus } from "@/generated/prisma/client";
import { getPlan, type PlanId } from "@/lib/plans";
import type { ApiMessageKey } from "@/lib/i18n-api";

const ACTIVE_STATUSES: SubscriptionStatus[] = ["ACTIVE", "TRIALING"];

export function isSubscriptionActive(
  subscription: Pick<Subscription, "status">
): boolean {
  return ACTIVE_STATUSES.includes(subscription.status);
}

/**
 * Plan exposé à l’UI/session : FREE si l’abonnement n’est plus utilisable
 * (PAST_DUE, CANCELED, …) pour éviter d’afficher Starter/Ops alors que les mutations sont 403.
 */
export function effectivePlan(
  subscription: Pick<Subscription, "plan" | "status"> | null | undefined
): PlanId {
  if (!subscription || !isSubscriptionActive(subscription)) {
    return "FREE";
  }
  return subscription.plan as PlanId;
}

export type GuardFailure = {
  ok: false;
  code: ApiMessageKey;
  params?: Record<string, string | number>;
};

export function canUseProduct(
  subscription: Pick<Subscription, "plan" | "status">
): { ok: true } | GuardFailure {
  if (!isSubscriptionActive(subscription)) {
    return { ok: false, code: "inactiveSubscription" };
  }
  return { ok: true };
}

export function canCreateBot(
  subscription: Pick<Subscription, "plan" | "status">,
  currentBotCount: number
): { ok: true } | GuardFailure {
  const product = canUseProduct(subscription);
  if (!product.ok) return product;

  const plan = getPlan(subscription.plan as PlanId);
  if (currentBotCount >= plan.maxGuilds) {
    return {
      ok: false,
      code: "botLimit",
      params: { n: plan.maxGuilds, plan: plan.name },
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
