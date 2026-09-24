import type { Metadata } from "next";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";

export const metadata: Metadata = { title: "AI Act" };

export default function AiActPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl space-y-8 px-6 py-16 text-mist-300">
        <h1 className="font-display text-4xl text-mist-100">
          Transparence — règlement IA (AI Act)
        </h1>
        <p className="text-sm text-mist-400">Dernière mise à jour : septembre 2026</p>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-mist-100">1. Périmètre</h2>
          <p>
            Le règlement (UE) 2024/1689 (AI Act) encadre la mise sur le marché
            et l&apos;utilisation de{" "}
            <strong className="text-mist-100">systèmes d&apos;IA</strong>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-mist-100">
            2. Position de Botly
          </h2>
          <p>
            Botly est un service d&apos;hébergement et de configuration de
            modules Discord (welcome, modération, tickets, automod basé sur des
            règles déterministes).{" "}
            <strong className="text-mist-100">
              Botly n&apos;utilise pas de modèle d&apos;IA générative, de
              système d&apos;IA à haut risque, ni de scoring social
            </strong>
            . Les filtres automod reposent sur des correspondances de texte et
            des seuils configurés par l&apos;utilisateur, sans apprentissage
            automatique.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-mist-100">
            3. Classification
          </h2>
          <p>
            En l&apos;état, Botly n&apos;est pas un « système d&apos;IA » au
            sens de l&apos;AI Act. Aucune obligation de marquage, d&apos;évaluation
            de conformité haute risque, ou d&apos;enregistrement dans la base
            UE ne s&apos;applique à ce produit tel que déployé.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-mist-100">
            4. Évolution future
          </h2>
          <p>
            Si des fonctionnalités d&apos;IA (LLM, classification ML, etc.)
            étaient ajoutées, cette page et les CGU seraient mises à jour avant
            activation, avec le niveau de risque et les mesures associées.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
