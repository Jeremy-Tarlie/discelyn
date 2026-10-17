"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import {
  planDisplayPriceEur,
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

  function onPlanKeyDown(
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number
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
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-[color:var(--page-fg)]">
        {t("planLabel")}
      </legend>
      <div
        className="flex gap-2 text-xs"
        role="group"
        aria-label={t("billingIntervalLabel")}
      >
        <button
          type="button"
          aria-pressed={interval === "month"}
          onClick={() => onIntervalChange("month")}
          className={`rounded-md px-3 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2] ${
            interval === "month"
              ? "bg-[#5865F2] text-white"
              : "bg-[color:var(--surface-muted)] text-[color:var(--muted)]"
          }`}
        >
          {t("intervalMonth")}
        </button>
        <button
          type="button"
          aria-pressed={interval === "year"}
          onClick={() => onIntervalChange("year")}
          className={`rounded-md px-3 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2] ${
            interval === "year"
              ? "bg-[#5865F2] text-white"
              : "bg-[color:var(--surface-muted)] text-[color:var(--muted)]"
          }`}
        >
          {t("intervalYear")}
        </button>
      </div>
      <div
        role="radiogroup"
        aria-label={t("planLabel")}
        className="grid grid-cols-2 gap-2"
      >
        {ORDER.map((id, index) => {
          const selected = plan === id;
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
              className={`rounded-lg border px-3 py-2.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2] ${
                selected
                  ? "border-[#5865F2] bg-[#5865F2]/15"
                  : "border-[color:var(--border)] bg-[color:var(--surface-muted)] hover:border-[#5865F2]/50"
              }`}
            >
              <span className="block text-sm font-semibold text-[color:var(--page-fg)]">
                {tp(`${id}.name`)}
              </span>
              <span className="mt-0.5 block text-xs text-[color:var(--muted)]">
                {price}
                {period ? ` ${period}` : ""}
              </span>
              <span className="sr-only">{tp(`${id}.description`)}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
