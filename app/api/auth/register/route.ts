import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";
import {
  registerBodySchema,
  registerCredentialsUser,
} from "@/lib/auth-credentials";
import { setPlanIntentCookieOnResponse } from "@/lib/credentials-session";
import { zodErrorIndicatesWeakPassword } from "@/lib/password-policy";
import { withOpaqueTimingFloor } from "@/lib/auth-timing";

export async function POST(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "auth-register",
    limit: 5,
    windowMs: 15 * 60_000,
  });
  if (!limited.ok) return limited.response;

  return withOpaqueTimingFloor(async () => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: tApi(locale, "invalidJson") },
        { status: 400 }
      );
    }

    const parsed = registerBodySchema.safeParse(body);
    if (!parsed.success) {
      if (zodErrorIndicatesWeakPassword(parsed.error)) {
        return NextResponse.json(
          { error: tApi(locale, "weakPassword"), code: "weak_password" },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: tApi(locale, "invalidData") },
        { status: 400 }
      );
    }

    const result = await registerCredentialsUser({
      ...parsed.data,
      locale: locale === "en" ? "en" : "fr",
    });

    if (!result.ok) {
      // Anti-enum : même JSON + même cookie que le succès (pas d’oracle Set-Cookie).
      if (result.code === "email_taken") {
        const response = NextResponse.json({
          ok: true,
          needsVerification: true,
        });
        setPlanIntentCookieOnResponse(response, {
          plan: parsed.data.plan,
          interval: parsed.data.interval,
        });
        return response;
      }
      if (result.code === "email_not_allowed") {
        return NextResponse.json(
          { error: tApi(locale, "emailNotAllowed"), code: "email_not_allowed" },
          { status: 400 }
        );
      }
      if (result.code === "mail_failed") {
        // Opaque : ne pas confirmer la création ni l’échec SMTP au client.
        const response = NextResponse.json({
          ok: true,
          needsVerification: true,
        });
        setPlanIntentCookieOnResponse(response, result.intent);
        return response;
      }

      return NextResponse.json(
        { error: tApi(locale, "invalidData") },
        { status: 400 }
      );
    }

    const response = NextResponse.json({
      ok: true,
      needsVerification: true,
    });
    setPlanIntentCookieOnResponse(response, result.intent);
    return response;
  });
}
