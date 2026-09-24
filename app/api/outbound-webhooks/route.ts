import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  requireUser,
  getUserSubscription,
  canUseProduct,
} from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { outboundWebhookSchemaFor } from "@/lib/access-validation";
import { newOutboundWebhookSecret } from "@/lib/outbound-webhooks";
import { listOutboundWebhooksForUser } from "@/lib/dashboard-data";
import { validateOutboundWebhookUrl } from "@/lib/webhook-url-safety";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";
import { requireSealToken, unsealToken } from "@/lib/token-crypto";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const locale = getRequestLocale(request);
  const user = await requireUser();
  if (!user) {
    return NextResponse.json(
      { error: tApi(locale, "unauthenticated") },
      { status: 401 }
    );
  }

  const webhooks = await listOutboundWebhooksForUser(user.id);
  return NextResponse.json({ webhooks });
}

export async function POST(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "outbound-webhooks",
    limit: 20,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const user = await requireUser();
  if (!user) {
    return NextResponse.json(
      { error: tApi(locale, "unauthenticated") },
      { status: 401 }
    );
  }

  const subscription = await getUserSubscription(user.id);
  const usable = canUseProduct(subscription);
  if (!usable.ok) {
    return NextResponse.json(
      { error: tApi(locale, usable.code, usable.params) },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: tApi(locale, "invalidJson") },
      { status: 400 }
    );
  }

  const parsed = outboundWebhookSchemaFor(locale).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? tApi(locale, "invalidData") },
      { status: 400 }
    );
  }

  const urlCheck = validateOutboundWebhookUrl(parsed.data.url);
  if (!urlCheck.ok) {
    return NextResponse.json({ error: urlCheck.error }, { status: 400 });
  }

  let sealedSecret: string;
  try {
    sealedSecret = requireSealToken(
      newOutboundWebhookSecret(),
      "outbound webhook secret"
    );
  } catch {
    return NextResponse.json(
      { error: tApi(locale, "tokenEncryptionRequired") },
      { status: 500 }
    );
  }

  const webhook = await prisma.orgOutboundWebhook.create({
    data: {
      userId: user.id,
      url: urlCheck.url,
      events: parsed.data.events,
      active: parsed.data.active,
      secret: sealedSecret,
    },
  });

  return NextResponse.json(
    {
      webhook: {
        ...webhook,
        secret: unsealToken(webhook.secret) ?? webhook.secret,
      },
    },
    { status: 201 }
  );
}

export async function DELETE(request: NextRequest) {
  const locale = getRequestLocale(request);
  const user = await requireUser();
  if (!user) {
    return NextResponse.json(
      { error: tApi(locale, "unauthenticated") },
      { status: 401 }
    );
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { error: tApi(locale, "invalidData") },
      { status: 400 }
    );
  }

  await prisma.orgOutboundWebhook.deleteMany({
    where: { id, userId: user.id },
  });
  return NextResponse.json({ ok: true });
}
