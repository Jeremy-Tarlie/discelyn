"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { SignOutButton } from "@/components/auth/SignOutButton";

type NavLink = { href: string; label: string };

export function SiteHeaderMobileNav({
  links,
  signedIn,
  loginLabel,
  signupLabel,
  ctaHref,
  ctaLabel,
  ctaIcon,
  themeSwitcher,
  localeSwitcher,
}: {
  links: NavLink[];
  signedIn: boolean;
  loginLabel: string;
  signupLabel: string;
  ctaHref: string;
  ctaLabel: string;
  ctaIcon: ReactNode;
  themeSwitcher: ReactNode;
  localeSwitcher: ReactNode;
}) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKey);
    const firstLink = panelRef.current?.querySelector<HTMLElement>("a");
    firstLink?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--page-fg)] transition hover:bg-[color:var(--page-fg)]/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? t("closeMenu") : t("openMenu")}
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" />
          )}
        </svg>
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-[color:var(--page-fg)]/20 backdrop-blur-[2px]"
            aria-label={t("closeMenu")}
            onClick={() => setOpen(false)}
          />
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-label={t("menu")}
            className="fixed inset-x-0 top-0 z-50 border-b border-[color:var(--border)] bg-[color:var(--header-bg)] px-6 pb-6 pt-[4.5rem] shadow-[0_12px_40px_rgba(26,28,33,0.12)]"
          >

            <nav className="mx-auto flex max-w-6xl flex-col gap-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-[color:var(--muted)] transition hover:bg-[color:var(--page-fg)]/[0.04] hover:text-[color:var(--page-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              ))}

              <div className="my-3 h-px bg-[color:var(--border)]" />

              <div className="flex flex-wrap items-center gap-2 px-1 pb-2">
                {themeSwitcher}
                {localeSwitcher}
              </div>

              {!signedIn ? (
                <>
                  <Link
                    href="/login"
                    className="rounded-lg px-3 py-2.5 text-sm font-medium text-[color:var(--muted)] transition hover:bg-[color:var(--page-fg)]/[0.04] hover:text-[color:var(--page-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]"
                    onClick={() => setOpen(false)}
                  >
                    {loginLabel}
                  </Link>
                  <Link
                    href="/signup"
                    className="rounded-lg px-3 py-2.5 text-sm font-semibold text-[color:var(--page-fg)] transition hover:bg-[color:var(--page-fg)]/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]"
                    onClick={() => setOpen(false)}
                  >
                    {signupLabel}
                  </Link>
                </>
              ) : (
                <SignOutButton
                  variant="link"
                  labelNamespace="common"
                  className="rounded-lg px-3 py-2.5 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                  onAfterClick={() => setOpen(false)}
                />
              )}

              <Link
                href={ctaHref}
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-[#5865F2] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(88,101,242,0.35)] transition hover:bg-[#4752C4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                onClick={() => setOpen(false)}
              >
                {ctaIcon}
                {ctaLabel}
              </Link>
            </nav>
          </div>
        </>
      ) : null}
    </div>
  );
}
