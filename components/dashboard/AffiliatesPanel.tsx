"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { DashboardAffiliate } from "@/lib/dashboard-data";

export function AffiliatesPanel({
  initialRows,
}: {
  initialRows: DashboardAffiliate[];
}) {
  const t = useTranslations("dashboard.affiliates");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState(initialRows);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [bps, setBps] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  async function create() {
    setError(null);
    const res = await fetch("/api/affiliates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, label, commissionBps: bps }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? t("saveFailed"));
      return;
    }
    setCode("");
    setLabel("");
    setMessage(t("created"));
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-page-fg">{t("title")}</h1>
        <p className="mt-1 text-sm text-soft">{t("body")}</p>
      </div>

      <div className="grid gap-2 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-4">
        <div>
          <label htmlFor="aff-code" className="sr-only">
            {t("code")}
          </label>
          <input
            id="aff-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t("code")}
            className="w-full rounded-xl border border-line bg-surface-muted px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="aff-label" className="sr-only">
            {t("label")}
          </label>
          <input
            id="aff-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t("label")}
            className="w-full rounded-xl border border-line bg-surface-muted px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="aff-bps" className="sr-only">
            {t("bps")}
          </label>
          <input
            id="aff-bps"
            type="number"
            value={bps}
            onChange={(e) => setBps(Number(e.target.value))}
            placeholder={t("bps")}
            className="w-full rounded-xl border border-line bg-surface-muted px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => void create()}
          className="rounded-full bg-[#5865F2] px-4 py-2 text-sm font-semibold text-white"
        >
          {t("create")}
        </button>
      </div>
      {pending ? <p className="text-sm text-soft">{t("loading")}</p> : null}
      {error ? <p className="text-sm text-warn">{error}</p> : null}
      {message ? <p className="text-sm text-signal">{message}</p> : null}

      <ul className="divide-y divide-line rounded-2xl border border-line">
        {rows.length === 0 ? (
          <li className="px-4 py-3 text-sm text-soft">{t("empty")}</li>
        ) : (
          rows.map((a) => (
            <li key={a.id} className="space-y-1 px-4 py-3 text-sm">
              <p className="font-medium text-page-fg">
                {a.label} · <code>{a.code}</code>
              </p>
              <p className="text-xs text-soft">
                {t("stats", {
                  clicks: a.clicks,
                  paid: a.paid,
                  claimed: a.claimed,
                  bps: a.commissionBps,
                })}
              </p>
              <button
                type="button"
                className="text-xs text-[#5865F2] underline"
                onClick={() => {
                  void navigator.clipboard.writeText(a.refUrl);
                  setMessage(t("copied"));
                }}
              >
                {t("copyLink")}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
