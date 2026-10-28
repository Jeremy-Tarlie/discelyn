import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";
import {
  verifyCredentialsEmail,
  verifyEmailBodySchema,
} from "@/lib/auth-credentials";
import {
  clearPlanIntentCookieOnResponse,
  createDatabaseSessionForUser,
  parsePlanIntentCookie,
  PLAN_INTENT_COOKIE,
  resolvePostAuthRedirect,
  setSessionCookieOnResponse,
} from "@/lib/credentials-session";
import { prisma } from "@/lib/prisma";
import { logUserActivity } from "@/lib/activity-log";

export async function POST(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "auth-verify-email",
    limit: 10,
    windowMs: 15 * 60_000,
  });
  if (!limited.ok) return limited.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: tApi(locale, "invalidJson") },
      { status: 400 }
    );
  }

  const parsed = verifyEmailBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: tApi(locale, "invalidVerifyToken"), code: "invalid_token" },
      { status: 400 }
    );
  }

  const result = await verifyCredentialsEmail(parsed.data);
  if (!result.ok) {
    // Opaque : token invalide / expiré / déjà consommé / déjà vérifié.
    return NextResponse.json(
      { error: tApi(locale, "invalidVerifyToken"), code: "invalid_token" },
      { status: 400 }
    );
  }



  const { sessionToken, expires } = await createDatabaseSessionForUser(
    result.userId
  );
  await logUserActivity({ userId: result.userId, action: "login" });

  const intent = parsePlanIntentCookie(
    request.cookies.get(PLAN_INTENT_COOKIE)?.value
  );
  let redirectTo = resolvePostAuthRedirect(intent);
  const totpUser = await prisma.user.findFirst({
    where: { id: result.userId, deletedAt: null },
    select: { totpEnabled: true },
  });
  if (totpUser?.totpEnabled) {
    redirectTo = "/login/mfa";
  }

  const response = NextResponse.json({ ok: true, redirectTo });
  setSessionCookieOnResponse(response, sessionToken, expires);
  clearPlanIntentCookieOnResponse(response);
  return response;
}
