import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  requireOrg,
  getOrgSubscription,
  canUseProduct,
} from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { outboundWebhookSchemaFor } from "@/lib/access-validation";
import { newOutboundWebhookSecret } from "@/lib/outbound-webhooks";
import { listOutboundWebhooksForOrg } from "@/lib/dashboard-data";
import { validateOutboundWebhookUrl } from "@/lib/webhook-url-safety";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";
import { requireSealToken, unsealToken } from "@/lib/token-crypto";
import { deniedAuthResponse } from "@/lib/http-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "outbound-webhooks",
    limit: 60,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const org = await requireOrg({ minRole: "MEMBER" });
  if (!org) {
    return deniedAuthResponse(locale);
  }

  const webhooks = await listOutboundWebhooksForOrg(org.organizationId);
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

  const org = await requireOrg({ minRole: "ADMIN" });
  if (!org) {
    return deniedAuthResponse(locale);
  }

  const subscription = await getOrgSubscription(org.organizationId);
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
      organizationId: org.organizationId,
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
  const org = await requireOrg({ minRole: "ADMIN" });
  if (!org) {
    return deniedAuthResponse(locale);
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { error: tApi(locale, "invalidData") },
      { status: 400 }
    );
  }

  await prisma.orgOutboundWebhook.deleteMany({
    where: { id, organizationId: org.organizationId },
  });
  return NextResponse.json({ ok: true });
}
