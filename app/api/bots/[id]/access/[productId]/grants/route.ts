import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  requireUser,
  getUserSubscription,
  canUseProduct,
} from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { guildGrantSchemaFor } from "@/lib/access-validation";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string; productId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const locale = getRequestLocale(request);
  const user = await requireUser();
  if (!user) {
    return NextResponse.json(
      { error: tApi(locale, "unauthenticated") },
      { status: 401 }
    );
  }

  const { id: botId, productId } = await context.params;
  const product = await prisma.accessProduct.findFirst({
    where: { id: productId, botId, userId: user.id },
    include: {
      guildGrants: {
        include: { bot: { select: { id: true, name: true, guildId: true } } },
      },
    },
  });
  if (!product) {
    return NextResponse.json(
      { error: tApi(locale, "accessProductNotFound") },
      { status: 404 }
    );
  }

  return NextResponse.json({ grants: product.guildGrants });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "access-grants",
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
  const product = await prisma.accessProduct.findFirst({
    where: { id: productId, botId, userId: user.id },
    select: { id: true },
  });
  if (!product) {
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

  const parsed = guildGrantSchemaFor(locale).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? tApi(locale, "invalidData") },
      { status: 400 }
    );
  }

  const targetBot = await prisma.bot.findFirst({
    where: { id: parsed.data.botId, userId: user.id },
    select: { id: true, guildId: true },
  });
  if (!targetBot?.guildId) {
    return NextResponse.json(
      { error: tApi(locale, "noGuildOnConfig") },
      { status: 400 }
    );
  }

  const grant = await prisma.accessProductGuildGrant.upsert({
    where: {
      accessProductId_botId: {
        accessProductId: product.id,
        botId: targetBot.id,
      },
    },
    create: {
      accessProductId: product.id,
      botId: targetBot.id,
      guildId: targetBot.guildId,
      discordRoleId: parsed.data.discordRoleId,
    },
    update: {
      guildId: targetBot.guildId,
      discordRoleId: parsed.data.discordRoleId,
    },
  });

  return NextResponse.json({ grant }, { status: 201 });
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

  const grantId = request.nextUrl.searchParams.get("grantId");
  if (!grantId) {
    return NextResponse.json(
      { error: tApi(locale, "invalidData") },
      { status: 400 }
    );
  }

  const { id: botId, productId } = await context.params;
  const product = await prisma.accessProduct.findFirst({
    where: { id: productId, botId, userId: user.id },
    select: { id: true },
  });
  if (!product) {
    return NextResponse.json(
      { error: tApi(locale, "accessProductNotFound") },
      { status: 404 }
    );
  }

  await prisma.accessProductGuildGrant.deleteMany({
    where: { id: grantId, accessProductId: product.id },
  });
  return NextResponse.json({ ok: true });
}
