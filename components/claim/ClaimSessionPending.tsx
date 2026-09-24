"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ClaimSessionRefresh } from "@/components/claim/ClaimSessionRefresh";

/** Affiche le pending + polling borné (client) pour /claim/session. */
export function ClaimSessionPending() {
  const t = useTranslations("claim");
  const router = useRouter();
  const [exhausted, setExhausted] = useState(false);

  return (
    <>
      <h1 className="font-display text-3xl font-bold">
        {exhausted ? t("sessionTimeoutTitle") : t("sessionPendingTitle")}
      </h1>
      <p className="mt-3 text-soft">
        {exhausted ? t("sessionTimeoutBody") : t("sessionPendingBody")}
      </p>
      {!exhausted ? (
        <ClaimSessionRefresh onExhausted={() => setExhausted(true)} />
      ) : (
        <button
          type="button"
          className="mt-6 rounded-full border border-line px-4 py-2 text-sm"
          onClick={() => {
            setExhausted(false);
            router.refresh();
          }}
        >
          {t("sessionRetry")}
        </button>
      )}
    </>
  );
}
