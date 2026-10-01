import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";
import { sealToken } from "@/lib/token-crypto";
import {
  buildOtpAuthUrl,
  generateTotpSecret,
} from "@/lib/totp";

export async function POST(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "mfa-setup",
    limit: 10,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const user = await requireUser();
  if (!user) {
    return NextResponse.json(
      { error: tApi(locale, "unauthenticated") },
      { status: 401 }
    );
  }

  const dbUser = await prisma.user.findFirst({
    where: { id: user.id, deletedAt: null },
    select: { email: true, name: true, totpEnabled: true },
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

  const secret = generateTotpSecret();
  const sealed = sealToken(secret);
  await prisma.user.update({
    where: { id: user.id },
    data: { totpPendingSecret: sealed ?? secret },
  });

  const accountName = dbUser.email ?? dbUser.name ?? user.id;
  const otpauthUrl = buildOtpAuthUrl({ secret, accountName });

  return NextResponse.json({
    secret,
    otpauthUrl,
  });
}
