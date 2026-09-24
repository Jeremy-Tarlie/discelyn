/**
 * Refuse les URLs webhook vers localhost / IP privées / metadata cloud (SSRF).
 */

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "metadata.google.internal",
  "metadata.google",
]);

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    n = (n << 8) + octet;
  }
  return n >>> 0;
}

function isPrivateOrReservedIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return false;
  // Comparaisons en unsigned (>>> 0) — les masques 0xff… sont négatifs en Int32 JS.
  const u = n >>> 0;
  if (u <= 0x00ffffff) return true; // 0.0.0.0/8
  if ((u & 0xff000000) >>> 0 === 0x0a000000) return true; // 10/8
  if ((u & 0xff000000) >>> 0 === 0x7f000000) return true; // 127/8
  if ((u & 0xffff0000) >>> 0 === 0xa9fe0000) return true; // 169.254/16
  if ((u & 0xfff00000) >>> 0 === 0xac100000) return true; // 172.16/12
  if ((u & 0xffff0000) >>> 0 === 0xc0a80000) return true; // 192.168/16
  if ((u & 0xffc00000) >>> 0 === 0x64400000) return true; // 100.64/10
  if ((u & 0xf0000000) >>> 0 === 0xe0000000) return true; // multicast+
  if (u === 0xffffffff) return true;
  return false;
}

function isPrivateOrLocalHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host.includes(":")) {
    // IPv6 literal — block loopback / link-local / ULA
    if (
      host === "::1" ||
      host.startsWith("fe80:") ||
      host.startsWith("fc") ||
      host.startsWith("fd") ||
      host.startsWith("::ffff:127.") ||
      host.startsWith("::ffff:10.") ||
      host.startsWith("::ffff:192.168.")
    ) {
      return true;
    }
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) && isPrivateOrReservedIpv4(host)) {
    return true;
  }
  return false;
}

export type SafeWebhookUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/** Valide une URL de webhook sortant (http/https public uniquement). */
export function validateOutboundWebhookUrl(raw: string): SafeWebhookUrlResult {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return { ok: false, error: "URL invalide" };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "Seuls http/https sont autorisés" };
  }

  // En prod on préfère HTTPS ; http reste OK pour tunnels de dev connus (ngrok etc.)
  if (
    process.env.APP_ENV === "production" &&
    parsed.protocol !== "https:"
  ) {
    return { ok: false, error: "HTTPS obligatoire en production" };
  }

  if (!parsed.hostname) {
    return { ok: false, error: "Hôte manquant" };
  }

  if (isPrivateOrLocalHostname(parsed.hostname)) {
    return {
      ok: false,
      error: "URL vers réseau privé / localhost refusée (SSRF)",
    };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, error: "Credentials dans l’URL refusés" };
  }

  return { ok: true, url: parsed.toString() };
}

export function assertSafeOutboundWebhookUrl(raw: string): string {
  const result = validateOutboundWebhookUrl(raw);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.url;
}
