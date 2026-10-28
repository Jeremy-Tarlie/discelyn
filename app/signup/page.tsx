import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  isOneShotOfferId,
  parseSignupIntent,
  subscribePath,
} from "@/lib/auth-callback";
import { userNeedsMfaChallenge } from "@/lib/mfa-session";
import { AuthPageChrome } from "@/components/auth/AuthPageChrome";
import { SignupWizard } from "@/components/auth/SignupWizard";

type PageProps = {
  searchParams: Promise<{ plan?: string; interval?: string; offer?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("signupTitle") };
}

export default async function SignupPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const oneShotOffer =
    params.offer && isOneShotOfferId(params.offer) ? params.offer : null;
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
    if (oneShotOffer) {
      redirect(subscribePath(oneShotOffer));
    }
    if (initialPlan !== "FREE") {
      redirect(`/subscribe?plan=${initialPlan}&interval=${initialInterval}`);
    }
    redirect("/dashboard");
  }

  const t = await getTranslations("signup");

  return (
    <AuthPageChrome>
      <SignupWizard
        initialPlan={initialPlan}
        initialInterval={initialInterval}
        oneShotOffer={oneShotOffer}
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
      />
    </AuthPageChrome>
  );
}
