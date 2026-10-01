"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

const storageKey = (userId: string) => `discelyn:mfa-signup-prompt:${userId}`;

/**
 * Popup unique à l’inscription (OWNER sans 2FA).
 * Une seule fois — dismiss stocké en localStorage. Pas de bannière persistante.
 */
export function OwnerMfaSignupModal({
  userId,
  isOwner,
  mfaEnabled,
}: {
  userId: string;
  isOwner: boolean;
  mfaEnabled: boolean;
}) {
  const t = useTranslations("dashboard");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isOwner || mfaEnabled) return;
    try {
      if (window.localStorage.getItem(storageKey(userId)) === "1") return;
    } catch {
      // private mode — montrer quand même une fois par session
    }
    setOpen(true);
  }, [isOwner, mfaEnabled, userId]);

  function dismiss() {
    try {
      window.localStorage.setItem(storageKey(userId), "1");
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
            className="rounded-full px-4 py-2 text-sm font-medium text-soft hover:text-page-fg"
          >
            {t("ownerMfaPopupLater")}
          </button>
          <Link
            href="/dashboard/account"
            onClick={dismiss}
            className="rounded-full bg-signal px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
          >
            {t("ownerMfaPopupCta")}
          </Link>
        </div>
      </div>
    </div>
  );
}
