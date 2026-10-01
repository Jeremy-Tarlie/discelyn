"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";

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
      <label className="block text-sm text-[#949ba4]">
        {t("codeLabel")}
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
          autoComplete="one-time-code"
          inputMode="numeric"
          className="mt-2 w-full rounded-xl border border-white/10 bg-[#1e1f22] px-4 py-3 text-white"
          placeholder={t("codePlaceholder")}
        />
      </label>
      <button
        type="submit"
        disabled={busy || code.trim().length < 6}
        className="w-full rounded-full bg-[#5865F2] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? tc("loading") : t("submit")}
      </button>
      {error ? <p className="text-center text-sm text-warn">{error}</p> : null}
      <p className="text-center text-xs text-[#6d737e]">
        <Link href="/api/auth/signout" className="underline-offset-2 hover:underline">
          {t("signOut")}
        </Link>
      </p>
    </form>
  );
}
