import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Bot, Subscription } from "@/generated/prisma/client";
import type { PlanId } from "@/lib/plans";

export {
  canCreateBot,
  canUseProduct,
  filterModulesForPlan,
  isSubscriptionActive,
} from "@/lib/billing-guards";

export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return null;
  }
  return session.user;
}

export async function getUserSubscription(
  userId: string
): Promise<Subscription> {
  const existing = await prisma.subscription.findUnique({
    where: { userId },
  });
  if (existing) return existing;

  return prisma.subscription.create({
    data: {
      userId,
      plan: "FREE",
      status: "ACTIVE",
    },
  });
}

export type BotWithAccess = Bot & {
  planId: PlanId;
};
