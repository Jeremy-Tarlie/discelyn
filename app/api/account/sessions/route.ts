import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";
import {
  getCurrentDbSession,
  getSessionTokenFromCookies,
} from "@/lib/mfa-session";

export async function GET(request: NextRequest) {
  const locale = getRequestLocale(request);
  const user = await requireUser();
  if (!user) {
    return NextResponse.json(
      { error: tApi(locale, "unauthenticated") },
      { status: 401 }
    );
  }

  const current = await getCurrentDbSession();
  const sessions = await prisma.session.findMany({
    where: { userId: user.id, expires: { gt: new Date() } },
    orderBy: { expires: "desc" },
    select: {
      id: true,
      expires: true,
      mfaVerifiedAt: true,
      sessionToken: true,
    },
  });

  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      expires: s.expires.toISOString(),
      mfaVerified: Boolean(s.mfaVerifiedAt),
      current: current?.id === s.id,
    })),
  });
}

export async function DELETE(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "sessions-revoke",
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

  const token = await getSessionTokenFromCookies();
  if (!token) {
    return NextResponse.json(
      { error: tApi(locale, "unauthenticated") },
      { status: 401 }
    );
  }

  const deleted = await prisma.session.deleteMany({
    where: {
      userId: user.id,
      NOT: { sessionToken: token },
    },
  });

  const { logUserActivity } = await import("@/lib/activity-log");
  await logUserActivity({
    userId: user.id,
    action: "sessions_revoked",
    meta: { revoked: deleted.count },
  });

  return NextResponse.json({ ok: true, revoked: deleted.count });
}
