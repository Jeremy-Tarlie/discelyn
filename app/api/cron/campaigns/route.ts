import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { processCampaignBatch } from "@/lib/admin-campaigns";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Worker campagnes marketing : envoi par lots (file DB).
 * Compose : campaigns-cron (~60 s).
 */
export async function POST(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET non configuré" },
      { status: 503 },
    );
  }
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const result = await processCampaignBatch();
  return NextResponse.json({
    ok: true,
    ...result,
    time: new Date().toISOString(),
  });
}
