import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getStripe } from "@/lib/stripe";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";
import { deniedAuthResponse } from "@/lib/http-auth";

const createSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/),
  percentOff: z.number().int().min(1).max(100),
  duration: z.enum(["once", "repeating", "forever"]).default("once"),
  durationInMonths: z.number().int().min(1).max(36).optional(),
});

export async function GET(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "admin-promos",
    limit: 30,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const admin = await requirePlatformAdmin();
  if (!admin) return deniedAuthResponse(locale);

  try {
    const stripe = getStripe();
    const promos = await stripe.promotionCodes.list({
      limit: 50,
      expand: ["data.coupon"],
    });
    return NextResponse.json({
      promos: promos.data.map((p) => ({
        id: p.id,
        code: p.code,
        active: p.active,
        timesRedeemed: p.times_redeemed,
        percentOff:
          typeof p.coupon === "object" && p.coupon && "percent_off" in p.coupon
            ? p.coupon.percent_off
            : null,
      })),
    });
  } catch {
    return NextResponse.json(
      { promos: [], error: "stripe_unavailable" },
      { status: 502 },
    );
  }
}

export async function POST(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "admin-promos-write",
    limit: 10,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const admin = await requirePlatformAdmin();
  if (!admin) return deniedAuthResponse(locale);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: tApi(locale, "invalidData") },
      { status: 400 },
    );
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: tApi(locale, "invalidData") },
      { status: 400 },
    );
  }

  const { code, percentOff, duration, durationInMonths } = parsed.data;
  if (duration === "repeating" && !durationInMonths) {
    return NextResponse.json(
      { error: tApi(locale, "invalidData") },
      { status: 400 },
    );
  }

  try {
    const stripe = getStripe();
    const coupon = await stripe.coupons.create({
      percent_off: percentOff,
      duration,
      ...(duration === "repeating" && durationInMonths
        ? { duration_in_months: durationInMonths }
        : {}),
      name: `Discelyn ${code}`,
    });
    const promo = await stripe.promotionCodes.create({
      // Stripe API: promotion_code uses coupon id
      coupon: coupon.id,
      code: code.toUpperCase(),
    });
    return NextResponse.json({
      id: promo.id,
      code: promo.code,
      active: promo.active,
    });
  } catch {
    return NextResponse.json({ error: "stripe_error" }, { status: 502 });
  }
}
