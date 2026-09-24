"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import type { Locale } from "@/i18n/config";

export function LocaleSwitcher({ className = "" }: { className?: string }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setLocale(next: Locale) {
    if (next === locale || pending) return;
    startTransition(async () => {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
      router.refresh();
    });
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
          aria-pressed={locale === code}
          onClick={() => setLocale(code)}
          className={`rounded-full px-2.5 py-1 uppercase transition ${
            locale === code
              ? "bg-[#1a1c21] text-white dark:bg-white dark:text-[#1a1c21]"
              : "text-[color:var(--muted)] hover:text-[color:var(--page-fg)]"
          }`}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
