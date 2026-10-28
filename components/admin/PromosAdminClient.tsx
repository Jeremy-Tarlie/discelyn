"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type PromoRow = {
  id: string;
  code: string;
  active: boolean;
  timesRedeemed: number;
  percentOff: number | null;
};

export function PromosAdminClient({ initial }: { initial: PromoRow[] }) {
  const t = useTranslations("admin");
  const [promos, setPromos] = useState(initial);
  const [code, setCode] = useState("");
  const [percentOff, setPercentOff] = useState(20);
  const [duration, setDuration] = useState<"once" | "forever">("once");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/promos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, percentOff, duration }),
      });
      const data = (await res.json()) as {
        error?: string;
        id?: string;
        code?: string;
        active?: boolean;
      };
      if (!res.ok) {
        setError(data.error ?? "error");
        return;
      }
      setPromos((prev) => [
        {
          id: data.id ?? code,
          code: data.code ?? code.toUpperCase(),
          active: data.active ?? true,
          timesRedeemed: 0,
          percentOff,
        },
        ...prev,
      ]);
      setCode("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={(e) => void onCreate(e)} className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <label className="block text-sm">
          <span className="text-soft">{t("promoCode")}</span>
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-surface-muted px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-soft">{t("promoPercent")}</span>
          <input
            type="number"
            min={1}
            max={100}
            required
            value={percentOff}
            onChange={(e) => setPercentOff(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-line bg-surface-muted px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-soft">{t("promoDuration")}</span>
          <select
            value={duration}
            onChange={(e) =>
              setDuration(e.target.value as "once" | "forever")
            }
            className="mt-1 w-full rounded-lg border border-line bg-surface-muted px-3 py-2"
          >
            <option value="once">{t("promoDurationOnce")}</option>
            <option value="forever">{t("promoDurationForever")}</option>
          </select>
        </label>
        {error ? (
          <p className="text-sm text-warn" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-signal px-4 py-2.5 text-sm font-semibold text-ink-950 disabled:opacity-60"
        >
          {t("promoCreate")}
        </button>
      </form>

      {promos.length === 0 ? (
        <p className="text-soft">{t("promoEmpty")}</p>
      ) : (
        <ul className="space-y-2">
          {promos.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            >
              <span className="font-mono font-semibold">{p.code}</span>
              <span className="text-soft">
                {p.percentOff != null ? `−${p.percentOff}%` : "—"} ·{" "}
                {p.active ? t("promoActive") : t("promoInactive")} · ×
                {p.timesRedeemed}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
