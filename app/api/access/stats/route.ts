import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireOrg } from "@/lib/access";
import { getAccessStatsForOrg } from "@/lib/dashboard-data";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";
import { rateLimit } from "@/lib/rate-limit";
import { deniedAuthResponse } from "@/lib/http-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "access-stats",
    limit: 60,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const org = await requireOrg({ minRole: "MEMBER" });
  if (!org) {
    return deniedAuthResponse(locale);
  }

  const days = Number(request.nextUrl.searchParams.get("days") ?? "30");
  const stats = await getAccessStatsForOrg(org.organizationId, days);
  return NextResponse.json(stats);
}
