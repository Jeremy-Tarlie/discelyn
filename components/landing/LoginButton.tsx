"use client";

import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { DiscordIcon } from "@/components/landing/DiscordIcon";
import { safeAuthCallbackUrl } from "@/lib/auth-callback";

export function LoginButton({
  callbackUrl,
}: {
  callbackUrl?: string | null;
}) {
  const t = useTranslations("login");
  const safeCallback = safeAuthCallbackUrl(callbackUrl);

  return (
    <button
      type="button"
      onClick={() => signIn("discord", { callbackUrl: safeCallback })}
      className="inline-flex w-full items-center justify-center gap-2.5 rounded-lg bg-[#5865F2] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_0_32px_rgba(88,101,242,0.35)] transition hover:bg-[#4752c4] hover:shadow-[0_0_48px_rgba(88,101,242,0.5)]"
    >
      <DiscordIcon className="h-5 w-5" />
      {t("continueDiscord")}
    </button>
  );
}
