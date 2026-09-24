"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function ClaimCodePage() {
  const t = useTranslations("claim");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function redeem() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/access/codes/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json()) as {
        claimUrl?: string | null;
        error?: string;
      };
      if (!res.ok || !data.claimUrl) {
        setError(data.error ?? t("errors.invalid"));
        return;
      }
      window.location.href = data.claimUrl;
    } catch {
      setError(t("errors.invalid"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[color:var(--page-bg)] text-[color:var(--page-fg)]">
      <main className="mx-auto max-w-lg px-6 py-16">
        <p className="text-xs uppercase tracking-wide text-signal">Botly</p>
        <h1 className="mt-2 font-display text-3xl font-bold">
          {t("codeTitle")}
        </h1>
        <p className="mt-3 text-soft">{t("codeSubtitle")}</p>
        <div className="mt-8 space-y-3 rounded-2xl border border-line bg-surface p-6">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full rounded-xl border border-line bg-surface-muted px-3 py-2"
            placeholder={t("codePlaceholder")}
            autoComplete="off"
          />
          <button
            type="button"
            disabled={busy || code.trim().length < 4}
            onClick={() => void redeem()}
            className="w-full rounded-full bg-[#5865F2] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {t("codeCta")}
          </button>
          {error ? <p className="text-sm text-warn">{error}</p> : null}
        </div>
        <p className="mt-8 text-center text-sm text-soft">
          <Link href="/" className="underline">
            {t("backHome")}
          </Link>
        </p>
      </main>
    </div>
  );
}
