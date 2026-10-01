import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireOrg, getOrgSubscription } from "@/lib/access";
import { getPaidInvoiceForCustomer } from "@/lib/stripe-invoices";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";

type RouteContext = {
  params: Promise<{ invoiceId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "stripe-invoice-pdf",
    limit: 30,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const org = await requireOrg({ minRole: "OWNER" });
  if (!org) {
    return NextResponse.json(
      { error: tApi(locale, "unauthenticated") },
      { status: 401 }
    );
  }

  const { invoiceId } = await context.params;
  if (!invoiceId || !invoiceId.startsWith("in_")) {
    return NextResponse.json(
      { error: tApi(locale, "invoiceNotFound") },
      { status: 404 }
    );
  }

  const subscription = await getOrgSubscription(org.organizationId);
  if (!subscription.stripeCustomerId) {
    return NextResponse.json(
      { error: tApi(locale, "noStripeCustomer") },
      { status: 400 }
    );
  }

  try {
    const invoice = await getPaidInvoiceForCustomer(
      invoiceId,
      subscription.stripeCustomerId
    );
    if (!invoice?.invoice_pdf) {
      return NextResponse.json(
        { error: tApi(locale, "invoiceNotFound") },
        { status: 404 }
      );
    }

    const pdfResponse = await fetch(invoice.invoice_pdf);
    if (!pdfResponse.ok) {
      return NextResponse.redirect(invoice.invoice_pdf);
    }

    const bytes = await pdfResponse.arrayBuffer();
    const filename = `facture-${invoice.number ?? invoice.id}.pdf`;
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[stripe] invoice pdf failed", error);
    return NextResponse.json(
      { error: tApi(locale, "invoicePdfFailed") },
      { status: 500 }
    );
  }
}
