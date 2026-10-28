import disposableDomains from "disposable-email-domains";
import { getAppEnvironment } from "@/lib/demo";

const disposableSet = new Set(
  (disposableDomains as string[]).map((d) => d.toLowerCase())
);

/** Normalise pour stockage : trim + lowercase. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Domaine utilisé pour le check disposable : strip le tag `+alias`
 * (user+tag@domain → domain), sans modifier l’email stocké.
 */
export function emailDomainForDisposableCheck(email: string): string | null {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at === normalized.length - 1) return null;
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) {
    return null;
  }
  // local unused except to validate shape; +alias stripped conceptually on domain check only
  void local;
  return domain;
}

/**
 * Local-part sans `+alias` — pour tests / éventuelle normalisation future.
 * Le check disposable ne regarde que le domaine.
 */
export function stripPlusAlias(email: string): string {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf("@");
  if (at <= 0) return normalized;
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  const plus = local.indexOf("+");
  const cleanLocal = plus >= 0 ? local.slice(0, plus) : local;
  return `${cleanLocal}@${domain}`;
}

export function isDisposableEmailDomain(email: string): boolean {
  const domain = emailDomainForDisposableCheck(email);
  if (!domain) return false;
  return disposableSet.has(domain);
}

/**
 * En production uniquement : refuse les domaines jetables.
 * Dev/staging : autorisé (tests).
 */
export function assertEmailAllowedInProduction(
  email: string
): { ok: true } | { ok: false; code: "email_not_allowed" } {
  if (getAppEnvironment() !== "production") {
    return { ok: true };
  }
  if (isDisposableEmailDomain(email)) {
    return { ok: false, code: "email_not_allowed" };
  }
  return { ok: true };
}
