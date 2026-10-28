import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
  type Locale,
  type Theme,
} from "@/i18n/config";
import { hasConsentChoiceFromDocument } from "@/lib/consent";

const THEME_STORAGE_KEY = "discelyn_theme_pref";
const LOCALE_STORAGE_KEY = "discelyn_locale_pref";

function writeBrowserCookie(
  name: string,
  value: string,
  maxAge: number
): void {
  if (typeof document === "undefined") return;
  const secure =
    window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

function clearBrowserCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/** Supprime langue/thème cookies (ex. avant tout consentement). */
export function clearPreferenceCookies(): void {
  clearBrowserCookie(LOCALE_COOKIE);
  clearBrowserCookie(THEME_COOKIE);
}

export function readThemeFromStorage(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return raw === "light" || raw === "dark" ? raw : null;
  } catch {
    return null;
  }
}

export function writeThemeToStorage(theme: Theme): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* private mode */
  }
}

export function readLocaleFromStorage(): Locale | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return raw === "fr" || raw === "en" ? raw : null;
  } catch {
    return null;
  }
}

export function writeLocaleToStorage(locale: Locale): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* private mode */
  }
}

/**
 * Cookie langue seulement si consentement déjà choisi.
 * Sinon → localStorage uniquement.
 */
export function writeLocalePreferenceCookie(locale: Locale): boolean {
  writeLocaleToStorage(locale);
  if (!hasConsentChoiceFromDocument()) return false;
  writeBrowserCookie(LOCALE_COOKIE, locale, LOCALE_COOKIE_MAX_AGE);
  return true;
}

/**
 * Cookie thème seulement si consentement déjà choisi.
 * Sinon → localStorage uniquement.
 */
export function writeThemePreferenceCookie(theme: Theme): boolean {
  writeThemeToStorage(theme);
  if (!hasConsentChoiceFromDocument()) return false;
  writeBrowserCookie(THEME_COOKIE, theme, THEME_COOKIE_MAX_AGE);
  return true;
}

/** Après acceptation cookies : pousse les prefs localStorage vers cookies. */
export function syncPreferenceCookiesFromStorage(): void {
  if (!hasConsentChoiceFromDocument()) return;
  const theme = readThemeFromStorage();
  if (theme) writeBrowserCookie(THEME_COOKIE, theme, THEME_COOKIE_MAX_AGE);
  const locale = readLocaleFromStorage();
  if (locale) writeBrowserCookie(LOCALE_COOKIE, locale, LOCALE_COOKIE_MAX_AGE);
}
