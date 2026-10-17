"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { AuthStatusPanel } from "@/components/auth/AuthStatusPanel";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordRulesChecklist } from "@/components/auth/PasswordRulesChecklist";
import {
  PASSWORD_MIN_LENGTH,
  passwordMeetsAllRules,
} from "@/lib/password-policy";

export function ResetPasswordClient() {
  const t = useTranslations("resetPassword");
  const tPassword = useTranslations("password");
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"form" | "ok" | "fail">(
    token ? "form" : "fail",
  );
  const [error, setError] = useState<string | null>(null);

  const passwordsMatch = password === confirmPassword;
  const passwordReady = passwordMeetsAllRules(password) && passwordsMatch;
  const submitDisabled = loading || !passwordReady || !token;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setStatus("fail");
      return;
    }
    if (!passwordReady) {
      if (!passwordMeetsAllRules(password)) setError(t("weakPassword"));
      else setError(tPassword("mismatch"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (res.ok) {
        setStatus("ok");
        return;
      }
      let code: string | undefined;
      try {
        const data: { code?: string } = await res.json();
        code = typeof data.code === "string" ? data.code : undefined;
      } catch {
        code = undefined;
      }

      if (code === "weak_password") {
        setError(t("weakPassword"));
        return;
      }
      setStatus("fail");
    } catch {
      setError(t("failed"));
    } finally {
      setLoading(false);
    }
  }

  if (status === "ok") {
    return (
      <AuthPageShell variant="status">
        <AuthStatusPanel
          tone="success"
          title={t("successTitle")}
          description={t("success")}
          action={{ href: "/login", label: t("loginLink") }}
        />
      </AuthPageShell>
    );
  }

  if (status === "fail") {
    return (
      <AuthPageShell variant="status">
        <AuthStatusPanel
          tone="error"
          title={t("failedTitle")}
          description={t("failed")}
          action={{ href: "/forgot-password", label: t("requestNewLink") }}
        />
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell title={t("title")} subtitle={t("subtitle")}>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <PasswordInput
          label={t("passwordLabel")}
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          describedBy="reset-password-rules"
        />
        <PasswordRulesChecklist
          id="reset-password-rules"
          password={password}
        />
        <PasswordInput
          label={tPassword("confirmLabel")}
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
        />
        {confirmPassword.length > 0 && !passwordsMatch ? (
          <p className="text-sm text-warn" role="alert">
            {tPassword("mismatch")}
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-warn" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={submitDisabled}
          className="w-full rounded-xl bg-signal px-6 py-3.5 text-sm font-semibold text-ink-950 shadow-[0_8px_24px_-12px_rgba(61,207,176,0.7)] transition hover:bg-signal-glow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2] disabled:opacity-60"
        >
          {t("submit")}
        </button>
      </form>
    </AuthPageShell>
  );
}
