"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Stats = {
  periodDays: number;
  paid: number;
  claimed: number;
  active: number;
  pending: number;
  revoked: number;
  refunds: number;
  gmvCents: number;
  conversionPaidToClaimed: number;
  recurringActiveApprox: number;
  products: Array<{
    id: string;
    name: string;
    billingMode: string;
    maxSeats: number | null;
    seatsUsed: number;
    soldOut: boolean;
  }>;
};

export default function AccessStatsPage() {
  const t = useTranslations("dashboard.accessStats");
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/access/stats?days=30");
      const data = (await res.json()) as Stats & { error?: string };
      if (!res.ok) {
        setError(data.error ?? t("loadFailed"));
        return;
      }
      setStats(data);
    })();
  }, [t]);

  if (error) return <p className="text-warn">{error}</p>;
  if (!stats) return <p className="text-soft">{t("loading")}</p>;

  const cards = [
    { label: t("gmv"), value: `${(stats.gmvCents / 100).toFixed(2)}` },
    { label: t("paid"), value: String(stats.paid) },
    { label: t("claimed"), value: String(stats.claimed) },
    {
      label: t("conversion"),
      value: `${stats.conversionPaidToClaimed}%`,
    },
    { label: t("active"), value: String(stats.active) },
    { label: t("pending"), value: String(stats.pending) },
    { label: t("refunds"), value: String(stats.refunds) },
    {
      label: t("mrrApprox"),
      value: String(stats.recurringActiveApprox),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-page-fg">{t("title")}</h1>
        <p className="mt-1 text-sm text-soft">
          {t("body", { days: stats.periodDays })}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-line bg-surface p-4"
          >
            <p className="text-xs uppercase tracking-wide text-soft">{c.label}</p>
            <p className="mt-2 font-display text-2xl text-page-fg">{c.value}</p>
          </div>
        ))}
      </div>
      <ul className="divide-y divide-line rounded-2xl border border-line">
        {stats.products.map((p) => (
          <li key={p.id} className="flex justify-between px-4 py-3 text-sm">
            <span className="text-page-fg">
              {p.name}
              {p.billingMode === "RECURRING" ? " · abo" : ""}
            </span>
            <span className="text-soft">
              {p.maxSeats != null
                ? `${p.seatsUsed}/${p.maxSeats}${p.soldOut ? " complet" : ""}`
                : `${p.seatsUsed} seats`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
