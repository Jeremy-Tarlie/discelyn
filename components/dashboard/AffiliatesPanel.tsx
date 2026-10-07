"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { DashboardAffiliate } from "@/lib/dashboard-data";
import {
  DashboardAlert,
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardPanel,
  dashBtnGhostClass,
  dashBtnPrimaryClass,
  dashFieldClass,
} from "@/components/dashboard/ui";
import { redirectIfMfaRequired } from "@/lib/api-client-auth";

export function AffiliatesPanel({
  initialRows,
}: {
  initialRows: DashboardAffiliate[];
}) {
  const t = useTranslations("dashboard.affiliates");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState(initialRows);
  const [rowsSource, setRowsSource] = useState(initialRows);
  if (initialRows !== rowsSource) {
    setRowsSource(initialRows);
    setRows(initialRows);
  }
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [bps, setBps] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function create() {
    setError(null);
    const res = await fetch("/api/affiliates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, label, commissionBps: bps }),
    });
    const data = (await res.json()) as { error?: string; code?: string };
    if (redirectIfMfaRequired(data)) return;
    if (!res.ok) {
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
    <div className="mx-auto max-w-3xl space-y-6">
      <DashboardPageHeader title={t("title")} description={t("body")} />

      {pending ? <DashboardAlert tone="muted">{t("loading")}</DashboardAlert> : null}
      {error ? <DashboardAlert tone="error">{error}</DashboardAlert> : null}
      {message ? <DashboardAlert tone="ok">{message}</DashboardAlert> : null}

      <DashboardPanel title={t("formTitle")}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-soft">{t("code")}</span>
            <input
              id="aff-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t("code")}
              className={dashFieldClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-soft">{t("label")}</span>
            <input
              id="aff-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("label")}
              className={dashFieldClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-soft">{t("bps")}</span>
            <input
              id="aff-bps"
              type="number"
              value={bps}
              onChange={(e) => setBps(Number(e.target.value))}
              className={dashFieldClass}
            />
          </label>
          <button
            type="button"
            onClick={() => void create()}
            className={`${dashBtnPrimaryClass} w-full lg:w-auto`}
          >
            {t("create")}
          </button>
        </div>
      </DashboardPanel>

      <DashboardPanel title={t("listTitle")}>
        {rows.length === 0 ? (
          <DashboardEmptyState title={t("empty")} hint={t("emptyHint")} />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((a) => (
              <li
                key={a.id}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-page-fg">
                    {a.label}{" "}
                    <code className="rounded-md bg-surface-muted px-1.5 py-0.5 text-xs font-medium text-signal">
                      {a.code}
                    </code>
                  </p>
                  <p className="text-xs text-soft">
                    {t("stats", {
                      clicks: a.clicks,
                      paid: a.paid,
                      claimed: a.claimed,
                      bps: a.commissionBps,
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  className={dashBtnGhostClass}
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
        )}
      </DashboardPanel>
    </div>
  );
}
