import Cookies from "js-cookie";
import {
  AFFILIATE_COOKIE,
  CONSENT_COOKIE,
  CONSENT_COOKIE_MAX_AGE,
  COOKIE_POLICY_VERSION,
  VISITOR_COOKIE,
  VISITOR_COOKIE_MAX_AGE,
} from "@/i18n/config";

/** @deprecated Prefer ConsentPreferences — conservé pour logs / API legacy. */
export type ConsentValue = "necessary" | "all";

export type ConsentPreferences = {
  analytics: boolean;
  sentry: boolean;
  affiliate: boolean;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const EMPTY_CONSENT: ConsentPreferences = {
  analytics: false,
  sentry: false,
  affiliate: false,
};

export const FULL_CONSENT: ConsentPreferences = {
  analytics: true,
  sentry: true,
  affiliate: true,
};

export function isValidVisitorId(value: string | undefined | null): boolean {
  return typeof value === "string" && UUID_RE.test(value);
}

export function normalizePreferences(
  input: Partial<ConsentPreferences> | null | undefined
): ConsentPreferences {
  return {
    analytics: Boolean(input?.analytics),
    sentry: Boolean(input?.sentry),
    affiliate: Boolean(input?.affiliate),
  };
}

export function preferencesEqual(
  a: ConsentPreferences,
  b: ConsentPreferences
): boolean {
  return (
    a.analytics === b.analytics &&
    a.sentry === b.sentry &&
    a.affiliate === b.affiliate
  );
}

/** Sérialise pour le cookie discelyn_consent (+ journal). */
export function serializeConsent(prefs: ConsentPreferences): string {
  const n = normalizePreferences(prefs);
  if (preferencesEqual(n, EMPTY_CONSENT)) return "necessary";
  if (preferencesEqual(n, FULL_CONSENT)) return "all";
  return `v2.${JSON.stringify(n)}`;
}

/**
 * Parse cookie / payload consent.
 * Compat : `necessary` | `all` | `v2.{...}`.
 */
export function parseConsentPreferences(
  value: string | undefined | null
): ConsentPreferences | null {
  if (!value) return null;
  const raw = value.trim();
  if (raw === "necessary") return { ...EMPTY_CONSENT };
  if (raw === "all") return { ...FULL_CONSENT };
  if (raw.startsWith("v2.")) {
    try {
      const parsed = JSON.parse(raw.slice(3)) as Partial<ConsentPreferences>;
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        return null;
      }
      return normalizePreferences(parsed);
    } catch {
      return null;
    }
  }
  return null;
}

/** @deprecated Use parseConsentPreferences. */
export function parseConsent(
  value: string | undefined | null
): ConsentValue | null {
  const prefs = parseConsentPreferences(value);
  if (!prefs) return null;
  if (preferencesEqual(prefs, EMPTY_CONSENT)) return "necessary";
  if (preferencesEqual(prefs, FULL_CONSENT)) return "all";
  return null;
}

export function consentAllowsOptional(
  value: ConsentValue | ConsentPreferences | null
): boolean {
  if (!value) return false;
  if (typeof value === "string") return value === "all";
  return value.analytics || value.sentry || value.affiliate;
}

export function allowsAnalytics(
  prefs: ConsentPreferences | null | undefined
): boolean {
  return Boolean(prefs?.analytics);
}

export function allowsSentry(
  prefs: ConsentPreferences | null | undefined
): boolean {
  return Boolean(prefs?.sentry);
}

export function allowsAffiliate(
  prefs: ConsentPreferences | null | undefined
): boolean {
  return Boolean(prefs?.affiliate);
}

function readConsentRawFromHeader(
  header: string | null | undefined
): string | null {
  if (!header) return null;
  const match = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CONSENT_COOKIE}=`));
  if (!match) return null;
  return decodeURIComponent(match.slice(CONSENT_COOKIE.length + 1));
}

export function parseConsentPreferencesFromCookieHeader(
  header: string | null | undefined
): ConsentPreferences | null {
  return parseConsentPreferences(readConsentRawFromHeader(header));
}

/** Affiliate cookie only if affiliate category consented. */
export function hasOptionalConsentFromCookieHeader(
  header: string | null | undefined
): boolean {
  return allowsAffiliate(parseConsentPreferencesFromCookieHeader(header));
}

function cookieAttrs(maxAgeSeconds: number): Cookies.CookieAttributes {
  return {
    path: "/",
    expires: maxAgeSeconds / (60 * 60 * 24),
    sameSite: "lax",
    secure:
      typeof window !== "undefined" && window.location.protocol === "https:",
  };
}

export function readConsentFromDocument(): ConsentPreferences | null {
  if (typeof document === "undefined") return null;
  return parseConsentPreferences(Cookies.get(CONSENT_COOKIE));
}

export function writeConsentCookie(prefs: ConsentPreferences): void {
  Cookies.set(
    CONSENT_COOKIE,
    serializeConsent(prefs),
    cookieAttrs(CONSENT_COOKIE_MAX_AGE)
  );
}

/** Drop affiliate tracking cookie when affiliate consent is withdrawn. */
export function clearAffiliateCookie(): void {
  Cookies.remove(AFFILIATE_COOKIE, { path: "/" });
}

export function readVisitorIdFromDocument(): string | null {
  if (typeof document === "undefined") return null;
  const raw = Cookies.get(VISITOR_COOKIE);
  return isValidVisitorId(raw) ? raw! : null;
}

/** Crée ou renvoie l’UUID visiteur stable (discelyn_cid). */
export function ensureVisitorId(): string {
  const existing = readVisitorIdFromDocument();
  if (existing) return existing;
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
  Cookies.set(VISITOR_COOKIE, id, cookieAttrs(VISITOR_COOKIE_MAX_AGE));
  return id;
}

export {
  CONSENT_COOKIE,
  AFFILIATE_COOKIE,
  VISITOR_COOKIE,
  COOKIE_POLICY_VERSION,
};
