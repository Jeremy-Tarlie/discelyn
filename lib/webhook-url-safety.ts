/**
 * Refuse les URLs webhook vers localhost / IP privées / metadata cloud (SSRF).
 * Valide le hostname littéral puis résout le DNS (anti nip.io / rebinding).
 */

import { promises as dns } from "node:dns";
import { getAppEnvironment } from "@/lib/demo";


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

export type WebhookDnsLookup = (hostname: string) => Promise<string[]>;

/** Résolution DNS réelle (toutes les adresses A/AAAA). */
export async function defaultWebhookDnsLookup(
  hostname: string
): Promise<string[]> {
  const results = await dns.lookup(hostname, { all: true, verbatim: true });
  return results.map((entry) => entry.address);
}

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

/** ::ffff:127.0.0.1 ou ::ffff:7f00:1 → IPv4 dotted. */
export function ipv4FromMappedIpv6(host: string): string | null {
  const dotted = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(host);
  if (dotted?.[1]) return dotted[1];

  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(host);
  if (!hex?.[1] || !hex[2]) return null;
  const hi = Number.parseInt(hex[1], 16);
  const lo = Number.parseInt(hex[2], 16);
  if (Number.isNaN(hi) || Number.isNaN(lo)) return null;
  return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
}

function isPrivateOrReservedIpv6(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "::" || h === "::1") return true;
  if (h.startsWith("fe80:")) return true; // link-local
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // ULA
  if (h.startsWith("ff")) return true; // multicast

  const mapped = ipv4FromMappedIpv6(h);
  if (mapped) return isPrivateOrReservedIpv4(mapped);

  // Prefixe ::ffff: avec forme non reconnue → refuser par prudence
  if (h.startsWith("::ffff:")) return true;

  return false;
}

function isIpLiteral(host: string): boolean {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  // IPv6 (contient : après retrait éventuel des crochets)
  return host.includes(":");
}

function isPrivateOrLocalHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith(".localhost") || host.endsWith(".local")) return true;

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return isPrivateOrReservedIpv4(host);
  }

  if (host.includes(":")) {
    return isPrivateOrReservedIpv6(host);
  }

  return false;
}

function isBlockedResolvedAddress(address: string): boolean {
  const host = address.replace(/^\[|\]$/g, "").toLowerCase();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return isPrivateOrReservedIpv4(host);
  }
  return isPrivateOrReservedIpv6(host);
}

export type SafeWebhookUrlResult =
  | { ok: true; url: string; addresses: string[] }
  | { ok: false; error: string };

type ShapeOk = { ok: true; url: string };
type ShapeResult = ShapeOk | { ok: false; error: string };

function validateOutboundWebhookUrlShape(raw: string): ShapeResult {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return { ok: false, error: "URL invalide" };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "Seuls http/https sont autorisés" };
  }

  if (getAppEnvironment() === "production" && parsed.protocol !== "https:") {
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

/**
 * Valide une URL de webhook sortant (http/https public uniquement).
 * Résout le DNS pour bloquer les hôtes publics qui pointent vers des IPs privées.
 * Retourne les adresses résolues pour un fetch piné (anti DNS rebinding).
 */
export async function validateOutboundWebhookUrl(
  raw: string,
  lookup: WebhookDnsLookup = defaultWebhookDnsLookup
): Promise<SafeWebhookUrlResult> {
  const shape = validateOutboundWebhookUrlShape(raw);
  if (!shape.ok) return shape;

  const parsed = new URL(shape.url);
  const host = parsed.hostname.replace(/^\[|\]$/g, "");

  if (isIpLiteral(host)) {
    return { ok: true, url: shape.url, addresses: [host] };
  }

  let addresses: string[];
  try {
    addresses = await lookup(host);
  } catch {
    return { ok: false, error: "Impossible de résoudre l’hôte (DNS)" };
  }

  if (addresses.length === 0) {
    return { ok: false, error: "Impossible de résoudre l’hôte (DNS)" };
  }

  for (const address of addresses) {
    if (isBlockedResolvedAddress(address)) {
      return {
        ok: false,
        error: "URL vers réseau privé / localhost refusée (SSRF)",
      };
    }
  }

  return { ok: true, url: shape.url, addresses };
}

export async function assertSafeOutboundWebhookUrl(
  raw: string,
  lookup: WebhookDnsLookup = defaultWebhookDnsLookup
): Promise<{ url: string; addresses: string[] }> {
  const result = await validateOutboundWebhookUrl(raw, lookup);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return { url: result.url, addresses: result.addresses };
}

/** Préfère IPv4 pour le pin (agents HTTP plus simples). */
export function pickPinnedAddress(addresses: string[]): string {
  const v4 = addresses.find((a) => /^\d{1,3}(\.\d{1,3}){3}$/.test(a));
  return v4 ?? addresses[0]!;
}
