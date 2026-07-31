import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserSubscription } from "@/lib/access";
import { getPlan, type PlanId } from "@/lib/plans";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;
  const subscription = await getUserSubscription(userId);
  const plan = getPlan(subscription.plan as PlanId);
  const bots = await prisma.bot.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-3xl text-mist-100">
          Salut {session!.user.name?.split(" ")[0] ?? ""}
        </h1>
        <p className="mt-2 text-mist-400">
          Plan {plan.name} · {bots.length}/{plan.maxBots} bot
          {plan.maxBots > 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-ink-600 bg-ink-900/60 p-5">
          <p className="text-xs uppercase tracking-wide text-mist-400">Bots</p>
          <p className="mt-2 font-display text-3xl text-mist-100">
            {bots.length}
          </p>
        </div>
        <div className="rounded-2xl border border-ink-600 bg-ink-900/60 p-5">
          <p className="text-xs uppercase tracking-wide text-mist-400">
            Modules
          </p>
          <p className="mt-2 font-display text-3xl text-mist-100">
            {plan.modules.length}
          </p>
        </div>
        <div className="rounded-2xl border border-ink-600 bg-ink-900/60 p-5">
          <p className="text-xs uppercase tracking-wide text-mist-400">Prix</p>
          <p className="mt-2 font-display text-3xl text-mist-100">
            {plan.priceMonthlyEur === 0
              ? "Gratuit"
              : `${plan.priceMonthlyEur.toFixed(2).replace(".", ",")} €`}
          </p>
        </div>
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-mist-100">Tes bots</h2>
          <Link href="/dashboard/bots" className="text-sm text-signal">
            Gérer
          </Link>
        </div>
        {bots.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink-600 p-8 text-center">
            <p className="text-mist-300">Aucun bot pour l&apos;instant.</p>
            <Link
              href="/dashboard/bots"
              className="mt-4 inline-block rounded-full bg-signal px-5 py-2 text-sm font-semibold text-ink-950"
            >
              Créer mon premier bot
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {bots.map((bot) => (
              <li key={bot.id}>
                <Link
                  href={`/dashboard/bots/${bot.id}`}
                  className="flex items-center justify-between rounded-xl border border-ink-600 bg-ink-900/50 px-4 py-3 transition hover:border-signal/40"
                >
                  <span className="font-medium text-mist-100">{bot.name}</span>
                  <span className="text-xs uppercase tracking-wide text-mist-400">
                    {bot.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
