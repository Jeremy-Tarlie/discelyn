import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthPageChrome } from "@/components/auth/AuthPageChrome";
import { ResetPasswordClient } from "@/components/auth/ResetPasswordClient";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("resetPasswordTitle") };
}

export default function ResetPasswordPage() {
  return (
    <AuthPageChrome>
      <Suspense fallback={null}>
        <ResetPasswordClient />
      </Suspense>
    </AuthPageChrome>
  );
}
