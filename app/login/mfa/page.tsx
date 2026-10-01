import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { authOptions } from "@/lib/auth";
import { userNeedsMfaChallenge } from "@/lib/mfa-session";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";
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
    <div className="relative min-h-screen overflow-hidden bg-[color:var(--page-bg)] text-[color:var(--page-fg)]">
      <div className="pointer-events-none absolute inset-0 bg-[#2a9e86]/15" aria-hidden />
      <SiteHeader />
      <main className="relative mx-auto flex min-h-[calc(100vh-12rem)] max-w-md flex-col items-center justify-center px-6 py-20">
        <div className="w-full rounded-2xl bg-[#2b2d31] p-8 shadow-[0_40px_100px_rgba(0,0,0,0.5)] sm:p-10">
          <h1 className="text-center font-display text-3xl font-bold text-white">
            {t("title")}
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-center text-sm text-[#949ba4]">
            {t("subtitle")}
          </p>
          <div className="mt-8">
            <MfaChallengeForm />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
