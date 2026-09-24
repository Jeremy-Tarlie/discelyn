"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import type { Theme } from "@/i18n/config";

export function ThemeSwitcher({
  theme,
  className = "",
}: {
  theme: Theme;
  className?: string;
}) {
  const t = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setTheme(next: Theme) {
    if (next === theme || pending) return;
    startTransition(async () => {
      await fetch("/api/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: next }),
      });
      document.documentElement.classList.toggle("dark", next === "dark");
      document.documentElement.style.colorScheme = next;
      router.refresh();
    });
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
        className={`rounded-full px-2.5 py-1 transition ${
          theme === "light"
            ? "bg-[#1a1c21] text-white shadow-sm"
            : "text-[color:var(--muted)] hover:text-[color:var(--page-fg)]"
        }`}
        aria-pressed={theme === "light"}
      >
        {t("light")}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setTheme("dark")}
        className={`rounded-full px-2.5 py-1 transition ${
          theme === "dark"
            ? "bg-white text-[#1a1c21] shadow-sm"
            : "text-[color:var(--muted)] hover:text-[color:var(--page-fg)]"
        }`}
        aria-pressed={theme === "dark"}
      >
        {t("dark")}
      </button>
    </div>
  );
}
