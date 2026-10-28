import path from "node:path";
import { z } from "zod";

/** Plans payants pouvant être choisis avant OAuth / checkout. */
export const SUBSCRIBE_PLAN_IDS = ["STARTER", "OPS", "SCALE"] as const;
export type SubscribePlanId = (typeof SUBSCRIBE_PLAN_IDS)[number];

/** Offres one-shot (Diagnostic / Setup) via /subscribe?plan=. */
export const ONE_SHOT_OFFER_IDS = ["SETUP", "DIAGNOSTIC"] as const;
export type AuthOneShotOfferId = (typeof ONE_SHOT_OFFER_IDS)[number];

/** Plans sélectionnables à l’inscription (FREE inclus). */
export const SIGNUP_PLAN_IDS = ["FREE", "STARTER", "OPS", "SCALE"] as const;
export type SignupPlanId = (typeof SIGNUP_PLAN_IDS)[number];

/** Intent checkout : abonnement ou one-shot. */
export const CHECKOUT_INTENT_PLAN_IDS = [
  ...SUBSCRIBE_PLAN_IDS,
  ...ONE_SHOT_OFFER_IDS,
] as const;
export type CheckoutIntentPlanId = (typeof CHECKOUT_INTENT_PLAN_IDS)[number];

export const subscribeIntentSchema = z.object({
  plan: z.enum(CHECKOUT_INTENT_PLAN_IDS),
  interval: z.enum(["month", "year"]).default("month"),
});

export type SubscribeIntent = z.infer<typeof subscribeIntentSchema>;

export function isSubscribePlanId(
  plan: CheckoutIntentPlanId
): plan is SubscribePlanId {
  return (SUBSCRIBE_PLAN_IDS as readonly string[]).includes(plan);
}

export function isOneShotOfferId(
  plan: string
): plan is AuthOneShotOfferId {
  return (ONE_SHOT_OFFER_IDS as readonly string[]).includes(plan);
}

export const signupIntentSchema = z.object({
  plan: z.enum(SIGNUP_PLAN_IDS),
  interval: z.enum(["month", "year"]).default("month"),
});

export type SignupIntent = z.infer<typeof signupIntentSchema>;

function isAllowedAuthPath(pathname: string): boolean {
  return (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/subscribe"
  );
}

/**
 * Whitelist stricte des callbackUrl post-OAuth (anti open-redirect).
 * Autorise /dashboard… et /subscribe… en chemins relatifs uniquement.
 * Normalise les segments `..` pour éviter `/dashboard/../etc/passwd`.
 */
export function safeAuthCallbackUrl(
  raw: string | null | undefined
): string {
  if (!raw || typeof raw !== "string") return "/dashboard";

  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/dashboard";
  }

  if (trimmed.includes("\\") || trimmed.includes("@")) {
    return "/dashboard";
  }

  const hashStripped = trimmed.split("#")[0] ?? trimmed;
  const qIndex = hashStripped.indexOf("?");
  const pathnameRaw =
    qIndex === -1 ? hashStripped : hashStripped.slice(0, qIndex);
  const query = qIndex === -1 ? "" : hashStripped.slice(qIndex);

  if (pathnameRaw.includes("%2e") || pathnameRaw.includes("%2E")) {
    return "/dashboard";
  }

  const normalized = path.posix.normalize(pathnameRaw);
  if (
    normalized !== pathnameRaw &&
    (pathnameRaw.includes("..") || pathnameRaw.includes("//"))
  ) {
    // normalize changed a traversal-like path — still OK if result is allowed
  }
  if (normalized.includes("..") || !normalized.startsWith("/")) {
    return "/dashboard";
  }

  if (!isAllowedAuthPath(normalized)) {
    return "/dashboard";
  }

  // /subscribe only: keep query; /dashboard/* keep query if any
  if (normalized === "/subscribe") {
    return `${normalized}${query}`;
  }
  return `${normalized}${query}`;
}

/** Chemin /subscribe?plan=&interval= pour un intent payant (abo ou one-shot). */
export function subscribePath(
  plan: CheckoutIntentPlanId,
  interval: "month" | "year" = "month"
): string {
  if (!isSubscribePlanId(plan)) {
    return `/subscribe?plan=${plan}`;
  }
  const params = new URLSearchParams({ plan, interval });
  return `/subscribe?${params.toString()}`;
}

/** Login avec intention de plan conservée dans callbackUrl. */
export function loginWithSubscribeIntent(
  plan: CheckoutIntentPlanId,
  interval: "month" | "year" = "month"
): string {
  const callback = isSubscribePlanId(plan)
    ? subscribePath(plan, interval)
    : `/subscribe?plan=${plan}`;
  return `/login?callbackUrl=${encodeURIComponent(callback)}`;
}

/**
 * Signup avec plan pré-sélectionné (query).
 * FREE → /signup ; payant → /signup?plan=&interval= (callback Discord via /subscribe).
 * One-shot → /signup?offer=SETUP|DIAGNOSTIC.
 */
export function signupWithPlanIntent(
  plan: SignupPlanId | AuthOneShotOfferId,
  interval: "month" | "year" = "month"
): string {
  if (isOneShotOfferId(plan)) {
    return `/signup?offer=${plan}`;
  }
  if (plan === "FREE") return "/signup";
  const params = new URLSearchParams({ plan, interval });
  return `/signup?${params.toString()}`;
}

/** callbackUrl Discord depuis signup selon le plan. */
export function discordCallbackForSignupPlan(
  plan: SignupPlanId,
  interval: "month" | "year" = "month"
): string {
  if (plan === "FREE") return "/dashboard";
  return subscribePath(plan, interval);
}

export function parseSubscribeIntent(input: {
  plan: string | null | undefined;
  interval: string | null | undefined;
}): SubscribeIntent | null {
  const parsed = subscribeIntentSchema.safeParse({
    plan: input.plan ?? undefined,
    interval: input.interval ?? undefined,
  });
  return parsed.success ? parsed.data : null;
}

export function parseSignupIntent(input: {
  plan: string | null | undefined;
  interval: string | null | undefined;
}): SignupIntent | null {
  const parsed = signupIntentSchema.safeParse({
    plan: input.plan ?? undefined,
    interval: input.interval ?? undefined,
  });
  return parsed.success ? parsed.data : null;
}
