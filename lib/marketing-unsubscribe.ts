import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { appBaseUrl } from "@/lib/access-urls";

const TTL_MS = 180 * 24 * 60 * 60 * 1000;

function unsubscribeSecret(): string | null {
  const secret =
    process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  return secret || null;
}

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64url(raw: string): Buffer | null {
  const padded = raw.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  try {
    return Buffer.from(padded + pad, "base64");
  } catch {
    return null;
  }
}

export function signUnsubscribeToken(email: string, now = Date.now()): string | null {
  const secret = unsubscribeSecret();
  if (!secret) return null;
  const normalized = email.trim().toLowerCase();
  const exp = now + TTL_MS;
  const payload = `${normalized}|${exp}`;
  const sig = createHmac("sha256", secret).update(payload).digest();
  return `${b64url(Buffer.from(payload, "utf8"))}.${b64url(sig)}`;
}

export function verifyUnsubscribeToken(
  token: string,
  now = Date.now(),
): { ok: true; email: string } | { ok: false } {
  const secret = unsubscribeSecret();
  if (!secret) return { ok: false };
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false };
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return { ok: false };
  const payloadBuf = fromB64url(payloadB64);
  const sigBuf = fromB64url(sigB64);
  if (!payloadBuf || !sigBuf) return { ok: false };
  const payload = payloadBuf.toString("utf8");
  const expected = createHmac("sha256", secret).update(payload).digest();
  if (
    expected.length !== sigBuf.length ||
    !timingSafeEqual(expected, sigBuf)
  ) {
    return { ok: false };
  }
  const [email, expRaw] = payload.split("|");
  const exp = Number(expRaw);
  if (!email || !Number.isFinite(exp) || now > exp) return { ok: false };
  return { ok: true, email: email.trim().toLowerCase() };
}

export function unsubscribeUrlFor(email: string): string | null {
  const token = signUnsubscribeToken(email);
  if (!token) return null;
  return `${appBaseUrl()}/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function unsubscribeApiUrlFor(email: string): string | null {
  const token = signUnsubscribeToken(email);
  if (!token) return null;
  return `${appBaseUrl()}/api/unsubscribe?token=${encodeURIComponent(token)}`;
}

/** Retire le consentement marketing User + Lead (même email). */
export async function revokeMarketingConsent(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  await Promise.all([
    prisma.user.updateMany({
      where: { email: normalized, deletedAt: null },
      data: { marketingConsentAt: null },
    }),
    prisma.lead.updateMany({
      where: { email: normalized },
      data: { marketingConsentAt: null },
    }),
  ]);
}
