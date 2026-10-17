import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { authOptions } from "@/lib/auth";
import { userNeedsMfaChallenge } from "@/lib/mfa-session";
import { AuthPageChrome } from "@/components/auth/AuthPageChrome";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { MfaChallengeForm } from "@/components/auth/MfaChallengeForm";


export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mfa");
  return { title: t("title") };
}

export default async function MfaLoginPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const needs = await userNeedsMfaChallenge(session.user.id);
  if (!needs) {
    redirect("/dashboard");
  }

  const t = await getTranslations("mfa");

  return (
    <AuthPageChrome signedIn>
      <AuthPageShell title={t("title")} subtitle={t("subtitle")}>
        <MfaChallengeForm />
      </AuthPageShell>
    </AuthPageChrome>
  );
}
