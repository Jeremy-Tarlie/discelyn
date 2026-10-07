"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const DISMISS_KEY = "discelyn_owner_mfa_nudge_dismissed";

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
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onAccount =
      pathname === "/dashboard/account" ||
      pathname.endsWith("/dashboard/account");
    if (!isOwner || mfaEnabled || onAccount) {
      setOpen(false);
      return;
    }
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") {
        setOpen(false);
        return;
      }
    } catch {
      /* private mode / SSR — on affiche le nudge */
    }
    setOpen(true);
  }, [isOwner, mfaEnabled, pathname]);

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-page-fg/40 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mfa-signup-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl">
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
            type="button"
            onClick={dismiss}
            className="rounded-full border border-line bg-surface-muted px-5 py-2.5 text-sm font-medium text-soft hover:border-signal/30 hover:text-page-fg"
          >
            {t("ownerMfaPopupLater")}
          </button>
          <Link
            href="/dashboard/account"
            className="rounded-full bg-signal px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
          >
            {t("ownerMfaPopupCta")}
          </Link>
        </div>
      </div>
    </div>
  );
}
