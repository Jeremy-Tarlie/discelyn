import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { safeAuthCallbackUrl } from "@/lib/auth-callback";
import { userNeedsMfaChallenge } from "@/lib/mfa-session";
import { AuthPageChrome } from "@/components/auth/AuthPageChrome";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { CredentialsAuthForm } from "@/components/landing/CredentialsAuthForm";


type PageProps = {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("loginTitle") };
}

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const callbackUrl = safeAuthCallbackUrl(params.callbackUrl);
  const oauthError = params.error === "OAuthAccountNotLinked";

  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    if (await userNeedsMfaChallenge(session.user.id)) {
      redirect("/login/mfa");
    }
    redirect(callbackUrl);
  }

  const t = await getTranslations("login");

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
          callbackUrl={callbackUrl}
          oauthError={oauthError}
        />
      </AuthPageShell>
    </AuthPageChrome>
  );
}
