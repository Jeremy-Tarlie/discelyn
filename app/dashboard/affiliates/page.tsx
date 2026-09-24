"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Affiliate = {
  id: string;
  code: string;
  label: string;
  commissionBps: number;
  refUrl: string;
  clicks: number;
  paid: number;
  claimed: number;
};

export default function AffiliatesPage() {
  const t = useTranslations("dashboard.affiliates");
  const [rows, setRows] = useState<Affiliate[]>([]);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [bps, setBps] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch("/api/affiliates");
    const data = (await res.json()) as { affiliates?: Affiliate[] };
    setRows(data.affiliates ?? []);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function create() {
    const res = await fetch("/api/affiliates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, label, commissionBps: bps }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setMessage(data.error ?? t("saveFailed"));
      return;
    }
    setCode("");
    setLabel("");
    setMessage(t("created"));
    await reload();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-page-fg">{t("title")}</h1>
        <p className="mt-1 text-sm text-soft">{t("body")}</p>
      </div>

      <div className="grid gap-2 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-4">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t("code")}
          className="rounded-xl border border-line bg-surface-muted px-3 py-2 text-sm"
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t("label")}
          className="rounded-xl border border-line bg-surface-muted px-3 py-2 text-sm"
        />
        <input
          type="number"
          value={bps}
          onChange={(e) => setBps(Number(e.target.value))}
          placeholder={t("bps")}
          className="rounded-xl border border-line bg-surface-muted px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void create()}
          className="rounded-full bg-[#5865F2] px-4 py-2 text-sm font-semibold text-white"
        >
          {t("create")}
        </button>
      </div>
      {message ? <p className="text-sm text-signal">{message}</p> : null}

      <ul className="divide-y divide-line rounded-2xl border border-line">
        {rows.map((a) => (
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
        ))}
      </ul>
    </div>
  );
}
