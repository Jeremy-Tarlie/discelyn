"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * Popup bloquante OWNER sans 2FA — pas de dismiss « plus tard ».
 * Masquée sur /dashboard/account pour permettre le setup.
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
    const onAccount = pathname === "/dashboard/account";
    setOpen(Boolean(isOwner && !mfaEnabled && !onAccount));
  }, [isOwner, mfaEnabled, pathname]);

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
