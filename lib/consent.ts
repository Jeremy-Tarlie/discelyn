import {
  AFFILIATE_COOKIE,
  CONSENT_COOKIE,
  CONSENT_COOKIE_MAX_AGE,
} from "@/i18n/config";

export type ConsentValue = "necessary" | "all";

export function parseConsent(value: string | undefined | null): ConsentValue | null {
  if (value === "necessary" || value === "all") return value;
  return null;
}

export function consentAllowsOptional(value: ConsentValue | null): boolean {
  return value === "all";
}

/** Server-side: optional cookies/analytics only if consent cookie is `all`. */
export function hasOptionalConsentFromCookieHeader(
  header: string | null | undefined
): boolean {
  if (!header) return false;
  const match = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CONSENT_COOKIE}=`));
  if (!match) return false;
  const raw = match.slice(CONSENT_COOKIE.length + 1);
  return parseConsent(decodeURIComponent(raw)) === "all";
}

export function readConsentFromDocument(): ConsentValue | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CONSENT_COOKIE}=`));
  if (!match) return null;
  return parseConsent(decodeURIComponent(match.split("=")[1] ?? ""));
}

function cookieSecureSuffix(): string {
  return typeof window !== "undefined" && window.location.protocol === "https:"
    ? "; Secure"
    : "";
}

export function writeConsentCookie(value: ConsentValue): void {
  document.cookie = `${CONSENT_COOKIE}=${value}; Path=/; Max-Age=${CONSENT_COOKIE_MAX_AGE}; SameSite=Lax${cookieSecureSuffix()}`;
}

/** Drop affiliate tracking cookie when optional consent is withdrawn. */
export function clearAffiliateCookie(): void {
  document.cookie = `${AFFILIATE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${cookieSecureSuffix()}`;
}

export { CONSENT_COOKIE, AFFILIATE_COOKIE };
