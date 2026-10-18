import type { Metadata } from "next";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import {
  revokeMarketingConsent,
  verifyUnsubscribeToken,
} from "@/lib/marketing-unsubscribe";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const isEn = locale === "en";
  return {
    title: isEn ? "Unsubscribe · Discelyn" : "Se désinscrire · Discelyn",
    robots: { index: false, follow: false },
  };
}

type PageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function UnsubscribePage({ searchParams }: PageProps) {
  const { token } = await searchParams;
  const locale = await getLocale();
  const isEn = locale === "en";

  let state: "missing" | "invalid" | "ok" = "missing";
  if (token?.trim()) {
    const verified = verifyUnsubscribeToken(token.trim());
    if (!verified.ok) {
      state = "invalid";
    } else {
      await revokeMarketingConsent(verified.email);
      state = "ok";
    }
  }

  const title =
    state === "ok"
      ? isEn
        ? "You’re unsubscribed"
        : "Désinscription confirmée"
      : state === "invalid"
        ? isEn
          ? "Invalid or expired link"
          : "Lien invalide ou expiré"
        : isEn
          ? "Unsubscribe"
          : "Se désinscrire";

  const body =
    state === "ok"
      ? isEn
        ? "You will no longer receive Discelyn marketing emails. Transactional messages (account, billing, access claims) may still be sent when required."
        : "Tu ne recevras plus les e-mails marketing Discelyn. Les messages transactionnels (compte, facturation, claims) peuvent encore être envoyés si nécessaire."
      : state === "invalid"
        ? isEn
          ? "This unsubscribe link is invalid or has expired. You can also turn off marketing emails in your account preferences if you have a Discelyn account."
          : "Ce lien de désinscription est invalide ou a expiré. Tu peux aussi désactiver les e-mails marketing dans les préférences de ton compte Discelyn."
        : isEn
          ? "Open the unsubscribe link from a marketing email, or manage preferences in your account."
          : "Ouvre le lien de désinscription depuis un e-mail marketing, ou gère tes préférences dans ton compte.";

  return (
    <div className="min-h-screen bg-[color:var(--page-bg)] text-[color:var(--page-fg)]">
      <SiteHeader />
      <main
        id="main-content"
        className="mx-auto max-w-lg space-y-4 px-6 py-16"
      >
        <h1 className="font-display text-3xl text-[color:var(--page-fg)]">
          {title}
        </h1>
        <p className="text-sm leading-relaxed text-[color:var(--muted)]">
          {body}
        </p>
        <p className="text-sm">
          <Link href="/privacy" className="text-signal underline">
            {isEn ? "Privacy policy" : "Politique de confidentialité"}
          </Link>
          {" · "}
          <Link
            href="/login?callbackUrl=/dashboard/account"
            className="text-signal underline"
          >
            {isEn ? "Account" : "Compte"}
          </Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
