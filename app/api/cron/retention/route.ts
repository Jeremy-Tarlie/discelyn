import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import {
  purgeExpiredAnalyticsEvents,
  purgeExpiredLeads,
} from "@/lib/data-retention";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Job rétention RGPD uniquement (analytics + leads).
 * Les jobs accès (claim / expiry) sont sur POST /api/cron/access.
 */
export async function POST(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET non configuré" },
      { status: 503 }
    );
  }
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const [analytics, leads] = await Promise.all([
    purgeExpiredAnalyticsEvents(),
    purgeExpiredLeads(),
  ]);

  return NextResponse.json({
    ok: true,
    purged: { analytics, leads },
    time: new Date().toISOString(),
  });
}
