import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { PricingGrid } from "@/components/landing/PricingGrid";
import { LeadForm } from "@/components/landing/LeadForm";
import { Reveal } from "@/components/landing/Reveal";
import { DiscordIcon } from "@/components/landing/DiscordIcon";
import { FeatureIcon } from "@/components/landing/FeatureIcon";
import { HeroPatterns, HeroWave } from "@/components/landing/HeroGraphics";
import { ClaimFlowPreview } from "@/components/landing/ClaimFlowPreview";
import { trackEvent } from "@/lib/analytics";

/** Wedge home : paiement→rôle, revoke, 0 % — pas welcome/tickets (socle ops). */
const WEDGE_KEYS = ["access", "revoke", "zeroCut"] as const;

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const ctaHref = session ? "/dashboard" : "/signup";
  const t = await getTranslations("home");
  const tc = await getTranslations("common");
  const tf = await getTranslations("features");

  await trackEvent({
    name: "landing_view",
    path: "/",
    userId: session?.user?.id ?? null,
  });

  const steps = [
    { n: "1", t: t("step1Title"), d: t("step1Body") },
    { n: "2", t: t("step2Title"), d: t("step2Body") },
    { n: "3", t: t("step3Title"), d: t("step3Body") },
  ];

  return (
    <div className="min-h-screen bg-[color:var(--page-bg)] text-[color:var(--page-fg)]">
      <SiteHeader signedIn={Boolean(session)} />

      <main id="main-content">
        <section className="relative bg-[#1f7a68]">
          <div
            className="pointer-events-none absolute inset-0 overflow-hidden"
            aria-hidden
          >
            <HeroPatterns />
            <div className="absolute -right-10 top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute bottom-20 left-10 h-32 w-32 rounded-full bg-[#5865F2]/25 blur-2xl" />
          </div>

          <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-6 pb-8 pt-14 md:grid-cols-[1.15fr_0.85fr] md:gap-6 md:pb-4 md:pt-16">
            <div className="relative z-10 overflow-visible">
              <h1 className="animate-fade-up max-w-xl text-balance font-display text-4xl font-bold text-white sm:text-5xl lg:text-[3.4rem]">
                {t("heroTitle")}
              </h1>
              <p className="animate-fade-up mt-5 max-w-lg text-base leading-relaxed text-white sm:text-lg">
                {t("heroBody")}
              </p>
              <div className="animate-fade-up mt-8 flex flex-wrap gap-3">
                <Link
                  href={ctaHref}
                  className="inline-flex items-center gap-2.5 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-[#1a1c21] shadow-[0_8px_30px_rgba(0,0,0,0.25)] transition hover:scale-[1.02] hover:bg-white/95"
                >
                  <DiscordIcon className="h-5 w-5 text-[#5865F2]" />
                  {session ? tc("openDashboard") : tc("tryFree")}
                </Link>
                {session ? null : (
                  <Link
                    href="/comment-ca-marche#etapes"
                    className="inline-flex items-center gap-2 rounded-full border border-white/45 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    {tc("seeExample")}
                  </Link>
                )}
              </div>
              <ul className="animate-fade-up mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/90">
                <li className="inline-flex items-center gap-2">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-white"
                    aria-hidden
                  />
                  {t("trustTrial")}
                </li>
                <li className="inline-flex items-center gap-2">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-white"
                    aria-hidden
                  />
                  {t("trustCancel")}
                </li>
              </ul>
            </div>

            <div className="relative z-10 mx-auto w-full pb-4 md:justify-self-end md:self-center md:pb-8">
              <ClaimFlowPreview />
            </div>
          </div>

          <HeroWave fill="var(--wave-fill)" />
        </section>

        <section className="bg-[color:var(--page-bg)] px-6 pb-20 pt-4" id="produit">
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <h2 className="font-display text-3xl font-bold text-[color:var(--page-fg)] sm:text-4xl">
                {t("whyTitle")}
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-[color:var(--muted)]">
                {t("whySubtitle")}
              </p>
            </Reveal>

            <ul className="mt-10 grid auto-rows-fr gap-4 sm:grid-cols-3">
              {WEDGE_KEYS.map((key, i) => (
                <li key={key} className="h-full">
                  <Reveal
                    delay={(Math.min(i + 1, 4) as 1 | 2 | 3 | 4)}
                    className="h-full"
                  >
                    <article className="group flex h-full flex-col rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 transition duration-300 hover:-translate-y-1 hover:bg-[color:var(--surface-muted)]">
                      <FeatureIcon name={key} />
                      <h3 className="mt-4 font-display text-lg font-semibold text-[color:var(--page-fg)]">
                        {tf(`items.${key}.t`)}
                      </h3>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-[color:var(--muted)]">
                        {tf(`items.${key}.d`)}
                      </p>
                    </article>
                  </Reveal>
                </li>
              ))}
            </ul>

            <Reveal delay={3}>
              <p className="mt-8 text-sm leading-relaxed text-[color:var(--muted)]">
                {t("opsNote")}{" "}
                <Link
                  href="/fonctionnalites"
                  className="font-medium text-signal-dim underline-offset-2 hover:underline"
                >
                  {t("learnMore")}
                </Link>
              </p>
              <aside
                className="mt-6 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-5 py-4"
                aria-label={t("betaProofTitle")}
              >
                <p className="font-display text-base font-semibold text-[color:var(--page-fg)]">
                  {t("betaProofTitle")}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted)]">
                  {t("betaProofBody")}
                </p>
              </aside>
            </Reveal>
          </div>
        </section>

        <section
          className="border-y border-[color:var(--border)] bg-[color:var(--surface-muted)] py-20"
          id="comment"
        >
          <div className="mx-auto max-w-6xl px-6">
            <Reveal className="text-center">
              <h2 className="font-display text-3xl font-bold text-[color:var(--page-fg)] sm:text-4xl">
                {t("stepsTitle")}
              </h2>
              <p className="mx-auto mt-3 max-w-lg leading-relaxed text-[color:var(--muted)]">
                {t("stepsSubtitle")}
              </p>
              <Link
                href="/comment-ca-marche"
                className="mt-4 inline-flex text-sm font-medium text-signal transition hover:text-signal-dim"
              >
                {t("stepsGuide")}
              </Link>
            </Reveal>

            <ol className="relative mt-14 grid gap-8 md:grid-cols-3">
              <div
                className="pointer-events-none absolute left-[16%] right-[16%] top-6 hidden h-px bg-gradient-to-r from-transparent via-signal/50 to-transparent md:block"
                aria-hidden
              />
              {steps.map((step, i) => (
                <li key={step.n} className="h-full">
                  <Reveal
                    delay={(i + 1) as 1 | 2 | 3}
                    className="relative flex h-full flex-col text-center"
                  >
                    <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-signal font-display text-lg font-bold text-ink-950 shadow-[0_0_28px_rgba(61,207,176,0.35)]">
                      {step.n}
                    </span>
                    <h3 className="mt-5 font-display text-xl font-semibold text-[color:var(--page-fg)]">
                      {step.t}
                    </h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-[color:var(--muted)]">
                      {step.d}
                    </p>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20" id="probleme">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
            <Reveal>
              <h2 className="font-display text-3xl font-bold text-[color:var(--page-fg)] sm:text-4xl">
                {t("diffTitle")}
                <span className="mt-2 block text-[color:var(--muted)]">
                  {t("diffSubtitle")}
                </span>
              </h2>
            </Reveal>
            <Reveal delay={2}>
              <div className="grid gap-3 sm:grid-rows-2">
                <div className="flex min-h-[6.5rem] flex-col justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)]">
                    {t("diffPublicLabel")}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[color:var(--page-fg)]">
                    {t("diffPublicBody")}
                  </p>
                </div>
                <div className="flex min-h-[6.5rem] flex-col justify-center rounded-2xl border border-signal/40 bg-signal/15 px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-signal-dim">
                    {t("diffDiscelynLabel")}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[color:var(--page-fg)]">
                    {t("diffDiscelynBody")}
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
          <Reveal delay={3}>
            <ul className="mt-12 grid gap-4 sm:grid-cols-3">
              {(
                [
                  ["diffProof1Title", "diffProof1Body"],
                  ["diffProof2Title", "diffProof2Body"],
                  ["diffProof3Title", "diffProof3Body"],
                ] as const
              ).map(([titleKey, bodyKey]) => (
                <li
                  key={titleKey}
                  className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-4"
                >
                  <p className="font-display text-base font-semibold text-[color:var(--page-fg)]">
                    {t(titleKey)}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted)]">
                    {t(bodyKey)}
                  </p>
                </li>
              ))}
            </ul>
          </Reveal>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16" id="offres">
          <Reveal className="text-center">
            <h2 className="font-display text-3xl font-bold text-[color:var(--page-fg)] sm:text-4xl">
              {t("pricingTitle")}
            </h2>
            <p className="mt-3 leading-relaxed text-[color:var(--muted)]">
              {t("pricingSubtitle")}
            </p>
          </Reveal>
          <div className="mt-12">
            <PricingGrid />
          </div>
        </section>

        <section className="bg-[color:var(--page-bg)] py-20" id="contact">
          <div className="mx-auto max-w-6xl px-6">
            <div className="relative rounded-3xl bg-[#1f7a68] px-6 py-12 sm:px-12">
              <div
                className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"
                aria-hidden
              >
                <HeroPatterns className="opacity-60" />
              </div>
              <div className="relative grid gap-10 lg:grid-cols-2 lg:items-center">
                <Reveal>
                  <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
                    {t("ctaTitle")}
                  </h2>
                  <p className="mt-4 max-w-md leading-relaxed text-white/95">
                    {t("ctaBody")}
                  </p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link
                      href={ctaHref}
                      className="inline-flex items-center gap-2.5 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-[#1a1c21] shadow-lg transition hover:scale-[1.02]"
                    >
                      <DiscordIcon className="h-5 w-5 text-[#5865F2]" />
                      {session ? tc("openDashboard") : tc("tryFree")}
                    </Link>
                    {session ? null : (
                      <Link
                        href="/comment-ca-marche#etapes"
                        className="inline-flex items-center rounded-full border border-white/45 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                      >
                        {tc("seeExample")}
                      </Link>
                    )}
                  </div>
                </Reveal>
                <Reveal delay={2} variant="scale">
                  <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-lg">
                    <LeadForm defaultOffer="DEMO" />
                  </div>
                </Reveal>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
