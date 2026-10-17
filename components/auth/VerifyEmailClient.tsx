"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AuthPageShell } from "@/components/auth/AuthPageShell";

export function VerifyEmailClient() {
  const t = useTranslations("verifyEmail");
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const started = useRef(false);

  const missingCredentials = !token;
  const [fetchStatus, setFetchStatus] = useState<"pending" | "ok" | "fail">(
    "pending"
  );
  const status = missingCredentials ? "fail" : fetchStatus;

  useEffect(() => {
    if (!token) return;
    if (started.current) return;
    started.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = (await res.json()) as {
          redirectTo?: string;
          code?: string;
        };
        if (cancelled) return;
        if (res.ok) {
          setFetchStatus("ok");
          router.push(data.redirectTo ?? "/dashboard");
          router.refresh();
          return;
        }
        setFetchStatus("fail");
      } catch {
        if (!cancelled) setFetchStatus("fail");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  const subtitle =
    status === "pending"
      ? t("subtitle")
      : status === "ok"
        ? t("success")
        : t("failed");

  return (
    <AuthPageShell
      title={t("title")}
      subtitle={subtitle}
      footer={
        status === "fail" ? (
          <Link
            href="/login"
            className="text-[color:var(--page-fg)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]"
          >
            {t("loginLink")}
          </Link>
        ) : null
      }
    >
      <div className="sr-only" aria-live="polite">
        {subtitle}
      </div>
    </AuthPageShell>
  );
}
