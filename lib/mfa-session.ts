import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function getSessionTokenFromCookies(): Promise<string | null> {
  const jar = await cookies();
  return (
    jar.get("__Secure-next-auth.session-token")?.value ??
    jar.get("next-auth.session-token")?.value ??
    null
  );
}

export async function getCurrentDbSession() {
  const token = await getSessionTokenFromCookies();
  if (!token) return null;
  return prisma.session.findUnique({
    where: { sessionToken: token },
    select: {
      id: true,
      sessionToken: true,
      userId: true,
      expires: true,
      mfaVerifiedAt: true,
    },
  });
}

export async function markCurrentSessionMfaVerified(
  userId: string
): Promise<boolean> {
  const token = await getSessionTokenFromCookies();
  if (!token) return false;
  const updated = await prisma.session.updateMany({
    where: { sessionToken: token, userId },
    data: { mfaVerifiedAt: new Date() },
  });
  return updated.count > 0;
}

export async function userNeedsMfaChallenge(userId: string): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { totpEnabled: true },
  });
  if (!user?.totpEnabled) return false;

  const session = await getCurrentDbSession();
  if (!session || session.userId !== userId) return true;
  return session.mfaVerifiedAt == null;
}
