import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import Redis from "ioredis";
import { getClientIp } from "@/lib/session";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";

/**
 * Rate-limit : Redis si REDIS_URL (multi-instance), sinon mémoire process.
 */
type MemoryBucket = {
  count: number;
  resetAt: number;
};

const memoryBuckets = new Map<string, MemoryBucket>();
const MAX_BUCKETS = 10_000;

const RATE_LIMIT_LUA = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
return { current, ttl }
`;

let redisClient: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const url = process.env.REDIS_URL;
  if (!url) {
    redisClient = null;
    return null;
  }
  redisClient = new Redis(url, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    lazyConnect: true,
  });
  redisClient.on("error", (error) => {
    console.error("[rate-limit] redis error", error.message);
  });
  return redisClient;
}

function pruneMemory(now: number): void {
  if (memoryBuckets.size < MAX_BUCKETS) return;
  for (const [key, bucket] of memoryBuckets) {
    if (bucket.resetAt <= now) memoryBuckets.delete(key);
  }
  if (memoryBuckets.size >= MAX_BUCKETS) {
    const first = memoryBuckets.keys().next().value;
    if (first !== undefined) memoryBuckets.delete(first);
  }
}

function getClientKey(request: NextRequest, namespace: string): string {
  return `${namespace}:${getClientIp(request)}`;
}

function memoryLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  pruneMemory(now);
  const existing = memoryBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (existing.count >= limit) {
    return {
      ok: false,
      retryAfter: Math.ceil((existing.resetAt - now) / 1000),
    };
  }
  existing.count += 1;
  memoryBuckets.set(key, existing);
  return { ok: true };
}

async function redisLimit(
  redis: Redis,
  key: string,
  limit: number,
  windowMs: number
): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  if (redis.status !== "ready") {
    await redis.connect().catch(() => undefined);
  }
  const redisKey = `botly:rl:${key}`;
  const result = (await redis.eval(
    RATE_LIMIT_LUA,
    1,
    redisKey,
    String(windowMs)
  )) as [number, number];
  const count = Number(result[0]);
  const ttl = Number(result[1]);
  if (count > limit) {
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil(ttl / 1000)),
    };
  }
  return { ok: true };
}

export async function rateLimit(
  request: NextRequest,
  options: { namespace: string; limit: number; windowMs: number }
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const key = getClientKey(request, options.namespace);
  const redis = getRedis();

  let result: { ok: true } | { ok: false; retryAfter: number };
  if (redis) {
    try {
      result = await redisLimit(redis, key, options.limit, options.windowMs);
    } catch {
      result = memoryLimit(key, options.limit, options.windowMs);
    }
  } else {
    result = memoryLimit(key, options.limit, options.windowMs);
  }

  if (result.ok) return { ok: true };

  const locale = getRequestLocale(request);

  return {
    ok: false,
    response: NextResponse.json(
      { error: tApi(locale, "rateLimited") },
      {
        status: 429,
        headers: { "Retry-After": String(result.retryAfter) },
      }
    ),
  };
}
