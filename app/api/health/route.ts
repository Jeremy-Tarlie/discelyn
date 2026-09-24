import { NextResponse } from "next/server";
import Redis from "ioredis";
import { prisma } from "@/lib/prisma";
import { fetchPlatformBotIdentity } from "@/lib/discord";

export const dynamic = "force-dynamic";

type PlatformBotHealth =
  | { status: "ok" }
  | { status: "error" }
  | { status: "skipped" };

let platformBotCache: {
  at: number;
  value: PlatformBotHealth;
} | null = null;

async function pingPlatformBot(): Promise<PlatformBotHealth> {
  if (!process.env.DISCORD_BOT_TOKEN) return { status: "skipped" };
  const now = Date.now();
  if (platformBotCache && now - platformBotCache.at < 60_000) {
    return platformBotCache.value;
  }
  const identity = await fetchPlatformBotIdentity();
  const value: PlatformBotHealth = identity.ok
    ? { status: "ok" }
    : { status: "error" };
  platformBotCache = { at: now, value };
  return value;
}

async function pingRuntime(): Promise<{
  status: "ok" | "error" | "skipped";
  ready?: boolean;
}> {
  const baseUrl = process.env.BOT_RUNTIME_URL;
  if (!baseUrl) {
    return { status: "skipped" };
  }
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/health`, {
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) {
      return { status: "error" };
    }
    const body = (await response.json()) as { ready?: boolean };
    return {
      status: "ok",
      ready: typeof body.ready === "boolean" ? body.ready : undefined,
    };
  } catch {
    return { status: "error" };
  }
}

async function pingRedis(): Promise<"ok" | "error" | "skipped"> {
  const url = process.env.REDIS_URL;
  if (!url) return "skipped";
  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    connectTimeout: 2_000,
  });
  try {
    await client.connect();
    const pong = await client.ping();
    await client.quit();
    return pong === "PONG" ? "ok" : "error";
  } catch {
    client.disconnect();
    return "error";
  }
}

/**
 * Health read-only — pas de side-effects.
 * Ne divulgue pas la présence/absence de secrets (encryption, cron).
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const [runtime, redis, platformBot] = await Promise.all([
      pingRuntime(),
      pingRedis(),
      pingPlatformBot(),
    ]);
    const runtimeDown = runtime.status === "error";
    const redisDown = redis === "error";
    const botDown = platformBot.status === "error";
    const status =
      runtimeDown || redisDown || botDown ? "degraded" : "ok";

    return NextResponse.json(
      {
        status,
        service: "botly-web",
        db: "ok",
        redis,
        runtime: { status: runtime.status, ready: runtime.ready },
        platformBot: { status: platformBot.status },
        time: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      {
        status: "error",
        service: "botly-web",
        db: "error",
        time: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
