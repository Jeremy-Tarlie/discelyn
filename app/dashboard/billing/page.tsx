import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserSubscription } from "@/lib/access";
import { getPlan, formatPriceEur, type PlanId } from "@/lib/plans";
import { PortalButton } from "@/components/dashboard/PortalButton";
import { GdprActions } from "@/components/dashboard/GdprActions";

type PageProps = {
  searchParams: Promise<{ success?: string }>;
};

export default async function BillingPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  const params = await searchParams;
  const subscription = await getUserSubscription(session!.user.id);
  const plan = getPlan(subscription.plan as PlanId);
  const t = await getTranslations("dashboard");
  const locale = await getLocale();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-3xl text-page-fg">
          {t("billingTitle")}
        </h1>
        <p className="mt-2 text-soft">{t("billingIntro")}</p>
      </div>

      {params.success ? (
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

      <div className="flex flex-wrap gap-4">
        <Link
          href="/pricing"
          className="rounded-full bg-signal px-5 py-2.5 text-sm font-semibold text-ink-950"
        >
          {t("billingChangePlan")}
        </Link>
        {subscription.stripeCustomerId ? <PortalButton /> : null}
      </div>

      <GdprActions />
    </div>
  );
}
