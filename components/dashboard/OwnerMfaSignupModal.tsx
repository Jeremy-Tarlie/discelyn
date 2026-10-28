"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const DISMISS_KEY = "discelyn_owner_mfa_nudge_dismissed";

function subscribeDismiss(): () => void {
  return () => {};
}

function getDismissSnapshot(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function getDismissServerSnapshot(): boolean {
  return true;
}

/**
 * Nudge OWNER sans 2FA. Dismissible pour la session (sessionStorage) —
 * le browsing dashboard reste possible. Les actions billing / équipe /
 * sk_ formation restent bloquées côté API (`mfaRequiredForOwner`).
 * Masquée sur /dashboard/account pour le setup.
 */
export function OwnerMfaSignupModal({
  isOwner,
  mfaEnabled,
}: {
  userId: string;
  isOwner: boolean;
  mfaEnabled: boolean;
}) {
  const t = useTranslations("dashboard");
  const pathname = usePathname();
  const storageDismissed = useSyncExternalStore(
    subscribeDismiss,
    getDismissSnapshot,
    getDismissServerSnapshot
  );
  const [localDismissed, setLocalDismissed] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const onAccount =
    pathname === "/dashboard/account" ||
    pathname.endsWith("/dashboard/account");
  const open =
    isOwner && !mfaEnabled && !onAccount && !storageDismissed && !localDismissed;

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setLocalDismissed(true);
  }

  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const focusTimer = window.setTimeout(() => {
      firstButtonRef.current?.focus();
    }, 0);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
      previouslyFocusedRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-page-fg/40 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mfa-signup-title"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl"
      >
        <h2
          id="mfa-signup-title"
          className="font-display text-xl font-bold text-page-fg"
        >
          {t("ownerMfaPopupTitle")}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-soft">
          {t("ownerMfaPopupBody")}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <button
            ref={firstButtonRef}
            type="button"
            onClick={dismiss}
            className="rounded-full border border-line bg-surface-muted px-5 py-2.5 text-sm font-medium text-soft hover:border-signal/30 hover:text-page-fg"
          >
            {t("ownerMfaPopupLater")}
          </button>
          <Link
            href="/dashboard/account"
            className="rounded-full bg-signal px-5 py-2.5 text-sm font-semibold text-ink-950 hover:brightness-110"
          >
            {t("ownerMfaPopupCta")}
          </Link>
        </div>
      </div>
    </div>
  );
}
