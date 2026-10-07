import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { tApi } from "@/lib/i18n-api";
import type { Locale } from "@/i18n/config";
import { userNeedsMfaChallenge } from "@/lib/mfa-session";

/**
 * Réponse 401/403 après échec de requireOrg / requireUser.
 * Distingue session absente vs challenge MFA vs rôle / org insuffisant.
 *
 * `@param _fallback` conservé pour compat callers (`"unauthorized"` explicite).
 * Si une session existe, la réponse est toujours 403 unauthorized
 * (sauf mfa_required).
 */
export async function deniedAuthResponse(
  locale: Locale,
  _fallback: "unauthenticated" | "unauthorized" = "unauthenticated"
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (session?.user?.id && (await userNeedsMfaChallenge(session.user.id))) {
    return NextResponse.json(
      {
        error: tApi(locale, "mfaChallengeRequired"),
        code: "mfa_required",
      },
      { status: 403 }
    );
  }

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: tApi(locale, "unauthenticated"), code: "unauthenticated" },
      { status: 401 }
    );
  }

  return NextResponse.json(
    { error: tApi(locale, "unauthorized"), code: "unauthorized" },
    { status: 403 }
  );
}
