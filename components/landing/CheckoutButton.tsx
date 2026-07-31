"use client";

import { useState } from "react";
import type { PlanId } from "@/lib/plans";

export function CheckoutButton({
  planId,
  label,
  variant = "primary",
}: {
  planId: PlanId;
  label: string;
  variant?: "primary" | "ghost";
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (planId === "FREE") {
      window.location.href = "/login";
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
          window.location.href = "/login";
          return;
        }
        setError(data.error ?? "Erreur Stripe");
        setLoading(false);
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Réseau indisponible");
      setLoading(false);
    }
  }

  const classes =
    variant === "primary"
      ? "bg-signal text-ink-950 hover:bg-signal-glow"
      : "border border-ink-600 text-mist-100 hover:border-signal hover:text-signal";

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={`w-full rounded-full px-5 py-3 text-sm font-semibold transition disabled:opacity-60 ${classes}`}
      >
        {loading ? "Redirection…" : label}
      </button>
      {error ? <p className="text-center text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
