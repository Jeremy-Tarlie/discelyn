"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { SubscribeIntent } from "@/lib/auth-callback";
import { loginWithSubscribeIntent } from "@/lib/auth-callback";

export function SubscribeCheckout({ intent }: { intent: SubscribeIntent }) {
  const t = useTranslations("subscribe");
  const tc = useTranslations("common");
  const { status } = useSession();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(
        loginWithSubscribeIntent(intent.plan, intent.interval)
      );
      return;
    }
    if (status !== "authenticated" || started.current) return;
    started.current = true;

    void (async () => {
      try {
        const response = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId: intent.plan,
            interval: intent.interval,
          }),
        });
        const data = (await response.json()) as {
          url?: string;
          error?: string;
        };

        if (response.status === 401) {
          router.replace(
            loginWithSubscribeIntent(intent.plan, intent.interval)
          );
          return;
        }

        if (!response.ok || !data.url) {
          setError(data.error ?? t("checkoutFailed"));
          return;
        }

        window.location.assign(data.url);
      } catch {
        setError(tc("networkError"));
      }
    })();
  }, [status, intent.plan, intent.interval, router, t, tc]);

  if (error) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-warn">{error}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/pricing"
            className="rounded-lg bg-[#5865F2] px-5 py-2.5 text-sm font-semibold text-white"
          >
            {t("backPricing")}
          </Link>
          <Link
            href="/dashboard/billing"
            className="rounded-lg border border-[color:var(--border)] px-5 py-2.5 text-sm font-semibold text-[color:var(--page-fg)]"
          >
            {t("openBilling")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <p className="text-center text-sm text-[color:var(--muted)]">
      {tc("redirecting")}
    </p>
  );
}
