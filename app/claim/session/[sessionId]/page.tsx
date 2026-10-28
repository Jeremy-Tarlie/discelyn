import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { daysFromNow } from "@/lib/clock";
import { resolveJoinCta } from "@/lib/claim-join-cta";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { LearnerPortalButton } from "@/components/claim/LearnerPortalButton";
import { ClaimSessionPending } from "@/components/claim/ClaimSessionPending";
import { mintLearnerPortalToken } from "@/lib/portal-token";
import { isStripeCheckoutSessionId } from "@/lib/stripe-checkout-session-id";

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

async function findOversold(sessionId: string) {
  return prisma.accessOversoldEvent.findUnique({
    where: { stripeCheckoutSessionId: sessionId },
    select: { refundStatus: true },
  });
}

/**
 * Success URL Stripe : /claim/session/{CHECKOUT_SESSION_ID}
 */
export default async function ClaimBySessionPage({ params }: PageProps) {
  const { sessionId } = await params;
  const t = await getTranslations("claim");

  if (!isStripeCheckoutSessionId(sessionId)) {
    return (
      <div className="min-h-screen bg-[color:var(--page-bg)] text-[color:var(--page-fg)]">
        <SiteHeader signedIn={false} />
        <main id="main-content" tabIndex={-1} className="mx-auto max-w-lg px-6 py-16">
          <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
          <p className="mt-4 text-warn" role="alert">
            {t("errors.invalid")}
          </p>
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

  // Pas de sleep serveur : le client ClaimSessionPending / refresh gère la race webhook.
  const access = await findAccess(sessionId);

  if (!access) {
    const oversold = await findOversold(sessionId);
    if (oversold) {
      const refunded = oversold.refundStatus === "refunded";
      return (
        <div className="min-h-screen bg-[color:var(--page-bg)] text-[color:var(--page-fg)]">
          <SiteHeader signedIn={false} />
          <main id="main-content" tabIndex={-1} className="mx-auto max-w-lg px-6 py-16">
            <h1 className="font-display text-3xl font-bold">
              {t("sessionSoldOutTitle")}
            </h1>
            <p className="mt-3 text-soft">
              {refunded
                ? t("sessionSoldOutRefunded")
                : t("sessionSoldOutBody")}
            </p>
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

    return (
      <div className="min-h-screen bg-[color:var(--page-bg)] text-[color:var(--page-fg)]">
        <SiteHeader signedIn={false} />
        <main id="main-content" tabIndex={-1} className="mx-auto max-w-lg px-6 py-16">
          <ClaimSessionPending />
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
    const portalToken = mintLearnerPortalToken(access.id);
    return (
      <div className="min-h-screen bg-[color:var(--page-bg)] text-[color:var(--page-fg)]">
        <SiteHeader signedIn={false} />
          <main id="main-content" tabIndex={-1} className="mx-auto max-w-lg px-6 py-16">
          <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
          <p className="mt-4 text-page-fg">{t("successActive")}</p>
          {portalToken ? (
            <LearnerPortalButton portalToken={portalToken} />
          ) : null}
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

  if (access.status === "AWAITING_JOIN") {
    const joinHref = resolveJoinCta(access);
    return (
      <div className="min-h-screen bg-[color:var(--page-bg)] text-[color:var(--page-fg)]">
        <SiteHeader signedIn={false} />
          <main id="main-content" tabIndex={-1} className="mx-auto max-w-lg px-6 py-16">
          <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
          {joinHref ? (
            <>
              <p className="mt-4 text-page-fg">{t("successJoin")}</p>
              <a
                href={joinHref}
                className="mt-6 inline-flex rounded-full bg-[#5865F2] px-5 py-3 text-sm font-semibold text-white"
              >
                {t("joinDiscord")}
              </a>
            </>
          ) : (
            <p className="mt-4 text-warn">{t("errors.awaitingJoin")}</p>
          )}
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

  // Jamais repasser AWAITING_JOIN / REVOKED / … → PENDING_CLAIM.
  if (access.status !== "PENDING_CLAIM") {
    return (
      <div className="min-h-screen bg-[color:var(--page-bg)] text-[color:var(--page-fg)]">
        <SiteHeader signedIn={false} />
          <main id="main-content" tabIndex={-1} className="mx-auto max-w-lg px-6 py-16">
          <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
          <p className="mt-4 text-warn" role="alert">
            {t("errors.invalid")}
          </p>
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

  let token = access.claimToken;
  if (!token) {
    token = randomBytes(24).toString("base64url");
    await prisma.learnerAccess.update({
      where: { id: access.id },
      data: {
        claimToken: token,
        claimTokenExpiresAt: daysFromNow(14),
      },
    });
  }

  redirect(`/claim/${token}`);
}
