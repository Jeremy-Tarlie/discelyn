import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Gate commun cron : secret présent + Bearer OK + rate-limit anti-bruteforce.
 */
export async function authorizeCronRequest(
  request: NextRequest,
  namespace: string
): Promise<NextResponse | null> {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET non configuré" },
      { status: 503 }
    );
  }

  const limited = await rateLimit(request, {
    namespace,
    limit: 30,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  return null;
}
