import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hasSessionCookie } from "@/lib/session";
import {
  defaultLocale,
  defaultTheme,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
} from "@/i18n/config";

function ensureDefaultCookies(response: NextResponse, request: NextRequest) {
  if (!request.cookies.get(LOCALE_COOKIE)?.value) {
    response.cookies.set(LOCALE_COOKIE, defaultLocale, {
      path: "/",
      maxAge: LOCALE_COOKIE_MAX_AGE,
      sameSite: "lax",
    });
  }
  if (!request.cookies.get(THEME_COOKIE)?.value) {
    response.cookies.set(THEME_COOKIE, defaultTheme, {
      path: "/",
      maxAge: THEME_COOKIE_MAX_AGE,
      sameSite: "lax",
    });
  }
}

/**
 * Edge proxy (Next.js 16) :
 * - cookies locale / thème par défaut s’ils manquent ;
 * - gate dashboard via cookie session (validité réelle dans layout).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/dashboard")) {
    if (!hasSessionCookie(request)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      const redirect = NextResponse.redirect(loginUrl);
      ensureDefaultCookies(redirect, request);
      return redirect;
    }
  }

  const response = NextResponse.next();
  ensureDefaultCookies(response, request);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
