import type Stripe from "stripe";
import { PLANS, type PlanId } from "@/lib/plans";

const PLAN_IDS: readonly PlanId[] = ["FREE", "STARTER", "OPS", "SCALE"];

export function isPlanId(value: string | null | undefined): value is PlanId {
  return (
    value === "FREE" ||
    value === "STARTER" ||
    value === "OPS" ||
    value === "SCALE"
  );
}

export function planFromPriceId(
  priceId: string | null | undefined
): PlanId | null {
  if (!priceId) return null;
  for (const plan of Object.values(PLANS)) {
    if (!plan.stripePriceEnvKey) continue;
    const envPrice = process.env[plan.stripePriceEnvKey];
    if (envPrice && envPrice === priceId) {
      return plan.id;
    }
  }
  return null;
}

export function planFromMetadata(
  metadata: Stripe.Metadata | null | undefined
): PlanId | null {
  const raw = metadata?.planId;
  if (isPlanId(raw) && raw !== "FREE") {
    return raw;
  }
  // Compat anciens metadata Stripe (avant grille Starter/Ops/Scale)
  if (raw === "PRO" || raw === "BUSINESS") return "SCALE";
  return null;
}

/**
 * Résout le plan d’un abonnement Stripe.
 * Si price/metadata inconnus, conserve le plan existant s’il est valide
 * (y compris STARTER), sinon FREE.
 */
export function resolveSubscriptionPlan(input: {
  metadata: Stripe.Metadata | null | undefined;
  priceId: string | null | undefined;
  existingPlan: string | null | undefined;
}): { plan: PlanId; conserved: boolean } {
  const resolved =
    planFromMetadata(input.metadata) ?? planFromPriceId(input.priceId);
  if (resolved) {
    return { plan: resolved, conserved: false };
  }
  if (isPlanId(input.existingPlan)) {
    return { plan: input.existingPlan, conserved: true };
  }
  return { plan: "FREE", conserved: true };
}

export function allPlanIds(): readonly PlanId[] {
  return PLAN_IDS;
}
