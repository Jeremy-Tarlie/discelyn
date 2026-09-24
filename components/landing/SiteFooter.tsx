import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CookiePrefsButton } from "@/components/cookies/CookieBanner";

export async function SiteFooter() {
  const t = await getTranslations("nav");

  return (
    <footer className="border-t border-[color:var(--border)] bg-[color:var(--footer-bg)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 text-sm text-[color:var(--muted)] md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-signal text-xs font-bold text-ink-950">
            B
          </span>
          <p className="font-display font-semibold text-[color:var(--page-fg)]">
            Botly
          </p>
        </div>
        <div className="flex flex-wrap gap-5">
          <Link
            href="/fonctionnalites"
            className="transition hover:text-[color:var(--page-fg)]"
          >
            {t("features")}
          </Link>
          <Link
            href="/comment-ca-marche"
            className="transition hover:text-[color:var(--page-fg)]"
          >
            {t("howItWorks")}
          </Link>
          <Link
            href="/pricing"
            className="transition hover:text-[color:var(--page-fg)]"
          >
            {t("pricing")}
          </Link>
          <Link
            href="/privacy"
            className="transition hover:text-[color:var(--page-fg)]"
          >
            {t("privacy")}
          </Link>
          <Link
            href="/terms"
            className="transition hover:text-[color:var(--page-fg)]"
          >
            {t("terms")}
          </Link>
          <Link
            href="/ai-act"
            className="transition hover:text-[color:var(--page-fg)]"
          >
            {t("aiAct")}
          </Link>
          <CookiePrefsButton className="transition hover:text-[color:var(--page-fg)]" />
        </div>
        <p>© {new Date().getFullYear()} Botly</p>
      </div>
    </footer>
  );
}
