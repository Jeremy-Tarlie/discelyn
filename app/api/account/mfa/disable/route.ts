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
import { deniedAuthResponse } from "@/lib/http-auth";

const bodySchema = z.object({
  code: z.string().trim().min(6).max(32),
});

export async function POST(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "mfa-disable",
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
  const recovery = totpOk
    ? null
    : verifyRecoveryCode(parsed.data.code, dbUser.totpRecoveryHashes);

  if (!totpOk && !recovery?.ok) {
    return NextResponse.json(
      { error: tApi(locale, "mfaInvalidCode") },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      totpEnabled: false,
      totpSecret: null,
      totpPendingSecret: null,
      totpRecoveryHashes: null,
      totpEnabledAt: null,
    },
  });

  await prisma.session.updateMany({
    where: { userId: user.id },
    data: { mfaVerifiedAt: null },
  });

  const { logUserActivity } = await import("@/lib/activity-log");
  await logUserActivity({ userId: user.id, action: "mfa_disabled" });

  return NextResponse.json({ ok: true });
}
