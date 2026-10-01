import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrgSubscription } from "@/lib/access";
import { getPlan, type PlanId } from "@/lib/plans";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { isLeadsAdmin } from "@/lib/leads-admin";
import { prisma } from "@/lib/prisma";
import { userNeedsMfaChallenge } from "@/lib/mfa-session";
import { PastDueBanner } from "@/components/dashboard/PastDueBanner";
import { OwnerMfaBanner } from "@/components/dashboard/OwnerMfaBanner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (await userNeedsMfaChallenge(session.user.id)) {
    redirect("/login/mfa");
  }

  const dbUser = await prisma.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { discordId: true, totpEnabled: true },
  });
  if (!dbUser) {
    redirect("/login");
  }

  const organizationId = session.user.organizationId;
  if (!organizationId) {
    redirect("/login");
  }

  const subscription = await getOrgSubscription(organizationId);
  const plan = getPlan(subscription.plan as PlanId);
  const isOwner = session.user.orgRole === "OWNER";

  return (
    <div className="min-h-screen md:flex">
      <DashboardNav
        planName={plan.name}
        showLeads={isLeadsAdmin({
          email: session.user.email,
          discordId: dbUser.discordId,
        })}
      />
      <div className="flex-1 px-6 py-8 md:px-10">
        <PastDueBanner status={subscription.status} />
        <OwnerMfaBanner isOwner={isOwner} mfaEnabled={dbUser.totpEnabled} />
        {children}
      </div>
    </div>
  );
}
