import {
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

export function readConsentFromDocument(): ConsentValue | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CONSENT_COOKIE}=`));
  if (!match) return null;
  return parseConsent(decodeURIComponent(match.split("=")[1] ?? ""));
}

export function writeConsentCookie(value: ConsentValue): void {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${CONSENT_COOKIE}=${value}; Path=/; Max-Age=${CONSENT_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

export { CONSENT_COOKIE };
