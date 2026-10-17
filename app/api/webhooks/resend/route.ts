import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getAppEnvironment } from "@/lib/demo";
import { revokeMarketingConsent } from "@/lib/marketing-unsubscribe";

const MAX_SVIX_AGE_SEC = 300;

const webhookSchema = z.object({
  type: z.string().min(1).max(80),
  data: z
    .object({
      email_id: z.string().max(200).optional(),
      to: z.union([z.string().email(), z.array(z.string().email())]).optional(),
      created_at: z.string().optional(),
    })
    .optional(),
});

type MappedType =
  | "opened"
  | "clicked"
  | "delivered"
  | "bounced"
  | "complained";

function mapType(raw: string): MappedType | null {
  if (raw === "email.opened" || raw.endsWith(".opened")) return "opened";
  if (raw === "email.clicked" || raw.endsWith(".clicked")) return "clicked";
  if (raw === "email.delivered" || raw.endsWith(".delivered")) return "delivered";
  if (raw === "email.bounced" || raw.endsWith(".bounced")) return "bounced";
  if (raw === "email.complained" || raw.endsWith(".complained")) {
    return "complained";
  }
  return null;
}

function secretsEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function verifySvixOrSecret(request: NextRequest, rawBody: string): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return getAppEnvironment() === "development";
  }

  const svixSignature = request.headers.get("svix-signature");
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  if (svixSignature && svixId && svixTimestamp) {
    const ts = Number(svixTimestamp);
    if (!Number.isFinite(ts)) return false;
    const ageSec = Math.abs(Math.floor(Date.now() / 1000) - ts);
    if (ageSec > MAX_SVIX_AGE_SEC) return false;

    const key = secret.startsWith("whsec_")
      ? Buffer.from(secret.slice(6), "base64")
      : Buffer.from(secret);
    const toSign = `${svixId}.${svixTimestamp}.${rawBody}`;
    const expected = createHmac("sha256", key).update(toSign).digest("base64");
    const parts = svixSignature.split(" ");
    for (const part of parts) {
      const [, sig] = part.split(",");
      if (!sig) continue;
      try {
        const a = Buffer.from(sig);
        const b = Buffer.from(expected);
        if (a.length === b.length && timingSafeEqual(a, b)) return true;
      } catch {
        // continue
      }
    }
    return false;
  }

  const bearer = request.headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) {
    if (secretsEqual(bearer.slice("Bearer ".length), secret)) return true;
  }
  const headerSecret = request.headers.get("x-resend-secret");
  if (headerSecret && secretsEqual(headerSecret, secret)) return true;
  return false;
}

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, {
    namespace: "resend-webhook",
    limit: 120,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const rawBody = await request.text();
  if (!verifySvixOrSecret(request, rawBody)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = webhookSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const type = mapType(parsed.data.type);
  if (!type) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const toRaw = parsed.data.data?.to;
  const email = Array.isArray(toRaw)
    ? toRaw[0]
    : typeof toRaw === "string"
      ? toRaw
      : null;
  if (!email) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const normalized = email.trim().toLowerCase();

  await prisma.emailEvent.create({
    data: {
      email: normalized,
      type,
      resendId: parsed.data.data?.email_id ?? null,
      meta: { webhookType: parsed.data.type },
    },
  });

  if (type === "complained") {
    await revokeMarketingConsent(normalized);
  }

  return NextResponse.json({ ok: true });
}
