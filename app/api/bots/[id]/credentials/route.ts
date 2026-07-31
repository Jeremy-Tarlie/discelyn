import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireUser,
  getUserSubscription,
  canUseProduct,
} from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { encryptSecret, buildBotInviteUrl } from "@/lib/crypto";
import { fetchDiscordBotIdentity } from "@/lib/discord";
import { provisionBot } from "@/lib/provisioning";
import { rateLimit } from "@/lib/rate-limit";

const credentialsSchema = z.object({
  token: z
    .string()
    .trim()
    .min(50, "Token trop court")
    .max(200, "Token trop long"),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const limited = rateLimit(request, {
    namespace: "bots-credentials",
    limit: 5,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const subscription = await getUserSubscription(user.id);
  const usable = canUseProduct(subscription);
  if (!usable.ok) {
    return NextResponse.json({ error: usable.reason }, { status: 403 });
  }

  const { id } = await context.params;
  const bot = await prisma.bot.findFirst({
    where: { id, userId: user.id },
  });

  if (!bot) {
    return NextResponse.json({ error: "Bot introuvable" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = credentialsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides" },
      { status: 400 }
    );
  }

  const identity = await fetchDiscordBotIdentity(parsed.data.token);
  if (!identity.ok) {
    return NextResponse.json({ error: identity.error }, { status: 400 });
  }

  const encrypted = encryptSecret(parsed.data.token);
  const inviteUrl = buildBotInviteUrl(identity.bot.id);

  await prisma.bot.update({
    where: { id: bot.id },
    data: {
      tokenCiphertext: encrypted.ciphertext,
      tokenNonce: encrypted.nonce,
      tokenAuthTag: encrypted.authTag,
      hasToken: true,
      discordAppId: identity.bot.id,
      inviteUrl,
      avatarUrl: identity.bot.avatar
        ? `https://cdn.discordapp.com/avatars/${identity.bot.id}/${identity.bot.avatar}.png`
        : null,
      name: bot.name || identity.bot.username,
      status: "PROVISIONING",
      lastError: null,
    },
  });

  const provision = await provisionBot({ botId: bot.id, hasToken: true });
  const finalBot = await prisma.bot.update({
    where: { id: bot.id },
    data: {
      status: provision.status,
      containerId: provision.containerId,
      lastError: provision.error,
    },
    select: {
      id: true,
      name: true,
      status: true,
      hasToken: true,
      inviteUrl: true,
      discordAppId: true,
      avatarUrl: true,
      lastError: true,
    },
  });

  return NextResponse.json({ bot: finalBot, identity: identity.bot });
}
