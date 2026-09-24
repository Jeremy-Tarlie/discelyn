import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("termsTitle") };
}

export default async function TermsPage() {
  const locale = await getLocale();
  const t = await getTranslations("legal");
  const isEn = locale === "en";

  return (
    <div className="min-h-screen bg-[color:var(--page-bg)] text-[color:var(--page-fg)]">
      <SiteHeader />
      <main className="mx-auto max-w-3xl space-y-8 px-6 py-16 text-[color:var(--muted)]">
        <h1 className="font-display text-4xl text-[color:var(--page-fg)]">
          {t("termsTitle")}
        </h1>
        <p className="text-sm leading-relaxed text-[color:var(--muted)]">
          {t("termsUpdated")}
        </p>

        {isEn ? (
          <>
            <section className="space-y-3">
              <h2 className="font-display text-xl text-[color:var(--page-fg)]">
                1. Purpose
              </h2>
              <p>
                Botly provides a Discord ops service for organisations
                (configuration via a platform bot, optional setup, subscription)
                — hereafter “the Service”. By creating an account or submitting a
                lead, you accept these Terms.
              </p>
            </section>
            <section className="space-y-3">
              <h2 className="font-display text-xl text-[color:var(--page-fg)]">
                2. Account
              </h2>
              <p>
                Sign-up is via Discord OAuth. You are responsible for use of your
                account and the servers you link. You must be of legal age to
                contract in your country.
              </p>
            </section>
            <section className="space-y-3">
              <h2 className="font-display text-xl text-[color:var(--page-fg)]">
                3. Platform bot — no user token
              </h2>
              <p>
                Botly collects{" "}
                <strong className="text-[color:var(--page-fg)]">no</strong>{" "}
                Discord bot token belonging to the user. You invite the official
                Botly bot to your server and link the server ID in the dashboard.
                You remain responsible for complying with{" "}
                <a
                  className="text-signal underline"
                  href="https://discord.com/developers/docs/policies-and-agreements/developer-policy"
                  target="_blank"
                  rel="noreferrer"
                >
                  Discord rules
                </a>{" "}
                on your servers.
              </p>
            </section>
            <section className="space-y-3">
              <h2 className="font-display text-xl text-[color:var(--page-fg)]">
                4. Prohibited use
              </h2>
              <p>
                Spam, raids, harassment, illegal content, phishing or module
                abuse may lead to suspension. Botly may remove the bot from a
                server or delete an account in case of violation.
              </p>
            </section>
            <section className="space-y-3">
              <h2 className="font-display text-xl text-[color:var(--page-fg)]">
                5. Subscriptions and services
              </h2>
              <p>
                Offers: free trial, Discord Diagnostic (one-shot, credit
                applicable to Setup), Setup Pilot (one-shot), Ops and Scale
                (monthly Stripe subscriptions). Subscriptions can be cancelled
                from the customer portal. On non-payment, configs may be paused.
                Diagnostic and Setup do not grant a recurring subscription until
                Ops/Scale is purchased. Diagnostic credit on Setup is applied
                manually (promo code or invoice adjustment).
              </p>
            </section>
            <section className="space-y-3">
              <h2 className="font-display text-xl text-[color:var(--page-fg)]">
                6. Liability
              </h2>
              <p>
                Service provided “as is”. Botly is not liable for Discord
                sanctions, indirect losses, or misconfigured permissions on your
                server.
              </p>
            </section>
            <section className="space-y-3">
              <h2 className="font-display text-xl text-[color:var(--page-fg)]">
                7. Data
              </h2>
              <p>
                See the{" "}
                <a className="text-signal underline" href="/privacy">
                  privacy policy
                </a>
                . Export and deletion from the dashboard (Billing).
              </p>
            </section>
          </>
        ) : (
          <>
            <section className="space-y-3">
              <h2 className="font-display text-xl text-[color:var(--page-fg)]">
                1. Objet
              </h2>
              <p>
                Botly fournit un service d&apos;ops Discord pour organisations
                (configuration via bot plateforme, setup optionnel, abonnement)
                — ci-après « le Service ». En créant un compte ou en soumettant
                un lead, tu acceptes les présentes CGU.
              </p>
            </section>
            <section className="space-y-3">
              <h2 className="font-display text-xl text-[color:var(--page-fg)]">
                2. Compte
              </h2>
              <p>
                L&apos;inscription se fait via OAuth Discord. Tu es responsable
                de l&apos;usage de ton compte et des serveurs que tu lies. Tu
                dois avoir l&apos;âge légal pour contracter dans ton pays.
              </p>
            </section>
            <section className="space-y-3">
              <h2 className="font-display text-xl text-[color:var(--page-fg)]">
                3. Bot plateforme — pas de token utilisateur
              </h2>
              <p>
                Botly n&apos;collecte{" "}
                <strong className="text-[color:var(--page-fg)]">aucun</strong>{" "}
                token de bot Discord appartenant à l&apos;utilisateur. Tu invites
                le bot officiel Botly sur ton serveur et tu lie l&apos;ID du
                serveur dans le dashboard. Tu restes responsable du respect des{" "}
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
              <h2 className="font-display text-xl text-[color:var(--page-fg)]">
                4. Usage interdit
              </h2>
              <p>
                Spam, raids, harcèlement, contenu illégal, phishing ou abus des
                modules entraînent la suspension. Botly peut retirer le bot
                d&apos;un serveur ou supprimer un compte en cas de violation.
              </p>
            </section>
            <section className="space-y-3">
              <h2 className="font-display text-xl text-[color:var(--page-fg)]">
                5. Abonnements et prestations
              </h2>
              <p>
                Offres : essai gratuit, Diagnostic Discord (paiement one-shot,
                crédit applicable sur le Setup), Setup Pilot (paiement one-shot),
                Ops et Scale (abonnements mensuels Stripe). Les abonnements sont
                résiliables depuis le portail client. En cas d&apos;impayé, les
                configs peuvent être mises en pause. Le Diagnostic et le Setup
                ne confèrent pas d&apos;abonnement récurrent tant qu&apos;Ops/Scale
                n&apos;est pas souscrit. Le crédit diagnostic sur le Setup est
                appliqué manuellement (code promo ou ajustement facture).
              </p>
            </section>
            <section className="space-y-3">
              <h2 className="font-display text-xl text-[color:var(--page-fg)]">
                6. Responsabilité
              </h2>
              <p>
                Service fourni « en l&apos;état ». Botly n&apos;est pas
                responsable des sanctions Discord, pertes indirectes, ou
                mauvaises configurations de permissions sur ton serveur.
              </p>
            </section>
            <section className="space-y-3">
              <h2 className="font-display text-xl text-[color:var(--page-fg)]">
                7. Données
              </h2>
              <p>
                Voir la{" "}
                <a className="text-signal underline" href="/privacy">
                  politique de confidentialité
                </a>
                . Export et suppression depuis le dashboard (Billing).
              </p>
            </section>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
