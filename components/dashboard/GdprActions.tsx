"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { redirectIfMfaRequired } from "@/lib/api-client-auth";

export function GdprActions({ mfaEnabled }: { mfaEnabled: boolean }) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [mfaCode, setMfaCode] = useState("");

  async function exportData() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/account");
      if (!response.ok) {
        const data = (await response.json()) as {
          error?: string;
          code?: string;
        };
        if (redirectIfMfaRequired(data)) return;
        setError(data.error ?? t("exportFailed"));
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `discelyn-export-${Date.now()}.json`;
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
    if (confirmText !== "DELETE") {
      setError(t("deleteConfirmPhraseError"));
      return;
    }
    if (mfaEnabled && mfaCode.trim().length < 6) {
      setError(t("deleteMfaCodeRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          confirm: "DELETE",
          ...(mfaEnabled ? { code: mfaCode.trim() } : {}),
        }),
      });
      if (!response.ok) {
        const data = (await response.json()) as {
          error?: string;
          code?: string;
        };
        if (redirectIfMfaRequired(data)) return;
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
          onClick={() => {
            setConfirming(true);
            setError(null);
          }}
          className="rounded-full border border-warn/40 px-4 py-2 text-sm text-warn hover:border-warn disabled:opacity-50"
        >
          {t("deleteAccount")}
        </button>
      </div>
      {confirming ? (
        <div className="space-y-3 rounded-xl border border-warn/30 bg-page p-4">
          <p className="text-sm text-soft">{t("deleteConfirmStep")}</p>
          <label className="block text-sm text-page-fg">
            {t("deleteConfirmPhraseLabel")}
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              placeholder="DELETE"
            />
          </label>
          {mfaEnabled ? (
            <label className="block text-sm text-page-fg">
              {t("deleteMfaCodeLabel")}
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                placeholder={t("mfaCodeOrRecovery")}
              />
            </label>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void deleteAccount()}
              className="rounded-full bg-warn px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {t("deleteAccountConfirmCta")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setConfirming(false);
                setConfirmText("");
                setMfaCode("");
                setError(null);
              }}
              className="rounded-full px-4 py-2 text-sm text-soft hover:text-page-fg"
            >
              {t("deleteCancel")}
            </button>
          </div>
        </div>
      ) : null}
      {message ? <p className="text-sm text-signal">{message}</p> : null}
      {error ? <p className="text-sm text-warn">{error}</p> : null}
    </section>
  );
}
