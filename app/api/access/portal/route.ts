import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireUser,
  getUserSubscription,
  canUseProduct,
} from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getOrgStripeClient } from "@/lib/org-stripe";
import { appBaseUrl, claimUrl } from "@/lib/learner-access";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";

export const runtime = "nodejs";

const bodySchema = z
  .object({
    accessId: z.string().trim().min(1).optional(),
    claimToken: z.string().trim().min(8).optional(),
    checkoutSessionId: z.string().trim().min(8).optional(),
  })
  .refine(
    (v) =>
      [v.accessId, v.claimToken, v.checkoutSessionId].filter(Boolean).length ===
      1,
    { message: "one of accessId | claimToken | checkoutSessionId" }
  );

/** Portail Stripe Customer (compte formation) pour un apprenant. */
export async function POST(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "access-learner-portal",
    limit: 20,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: tApi(locale, "invalidJson") },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: tApi(locale, "invalidData") },
      { status: 400 }
    );
  }

  type AccessRow = {
    id: string;
    stripeCustomerId: string | null;
    claimToken: string | null;
    product: { userId: string };
  };

  let access: AccessRow | null = null;
  let returnUrl = `${appBaseUrl()}/dashboard/learners`;

  if (parsed.data.accessId) {
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

    access = await prisma.learnerAccess.findFirst({
      where: { id: parsed.data.accessId, bot: { userId: user.id } },
      select: {
        id: true,
        stripeCustomerId: true,
        claimToken: true,
        product: { select: { userId: true } },
      },
    });
  } else if (parsed.data.claimToken) {
    access = await prisma.learnerAccess.findFirst({
      where: { claimToken: parsed.data.claimToken },
      select: {
        id: true,
        stripeCustomerId: true,
        claimToken: true,
        product: { select: { userId: true } },
      },
    });
    if (access?.claimToken) {
      returnUrl = claimUrl(access.claimToken);
    }
  } else if (parsed.data.checkoutSessionId) {
    access = await prisma.learnerAccess.findFirst({
      where: { stripeCheckoutSessionId: parsed.data.checkoutSessionId },
      select: {
        id: true,
        stripeCustomerId: true,
        claimToken: true,
        product: { select: { userId: true } },
      },
    });
    returnUrl = access?.claimToken
      ? claimUrl(access.claimToken)
      : `${appBaseUrl()}/claim/session/${parsed.data.checkoutSessionId}`;
  }

  if (!access) {
    return NextResponse.json(
      { error: tApi(locale, "accessProductNotFound") },
      { status: 404 }
    );
  }

  if (!access.stripeCustomerId) {
    return NextResponse.json(
      { error: tApi(locale, "learnerNoStripeCustomer") },
      { status: 400 }
    );
  }

  const stripe = await getOrgStripeClient(access.product.userId);
  if (!stripe) {
    return NextResponse.json(
      { error: tApi(locale, "orgStripeMissing") },
      { status: 400 }
    );
  }

  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: access.stripeCustomerId,
      return_url: returnUrl,
    });
    return NextResponse.json({ url: portal.url });
  } catch (err) {
    console.warn("[access-portal] create failed", err);
    return NextResponse.json(
      { error: tApi(locale, "learnerPortalFailed") },
      { status: 502 }
    );
  }
}
