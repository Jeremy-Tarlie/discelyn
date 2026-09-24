import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Code partageable (affiché une seule fois).
 * 16 octets → 32 hex (insensible à la casse après normalize).
 */
export function newAccessCodePlain(): string {
  return randomBytes(16).toString("hex").toUpperCase();
}

/** Normalise avant hash / comparaison. */
export function normalizeAccessCode(code: string): string {
  return code.trim().toUpperCase();
}

/** SHA-256 hex — stocké en base ; le clair n’est jamais persisté. */
export function hashAccessCode(code: string): string {
  return createHash("sha256")
    .update(normalizeAccessCode(code), "utf8")
    .digest("hex");
}

/** Préfixe affichable dans le dashboard (pas le secret complet). */
export function accessCodePrefix(code: string): string {
  const normalized = normalizeAccessCode(code);
  return normalized.slice(0, Math.min(4, normalized.length));
}

export function accessCodesEqual(a: string, b: string): boolean {
  const ha = Buffer.from(hashAccessCode(a), "utf8");
  const hb = Buffer.from(hashAccessCode(b), "utf8");
  if (ha.length !== hb.length) return false;
  return timingSafeEqual(ha, hb);
}
