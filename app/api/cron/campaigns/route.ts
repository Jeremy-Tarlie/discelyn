import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authorizeCronRequest } from "@/lib/cron-http";
import { processCampaignBatch } from "@/lib/admin-campaigns";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Worker campagnes marketing : envoi par lots (file DB).
 * Compose : campaigns-cron (~60 s).
 */
export async function POST(request: NextRequest) {
  const denied = await authorizeCronRequest(request, "cron-campaigns");
  if (denied) return denied;

  const result = await processCampaignBatch();
  return NextResponse.json({
    ok: true,
    ...result,
    time: new Date().toISOString(),
  });
}
