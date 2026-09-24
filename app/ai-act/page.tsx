import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("aiActTitle") };
}

export default async function AiActPage() {
  const locale = await getLocale();
  const t = await getTranslations("legal");
  const isEn = locale === "en";

  return (
    <div className="min-h-screen bg-[color:var(--page-bg)] text-[color:var(--page-fg)]">
      <SiteHeader />
      <main className="mx-auto max-w-3xl space-y-8 px-6 py-16 text-[color:var(--muted)]">
        <h1 className="font-display text-4xl text-[color:var(--page-fg)]">
          {t("aiActTitle")}
        </h1>
        <p className="text-sm leading-relaxed text-[color:var(--muted)]">
          {t("aiActUpdated")}
        </p>

        {isEn ? (
          <>
            <section className="space-y-3">
              <h2 className="font-display text-xl text-[color:var(--page-fg)]">
                1. Scope
              </h2>
              <p>
                Regulation (EU) 2024/1689 (AI Act) governs the placing on the
                market and use of{" "}
                <strong className="text-[color:var(--page-fg)]">
                  AI systems
                </strong>
                .
              </p>
            </section>
            <section className="space-y-3">
              <h2 className="font-display text-xl text-[color:var(--page-fg)]">
                2. Botly’s position
              </h2>
              <p>
                Botly hosts and configures Discord modules (welcome, moderation,
                tickets, rule-based automod).{" "}
                <strong className="text-[color:var(--page-fg)]">
                  Botly does not use generative AI models, high-risk AI systems,
                  or social scoring
                </strong>
                . Automod filters rely on text matches and user-configured
                thresholds, without machine learning.
              </p>
            </section>
            <section className="space-y-3">
              <h2 className="font-display text-xl text-[color:var(--page-fg)]">
                3. Classification
              </h2>
              <p>
                As deployed, Botly is not an “AI system” under the AI Act. No
                high-risk conformity assessment or EU database registration
                applies to this product as shipped.
              </p>
            </section>
            <section className="space-y-3">
              <h2 className="font-display text-xl text-[color:var(--page-fg)]">
                4. Future changes
              </h2>
              <p>
                If AI features (LLM, ML classification, etc.) were added, this
                page and the Terms would be updated before activation, with the
                risk level and related measures.
              </p>
            </section>
          </>
        ) : (
          <>
            <section className="space-y-3">
              <h2 className="font-display text-xl text-[color:var(--page-fg)]">
                1. Périmètre
              </h2>
              <p>
                Le règlement (UE) 2024/1689 (AI Act) encadre la mise sur le
                marché et l&apos;utilisation de{" "}
                <strong className="text-[color:var(--page-fg)]">
                  systèmes d&apos;IA
                </strong>
                .
              </p>
            </section>
            <section className="space-y-3">
              <h2 className="font-display text-xl text-[color:var(--page-fg)]">
                2. Position de Botly
              </h2>
              <p>
                Botly est un service d&apos;hébergement et de configuration de
                modules Discord (welcome, modération, tickets, automod basé sur
                des règles déterministes).{" "}
                <strong className="text-[color:var(--page-fg)]">
                  Botly n&apos;utilise pas de modèle d&apos;IA générative, de
                  système d&apos;IA à haut risque, ni de scoring social
                </strong>
                . Les filtres automod reposent sur des correspondances de texte
                et des seuils configurés par l&apos;utilisateur, sans
                apprentissage automatique.
              </p>
            </section>
            <section className="space-y-3">
              <h2 className="font-display text-xl text-[color:var(--page-fg)]">
                3. Classification
              </h2>
              <p>
                En l&apos;état, Botly n&apos;est pas un « système d&apos;IA »
                au sens de l&apos;AI Act. Aucune obligation de marquage,
                d&apos;évaluation de conformité haute risque, ou
                d&apos;enregistrement dans la base UE ne s&apos;applique à ce
                produit tel que déployé.
              </p>
            </section>
            <section className="space-y-3">
              <h2 className="font-display text-xl text-[color:var(--page-fg)]">
                4. Évolution future
              </h2>
              <p>
                Si des fonctionnalités d&apos;IA (LLM, classification ML, etc.)
                étaient ajoutées, cette page et les CGU seraient mises à jour
                avant activation, avec le niveau de risque et les mesures
                associées.
              </p>
            </section>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
