import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  requireUser,
  getUserSubscription,
  canUseProduct,
} from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { affiliateCreateSchemaFor } from "@/lib/access-validation";
import { listAffiliatesForUser } from "@/lib/dashboard-data";
import { affiliateRefUrl } from "@/lib/learner-access";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "affiliates-get",
    limit: 60,
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

  const affiliates = await listAffiliatesForUser(user.id);
  return NextResponse.json({ affiliates });
}

export async function POST(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "affiliates",
    limit: 30,
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

  const parsed = affiliateCreateSchemaFor(locale).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? tApi(locale, "invalidData") },
      { status: 400 }
    );
  }

  try {
    const affiliate = await prisma.affiliate.create({
      data: {
        userId: user.id,
        code: parsed.data.code.toLowerCase(),
        label: parsed.data.label,
        commissionBps: parsed.data.commissionBps,
      },
    });
    return NextResponse.json(
      { affiliate: { ...affiliate, refUrl: affiliateRefUrl(affiliate.code) } },
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

  await prisma.affiliate.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ ok: true });
}
