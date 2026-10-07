import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { getConfiguredLegalEntity } from "@/lib/legal-entity";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("legalNoticeTitle") };
}

export default async function MentionsLegalesPage() {
  const locale = await getLocale();
  const t = await getTranslations("legal");
  const isEn = locale === "en";
  const entity = getConfiguredLegalEntity();

  return (
    <div className="min-h-screen bg-[color:var(--page-bg)] text-[color:var(--page-fg)]">
      <SiteHeader />
      <main className="mx-auto max-w-3xl space-y-8 px-6 py-16 text-[color:var(--muted)]">
        <h1 className="font-display text-4xl text-[color:var(--page-fg)]">
          {t("legalNoticeTitle")}
        </h1>
        <p className="text-sm">{t("legalNoticeUpdated")}</p>

        {!entity ? (
          <p className="text-warn">{t("controllerMissing")}</p>
        ) : (
          <>
            <section className="space-y-3">
              <h2 className="font-display text-xl text-[color:var(--page-fg)]">
                {isEn ? "1. Publisher" : "1. Éditeur du site"}
              </h2>
              <p>
                <strong className="text-[color:var(--page-fg)]">
                  {entity.name}
                </strong>
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
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-xl text-[color:var(--page-fg)]">
                {isEn
                  ? "2. Publication director"
                  : "2. Directeur de la publication"}
              </h2>
              <p>{entity.name}</p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-xl text-[color:var(--page-fg)]">
                {isEn ? "3. Hosting" : "3. Hébergement"}
              </h2>
              <p>
                {entity.hostingProvider} ({entity.hostingRegion})
              </p>
              <p className="text-sm">
                {isEn
                  ? "Hosting details and region as configured for this Discelyn instance."
                  : "Hébergeur et région configurés pour cette instance Discelyn."}
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-xl text-[color:var(--page-fg)]">
                {isEn ? "4. Personal data" : "4. Données personnelles"}
              </h2>
              <p>
                {isEn ? "See the " : "Voir la "}
                <Link href="/privacy" className="text-signal underline">
                  {isEn ? "privacy policy" : "politique de confidentialité"}
                </Link>
                {isEn
                  ? " and cookie preferences (footer)."
                  : " et les préférences cookies (footer)."}
              </p>
            </section>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
