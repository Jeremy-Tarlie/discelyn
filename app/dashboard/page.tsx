import Link from "next/link";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrgSubscription } from "@/lib/access";
import { getPlan, type PlanId } from "@/lib/plans";

type PageProps = {
  searchParams: Promise<{ setup?: string; diagnostic?: string }>;
};

type SetupStep = {
  id: "bot" | "guild" | "stripe" | "product";
  done: boolean;
  href: string;
  titleKey:
    | "setupStepBot"
    | "setupStepGuild"
    | "setupStepStripe"
    | "setupStepProduct";
  bodyKey:
    | "setupStepBotBody"
    | "setupStepGuildBody"
    | "setupStepStripeBody"
    | "setupStepProductBody";
};

export default async function DashboardPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  const params = await searchParams;
  const t = await getTranslations("dashboard");
  const organizationId = session!.user.organizationId;
  if (!organizationId) redirect("/login");

  const subscription = await getOrgSubscription(organizationId);
  const plan = getPlan(subscription.plan as PlanId);
  const bots = await prisma.bot.findMany({
    where: { organizationId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      enabledModules: true,
      guildId: true,
    },
  });
  const firstName = session!.user.name?.split(" ")[0];

  const [accessProducts, activeLearners, stripeConfig, primaryBot] =
    await Promise.all([
      prisma.accessProduct.count({ where: { organizationId, active: true } }),
      prisma.learnerAccess.count({
        where: {
          bot: { organizationId, deletedAt: null },
          status: "ACTIVE",
        },
      }),
      prisma.orgStripeConfig.findUnique({
        where: { organizationId },
        select: { id: true },
      }),
      prisma.bot.findFirst({
        where: { organizationId, deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: { id: true, guildId: true },
      }),
    ]);

  const accessHref = primaryBot
    ? `/dashboard/bots/${primaryBot.id}`
    : "/dashboard/bots";
  const stripeOk = Boolean(stripeConfig);
  const hasBot = bots.length > 0;
  const guildOk = Boolean(primaryBot?.guildId);
  const productOk = accessProducts > 0;
  const setupReady = hasBot && guildOk && stripeOk && productOk;
  const doneCount = [hasBot, guildOk, stripeOk, productOk].filter(Boolean)
    .length;

  const nextHref = !hasBot
    ? "/dashboard/bots"
    : !guildOk
      ? accessHref
      : !stripeOk
        ? "/dashboard/webhooks"
        : accessHref;

  const steps: SetupStep[] = [
    {
      id: "bot",
      done: hasBot,
      href: "/dashboard/bots",
      titleKey: "setupStepBot",
      bodyKey: "setupStepBotBody",
    },
    {
      id: "guild",
      done: guildOk,
      href: accessHref,
      titleKey: "setupStepGuild",
      bodyKey: "setupStepGuildBody",
    },
    {
      id: "stripe",
      done: stripeOk,
      href: "/dashboard/webhooks",
      titleKey: "setupStepStripe",
      bodyKey: "setupStepStripeBody",
    },
    {
      id: "product",
      done: productOk,
      href: accessHref,
      titleKey: "setupStepProduct",
      bodyKey: "setupStepProductBody",
    },
  ];

  const nextStep = steps.find((step) => !step.done);

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

      {!setupReady ? (
        <section className="rounded-2xl border border-warn/40 bg-warn/5 p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-warn">
                {t("setupTitle")}
              </p>
              <h2 className="mt-1 font-display text-2xl text-page-fg">
                {t("setupHeading")}
              </h2>
              <p className="mt-2 max-w-xl text-sm text-soft">
                {t("setupBody")}
              </p>
            </div>
            <p className="text-sm text-soft">
              {t("setupProgress", { done: doneCount, total: steps.length })}
            </p>
          </div>

          <ol className="mt-6 space-y-3">
            {steps.map((step, index) => {
              const isNext = nextStep?.id === step.id;
              return (
                <li key={step.id}>
                  <Link
                    href={step.href}
                    className={`flex items-start gap-4 rounded-xl border px-4 py-3 transition ${
                      step.done
                        ? "border-signal/30 bg-signal/5"
                        : isNext
                          ? "border-[#5865F2]/50 bg-[#5865F2]/5 ring-1 ring-[#5865F2]/20"
                          : "border-line bg-surface hover:border-signal/40"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        step.done
                          ? "bg-signal text-white"
                          : isNext
                            ? "bg-[#5865F2] text-white"
                            : "bg-line text-soft"
                      }`}
                      aria-hidden
                    >
                      {step.done ? "✓" : index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-page-fg">
                        {t(step.titleKey)}
                      </span>
                      <span className="mt-0.5 block text-sm text-soft">
                        {t(step.bodyKey)}
                      </span>
                    </span>
                    <span className="shrink-0 self-center text-xs font-medium text-[#5865F2]">
                      {step.done
                        ? t("setupDone")
                        : isNext
                          ? t("setupDoNow")
                          : t("setupOpen")}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>

          {nextStep ? (
            <Link
              href={nextHref}
              className="mt-5 inline-flex rounded-full bg-[#5865F2] px-5 py-2.5 text-sm font-semibold text-white"
            >
              {t("setupPrimaryCta")}
            </Link>
          ) : null}
        </section>
      ) : (
        <section className="rounded-2xl border border-signal/40 bg-signal/10 p-6">
          <p className="text-xs uppercase tracking-wide text-signal">
            {t("wedgeTitle")}
          </p>
          <p className="mt-2 text-page-fg">{t("readyBody")}</p>
          <Link
            href={accessHref}
            className="mt-4 inline-flex rounded-full bg-[#5865F2] px-5 py-2.5 text-sm font-semibold text-white"
          >
            {t("readyCta")}
          </Link>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/dashboard/webhooks"
          className="rounded-2xl border border-line bg-surface p-5 shadow-sm transition hover:border-signal"
        >
          <p className="text-xs uppercase tracking-wide text-soft">
            {t("statStripe")}
          </p>
          <p className="mt-2 font-display text-2xl text-page-fg">
            {stripeOk ? t("statStripeOk") : t("statStripeMissing")}
          </p>
          <p className="mt-2 text-xs text-[#5865F2]">{t("statOpen")}</p>
        </Link>
        <Link
          href={accessHref}
          className="rounded-2xl border border-line bg-surface p-5 shadow-sm transition hover:border-signal"
        >
          <p className="text-xs uppercase tracking-wide text-soft">
            {t("statAccessProducts")}
          </p>
          <p className="mt-2 font-display text-3xl text-page-fg">
            {accessProducts}
          </p>
          <p className="mt-2 text-xs text-[#5865F2]">{t("statOpen")}</p>
        </Link>
        <Link
          href="/dashboard/learners"
          className="rounded-2xl border border-line bg-surface p-5 shadow-sm transition hover:border-signal"
        >
          <p className="text-xs uppercase tracking-wide text-soft">
            {t("statActiveLearners")}
          </p>
          <p className="mt-2 font-display text-3xl text-page-fg">
            {activeLearners}
          </p>
          <p className="mt-2 text-xs text-[#5865F2]">{t("statOpen")}</p>
        </Link>
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
              className="mt-4 inline-flex rounded-full bg-[#5865F2] px-5 py-2.5 text-sm font-semibold text-white"
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
                  <span className="min-w-0">
                    <span className="block font-medium text-page-fg">
                      {bot.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-soft">
                      {bot.guildId
                        ? t("botGuildLinked")
                        : t("botGuildMissing")}
                    </span>
                  </span>
                  <span className="text-xs uppercase text-soft">
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
