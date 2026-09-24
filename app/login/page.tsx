import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { authOptions } from "@/lib/auth";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { LoginButton } from "@/components/landing/LoginButton";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("loginTitle") };
}

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect("/dashboard");
  }

  const t = await getTranslations("login");

  return (
    <div className="relative min-h-screen overflow-hidden bg-[color:var(--page-bg)] text-[color:var(--page-fg)]">
      <div className="pointer-events-none absolute inset-0 bg-[#2a9e86]/15" aria-hidden />
      <SiteHeader />
      <main className="relative mx-auto flex min-h-[calc(100vh-12rem)] max-w-md flex-col items-center justify-center px-6 py-20">
        <div className="animate-scale-in w-full rounded-2xl bg-[#2b2d31] p-8 shadow-[0_40px_100px_rgba(0,0,0,0.5)] sm:p-10">
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-signal font-display text-lg font-bold text-ink-950">
            B
          </div>
          <h1 className="text-center font-display text-3xl font-bold text-white">
            {t("title")}
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-center text-sm text-[#949ba4]">
            {t("subtitle")}
          </p>
          <div className="mt-8">
            <LoginButton />
          </div>
          <p className="mt-6 text-center text-xs text-[#6d737e]">
            {t.rich("legal", {
              terms: (chunks) => (
                <Link href="/terms" className="text-[#b5bac1] hover:text-white">
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link href="/privacy" className="text-[#b5bac1] hover:text-white">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
