"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import type { Locale } from "@/i18n/config";
import { useConsentUiOptional } from "@/components/cookies/CookieBanner";
import { hasConsentChoiceFromDocument } from "@/lib/consent";
import { writeLocalePreferenceCookie } from "@/lib/preference-cookies";

export function LocaleSwitcher({
  className = "",
  variant = "pills",
}: {
  className?: string;
  /** `icon` = un bouton FR↔EN (header allégé). */
  variant?: "pills" | "icon";
}) {
  const locale = useLocale() as Locale;
  const t = useTranslations("common");
  const router = useRouter();
  const consentUi = useConsentUiOptional();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<Locale | null>(null);
  // Sync quand la locale serveur change (pas d’effet setState).
  const [prevLocale, setPrevLocale] = useState(locale);
  if (locale !== prevLocale) {
    setPrevLocale(locale);
    setOptimistic(null);
  }
  const display = optimistic ?? locale;

  function setLocale(next: Locale) {
    if (next === display || pending) return;

    // Sans choix cookies : pas de cookie langue → ouvrir la bannière.
    if (!hasConsentChoiceFromDocument()) {
      writeLocalePreferenceCookie(next); // localStorage only
      consentUi?.openPrefs();
      return;
    }

    setOptimistic(next);
    writeLocalePreferenceCookie(next);
    startTransition(() => {
      router.refresh();
    });
    void fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: next }),
    }).catch(() => undefined);
  }

  if (variant === "icon") {
    const next: Locale = display === "fr" ? "en" : "fr";
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => setLocale(next)}
        aria-label={`${t("language")}: ${next === "fr" ? "Français" : "English"}`}
        aria-busy={pending}
        className={`inline-flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-[0.6875rem] font-bold uppercase tracking-wide text-[color:var(--muted)] transition hover:bg-[color:var(--page-fg)]/[0.06] hover:text-[color:var(--page-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2] disabled:opacity-60 ${className}`}
      >
        {display}
      </button>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-full border border-[color:var(--border)] bg-black/[0.04] p-0.5 text-xs font-semibold dark:bg-black/20 ${className}`}
      role="group"
      aria-label={t("language")}
    >
      {(["fr", "en"] as const).map((code) => (
        <button
          key={code}
          type="button"
          disabled={pending}
          aria-pressed={display === code}
          onClick={() => setLocale(code)}
          className={`rounded-full px-2.5 py-1 uppercase transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2] ${
            display === code
              ? "bg-[#1a1c21] text-white dark:bg-white dark:text-[#1a1c21]"
              : "text-[color:var(--muted)] hover:text-[color:var(--page-fg)]"
          }`}
          aria-label={code === "fr" ? "Français" : "English"}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
