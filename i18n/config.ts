export const locales = ["fr", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "fr";

export const themes = ["light", "dark"] as const;
export type Theme = (typeof themes)[number];
export const defaultTheme: Theme = "light";

export const LOCALE_COOKIE = "botly_locale";
export const CONSENT_COOKIE = "botly_consent";
export const THEME_COOKIE = "botly_theme";

export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
export const CONSENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "fr" || value === "en";
}

export function parseLocale(value: string | undefined | null): Locale {
  return isLocale(value) ? value : defaultLocale;
}

export function isTheme(value: string | undefined | null): value is Theme {
  return value === "light" || value === "dark";
}

export function parseTheme(value: string | undefined | null): Theme {
  return isTheme(value) ? value : defaultTheme;
}
