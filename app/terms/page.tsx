import type { Metadata } from "next";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";

export const metadata: Metadata = { title: "CGU" };

export default function TermsPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl space-y-8 px-6 py-16 text-mist-300">
        <h1 className="font-display text-4xl text-mist-100">
          Conditions générales d&apos;utilisation
        </h1>
        <p className="text-sm text-mist-400">Dernière mise à jour : septembre 2026</p>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-mist-100">1. Objet</h2>
          <p>
            Botly fournit un service d&apos;ops Discord pour organisations
            (configuration via bot plateforme, setup optionnel, abonnement) —
            ci-après « le Service ». En créant un compte ou en soumettant un
            lead, tu acceptes les présentes CGU.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-mist-100">2. Compte</h2>
          <p>
            L&apos;inscription se fait via OAuth Discord. Tu es responsable de
            l&apos;usage de ton compte et des serveurs que tu lies. Tu dois
            avoir l&apos;âge légal pour contracter dans ton pays.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-mist-100">
            3. Bot plateforme — pas de token utilisateur
          </h2>
          <p>
            Botly n&apos;collecte <strong className="text-mist-100">aucun</strong>{" "}
            token de bot Discord appartenant à l&apos;utilisateur. Tu invites le
            bot officiel Botly sur ton serveur et tu lie l&apos;ID du serveur
            dans le dashboard. Tu restes responsable du respect des{" "}
            <a
              className="text-signal underline"
              href="https://discord.com/developers/docs/policies-and-agreements/developer-policy"
              target="_blank"
              rel="noreferrer"
            >
              règles Discord
            </a>{" "}
            sur tes serveurs.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-mist-100">4. Usage interdit</h2>
          <p>
            Spam, raids, harcèlement, contenu illégal, phishing ou abus des
            modules entraînent la suspension. Botly peut retirer le bot d&apos;un
            serveur ou supprimer un compte en cas de violation.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-mist-100">5. Abonnements et prestations</h2>
          <p>
            Offres : essai gratuit, Diagnostic Discord (paiement one-shot,
            crédit applicable sur le Setup), Setup Pilot (paiement one-shot),
            Ops et Scale (abonnements mensuels Stripe). Les abonnements sont
            résiliables depuis le portail client. En cas d&apos;impayé, les
            configs peuvent être mises en pause. Le Diagnostic et le Setup ne
            confèrent pas d&apos;abonnement récurrent tant qu&apos;Ops/Scale
            n&apos;est pas souscrit. Le crédit diagnostic sur le Setup est
            appliqué manuellement (code promo ou ajustement facture).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-mist-100">
            6. Responsabilité
          </h2>
          <p>
            Service fourni « en l&apos;état ». Botly n&apos;est pas responsable
            des sanctions Discord, pertes indirectes, ou mauvaises configurations
            de permissions sur ton serveur.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-mist-100">7. Données</h2>
          <p>
            Voir la{" "}
            <a className="text-signal underline" href="/privacy">
              politique de confidentialité
            </a>
            . Export et suppression depuis le dashboard (Billing).
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
