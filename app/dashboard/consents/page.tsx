import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { getLocale, getTranslations } from "next-intl/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isLeadsAdmin } from "@/lib/leads-admin";
import { ConsentsAdminClient } from "@/components/dashboard/ConsentsAdminClient";

export default async function ConsentsAdminPage() {
  const session = await getServerSession(authOptions);
  const t = await getTranslations("dashboard");
  const locale = await getLocale();

  const dbUser = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { discordId: true },
      })
    : null;

  if (
    !isLeadsAdmin({
      email: session?.user?.email,
      discordId: dbUser?.discordId,
    })
  ) {
    redirect("/dashboard");
  }

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
