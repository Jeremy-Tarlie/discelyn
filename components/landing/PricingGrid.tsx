"use client";

import {
  DIAGNOSTIC_OFFER,
  formatPriceEur,
  PLANS,
  SETUP_OFFER,
  type PlanId,
} from "@/lib/plans";
import { CheckoutButton } from "@/components/landing/CheckoutButton";
import { Reveal } from "@/components/landing/Reveal";
import { useTranslations } from "next-intl";

const ORDER: PlanId[] = ["FREE", "STARTER", "OPS", "SCALE"];

export function PricingGrid() {
  const t = useTranslations("pricing");
  const tp = useTranslations("plans");

  function planBullets(planId: PlanId): string[] {
    const plan = PLANS[planId];
    const guilds =
      plan.maxGuilds > 1
        ? t("guildsMany", { n: plan.maxGuilds })
        : t("guildsOne", { n: plan.maxGuilds });

    if (planId === "FREE") return [guilds, ...t.raw("freeBullets") as string[]];
    if (planId === "STARTER")
      return [guilds, ...(t.raw("starterBullets") as string[])];
    if (planId === "OPS") return [guilds, ...(t.raw("opsBullets") as string[])];
    return [guilds, ...(t.raw("scaleBullets") as string[])];
  }

  return (
    <div className="space-y-12">
      <div>
        <Reveal>
          <p className="text-sm font-medium uppercase tracking-wider text-signal">
            {t("subscriptions")}
          </p>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            {t("subscriptionsHint")}
          </p>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {ORDER.map((id, index) => {
            const plan = PLANS[id];
            const delay = Math.min(index + 1, 4) as 1 | 2 | 3 | 4;
            return (
              <Reveal key={plan.id} delay={delay} variant="scale">
                <article
                  className={`group relative flex h-full flex-col rounded-3xl border p-6 transition duration-300 hover:-translate-y-1 ${
                    plan.highlighted
                      ? "border-[#5865F2]/45 bg-[color:var(--surface)] shadow-[0_0_40px_rgba(88,101,242,0.12)] dark:bg-[#2b2d31]"
                      : "border-[color:var(--border)] bg-[color:var(--surface)] dark:border-white/6 dark:bg-[#2b2d31]"
                  }`}
                >
                  {plan.highlighted ? (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#5865F2] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                      {t("recommended")}
                    </span>
                  ) : null}
                  <h3 className="font-display text-xl font-semibold text-[color:var(--page-fg)]">
                    {tp(`${plan.id}.name`)}
                  </h3>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">
                    {tp(`${plan.id}.description`)}
                  </p>
                  <p className="mt-6 font-display text-4xl font-bold text-[color:var(--page-fg)]">
                    {plan.priceMonthlyEur === 0
                      ? "0 €"
                      : `${formatPriceEur(plan.priceMonthlyEur)} €`}
                    <span className="text-base font-sans font-normal text-[color:var(--muted)]">
                      {" "}
                      {t("perMonth")}
                    </span>
                  </p>
                  <ul className="mt-6 flex-1 space-y-2.5 text-sm text-[color:var(--muted)]">
                    {planBullets(plan.id).map((line) => (
                      <li key={line} className="flex items-start gap-2.5">
                        <span className="mt-0.5 text-signal" aria-hidden>
                          ✓
                        </span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-8">
                    <CheckoutButton
                      planId={plan.id}
                      label={
                        plan.id === "FREE" ? t("tryFree") : t("subscribe")
                      }
                      variant={plan.highlighted ? "primary" : "ghost"}
                    />
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>

      <div>
        <Reveal>
          <p className="text-sm font-medium uppercase tracking-wider text-[color:var(--muted)]">
            {t("optional")}
          </p>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            {t("optionalHint")}
          </p>
        </Reveal>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Reveal delay={1} variant="scale">
            <article className="flex h-full flex-col rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 transition hover:-translate-y-1 dark:border-white/6 dark:bg-[#2b2d31]">
              <h3 className="font-display text-xl font-semibold text-[color:var(--page-fg)]">
                {tp("DIAGNOSTIC.name")}
              </h3>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                {tp("DIAGNOSTIC.description")}
              </p>
              <p className="mt-6 font-display text-4xl font-bold text-[color:var(--page-fg)]">
                {DIAGNOSTIC_OFFER.priceEur} €
                <span className="text-base font-sans font-normal text-[color:var(--muted)]">
                  {" "}
                  {t("oneShot")}
                </span>
              </p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm text-[color:var(--muted)]">
                {(t.raw("diagnosticBullets") as string[]).map((line) => (
                  <li key={line} className="flex items-start gap-2.5">
                    <span className="mt-0.5 text-signal" aria-hidden>
                      ✓
                    </span>
                    <span>
                      {line.replace(
                        "{credit}",
                        String(DIAGNOSTIC_OFFER.setupCreditEur)
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <CheckoutButton
                  planId="DIAGNOSTIC"
                  label={t("orderDiagnostic")}
                  variant="ghost"
                />
              </div>
            </article>
          </Reveal>

          <Reveal delay={2} variant="scale">
            <article className="flex h-full flex-col rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 transition hover:-translate-y-1 dark:border-white/6 dark:bg-[#2b2d31]">
              <h3 className="font-display text-xl font-semibold text-[color:var(--page-fg)]">
                {tp("SETUP.name")}
              </h3>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                {tp("SETUP.description")}
              </p>
              <p className="mt-6 font-display text-4xl font-bold text-[color:var(--page-fg)]">
                {SETUP_OFFER.priceEur} €
                <span className="text-base font-sans font-normal text-[color:var(--muted)]">
                  {" "}
                  {t("oneShot")}
                </span>
              </p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm text-[color:var(--muted)]">
                {(t.raw("setupBullets") as string[]).map((line) => (
                  <li key={line} className="flex items-start gap-2.5">
                    <span className="mt-0.5 text-signal" aria-hidden>
                      ✓
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <CheckoutButton
                  planId="SETUP"
                  label={t("orderSetup")}
                  variant="ghost"
                />
              </div>
            </article>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
