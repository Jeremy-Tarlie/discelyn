import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getAdminCustomerDetail } from "@/lib/admin-customers";
import { requirePlatformAdmin } from "@/lib/platform-admin";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminCustomerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const t = await getTranslations("admin");
  const locale = await getLocale();
  const dateLocale = locale === "en" ? "en-GB" : "fr-FR";
  const admin = await requirePlatformAdmin();
  if (!admin) redirect("/dashboard");
  const org = await getAdminCustomerDetail(id);
  if (!org) notFound();

  const sub = org.subscription;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <Link
          href="/admin/customers"
          className="text-sm text-soft underline-offset-2 hover:underline"
        >
          ← {t("customersTitle")}
        </Link>
        <h1 className="mt-3 font-display text-3xl text-page-fg">{org.name}</h1>
        <p className="mt-1 text-sm text-soft">
          {t("customerDetail")} · {org.createdAt.toLocaleString(dateLocale)}
        </p>
      </div>

      <section className="rounded-xl border border-line bg-surface p-4">
        <p className="text-sm">
          <span className="text-soft">{t("colPlan")}: </span>
          {sub?.plan ?? "FREE"}
        </p>
        <p className="mt-1 text-sm">
          <span className="text-soft">{t("colStatus")}: </span>
          {sub?.status ?? "—"}
          {sub?.cancelAtPeriodEnd ? " (cancel at period end)" : ""}
        </p>
        {sub?.currentPeriodEnd ? (
          <p className="mt-1 text-sm text-soft">
            Period end: {sub.currentPeriodEnd.toLocaleString(dateLocale)}
          </p>
        ) : null}
        {sub?.stripeCustomerId ? (
          <p className="mt-1 font-mono text-xs text-soft">
            {sub.stripeCustomerId}
          </p>
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl text-page-fg">{t("members")}</h2>
        <ul className="space-y-2">
          {org.memberships.map((m) => (
            <li
              key={m.id}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            >
              <span className="font-medium">{m.role}</span> ·{" "}
              {m.user.email ?? m.user.name ?? m.user.id}
              {m.user.marketingConsentAt ? (
                <span className="ml-2 text-xs text-signal-dim">marketing OK</span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl text-page-fg">{t("bots")}</h2>
        {org.bots.length === 0 ? (
          <p className="text-sm text-soft">—</p>
        ) : (
          <ul className="space-y-2">
            {org.bots.map((bot) => (
              <li
                key={bot.id}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              >
                {bot.name} · {bot.status}
                {bot.lastSeenAt
                  ? ` · seen ${bot.lastSeenAt.toLocaleString(dateLocale)}`
                  : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl text-page-fg">{t("activity")}</h2>
        <ul className="space-y-1 text-sm text-soft">
          {org.memberships
            .filter((m) => m.role === "OWNER")
            .flatMap((m) => m.user.activityLogs)
            .slice(0, 20)
            .map((log, i) => (
              <li key={`${log.action}-${log.createdAt.toISOString()}-${i}`}>
                {log.createdAt.toLocaleString(dateLocale)} — {log.action}
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
