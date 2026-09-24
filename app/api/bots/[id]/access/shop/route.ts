import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  requireUser,
  getUserSubscription,
  canUseProduct,
} from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { postAccessShop } from "@/lib/discord-roles";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";
import { postShopSchemaFor } from "@/lib/access-validation";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Poster l’embed boutique (boutons Payment Link) dans un salon Discord. */
export async function POST(request: NextRequest, context: RouteContext) {
  const locale = getRequestLocale(request);
  const postShopSchema = postShopSchemaFor(locale);
  const limited = await rateLimit(request, {
    namespace: "access-shop-post",
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

  const { id: botId } = await context.params;
  const bot = await prisma.bot.findFirst({
    where: { id: botId, userId: user.id },
    select: { id: true, name: true, guildId: true },
  });
  if (!bot) {
    return NextResponse.json(
      { error: tApi(locale, "botNotFound") },
      { status: 404 }
    );
  }
  if (!bot.guildId) {
    return NextResponse.json(
      { error: tApi(locale, "noGuildOnConfig") },
      { status: 400 }
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

  const parsed = postShopSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? tApi(locale, "invalidData") },
      { status: 400 }
    );
  }

  const products = await prisma.accessProduct.findMany({
    where: {
      botId,
      active: true,
      paymentLinkUrl: { not: null },
    },
    select: {
      name: true,
      pitch: true,
      paymentLinkUrl: true,
      maxSeats: true,
      seatsUsed: true,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    take: 10,
  });

  const shopProducts = products
    .filter(
      (p): p is typeof p & { paymentLinkUrl: string } =>
        typeof p.paymentLinkUrl === "string" && p.paymentLinkUrl.length > 0
    )
    .filter((p) => p.maxSeats == null || p.seatsUsed < p.maxSeats)
    .slice(0, 5)
    .map((p) => ({
      name: p.name,
      pitch: p.pitch,
      paymentLinkUrl: p.paymentLinkUrl,
    }));

  if (shopProducts.length === 0) {
    return NextResponse.json(
      { error: tApi(locale, "accessShopEmpty") },
      { status: 400 }
    );
  }

  const result = await postAccessShop({
    channelId: parsed.data.channelId,
    botName: bot.name,
    products: shopProducts,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
