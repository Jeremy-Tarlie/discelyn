import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  requireUser,
  getUserSubscription,
  canUseProduct,
} from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getPlan, type PlanId } from "@/lib/plans";
import { orgStripeConfigSchema } from "@/lib/access-validation";
import {
  newWebhookPathToken,
  orgWebhookUrl,
} from "@/lib/learner-access";
import {
  isTokenEncryptionEnabled,
  requireSealToken,
  requireUnsealSecret,
} from "@/lib/token-crypto";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";

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

  const config = await prisma.orgStripeConfig.findUnique({
    where: { userId: user.id },
    select: {
      webhookPathToken: true,
      label: true,
      stripeSecretKey: true,
      displayName: true,
      logoUrl: true,
      primaryColor: true,
      supportUrl: true,
      updatedAt: true,
    },
  });

  if (!config) {
    return NextResponse.json({
      configured: false,
      webhookUrl: null,
      label: null,
      hasStripeSecretKey: false,
      displayName: null,
      logoUrl: null,
      primaryColor: null,
      supportUrl: null,
    });
  }

  return NextResponse.json({
    configured: true,
    webhookUrl: orgWebhookUrl(config.webhookPathToken),
    label: config.label,
    hasStripeSecretKey: Boolean(config.stripeSecretKey),
    displayName: config.displayName,
    logoUrl: config.logoUrl,
    primaryColor: config.primaryColor,
    supportUrl: config.supportUrl,
    updatedAt: config.updatedAt.toISOString(),
  });
}

export async function PUT(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "org-stripe-config",
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

  if (!isTokenEncryptionEnabled()) {
    return NextResponse.json(
      { error: tApi(locale, "tokenEncryptionRequired") },
      { status: 503 }
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

  const plan = getPlan(subscription.plan as PlanId);
  if (plan.maxAccessProducts < 1) {
    return NextResponse.json(
      { error: tApi(locale, "accessControlUnavailable") },
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

  const parsed = orgStripeConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? tApi(locale, "invalidData") },
      { status: 400 }
    );
  }

  const existing = await prisma.orgStripeConfig.findUnique({
    where: { userId: user.id },
    select: {
      webhookPathToken: true,
      stripeSecretKey: true,
      webhookSecret: true,
    },
  });

  if (!existing && !parsed.data.webhookSecret) {
    return NextResponse.json(
      { error: tApi(locale, "invalidData") },
      { status: 400 }
    );
  }

  const pathToken = existing?.webhookPathToken ?? newWebhookPathToken();

  let sealedSecret: string;
  let sealedKey: string | null;
  try {
    sealedSecret = parsed.data.webhookSecret
      ? requireSealToken(parsed.data.webhookSecret, "whsec_")
      : existing!.webhookSecret;
    // Refuse de garder un whsec_ legacy en clair
    requireUnsealSecret(sealedSecret, "whsec_");

    const rawKey = parsed.data.stripeSecretKey;
    if (rawKey && rawKey.length > 0) {
      sealedKey = requireSealToken(rawKey, "sk_");
    } else if (existing?.stripeSecretKey) {
      requireUnsealSecret(existing.stripeSecretKey, "sk_");
      sealedKey = existing.stripeSecretKey;
    } else {
      sealedKey = null;
    }
  } catch {
    return NextResponse.json(
      { error: tApi(locale, "tokenEncryptionRequired") },
      { status: 500 }
    );
  }

  const config = await prisma.orgStripeConfig.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      webhookPathToken: pathToken,
      webhookSecret: sealedSecret,
      stripeSecretKey: sealedKey,
      label: parsed.data.label ?? null,
      displayName: parsed.data.displayName ?? null,
      logoUrl: parsed.data.logoUrl ?? null,
      primaryColor: parsed.data.primaryColor ?? null,
      supportUrl: parsed.data.supportUrl ?? null,
    },
    update: {
      ...(parsed.data.webhookSecret
        ? { webhookSecret: sealedSecret }
        : {}),
      ...(parsed.data.stripeSecretKey !== undefined
        ? { stripeSecretKey: sealedKey }
        : {}),
      ...(parsed.data.label !== undefined
        ? { label: parsed.data.label }
        : {}),
      ...(parsed.data.displayName !== undefined
        ? { displayName: parsed.data.displayName }
        : {}),
      ...(parsed.data.logoUrl !== undefined
        ? { logoUrl: parsed.data.logoUrl }
        : {}),
      ...(parsed.data.primaryColor !== undefined
        ? { primaryColor: parsed.data.primaryColor }
        : {}),
      ...(parsed.data.supportUrl !== undefined
        ? { supportUrl: parsed.data.supportUrl }
        : {}),
    },
  });

  return NextResponse.json({
    configured: true,
    webhookUrl: orgWebhookUrl(config.webhookPathToken),
    label: config.label,
    hasStripeSecretKey: Boolean(config.stripeSecretKey),
    displayName: config.displayName,
    logoUrl: config.logoUrl,
    primaryColor: config.primaryColor,
    supportUrl: config.supportUrl,
  });
}

