import { getLocale, getTranslations } from "next-intl/server";
import {
  formatInvoiceAmount,
  type PaidInvoiceSummary,
} from "@/lib/stripe-invoices";

export async function InvoiceList({
  invoices,
}: {
  invoices: PaidInvoiceSummary[];
}) {
  const t = await getTranslations("dashboard");
  const locale = await getLocale();
  const dateLocale = locale === "en" ? "en-GB" : "fr-FR";

  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="font-display text-xl text-page-fg">{t("invoicesTitle")}</h2>
      <p className="mt-2 text-sm text-soft">{t("invoicesIntro")}</p>

      {invoices.length === 0 ? (
        <p className="mt-5 text-sm text-soft">{t("invoicesEmpty")}</p>
      ) : (
        <ul className="mt-5 divide-y divide-line">
          {invoices.map((invoice) => {
            const date = new Date(invoice.created * 1000).toLocaleDateString(
              dateLocale,
              { year: "numeric", month: "short", day: "numeric" }
            );
            const amount = formatInvoiceAmount(
              invoice.amountPaid,
              invoice.currency,
              dateLocale
            );
            return (
              <li
                key={invoice.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-page-fg">
                    {invoice.number
                      ? t("invoiceNumber", { number: invoice.number })
                      : t("invoiceFallback", { id: invoice.id.slice(-8) })}
                  </p>
                  <p className="mt-0.5 text-sm text-soft">
                    {date}
                    {" · "}
                    {amount}
                    {invoice.description
                      ? ` · ${invoice.description}`
                      : ""}
                  </p>
                </div>
                {invoice.hasPdf ? (
                  <a
                    href={`/api/stripe/invoices/${invoice.id}/pdf`}
                    className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-[#5865F2] transition hover:border-[#5865F2]"
                  >
                    {t("invoiceDownloadPdf")}
                  </a>
                ) : (
                  <span className="text-xs text-soft">
                    {t("invoicePdfUnavailable")}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
