import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { DashboardNavLinks } from "@/components/dashboard/DashboardNavLinks";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { getRequestTheme } from "@/lib/theme";

export async function AdminNav() {
  const t = await getTranslations("admin");
  const tc = await getTranslations("common");
  const theme = await getRequestTheme();

  const items = [
    { href: "/admin", label: t("nav.overview") },
    { href: "/admin/customers", label: t("nav.customers") },
    { href: "/admin/leads", label: t("nav.leads") },
    { href: "/admin/promos", label: t("nav.promos") },
    { href: "/admin/campaigns", label: t("nav.campaigns") },
    { href: "/admin/consents", label: t("nav.consents") },
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
        <Link href="/admin" className="font-display text-lg font-bold text-page-fg">
          Discelyn
        </Link>
        <p className="mt-1 text-xs uppercase tracking-wider text-warn">
          {t("badge")}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <ThemeSwitcher theme={theme} />
          <LocaleSwitcher />
        </div>
      </div>
      <DashboardNavLinks items={items} />
      <div className="mt-auto space-y-3">
        <Link
          href="/dashboard"
          className="block text-sm text-soft underline-offset-2 hover:underline"
        >
          {t("backDashboard")}
        </Link>
        <SignOutButton variant="nav" labelNamespace="dashboard" />
      </div>
    </aside>
  );
}
