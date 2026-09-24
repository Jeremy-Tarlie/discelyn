"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";

export function GdprActions() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function exportData() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/account");
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? t("exportFailed"));
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `botly-export-${Date.now()}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage(t("exportDone"));
    } catch {
      setError(tc("networkError"));
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    if (!window.confirm(t("deleteConfirm"))) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/account", { method: "DELETE" });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? t("deleteFailed"));
        return;
      }
      await signOut({ callbackUrl: "/" });
      router.refresh();
    } catch {
      setError(tc("networkError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
      <h2 className="font-display text-lg text-page-fg">{t("gdprTitle")}</h2>
      <p className="text-sm text-soft">{t("gdprBody")}</p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void exportData()}
          className="rounded-full border border-line px-4 py-2 text-sm text-page-fg hover:border-signal disabled:opacity-50"
        >
          {t("exportData")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void deleteAccount()}
          className="rounded-full border border-red-500/40 px-4 py-2 text-sm text-red-300 hover:border-red-400 disabled:opacity-50"
        >
          {t("deleteAccount")}
        </button>
      </div>
      {message ? <p className="text-sm text-signal">{message}</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </section>
  );
}
