import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { currentTimeMs } from "@/lib/clock";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { SiteFooter } from "@/components/landing/SiteFooter";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function isClaimTokenOpen(
  status: string,
  expiresAt: Date | null,
  nowMs: number
): boolean {
  return (
    status === "PENDING_CLAIM" &&
    (expiresAt === null || expiresAt.getTime() >= nowMs)
  );
}

export default async function ClaimPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const query = await searchParams;
  const t = await getTranslations("claim");
  const ok = firstParam(query.ok);
  const error = firstParam(query.error);
  const invite = firstParam(query.invite);

  const access = await prisma.learnerAccess.findFirst({
    where: { claimToken: token },
    include: {
      product: {
        select: {
          name: true,
          brandName: true,
          brandLogoUrl: true,
          brandColor: true,
          userId: true,
        },
      },
      bot: { select: { name: true } },
    },
  });

  const orgBrand = access
    ? await prisma.orgStripeConfig.findUnique({
        where: { userId: access.product.userId },
        select: {
          displayName: true,
          logoUrl: true,
          primaryColor: true,
          supportUrl: true,
        },
      })
    : null;

  const brandName =
    access?.product.brandName ?? orgBrand?.displayName ?? "Botly";
  const brandLogo =
    access?.product.brandLogoUrl ?? orgBrand?.logoUrl ?? null;
  const brandColor =
    access?.product.brandColor ?? orgBrand?.primaryColor ?? "#5865F2";
  const supportUrl = orgBrand?.supportUrl ?? null;

  // Horodatage après les awaits Prisma : la page est déjà dynamique.
  const canClaim =
    Boolean(access) &&
    isClaimTokenOpen(
      access!.status,
      access!.claimTokenExpiresAt,
      currentTimeMs()
    );

  const showSuccess = ok === "active" || ok === "join";

  let errorMessage: string | null = null;
  if (error === "oauth") errorMessage = t("errors.oauth");
  else if (error === "config") errorMessage = t("errors.config");
  else if (error === "grant") errorMessage = t("errors.grant");
  else if (error) errorMessage = t("errors.invalid");

  return (
    <div className="min-h-screen bg-[color:var(--page-bg)] text-[color:var(--page-fg)]">
      <SiteHeader signedIn={false} />
      <main className="mx-auto max-w-lg px-6 py-16">
        <div className="flex items-center gap-3">
          {brandLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brandLogo}
              alt=""
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : null}
          <p
            className="text-xs uppercase tracking-wide"
            style={{ color: brandColor }}
          >
            {brandName}
          </p>
        </div>
        <h1 className="mt-2 font-display text-3xl font-bold">{t("title")}</h1>
        <p className="mt-3 text-soft">{t("subtitle")}</p>

        {showSuccess ? (
          <div className="mt-8 space-y-4 rounded-2xl border border-line bg-surface p-6">
            <p className="text-page-fg">
              {ok === "active" ? t("successActive") : t("successJoin")}
            </p>
            {ok === "join" && invite ? (
              <a
                href={invite}
                className="inline-flex rounded-full px-5 py-3 text-sm font-semibold text-white"
                style={{ backgroundColor: brandColor }}
              >
                {t("joinDiscord")}
              </a>
            ) : null}
            {supportUrl ? (
              <a href={supportUrl} className="block text-sm text-soft underline">
                {t("support")}
              </a>
            ) : null}
          </div>
        ) : null}

        {!showSuccess && errorMessage ? (
          <div className="mt-8 rounded-2xl border border-warn/40 bg-surface p-6 text-warn">
            {errorMessage}
          </div>
        ) : null}

        {!showSuccess && !errorMessage && !canClaim ? (
          <div className="mt-8 rounded-2xl border border-warn/40 bg-surface p-6 text-warn">
            {t("errors.invalid")}
          </div>
        ) : null}

        {!showSuccess && !errorMessage && canClaim && access ? (
          <div className="mt-8 space-y-4 rounded-2xl border border-line bg-surface p-6">
            <p className="text-sm text-soft">
              {t("productLabel", {
                product: access.product.name,
                bot: access.bot.name,
              })}
            </p>
            <a
              href={`/api/access/claim/${token}`}
              className="inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold text-white"
              style={{ backgroundColor: brandColor }}
            >
              {t("connectDiscord")}
            </a>
            <p className="text-xs text-soft">{t("privacyHint")}</p>
          </div>
        ) : null}

        <p className="mt-6 text-center text-sm text-soft">
          <Link href="/claim/code" className="underline hover:text-page-fg">
            {t("haveCode")}
          </Link>
        </p>

        <p className="mt-4 text-center text-sm text-soft">
          <Link href="/" className="underline hover:text-page-fg">
            {t("backHome")}
          </Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
