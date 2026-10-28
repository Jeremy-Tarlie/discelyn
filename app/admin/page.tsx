import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getAdminOverviewStats } from "@/lib/admin-customers";

export default async function AdminOverviewPage() {
  const t = await getTranslations("admin");
  const stats = await getAdminOverviewStats();
  if (!stats) redirect("/dashboard");

  const cards = [
    { label: t("statOrgs"), value: stats.orgTotal, href: "/admin/customers" },
    { label: t("statPaid"), value: stats.paid, href: "/admin/customers" },
    { label: t("statFree"), value: stats.free, href: "/admin/customers" },
    { label: t("statPastDue"), value: stats.pastDue, href: "/admin/customers" },
    {
      label: t("statCanceling"),
      value: stats.canceling,
      href: "/admin/customers",
    },
    { label: t("statLeads"), value: stats.leads, href: "/admin/leads" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="font-display text-3xl text-page-fg">
          {t("overviewTitle")}
        </h1>
        <p className="mt-2 text-sm text-soft">{t("overviewBody")}</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <li key={card.label}>
            <Link
              href={card.href}
              className="block rounded-xl border border-line bg-surface px-4 py-4 transition hover:border-signal/40"
            >
              <p className="text-xs uppercase tracking-wider text-soft">
                {card.label}
              </p>
              <p className="mt-2 font-display text-3xl font-bold text-page-fg">
                {card.value}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
