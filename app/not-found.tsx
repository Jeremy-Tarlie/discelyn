import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  const tc = await getTranslations("common");

  return (
    <div className="min-h-screen bg-[color:var(--page-bg)] text-[color:var(--page-fg)]">
      <SiteHeader signedIn={false} />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-lg px-6 py-20 text-center"
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-signal">
          404
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold">{t("title")}</h1>
        <p className="mt-4 text-[color:var(--muted)]">{t("body")}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex rounded-full bg-signal px-5 py-3 text-sm font-semibold text-ink-950"
          >
            {t("home")}
          </Link>
          <Link
            href="/login"
            className="inline-flex rounded-full border border-[color:var(--border)] px-5 py-3 text-sm font-semibold text-[color:var(--page-fg)]"
          >
            {tc("login")}
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
