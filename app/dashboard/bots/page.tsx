import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canCreateBot, getUserSubscription } from "@/lib/access";
import { CreateBotForm } from "@/components/dashboard/CreateBotForm";

export default async function BotsPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;
  const subscription = await getUserSubscription(userId);
  const bots = await prisma.bot.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  const limit = canCreateBot(subscription, bots.length);

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <h1 className="font-display text-3xl text-mist-100">Mes bots</h1>
        <p className="mt-2 text-mist-400">
          Crée un bot, active des modules, invite-le sur ton serveur.
        </p>
      </div>

      <CreateBotForm canCreate={limit.ok} />

      <section className="space-y-3">
        {bots.map((bot) => (
          <Link
            key={bot.id}
            href={`/dashboard/bots/${bot.id}`}
            className="flex items-center justify-between rounded-xl border border-ink-600 bg-ink-900/60 px-4 py-4 hover:border-signal/40"
          >
            <div>
              <p className="font-medium text-mist-100">{bot.name}</p>
              <p className="text-sm text-mist-400">
                {bot.enabledModules.length} module
                {bot.enabledModules.length > 1 ? "s" : ""}
              </p>
            </div>
            <span className="text-xs uppercase text-mist-400">{bot.status}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
