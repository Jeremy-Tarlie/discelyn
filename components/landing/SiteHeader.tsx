import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { DiscordIcon } from "@/components/landing/DiscordIcon";
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { getRequestTheme } from "@/lib/theme";

export async function SiteHeader({
  signedIn = false,
}: {
  signedIn?: boolean;
}) {
  const t = await getTranslations("nav");
  const tc = await getTranslations("common");
  const theme = await getRequestTheme();

  const links = [
    { href: "/fonctionnalites", label: t("features") },
    { href: "/pricing", label: t("pricing") },
    { href: "/comment-ca-marche", label: t("howItWorks") },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--border)] bg-[color:var(--header-bg)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight text-[color:var(--page-fg)]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-signal text-sm font-bold text-ink-950">
            B
          </span>
          Botly
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-[color:var(--muted)] md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition hover:text-[color:var(--page-fg)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeSwitcher theme={theme} />
          <LocaleSwitcher />
          {!signedIn ? (
            <Link
              href="/login"
              className="hidden text-sm text-[color:var(--muted)] transition hover:text-[color:var(--page-fg)] sm:inline"
            >
              {tc("login")}
            </Link>
          ) : null}
          <Link
            href={signedIn ? "/dashboard" : "/login"}
            className="inline-flex items-center gap-2 rounded-full bg-[#1a1c21] px-3.5 py-2 text-sm font-bold text-white transition hover:bg-[#2b2d31] dark:bg-white dark:text-[#1a1c21] dark:hover:bg-white/90"
          >
            <DiscordIcon className="h-4 w-4 text-[#5865F2]" />
            {signedIn ? tc("dashboard") : tc("try")}
          </Link>
        </div>
      </div>
    </header>
  );
}
