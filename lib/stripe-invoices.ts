import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";

export type PaidInvoiceSummary = {
  id: string;
  number: string | null;
  created: number;
  amountPaid: number;
  currency: string;
  status: string;
  description: string | null;
  hasPdf: boolean;
};

export async function listPaidInvoicesForCustomer(
  customerId: string,
  limit = 24
): Promise<PaidInvoiceSummary[]> {
  const stripe = getStripe();
  const result = await stripe.invoices.list({
    customer: customerId,
    status: "paid",
    limit,
  });

  return result.data.map((invoice) => toSummary(invoice));
}

export async function getPaidInvoiceForCustomer(
  invoiceId: string,
  customerId: string
): Promise<Stripe.Invoice | null> {
  const stripe = getStripe();
  const invoice = await stripe.invoices.retrieve(invoiceId);
  const invoiceCustomer =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;
  if (invoiceCustomer !== customerId) return null;
  if (invoice.status !== "paid") return null;
  return invoice;
}

function toSummary(invoice: Stripe.Invoice): PaidInvoiceSummary {
  const firstLine = invoice.lines?.data?.[0]?.description ?? null;
  const id = invoice.id;
  if (!id) {
    throw new Error("stripe invoice missing id");
  }
  return {
    id,
    number: invoice.number,
    created: invoice.created,
    amountPaid: invoice.amount_paid,
    currency: invoice.currency,
    status: invoice.status ?? "paid",
    description: invoice.description ?? firstLine,
    hasPdf: Boolean(invoice.invoice_pdf),
  };
}

export function formatInvoiceAmount(
  amountCents: number,
  currency: string,
  locale: string
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}
