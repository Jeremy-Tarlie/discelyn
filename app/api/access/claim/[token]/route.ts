import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { appBaseUrl } from "@/lib/learner-access";
import { claimPageUrl, sanitizeClaimToken } from "@/lib/claim-redirect";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ token: string }>;
};

/**
 * Démarre l’OAuth Discord pour claimer un accès apprenant.
 * Redirect URI à enregistrer : {APP}/api/access/claim/callback
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const limited = await rateLimit(request, {
    namespace: "access-claim-start",
    limit: 40,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const { token: rawToken } = await context.params;
  const token = sanitizeClaimToken(rawToken);
  if (!token) {
    return NextResponse.redirect(claimPageUrl(null, { error: "invalid" }));
  }

  const access = await prisma.learnerAccess.findFirst({
    where: {
      claimToken: token,
      status: "PENDING_CLAIM",
      claimTokenExpiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  if (!access) {
    return NextResponse.redirect(claimPageUrl(token, { error: "invalid" }));
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(claimPageUrl(token, { error: "config" }));
  }

  const redirectUri = `${appBaseUrl()}/api/access/claim/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: "identify",
    redirect_uri: redirectUri,
    state: token,
  });

  return NextResponse.redirect(
    `https://discord.com/api/oauth2/authorize?${params.toString()}`
  );
}
