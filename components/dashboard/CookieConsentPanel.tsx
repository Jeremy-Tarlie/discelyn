import { getLocale, getTranslations } from "next-intl/server";
import { parseConsentPreferences } from "@/lib/consent";

type ConsentRow = {
  id: string;
  choice: string;
  policyVersion: string;
  createdAt: Date;
};

function formatChoice(
  choice: string,
  labels: {
    necessary: string;
    all: string;
    analytics: string;
    sentry: string;
    affiliate: string;
  }
): string {
  const prefs = parseConsentPreferences(choice);
  if (!prefs) return choice;
  if (!prefs.analytics && !prefs.sentry && !prefs.affiliate) {
    return labels.necessary;
  }
  if (prefs.analytics && prefs.sentry && prefs.affiliate) {
    return labels.all;
  }
  const parts: string[] = [];
  if (prefs.analytics) parts.push(labels.analytics);
  if (prefs.sentry) parts.push(labels.sentry);
  if (prefs.affiliate) parts.push(labels.affiliate);
  return parts.join(" · ") || labels.necessary;
}

export async function CookieConsentPanel({
  logs,
}: {
  logs: ConsentRow[];
}) {
  const t = await getTranslations("dashboard");
  const locale = await getLocale();
  const dateLocale = locale === "en" ? "en-GB" : "fr-FR";
  const latest = logs[0] ?? null;
  const labels = {
    necessary: t("cookieConsentChoiceNecessary"),
    all: t("cookieConsentChoiceAll"),
    analytics: t("cookieConsentCatAnalytics"),
    sentry: t("cookieConsentCatSentry"),
    affiliate: t("cookieConsentCatAffiliate"),
  };

  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="font-display text-xl text-page-fg">
        {t("cookieConsentTitle")}
      </h2>
      <p className="mt-2 text-sm text-soft">{t("cookieConsentIntro")}</p>

      {latest ? (
        <p className="mt-4 text-sm text-page-fg">
          {t("cookieConsentLatest", {
            choice: formatChoice(latest.choice, labels),
            date: latest.createdAt.toLocaleString(dateLocale),
            version: latest.policyVersion,
          })}
        </p>
      ) : (
        <p className="mt-4 text-sm text-soft">{t("cookieConsentEmpty")}</p>
      )}

      {logs.length > 0 ? (
        <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto">
          {logs.map((log) => (
            <li
              key={log.id}
              className="rounded-xl border border-line bg-surface-muted px-3 py-2 text-sm"
            >
              <span className="font-medium text-page-fg">
                {formatChoice(log.choice, labels)}
              </span>
              <span className="text-soft">
                {" · "}
                {log.createdAt.toLocaleString(dateLocale)}
                {" · v"}
                {log.policyVersion}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
