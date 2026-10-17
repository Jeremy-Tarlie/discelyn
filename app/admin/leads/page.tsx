import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";

export default async function AdminLeadsPage() {
  const t = await getTranslations("dashboard");
  const locale = await getLocale();
  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const dateLocale = locale === "en" ? "en-GB" : "fr-FR";

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-3xl text-page-fg">{t("leadsTitle")}</h1>
        <p className="mt-2 text-sm text-soft">
          {t("leadsBody", { envHint: t("leadsEnvHint") })}
        </p>
      </div>

      {leads.length === 0 ? (
        <p className="text-soft">{t("leadsEmpty")}</p>
      ) : (
        <ul className="space-y-3">
          {leads.map((lead) => (
            <li
              key={lead.id}
              className="rounded-xl border border-line bg-surface px-4 py-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-page-fg">{lead.email}</p>
                <p className="text-xs text-soft">
                  {lead.createdAt.toLocaleString(dateLocale)}
                </p>
              </div>
              <p className="mt-1 text-sm text-soft">
                {[lead.name, lead.company, lead.role, lead.offer]
                  .filter(Boolean)
                  .join(" · ") || "—"}
                {lead.marketingConsentAt ? " · marketing ✓" : ""}
              </p>
              {lead.message ? (
                <p className="mt-2 whitespace-pre-wrap text-sm text-soft">
                  {lead.message}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
