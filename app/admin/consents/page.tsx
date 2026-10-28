import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { ConsentsAdminClient } from "@/components/dashboard/ConsentsAdminClient";

export default async function AdminConsentsPage() {
  const t = await getTranslations("dashboard");
  const locale = await getLocale();

  const logs = await prisma.cookieConsentLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      visitorId: true,
      userId: true,
      choice: true,
      policyVersion: true,
      createdAt: true,
      user: {
        select: {
          email: true,
          discordId: true,
          name: true,
        },
      },
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-3xl text-page-fg">
          {t("consentsAdminTitle")}
        </h1>
        <p className="mt-2 text-sm text-soft">{t("consentsAdminBody")}</p>
      </div>
      <ConsentsAdminClient
        initialLogs={logs.map((log) => ({
          ...log,
          createdAt: log.createdAt.toISOString(),
        }))}
        dateLocale={locale === "en" ? "en-GB" : "fr-FR"}
      />
    </div>
  );
}
