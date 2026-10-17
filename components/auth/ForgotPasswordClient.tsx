"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AuthPageShell } from "@/components/auth/AuthPageShell";

export function ForgotPasswordClient() {
  const t = useTranslations("forgotPassword");
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setDone(true);
    setLoading(false);
  }

  return (
    <AuthPageShell
      title={t("title")}
      subtitle={t("subtitle")}
      footer={
        <Link
          href="/login"
          className="text-[color:var(--page-fg)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]"
        >
          {t("backLogin")}
        </Link>
      }
    >
      {done ? (
        <p
          className="text-center text-sm text-signal"
          role="status"
          aria-live="polite"
        >
          {t("done")}
        </p>
      ) : (
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
          <label className="block space-y-1 text-sm">
            <span className="text-[color:var(--muted)]">{t("emailLabel")}</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-2.5 text-[color:var(--page-fg)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[color:var(--page-fg)] px-6 py-3 text-sm font-semibold text-[color:var(--page-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2] disabled:opacity-60"
          >
            {t("submit")}
          </button>
        </form>
      )}
    </AuthPageShell>
  );
}
