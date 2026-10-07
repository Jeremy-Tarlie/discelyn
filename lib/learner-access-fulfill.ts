import { prisma } from "@/lib/prisma";
import {
  createSingleUseInvite,
  grantGuildRole,
  postGuildLog,
  sendUserDm,
} from "@/lib/discord-roles";
import { parseBotConfig } from "@/lib/bot-config";
import { parseOnboardingSteps } from "@/lib/access-seats";
import { expandGuildRoleTargets } from "@/lib/guild-grants-pure";
import { decideGrantOutcome, type GrantAttemptKind } from "@/lib/grant-outcome-pure";
import { notifyOutbound, recordEvent } from "@/lib/learner-access-events";
import { revokeLearnerAccess } from "@/lib/learner-access-revoke";

type GuildGrantRow = {
  guildId: string;
  discordRoleId: string;
  botId: string;
  bot: { config: unknown };
};

export async function loadGuildGrants(productId: string): Promise<GuildGrantRow[]> {
  const grants = await prisma.accessProductGuildGrant.findMany({
    where: { accessProductId: productId },
    include: { bot: { select: { config: true } } },
  });
  return grants.map((g) => ({
    guildId: g.guildId,
    discordRoleId: g.discordRoleId,
    botId: g.botId,
    bot: g.bot,
  }));
}

export async function ensurePrimaryGrant(input: {
  productId: string;
  botId: string;
  guildId: string;
  discordRoleId: string;
}): Promise<void> {
  await prisma.accessProductGuildGrant.upsert({
    where: {
      accessProductId_botId: {
        accessProductId: input.productId,
        botId: input.botId,
      },
    },
    create: {
      accessProductId: input.productId,
      botId: input.botId,
      guildId: input.guildId,
      discordRoleId: input.discordRoleId,
    },
    update: {
      guildId: input.guildId,
      discordRoleId: input.discordRoleId,
    },
  });
}

/** Claim OAuth ou metadata : tente le grant de rôle (tous les guild grants). */
export async function fulfillDiscordAccess(
  learnerAccessId: string,
  discordUserId?: string
): Promise<{
  status: "ACTIVE" | "AWAITING_JOIN" | "EXPIRED" | "REVOKED" | "PENDING_CLAIM";
  inviteUrl: string | null;
  error: string | null;
}> {
  const access = await prisma.learnerAccess.findUnique({
    where: { id: learnerAccessId },
    include: {
      product: { include: { bot: { select: { organizationId: true } } } },
      bot: { select: { config: true, guildId: true, organizationId: true } },
    },
  });
  if (!access) {
    return { status: "PENDING_CLAIM", inviteUrl: null, error: "not_found" };
  }
  if (access.status === "REVOKED" || access.status === "EXPIRED") {
    return {
      status: access.status,
      inviteUrl: null,
      error: "access_closed",
    };
  }
  if (
    access.product.accessEndsAt &&
    access.product.accessEndsAt.getTime() < Date.now()
  ) {
    await revokeLearnerAccess(access.id, "cohort_ended");
    return { status: "EXPIRED", inviteUrl: null, error: "cohort_ended" };
  }

  const userId = discordUserId ?? access.discordUserId;
  if (!userId) {
    return {
      status: "PENDING_CLAIM",
      inviteUrl: null,
      error: "discord_required",
    };
  }

  const grantRows = await loadGuildGrants(access.accessProductId);
  const targets = expandGuildRoleTargets({
    primaryGuildId: access.guildId,
    primaryRoleId: access.product.discordRoleId,
    grants: grantRows.map((g) => ({
      guildId: g.guildId,
      discordRoleId: g.discordRoleId,
    })),
  }).map((t) => {
    const row = grantRows.find((g) => g.guildId === t.guildId);
    return {
      guildId: t.guildId,
      discordRoleId: t.discordRoleId,
      bot: row?.bot ?? access.bot,
    };
  });

  const attempts: GrantAttemptKind[] = [];
  let primaryInvite: string | null = null;
  let lastError: string | null = null;

  for (const grant of targets) {
    const result = await grantGuildRole({
      guildId: grant.guildId,
      discordUserId: userId,
      roleId: grant.discordRoleId,
    });
    if (!result.ok) {
      lastError = result.error;
      attempts.push("failed");
      await recordEvent(access.id, "role_grant_failed", {
        error: result.error,
        guildId: grant.guildId,
      });
      continue;
    }
    if (result.inGuild) {
      attempts.push("granted");
    } else {
      attempts.push("absent");
      if (!primaryInvite) {
        const config = parseBotConfig(grant.bot.config);
        primaryInvite =
          access.inviteUrl ??
          (await createSingleUseInvite(
            grant.guildId,
            config.welcomeChannelId || null
          ));
      }
    }
  }

  const outcome = decideGrantOutcome(attempts);

  if (outcome.status === "AWAITING_JOIN") {
    const invite = primaryInvite ?? access.inviteUrl;
    await prisma.learnerAccess.update({
      where: { id: access.id },
      data: {
        discordUserId: userId,
        status: "AWAITING_JOIN",
        inviteUrl: invite,
        claimToken: null,
        claimTokenExpiresAt: null,
      },
    });
    await recordEvent(access.id, "awaiting_join", {
      discordUserId: userId,
      grantedCount: outcome.grantedCount,
      absentCount: outcome.absentCount,
    });
    return {
      status: "AWAITING_JOIN",
      inviteUrl: invite,
      error: null,
    };
  }

  if (outcome.status === "blocked") {
    return {
      status: access.status,
      inviteUrl: access.inviteUrl,
      error: lastError ?? "grant_incomplete",
    };
  }

  const steps = parseOnboardingSteps(access.product.onboardingSteps);
  const welcomeDm =
    steps[0]?.trim() ||
    access.product.welcomeDm?.trim() ||
    `Bienvenue — ton accès « ${access.product.name} » est actif sur Discord.`;

  await prisma.learnerAccess.update({
    where: { id: access.id },
    data: {
      discordUserId: userId,
      status: "ACTIVE",
      grantedAt: new Date(),
      claimToken: null,
      claimTokenExpiresAt: null,
      inviteUrl: null,
      onboardingStep: steps.length > 0 ? 1 : 0,
      onboardingLastSentAt: new Date(),
    },
  });
  await recordEvent(access.id, "role_granted", {
    discordUserId: userId,
    grantedCount: outcome.grantedCount,
  });
  await notifyOutbound(access.bot.organizationId, "role_granted", {
    accessId: access.id,
    productId: access.accessProductId,
    discordUserId: userId,
  });

  await sendUserDm({ discordUserId: userId, content: welcomeDm });

  for (const grant of targets) {
    const logsChannelId = parseBotConfig(grant.bot.config).logsChannelId;
    if (logsChannelId) {
      await postGuildLog({
        channelId: logsChannelId,
        content: `💳 Accès activé : <@${userId}> → **${access.product.name}**`,
      });
    }
  }

  return { status: "ACTIVE", inviteUrl: null, error: null };
}

/** Appelé au join Discord (runtime) pour les AWAITING_JOIN. */
export async function grantPendingOnJoin(input: {
  guildId: string;
  discordUserId: string;
}): Promise<number> {
  const pending = await prisma.learnerAccess.findMany({
    where: {
      status: "AWAITING_JOIN",
      discordUserId: input.discordUserId,
      OR: [
        { guildId: input.guildId },
        { product: { guildGrants: { some: { guildId: input.guildId } } } },
      ],
    },
    include: {
      product: true,
      bot: { select: { config: true, organizationId: true } },
    },
  });

  let granted = 0;
  for (const access of pending) {
    const result = await fulfillDiscordAccess(
      access.id,
      input.discordUserId
    );
    if (result.status === "ACTIVE") granted += 1;
  }
  return granted;
}
