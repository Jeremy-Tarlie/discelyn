"use client";

import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { DiscordIcon } from "@/components/landing/DiscordIcon";

export function LinkDiscordButton() {
  const t = useTranslations("dashboard");

  return (
    <button
      type="button"
      onClick={() =>
        signIn("discord", { callbackUrl: "/dashboard/account" })
      }
      className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#5865F2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4752c4]"
    >
      <DiscordIcon className="h-4 w-4" />
      {t("accountLinkDiscord")}
    </button>
  );
}
