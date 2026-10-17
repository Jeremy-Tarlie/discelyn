"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import { DiscordIcon } from "@/components/landing/DiscordIcon";
import { PlanPicker } from "@/components/landing/PlanPicker";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordRulesChecklist } from "@/components/auth/PasswordRulesChecklist";
import {
  discordCallbackForSignupPlan,
  type SignupPlanId,
} from "@/lib/auth-callback";
import type { BillingInterval } from "@/lib/plans";
import {
  PASSWORD_MIN_LENGTH,
  passwordMeetsAllRules,
} from "@/lib/password-policy";



type Mode = "login" | "signup";

const inputClass =
  "w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-2.5 text-[color:var(--page-fg)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]";

export function CredentialsAuthForm({
  mode,
  callbackUrl = "/dashboard",
  initialPlan = "FREE",
  initialInterval = "month",
  oauthError = false,
}: {
  mode: Mode;
  callbackUrl?: string;
  initialPlan?: SignupPlanId;
  initialInterval?: BillingInterval;
  oauthError?: boolean;
}) {
  const tLogin = useTranslations("login");
  const tSignup = useTranslations("signup");
  const tPassword = useTranslations("password");
  const t = mode === "login" ? tLogin : tSignup;
  const router = useRouter();

  const [plan, setPlan] = useState<SignupPlanId>(initialPlan);
  const [interval, setInterval] = useState<BillingInterval>(initialInterval);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    oauthError ? tLogin("oauthLinkedError") : null
  );
  const [info, setInfo] = useState<string | null>(null);
  const [needsVerify, setNeedsVerify] = useState(false);

  const passwordsMatch = password === confirmPassword;
  const signupPasswordReady =
    mode === "login" || (passwordMeetsAllRules(password) && passwordsMatch);
  const submitDisabled = loading || !signupPasswordReady;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "signup" && !signupPasswordReady) {
      if (!passwordMeetsAllRules(password)) {
        setError(tSignup("weakPassword"));
      } else if (!passwordsMatch) {
        setError(tPassword("mismatch"));
      }
      return;
    }
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      if (mode === "signup") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            name: name.trim() || undefined,
            plan,
            interval,
          }),
        });
        const data = (await res.json()) as {
          error?: string;
          code?: string;
          created?: boolean;
          needsVerification?: boolean;
        };
        if (!res.ok) {
          if (data.code === "email_not_allowed")
            setError(tSignup("emailNotAllowed"));
          else if (data.code === "weak_password")
            setError(tSignup("weakPassword"));
          else setError(data.error ?? tSignup("mailFailed"));
          setLoading(false);
          return;
        }


        setInfo(tSignup("checkEmail"));
        setNeedsVerify(true);
        setLoading(false);
        return;
      }

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
        setError(tLogin("invalidCredentials"));
        // Pas de CTA resend après 401 (anti-abus + anti-enum).
        setLoading(false);
        return;
      }

      router.push(data.redirectTo ?? callbackUrl);
      router.refresh();
    } catch {
      setError(
        mode === "signup" ? tSignup("mailFailed") : tLogin("invalidCredentials")
      );
      setLoading(false);
    }
  }


  async function resendVerification() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (res.ok) setInfo(tLogin("resendOk"));
    else setError(tSignup("mailFailed"));
    setLoading(false);
  }

  function discordSignIn() {
    if (mode === "signup") {
      const cb = discordCallbackForSignupPlan(plan, interval);
      void signIn("discord", { callbackUrl: cb });
      return;
    }
    void signIn("discord", { callbackUrl });
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={discordSignIn}
        className="inline-flex w-full items-center justify-center gap-2.5 rounded-lg bg-[#5865F2] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#4752c4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]"
      >
        <DiscordIcon className="h-5 w-5" />
        {mode === "signup" ? tSignup("continueDiscord") : tLogin("continueDiscord")}
      </button>

      <div className="relative text-center text-xs text-[color:var(--muted)]">
        <span className="relative z-10 bg-[color:var(--surface)] px-3">
          {t("orEmail")}
        </span>
        <span className="absolute left-0 right-0 top-1/2 h-px bg-[color:var(--border)]" />
      </div>

      {mode === "signup" ? (
        <PlanPicker
          plan={plan}
          interval={interval}
          onPlanChange={setPlan}
          onIntervalChange={setInterval}
        />
      ) : null}

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
        {mode === "signup" ? (
          <label className="block space-y-1 text-sm">
            <span className="text-[color:var(--muted)]">{tSignup("nameLabel")}</span>
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </label>
        ) : null}
        <label className="block space-y-1 text-sm">
          <span className="text-[color:var(--muted)]">{t("emailLabel")}</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>

        <PasswordInput
          label={t("passwordLabel")}
          value={password}
          onChange={setPassword}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={mode === "signup" ? PASSWORD_MIN_LENGTH : undefined}
          describedBy={mode === "signup" ? "signup-password-rules" : undefined}
        />

        {mode === "signup" ? (
          <>
            <PasswordRulesChecklist
              id="signup-password-rules"
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
          </>
        ) : null}

        {mode === "login" ? (
          <p className="text-right text-xs">
            <Link
              href="/forgot-password"
              className="text-[color:var(--muted)] underline-offset-2 hover:text-[color:var(--page-fg)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]"
            >
              {tLogin("forgotPassword")}
            </Link>
          </p>
        ) : null}

        {error ? (
          <p className="text-sm text-warn" role="alert">
            {error}
          </p>
        ) : null}
        {info ? (
          <p className="text-sm text-signal" role="status" aria-live="polite">
            {info}
          </p>
        ) : null}

        {needsVerify && email ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => void resendVerification()}
            className="w-full text-sm text-[color:var(--muted)] underline hover:text-[color:var(--page-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]"
          >
            {tLogin("resendVerification")}
          </button>
        ) : null}

        <button
          type="submit"
          disabled={submitDisabled}
          className="w-full rounded-lg bg-[color:var(--page-fg)] px-6 py-3 text-sm font-semibold text-[color:var(--page-bg)] transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2] disabled:opacity-60"
        >
          {mode === "signup" ? tSignup("submit") : tLogin("submit")}
        </button>
      </form>

      {mode === "login" ? (
        <p className="text-center text-sm text-[color:var(--muted)]">
          {tLogin("noAccount")}{" "}
          <Link
            href="/signup"
            className="text-[color:var(--page-fg)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]"
          >
            {tLogin("signupLink")}
          </Link>
        </p>
      ) : (
        <p className="text-center text-sm text-[color:var(--muted)]">
          {tSignup("hasAccount")}{" "}
          <Link
            href="/login"
            className="text-[color:var(--page-fg)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]"
          >
            {tSignup("loginLink")}
          </Link>
        </p>
      )}
    </div>
  );
}
