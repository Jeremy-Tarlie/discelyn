"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { BillingInterval, PlanId } from "@/lib/plans";
import {
  loginWithSubscribeIntent,
  type SubscribePlanId,
} from "@/lib/auth-callback";

type CheckoutOfferId = PlanId | "SETUP" | "DIAGNOSTIC";

function isSubscribePlan(planId: CheckoutOfferId): planId is SubscribePlanId {
  return planId === "STARTER" || planId === "OPS" || planId === "SCALE";
}

export function CheckoutButton({
  planId,
  label,
  variant = "primary",
  interval = "month",
}: {
  planId: CheckoutOfferId;
  label: string;
  variant?: "primary" | "ghost";
  /** Abonnements uniquement — ignoré pour FREE / SETUP / DIAGNOSTIC. */
  interval?: BillingInterval;
}) {
  const t = useTranslations("pricing");
  const tc = useTranslations("common");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (planId === "FREE") {
      window.location.assign("/login");
      return;
    }

    setLoading(true);
    setError(null);

    const isSubscription = isSubscribePlan(planId);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isSubscription ? { planId, interval } : { planId }
        ),
      });
      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        if (response.status === 401) {
          if (isSubscription) {
            window.location.assign(
              loginWithSubscribeIntent(planId, interval)
            );
          } else {
            window.location.assign("/login");
          }
          return;
        }
        setError(data.error ?? t("checkoutFailed"));
        setLoading(false);
        return;
      }

      window.location.assign(data.url);
    } catch {
      setError(tc("networkError"));
      setLoading(false);
    }
  }

  const classes =
    variant === "primary"
      ? "bg-[#5865F2] text-white hover:bg-[#4752c4] shadow-[0_0_24px_rgba(88,101,242,0.3)]"
      : "border border-[color:var(--border)] text-[color:var(--page-fg)] hover:bg-[color:var(--surface-muted)]";

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={loading}
        className={`w-full rounded-lg px-5 py-3 text-sm font-semibold transition duration-300 disabled:opacity-60 ${classes}`}
      >
        {loading ? tc("redirecting") : label}
      </button>
      {error ? <p className="text-center text-xs text-warn">{error}</p> : null}
    </div>
  );
}
