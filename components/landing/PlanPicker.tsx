"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import {
  maxPlanYearlySavingsPercent,
  planDisplayPriceEur,
  planYearlySavingsPercent,
  type BillingInterval,
  type PlanId,
} from "@/lib/plans";
import type { SignupPlanId } from "@/lib/auth-callback";

const ORDER: SignupPlanId[] = ["FREE", "STARTER", "OPS", "SCALE"];

export function PlanPicker({
  plan,
  interval,
  onPlanChange,
  onIntervalChange,
}: {
  plan: SignupPlanId;
  interval: BillingInterval;
  onPlanChange: (plan: SignupPlanId) => void;
  onIntervalChange: (interval: BillingInterval) => void;
}) {
  const t = useTranslations("signup");
  const tp = useTranslations("plans");
  const tPricing = useTranslations("pricing");
  const radioRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const maxYearlyPercent = maxPlanYearlySavingsPercent();

  function onPlanKeyDown(
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let nextIndex: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      nextIndex = (index + 1) % ORDER.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      nextIndex = (index - 1 + ORDER.length) % ORDER.length;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = ORDER.length - 1;
    }
    if (nextIndex === null) return;
    e.preventDefault();
    const nextId = ORDER[nextIndex];
    if (!nextId) return;
    onPlanChange(nextId);
    radioRefs.current[nextIndex]?.focus();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-2">
        <div
          className="mx-auto flex w-fit rounded-full border border-[color:var(--border)] bg-[color:var(--surface-muted)]/80 p-1 text-xs"
          role="group"
          aria-label={t("billingIntervalLabel")}
        >
          <button
            type="button"
            aria-pressed={interval === "month"}
            onClick={() => onIntervalChange("month")}
            className={`rounded-full px-4 py-1.5 font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2] ${
              interval === "month"
                ? "bg-signal text-ink-950 shadow-sm"
                : "text-[color:var(--muted)] hover:text-[color:var(--page-fg)]"
            }`}
          >
            {t("intervalMonth")}
          </button>
          <button
            type="button"
            aria-pressed={interval === "year"}
            onClick={() => onIntervalChange("year")}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2] ${
              interval === "year"
                ? "bg-signal text-ink-950 shadow-sm"
                : "text-[color:var(--muted)] hover:text-[color:var(--page-fg)]"
            }`}
          >
            {t("intervalYear")}
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                interval === "year"
                  ? "bg-ink-950/10 text-ink-950"
                  : "bg-signal/20 text-signal-dim"
              }`}
            >
              −{maxYearlyPercent}&nbsp;%
            </span>
          </button>
        </div>
        {interval === "year" ? (
          <p className="text-center text-xs font-semibold text-signal-dim">
            {tPricing("yearlyDiscountUpTo", { percent: maxYearlyPercent })}
            <span className="font-normal text-[color:var(--muted)]">
              {" "}
              · {tPricing("yearlyDiscountHint")}
            </span>
          </p>
        ) : null}
      </div>
      <div
        role="radiogroup"
        aria-label={t("planLabel")}
        className="grid grid-cols-2 gap-x-2.5 gap-y-3.5 overflow-visible pt-1"
      >
        {ORDER.map((id, index) => {
          const selected = plan === id;
          const planPercent = planYearlySavingsPercent(id as PlanId);
          const price =
            id === "FREE"
              ? tPricing("freePrice")
              : tPricing("priceEur", {
                  amount: planDisplayPriceEur(id as PlanId, interval),
                });
          const period =
            id === "FREE"
              ? ""
              : interval === "year"
                ? tPricing("perYear")
                : tPricing("perMonth");
          return (
            <button
              key={id}
              ref={(el) => {
                radioRefs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onPlanChange(id)}
              onKeyDown={(e) => onPlanKeyDown(e, index)}
              className={`relative overflow-visible rounded-xl border px-3 pb-3 pt-3.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2] ${
                selected
                  ? "border-signal bg-signal/10 shadow-[0_0_0_1px_rgba(61,207,176,0.35)]"
                  : "border-[color:var(--border)] bg-[color:var(--surface-muted)]/70 hover:border-signal/40"
              }`}
            >
              {interval === "year" && planPercent > 0 ? (
                <span
                  className="absolute -left-1.5 -top-2 z-10 inline-flex rotate-[-6deg] items-center rounded-md bg-signal px-2 py-1 text-[10px] font-bold leading-none text-ink-950 shadow-[0_2px_8px_rgba(15,23,42,0.18)] ring-1 ring-ink-950/10"
                  title={tPricing("yearlyDiscount", { percent: planPercent })}
                >
                  {tPricing("yearlyDiscountTag", { percent: planPercent })}
                  <span className="sr-only">
                    {" "}
                    {tPricing("yearlyDiscount", { percent: planPercent })}
                  </span>
                </span>
              ) : null}
              {selected ? (
                <span
                  aria-hidden
                  className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-signal text-ink-950"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 12.5 9.5 17 19 7"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              ) : null}
              <span className="block pr-6 text-sm font-semibold text-[color:var(--page-fg)]">
                {tp(`${id}.name`)}
              </span>
              <span className="mt-1 block text-xs text-[color:var(--muted)]">
                {price}
                {period ? ` ${period}` : ""}
              </span>
              <span className="sr-only">{tp(`${id}.description`)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
