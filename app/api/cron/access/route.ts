import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import {
  advanceOnboardingSteps,
  expireCohortAccesses,
  sendClaimReminders,
  sendExpiryReminders,
} from "@/lib/learner-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Cron accès : expirations, relances claim, J-N, onboarding (toutes les ~15 min). */
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

  const [expired, claimReminders, expiryReminders, onboarding] =
    await Promise.all([
      expireCohortAccesses(),
      sendClaimReminders(),
      sendExpiryReminders(),
      advanceOnboardingSteps(),
    ]);

  return NextResponse.json({
    expired,
    claimReminders,
    expiryReminders,
    onboarding,
    time: new Date().toISOString(),
  });
}
