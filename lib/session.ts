import type { NextRequest } from "next/server";

/** Certaines plateformes Next injectent `ip` ; absent en self-host classique. */
type NextRequestWithOptionalIp = NextRequest & { readonly ip?: string };

/**
 * IP client pour rate-limit.
 * - Si TRUST_PROXY=1 (derrière Caddy/nginx) : x-real-ip, sinon dernier hop de x-forwarded-for
 *   (Caddy append le client ; le premier hop est spoofable).
 * - Sinon : ignore les headers forwardés (évite spoof) ; utilise `ip` plateforme si présent,
 *   sinon bucket partagé `"direct"`.
 *   En prod : ne jamais exposer :3000 sans proxy + TRUST_PROXY=1.
 */
export function getClientIp(request: NextRequest): string {
  const trustProxy = process.env.TRUST_PROXY === "1";

  if (trustProxy) {
    const realIp = request.headers.get("x-real-ip")?.trim();
    if (realIp) return realIp;

    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      const parts = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
      const last = parts[parts.length - 1];
      if (last) return last;
    }
  }

  const platformIp = (request as NextRequestWithOptionalIp).ip?.trim();
  if (platformIp) return platformIp;

  return "direct";
}

export function hasSessionCookie(request: NextRequest): boolean {
  const standard = request.cookies.get("next-auth.session-token")?.value;
  const secure = request.cookies.get("__Secure-next-auth.session-token")?.value;
  const value = standard || secure;
  return Boolean(value && value.length >= 16);
}
