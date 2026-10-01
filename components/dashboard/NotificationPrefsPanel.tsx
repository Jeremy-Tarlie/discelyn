"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

type Prefs = {
  notifyBillingEmail: boolean;
  notifySecurityEmail: boolean;
  notifyProductEmail: boolean;
};

export function NotificationPrefsPanel({ initial }: { initial: Prefs }) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const router = useRouter();
  const [prefs, setPrefs] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function toggle(key: keyof Prefs) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/account/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next[key] }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setPrefs(prefs);
        setError(data.error ?? t("prefsSaveFailed"));
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setPrefs(prefs);
      setError(tc("networkError"));
    } finally {
      setBusy(false);
    }
  }

  const rows: { key: keyof Prefs; label: string; hint: string }[] = [
    {
      key: "notifyBillingEmail",
      label: t("notifBilling"),
      hint: t("notifBillingHint"),
    },
    {
      key: "notifySecurityEmail",
      label: t("notifSecurity"),
      hint: t("notifSecurityHint"),
    },
    {
      key: "notifyProductEmail",
      label: t("notifProduct"),
      hint: t("notifProductHint"),
    },
  ];

  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="font-display text-xl text-page-fg">{t("notifTitle")}</h2>
      <p className="mt-2 text-sm text-soft">{t("notifIntro")}</p>
      <ul className="mt-5 space-y-3">
        {rows.map((row) => (
          <li
            key={row.key}
            className="flex items-start justify-between gap-4 rounded-xl border border-line bg-page px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-page-fg">{row.label}</p>
              <p className="mt-0.5 text-xs text-soft">{row.hint}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={prefs[row.key]}
              disabled={busy}
              onClick={() => void toggle(row.key)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                prefs[row.key] ? "bg-[#5865F2]" : "bg-line"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                  prefs[row.key] ? "left-5" : "left-0.5"
                }`}
              />
            </button>
          </li>
        ))}
      </ul>
      {saved ? <p className="mt-3 text-sm text-signal">{t("prefsSaved")}</p> : null}
      {error ? <p className="mt-3 text-sm text-warn">{error}</p> : null}
    </section>
  );
}
