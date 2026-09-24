import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { ClaimCodeForm } from "@/components/claim/ClaimCodeForm";

export default async function ClaimCodePage() {
  const t = await getTranslations("claim");

  return (
    <div className="min-h-screen bg-[color:var(--page-bg)] text-[color:var(--page-fg)]">
      <SiteHeader signedIn={false} />
      <main className="mx-auto max-w-lg px-6 py-16">
        <p className="text-xs uppercase tracking-wide text-signal">Botly</p>
        <h1 className="mt-2 font-display text-3xl font-bold">
          {t("codeTitle")}
        </h1>
        <p className="mt-3 text-soft">{t("codeSubtitle")}</p>
        <ClaimCodeForm />
        <p className="mt-8 text-center text-sm text-soft">
          <Link href="/" className="underline">
            {t("backHome")}
          </Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
