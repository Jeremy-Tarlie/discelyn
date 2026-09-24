import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("privacyTitle") };
}

const supportEmail =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || null;

export default async function PrivacyPage() {
  const locale = await getLocale();
  const t = await getTranslations("legal");
  const isEn = locale === "en";

  return (
    <div className="min-h-screen bg-[color:var(--page-bg)] text-[color:var(--page-fg)]">
      <SiteHeader />
      <main className="mx-auto max-w-3xl space-y-8 px-6 py-16 text-[color:var(--muted)]">
        <h1 className="font-display text-4xl text-[color:var(--page-fg)]">{t("privacyTitle")}</h1>
        <p className="text-sm leading-relaxed text-[color:var(--muted)]">{t("privacyUpdated")}</p>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-[color:var(--page-fg)]">{t("controllerTitle")}</h2>
          <p>
            {t("controllerBody", {
              email: supportEmail ? ` (${supportEmail})` : "",
            })}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-[color:var(--page-fg)]">{t("dataTitle")}</h2>
          {isEn ? (
            <ul className="list-disc space-y-2 pl-5">
              <li>Account: Discord ID, name, email, avatar (OAuth).</li>
              <li>
                Discord OAuth session: access_token and refresh_token stored
                server-side (Account table, NextAuth), encrypted at rest when
                TOKEN_ENCRYPTION_KEY is set, to maintain the session and verify
                you administer a server before linking. These are not user bot
                tokens.
              </li>
              <li>Configs: name, modules, settings, linked Discord server ID.</li>
              <li>
                Moderation: warns (reason, author, timestamp, target Discord ID)
                tied to a server — kept while the config / account exists, then
                purged after 90 days max.
              </li>
              <li>Billing: Stripe IDs (no card data stored by Botly).</li>
              <li>
                Commercial leads (landing form): email, name, company, role,
                message, requested offer, marketing consent timestamp — kept for
                follow-up until manual deletion or erasure request (max 24 months).
              </li>
              <li>
                Product analytics (internal events: landing views, signup,
                checkout…) — no third-party ads, no tracking cookie.
              </li>
              <li>
                Technical: IP for rate-limiting, error logs (Sentry if configured
                and consented in the browser).
              </li>
            </ul>
          ) : (
            <ul className="list-disc space-y-2 pl-5">
              <li>Compte : ID Discord, nom, email, avatar (OAuth).</li>
              <li>
                Session OAuth Discord : access_token et refresh_token stockés
                côté serveur (table Account, NextAuth), chiffrés au repos si
                TOKEN_ENCRYPTION_KEY est défini, pour maintenir la session et
                vérifier que tu administres un serveur avant de le lier. Ce ne
                sont pas des tokens de bot utilisateur.
              </li>
              <li>
                Configs : nom, modules, paramètres, ID de serveur Discord lié.
              </li>
              <li>
                Modération : warns (raison, auteur, horodatage, ID Discord cible)
                — conservation max 90 jours puis purge automatique.
              </li>
              <li>Facturation : IDs Stripe (pas de carte chez Botly).</li>
              <li>
                Leads commerciaux : email, nom, société, message, offre,
                horodatage du consentement marketing — suivi jusqu’à
                suppression / demande d’effacement (max 24 mois).
              </li>
              <li>
                Analytics produit (événements internes) — sans publicité tierce,
                sans cookie de tracking.
              </li>
              <li>
                Technique : IP pour rate-limiting, logs d’erreur (Sentry si
                configuré et consenti côté navigateur).
              </li>
            </ul>
          )}
          <p className="font-medium text-[color:var(--page-fg)]">
            {isEn
              ? "No user Discord bot token is collected or stored — only the Botly platform bot token is used server-side."
              : "Aucun token de bot Discord utilisateur n’est collecté ni stocké — seul le token du bot plateforme Botly est utilisé côté serveur."}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-[color:var(--page-fg)]">{t("legalBasesTitle")}</h2>
          {isEn ? (
            <ul className="list-disc space-y-2 pl-5">
              <li>Contract: account, bot configs, paid subscription.</li>
              <li>Legal obligation: invoicing / accounting traces via Stripe.</li>
              <li>Legitimate interest: security, abuse prevention, first-party product analytics.</li>
              <li>Consent: optional Sentry browser cookies; marketing contact via lead form.</li>
            </ul>
          ) : (
            <ul className="list-disc space-y-2 pl-5">
              <li>Contrat : compte, configs bot, abonnement payant.</li>
              <li>Obligation légale : facturation / traces comptables via Stripe.</li>
              <li>Intérêt légitime : sécurité, anti-abus, analytics produit first-party.</li>
              <li>Consentement : cookies Sentry optionnels ; contact commercial via formulaire lead.</li>
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-[color:var(--page-fg)]">{t("processorsTitle")}</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Discord — OAuth and platform bot API</li>
            <li>Stripe — payments (Stripe DPA)</li>
            <li>{isEn ? "Hosting provider of the instance" : "Hébergeur VPS / cloud de l’instance"}</li>
            <li>Sentry (optional) — application errors</li>
            <li>Redis (optional) — distributed rate-limiting</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-[color:var(--page-fg)]">{t("rightsTitle")}</h2>
          <p>
            {isEn
              ? "Access, rectification, erasure, portability, restriction, objection. From the dashboard → Billing: JSON export and account deletion. You may lodge a complaint with your supervisory authority (e.g. CNIL in France)."
              : "Accès, rectification, effacement, portabilité, limitation, opposition. Depuis le dashboard → Abonnement : export JSON et suppression de compte. Réclamation possible auprès de la CNIL."}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-[color:var(--page-fg)]">{t("retentionTitle")}</h2>
          <p>
            {isEn
              ? "Account data while the account is active. Moderation warns: max 90 days then automatic purge. Analytics events: max 24 months then purge. Leads: max 24 months or earlier on request. Stripe billing traces per legal accounting rules. Account deletion erases bots, warns, sessions and linked analytics/leads where applicable."
              : "Données compte tant que le compte est actif. Warns : max 90 jours puis purge. Analytics : max 24 mois puis purge. Leads : max 24 mois ou plus tôt sur demande. Traces Stripe selon obligations comptables. Suppression du compte = bots, warns, sessions et analytics/leads liés."}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-[color:var(--page-fg)]">{t("cookiesTitle")}</h2>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="bg-[#2b2d31] text-white">
                <tr>
                  <th className="px-3 py-2">{t("cookieTableName")}</th>
                  <th className="px-3 py-2">{t("cookieTablePurpose")}</th>
                  <th className="px-3 py-2">{t("cookieTableCategory")}</th>
                  <th className="px-3 py-2">{t("cookieTableDuration")}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-white/5">
                  <td className="px-3 py-2 font-mono text-xs">next-auth.session-token</td>
                  <td className="px-3 py-2">{isEn ? "Authentication" : "Authentification"}</td>
                  <td className="px-3 py-2">{isEn ? "Essential" : "Essentiel"}</td>
                  <td className="px-3 py-2">{isEn ? "Session" : "Session"}</td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="px-3 py-2 font-mono text-xs">botly_locale</td>
                  <td className="px-3 py-2">{isEn ? "UI language" : "Langue de l’interface"}</td>
                  <td className="px-3 py-2">{isEn ? "Essential" : "Essentiel"}</td>
                  <td className="px-3 py-2">1 {isEn ? "year" : "an"}</td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="px-3 py-2 font-mono text-xs">botly_theme</td>
                  <td className="px-3 py-2">{isEn ? "Light / dark theme" : "Thème clair / sombre"}</td>
                  <td className="px-3 py-2">{isEn ? "Essential" : "Essentiel"}</td>
                  <td className="px-3 py-2">1 {isEn ? "year" : "an"}</td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="px-3 py-2 font-mono text-xs">botly_consent</td>
                  <td className="px-3 py-2">{isEn ? "Cookie choice" : "Choix cookies"}</td>
                  <td className="px-3 py-2">{isEn ? "Essential" : "Essentiel"}</td>
                  <td className="px-3 py-2">1 {isEn ? "year" : "an"}</td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="px-3 py-2 font-mono text-xs">Sentry*</td>
                  <td className="px-3 py-2">{isEn ? "Error diagnostics" : "Diagnostics d’erreurs"}</td>
                  <td className="px-3 py-2">{isEn ? "Optional (consent)" : "Optionnel (consentement)"}</td>
                  <td className="px-3 py-2">{isEn ? "Per Sentry" : "Selon Sentry"}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm">
            {isEn
              ? "Manage preferences anytime via the Cookies link in the footer."
              : "Gère tes préférences à tout moment via le lien Cookies du footer."}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-[color:var(--page-fg)]">{t("aiTitle")}</h2>
          <p>
            {isEn ? "See the " : "Voir la page "}
            <Link className="text-signal underline" href="/ai-act">
              AI Act
            </Link>
            {isEn
              ? ": Botly does not operate an AI system within the meaning of the regulation."
              : " : Botly n’opère pas de système d’IA au sens du règlement."}
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
