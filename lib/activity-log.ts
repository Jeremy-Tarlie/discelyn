import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export type ActivityAction =
  | "mfa_enabled"
  | "mfa_disabled"
  | "mfa_recovery_regenerated"
  | "sessions_revoked"
  | "plan_changed"
  | "prefs_updated"
  | "login";

export async function logUserActivity(input: {
  userId: string;
  action: ActivityAction | string;
  meta?: Record<string, string | number | boolean | null>;
}): Promise<void> {
  try {
    await prisma.userActivityLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        meta: (input.meta ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (error) {
    console.error("[activity] log failed", error);
  }
}

export async function listUserActivity(userId: string, take = 30) {
  return prisma.userActivityLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      action: true,
      meta: true,
      createdAt: true,
    },
  });
}
