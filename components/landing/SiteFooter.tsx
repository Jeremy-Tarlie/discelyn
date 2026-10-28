import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CookiePrefsButton } from "@/components/cookies/CookieBanner";
import { DiscelynMark } from "@/components/landing/DiscelynMark";

export async function SiteFooter() {
  const t = await getTranslations("nav");

  return (
    <footer className="border-t border-[color:var(--border)] bg-[color:var(--footer-bg)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 text-sm text-[color:var(--footer-muted)] md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2.5">
          <DiscelynMark size="sm" />
          <p className="font-display font-semibold text-[color:var(--page-fg)]">
            Discelyn
          </p>
        </div>
        <nav aria-label={t("footerNav")}>
          <ul className="flex flex-wrap gap-5">
            <li>
              <Link
                href="/fonctionnalites"
                className="underline-offset-2 transition hover:text-[color:var(--page-fg)] hover:underline"
              >
                {t("features")}
              </Link>
            </li>
            <li>
              <Link
                href="/comment-ca-marche"
                className="underline-offset-2 transition hover:text-[color:var(--page-fg)] hover:underline"
              >
                {t("howItWorks")}
              </Link>
            </li>
            <li>
              <Link
                href="/pricing"
                className="underline-offset-2 transition hover:text-[color:var(--page-fg)] hover:underline"
              >
                {t("pricing")}
              </Link>
            </li>
            <li>
              <Link
                href="/mentions-legales"
                className="underline-offset-2 transition hover:text-[color:var(--page-fg)] hover:underline"
              >
                {t("legalNotice")}
              </Link>
            </li>
            <li>
              <Link
                href="/privacy"
                className="underline-offset-2 transition hover:text-[color:var(--page-fg)] hover:underline"
              >
                {t("privacy")}
              </Link>
            </li>
            <li>
              <Link
                href="/terms"
                className="underline-offset-2 transition hover:text-[color:var(--page-fg)] hover:underline"
              >
                {t("terms")}
              </Link>
            </li>
            <li>
              <CookiePrefsButton className="underline-offset-2 transition hover:text-[color:var(--page-fg)] hover:underline" />
            </li>
          </ul>
        </nav>
        <p>© {new Date().getFullYear()} Discelyn</p>
      </div>
    </footer>
  );
}
