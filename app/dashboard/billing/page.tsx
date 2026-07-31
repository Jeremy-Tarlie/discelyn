import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserSubscription } from "@/lib/access";
import { getPlan, type PlanId } from "@/lib/plans";
import { PortalButton } from "@/components/dashboard/PortalButton";

type PageProps = {
  searchParams: Promise<{ success?: string }>;
};

export default async function BillingPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  const params = await searchParams;
  const subscription = await getUserSubscription(session!.user.id);
  const plan = getPlan(subscription.plan as PlanId);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-3xl text-mist-100">Abonnement</h1>
        <p className="mt-2 text-mist-400">
          Paiement géré par Stripe. Tu peux changer ou annuler à tout moment.
        </p>
      </div>

      {params.success ? (
        <div className="rounded-xl border border-signal/40 bg-signal/10 px-4 py-3 text-sm text-signal">
          Paiement confirmé. Ton plan sera mis à jour sous quelques secondes.
        </div>
      ) : null}

      <div className="rounded-2xl border border-ink-600 bg-ink-900/70 p-6">
        <p className="text-sm text-mist-400">Plan actuel</p>
        <p className="mt-1 font-display text-3xl text-mist-100">{plan.name}</p>
        <p className="mt-2 text-mist-300">
          {plan.priceMonthlyEur === 0
            ? "Gratuit"
            : `${plan.priceMonthlyEur.toFixed(2).replace(".", ",")} € / mois`}
        </p>
        <p className="mt-4 text-sm text-mist-400">
          Statut : {subscription.status}
          {subscription.currentPeriodEnd
            ? ` · renouvellement ${subscription.currentPeriodEnd.toLocaleDateString("fr-FR")}`
            : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <Link
          href="/pricing"
          className="rounded-full bg-signal px-5 py-2.5 text-sm font-semibold text-ink-950"
        >
          Changer de plan
        </Link>
        {subscription.stripeCustomerId ? <PortalButton /> : null}
      </div>
    </div>
  );
}
