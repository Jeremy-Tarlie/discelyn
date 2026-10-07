import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";
import { unsealToken } from "@/lib/token-crypto";
import { verifyRecoveryCode, verifyTotpCode } from "@/lib/totp";
import { markCurrentSessionMfaVerified } from "@/lib/mfa-session";

const bodySchema = z.object({
  code: z.string().trim().min(6).max(32),
});

export async function POST(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "mfa-verify",
    limit: 10,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const user = await requireUser({ allowUnverifiedMfa: true });
  if (!user) {
    return NextResponse.json(
      { error: tApi(locale, "unauthenticated") },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: tApi(locale, "invalidJson") },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: tApi(locale, "mfaInvalidCode") },
      { status: 400 }
    );
  }

  const dbUser = await prisma.user.findFirst({
    where: { id: user.id, deletedAt: null },
    select: {
      totpEnabled: true,
      totpSecret: true,
      totpRecoveryHashes: true,
    },
  });
  if (!dbUser?.totpEnabled || !dbUser.totpSecret) {
    return NextResponse.json(
      { error: tApi(locale, "mfaNotEnabled") },
      { status: 400 }
    );
  }

  const secret = unsealToken(dbUser.totpSecret);
  const totpOk = secret ? verifyTotpCode(secret, parsed.data.code) : false;

  if (totpOk) {
    const marked = await markCurrentSessionMfaVerified(user.id);
    if (!marked) {
      return NextResponse.json(
        { error: tApi(locale, "mfaVerifyFailed") },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  const recovery = verifyRecoveryCode(
    parsed.data.code,
    dbUser.totpRecoveryHashes
  );
  if (!recovery.ok) {
    return NextResponse.json(
      { error: tApi(locale, "mfaInvalidCode") },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      totpRecoveryHashes:
        recovery.remainingHashes.length > 0
          ? JSON.stringify(recovery.remainingHashes)
          : null,
    },
  });

  const marked = await markCurrentSessionMfaVerified(user.id);
  if (!marked) {
    return NextResponse.json(
      { error: tApi(locale, "mfaVerifyFailed") },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    recoveryCodesLeft: recovery.remainingHashes.length,
  });
}
