import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";
import {
  resetCredentialsPassword,
  resetPasswordBodySchema,
} from "@/lib/auth-credentials";
import { zodErrorIndicatesWeakPassword } from "@/lib/password-policy";

export async function POST(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "auth-reset-password",
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

  const parsed = resetPasswordBodySchema.safeParse(body);
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

  const result = await resetCredentialsPassword(parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { error: tApi(locale, "invalidResetToken"), code: "invalid_token" },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
