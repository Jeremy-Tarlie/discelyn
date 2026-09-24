import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { appBaseUrl, fulfillDiscordAccess } from "@/lib/learner-access";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

type DiscordTokenResponse = {
  access_token?: string;
  error?: string;
};

type DiscordUserResponse = {
  id?: string;
};

/**
 * Callback OAuth Discord (scope identify) → grant rôle ou invite.
 */
export async function GET(request: NextRequest) {
  const limited = await rateLimit(request, {
    namespace: "access-claim-callback",
    limit: 40,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");

  if (oauthError || !code || !state) {
    return NextResponse.redirect(
      new URL(
        `/claim/${state ?? "unknown"}?error=oauth`,
        appBaseUrl()
      )
    );
  }

  const access = await prisma.learnerAccess.findFirst({
    where: {
      claimToken: state,
      status: "PENDING_CLAIM",
      claimTokenExpiresAt: { gt: new Date() },
    },
    select: { id: true, claimToken: true },
  });
  if (!access?.claimToken) {
    return NextResponse.redirect(
      new URL(`/claim/${state}?error=invalid`, appBaseUrl())
    );
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL(`/claim/${state}?error=config`, appBaseUrl())
    );
  }

  const redirectUri = `${appBaseUrl()}/api/access/claim/callback`;
  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
  });

  const tokenData = (await tokenRes.json()) as DiscordTokenResponse;
  if (!tokenRes.ok || !tokenData.access_token) {
    return NextResponse.redirect(
      new URL(`/claim/${state}?error=oauth`, appBaseUrl())
    );
  }

  const userRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
    cache: "no-store",
  });
  const userData = (await userRes.json()) as DiscordUserResponse;
  if (!userRes.ok || !userData.id) {
    return NextResponse.redirect(
      new URL(`/claim/${state}?error=oauth`, appBaseUrl())
    );
  }

  const result = await fulfillDiscordAccess(access.id, userData.id);
  if (result.status === "ACTIVE") {
    return NextResponse.redirect(
      new URL(`/claim/${state}?ok=active`, appBaseUrl())
    );
  }
  if (result.status === "AWAITING_JOIN") {
    const invite = result.inviteUrl
      ? `&invite=${encodeURIComponent(result.inviteUrl)}`
      : "";
    return NextResponse.redirect(
      new URL(`/claim/${state}?ok=join${invite}`, appBaseUrl())
    );
  }

  return NextResponse.redirect(
    new URL(`/claim/${state}?error=grant`, appBaseUrl())
  );
}
