"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type ActivityItem = {
  id: string;
  action: string;
  createdAtLabel: string;
};

export function ActivityLogPanel() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/account/activity");
        const data = (await response.json()) as {
          items?: ActivityItem[];
          error?: string;
        };
        if (!response.ok) {
          setError(data.error ?? t("activityLoadFailed"));
          return;
        }
        setItems(data.items ?? []);
      } catch {
        setError(tc("networkError"));
      }
    })();
  }, [t, tc]);

  function labelFor(action: string): string {
    const map: Record<string, string> = {
      mfa_enabled: t("activity_mfa_enabled"),
      mfa_disabled: t("activity_mfa_disabled"),
      mfa_recovery_regenerated: t("activity_mfa_recovery_regenerated"),
      sessions_revoked: t("activity_sessions_revoked"),
      plan_changed: t("activity_plan_changed"),
      prefs_updated: t("activity_prefs_updated"),
      login: t("activity_login"),
    };
    return map[action] ?? action;
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="font-display text-xl text-page-fg">
        {t("activityTitle")}
      </h2>
      <p className="mt-2 text-sm text-soft">{t("activityIntro")}</p>
      {error ? <p className="mt-4 text-sm text-warn">{error}</p> : null}
      <ul className="mt-5 divide-y divide-line">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
          >
            <span className="text-page-fg">{labelFor(item.action)}</span>
            <span className="text-xs text-soft">{item.createdAtLabel}</span>
          </li>
        ))}
        {items.length === 0 && !error ? (
          <li className="py-3 text-sm text-soft">{t("activityEmpty")}</li>
        ) : null}
      </ul>
    </section>
  );
}
