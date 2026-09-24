import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  requireUser,
  getUserSubscription,
  canUseProduct,
} from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getPlan, type PlanId } from "@/lib/plans";
import { accessProductCreateSchema } from "@/lib/access-validation";
import { claimUrl, ensurePrimaryGrant } from "@/lib/learner-access";
import {
  createAccessPaymentLink,
  detectBillingMode,
} from "@/lib/org-stripe";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function loadOwnedBot(botId: string, userId: string) {
  return prisma.bot.findFirst({
    where: { id: botId, userId },
    select: { id: true, guildId: true, name: true },
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const locale = getRequestLocale(request);
  const user = await requireUser();
  if (!user) {
    return NextResponse.json(
      { error: tApi(locale, "unauthenticated") },
      { status: 401 }
    );
  }

  const { id: botId } = await context.params;
  const bot = await loadOwnedBot(botId, user.id);
  if (!bot) {
    return NextResponse.json(
      { error: tApi(locale, "botNotFound") },
      { status: 404 }
    );
  }

  const subscription = await getUserSubscription(user.id);
  const plan = getPlan(subscription.plan as PlanId);

  const [products, recentAccesses] = await Promise.all([
    prisma.accessProduct.findMany({
      where: { botId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        guildGrants: {
          select: {
            id: true,
            botId: true,
            guildId: true,
            discordRoleId: true,
          },
        },
      },
    }),
    prisma.learnerAccess.findMany({
      where: { botId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        status: true,
        source: true,
        customerEmail: true,
        discordUserId: true,
        claimToken: true,
        amountTotal: true,
        currency: true,
        grantedAt: true,
        revokedAt: true,
        revokeReason: true,
        createdAt: true,
        product: { select: { name: true } },
      },
    }),
  ]);

  return NextResponse.json({
    maxAccessProducts: plan.maxAccessProducts,
    products,
    recentAccesses: recentAccesses.map((row) => ({
      ...row,
      claimUrl: row.claimToken ? claimUrl(row.claimToken) : null,
      createdAt: row.createdAt.toISOString(),
      grantedAt: row.grantedAt?.toISOString() ?? null,
      revokedAt: row.revokedAt?.toISOString() ?? null,
    })),
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "access-products",
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

  const plan = getPlan(subscription.plan as PlanId);
  const { id: botId } = await context.params;
  const bot = await loadOwnedBot(botId, user.id);
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

  const count = await prisma.accessProduct.count({
    where: { userId: user.id },
  });
  if (count >= plan.maxAccessProducts) {
    return NextResponse.json(
      {
        error: tApi(locale, "accessProductLimit", {
          n: plan.maxAccessProducts,
          plan: plan.name,
        }),
      },
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

  const parsed = accessProductCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? tApi(locale, "invalidData") },
      { status: 400 }
    );
  }

  const billingMode = await detectBillingMode(
    user.id,
    parsed.data.stripePriceId
  );

  try {
    const product = await prisma.accessProduct.create({
      data: {
        userId: user.id,
        botId,
        name: parsed.data.name,
        stripePriceId: parsed.data.stripePriceId,
        discordRoleId: parsed.data.discordRoleId,
        pitch: parsed.data.pitch ?? null,
        welcomeDm: parsed.data.welcomeDm ?? null,
        revokeOnRefund: parsed.data.revokeOnRefund,
        accessEndsAt: parsed.data.accessEndsAt ?? null,
        billingMode,
        maxSeats: parsed.data.maxSeats ?? null,
        reminderDaysBefore: parsed.data.reminderDaysBefore ?? 7,
        onboardingSteps: parsed.data.onboardingSteps ?? undefined,
        brandName: parsed.data.brandName ?? null,
        brandLogoUrl: parsed.data.brandLogoUrl ?? null,
        brandColor: parsed.data.brandColor ?? null,
        sortOrder: parsed.data.sortOrder ?? 0,
      },
    });

    await ensurePrimaryGrant({
      productId: product.id,
      botId,
      guildId: bot.guildId,
      discordRoleId: parsed.data.discordRoleId,
    });

    let paymentLinkUrl: string | null = null;
    let paymentLinkId: string | null = null;
    try {
      const brand = await prisma.orgStripeConfig.findUnique({
        where: { userId: user.id },
        select: { displayName: true },
      });
      const link = await createAccessPaymentLink({
        userId: user.id,
        stripePriceId: product.stripePriceId,
        productName: product.name,
        customText: brand?.displayName
          ? `Accès Discord — ${brand.displayName}`
          : null,
      });
      paymentLinkUrl = link.url;
      paymentLinkId = link.id;
      await prisma.accessProduct.update({
        where: { id: product.id },
        data: { paymentLinkUrl, paymentLinkId },
      });
    } catch (linkError) {
      console.warn("[access] payment link failed", linkError);
    }

    return NextResponse.json(
      {
        product: {
          ...product,
          paymentLinkUrl,
          paymentLinkId,
        },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: tApi(locale, "accessProductDuplicate") },
      { status: 409 }
    );
  }
}
