import { prisma } from "@/lib/prisma";
import { unsealToken } from "@/lib/token-crypto";
import { verifyRecoveryCode, verifyTotpCode } from "@/lib/totp";

export type VerifyUserMfaResult =
  | { ok: true; usedRecovery: boolean; remainingRecoveryHashes: string[] | null }
  | { ok: false; reason: "not_enabled" | "invalid" };

/**
 * Vérifie un code TOTP ou de récupération pour un user (step-up).
 * Si recovery utilisé : met à jour totpRecoveryHashes.
 */
export async function verifyUserMfaCode(
  userId: string,
  code: string
): Promise<VerifyUserMfaResult> {
  const dbUser = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      totpEnabled: true,
      totpSecret: true,
      totpRecoveryHashes: true,
    },
  });

  if (!dbUser?.totpEnabled || !dbUser.totpSecret) {
    return { ok: false, reason: "not_enabled" };
  }

  const secret = unsealToken(dbUser.totpSecret);
  if (secret && verifyTotpCode(secret, code)) {
    return { ok: true, usedRecovery: false, remainingRecoveryHashes: null };
  }

  const recovery = verifyRecoveryCode(code, dbUser.totpRecoveryHashes);
  if (!recovery.ok) {
    return { ok: false, reason: "invalid" };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      totpRecoveryHashes:
        recovery.remainingHashes.length > 0
          ? JSON.stringify(recovery.remainingHashes)
          : null,
    },
  });

  return {
    ok: true,
    usedRecovery: true,
    remainingRecoveryHashes:
      recovery.remainingHashes.length > 0 ? recovery.remainingHashes : null,
  };
}
