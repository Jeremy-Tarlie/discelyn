import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { authOptions } from "@/lib/auth";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { Reveal } from "@/components/landing/Reveal";
import { DiscordIcon } from "@/components/landing/DiscordIcon";
import { HeroPatterns, HeroWave } from "@/components/landing/HeroGraphics";
import { BotlyMascot } from "@/components/landing/BotlyMascot";

const STEP_KEYS = ["01", "02", "03", "04"] as const;
type StepKey = (typeof STEP_KEYS)[number];

const NEED_KEYS = ["account", "server", "time"] as const;
type NeedKey = (typeof NEED_KEYS)[number];

type Step = {
  n: StepKey;
  short: string;
  t: string;
  d: string;
  accent: string;
  color: string;
  icon: ReactNode;
  points: readonly string[];
  preview: ReactNode;
};

type NeedItem = {
  key: NeedKey;
  t: string;
  d: string;
  color: string;
  accent: string;
  icon: ReactNode;
};

function PreviewShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="w-full max-w-[260px] overflow-hidden rounded-2xl border border-white/10 bg-[#1a1c21] shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
      <div className="flex items-center gap-1.5 border-b border-white/6 bg-[#232428] px-3 py-2">
        <span className="h-1.5 w-1.5 rounded-full bg-[#ed4245]/80" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#fee75c]/80" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#57f287]/80" />
        <span className="ml-2 truncate text-[10px] font-medium text-[#949ba4]">
          {title}
        </span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

const STEP_VISUALS: Record<
  StepKey,
  Pick<Step, "accent" | "color" | "icon" | "preview">
> = {
  "01": {
    accent: "#5865F2",
    color: "bg-[#5865F2]",
    icon: (
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    ),
    preview: (
      <PreviewShell title="botly.app/login">
        <div className="space-y-2.5">
          <div className="h-2 w-16 rounded bg-white/10" />
          <div className="h-2 w-28 rounded bg-white/6" />
          <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-[#5865F2] px-3 py-2.5 text-[11px] font-bold text-white">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
            Continuer avec Discord
          </div>
          <p className="text-center text-[9px] text-[#6d737e]">
            Aucun mot de passe Botly
          </p>
        </div>
      </PreviewShell>
    ),
  },
  "02": {
    accent: "#3dcfb0",
    color: "bg-[#3dcfb0] text-ink-950",
    icon: <path d="M3 3h8v8H3V3Zm10 0h8v5h-8V3ZM3 13h5v8H3v-8Zm7 0h11v8H10v-8Z" />,
    preview: (
      <PreviewShell title="Dashboard → Bots">
        <div className="space-y-2">
          <div className="rounded-xl border border-dashed border-signal/40 bg-signal/5 p-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-signal text-[10px] font-bold text-ink-950">
                +
              </span>
              <div>
                <p className="text-[11px] font-semibold text-white">
                  Nouvelle config
                </p>
                <p className="text-[9px] text-[#949ba4]">Template Formation</p>
              </div>
            </div>
          </div>
          <div className="flex gap-1.5">
            {["Welcome", "Tickets", "Mods"].map((m) => (
              <span
                key={m}
                className="rounded-md bg-[#2b2d31] px-1.5 py-1 text-[9px] font-medium text-[#dbdee1]"
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      </PreviewShell>
    ),
  },
  "03": {
    accent: "#fee75c",
    color: "bg-[#fee75c] text-ink-950",
    icon: (
      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 11h4v2h-4v4h-2v-4H7v-2h4V9h2Z" />
    ),
    preview: (
      <PreviewShell title="Lier une guild">
        <div className="space-y-2">
          {[
            { name: "Promo 2026", ok: true },
            { name: "Staff interne", ok: false },
          ].map((g) => (
            <div
              key={g.name}
              className={`flex items-center justify-between rounded-lg px-2.5 py-2 ${
                g.ok
                  ? "bg-[#5865F2]/20 ring-1 ring-[#5865F2]/40"
                  : "bg-[#2b2d31]"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-[#404249]" />
                <span className="text-[11px] font-medium text-white">
                  {g.name}
                </span>
              </div>
              {g.ok ? (
                <span className="text-[9px] font-bold text-[#57f287]">
                  Lié
                </span>
              ) : (
                <span className="text-[9px] text-[#949ba4]">Inviter</span>
              )}
            </div>
          ))}
        </div>
      </PreviewShell>
    ),
  },
  "04": {
    accent: "#57f287",
    color: "bg-[#57f287] text-ink-950",
    icon: <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z" />,
    preview: (
      <PreviewShell title="Runtime">
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 rounded-lg bg-[#57f287]/10 px-2.5 py-2 ring-1 ring-[#57f287]/25">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#57f287] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#57f287]" />
            </span>
            <span className="text-[11px] font-semibold text-[#57f287]">
              Bot en ligne
            </span>
          </div>
          <div className="space-y-1.5 rounded-lg bg-[#2b2d31] p-2">
            <p className="text-[9px] text-[#949ba4]">#bienvenue</p>
            <p className="text-[10px] text-white">
              Bienvenue {"<@membre>"} — rôle Apprenant ajouté ✓
            </p>
          </div>
        </div>
      </PreviewShell>
    ),
  },
};

const NEED_VISUALS: Record<
  NeedKey,
  Pick<NeedItem, "color" | "accent" | "icon">
> = {
  account: {
    color: "bg-[#5865F2]",
    accent: "#5865F2",
    icon: (
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4 0-8 2-8 4v1h16v-1c0-2-4-4-8-4Z" />
    ),
  },
  server: {
    color: "bg-[#3dcfb0] text-ink-950",
    accent: "#3dcfb0",
    icon: <path d="M4 4h16v4H4V4Zm0 6h10v10H4V10Zm12 0h4v10h-4V10Z" />,
  },
  time: {
    color: "bg-[#eb459e]",
    accent: "#eb459e",
    icon: (
      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 10.6 3.5 2.1-.9 1.5L11 13V7h2v5.6Z" />
    ),
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("howTitle"),
    description: t("howDescription"),
  };
}

export default async function HowItWorksPage() {
  const session = await getServerSession(authOptions);
  const ctaHref = session ? "/dashboard" : "/login";
  const t = await getTranslations("howItWorks");
  const tc = await getTranslations("common");

  const steps: readonly Step[] = STEP_KEYS.map((n) => ({
    n,
    short: t(`steps.${n}.short`),
    t: t(`steps.${n}.t`),
    d: t(`steps.${n}.d`),
    points: t.raw(`steps.${n}.points`) as string[],
    ...STEP_VISUALS[n],
  }));

  const needs: readonly NeedItem[] = NEED_KEYS.map((key) => ({
    key,
    t: t(`needs.${key}.t`),
    d: t(`needs.${key}.d`),
    ...NEED_VISUALS[key],
  }));

  return (
    <div className="min-h-screen overflow-x-hidden bg-[color:var(--page-bg)] text-[color:var(--page-fg)]">
      <SiteHeader signedIn={Boolean(session)} />

      <main>
        {/* Hero */}
        <section className="relative bg-[#2a9e86]">
          <div
            className="pointer-events-none absolute inset-0 overflow-hidden"
            aria-hidden
          >
            <HeroPatterns />
            <div className="absolute -left-24 top-10 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-black/20 blur-3xl" />
          </div>

          <div className="relative mx-auto grid max-w-6xl items-end gap-8 px-6 pb-4 pt-14 md:grid-cols-[1.15fr_0.85fr] md:gap-10 md:pb-0 md:pt-16">
            <div className="relative z-10 pb-8 md:pb-14">
              <div className="animate-fade-up flex flex-wrap items-center gap-2">
                <p className="inline-flex items-center gap-2 rounded-full bg-black/15 px-3 py-1 font-display text-xs font-semibold uppercase tracking-[0.2em] text-white/90">
                  {t("eyebrow")}
                </p>
                <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  {t("badgeMinutes")}
                </p>
              </div>
              <h1 className="animate-fade-up mt-5 max-w-xl font-display text-4xl font-bold text-white sm:text-5xl lg:text-6xl">
                {t("title")}
              </h1>
              <p className="animate-fade-up mt-5 max-w-lg text-base leading-relaxed text-white/90 sm:text-lg">
                {t("subtitle")}
              </p>
              <div className="animate-fade-up mt-8 flex flex-wrap gap-3">
                <Link
                  href={ctaHref}
                  className="btn-shine inline-flex items-center gap-2.5 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-[#1a1c21] shadow-[0_10px_35px_rgba(0,0,0,0.28)] transition hover:scale-[1.02]"
                >
                  <DiscordIcon className="h-5 w-5 text-[#5865F2]" />
                  {session ? tc("openDashboard") : tc("startNow")}
                </Link>
                <a
                  href="#etapes"
                  className="inline-flex items-center gap-2 rounded-full border border-white/45 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  {t("seeSteps")}
                  <svg
                    viewBox="0 0 20 20"
                    className="h-4 w-4"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </a>
              </div>
            </div>

            <div className="relative z-10 mx-auto hidden w-full md:block md:justify-self-end md:self-end">
              <BotlyMascot priority className="mx-auto md:-mb-2" />
            </div>
          </div>
          <HeroWave fill="var(--wave-fill)" />
        </section>

        {/* Journey nav */}
        <section className="mx-auto max-w-6xl px-6 pt-8 md:pt-4">
          <Reveal>
            <nav aria-label={t("stepsTitle")}>
              {/* Mobile: 2×2 cards */}
              <ol className="grid grid-cols-2 gap-3 md:hidden">
                {steps.map((step, i) => (
                  <li key={step.n}>
                    <a
                      href={`#step-${step.n}`}
                      className="group flex flex-col items-center gap-3 rounded-2xl bg-[color:var(--surface)] px-3 py-4 text-center shadow-sm transition hover:bg-[color:var(--surface-muted)] dark:bg-[#2b2d31]/70 dark:hover:bg-[#32353b]"
                    >
                      <span
                        className="flex h-11 w-11 items-center justify-center rounded-full font-display text-sm font-bold text-white shadow-lg transition group-hover:scale-110"
                        style={{ backgroundColor: step.accent }}
                      >
                        {i + 1}
                      </span>
                      <span>
                        <span className="block font-display text-[10px] font-bold tracking-[0.18em] text-[color:var(--muted)]">
                          {t("stepLabel", { n: step.n })}
                        </span>
                        <span className="mt-0.5 block text-sm font-semibold text-[color:var(--page-fg)] transition group-hover:text-signal">
                          {step.short}
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ol>

              {/* Desktop: circles + centered connector, labels below */}
              <div className="hidden md:block">
                <div className="relative">
                  <div
                    className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-1/2 z-0 h-px -translate-y-1/2 bg-gradient-to-r from-[#5865F2]/50 via-signal/40 to-[#57f287]/50"
                    aria-hidden
                  />
                  <ol className="relative z-10 flex items-center justify-between px-[12.5%]">
                    {steps.map((step, i) => (
                      <li key={step.n}>
                        <a
                          href={`#step-${step.n}`}
                          className="group block"
                          aria-label={`${t("stepLabel", { n: step.n })} — ${step.short}`}
                        >
                          <span
                            className="flex h-11 w-11 items-center justify-center rounded-full font-display text-sm font-bold text-white shadow-lg ring-[6px] ring-[color:var(--page-bg)] transition group-hover:scale-110"
                            style={{ backgroundColor: step.accent }}
                          >
                            {i + 1}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ol>
                </div>
                <ol className="mt-3 grid grid-cols-4 gap-0">
                  {steps.map((step) => (
                    <li key={`label-${step.n}`} className="px-2 text-center">
                      <a
                        href={`#step-${step.n}`}
                        className="group inline-block"
                      >
                        <span className="block font-display text-[10px] font-bold tracking-[0.18em] text-[color:var(--muted)]">
                          {t("stepLabel", { n: step.n })}
                        </span>
                        <span className="mt-0.5 block text-sm font-semibold text-[color:var(--page-fg)] transition group-hover:text-signal">
                          {step.short}
                        </span>
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            </nav>
          </Reveal>
        </section>

        {/* Steps detail */}
        <section id="etapes" className="mx-auto max-w-6xl px-6 py-14 md:py-16">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-3xl font-bold text-[color:var(--page-fg)] sm:text-4xl">
                  {t("stepsTitle")}
                </h2>
                <p className="mt-3 max-w-xl text-[color:var(--muted)]">
                  {t("stepsSubtitle")}
                </p>
              </div>
              <p className="hidden rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-xs font-medium text-[color:var(--muted)] sm:block">
                {t("scrollHint")}
              </p>
            </div>
          </Reveal>

          <ol className="mt-12 space-y-5 md:space-y-6">
            {steps.map((step, i) => {
              const reverse = i % 2 === 1;
              return (
                <li key={step.n} id={`step-${step.n}`}>
                  <Reveal delay={(Math.min(i + 1, 4) as 1 | 2 | 3 | 4)}>
                    <article
                      className="group relative overflow-hidden rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--surface)] transition duration-300 hover:-translate-y-1 dark:bg-[#2b2d31]"
                      style={{
                        boxShadow: `inset 4px 0 0 0 ${step.accent}`,
                      }}
                    >
                      <div
                        className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full opacity-[0.18] blur-3xl transition duration-500 group-hover:opacity-30"
                        style={{ backgroundColor: step.accent }}
                        aria-hidden
                      />

                      <div
                        className={`relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-12 ${
                          reverse ? "lg:[&>*:first-child]:order-2" : ""
                        }`}
                      >
                        <div className="flex gap-5">
                          <div className="relative shrink-0">
                            <span
                              className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg transition duration-300 group-hover:scale-105 ${step.color}`}
                            >
                              <svg
                                viewBox="0 0 24 24"
                                className="h-6 w-6"
                                fill="currentColor"
                                aria-hidden
                              >
                                {step.icon}
                              </svg>
                            </span>
                          </div>

                          <div className="min-w-0">
                            <h3 className="font-display text-xl font-semibold text-[color:var(--page-fg)] sm:text-2xl">
                              {step.t}
                            </h3>
                            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[color:var(--muted)] sm:text-base">
                              {step.d}
                            </p>
                            <ul className="mt-5 flex flex-wrap gap-2">
                              {step.points.map((label) => (
                                <li
                                  key={label}
                                  className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--surface-muted)] px-3 py-2 text-xs font-medium leading-normal text-[color:var(--page-fg)] ring-1 ring-[color:var(--border)]"
                                >
                                  <span
                                    className="h-1.5 w-1.5 rounded-full"
                                    style={{ backgroundColor: step.accent }}
                                    aria-hidden
                                  />
                                  {label}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        <div className="mx-auto origin-center transition duration-500 group-hover:scale-[1.03] lg:mx-0">
                          {step.preview}
                        </div>
                      </div>
                    </article>
                  </Reveal>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Needs */}
        <section className="relative overflow-hidden border-y border-[color:var(--border)] bg-[color:var(--surface-muted)] py-16 md:py-20 dark:bg-[#16181d]">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_50%_0%,rgba(61,207,176,0.08),transparent)]"
            aria-hidden
          />
          <div className="relative mx-auto max-w-6xl px-6">
            <Reveal className="text-center">
              <h2 className="font-display text-3xl font-bold text-[color:var(--page-fg)] sm:text-4xl">
                {t("needsTitle")}
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-[color:var(--muted)]">
                {t("needsSubtitle")}
              </p>
            </Reveal>

            <ul className="mt-12 grid gap-5 md:grid-cols-3">
              {needs.map((item, i) => (
                <li key={item.key}>
                  <Reveal delay={(i + 1) as 1 | 2 | 3} variant="scale">
                    <article className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)] p-7 transition duration-300 hover:-translate-y-1.5 dark:bg-[#2b2d31]">
                      <div
                        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition group-hover:opacity-100"
                        style={{
                          background: `linear-gradient(90deg, transparent, ${item.accent}, transparent)`,
                        }}
                        aria-hidden
                      />
                      <div className="flex items-start justify-between">
                        <span
                          className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg transition duration-300 group-hover:scale-110 ${item.color}`}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-6 w-6"
                            fill="currentColor"
                            aria-hidden
                          >
                            {item.icon}
                          </svg>
                        </span>
                      </div>
                      <h3 className="mt-6 font-display text-xl font-semibold text-[color:var(--page-fg)]">
                        {item.t}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted)]">
                        {item.d}
                      </p>
                    </article>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <Reveal>
            <div className="relative rounded-[2rem] bg-[#2a9e86] px-6 py-12 sm:px-12 sm:py-14">
              <div
                className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2rem]"
                aria-hidden
              >
                <HeroPatterns className="opacity-45" />
                <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/15 blur-3xl" />
              </div>
              <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_auto]">
                <div className="max-w-xl">
                  <p className="inline-flex items-center gap-2 rounded-full bg-black/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/85">
                    {t("ctaEyebrow")}
                  </p>
                  <h2 className="mt-4 font-display text-3xl font-bold text-white sm:text-4xl">
                    {t("ctaTitle")}
                  </h2>
                  <p className="mt-4 text-lg text-white/90">{t("ctaBody")}</p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link
                      href={ctaHref}
                      className="btn-shine inline-flex items-center gap-2.5 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-[#1a1c21] shadow-lg transition hover:scale-[1.02]"
                    >
                      <DiscordIcon className="h-5 w-5 text-[#5865F2]" />
                      {session ? tc("openDashboard") : tc("tryFree")}
                    </Link>
                    <Link
                      href="/pricing"
                      className="inline-flex items-center rounded-full border border-white/45 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      {tc("seePricing")}
                    </Link>
                  </div>
                </div>
                <div className="relative mx-auto hidden lg:block">
                  <BotlyMascot size="cta" />
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
