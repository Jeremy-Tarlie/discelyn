import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireUser,
  getUserSubscription,
  canUseProduct,
} from "@/lib/access";
import { getPlan, type PlanId } from "@/lib/plans";
import { bootstrapOrgStripe } from "@/lib/org-stripe";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";

export const runtime = "nodejs";

const setupSchema = z.object({
  stripeSecretKey: z
    .string()
    .trim()
    .regex(/^sk_(test_|live_)/, "Clé secrète Stripe invalide (sk_…)"),
  label: z.string().trim().max(80).optional().nullable(),
});

/**
 * Setup 1 clic : sk_ formation → webhook Stripe créé automatiquement.
 */
export async function POST(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "access-setup",
    limit: 10,
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

  const parsed = setupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? tApi(locale, "invalidData") },
      { status: 400 }
    );
  }

  try {
    const result = await bootstrapOrgStripe({
      userId: user.id,
      stripeSecretKey: parsed.data.stripeSecretKey,
      label: parsed.data.label,
    });
    return NextResponse.json({
      ok: true,
      webhookUrl: result.webhookUrl,
      createdWebhook: result.createdWebhook,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : tApi(locale, "stripeSetupFailed");
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
