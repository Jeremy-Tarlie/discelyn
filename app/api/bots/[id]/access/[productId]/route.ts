import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  requireUser,
  getUserSubscription,
  canUseProduct,
} from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { accessProductUpdateSchema } from "@/lib/access-validation";
import { ensurePrimaryGrant } from "@/lib/learner-access";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string; productId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "access-product-patch",
    limit: 40,
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

  const { id: botId, productId } = await context.params;
  const existing = await prisma.accessProduct.findFirst({
    where: { id: productId, botId, userId: user.id },
    include: { bot: { select: { guildId: true } } },
  });
  if (!existing) {
    return NextResponse.json(
      { error: tApi(locale, "accessProductNotFound") },
      { status: 404 }
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

  const parsed = accessProductUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? tApi(locale, "invalidData") },
      { status: 400 }
    );
  }

  const product = await prisma.accessProduct.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.stripePriceId !== undefined
        ? { stripePriceId: parsed.data.stripePriceId }
        : {}),
      ...(parsed.data.discordRoleId !== undefined
        ? { discordRoleId: parsed.data.discordRoleId }
        : {}),
      ...(parsed.data.pitch !== undefined ? { pitch: parsed.data.pitch } : {}),
      ...(parsed.data.welcomeDm !== undefined
        ? { welcomeDm: parsed.data.welcomeDm }
        : {}),
      ...(parsed.data.revokeOnRefund !== undefined
        ? { revokeOnRefund: parsed.data.revokeOnRefund }
        : {}),
      ...(parsed.data.accessEndsAt !== undefined
        ? { accessEndsAt: parsed.data.accessEndsAt }
        : {}),
      ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
      ...(parsed.data.maxSeats !== undefined
        ? { maxSeats: parsed.data.maxSeats }
        : {}),
      ...(parsed.data.reminderDaysBefore !== undefined
        ? { reminderDaysBefore: parsed.data.reminderDaysBefore }
        : {}),
      ...(parsed.data.onboardingSteps !== undefined
        ? {
            onboardingSteps:
              parsed.data.onboardingSteps === null
                ? Prisma.JsonNull
                : parsed.data.onboardingSteps,
          }
        : {}),
      ...(parsed.data.brandName !== undefined
        ? { brandName: parsed.data.brandName }
        : {}),
      ...(parsed.data.brandLogoUrl !== undefined
        ? { brandLogoUrl: parsed.data.brandLogoUrl }
        : {}),
      ...(parsed.data.brandColor !== undefined
        ? { brandColor: parsed.data.brandColor }
        : {}),
      ...(parsed.data.sortOrder !== undefined
        ? { sortOrder: parsed.data.sortOrder }
        : {}),
    },
  });

  if (
    parsed.data.discordRoleId !== undefined &&
    existing.bot.guildId
  ) {
    await ensurePrimaryGrant({
      productId: existing.id,
      botId,
      guildId: existing.bot.guildId,
      discordRoleId: parsed.data.discordRoleId,
    });
  }

  return NextResponse.json({ product });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const locale = getRequestLocale(request);
  const user = await requireUser();
  if (!user) {
    return NextResponse.json(
      { error: tApi(locale, "unauthenticated") },
      { status: 401 }
    );
  }

  const { id: botId, productId } = await context.params;
  const existing = await prisma.accessProduct.findFirst({
    where: { id: productId, botId, userId: user.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json(
      { error: tApi(locale, "accessProductNotFound") },
      { status: 404 }
    );
  }

  await prisma.accessProduct.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
