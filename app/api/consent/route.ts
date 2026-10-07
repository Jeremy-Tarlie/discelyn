import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";
import {
  isValidVisitorId,
  normalizePreferences,
  parseConsentPreferences,
} from "@/lib/consent";
import { recordCookieConsent } from "@/lib/cookie-consent-log";

const prefsSchema = z.object({
  analytics: z.boolean(),
  sentry: z.boolean(),
  affiliate: z.boolean(),
});

const bodySchema = z.union([
  z.object({
    visitorId: z.string().uuid(),
    preferences: prefsSchema,
  }),
  // Compat bannière ancienne / tests
  z.object({
    visitorId: z.string().uuid(),
    choice: z.enum(["necessary", "all"]),
  }),
]);

export async function POST(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "cookie-consent",
    limit: 30,
    windowMs: 60_000,
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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success || !isValidVisitorId(parsed.data.visitorId)) {
    return NextResponse.json(
      { error: tApi(locale, "invalidData") },
      { status: 400 }
    );
  }

  const preferences =
    "preferences" in parsed.data
      ? normalizePreferences(parsed.data.preferences)
      : parseConsentPreferences(parsed.data.choice);

  if (!preferences) {
    return NextResponse.json(
      { error: tApi(locale, "invalidData") },
      { status: 400 }
    );
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  try {
    const log = await recordCookieConsent({
      preferences,
      visitorId: parsed.data.visitorId,
      userId,
    });
    return NextResponse.json({
      ok: true,
      id: log.id,
      choice: log.choice,
    });
  } catch (error) {
    console.error("[consent] record failed", error);
    return NextResponse.json(
      { error: tApi(locale, "invalidData") },
      { status: 500 }
    );
  }
}
