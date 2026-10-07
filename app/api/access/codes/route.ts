import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  requireOrg,
  getOrgSubscription,
  canUseProduct,
} from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { accessCodeCreateSchemaFor } from "@/lib/access-validation";
import {
  accessCodePrefix,
  hashAccessCode,
  normalizeAccessCode,
  newAccessCodePlain,
} from "@/lib/access-code-crypto";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";
import { deniedAuthResponse } from "@/lib/http-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const locale = getRequestLocale(request);
  const org = await requireOrg({ minRole: "MEMBER" });
  if (!org) {
    return deniedAuthResponse(locale);
  }

  const productId = request.nextUrl.searchParams.get("productId");
  const codes = await prisma.accessCode.findMany({
    where: {
      product: { organizationId: org.organizationId },
      ...(productId ? { accessProductId: productId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { product: { select: { id: true, name: true } } },
  });

  return NextResponse.json({
    codes: codes.map((c) => ({
      id: c.id,
      accessProductId: c.accessProductId,
      codePrefix: c.codePrefix,
      /** Affichage masqué — le clair n’est jamais renvoyé après création. */
      codeDisplay: `${c.codePrefix}••••`,
      maxRedemptions: c.maxRedemptions,
      redemptions: c.redemptions,
      active: c.active,
      expiresAt: c.expiresAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      product: c.product,
    })),
  });
}

export async function POST(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "access-codes",
    limit: 30,
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

  const parsed = accessCodeCreateSchemaFor(locale).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? tApi(locale, "invalidData") },
      { status: 400 }
    );
  }

  const product = await prisma.accessProduct.findFirst({
    where: {
      id: parsed.data.accessProductId,
      organizationId: org.organizationId,
    },
    select: { id: true },
  });
  if (!product) {
    return NextResponse.json(
      { error: tApi(locale, "accessProductNotFound") },
      { status: 404 }
    );
  }

  const plain = normalizeAccessCode(
    parsed.data.code ?? newAccessCodePlain()
  );
  try {
    const created = await prisma.accessCode.create({
      data: {
        accessProductId: product.id,
        createdByUserId: org.userId,
        codeHash: hashAccessCode(plain),
        codePrefix: accessCodePrefix(plain),
        maxRedemptions: parsed.data.maxRedemptions,
        expiresAt: parsed.data.expiresAt ?? null,
      },
    });
    return NextResponse.json(
      {
        code: {
          id: created.id,
          accessProductId: created.accessProductId,
          /** Clair une seule fois — à copier immédiatement. */
          plain,
          codePrefix: created.codePrefix,
          maxRedemptions: created.maxRedemptions,
          redemptions: created.redemptions,
          expiresAt: created.expiresAt?.toISOString() ?? null,
          createdAt: created.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: tApi(locale, "invalidData") },
      { status: 409 }
    );
  }
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

  await prisma.accessCode.deleteMany({
    where: {
      id,
      product: { organizationId: org.organizationId },
    },
  });
  return NextResponse.json({ ok: true });
}
