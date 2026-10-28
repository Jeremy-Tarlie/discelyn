"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { Theme } from "@/i18n/config";
import {
  readThemeFromStorage,
  writeThemePreferenceCookie,
} from "@/lib/preference-cookies";

function applyThemeToDom(next: Theme): void {
  document.documentElement.classList.toggle("dark", next === "dark");
  document.documentElement.style.colorScheme = next;
}

function initialTheme(serverTheme: Theme): Theme {
  if (typeof window === "undefined") return serverTheme;
  return readThemeFromStorage() ?? serverTheme;
}

export function ThemeSwitcher({
  theme,
  className = "",
  variant = "pills",
}: {
  theme: Theme;
  className?: string;
  /** `icon` = un bouton soleil/lune (header allégé). */
  variant?: "pills" | "icon";
}) {
  const t = useTranslations("common");
  const [current, setCurrent] = useState(() => initialTheme(theme));
  const [pending, startTransition] = useTransition();
  const [prevTheme, setPrevTheme] = useState(theme);
  if (theme !== prevTheme) {
    setPrevTheme(theme);
    setCurrent(readThemeFromStorage() ?? theme);
  }

  // Sync DOM seulement (pas de setState).
  useEffect(() => {
    applyThemeToDom(current);
  }, [current]);

  function setTheme(next: Theme) {
    if (next === current || pending) return;
    applyThemeToDom(next);
    setCurrent(next);
    startTransition(() => {
      writeThemePreferenceCookie(next);
      void fetch("/api/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: next }),
      }).catch(() => undefined);
    });
  }

  if (variant === "icon") {
    const next: Theme = current === "light" ? "dark" : "light";
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => setTheme(next)}
        aria-label={`${t("theme")}: ${current === "light" ? t("dark") : t("light")}`}
        className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--muted)] transition hover:bg-[color:var(--page-fg)]/[0.06] hover:text-[color:var(--page-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2] ${className}`}
      >
        {current === "light" ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
        )}
      </button>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-full border border-[color:var(--border)] bg-black/[0.04] p-0.5 text-xs font-semibold dark:bg-black/20 ${className}`}
      role="group"
      aria-label={t("theme")}
    >
      <button
        type="button"
        disabled={pending}
        onClick={() => setTheme("light")}
        className={`rounded-full px-2.5 py-1 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2] ${
          current === "light"
            ? "bg-[#1a1c21] text-white shadow-sm"
            : "text-[color:var(--muted)] hover:text-[color:var(--page-fg)]"
        }`}
        aria-pressed={current === "light"}
      >
        {t("light")}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setTheme("dark")}
        className={`rounded-full px-2.5 py-1 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2] ${
          current === "dark"
            ? "bg-white text-[#1a1c21] shadow-sm"
            : "text-[color:var(--muted)] hover:text-[color:var(--page-fg)]"
        }`}
        aria-pressed={current === "dark"}
      >
        {t("dark")}
      </button>
    </div>
  );
}
