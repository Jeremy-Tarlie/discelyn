import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  isTheme,
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
} from "@/i18n/config";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, {
    namespace: "theme",
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

  const theme =
    typeof body === "object" &&
    body !== null &&
    "theme" in body &&
    typeof (body as { theme: unknown }).theme === "string"
      ? (body as { theme: string }).theme
      : null;

  if (!isTheme(theme)) {
    return NextResponse.json({ error: "invalid theme" }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true, theme });
  response.cookies.set(THEME_COOKIE, theme, {
    path: "/",
    maxAge: THEME_COOKIE_MAX_AGE,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
