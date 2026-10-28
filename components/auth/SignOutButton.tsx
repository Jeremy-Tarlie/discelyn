"use client";

import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";

type Variant = "nav" | "link" | "header";

const VARIANT_CLASS: Record<Variant, string> = {
  nav: "mt-auto text-left text-sm text-red-700 transition hover:text-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 dark:text-red-300 dark:hover:text-red-200",
  link: "text-red-700 underline-offset-2 hover:text-red-800 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 dark:text-red-300 dark:hover:text-red-200",
  header:
    "inline-flex min-h-9 items-center rounded-full px-3 text-[0.8125rem] font-medium text-red-700 transition hover:bg-red-700/10 hover:text-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 dark:text-red-300 dark:hover:bg-red-300/10 dark:hover:text-red-200",
};


export function SignOutButton({
  variant = "nav",
  labelNamespace = "common",
  className = "",
  onAfterClick,
}: {
  variant?: Variant;
  /** common.logout | dashboard.logout | mfa.signOut */
  labelNamespace?: "common" | "dashboard" | "mfa";
  className?: string;
  onAfterClick?: () => void;
}) {
  const tCommon = useTranslations("common");
  const tDashboard = useTranslations("dashboard");
  const tMfa = useTranslations("mfa");

  const label =
    labelNamespace === "dashboard"
      ? tDashboard("logout")
      : labelNamespace === "mfa"
        ? tMfa("signOut")
        : tCommon("logout");

  return (
    <button
      type="button"
      className={`${VARIANT_CLASS[variant]} ${className}`.trim()}
      onClick={() => {
        onAfterClick?.();
        void signOut({ callbackUrl: "/" });
      }}
    >
      {label}
    </button>
  );
}
