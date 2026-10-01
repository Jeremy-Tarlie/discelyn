import { prisma } from "@/lib/prisma";

/**
 * OWNER : 2FA obligatoire pour les actions sensibles (billing SaaS, équipe, secrets).
 * Retourne true si MFA activée, false sinon (appelant → 403).
 */
export async function ownerHasMfaEnabled(userId: string): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { totpEnabled: true },
  });
  return Boolean(user?.totpEnabled);
}
