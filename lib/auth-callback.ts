import { z } from "zod";

/** Plans payants pouvant être choisis avant OAuth / checkout. */
export const SUBSCRIBE_PLAN_IDS = ["STARTER", "OPS", "SCALE"] as const;
export type SubscribePlanId = (typeof SUBSCRIBE_PLAN_IDS)[number];

export const subscribeIntentSchema = z.object({
  plan: z.enum(SUBSCRIBE_PLAN_IDS),
  interval: z.enum(["month", "year"]).default("month"),
});

export type SubscribeIntent = z.infer<typeof subscribeIntentSchema>;

/**
 * Whitelist stricte des callbackUrl post-OAuth (anti open-redirect).
 * Autorise /dashboard… et /subscribe… en chemins relatifs uniquement.
 */
export function safeAuthCallbackUrl(
  raw: string | null | undefined
): string {
  if (!raw || typeof raw !== "string") return "/dashboard";

  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/dashboard";
  }

  // Rejette protocol-relative et URLs absurdes avec backslash.
  if (trimmed.includes("\\") || trimmed.includes("@")) {
    return "/dashboard";
  }

  const pathOnly = trimmed.split("#")[0] ?? trimmed;
  if (
    pathOnly === "/dashboard" ||
    pathOnly.startsWith("/dashboard/") ||
    pathOnly === "/subscribe" ||
    pathOnly.startsWith("/subscribe?")
  ) {
    return pathOnly;
  }

  return "/dashboard";
}

/** Chemin /subscribe?plan=&interval= pour un intent payant. */
export function subscribePath(
  plan: SubscribePlanId,
  interval: "month" | "year" = "month"
): string {
  const params = new URLSearchParams({ plan, interval });
  return `/subscribe?${params.toString()}`;
}

/** Login avec intention de plan conservée dans callbackUrl. */
export function loginWithSubscribeIntent(
  plan: SubscribePlanId,
  interval: "month" | "year" = "month"
): string {
  const callback = subscribePath(plan, interval);
  return `/login?callbackUrl=${encodeURIComponent(callback)}`;
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
