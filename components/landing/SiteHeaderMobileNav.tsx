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

type NavLink = { href: string; label: string };

export function SiteHeaderMobileNav({
  links,
  signedIn,
  loginLabel,
  ctaHref,
  ctaLabel,
  ctaIcon,
}: {
  links: NavLink[];
  signedIn: boolean;
  loginLabel: string;
  ctaHref: string;
  ctaLabel: string;
  ctaIcon: ReactNode;
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
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--border)] text-[color:var(--page-fg)]"
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
            className="fixed inset-0 z-40 bg-black/40"
            aria-label={t("closeMenu")}
            onClick={() => setOpen(false)}
          />
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-modal="true"
            className="fixed inset-x-0 top-0 z-50 border-b border-[color:var(--border)] bg-[color:var(--header-bg)] px-6 pb-4 pt-16 shadow-lg backdrop-blur-xl"
          >
            <nav className="mx-auto flex max-w-6xl flex-col gap-3 text-sm text-[color:var(--muted)]">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="py-1 transition hover:text-[color:var(--page-fg)]"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              {!signedIn ? (
                <Link
                  href="/login"
                  className="py-1 transition hover:text-[color:var(--page-fg)]"
                  onClick={() => setOpen(false)}
                >
                  {loginLabel}
                </Link>
              ) : null}
              <Link
                href={ctaHref}
                className="mt-1 inline-flex items-center justify-center gap-2 rounded-full bg-[#1a1c21] px-3.5 py-2 text-sm font-bold text-white dark:bg-white dark:text-[#1a1c21]"
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
