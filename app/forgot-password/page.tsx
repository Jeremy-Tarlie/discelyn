import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthPageChrome } from "@/components/auth/AuthPageChrome";
import { ForgotPasswordClient } from "@/components/auth/ForgotPasswordClient";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("forgotPasswordTitle") };
}

export default function ForgotPasswordPage() {
  return (
    <AuthPageChrome>
      <ForgotPasswordClient />
    </AuthPageChrome>
  );
}
