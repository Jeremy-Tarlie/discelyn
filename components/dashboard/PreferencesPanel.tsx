"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher";
import type { Theme } from "@/i18n/config";
import { TIMEZONE_OPTIONS } from "@/lib/timezones";

export function PreferencesPanel({
  theme,
  timezone,
}: {
  theme: Theme;
  timezone: string;
}) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const router = useRouter();
  const [value, setValue] = useState(timezone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function saveTimezone() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/account/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: value }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? t("prefsSaveFailed"));
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError(tc("networkError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="font-display text-xl text-page-fg">{t("prefsTitle")}</h2>
      <p className="mt-2 text-sm text-soft">{t("prefsIntro")}</p>

      <div className="mt-5 space-y-4">
        <div>
          <p className="text-sm font-medium text-page-fg">{tc("theme")}</p>
          <div className="mt-2">
            <ThemeSwitcher theme={theme} />
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-page-fg">{tc("language")}</p>
          <div className="mt-2">
            <LocaleSwitcher />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-page-fg">
            {t("prefsTimezone")}
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="mt-2 w-full rounded-xl border border-line bg-page px-3 py-2 text-sm text-page-fg"
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={busy || value === timezone}
            onClick={() => void saveTimezone()}
            className="mt-3 rounded-full bg-[#5865F2] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {t("prefsSaveTimezone")}
          </button>
        </div>
      </div>
      {saved ? <p className="mt-3 text-sm text-signal">{t("prefsSaved")}</p> : null}
      {error ? <p className="mt-3 text-sm text-warn">{error}</p> : null}
    </section>
  );
}
