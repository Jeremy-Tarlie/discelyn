import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import {
  emailOnlySchema,
  resendVerificationEmail,
} from "@/lib/auth-credentials";
import { withOpaqueTimingFloor } from "@/lib/auth-timing";

export async function POST(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "auth-resend-verification",
    limit: 5,
    windowMs: 15 * 60_000,
  });
  if (!limited.ok) return limited.response;

  // Opaque + floor (y compris JSON/Zod invalides) — anti-énumération.
  await withOpaqueTimingFloor(async () => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return;
    }

    const parsed = emailOnlySchema.safeParse(body);
    if (!parsed.success) return;

    await resendVerificationEmail({
      email: parsed.data.email,
      locale: locale === "en" ? "en" : "fr",
    });
  });

  return NextResponse.json({ ok: true });
}
