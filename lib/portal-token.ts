import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_SEC = 60 * 60; // 1 h

function portalSecret(): string | null {
  return (
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    null
  );
}

/**
 * Preuve courte durée pour ouvrir le portail Stripe apprenant sans
 * checkoutSessionId (prévisible) ni claimToken (effacé après ACTIVE).
 * Format: accessId.exp.sig (base64url).
 */
export function mintLearnerPortalToken(accessId: string, now = Date.now()): string | null {
  const secret = portalSecret();
  if (!secret || !accessId) return null;
  const exp = Math.floor(now / 1000) + TTL_SEC;
  const payload = `${accessId}.${exp}`;
  const sig = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyLearnerPortalToken(
  token: string,
  now = Date.now()
): string | null {
  const secret = portalSecret();
  if (!secret) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [accessId, expRaw, sig] = parts;
  if (!accessId || !expRaw || !sig) return null;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Math.floor(now / 1000)) return null;
  const payload = `${accessId}.${expRaw}`;
  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return accessId;
}
