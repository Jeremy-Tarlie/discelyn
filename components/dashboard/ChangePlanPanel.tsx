"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  formatPriceEur,
  planDisplayPriceEur,
  type BillingInterval,
  type PlanId,
} from "@/lib/plans";

const ORDER: PlanId[] = ["STARTER", "OPS", "SCALE"];

export function ChangePlanPanel({
  currentPlanId,
  initialInterval,
  hasActiveStripeSubscription,
}: {
  currentPlanId: PlanId;
  initialInterval: BillingInterval;
  hasActiveStripeSubscription: boolean;
}) {
  const t = useTranslations("dashboard");
  const tp = useTranslations("plans");
  const tPricing = useTranslations("pricing");
  const tc = useTranslations("common");
  const router = useRouter();
  const [interval, setInterval] = useState<BillingInterval>(initialInterval);
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function selectPlan(planId: PlanId) {
    setLoadingPlan(planId);
    setError(null);
    setSuccess(null);

    const endpoint = hasActiveStripeSubscription
      ? "/api/stripe/change-plan"
      : "/api/stripe/checkout";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, interval }),
      });
      const data = (await response.json()) as {
        url?: string;
        ok?: boolean;
        plan?: string;
        error?: string;
      };

      if (!response.ok) {
        setError(data.error ?? t("changePlanFailed"));
        setLoadingPlan(null);
        return;
      }

      if (data.url) {
        window.location.assign(data.url);
        return;
      }

      setSuccess(t("changePlanSuccess", { plan: tp(`${planId}.name`) }));
      setLoadingPlan(null);
      router.refresh();
    } catch {
      setError(tc("networkError"));
      setLoadingPlan(null);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="font-display text-xl text-page-fg">{t("changePlanTitle")}</h2>
      <p className="mt-2 text-sm text-soft">{t("changePlanIntro")}</p>

      <div className="mt-4 inline-flex rounded-full border border-line bg-page p-1">
        <button
          type="button"
          aria-pressed={interval === "month"}
          onClick={() => setInterval("month")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            interval === "month"
              ? "bg-[#5865F2] text-white"
              : "text-soft hover:text-page-fg"
          }`}
        >
          {tPricing("billingMonthly")}
        </button>
        <button
          type="button"
          aria-pressed={interval === "year"}
          onClick={() => setInterval("year")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            interval === "year"
              ? "bg-[#5865F2] text-white"
              : "text-soft hover:text-page-fg"
          }`}
        >
          {tPricing("billingYearly")}
        </button>
      </div>

      <ul className="mt-5 space-y-3">
        {ORDER.map((planId) => {
          const amount = planDisplayPriceEur(planId, interval);
          const isCurrent =
            currentPlanId === planId && interval === initialInterval;
          const loading = loadingPlan === planId;

          return (
            <li
              key={planId}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                isCurrent
                  ? "border-signal/40 bg-signal/5"
                  : "border-line bg-page"
              }`}
            >
              <div>
                <p className="font-medium text-page-fg">{tp(`${planId}.name`)}</p>
                <p className="text-sm text-soft">
                  {formatPriceEur(amount)} €
                  {interval === "year"
                    ? tPricing("perYear")
                    : tPricing("perMonth")}
                </p>
                {isCurrent ? (
                  <p className="mt-1 text-xs text-signal">
                    {t("changePlanCurrent")}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                disabled={isCurrent || loadingPlan !== null}
                onClick={() => void selectPlan(planId)}
                className="rounded-full bg-[#5865F2] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? tc("loading")
                  : isCurrent
                    ? t("changePlanCurrent")
                    : hasActiveStripeSubscription
                      ? t("changePlanSwitch")
                      : tPricing("subscribe")}
              </button>
            </li>
          );
        })}
      </ul>

      {error ? <p className="mt-4 text-sm text-warn">{error}</p> : null}
      {success ? <p className="mt-4 text-sm text-signal">{success}</p> : null}
    </section>
  );
}
