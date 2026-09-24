import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { authOptions } from "@/lib/auth";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { PricingGrid } from "@/components/landing/PricingGrid";
import { Reveal } from "@/components/landing/Reveal";
import { DiscordIcon } from "@/components/landing/DiscordIcon";
import { HeroPatterns, HeroWave } from "@/components/landing/HeroGraphics";
import { BotlyMascot } from "@/components/landing/BotlyMascot";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("pricingTitle"),
    description: t("pricingDescription"),
  };
}

export default async function PricingPage() {
  const session = await getServerSession(authOptions);
  const ctaHref = session ? "/dashboard" : "/login";
  const t = await getTranslations("pricing");
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
            <div className="absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-black/20 blur-3xl" />
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
                {t("subtitle", { price: "19,99" })}
              </p>
              <div className="animate-fade-up mt-8 flex flex-wrap gap-3">
                <Link
                  href={ctaHref}
                  className="btn-shine inline-flex items-center gap-2.5 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-[#1a1c21] shadow-[0_10px_35px_rgba(0,0,0,0.28)] transition hover:scale-[1.02]"
                >
                  <DiscordIcon className="h-5 w-5 text-[#5865F2]" />
                  {session ? tc("openDashboard") : tc("tryFree")}
                </Link>
                <a
                  href="#plans"
                  className="inline-flex items-center rounded-full border border-white/45 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  {t("seePlans")}
                </a>
              </div>
            </div>

            <div className="relative z-10 mx-auto hidden w-full md:block md:justify-self-end md:self-end">
              <BotlyMascot priority className="mx-auto md:-mb-2" />
            </div>
          </div>
          <HeroWave fill="var(--wave-fill)" />
        </section>

        <section id="plans" className="relative mx-auto max-w-6xl px-6 py-14 md:py-16">
          <Reveal>
            <h2 className="font-display text-3xl font-bold text-[color:var(--page-fg)] sm:text-4xl">
              {t("chooseTitle")}
            </h2>
            <p className="mt-3 max-w-xl text-[color:var(--muted)]">{t("chooseSubtitle")}</p>
          </Reveal>
          <div className="mt-12">
            <PricingGrid />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-16 md:pb-20">
          <Reveal>
            <div className="relative overflow-hidden rounded-[2rem] border border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-10 sm:px-10">
              <div className="flex flex-wrap items-center justify-between gap-6">
                <div>
                  <h2 className="font-display text-2xl font-bold text-[color:var(--page-fg)] sm:text-3xl">
                    {t("unsureTitle")}
                  </h2>
                  <p className="mt-2 max-w-lg leading-relaxed text-[color:var(--muted)]">
                    {t("unsureBody")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/comment-ca-marche"
                    className="inline-flex items-center rounded-full border border-[color:var(--border)] px-5 py-3 text-sm font-semibold text-[color:var(--page-fg)] transition hover:bg-[color:var(--surface-muted)]"
                  >
                    {th("howItWorks")}
                  </Link>
                  <Link
                    href={ctaHref}
                    className="inline-flex items-center gap-2 rounded-full bg-signal px-5 py-3 text-sm font-bold text-ink-950 transition hover:bg-signal-glow"
                  >
                    <DiscordIcon className="h-4 w-4" />
                    {tc("try")}
                  </Link>
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
