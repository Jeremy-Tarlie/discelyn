import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { accessCodeRedeemSchema } from "@/lib/access-validation";
import {
  claimUrl,
  openLearnerAccessFromCode,
} from "@/lib/learner-access";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "access-code-redeem",
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

  const parsed = accessCodeRedeemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? tApi(locale, "invalidData") },
      { status: 400 }
    );
  }

  const result = await openLearnerAccessFromCode({
    code: parsed.data.code,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "redeem_failed" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    claimUrl: result.claimToken ? claimUrl(result.claimToken) : null,
    accessId: result.accessId,
  });
}
