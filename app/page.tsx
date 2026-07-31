import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { PricingGrid } from "@/components/landing/PricingGrid";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-screen">
      <SiteHeader signedIn={Boolean(session)} />

      <main>
        <section className="relative mx-auto flex min-h-[78vh] max-w-6xl flex-col justify-center px-6 pb-20 pt-8">
          <div className="pointer-events-none absolute inset-x-0 top-10 -z-10 mx-auto h-72 w-72 rounded-full bg-signal/20 blur-[100px] animate-pulse-soft" />
          <p className="animate-fade-up font-display text-5xl font-bold tracking-tight text-mist-100 sm:text-7xl md:text-8xl">
            Botly
          </p>
          <h1 className="animate-fade-up-delay mt-6 max-w-2xl font-display text-2xl font-semibold text-mist-100 sm:text-4xl">
            Ton bot Discord, prêt en quelques minutes.
          </h1>
          <p className="animate-fade-up-delay-2 mt-4 max-w-xl text-base text-mist-300 sm:text-lg">
            Choisis un plan, active les modules dont tu as besoin, on
            s&apos;occupe de l&apos;hébergement. Simple, propre, sécurisé.
          </p>
          <div className="animate-fade-up-delay-2 mt-8 flex flex-wrap gap-4">
            <Link
              href={session ? "/dashboard" : "/login"}
              className="rounded-full bg-signal px-6 py-3 text-sm font-semibold text-ink-950 transition hover:bg-signal-glow"
            >
              {session ? "Ouvrir le dashboard" : "Essayer gratuitement"}
            </Link>
            <Link
              href="/pricing"
              className="rounded-full border border-ink-600 px-6 py-3 text-sm font-medium text-mist-100 transition hover:border-signal hover:text-signal"
            >
              Voir les tarifs
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="font-display text-3xl text-mist-100">
            Trois étapes. C&apos;est tout.
          </h2>
          <p className="mt-2 max-w-xl text-mist-400">
            Pas de setup Docker, pas de token à coller dans un terminal.
          </p>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Connecte Discord",
                text: "Connexion OAuth sécurisée. Pas de mot de passe Botly.",
              },
              {
                step: "02",
                title: "Choisis ton plan",
                text: "Free pour tester, puis upgrade quand tu en as besoin.",
              },
              {
                step: "03",
                title: "Configure les modules",
                text: "Welcome, modération, tickets… selon ton abonnement.",
              },
            ].map((item) => (
              <li key={item.step} className="border-t border-ink-600 pt-5">
                <p className="font-display text-signal">{item.step}</p>
                <h3 className="mt-2 font-display text-xl text-mist-100">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-mist-400">{item.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="mb-8 font-display text-3xl text-mist-100">
            Des prix clairs
          </h2>
          <PricingGrid />
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
