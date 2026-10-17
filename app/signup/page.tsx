import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { authOptions } from "@/lib/auth";
import { parseSignupIntent } from "@/lib/auth-callback";
import { userNeedsMfaChallenge } from "@/lib/mfa-session";
import { AuthPageChrome } from "@/components/auth/AuthPageChrome";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { CredentialsAuthForm } from "@/components/landing/CredentialsAuthForm";


type PageProps = {
  searchParams: Promise<{ plan?: string; interval?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("signupTitle") };
}

export default async function SignupPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const intent = parseSignupIntent({
    plan: params.plan,
    interval: params.interval,
  });
  const initialPlan = intent?.plan ?? "FREE";
  const initialInterval = intent?.interval ?? "month";

  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    if (await userNeedsMfaChallenge(session.user.id)) {
      redirect("/login/mfa");
    }
    if (initialPlan !== "FREE") {
      redirect(`/subscribe?plan=${initialPlan}&interval=${initialInterval}`);
    }
    redirect("/dashboard");
  }

  const t = await getTranslations("signup");

  return (
    <AuthPageChrome>
      <AuthPageShell
        title={t("title")}
        subtitle={t("subtitle")}
        footer={t.rich("legal", {
          terms: (chunks) => (
            <Link
              href="/terms"
              className="text-[color:var(--page-fg)] underline-offset-2 hover:underline"
            >
              {chunks}
            </Link>
          ),
          privacy: (chunks) => (
            <Link
              href="/privacy"
              className="text-[color:var(--page-fg)] underline-offset-2 hover:underline"
            >
              {chunks}
            </Link>
          ),
        })}
      >
        <CredentialsAuthForm
          mode="signup"
          initialPlan={initialPlan}
          initialInterval={initialInterval}
        />
      </AuthPageShell>
    </AuthPageChrome>
  );
}
