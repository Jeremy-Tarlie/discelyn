import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { authOptions } from "@/lib/auth";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SubscribeCheckout } from "@/components/landing/SubscribeCheckout";
import {
  loginWithSubscribeIntent,
  parseSubscribeIntent,
} from "@/lib/auth-callback";

type PageProps = {
  searchParams: Promise<{ plan?: string; interval?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("subscribe");
  return { title: t("title") };
}

export default async function SubscribePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const intent = parseSubscribeIntent({
    plan: params.plan,
    interval: params.interval,
  });

  if (intent) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      redirect(loginWithSubscribeIntent(intent.plan, intent.interval));
    }
  }

  const t = await getTranslations("subscribe");

  return (
    <div className="relative min-h-screen overflow-hidden bg-[color:var(--page-bg)] text-[color:var(--page-fg)]">
      <div
        className="pointer-events-none absolute inset-0 bg-[#2a9e86]/15"
        aria-hidden
      />
      <SiteHeader />
      <main className="relative mx-auto flex min-h-[calc(100vh-12rem)] max-w-md flex-col items-center justify-center px-6 py-20">
        <div className="w-full rounded-2xl bg-[#2b2d31] p-8 shadow-[0_40px_100px_rgba(0,0,0,0.5)] sm:p-10">
          <h1 className="text-center font-display text-3xl font-bold text-white">
            {t("title")}
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-center text-sm text-[#949ba4]">
            {intent
              ? t("subtitle", { plan: intent.plan })
              : t("invalidIntent")}
          </p>
          <div className="mt-8">
            {intent ? (
              <SubscribeCheckout intent={intent} />
            ) : (
              <div className="text-center">
                <Link
                  href="/pricing"
                  className="inline-flex rounded-lg bg-[#5865F2] px-5 py-2.5 text-sm font-semibold text-white"
                >
                  {t("backPricing")}
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
