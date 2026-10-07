"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { parseConsentPreferences } from "@/lib/consent";

type ConsentLogRow = {
  id: string;
  visitorId: string;
  userId: string | null;
  choice: string;
  policyVersion: string;
  createdAt: string;
  user: {
    email: string | null;
    discordId: string | null;
    name: string | null;
  } | null;
};

function formatChoiceLabel(
  choice: string,
  t: ReturnType<typeof useTranslations<"dashboard">>
): string {
  const prefs = parseConsentPreferences(choice);
  if (!prefs) return choice;
  if (!prefs.analytics && !prefs.sentry && !prefs.affiliate) {
    return t("cookieConsentChoiceNecessary");
  }
  if (prefs.analytics && prefs.sentry && prefs.affiliate) {
    return t("cookieConsentChoiceAll");
  }
  const parts: string[] = [];
  if (prefs.analytics) parts.push(t("cookieConsentCatAnalytics"));
  if (prefs.sentry) parts.push(t("cookieConsentCatSentry"));
  if (prefs.affiliate) parts.push(t("cookieConsentCatAffiliate"));
  return parts.join(" · ");
}

export function ConsentsAdminClient({
  initialLogs,
  dateLocale,
}: {
  initialLogs: ConsentLogRow[];
  dateLocale: string;
}) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const [q, setQ] = useState("");
  const [logs, setLogs] = useState(initialLogs);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      const response = await fetch(`/api/admin/consents?${params.toString()}`);
      const data = (await response.json()) as {
        logs?: ConsentLogRow[];
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? t("consentsAdminSearchFailed"));
        return;
      }
      setLogs(
        (data.logs ?? []).map((log) => ({
          ...log,
          createdAt:
            typeof log.createdAt === "string"
              ? log.createdAt
              : new Date(log.createdAt).toISOString(),
        }))
      );
    } catch {
      setError(tc("networkError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => void search(e)} className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("consentsAdminSearchPlaceholder")}
          className="min-w-[16rem] flex-1 rounded-xl border border-line bg-surface-muted px-3 py-2 text-sm text-page-fg"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-[#5865F2] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? tc("loading") : t("consentsAdminSearch")}
        </button>
      </form>
      {error ? <p className="text-sm text-warn">{error}</p> : null}

      {logs.length === 0 ? (
        <p className="text-soft">{t("consentsAdminEmpty")}</p>
      ) : (
        <ul className="space-y-3">
          {logs.map((log) => (
            <li
              key={log.id}
              className="rounded-xl border border-line bg-surface px-4 py-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-page-fg">
                  {formatChoiceLabel(log.choice, t)}
                </p>
                <p className="text-xs text-soft">
                  {new Date(log.createdAt).toLocaleString(dateLocale)}
                </p>
              </div>
              <p className="mt-1 text-sm text-soft">
                {[
                  log.user?.email,
                  log.user?.discordId
                    ? `Discord ${log.user.discordId}`
                    : null,
                  log.userId ? `user ${log.userId}` : null,
                  `visitor ${log.visitorId}`,
                  `v${log.policyVersion}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
