import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { DashboardNavLinks } from "@/components/dashboard/DashboardNavLinks";
import {
  OrgSwitcher,
  type OrgSwitcherItem,
} from "@/components/dashboard/OrgSwitcher";
import { getRequestTheme } from "@/lib/theme";
import { SignOutButton } from "@/components/auth/SignOutButton";

export async function DashboardNav({
  planName,
  showLeads = false,
  organizations = [],
  activeOrganizationId,
}: {
  planName: string;
  showLeads?: boolean;
  organizations?: OrgSwitcherItem[];
  activeOrganizationId?: string;
}) {
  const t = await getTranslations("dashboard");
  const tc = await getTranslations("common");
  const theme = await getRequestTheme();

  const items = [
    { href: "/dashboard", label: t("overview") },
    { href: "/dashboard/bots", label: t("myBots") },
    { href: "/dashboard/learners", label: t("learnersNav") },
    { href: "/dashboard/access-stats", label: t("accessStatsNav") },
    { href: "/dashboard/affiliates", label: t("affiliatesNav") },
    { href: "/dashboard/webhooks", label: t("webhooksNav") },
    { href: "/dashboard/team", label: t("teamNav") },
    { href: "/dashboard/billing", label: t("billing") },
    { href: "/dashboard/account", label: t("accountNav") },
    ...(showLeads
      ? [{ href: "/admin", label: t("platformAdminNav") }]
      : []),
  ];

  return (
    <aside className="flex w-full flex-col gap-6 border-b border-line bg-surface p-4 sm:p-6 md:min-h-screen md:w-64 md:border-b-0 md:border-r md:gap-8">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[#5865F2] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        {tc("skipToContent")}
      </a>
      <div>
        <Link href="/" className="font-display text-lg font-bold text-page-fg">
          Discelyn
        </Link>
        <p className="mt-1 text-xs uppercase tracking-wider text-signal">
          {t("planLabel", { name: planName })}
        </p>
        {activeOrganizationId ? (
          <OrgSwitcher
            organizations={organizations}
            activeOrganizationId={activeOrganizationId}
            label={t("orgSwitcherLabel")}
            switchingLabel={t("orgSwitcherSwitching")}
          />
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <ThemeSwitcher theme={theme} />
          <LocaleSwitcher />
        </div>
      </div>
      <DashboardNavLinks items={items} />
      <SignOutButton variant="nav" labelNamespace="dashboard" />
    </aside>
  );
}
