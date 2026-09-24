import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { authOptions } from "@/lib/auth";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { Reveal } from "@/components/landing/Reveal";
import { DiscordIcon } from "@/components/landing/DiscordIcon";
import { FeatureIcon } from "@/components/landing/FeatureIcon";
import { HeroPatterns, HeroWave } from "@/components/landing/HeroGraphics";
import { BotlyMascot } from "@/components/landing/BotlyMascot";

const FEATURE_KEYS = [
  "access",
  "welcome",
  "ticket",
  "mod",
  "rgpd",
  "dashboard",
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("featuresTitle"),
    description: t("featuresDescription"),
  };
}

export default async function FeaturesPage() {
  const session = await getServerSession(authOptions);
  const ctaHref = session ? "/dashboard" : "/login";
  const t = await getTranslations("features");
  const tc = await getTranslations("common");
  const th = await getTranslations("nav");

  return (
    <div className="min-h-screen overflow-x-hidden bg-[color:var(--page-bg)] text-[color:var(--page-fg)]">
      <SiteHeader signedIn={Boolean(session)} />

      <main>
        <section className="relative bg-[#2a9e86]">
          <div
            className="pointer-events-none absolute inset-0 overflow-hidden"
            aria-hidden
          >
            <HeroPatterns />
          </div>
          <div className="relative mx-auto grid max-w-6xl items-end gap-8 px-6 pb-4 pt-14 md:grid-cols-[1.15fr_0.85fr] md:gap-6 md:pb-0 md:pt-16">
            <div className="relative z-10 pb-8 md:pb-14">
              <p className="animate-fade-up inline-flex items-center gap-2 rounded-full bg-black/15 px-3 py-1 font-display text-xs font-semibold uppercase tracking-[0.2em] text-white/90">
                {t("eyebrow")}
              </p>
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
                  {session ? tc("openDashboard") : tc("tryFree")}
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center rounded-full border border-white/45 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  {tc("seePricing")}
                </Link>
              </div>
            </div>

            <div className="relative z-10 mx-auto hidden w-full md:block md:justify-self-end md:self-end">
              <BotlyMascot priority className="mx-auto md:-mb-2" />
            </div>
          </div>
          <HeroWave fill="var(--wave-fill)" />
        </section>

        <section className="mx-auto max-w-6xl px-6 py-14 md:py-16">
          <Reveal>
            <h2 className="font-display text-3xl font-bold text-[color:var(--page-fg)] sm:text-4xl">
              {t("whyTitle")}
            </h2>
            <p className="mt-3 max-w-xl text-[color:var(--muted)]">{t("whySubtitle")}</p>
          </Reveal>

          <ul className="mt-12 grid auto-rows-fr gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURE_KEYS.map((key, i) => (
              <li key={key} className="h-full">
                <Reveal
                  delay={(Math.min(i + 1, 4) as 1 | 2 | 3 | 4)}
                  className="h-full"
                >
                  <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 transition duration-300 hover:-translate-y-1.5">
                    <FeatureIcon name={key} className="h-14 w-14 rounded-2xl" />
                    <h3 className="mt-5 font-display text-xl font-semibold text-[color:var(--page-fg)]">
                      {t(`items.${key}.t`)}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted)]">
                      {t(`items.${key}.d`)}
                    </p>
                    <p className="mt-4 flex-1 text-sm leading-relaxed text-[color:var(--muted)]">
                      {t(`items.${key}.detail`)}
                    </p>
                  </article>
                </Reveal>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-16 md:pb-20">
          <Reveal>
            <div className="relative rounded-[2rem] bg-[#2a9e86] px-6 py-12 sm:px-12 sm:py-14">
              <div
                className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2rem]"
                aria-hidden
              >
                <HeroPatterns className="opacity-45" />
              </div>
              <div className="relative flex flex-wrap items-center justify-between gap-8">
                <div className="max-w-xl">
                  <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
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
                      href="/comment-ca-marche"
                      className="inline-flex items-center rounded-full border border-white/45 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      {th("howItWorks")}
                    </Link>
                  </div>
                </div>
                <BotlyMascot size="cta" className="mx-auto hidden lg:block" />
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
