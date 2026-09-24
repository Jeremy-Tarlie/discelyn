"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function LearnerPortalButton({
  checkoutSessionId,
}: {
  checkoutSessionId: string;
}) {
  const t = useTranslations("claim");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/access/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutSessionId }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? t("portalFailed"));
        return;
      }
      window.location.href = data.url;
    } catch {
      setError(t("portalFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => void openPortal()}
        className="inline-flex rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-page-fg hover:border-signal disabled:opacity-50"
      >
        {t("manageBilling")}
      </button>
      {error ? <p className="text-sm text-warn">{error}</p> : null}
    </div>
  );
}
