"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import { DiscordIcon } from "@/components/landing/DiscordIcon";
import { PasswordInput } from "@/components/auth/PasswordInput";

const inputClass =
  "w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)]/80 px-3 py-2.5 text-[color:var(--page-fg)] outline-none transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]";

export function CredentialsAuthForm({
  callbackUrl = "/dashboard",
  oauthError = false,
}: {
  callbackUrl?: string;
  oauthError?: boolean;
}) {
  const t = useTranslations("login");
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    oauthError ? t("oauthLinkedError") : null,
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/credentials/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, callbackUrl }),
      });
      const data = (await res.json()) as {
        error?: string;
        code?: string;
        redirectTo?: string;
      };
      if (!res.ok) {
        setError(t("invalidCredentials"));
        setLoading(false);
        return;
      }

      router.push(data.redirectTo ?? callbackUrl);
      router.refresh();
    } catch {
      setError(t("invalidCredentials"));
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => void signIn("discord", { callbackUrl })}
        className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#5865F2] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_-12px_rgba(88,101,242,0.55)] transition hover:bg-[#4752c4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]"
      >
        <DiscordIcon className="h-5 w-5" />
        {t("continueDiscord")}
      </button>

      <div className="relative text-center text-xs text-[color:var(--muted)]">
        <span className="relative z-10 bg-[color:var(--surface)]/90 px-3 backdrop-blur-sm">
          {t("orEmail")}
        </span>
        <span className="absolute left-0 right-0 top-1/2 h-px bg-[color:var(--border)]" />
      </div>

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
            className={inputClass}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "login-error" : undefined}
          />
        </label>

        <PasswordInput
          label={t("passwordLabel")}
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          invalid={Boolean(error)}
          describedBy={error ? "login-error" : undefined}
        />

        <p className="text-right text-xs">
          <Link
            href="/forgot-password"
            className="text-[color:var(--muted)] underline underline-offset-2 hover:text-[color:var(--page-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]"
          >
            {t("forgotPassword")}
          </Link>
        </p>

        {error ? (
          <p id="login-error" className="text-sm text-warn" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-signal px-6 py-3.5 text-sm font-semibold text-ink-950 shadow-[0_8px_24px_-12px_rgba(61,207,176,0.7)] transition hover:bg-signal-glow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2] disabled:opacity-60"
        >
          {t("submit")}
        </button>
      </form>

      <p className="text-center text-sm text-[color:var(--muted)]">
        {t("noAccount")}{" "}
        <Link
          href="/signup"
          className="font-medium text-[color:var(--page-fg)] underline underline-offset-2 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]"
        >
          {t("signupLink")}
        </Link>
      </p>
    </div>
  );
}
