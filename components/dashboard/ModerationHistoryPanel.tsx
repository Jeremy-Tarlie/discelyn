"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AuditExportButton } from "@/components/dashboard/AuditExportButton";
import { CheckoutButton } from "@/components/landing/CheckoutButton";
import type { PlanId } from "@/lib/plans";

type WarningRow = {
  id: string;
  targetUserId: string;
  reason: string;
  moderatorTag: string;
  createdAt: string;
};

type AuditPreviewResponse = {
  warningCount: number;
  warnings: WarningRow[];
  exportAvailable: boolean;
  error?: string;
};

export function ModerationHistoryPanel({
  botId,
  auditExport,
  upgradePlanId,
}: {
  botId: string;
  auditExport: boolean;
  upgradePlanId: PlanId;
}) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const tp = useTranslations("plans");
  const [rows, setRows] = useState<WarningRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/bots/${botId}/audit`);
        const data = (await response.json()) as AuditPreviewResponse;
        if (!response.ok) {
          if (!cancelled) {
            setError(data.error ?? t("auditPreviewFailed"));
          }
          return;
        }
        if (!cancelled) {
          setRows(data.warnings);
          setTotal(data.warningCount);
        }
      } catch {
        if (!cancelled) setError(tc("networkError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [botId, t, tc]);

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
      <div>
        <h2 className="font-display text-lg text-page-fg">
          {t("auditTitle")}
        </h2>
        <p className="mt-1 text-sm text-soft">{t("auditBody")}</p>
      </div>

      {loading ? (
        <p className="text-sm text-soft">{t("auditPreviewLoading")}</p>
      ) : error ? (
        <p className="text-sm text-warn">{error}</p>
      ) : total === 0 ? (
        <p className="text-sm text-soft">{t("auditPreviewEmpty")}</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-page-fg">
            {t("auditPreviewCount", { count: total, shown: rows.length })}
          </p>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {rows.map((row) => (
              <li
                key={row.id}
                className="space-y-1 bg-surface-muted px-3 py-2.5 text-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-page-fg">
                    {row.targetUserId}
                  </span>
                  <time
                    className="text-xs text-soft"
                    dateTime={row.createdAt}
                  >
                    {new Date(row.createdAt).toLocaleString()}
                  </time>
                </div>
                <p className="text-page-fg">{row.reason}</p>
                <p className="text-xs text-soft">
                  {t("auditPreviewModerator", { tag: row.moderatorTag })}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2 border-t border-line pt-4">
        <AuditExportButton botId={botId} enabled={auditExport} />
        {!auditExport ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-soft">{t("auditExportLocked")}</p>
            <CheckoutButton
              planId={upgradePlanId}
              label={t("editor.upgradeTo", {
                plan: tp(`${upgradePlanId}.name`),
              })}
              variant="ghost"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
