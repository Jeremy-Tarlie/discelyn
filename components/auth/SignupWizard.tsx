"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { AuthStatusPanel } from "@/components/auth/AuthStatusPanel";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordRulesChecklist } from "@/components/auth/PasswordRulesChecklist";
import { DiscordIcon } from "@/components/landing/DiscordIcon";
import { PlanPicker } from "@/components/landing/PlanPicker";
import {
  discordCallbackForSignupPlan,
  loginWithSubscribeIntent,
  subscribePath,
  type AuthOneShotOfferId,
  type SignupPlanId,
} from "@/lib/auth-callback";
import type { BillingInterval } from "@/lib/plans";
import {
  PASSWORD_MIN_LENGTH,
  passwordMeetsAllRules,
} from "@/lib/password-policy";

type SignupStep = "plan" | "account" | "verify";

const STEPS: SignupStep[] = ["plan", "account"];

const inputClass =
  "w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)]/80 px-3 py-2.5 text-[color:var(--page-fg)] outline-none transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]";

export function SignupWizard({
  initialPlan = "FREE",
  initialInterval = "month",
  oneShotOffer = null,
  footer,
}: {
  initialPlan?: SignupPlanId;
  initialInterval?: BillingInterval;
  /** Diagnostic / Setup : saute le sélecteur d’abonnement. */
  oneShotOffer?: AuthOneShotOfferId | null;
  footer?: ReactNode;
}) {
  const t = useTranslations("signup");
  const tPassword = useTranslations("password");
  const tLogin = useTranslations("login");
  const tp = useTranslations("plans");

  const [step, setStep] = useState<SignupStep>(
    oneShotOffer ? "account" : "plan"
  );
  const [plan, setPlan] = useState<SignupPlanId>(initialPlan);
  const [interval, setInterval] = useState<BillingInterval>(initialInterval);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const titleRef = useRef<HTMLHeadingElement>(null);
  const skipInitialFocus = useRef(true);

  useEffect(() => {
    if (step === "verify") return;
    if (skipInitialFocus.current) {
      skipInitialFocus.current = false;
      return;
    }
    titleRef.current?.focus();
  }, [step]);

  const passwordsMatch = password === confirmPassword;
  const passwordReady = passwordMeetsAllRules(password) && passwordsMatch;
  const submitDisabled = loading || !passwordReady;

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordReady) {
      if (!passwordMeetsAllRules(password)) setError(t("weakPassword"));
      else setError(tPassword("mismatch"));
      return;
    }
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
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
      };
      if (!res.ok) {
        if (data.code === "email_not_allowed") setError(t("emailNotAllowed"));
        else if (data.code === "weak_password") setError(t("weakPassword"));
        else if (data.code === "email_taken") setError(t("emailTaken"));
        else setError(data.error ?? t("mailFailed"));
        return;
      }
      setStep("verify");
    } catch {
      setError(t("mailFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function resendVerification() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) setInfo(tLogin("resendOk"));
      else setError(t("mailFailed"));
    } finally {
      setLoading(false);
    }
  }

  function discordSignIn() {
    const cb = oneShotOffer
      ? subscribePath(oneShotOffer)
      : discordCallbackForSignupPlan(plan, interval);
    void signIn("discord", { callbackUrl: cb });
  }

  const postVerifyLoginHref = oneShotOffer
    ? loginWithSubscribeIntent(oneShotOffer)
    : "/login";

  if (step === "verify") {
    return (
      <AuthPageShell variant="status" size="md">
        <AuthStatusPanel
          tone="success"
          title={t("verifyTitle")}
          description={t("checkEmail")}
          action={{ href: postVerifyLoginHref, label: t("loginLink") }}
        />
        <div className="mt-4 space-y-2 text-center">
          {info ? (
            <p className="text-sm text-signal" role="status" aria-live="polite">
              {info}
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-warn" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            disabled={loading || !email}
            onClick={() => void resendVerification()}
            className="text-sm text-[color:var(--muted)] underline underline-offset-2 hover:text-[color:var(--page-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2] disabled:opacity-60"
          >
            {tLogin("resendVerification")}
          </button>
        </div>
      </AuthPageShell>
    );
  }

  const stepTitle = step === "plan" ? t("stepPlanTitle") : t("stepAccountTitle");
  const stepSubtitle =
    step === "plan" ? t("stepPlanSubtitle") : t("stepAccountSubtitle");

  return (
    <AuthPageShell size="lg" footer={footer}>
      <nav aria-label={t("stepsLabel")} className="mb-8">
        <ol className="flex items-center justify-center gap-2">
          {STEPS.map((id, index) => {
            const active = step === id;
            const done = STEPS.indexOf(step) > index;
            return (
              <li key={id} className="flex items-center gap-2">
                {index > 0 ? (
                  <span
                    aria-hidden
                    className={`h-px w-8 sm:w-12 ${
                      done || active ? "bg-signal" : "bg-[color:var(--border)]"
                    }`}
                  />
                ) : null}
                <button
                  type="button"
                  aria-current={active ? "step" : undefined}
                  aria-label={t(
                    active
                      ? "stepAriaCurrent"
                      : done
                        ? "stepAriaDone"
                        : "stepAriaUpcoming",
                    {
                      current: index + 1,
                      total: STEPS.length,
                      label: id === "plan" ? t("stepPlan") : t("stepAccount"),
                    },
                  )}
                  disabled={
                    active || (id === "account" && step === "plan")
                  }
                  onClick={() => {
                    if (id === "plan") setStep("plan");
                  }}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2] disabled:cursor-default ${
                    active
                      ? "bg-signal/15 text-signal-dim ring-1 ring-signal/35"
                      : done
                        ? "bg-signal/10 text-signal-dim"
                        : "bg-[color:var(--surface-muted)] text-[color:var(--muted)]"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      active || done
                        ? "bg-signal text-ink-950"
                        : "bg-[color:var(--border)] text-[color:var(--muted)]"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span aria-hidden>
                    {id === "plan" ? t("stepPlan") : t("stepAccount")}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <h1
        ref={titleRef}
        tabIndex={-1}
        className="text-center font-display text-3xl font-bold tracking-tight text-[color:var(--page-fg)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2] sm:text-[2rem]"
      >
        {stepTitle}
      </h1>
      <p className="mx-auto mt-3 max-w-md text-center text-sm leading-relaxed text-[color:var(--muted)]">
        {stepSubtitle}
      </p>

      <div className="mt-8 space-y-6">
        {step === "plan" ? (
          <>
            <PlanPicker
              plan={plan}
              interval={interval}
              onPlanChange={setPlan}
              onIntervalChange={setInterval}
            />
            <button
              type="button"
              onClick={() => setStep("account")}
              className="w-full rounded-xl bg-signal px-6 py-3.5 text-sm font-semibold text-ink-950 shadow-[0_8px_24px_-12px_rgba(61,207,176,0.7)] transition hover:bg-signal-glow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]"
            >
              {t("continue")}
            </button>
          </>
        ) : null}

        {step === "account" ? (
          <>
            <button
              type="button"
              onClick={() => setStep("plan")}
              className="inline-flex w-full items-center justify-between gap-3 rounded-xl border border-signal/30 bg-signal/10 px-4 py-3 text-left transition hover:bg-signal/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]"
            >
              <span>
                <span className="block text-xs font-medium text-signal-dim">
                  {t("selectedPlan")}
                </span>
                <span className="mt-0.5 block text-sm font-semibold text-[color:var(--page-fg)]">
                  {tp(`${plan}.name`)}
                  {interval === "year" && plan !== "FREE"
                    ? ` · ${t("intervalYear")}`
                    : plan !== "FREE"
                      ? ` · ${t("intervalMonth")}`
                      : ""}
                </span>
              </span>
              <span className="text-xs font-semibold text-signal-dim underline underline-offset-2">
                {t("back")}
              </span>
            </button>

            <button
              type="button"
              onClick={discordSignIn}
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

            <form onSubmit={(e) => void onRegister(e)} className="space-y-4">
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium text-[color:var(--muted)]">
                  {t("nameLabel")}
                </span>
                <input
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                />
              </label>
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
                />
              </label>
              <PasswordInput
                label={t("passwordLabel")}
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                minLength={PASSWORD_MIN_LENGTH}
                describedBy="signup-password-rules"
              />
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
          </>
        ) : null}

        <p className="text-center text-sm text-[color:var(--muted)]">
          {t("hasAccount")}{" "}
          <Link
            href="/login"
            className="font-medium text-[color:var(--page-fg)] underline underline-offset-2 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]"
          >
            {t("loginLink")}
          </Link>
        </p>
      </div>
    </AuthPageShell>
  );
}
