"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

const CODE_ERROR_KEYS = [
  "invalid_code",
  "code_expired",
  "code_exhausted",
  "sold_out",
] as const;

type CodeErrorKey = (typeof CODE_ERROR_KEYS)[number];

function isCodeErrorKey(value: string): value is CodeErrorKey {
  return (CODE_ERROR_KEYS as readonly string[]).includes(value);
}

export function ClaimCodeForm() {
  const t = useTranslations("claim");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function redeem() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/access/codes/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json()) as {
        claimUrl?: string | null;
        error?: string;
      };
      if (!res.ok || !data.claimUrl) {
        const raw = data.error ?? "invalid_code";
        setError(
          isCodeErrorKey(raw) ? t(`errors.${raw}`) : t("errors.invalid_code")
        );
        return;
      }
      window.location.href = data.claimUrl;
    } catch {
      setError(t("errors.invalid_code"));
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = !busy && code.trim().length >= 4;

  return (
    <form
      className="mt-8 space-y-3 rounded-2xl border border-line bg-surface p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) void redeem();
      }}
    >
      <label htmlFor="claim-code" className="block text-sm text-soft">
        {t("codeLabel")}
      </label>
      <input
        id="claim-code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="w-full rounded-xl border border-line bg-surface-muted px-3 py-2"
        placeholder={t("codePlaceholder")}
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "claim-code-error" : undefined}
      />
      <button
        type="submit"
        disabled={!canSubmit}
        aria-busy={busy}
        className="w-full rounded-full bg-[#5865F2] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#5865F2]/40 disabled:opacity-70"
      >
        {t("codeCta")}
      </button>
      {error ? (
        <p id="claim-code-error" role="alert" className="text-sm text-warn">
          {error}
        </p>
      ) : null}
    </form>
  );
}
