"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  formatPriceEur,
  planDisplayPriceEur,
  planYearlySavingsEur,
  PLANS,
  type BillingInterval,
  type PlanId,
} from "@/lib/plans";
import { redirectIfMfaRequired } from "@/lib/api-client-auth";

const ORDER: PlanId[] = ["FREE", "STARTER", "OPS", "SCALE"];

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

  async function openPortal() {
    setLoadingPlan("FREE");
    setError(null);
    try {
      const response = await fetch("/api/stripe/portal", { method: "POST" });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        setError(data.error ?? t("portalFailed"));
        setLoadingPlan(null);
        return;
      }
      window.location.assign(data.url);
    } catch {
      setError(tc("networkError"));
      setLoadingPlan(null);
    }
  }

  async function selectPlan(planId: PlanId) {
    if (planId === "FREE") {
      if (currentPlanId === "FREE") return;
      if (hasActiveStripeSubscription) {
        await openPortal();
        return;
      }
      setError(t("changePlanAlreadyFree"));
      return;
    }

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
        code?: string;
      };

      if (!response.ok) {
        if (redirectIfMfaRequired(data)) return;
        if (response.status === 403) {
          window.location.assign("/dashboard/account");
          return;
        }
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

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-full border border-line bg-page p-1">
          <button
            type="button"
            aria-pressed={interval === "month"}
            onClick={() => setInterval("month")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              interval === "month"
                ? "bg-signal text-white"
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
                ? "bg-signal text-white"
                : "text-soft hover:text-page-fg"
            }`}
          >
            {tPricing("billingYearly")}
          </button>
        </div>
        {interval === "year" ? (
          <span className="rounded-full bg-signal/15 px-3 py-1 text-xs font-semibold text-signal">
            {tPricing("yearlyDiscount")}
          </span>
        ) : null}
      </div>

      <ul className="mt-5 space-y-3">
        {ORDER.map((planId) => {
          const plan = PLANS[planId];
          const amount = planDisplayPriceEur(planId, interval);
          const savings = planYearlySavingsEur(planId);
          const isCurrent =
            planId === "FREE"
              ? currentPlanId === "FREE"
              : currentPlanId === planId && interval === initialInterval;
          const loading = loadingPlan === planId;
          const isFree = planId === "FREE";

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
                  {isFree
                    ? `0 € ${tPricing("perMonth")}`
                    : `${formatPriceEur(amount)} € ${
                        interval === "year"
                          ? tPricing("perYear")
                          : tPricing("perMonth")
                      }`}
                </p>
                {!isFree && interval === "year" ? (
                  <p className="mt-1 text-xs text-signal">
                    {tPricing("yearlyEquivalent", {
                      price: formatPriceEur(
                        Math.round((plan.priceYearlyEur / 12) * 100) / 100
                      ),
                    })}
                    {" · "}
                    {t("changePlanYearlySave", {
                      amount: formatPriceEur(savings),
                    })}
                  </p>
                ) : null}
                {isFree && !isCurrent ? (
                  <p className="mt-1 text-xs text-soft">
                    {hasActiveStripeSubscription
                      ? t("changePlanFreeViaPortal")
                      : t("changePlanFreeHint")}
                  </p>
                ) : null}
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
                className="rounded-full bg-signal px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? tc("loading")
                  : isCurrent
                    ? t("changePlanCurrent")
                    : isFree
                      ? t("changePlanDowngradeFree")
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
