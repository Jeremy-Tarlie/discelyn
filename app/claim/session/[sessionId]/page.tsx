import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { LearnerPortalButton } from "@/components/claim/LearnerPortalButton";

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

async function findAccess(sessionId: string) {
  return prisma.learnerAccess.findUnique({
    where: { stripeCheckoutSessionId: sessionId },
    select: {
      id: true,
      status: true,
      claimToken: true,
      inviteUrl: true,
    },
  });
}

/**
 * Success URL Stripe : /claim/session/{CHECKOUT_SESSION_ID}
 */
export default async function ClaimBySessionPage({ params }: PageProps) {
  const { sessionId } = await params;
  const t = await getTranslations("claim");

  let access = await findAccess(sessionId);
  if (!access) {
    await new Promise((r) => setTimeout(r, 2000));
    access = await findAccess(sessionId);
  }

  if (!access) {
    return (
      <div className="min-h-screen bg-[color:var(--page-bg)] text-[color:var(--page-fg)]">
        <SiteHeader signedIn={false} />
        <main className="mx-auto max-w-lg px-6 py-16">
          <h1 className="font-display text-3xl font-bold">
            {t("sessionPendingTitle")}
          </h1>
          <p className="mt-3 text-soft">{t("sessionPendingBody")}</p>
          <meta httpEquiv="refresh" content="3" />
          <p className="mt-6 text-sm text-soft">
            <Link href="/" className="underline">
              {t("backHome")}
            </Link>
          </p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (access.status === "ACTIVE") {
    return (
      <div className="min-h-screen bg-[color:var(--page-bg)] text-[color:var(--page-fg)]">
        <SiteHeader signedIn={false} />
        <main className="mx-auto max-w-lg px-6 py-16">
          <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
          <p className="mt-4 text-page-fg">{t("successActive")}</p>
          <LearnerPortalButton checkoutSessionId={sessionId} />
          <p className="mt-6 text-sm text-soft">
            <Link href="/" className="underline">
              {t("backHome")}
            </Link>
          </p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (access.status === "AWAITING_JOIN" && access.inviteUrl) {
    return (
      <div className="min-h-screen bg-[color:var(--page-bg)] text-[color:var(--page-fg)]">
        <SiteHeader signedIn={false} />
        <main className="mx-auto max-w-lg px-6 py-16">
          <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
          <p className="mt-4 text-page-fg">{t("successJoin")}</p>
          <a
            href={access.inviteUrl}
            className="mt-6 inline-flex rounded-full bg-[#5865F2] px-5 py-3 text-sm font-semibold text-white"
          >
            {t("joinDiscord")}
          </a>
        </main>
        <SiteFooter />
      </div>
    );
  }

  let token = access.claimToken;
  if (!token) {
    token = randomBytes(24).toString("base64url");
    await prisma.learnerAccess.update({
      where: { id: access.id },
      data: {
        claimToken: token,
        claimTokenExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        status: "PENDING_CLAIM",
      },
    });
  }

  redirect(`/claim/${token}`);
}
