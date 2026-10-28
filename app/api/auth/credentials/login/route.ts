import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";
import {
  loginBodySchema,
  loginCredentialsUser,
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
import { safeAuthCallbackUrl } from "@/lib/auth-callback";

export async function POST(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "auth-credentials-login",
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

  const parsed = loginBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: tApi(locale, "invalidCredentials"), code: "invalid_credentials" },
      { status: 401 }
    );
  }

  const result = await loginCredentialsUser(parsed.data);
  if (!result.ok) {
    // Anti-enum : même 401 pour mauvais MDP, compte absent, ou e-mail non vérifié.
    return NextResponse.json(
      { error: tApi(locale, "invalidCredentials"), code: "invalid_credentials" },
      { status: 401 }
    );
  }


  const { sessionToken, expires } = await createDatabaseSessionForUser(
    result.userId
  );
  await logUserActivity({ userId: result.userId, action: "login" });

  const intent = parsePlanIntentCookie(
    request.cookies.get(PLAN_INTENT_COOKIE)?.value
  );
  let redirectTo = parsed.data.callbackUrl
    ? safeAuthCallbackUrl(parsed.data.callbackUrl)
    : resolvePostAuthRedirect(intent);

  // Nouvelle session : mfaVerifiedAt est toujours null — checker totpEnabled.
  const totpUser = await prisma.user.findFirst({
    where: { id: result.userId, deletedAt: null },
    select: { totpEnabled: true },
  });
  if (totpUser?.totpEnabled) {
    redirectTo = "/login/mfa";
  }

  const response = NextResponse.json({ ok: true, redirectTo });
  setSessionCookieOnResponse(response, sessionToken, expires);
  if (intent) clearPlanIntentCookieOnResponse(response);
  return response;
}
