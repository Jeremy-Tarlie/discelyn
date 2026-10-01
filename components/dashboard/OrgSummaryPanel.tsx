import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getPlan, type PlanId } from "@/lib/plans";

export async function OrgSummaryPanel({
  orgName,
  role,
  planId,
  stripeConfigured,
  botCount,
  memberCount,
}: {
  orgName: string;
  role: string;
  planId: PlanId;
  stripeConfigured: boolean;
  botCount: number;
  memberCount: number;
}) {
  const t = await getTranslations("dashboard");
  const plan = getPlan(planId);

  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="font-display text-xl text-page-fg">{t("orgTitle")}</h2>
      <p className="mt-2 text-sm text-soft">{t("orgIntro")}</p>
      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-soft">{t("orgName")}</dt>
          <dd className="mt-0.5 font-medium text-page-fg">{orgName}</dd>
        </div>
        <div>
          <dt className="text-soft">{t("orgRole")}</dt>
          <dd className="mt-0.5 font-medium text-page-fg">{role}</dd>
        </div>
        <div>
          <dt className="text-soft">{t("orgPlan")}</dt>
          <dd className="mt-0.5 font-medium text-page-fg">{plan.name}</dd>
        </div>
        <div>
          <dt className="text-soft">{t("orgStripe")}</dt>
          <dd className="mt-0.5 font-medium text-page-fg">
            {stripeConfigured ? t("orgStripeOk") : t("orgStripeMissing")}
          </dd>
        </div>
        <div>
          <dt className="text-soft">{t("orgBots")}</dt>
          <dd className="mt-0.5 font-medium text-page-fg">{botCount}</dd>
        </div>
        <div>
          <dt className="text-soft">{t("orgMembers")}</dt>
          <dd className="mt-0.5 font-medium text-page-fg">{memberCount}</dd>
        </div>
      </dl>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href="/dashboard/team"
          className="text-sm font-semibold text-[#5865F2]"
        >
          {t("orgTeamLink")}
        </Link>
        <Link
          href="/dashboard/webhooks"
          className="text-sm font-semibold text-[#5865F2]"
        >
          {t("orgWebhooksLink")}
        </Link>
      </div>
    </section>
  );
}
