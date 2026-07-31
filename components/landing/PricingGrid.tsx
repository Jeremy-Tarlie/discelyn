import { PLANS, type PlanId } from "@/lib/plans";
import { CheckoutButton } from "@/components/landing/CheckoutButton";

const ORDER: PlanId[] = ["FREE", "STARTER", "PRO", "BUSINESS"];

export function PricingGrid() {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {ORDER.map((id) => {
        const plan = PLANS[id];
        return (
          <article
            key={plan.id}
            className={`relative flex flex-col rounded-2xl border p-6 ${
              plan.highlighted
                ? "border-signal/50 bg-ink-800 shadow-[0_0_40px_rgba(61,207,176,0.12)]"
                : "border-ink-600/80 bg-ink-900/80"
            }`}
          >
            {plan.highlighted ? (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-signal px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-950">
                Populaire
              </span>
            ) : null}
            <h3 className="font-display text-xl text-mist-100">{plan.name}</h3>
            <p className="mt-1 text-sm text-mist-400">{plan.description}</p>
            <p className="mt-6 font-display text-4xl text-mist-100">
              {plan.priceMonthlyEur === 0
                ? "0 €"
                : `${plan.priceMonthlyEur.toFixed(2).replace(".", ",")} €`}
              <span className="text-base font-sans text-mist-400"> / mois</span>
            </p>
            <ul className="mt-6 flex-1 space-y-2 text-sm text-mist-300">
              <li>
                {plan.maxBots} bot{plan.maxBots > 1 ? "s" : ""}
              </li>
              <li>
                {plan.maxGuilds} serveur{plan.maxGuilds > 1 ? "s" : ""}
              </li>
              <li>
                {plan.maxCustomCommands === 0
                  ? "Pas de commandes custom"
                  : `Jusqu'à ${plan.maxCustomCommands} commandes custom`}
              </li>
              <li>{plan.modules.length} modules inclus</li>
              {plan.forceBranding ? <li>Branding Botly affiché</li> : null}
              {plan.prioritySupport ? <li>Support prioritaire</li> : null}
            </ul>
            <div className="mt-8">
              <CheckoutButton
                planId={plan.id}
                label={plan.id === "FREE" ? "Commencer gratuitement" : "Choisir"}
                variant={plan.highlighted ? "primary" : "ghost"}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}
