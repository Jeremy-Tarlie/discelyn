"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function PortalButton() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/stripe/portal", { method: "POST" });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        setError(data.error ?? t("portalFailed"));
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError(tc("networkError"));
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={openPortal}
        disabled={loading}
        className="rounded-full border border-line px-5 py-2.5 text-sm text-page-fg hover:border-signal hover:text-signal disabled:opacity-60"
      >
        {loading ? t("openingPortal") : t("manageStripe")}
      </button>
      {error ? <p className="mt-2 text-sm text-warn">{error}</p> : null}
    </div>
  );
}
