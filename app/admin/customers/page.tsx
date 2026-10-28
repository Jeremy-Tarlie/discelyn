import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { listAdminCustomers } from "@/lib/admin-customers";

function fmt(date: Date | null, locale: string, never: string) {
  if (!date) return never;
  return date.toLocaleString(locale === "en" ? "en-GB" : "fr-FR");
}

export default async function AdminCustomersPage() {
  const t = await getTranslations("admin");
  const locale = await getLocale();
  const rows = await listAdminCustomers();
  if (!rows) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="font-display text-3xl text-page-fg">
          {t("customersTitle")}
        </h1>
        <p className="mt-2 text-sm text-soft">{t("customersBody")}</p>
      </div>

      {rows.length === 0 ? (
        <p className="text-soft">{t("emptyCustomers")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-surface-muted text-xs uppercase tracking-wider text-soft">
              <tr>
                <th className="px-3 py-2">{t("colOrg")}</th>
                <th className="px-3 py-2">{t("colPlan")}</th>
                <th className="px-3 py-2">{t("colStatus")}</th>
                <th className="px-3 py-2">{t("colOwner")}</th>
                <th className="px-3 py-2">{t("colLogin")}</th>
                <th className="px-3 py-2">{t("colBot")}</th>
                <th className="px-3 py-2">{t("colOpen")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-line bg-surface">
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/admin/customers/${row.id}`}
                      className="font-medium text-page-fg underline-offset-2 hover:underline"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">{row.plan}</td>
                  <td className="px-3 py-2.5">
                    {row.status}
                    {row.cancelAtPeriodEnd ? " · cancel" : ""}
                  </td>
                  <td className="px-3 py-2.5 text-soft">
                    {row.ownerEmail ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-soft">
                    {fmt(row.lastLoginAt, locale, t("never"))}
                  </td>
                  <td className="px-3 py-2.5 text-soft">
                    {fmt(row.botLastSeenAt, locale, t("never"))}
                  </td>
                  <td className="px-3 py-2.5 text-soft">
                    {fmt(row.lastEmailOpenAt, locale, t("never"))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
