"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

type SetupPayload = {
  secret: string;
  otpauthUrl: string;
};

export function MfaSettingsPanel({ enabled }: { enabled: boolean }) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<SetupPayload | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [disableCode, setDisableCode] = useState("");
  const [regenCode, setRegenCode] = useState("");

  async function startSetup() {
    setBusy(true);
    setError(null);
    setRecoveryCodes(null);
    try {
      const response = await fetch("/api/account/mfa/setup", { method: "POST" });
      const data = (await response.json()) as SetupPayload & { error?: string };
      if (!response.ok) {
        setError(data.error ?? t("mfaSetupFailed"));
        return;
      }
      setSetup({
        secret: data.secret,
        otpauthUrl: data.otpauthUrl,
      });
    } catch {
      setError(tc("networkError"));
    } finally {
      setBusy(false);
    }
  }

  async function enableMfa() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/account/mfa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await response.json()) as {
        recoveryCodes?: string[];
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? t("mfaEnableFailed"));
        return;
      }
      setRecoveryCodes(data.recoveryCodes ?? []);
      setSetup(null);
      setCode("");
      router.refresh();
    } catch {
      setError(tc("networkError"));
    } finally {
      setBusy(false);
    }
  }

  async function disableMfa() {
    if (!window.confirm(t("mfaDisableConfirm"))) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/account/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: disableCode }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? t("mfaDisableFailed"));
        return;
      }
      setDisableCode("");
      setRecoveryCodes(null);
      router.refresh();
    } catch {
      setError(tc("networkError"));
    } finally {
      setBusy(false);
    }
  }

  async function regenerateRecovery() {
    if (!window.confirm(t("mfaRegenConfirm"))) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/account/mfa/recovery/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: regenCode }),
      });
      const data = (await response.json()) as {
        recoveryCodes?: string[];
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? t("mfaRegenFailed"));
        return;
      }
      setRecoveryCodes(data.recoveryCodes ?? []);
      setRegenCode("");
      router.refresh();
    } catch {
      setError(tc("networkError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="font-display text-xl text-page-fg">{t("mfaTitle")}</h2>
      <p className="mt-2 text-sm text-soft">{t("mfaIntro")}</p>
      <p className="mt-3 text-sm text-page-fg">
        {enabled ? t("mfaStatusOn") : t("mfaStatusOff")}
      </p>

      {!enabled && !setup ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void startSetup()}
          className="mt-4 rounded-full bg-[#5865F2] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {t("mfaEnableCta")}
        </button>
      ) : null}

      {setup ? (
        <div className="mt-5 space-y-4 rounded-xl border border-line bg-page p-4">
          <p className="text-sm text-soft">{t("mfaScanHint")}</p>
          <div>
            <p className="text-xs uppercase tracking-wide text-soft">
              {t("mfaSecretLabel")}
            </p>
            <code className="mt-1 block break-all rounded-lg bg-surface px-3 py-2 text-sm text-page-fg">
              {setup.secret}
            </code>
          </div>
          <a
            href={setup.otpauthUrl}
            className="inline-flex text-sm font-semibold text-[#5865F2]"
          >
            {t("mfaOpenAuthenticator")}
          </a>
          <label className="block text-sm text-soft">
            {t("mfaConfirmCode")}
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-page-fg"
              placeholder="123456"
            />
          </label>
          <button
            type="button"
            disabled={busy || code.trim().length < 6}
            onClick={() => void enableMfa()}
            className="rounded-full bg-[#5865F2] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {t("mfaConfirmCta")}
          </button>
        </div>
      ) : null}

      {recoveryCodes ? (
        <div className="mt-5 rounded-xl border border-warn/40 bg-warn/5 p-4">
          <p className="text-sm font-medium text-page-fg">{t("mfaRecoveryTitle")}</p>
          <p className="mt-1 text-sm text-soft">{t("mfaRecoveryBody")}</p>
          <ul className="mt-3 grid gap-1 font-mono text-sm text-page-fg sm:grid-cols-2">
            {recoveryCodes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {enabled ? (
        <div className="mt-5 space-y-3 border-t border-line pt-5">
          <label className="block text-sm text-soft">
            {t("mfaDisableCode")}
            <input
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-page px-3 py-2 text-page-fg"
              placeholder={t("mfaCodeOrRecovery")}
            />
          </label>
          <button
            type="button"
            disabled={busy || disableCode.trim().length < 6}
            onClick={() => void disableMfa()}
            className="rounded-full border border-warn/40 px-5 py-2.5 text-sm text-warn hover:border-warn disabled:opacity-50"
          >
            {t("mfaDisableCta")}
          </button>

          <div className="space-y-3 border-t border-line pt-5">
            <p className="text-sm font-medium text-page-fg">{t("mfaRegenTitle")}</p>
            <p className="text-xs text-soft">{t("mfaRegenBody")}</p>
            <label className="block text-sm text-soft">
              {t("mfaDisableCode")}
              <input
                value={regenCode}
                onChange={(e) => setRegenCode(e.target.value)}
                className="mt-1 w-full rounded-xl border border-line bg-page px-3 py-2 text-page-fg"
                placeholder={t("mfaCodeOrRecovery")}
              />
            </label>
            <button
              type="button"
              disabled={busy || regenCode.trim().length < 6}
              onClick={() => void regenerateRecovery()}
              className="rounded-full border border-line px-5 py-2.5 text-sm text-page-fg hover:border-signal disabled:opacity-50"
            >
              {t("mfaRegenCta")}
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-4 text-sm text-warn">{error}</p> : null}
    </section>
  );
}
