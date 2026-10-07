import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";
import { sealToken, unsealToken } from "@/lib/token-crypto";
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  verifyTotpCode,
} from "@/lib/totp";
import { markCurrentSessionMfaVerified } from "@/lib/mfa-session";
import { deniedAuthResponse } from "@/lib/http-auth";

const bodySchema = z.object({
  code: z.string().trim().min(6).max(12),
});

export async function POST(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "mfa-enable",
    limit: 10,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const user = await requireUser();
  if (!user) {
    return deniedAuthResponse(locale);
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
      totpPendingSecret: true,
    },
  });
  if (!dbUser) {
    return NextResponse.json(
      { error: tApi(locale, "unauthenticated") },
      { status: 401 }
    );
  }
  if (dbUser.totpEnabled) {
    return NextResponse.json(
      { error: tApi(locale, "mfaAlreadyEnabled") },
      { status: 409 }
    );
  }
  if (!dbUser.totpPendingSecret) {
    return NextResponse.json(
      { error: tApi(locale, "mfaSetupRequired") },
      { status: 400 }
    );
  }

  const secret = unsealToken(dbUser.totpPendingSecret);
  if (!secret || !verifyTotpCode(secret, parsed.data.code)) {
    return NextResponse.json(
      { error: tApi(locale, "mfaInvalidCode") },
      { status: 400 }
    );
  }

  const recoveryCodes = generateRecoveryCodes();
  const recoveryHashes = recoveryCodes.map(hashRecoveryCode);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      totpEnabled: true,
      totpSecret: sealToken(secret) ?? secret,
      totpPendingSecret: null,
      totpRecoveryHashes: JSON.stringify(recoveryHashes),
      totpEnabledAt: new Date(),
    },
  });

  await markCurrentSessionMfaVerified(user.id);

  const { logUserActivity } = await import("@/lib/activity-log");
  await logUserActivity({ userId: user.id, action: "mfa_enabled" });

  return NextResponse.json({ ok: true, recoveryCodes });
}
