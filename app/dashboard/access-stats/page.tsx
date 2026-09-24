import { getTranslations } from "next-intl/server";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAccessStatsForUser } from "@/lib/dashboard-data";

export default async function AccessStatsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const t = await getTranslations("dashboard.accessStats");
  const stats = await getAccessStatsForUser(session.user.id, 30);

  const cards = [
    { label: t("gmv"), value: `${(stats.gmvCents / 100).toFixed(2)}` },
    { label: t("paid"), value: String(stats.paid) },
    { label: t("claimed"), value: String(stats.claimed) },
    {
      label: t("conversion"),
      value: `${stats.conversionPaidToClaimed}%`,
    },
    { label: t("active"), value: String(stats.active) },
    { label: t("pending"), value: String(stats.pending) },
    { label: t("refunds"), value: String(stats.refunds) },
    { label: t("oversold"), value: String(stats.oversold) },
    {
      label: t("mrrApprox"),
      value: String(stats.recurringActiveApprox),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-page-fg">{t("title")}</h1>
        <p className="mt-1 text-sm text-soft">
          {t("body", { days: stats.periodDays })}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-line bg-surface p-4"
          >
            <p className="text-xs uppercase tracking-wide text-soft">{c.label}</p>
            <p className="mt-2 font-display text-2xl text-page-fg">{c.value}</p>
          </div>
        ))}
      </div>
      <ul className="divide-y divide-line rounded-2xl border border-line">
        {stats.products.map((p) => (
          <li key={p.id} className="flex justify-between px-4 py-3 text-sm">
            <span className="text-page-fg">
              {p.name}
              {p.billingMode === "RECURRING" ? ` · ${t("subscription")}` : ""}
            </span>
            <span className="text-soft">
              {p.maxSeats != null
                ? `${t("seatsOfMax", { used: p.seatsUsed, max: p.maxSeats })}${
                    p.soldOut ? ` ${t("soldOut")}` : ""
                  }`
                : t("seats", { used: p.seatsUsed })}
            </span>
          </li>
        ))}
      </ul>
      {stats.oversoldEvents.length > 0 ? (
        <div className="space-y-2">
          <h2 className="font-display text-lg text-page-fg">
            {t("oversoldTitle")}
          </h2>
          <p className="text-sm text-soft">{t("oversoldBody")}</p>
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {stats.oversoldEvents.map((e) => (
              <li
                key={e.id}
                className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:justify-between"
              >
                <span className="text-page-fg">
                  {e.productName}
                  {e.customerEmail ? ` · ${e.customerEmail}` : ""}
                </span>
                <span className="text-soft">
                  {e.amountTotal != null
                    ? `${(e.amountTotal / 100).toFixed(2)} ${(
                        e.currency ?? "eur"
                      ).toUpperCase()}`
                    : "—"}{" "}
                  ·{" "}
                  {e.refundStatus === "refunded"
                    ? t("refundStatus.refunded")
                    : e.refundStatus === "refund_failed"
                      ? t("refundStatus.refund_failed")
                      : e.refundStatus === "skipped"
                        ? t("refundStatus.skipped")
                        : t("refundStatus.pending")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
