import { appBaseUrl } from "@/lib/learner-access";

/** Tokens claim : charset URL-safe uniquement (anti path traversal dans Location). */
const CLAIM_TOKEN_RE = /^[A-Za-z0-9_-]{8,200}$/;

export function sanitizeClaimToken(
  token: string | null | undefined
): string | null {
  if (!token || typeof token !== "string") return null;
  const trimmed = token.trim();
  if (!CLAIM_TOKEN_RE.test(trimmed)) return null;
  return trimmed;
}

export function claimPageUrl(
  token: string | null | undefined,
  query: Record<string, string>
): URL {
  const safe = sanitizeClaimToken(token) ?? "invalid";
  const url = new URL(`/claim/${encodeURIComponent(safe)}`, appBaseUrl());
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return url;
}
