import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Bot, Subscription } from "@/generated/prisma/client";
import type { PlanId } from "@/lib/plans";
import { userNeedsMfaChallenge } from "@/lib/mfa-session";

export {
  canCreateBot,
  canUseProduct,
  filterModulesForPlan,
  isSubscriptionActive,
} from "@/lib/billing-guards";

export { requireOrg, orgRoleAtLeast } from "@/lib/org-access";
export type { OrgContext } from "@/lib/org-access";

export type RequireUserOptions = {
  /** Autorise l’accès avant challenge TOTP (ex. POST /api/account/mfa/verify). */
  allowUnverifiedMfa?: boolean;
};

/** @deprecated Prefer requireOrg — conserve pour routes identité pure (leads admin). */
export async function requireUser(options?: RequireUserOptions) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return null;
  }
  const active = await prisma.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { id: true },
  });
  if (!active) return null;

  if (
    !options?.allowUnverifiedMfa &&
    (await userNeedsMfaChallenge(session.user.id))
  ) {
    return null;
  }

  return session.user;
}

export async function getOrgSubscription(
  organizationId: string
): Promise<Subscription> {
  const existing = await prisma.subscription.findUnique({
    where: { organizationId },
  });
  if (existing) return existing;

  return prisma.subscription.create({
    data: {
      organizationId,
      plan: "FREE",
      status: "ACTIVE",
    },
  });
}

/** @deprecated Prefer getOrgSubscription */
export async function getUserSubscription(
  organizationId: string
): Promise<Subscription> {
  return getOrgSubscription(organizationId);
}

export type BotWithAccess = Bot & {
  planId: PlanId;
};
