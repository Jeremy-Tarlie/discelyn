import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { DashboardNavLinks } from "@/components/dashboard/DashboardNavLinks";
import { getRequestTheme } from "@/lib/theme";

export async function DashboardNav({
  planName,
  showLeads = false,
}: {
  planName: string;
  showLeads?: boolean;
}) {
  const t = await getTranslations("dashboard");
  const theme = await getRequestTheme();

  const items = [
    { href: "/dashboard", label: t("overview") },
    { href: "/dashboard/bots", label: t("myBots") },
    { href: "/dashboard/learners", label: t("learnersNav") },
    { href: "/dashboard/access-stats", label: t("accessStatsNav") },
    { href: "/dashboard/affiliates", label: t("affiliatesNav") },
    { href: "/dashboard/webhooks", label: t("webhooksNav") },
    { href: "/dashboard/billing", label: t("billing") },
    ...(showLeads ? [{ href: "/dashboard/leads", label: t("leads") }] : []),
  ];

  return (
    <aside className="flex w-full flex-col gap-6 border-b border-line bg-surface p-4 sm:p-6 md:min-h-screen md:w-64 md:border-b-0 md:border-r md:gap-8">
      <div>
        <Link href="/" className="font-display text-lg font-bold text-page-fg">
          Botly
        </Link>
        <p className="mt-1 text-xs uppercase tracking-wider text-signal">
          {t("planLabel", { name: planName })}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <ThemeSwitcher theme={theme} />
          <LocaleSwitcher />
        </div>
      </div>
      <DashboardNavLinks items={items} />
      <Link
        href="/api/auth/signout"
        className="mt-auto text-sm text-soft hover:text-warn"
      >
        {t("logout")}
      </Link>
    </aside>
  );
}
