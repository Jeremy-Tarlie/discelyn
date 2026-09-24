import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  isLocale,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
} from "@/i18n/config";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, {
    namespace: "locale",
    limit: 30,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const locale =
    typeof body === "object" &&
    body !== null &&
    "locale" in body &&
    typeof (body as { locale: unknown }).locale === "string"
      ? (body as { locale: string }).locale
      : null;

  if (!isLocale(locale)) {
    return NextResponse.json({ error: "invalid locale" }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true, locale });
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
