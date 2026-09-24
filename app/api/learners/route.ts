import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  requireUser,
  getUserSubscription,
  canUseProduct,
} from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  claimUrl,
  newClaimToken,
  revokeLearnerAccess,
} from "@/lib/learner-access";
import { listLearnersForUser } from "@/lib/dashboard-data";
import { getOrgStripeClient } from "@/lib/org-stripe";
import { appBaseUrl } from "@/lib/learner-access";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";
import { z } from "zod";

export const runtime = "nodejs";

const EXPORT_LIMIT = 5_000;

const actionSchema = z.object({
  accessId: z.string().min(1),
  action: z.enum(["revoke", "refresh_claim", "open_portal"]),
});

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export async function GET(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "learners-get",
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

  const status = request.nextUrl.searchParams.get("status");
  const productId = request.nextUrl.searchParams.get("productId");
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? null;
  const source = request.nextUrl.searchParams.get("source");
  const wantExport = request.nextUrl.searchParams.get("export") === "1";

  const learners = await listLearnersForUser(user.id, {
    status,
    productId,
    q,
    source,
    take: wantExport ? EXPORT_LIMIT : 100,
  });

  if (wantExport) {
    const header = [
      "id",
      "product_name",
      "billing_mode",
      "status",
      "source",
      "email",
      "discord_user_id",
      "amount_total",
      "currency",
      "affiliate_code",
      "stripe_customer_id",
      "stripe_subscription_id",
      "granted_at",
      "revoked_at",
      "revoke_reason",
      "access_ends_at",
      "created_at",
    ];
    const lines = [header.join(",")];
    for (const row of learners) {
      lines.push(
        [
          row.id,
          csvEscape(row.product.name),
          row.product.billingMode,
          row.status,
          row.source,
          csvEscape(row.customerEmail ?? ""),
          row.discordUserId ?? "",
          row.amountTotal != null ? String(row.amountTotal) : "",
          row.currency ?? "",
          row.affiliate?.code ?? "",
          row.stripeCustomerId ?? "",
          row.stripeSubscriptionId ?? "",
          row.grantedAt ?? "",
          row.revokedAt ?? "",
          csvEscape(row.revokeReason ?? ""),
          row.accessEndsAt ?? "",
          row.createdAt,
        ].join(",")
      );
    }
    const csv = `\uFEFF${lines.join("\n")}`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="learners-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({ learners });
}

export async function POST(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "learners-actions",
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: tApi(locale, "invalidJson") },
      { status: 400 }
    );
  }

  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: tApi(locale, "invalidData") },
      { status: 400 }
    );
  }

  const access = await prisma.learnerAccess.findFirst({
    where: { id: parsed.data.accessId, bot: { userId: user.id } },
    include: { product: { select: { userId: true } } },
  });
  if (!access) {
    return NextResponse.json(
      { error: tApi(locale, "accessProductNotFound") },
      { status: 404 }
    );
  }

  if (parsed.data.action === "revoke") {
    await revokeLearnerAccess(access.id, "manual");
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === "open_portal") {
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
        return_url: `${appBaseUrl()}/dashboard/learners`,
      });
      return NextResponse.json({ url: portal.url });
    } catch {
      return NextResponse.json(
        { error: tApi(locale, "learnerPortalFailed") },
        { status: 502 }
      );
    }
  }

  const token = newClaimToken();
  await prisma.learnerAccess.update({
    where: { id: access.id },
    data: {
      claimToken: token,
      claimTokenExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      status:
        access.status === "REVOKED" || access.status === "EXPIRED"
          ? access.status
          : "PENDING_CLAIM",
    },
  });
  return NextResponse.json({ claimUrl: claimUrl(token) });
}
