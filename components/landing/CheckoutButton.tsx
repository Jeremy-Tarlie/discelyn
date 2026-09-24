"use client";

import { useState } from "react";
import type { PlanId } from "@/lib/plans";

type CheckoutOfferId = PlanId | "SETUP" | "DIAGNOSTIC";

export function CheckoutButton({
  planId,
  label,
  variant = "primary",
}: {
  planId: CheckoutOfferId;
  label: string;
  variant?: "primary" | "ghost";
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (planId === "FREE") {
      window.location.assign("/login");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        if (response.status === 401) {
          window.location.assign("/login");
          return;
        }
        setError(data.error ?? "Erreur Stripe");
        setLoading(false);
        return;
      }

      window.location.assign(data.url);
    } catch {
      setError("Réseau indisponible");
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
        {loading ? "Redirection…" : label}
      </button>
      {error ? <p className="text-center text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
