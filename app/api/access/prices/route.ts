import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  requireOrg,
  getOrgSubscription,
  canUseProduct,
} from "@/lib/access";
import { listOrgPrices } from "@/lib/org-stripe";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "access-prices",
    limit: 30,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const org = await requireOrg({ minRole: "MEMBER" });
  if (!org) {
    return NextResponse.json(
      { error: tApi(locale, "unauthenticated") },
      { status: 401 }
    );
  }

  const subscription = await getOrgSubscription(org.organizationId);
  const usable = canUseProduct(subscription);
  if (!usable.ok) {
    return NextResponse.json(
      { error: tApi(locale, usable.code, usable.params) },
      { status: 403 }
    );
  }

  try {
    const prices = await listOrgPrices(org.organizationId);
    return NextResponse.json({ prices });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : tApi(locale, "stripeSetupFailed");
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
