import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { getConfiguredLegalEntity } from "@/lib/legal-entity";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("privacyTitle") };
}

export default async function PrivacyPage() {
  const locale = await getLocale();
  const t = await getTranslations("legal");
  const isEn = locale === "en";
  const entity = getConfiguredLegalEntity();

  return (
    <div className="min-h-screen bg-[color:var(--page-bg)] text-[color:var(--page-fg)]">
      <SiteHeader />
      <main className="mx-auto max-w-3xl space-y-8 px-6 py-16 text-[color:var(--muted)]">
        <h1 className="font-display text-4xl text-[color:var(--page-fg)]">
          {t("privacyTitle")}
        </h1>
        <p className="text-sm leading-relaxed text-[color:var(--muted)]">
          {t("privacyUpdated")}
        </p>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-[color:var(--page-fg)]">
            {t("controllerTitle")}
          </h2>
          {entity ? (
            <div className="space-y-1 text-sm leading-relaxed">
              <p className="font-medium text-[color:var(--page-fg)]">
                {entity.name}
              </p>
              <p>{entity.address}</p>
              <p>{entity.country}</p>
              {entity.siret ? (
                <p>
                  {isEn ? "Registration / SIRET" : "SIRET"} : {entity.siret}
                </p>
              ) : null}
              <p>
                {isEn ? "Contact" : "Contact"} :{" "}
                <a
                  className="text-signal underline"
                  href={`mailto:${entity.supportEmail}`}
                >
                  {entity.supportEmail}
                </a>
              </p>
            </div>
          ) : (
            <p className="text-warn">{t("controllerMissing")}</p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-[color:var(--page-fg)]">
            {t("dataTitle")}
          </h2>
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
              <li>Billing: Stripe IDs (no card data stored by Discelyn).</li>
              <li>
                Commercial leads (landing form): email, name, company, role,
                message, requested offer, marketing consent timestamp — kept for
                follow-up until manual deletion or erasure request (max 24 months).
              </li>
              <li>
                Product analytics (internal events) — first-party only; recorded
                only with the analytics cookie category.
              </li>
              <li>
                Cookie consent log: per-category choices (analytics / Sentry /
                affiliate), timestamp, policy version, anonymous visitor ID —
                linked to your account when signed in.
              </li>
              <li>
                Technical: IP for rate-limiting; browser error logs via Sentry
                only if the Sentry cookie category is consented.
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
              <li>Facturation : IDs Stripe (pas de carte chez Discelyn).</li>
              <li>
                Leads commerciaux : email, nom, société, message, offre,
                horodatage du consentement marketing — suivi jusqu’à
                suppression / demande d’effacement (max 24 mois).
              </li>
              <li>
                Analytics produit (événements internes) — first-party ; uniquement
                avec la catégorie cookies « analytics ».
              </li>
              <li>
                Journal des consentements cookies : choix par catégorie
                (analytics / Sentry / affilié), horodatage, version de politique,
                ID visiteur anonyme — rattaché au compte si connecté.
              </li>
              <li>
                Technique : IP pour rate-limiting ; logs d’erreur navigateur via
                Sentry seulement si la catégorie Sentry est consentie.
              </li>
            </ul>
          )}
          <p className="font-medium text-[color:var(--page-fg)]">
            {isEn
              ? "No user Discord bot token is collected or stored — only the Discelyn platform bot token is used server-side."
              : "Aucun token de bot Discord utilisateur n’est collecté ni stocké — seul le token du bot plateforme Discelyn est utilisé côté serveur."}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-[color:var(--page-fg)]">
            {t("legalBasesTitle")}
          </h2>
          {isEn ? (
            <ul className="list-disc space-y-2 pl-5">
              <li>Contract: account, bot configs, paid subscription.</li>
              <li>Legal obligation: invoicing / accounting traces via Stripe.</li>
              <li>Legitimate interest: security, abuse prevention, rate-limiting.</li>
              <li>
                Consent: optional cookie categories (analytics, browser Sentry,
                affiliate); marketing contact via lead form; storage of the
                cookie-consent log (proof of choice).
              </li>
            </ul>
          ) : (
            <ul className="list-disc space-y-2 pl-5">
              <li>Contrat : compte, configs bot, abonnement payant.</li>
              <li>Obligation légale : facturation / traces comptables via Stripe.</li>
              <li>
                Intérêt légitime : sécurité, anti-abus, rate-limiting.
              </li>
              <li>
                Consentement : catégories cookies optionnelles (analytics, Sentry
                navigateur, affilié) ; contact commercial via formulaire lead ;
                conservation du journal de consentement (preuve du choix).
              </li>
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-[color:var(--page-fg)]">
            {t("processorsTitle")}
          </h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Discord — OAuth and platform bot API</li>
            <li>Stripe — payments (Stripe DPA)</li>
            <li>
              {entity
                ? isEn
                  ? `Hosting: ${entity.hostingProvider} (${entity.hostingRegion})`
                  : `Hébergeur : ${entity.hostingProvider} (${entity.hostingRegion})`
                : isEn
                  ? "Hosting provider of the instance (configure NEXT_PUBLIC_HOSTING_PROVIDER / REGION)"
                  : "Hébergeur de l’instance (configurer NEXT_PUBLIC_HOSTING_PROVIDER / REGION)"}
            </li>
            <li>Sentry (optional) — application errors</li>
            <li>Redis (optional) — distributed rate-limiting</li>
            <li>Resend (optional) — claim / reminder emails</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-[color:var(--page-fg)]">
            {t("transfersTitle")}
          </h2>
          {isEn ? (
            <p>
              If a processor stores or processes personal data outside the EU/EEA
              (for example Sentry or a non-EU host), transfers rely on an adequacy
              decision where applicable, or on Standard Contractual Clauses (SCCs)
              / equivalent safeguards required by the GDPR, plus the processor’s
              DPA.               Prefer EU region hosting when available
              {entity ? ` (${entity.hostingRegion})` : ""}. Stripe and Discord
              publish their own transfer mechanisms in their DPAs.
            </p>
          ) : (
            <p>
              Si un sous-traitant stocke ou traite des données hors UE/EEE (par
              ex. Sentry ou un hébergeur hors UE), les transferts s’appuient sur
              une décision d’adéquation le cas échéant, ou sur les clauses
              contractuelles types (CCT / SCC) et garanties équivalentes exigées
              par le RGPD, ainsi que le DPA du sous-traitant. Préférer un
              hébergement en région UE
              {entity ? ` (${entity.hostingRegion})` : ""}. Stripe et Discord
              documentent leurs mécanismes de transfert dans leurs DPA.
            </p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-[color:var(--page-fg)]">
            {isEn ? "Security" : "Sécurité"}
          </h2>
          <p>
            {isEn
              ? "Owners must enable TOTP 2FA before billing actions and pasting training Stripe secret keys. OAuth and org Stripe secrets are encrypted at rest when TOKEN_ENCRYPTION_KEY is configured. A DPA template is available on request for Scale plans."
              : "Les OWNER doivent activer la 2FA TOTP avant les actions billing et le collage d’une clé secrète Stripe formation. Les secrets OAuth et Stripe orga sont chiffrés au repos (TOKEN_ENCRYPTION_KEY). Un modèle de DPA est disponible sur demande pour le plan Scale."}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-[color:var(--page-fg)]">
            {t("rightsTitle")}
          </h2>
          <p>
            {isEn
              ? "Access, rectification, erasure, portability, restriction, objection. From the dashboard → Account: cookie-consent history, JSON export and account deletion. Change cookie preferences anytime via the footer Cookies link. You may lodge a complaint with your supervisory authority (e.g. CNIL in France: "
              : "Accès, rectification, effacement, portabilité, limitation, opposition. Depuis le dashboard → Compte : historique des consentements cookies, export JSON et suppression de compte. Modifie tes préférences cookies à tout moment via le lien Cookies du footer. Réclamation possible auprès de la "}
            <a
              className="text-signal underline"
              href="https://www.cnil.fr/fr/plaintes"
              target="_blank"
              rel="noopener noreferrer"
            >
              CNIL
            </a>
            {isEn ? ")." : "."}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-[color:var(--page-fg)]">
            {t("retentionTitle")}
          </h2>
          <p>
            {isEn
              ? "Account data while the account is active. Moderation warns: max 90 days then automatic purge. Analytics events: max 24 months then purge. Cookie consent logs: max 24 months then purge (account deletion unlinks userId). Leads: max 24 months or earlier on request. Stripe billing traces per legal accounting rules. Account deletion erases bots, warns, sessions and linked analytics/leads where applicable."
              : "Données compte tant que le compte est actif. Warns : max 90 jours puis purge. Analytics : max 24 mois puis purge. Journal consentements cookies : max 24 mois puis purge (la suppression de compte détache le userId). Leads : max 24 mois ou plus tôt sur demande. Traces Stripe selon obligations comptables. Suppression du compte = bots, warns, sessions et analytics/leads liés."}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-[color:var(--page-fg)]">
            {t("cookiesTitle")}
          </h2>
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
                  <td className="px-3 py-2 font-mono text-xs">
                    next-auth.session-token
                  </td>
                  <td className="px-3 py-2">
                    {isEn ? "Authentication" : "Authentification"}
                  </td>
                  <td className="px-3 py-2">
                    {isEn ? "Essential" : "Essentiel"}
                  </td>
                  <td className="px-3 py-2">
                    {isEn ? "Session" : "Session"}
                  </td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="px-3 py-2 font-mono text-xs">discelyn_locale</td>
                  <td className="px-3 py-2">
                    {isEn ? "UI language" : "Langue de l’interface"}
                  </td>
                  <td className="px-3 py-2">
                    {isEn ? "Essential" : "Essentiel"}
                  </td>
                  <td className="px-3 py-2">1 {isEn ? "year" : "an"}</td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="px-3 py-2 font-mono text-xs">discelyn_theme</td>
                  <td className="px-3 py-2">
                    {isEn ? "Light / dark theme" : "Thème clair / sombre"}
                  </td>
                  <td className="px-3 py-2">
                    {isEn ? "Essential" : "Essentiel"}
                  </td>
                  <td className="px-3 py-2">1 {isEn ? "year" : "an"}</td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="px-3 py-2 font-mono text-xs">
                    discelyn_consent
                  </td>
                  <td className="px-3 py-2">
                    {isEn
                      ? "Cookie categories choice"
                      : "Choix des catégories cookies"}
                  </td>
                  <td className="px-3 py-2">
                    {isEn ? "Essential" : "Essentiel"}
                  </td>
                  <td className="px-3 py-2">1 {isEn ? "year" : "an"}</td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="px-3 py-2 font-mono text-xs">discelyn_cid</td>
                  <td className="px-3 py-2">
                    {isEn
                      ? "Anonymous visitor ID (consent log)"
                      : "ID visiteur anonyme (journal consentement)"}
                  </td>
                  <td className="px-3 py-2">
                    {isEn ? "Essential" : "Essentiel"}
                  </td>
                  <td className="px-3 py-2">1 {isEn ? "year" : "an"}</td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="px-3 py-2 font-mono text-xs">Sentry*</td>
                  <td className="px-3 py-2">
                    {isEn ? "Error diagnostics" : "Diagnostics d’erreurs"}
                  </td>
                  <td className="px-3 py-2">
                    {isEn
                      ? "Optional (Sentry category)"
                      : "Optionnel (catégorie Sentry)"}
                  </td>
                  <td className="px-3 py-2">
                    {isEn ? "Per Sentry" : "Selon Sentry"}
                  </td>
                </tr>
                <tr className="border-t border-white/5">
                  <td className="px-3 py-2 font-mono text-xs">discelyn_aff</td>
                  <td className="px-3 py-2">
                    {isEn
                      ? "Affiliate referral"
                      : "Parrainage affilié"}
                  </td>
                  <td className="px-3 py-2">
                    {isEn
                      ? "Optional (affiliate category)"
                      : "Optionnel (catégorie affilié)"}
                  </td>
                  <td className="px-3 py-2">30 {isEn ? "days" : "jours"}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm">
            {isEn
              ? "Manage preferences anytime via the Cookies link in the footer (per category)."
              : "Gère tes préférences à tout moment via le lien Cookies du footer (par catégorie)."}
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
