import { prisma } from "@/lib/prisma";

export type NotifyKind = "billing" | "security" | "product";

/** Respecte les toggles Compte avant d’envoyer un e-mail au propriétaire. */
export async function userAllowsEmailNotify(
  userId: string,
  kind: NotifyKind
): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      notifyBillingEmail: true,
      notifySecurityEmail: true,
      notifyProductEmail: true,
    },
  });
  if (!user) return false;
  if (kind === "billing") return user.notifyBillingEmail;
  if (kind === "security") return user.notifySecurityEmail;
  return user.notifyProductEmail;
}
