"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { AuthStatusPanel } from "@/components/auth/AuthStatusPanel";

export function ForgotPasswordClient() {
  const t = useTranslations("forgotPassword");
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Anti-énumération : même UI succès que la requête aboutisse ou non.
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <AuthPageShell variant="status">
        <AuthStatusPanel
          tone="success"
          title={t("doneTitle")}
          description={t("done")}
          action={{ href: "/login", label: t("backLogin") }}
        />
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell
      title={t("title")}
      subtitle={t("subtitle")}
      footer={
        <Link
          href="/login"
          className="text-[color:var(--page-fg)] underline underline-offset-2 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]"
        >
          {t("backLogin")}
        </Link>
      }
    >
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-[color:var(--muted)]">
            {t("emailLabel")}
          </span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)]/80 px-3 py-2.5 text-[color:var(--page-fg)] outline-none transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-signal px-6 py-3.5 text-sm font-semibold text-ink-950 shadow-[0_8px_24px_-12px_rgba(61,207,176,0.7)] transition hover:bg-signal-glow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2] disabled:opacity-60"
        >
          {t("submit")}
        </button>
      </form>
    </AuthPageShell>
  );
}
