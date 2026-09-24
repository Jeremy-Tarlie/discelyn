"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function AuditExportButton({
  botId,
  enabled,
}: {
  botId: string;
  enabled: boolean;
}) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!enabled) {
    return null;
  }

  async function exportAudit() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/bots/${botId}/audit?export=1`);
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? t("auditExportFailed"));
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `botly-audit-${botId}-${Date.now()}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage(t("auditExportDone"));
    } catch {
      setError(tc("networkError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => void exportAudit()}
        className="rounded-full border border-line px-4 py-2 text-sm text-page-fg hover:border-signal disabled:opacity-50"
      >
        {busy ? t("auditExporting") : t("auditExport")}
      </button>
      {message ? <p className="text-sm text-signal">{message}</p> : null}
      {error ? <p className="text-sm text-warn">{error}</p> : null}
    </div>
  );
}
