import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function getClientKey(request: NextRequest, namespace: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return `${namespace}:${ip}`;
}

export function rateLimit(
  request: NextRequest,
  options: { namespace: string; limit: number; windowMs: number }
): { ok: true } | { ok: false; response: NextResponse } {
  const key = getClientKey(request, options.namespace);
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return { ok: true };
  }

  if (existing.count >= options.limit) {
    const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Trop de requêtes. Réessaie plus tard." },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfter) },
        }
      ),
    };
  }

  existing.count += 1;
  buckets.set(key, existing);
  return { ok: true };
}

export function hashTokenPreview(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 10);
}
