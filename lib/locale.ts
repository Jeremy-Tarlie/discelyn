import type { NextRequest } from "next/server";
import { defaultLocale, LOCALE_COOKIE, parseLocale, type Locale } from "@/i18n/config";

/** Locale from request cookie — for API routes (no RSC cookies() needed). */
export function getRequestLocale(request: NextRequest): Locale {
  return parseLocale(request.cookies.get(LOCALE_COOKIE)?.value ?? defaultLocale);
}
