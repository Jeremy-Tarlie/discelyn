import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthPageChrome } from "@/components/auth/AuthPageChrome";
import { VerifyEmailClient } from "@/components/auth/VerifyEmailClient";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("verifyEmailTitle") };
}

export default function VerifyEmailPage() {
  return (
    <AuthPageChrome>
      <Suspense fallback={null}>
        <VerifyEmailClient />
      </Suspense>
    </AuthPageChrome>
  );
}
