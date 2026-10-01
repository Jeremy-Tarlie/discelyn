import { getLocale, getTranslations } from "next-intl/server";
import { getOrgSubscription } from "@/lib/access";
import {
  getPlan,
  formatPriceEur,
  PLANS,
  type BillingInterval,
  type PlanId,
} from "@/lib/plans";
import { listPaidInvoicesForCustomer } from "@/lib/stripe-invoices";
import { PortalButton } from "@/components/dashboard/PortalButton";
import { ChangePlanPanel } from "@/components/dashboard/ChangePlanPanel";
import { InvoiceList } from "@/components/dashboard/InvoiceList";

function resolveBillingInterval(stripePriceId: string | null): BillingInterval {
  if (!stripePriceId) return "month";
  for (const plan of Object.values(PLANS)) {
    const yearly = plan.stripePriceYearlyEnvKey
      ? process.env[plan.stripePriceYearlyEnvKey]
      : undefined;
    if (yearly && yearly === stripePriceId) return "year";
  }
  return "month";
}

/** Plan actuel + changement de plan + factures (+ portail Stripe). */
export async function BillingPanels({
  organizationId,
  showHeading = false,
  success = false,
}: {
  organizationId: string;
  showHeading?: boolean;
  success?: boolean;
}) {
  const subscription = await getOrgSubscription(organizationId);
  const planId = subscription.plan as PlanId;
  const plan = getPlan(planId);
  const t = await getTranslations("dashboard");
  const locale = await getLocale();
  const activeStatuses = new Set(["ACTIVE", "TRIALING", "PAST_DUE"]);
  const hasActiveStripeSubscription = Boolean(
    subscription.stripeSubscriptionId &&
      activeStatuses.has(subscription.status)
  );
  const initialInterval = resolveBillingInterval(subscription.stripePriceId);

  let invoices: Awaited<ReturnType<typeof listPaidInvoicesForCustomer>> = [];
  if (subscription.stripeCustomerId) {
    try {
      invoices = await listPaidInvoicesForCustomer(
        subscription.stripeCustomerId
      );
    } catch (error) {
      console.error("[billing] list invoices failed", error);
    }
  }

  return (
    <div id="abonnement" className="space-y-8 scroll-mt-8">
      {showHeading ? (
        <div>
          <h2 className="font-display text-2xl text-page-fg">
            {t("billingTitle")}
          </h2>
          <p className="mt-2 text-soft">{t("billingIntro")}</p>
        </div>
      ) : null}

      {success ? (
        <div className="rounded-xl border border-signal/40 bg-signal/10 px-4 py-3 text-sm text-signal">
          {t("billingSuccess")}
        </div>
      ) : null}

      <div className="rounded-2xl border border-line bg-surface p-6">
        <p className="text-sm text-soft">{t("billingCurrentPlan")}</p>
        <p className="mt-1 font-display text-3xl text-page-fg">{plan.name}</p>
        <p className="mt-2 text-soft">
          {plan.priceMonthlyEur === 0
            ? t("billingFree")
            : t("billingPerMonth", {
                price: formatPriceEur(plan.priceMonthlyEur),
              })}
        </p>
        <p className="mt-4 text-sm text-soft">
          {t("billingStatus", { status: subscription.status })}
          {subscription.currentPeriodEnd
            ? t("billingRenewal", {
                date: subscription.currentPeriodEnd.toLocaleDateString(
                  locale === "en" ? "en-GB" : "fr-FR"
                ),
              })
            : ""}
        </p>
        {plan.dpaAvailable ? (
          <p className="mt-4 text-sm text-soft">{t("billingDpa")}</p>
        ) : null}
        {plan.auditExport ? (
          <p className="mt-2 text-sm text-soft">{t("billingAuditHint")}</p>
        ) : null}
      </div>

      <ChangePlanPanel
        currentPlanId={planId}
        initialInterval={initialInterval}
        hasActiveStripeSubscription={hasActiveStripeSubscription}
      />

      <InvoiceList invoices={invoices} />

      {subscription.stripeCustomerId ? (
        <div className="flex flex-wrap gap-4">
          <PortalButton />
        </div>
      ) : null}
    </div>
  );
}
