"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { SignOutButton } from "@/components/auth/SignOutButton";

export function MfaChallengeForm() {
  const t = useTranslations("mfa");
  const tc = useTranslations("common");
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/account/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? t("verifyFailed"));
        setBusy(false);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError(tc("networkError"));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4">
      <label className="block text-sm text-[color:var(--muted)]">
        {t("codeLabel")}
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="one-time-code"
          inputMode="numeric"
          className="mt-2 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 text-[color:var(--page-fg)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]"
          placeholder={t("codePlaceholder")}
        />
      </label>
      <button
        type="submit"
        disabled={busy || code.trim().length < 6}
        className="w-full rounded-lg bg-[#5865F2] px-5 py-3 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2] disabled:opacity-50"
      >
        {busy ? tc("loading") : t("submit")}
      </button>
      {error ? (
        <p className="text-center text-sm text-warn" role="alert">
          {error}
        </p>
      ) : null}
      <p className="text-center text-xs text-[color:var(--muted)]">
        <SignOutButton variant="link" labelNamespace="mfa" />
      </p>
    </form>
  );
}
