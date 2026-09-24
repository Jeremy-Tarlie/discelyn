import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { grantPendingOnJoin } from "@/lib/learner-access";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const bodySchema = z.object({
  guildId: z.string().regex(/^\d{17,20}$/),
  discordUserId: z.string().regex(/^\d{17,20}$/),
});

function authorizeRuntime(request: NextRequest): boolean {
  const secret = process.env.BOT_RUNTIME_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) return false;
  const provided = header.slice("Bearer ".length);
  const expected = Buffer.from(secret, "utf8");
  const actual = Buffer.from(provided, "utf8");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

/**
 * Source unique de grant-on-join (runtime → web).
 * Pas de fallback Discord.js côté runtime.
 */
export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, {
    namespace: "internal-learner-join",
    limit: 120,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  if (!authorizeRuntime(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const granted = await grantPendingOnJoin({
    guildId: parsed.data.guildId,
    discordUserId: parsed.data.discordUserId,
  });

  return NextResponse.json({ granted });
}
