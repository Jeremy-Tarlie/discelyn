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
  parseSubscribeIntent,
  signupWithPlanIntent,
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

  const session = await getServerSession(authOptions);

  if (intent && !session?.user?.id) {
    redirect(signupWithPlanIntent(intent.plan, intent.interval));
  }

  const t = await getTranslations("subscribe");

  return (
    <div className="min-h-screen bg-[color:var(--page-bg)] text-[color:var(--page-fg)]">
      <SiteHeader signedIn={Boolean(session?.user?.id)} />
      <main
        id="main-content"
        className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-md flex-col items-center justify-center px-6 py-16"
      >
        <div className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-8 sm:p-10">
          <h1 className="text-center font-display text-3xl font-bold text-[color:var(--page-fg)]">
            {t("title")}
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-center text-sm text-[color:var(--muted)]">
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
                  className="inline-flex rounded-lg bg-[#5865F2] px-5 py-2.5 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2]"
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
