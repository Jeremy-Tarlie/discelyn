import { getServerSession } from "next-auth";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canCreateBot, getUserSubscription } from "@/lib/access";
import { CreateBotForm } from "@/components/dashboard/CreateBotForm";
import { DeleteBotButton } from "@/components/dashboard/DeleteBotButton";

export default async function BotsPage() {
  const session = await getServerSession(authOptions);
  const t = await getTranslations("dashboard");
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
        <h1 className="font-display text-3xl text-page-fg">{t("myBots")}</h1>
        <p className="mt-2 text-soft">{t("botsIntro")}</p>
      </div>

      <CreateBotForm canCreate={limit.ok} />

      <section className="space-y-3">
        {bots.map((bot) => (
          <div
            key={bot.id}
            className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-4"
          >
            <Link
              href={`/dashboard/bots/${bot.id}`}
              className="min-w-0 flex-1 hover:opacity-90"
            >
              <p className="font-medium text-page-fg">{bot.name}</p>
              <p className="text-sm text-soft">
                {bot.enabledModules.length} module
                {bot.enabledModules.length > 1 ? "s" : ""}
              </p>
            </Link>
            <span className="shrink-0 text-xs uppercase text-soft">
              {bot.status}
            </span>
            <DeleteBotButton botId={bot.id} botName={bot.name} />
          </div>
        ))}
      </section>
    </div>
  );
}
