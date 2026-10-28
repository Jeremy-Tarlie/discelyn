import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  revokeMarketingConsent,
  verifyUnsubscribeToken,
} from "@/lib/marketing-unsubscribe";

async function handleUnsubscribe(request: NextRequest): Promise<NextResponse> {
  const limited = await rateLimit(request, {
    namespace: "marketing-unsubscribe",
    limit: 30,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const urlToken = request.nextUrl.searchParams.get("token");
  let token = urlToken?.trim() ?? "";

  if (request.method === "POST") {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const form = await request.formData();
      const formToken = form.get("token");
      if (typeof formToken === "string" && formToken.trim()) {
        token = formToken.trim();
      }
    } else if (!token) {
      try {
        const body = (await request.json()) as { token?: string };
        if (typeof body.token === "string") token = body.token.trim();
      } catch {
        // token query only
      }
    }
  }

  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
  }

  const verified = verifyUnsubscribeToken(token);
  if (!verified.ok) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }

  await revokeMarketingConsent(verified.email);
  return NextResponse.json({ ok: true });
}

/** One-click List-Unsubscribe (RFC 8058). */
export async function POST(request: NextRequest) {
  return handleUnsubscribe(request);
}

export async function GET(request: NextRequest) {
  return handleUnsubscribe(request);
}
