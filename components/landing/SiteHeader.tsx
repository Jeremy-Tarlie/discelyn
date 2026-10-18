import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { DiscordIcon } from "@/components/landing/DiscordIcon";
import { DiscelynMark } from "@/components/landing/DiscelynMark";
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { SiteHeaderMobileNav } from "@/components/landing/SiteHeaderMobileNav";
import { SignOutButton } from "@/components/auth/SignOutButton";
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

  const ctaHref = signedIn ? "/dashboard" : "/signup";
  const ctaLabel = signedIn ? tc("dashboard") : tc("try");
  const discordIcon = (
    <DiscordIcon className="h-4 w-4 shrink-0 text-white" />
  );

  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--border)]/70 bg-[color:var(--header-bg)]/90 backdrop-blur-xl">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[#5865F2] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:outline-none"
      >
        {tc("skipToContent")}
      </a>
      <div className="relative mx-auto flex h-14 w-full max-w-6xl items-center gap-8 px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 font-display text-base font-bold tracking-tight text-[color:var(--page-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]"
        >
          <DiscelynMark size="md" />
          Discelyn
        </Link>

        <nav
          className="hidden min-w-0 flex-1 items-center gap-6 md:flex"
          aria-label={tc("mainNav")}
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap text-sm text-[color:var(--muted)] transition-colors hover:text-[color:var(--page-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <div className="hidden items-center sm:flex">
            <ThemeSwitcher theme={theme} variant="icon" />
            <LocaleSwitcher variant="icon" />
          </div>

          {!signedIn ? (
            <Link
              href="/login"
              className="hidden whitespace-nowrap px-2.5 py-1.5 text-sm text-[color:var(--muted)] transition-colors hover:text-[color:var(--page-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2] md:inline"
            >
              {tc("login")}
            </Link>
          ) : (
            <div className="hidden md:block">
              <SignOutButton variant="header" labelNamespace="common" />
            </div>
          )}

          <Link
            href={ctaHref}
            className="hidden items-center gap-1.5 rounded-full bg-[#5865F2] px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-[#4752C4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:inline-flex"
          >
            {!signedIn ? discordIcon : null}
            {ctaLabel}
          </Link>

          <SiteHeaderMobileNav
            links={links}
            signedIn={signedIn}
            loginLabel={tc("login")}
            signupLabel={tc("signup")}
            ctaHref={ctaHref}
            ctaLabel={ctaLabel}
            ctaIcon={!signedIn ? discordIcon : null}
            themeSwitcher={<ThemeSwitcher theme={theme} />}
            localeSwitcher={<LocaleSwitcher />}
          />
        </div>
      </div>
    </header>
  );
}
