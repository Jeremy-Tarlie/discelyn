import Image from "next/image";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRequestTheme } from "@/lib/theme";
import { getOrgSubscription } from "@/lib/access";
import type { PlanId } from "@/lib/plans";
import { MfaSettingsPanel } from "@/components/dashboard/MfaSettingsPanel";
import { SessionsPanel } from "@/components/dashboard/SessionsPanel";
import { GdprActions } from "@/components/dashboard/GdprActions";
import { BillingPanels } from "@/components/dashboard/BillingPanels";
import { PreferencesPanel } from "@/components/dashboard/PreferencesPanel";
import { NotificationPrefsPanel } from "@/components/dashboard/NotificationPrefsPanel";
import { OrgSummaryPanel } from "@/components/dashboard/OrgSummaryPanel";
import { ActivityLogPanel } from "@/components/dashboard/ActivityLogPanel";

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const organizationId = session.user.organizationId;
  if (!organizationId) redirect("/login");

  const t = await getTranslations("dashboard");
  const theme = await getRequestTheme();

  const [user, org, subscription, stripeConfig, botCount, memberCount] =
    await Promise.all([
      prisma.user.findFirst({
        where: { id: session.user.id, deletedAt: null },
        select: {
          name: true,
          email: true,
          image: true,
          discordId: true,
          totpEnabled: true,
          timezone: true,
          notifyBillingEmail: true,
          notifySecurityEmail: true,
          notifyProductEmail: true,
        },
      }),
      prisma.organization.findFirst({
        where: { id: organizationId, deletedAt: null },
        select: { name: true },
      }),
      getOrgSubscription(organizationId),
      prisma.orgStripeConfig.findUnique({
        where: { organizationId },
        select: { id: true },
      }),
      prisma.bot.count({
        where: { organizationId, deletedAt: null },
      }),
      prisma.organizationMembership.count({
        where: { organizationId },
      }),
    ]);

  if (!user || !org) redirect("/login");

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-3xl text-page-fg">{t("accountTitle")}</h1>
        <p className="mt-2 text-soft">{t("accountIntro")}</p>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="font-display text-xl text-page-fg">{t("accountProfile")}</h2>
        <div className="mt-4 flex items-center gap-4">
          {user.image ? (
            <Image
              src={user.image}
              alt=""
              width={56}
              height={56}
              className="rounded-full"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#5865F2] font-display text-lg text-white">
              {(user.name ?? "?").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-medium text-page-fg">
              {user.name ?? t("accountNoName")}
            </p>
            <p className="text-sm text-soft">
              {user.email ?? t("accountNoEmail")}
            </p>
            {user.discordId ? (
              <p className="mt-1 text-xs text-soft">
                Discord ID · {user.discordId}
              </p>
            ) : null}
          </div>
        </div>
        <p className="mt-4 text-sm text-soft">{t("accountDiscordHint")}</p>
      </section>

      <OrgSummaryPanel
        orgName={org.name}
        role={session.user.orgRole ?? "MEMBER"}
        planId={subscription.plan as PlanId}
        stripeConfigured={Boolean(stripeConfig)}
        botCount={botCount}
        memberCount={memberCount}
      />

      <PreferencesPanel theme={theme} timezone={user.timezone} />

      <NotificationPrefsPanel
        initial={{
          notifyBillingEmail: user.notifyBillingEmail,
          notifySecurityEmail: user.notifySecurityEmail,
          notifyProductEmail: user.notifyProductEmail,
        }}
      />

      <MfaSettingsPanel enabled={user.totpEnabled} />
      <SessionsPanel />
      <ActivityLogPanel />

      <BillingPanels organizationId={organizationId} showHeading />

      <GdprActions />
    </div>
  );
}
