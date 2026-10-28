import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/access";
import { isLeadsAdmin } from "@/lib/leads-admin";

/**
 * Admin plateforme (`/admin`).
 * Même allowlist que leads : PLATFORM_ADMIN_* puis LEADS_ADMIN_*.
 */
export function isPlatformAdmin(input: {
  email?: string | null;
  discordId?: string | null;
}): boolean {
  return isLeadsAdmin(input);
}

export async function requirePlatformAdmin(): Promise<{
  id: string;
  email?: string | null;
  discordId: string | null;
} | null> {
  const user = await requireUser();
  if (!user?.id) return null;

  const dbUser = await prisma.user.findFirst({
    where: { id: user.id, deletedAt: null },
    select: { id: true, email: true, discordId: true },
  });
  if (!dbUser) return null;

  if (
    !isPlatformAdmin({
      email: dbUser.email,
      discordId: dbUser.discordId,
    })
  ) {
    return null;
  }

  return {
    id: dbUser.id,
    email: dbUser.email,
    discordId: dbUser.discordId,
  };
}
