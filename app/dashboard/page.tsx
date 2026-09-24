import Link from "next/link";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserSubscription } from "@/lib/access";
import { getPlan, type PlanId } from "@/lib/plans";

type PageProps = {
  searchParams: Promise<{ setup?: string; diagnostic?: string }>;
};

export default async function DashboardPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  const params = await searchParams;
  const t = await getTranslations("dashboard");
  const userId = session!.user.id;
  const subscription = await getUserSubscription(userId);
  const plan = getPlan(subscription.plan as PlanId);
  const bots = await prisma.bot.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, status: true, enabledModules: true },
  });
  const firstName = session!.user.name?.split(" ")[0];

  const [accessProducts, activeLearners, stripeConfig, primaryBot] =
    await Promise.all([
      prisma.accessProduct.count({ where: { userId, active: true } }),
      prisma.learnerAccess.count({
        where: { bot: { userId }, status: "ACTIVE" },
      }),
      prisma.orgStripeConfig.findUnique({
        where: { userId },
        select: { id: true },
      }),
      prisma.bot.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      }),
    ]);

  const accessHref = primaryBot
    ? `/dashboard/bots/${primaryBot.id}`
    : "/dashboard/bots";
  const stripeOk = Boolean(stripeConfig);
  const wedgeReady = stripeOk && accessProducts > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {params.diagnostic ? (
        <div className="rounded-xl border border-signal/40 bg-signal/10 px-4 py-3 text-sm text-signal">
          {t("diagnosticOk")}
        </div>
      ) : null}
      {params.setup ? (
        <div className="rounded-xl border border-signal/40 bg-signal/10 px-4 py-3 text-sm text-signal">
          {t("setupOk")}
        </div>
      ) : null}

      <div>
        <h1 className="font-display text-3xl text-page-fg">
          {firstName ? t("hello", { name: firstName }) : t("helloGuest")}
        </h1>
        <p className="mt-2 text-soft">
          {t("planSummary", {
            plan: plan.name,
            used: accessProducts,
            max: plan.maxAccessProducts,
            plural: plan.maxAccessProducts > 1 ? "s" : "",
          })}
        </p>
      </div>

      <section
        className={`rounded-2xl border p-6 ${
          wedgeReady
            ? "border-signal/40 bg-signal/10"
            : "border-warn/50 bg-warn/5"
        }`}
      >
        <p className="text-xs uppercase tracking-wide text-signal">
          {t("wedgeTitle")}
        </p>
        <p className="mt-2 text-page-fg">{t("wedgeBody")}</p>
        <Link
          href={accessHref}
          className="mt-4 inline-flex rounded-full bg-[#5865F2] px-5 py-2.5 text-sm font-semibold text-white"
        >
          {t("wedgeCta")}
        </Link>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-soft">
            {t("statStripe")}
          </p>
          <p className="mt-2 font-display text-2xl text-page-fg">
            {stripeOk ? t("statStripeOk") : t("statStripeMissing")}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-soft">
            {t("statAccessProducts")}
          </p>
          <p className="mt-2 font-display text-3xl text-page-fg">
            {accessProducts}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-soft">
            {t("statActiveLearners")}
          </p>
          <p className="mt-2 font-display text-3xl text-page-fg">
            {activeLearners}
          </p>
        </div>
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-page-fg">
            {t("yourBotsSecondary")}
          </h2>
          <Link href="/dashboard/bots" className="text-sm text-signal">
            {t("manageBots")}
          </Link>
        </div>
        {bots.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center">
            <p className="text-page-fg">{t("emptyBotsTitle")}</p>
            <p className="mt-2 text-sm text-soft">{t("emptyBotsBody")}</p>
            <Link
              href="/dashboard/bots"
              className="mt-4 inline-flex text-sm font-semibold text-[#5865F2]"
            >
              {t("emptyBotsCta")}
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {bots.map((bot) => (
              <li key={bot.id}>
                <Link
                  href={`/dashboard/bots/${bot.id}`}
                  className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 transition hover:border-signal"
                >
                  <span className="font-medium text-page-fg">{bot.name}</span>
                  <span className="text-xs uppercase text-soft">{bot.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
