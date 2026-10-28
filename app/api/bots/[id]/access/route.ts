import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  requireOrg,
  getOrgSubscription,
  canUseProduct,
} from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getPlan, type PlanId } from "@/lib/plans";
import { accessProductCreateSchemaFor } from "@/lib/access-validation";
import { claimUrl, ensurePrimaryGrant } from "@/lib/learner-access";
import {
  attachDiscelynPaymentLink,
  createOrgStripeOffer,
  OrgStripeCatalogError,
  resolveOrgStripePriceId,
} from "@/lib/org-stripe-catalog";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";
import { deniedAuthResponse } from "@/lib/http-auth";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function loadOwnedBot(botId: string, organizationId: string) {
  return prisma.bot.findFirst({
    where: { id: botId, organizationId, deletedAt: null },
    select: { id: true, guildId: true, name: true },
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const locale = getRequestLocale(request);
  const org = await requireOrg({ minRole: "MEMBER" });
  if (!org) {
    return deniedAuthResponse(locale);
  }

  const { id: botId } = await context.params;
  const bot = await loadOwnedBot(botId, org.organizationId);
  if (!bot) {
    return NextResponse.json(
      { error: tApi(locale, "botNotFound") },
      { status: 404 }
    );
  }

  const subscription = await getOrgSubscription(org.organizationId);
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

  const plan = getPlan(subscription.plan as PlanId);
  const { id: botId } = await context.params;
  const bot = await loadOwnedBot(botId, org.organizationId);
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
    where: { organizationId: org.organizationId },
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

  const parsed = accessProductCreateSchemaFor(locale).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? tApi(locale, "invalidData") },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const isCreate = data.mode === "create";

  try {
    let stripePriceId: string;
    let stripeProductId: string | null = null;
    let billingMode: "ONE_TIME" | "RECURRING";
    let amountCents: number | null = null;
    let currency: string | null = null;
    let recurringInterval: string | null = null;
    let paymentSource: "DISCELYN_LINK" | "EXTERNAL_STRIPE";
    let existingPaymentLinkUrl: string | null = null;
    let existingPaymentLinkId: string | null = null;

    if (isCreate) {
      if (
        data.billingMode === "RECURRING" &&
        data.recurringInterval !== "month" &&
        data.recurringInterval !== "year"
      ) {
        return NextResponse.json(
          { error: tApi(locale, "invalidData") },
          { status: 400 }
        );
      }
      const offer = await createOrgStripeOffer({
        organizationId: org.organizationId,
        name: data.name,
        amountCents: data.amountCents,
        currency: data.currency,
        billingMode: data.billingMode,
        recurringInterval: data.recurringInterval ?? undefined,
      });
      stripePriceId = offer.stripePriceId;
      stripeProductId = offer.stripeProductId;
      billingMode = offer.billingMode;
      amountCents = offer.amountCents;
      currency = offer.currency;
      recurringInterval = offer.recurringInterval;
      paymentSource = "DISCELYN_LINK";
    } else {
      const resolved = await resolveOrgStripePriceId({
        organizationId: org.organizationId,
        stripePriceId:
          "stripePriceId" in data ? data.stripePriceId : undefined,
        paymentLinkUrl:
          "paymentLinkUrl" in data ? data.paymentLinkUrl : undefined,
      });
      stripePriceId = resolved.stripePriceId;
      billingMode = resolved.billingMode;
      amountCents = resolved.amountCents;
      currency = resolved.currency;
      recurringInterval = resolved.recurringInterval;
      existingPaymentLinkUrl = resolved.existingPaymentLinkUrl;
      existingPaymentLinkId = resolved.existingPaymentLinkId;
      paymentSource = "EXTERNAL_STRIPE";
    }

    const product = await prisma.accessProduct.create({
      data: {
        organizationId: org.organizationId,
        botId,
        name: data.name,
        stripePriceId,
        stripeProductId,
        discordRoleId: data.discordRoleId,
        pitch: data.pitch ?? null,
        welcomeDm: data.welcomeDm ?? null,
        revokeOnRefund: data.revokeOnRefund,
        accessEndsAt: data.accessEndsAt ?? null,
        billingMode,
        paymentSource,
        amountCents,
        currency,
        recurringInterval,
        maxSeats: data.maxSeats ?? null,
        reminderDaysBefore: data.reminderDaysBefore ?? 7,
        onboardingSteps: data.onboardingSteps ?? undefined,
        brandName: data.brandName ?? null,
        brandLogoUrl: data.brandLogoUrl ?? null,
        brandColor: data.brandColor ?? null,
        sortOrder: data.sortOrder ?? 0,
        paymentLinkUrl: existingPaymentLinkUrl,
        paymentLinkId: existingPaymentLinkId,
      },
    });

    await ensurePrimaryGrant({
      productId: product.id,
      botId,
      guildId: bot.guildId,
      discordRoleId: data.discordRoleId,
    });

    let paymentLinkUrl = product.paymentLinkUrl;
    let paymentLinkId = product.paymentLinkId;

    if (!paymentLinkUrl) {
      try {
        const link = await attachDiscelynPaymentLink({
          organizationId: org.organizationId,
          accessProductId: product.id,
          stripePriceId: product.stripePriceId,
          productName: product.name,
        });
        paymentLinkUrl = link.url;
        paymentLinkId = link.id;
        await prisma.accessProduct.update({
          where: { id: product.id },
          data: {
            paymentLinkUrl,
            paymentLinkId,
            paymentSource: isCreate ? "DISCELYN_LINK" : "EXTERNAL_STRIPE",
          },
        });
      } catch (linkError) {
        console.warn(
          JSON.stringify({
            msg: "access_payment_link_failed",
            productId: product.id,
            err:
              linkError instanceof Error ? linkError.message : "unknown",
          })
        );
      }
    } else if (paymentLinkId) {
      // Binding d’un PL existant : pas de recreate ; metadata product id non injectable a posteriori.
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
  } catch (error) {
    if (error instanceof OrgStripeCatalogError) {
      return NextResponse.json(
        { error: tApi(locale, error.apiKey()) },
        { status: 400 }
      );
    }
    if (
      error instanceof Error &&
      (error.message.includes("Unique constraint") ||
        error.message.includes("accessProductDuplicate"))
    ) {
      return NextResponse.json(
        { error: tApi(locale, "accessProductDuplicate") },
        { status: 409 }
      );
    }
    console.warn(
      JSON.stringify({
        msg: "access_product_create_failed",
        botId,
      })
    );
    return NextResponse.json(
      { error: tApi(locale, "invalidData") },
      { status: 400 }
    );
  }
}
