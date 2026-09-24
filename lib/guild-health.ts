/**
 * Santé du serveur Discord pour le bot plateforme (checklist orga).
 */

import {
  assertBotInGuild,
  fetchPlatformBotIdentity,
} from "@/lib/discord";
import { parseBotConfig } from "@/lib/bot-config";

function platformBotToken(): string | null {
  const token = process.env.DISCORD_BOT_TOKEN;
  return token && token.length > 0 ? token : null;
}

async function discordBotFetch(
  path: string
): Promise<Response | null> {
  const token = platformBotToken();
  if (!token) return null;
  return fetch(`https://discord.com/api/v10${path}`, {
    headers: { Authorization: `Bot ${token}` },
    cache: "no-store",
  });
}

const PERMS = {
  ADMINISTRATOR: BigInt(8),
  MANAGE_ROLES: BigInt(268435456),
  MANAGE_CHANNELS: BigInt(16),
  CREATE_INSTANT_INVITE: BigInt(1),
  VIEW_CHANNEL: BigInt(1024),
  SEND_MESSAGES: BigInt(2048),
} as const;

export type HealthStatus = "ok" | "warn" | "fail" | "skip";

export type HealthCheck = {
  id: string;
  status: HealthStatus;
  detail?: string;
};

type GuildRole = {
  id: string;
  name: string;
  position: number;
  permissions: string;
  managed?: boolean;
};

function hasPerm(perms: bigint, bit: bigint): boolean {
  return (perms & PERMS.ADMINISTRATOR) === PERMS.ADMINISTRATOR || (perms & bit) === bit;
}

function computeMemberPerms(
  roleIds: string[],
  rolesById: Map<string, GuildRole>,
  everyoneId: string
): { perms: bigint; highestPosition: number } {
  let perms = BigInt(0);
  let highestPosition = 0;
  const everyone = rolesById.get(everyoneId);
  if (everyone) {
    try {
      perms |= BigInt(everyone.permissions);
    } catch {
      /* ignore */
    }
  }
  for (const id of roleIds) {
    const role = rolesById.get(id);
    if (!role) continue;
    highestPosition = Math.max(highestPosition, role.position);
    try {
      perms |= BigInt(role.permissions);
    } catch {
      /* ignore */
    }
  }
  return { perms, highestPosition };
}

export async function evaluateGuildHealth(input: {
  guildId: string | null;
  botConfig: unknown;
  productRoleIds: string[];
}): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];

  if (!input.guildId) {
    checks.push({ id: "guild_linked", status: "fail" });
    checks.push({ id: "bot_in_guild", status: "skip" });
    checks.push({ id: "bot_manage_roles", status: "skip" });
    checks.push({ id: "bot_send_messages", status: "skip" });
    checks.push({ id: "role_hierarchy", status: "skip" });
    checks.push({ id: "welcome_channel", status: "skip" });
    checks.push({ id: "logs_channel", status: "skip" });
    checks.push({ id: "can_create_invite", status: "skip" });
    return checks;
  }

  checks.push({ id: "guild_linked", status: "ok" });

  const inGuild = await assertBotInGuild(input.guildId);
  if (!inGuild.ok) {
    checks.push({
      id: "bot_in_guild",
      status: "fail",
      detail: "code" in inGuild ? inGuild.code : inGuild.error,
    });
    for (const id of [
      "bot_manage_roles",
      "bot_send_messages",
      "role_hierarchy",
      "welcome_channel",
      "logs_channel",
      "can_create_invite",
    ] as const) {
      checks.push({ id, status: "skip" });
    }
    return checks;
  }
  checks.push({ id: "bot_in_guild", status: "ok" });

  const identity = await fetchPlatformBotIdentity();
  if (!identity.ok) {
    checks.push({
      id: "bot_manage_roles",
      status: "fail",
      detail: identity.error,
    });
    checks.push({ id: "bot_send_messages", status: "skip" });
    checks.push({ id: "role_hierarchy", status: "skip" });
    checks.push({ id: "welcome_channel", status: "skip" });
    checks.push({ id: "logs_channel", status: "skip" });
    checks.push({ id: "can_create_invite", status: "skip" });
    return checks;
  }

  const [memberRes, rolesRes] = await Promise.all([
    discordBotFetch(
      `/guilds/${input.guildId}/members/${identity.bot.id}`
    ),
    discordBotFetch(`/guilds/${input.guildId}/roles`),
  ]);

  if (!memberRes?.ok || !rolesRes?.ok) {
    checks.push({
      id: "bot_manage_roles",
      status: "fail",
      detail: "Impossible de lire rôles / membre bot",
    });
    checks.push({ id: "bot_send_messages", status: "skip" });
    checks.push({ id: "role_hierarchy", status: "skip" });
    checks.push({ id: "welcome_channel", status: "skip" });
    checks.push({ id: "logs_channel", status: "skip" });
    checks.push({ id: "can_create_invite", status: "skip" });
    return checks;
  }

  const member = (await memberRes.json()) as { roles?: string[] };
  const roles = (await rolesRes.json()) as GuildRole[];
  const rolesById = new Map(roles.map((r) => [r.id, r]));
  const { perms, highestPosition } = computeMemberPerms(
    member.roles ?? [],
    rolesById,
    input.guildId
  );

  checks.push({
    id: "bot_manage_roles",
    status: hasPerm(perms, PERMS.MANAGE_ROLES) ? "ok" : "fail",
  });
  checks.push({
    id: "bot_send_messages",
    status: hasPerm(perms, PERMS.SEND_MESSAGES) ? "ok" : "warn",
  });
  checks.push({
    id: "can_create_invite",
    status: hasPerm(perms, PERMS.CREATE_INSTANT_INVITE) ? "ok" : "warn",
  });

  if (input.productRoleIds.length === 0) {
    checks.push({ id: "role_hierarchy", status: "skip" });
  } else {
    let ok = true;
    const bad: string[] = [];
    for (const roleId of input.productRoleIds) {
      const role = rolesById.get(roleId);
      if (!role) {
        ok = false;
        bad.push(roleId);
        continue;
      }
      if (role.position >= highestPosition) {
        ok = false;
        bad.push(role.name);
      }
    }
    checks.push({
      id: "role_hierarchy",
      status: ok ? "ok" : "fail",
      detail: bad.length ? bad.slice(0, 3).join(", ") : undefined,
    });
  }

  const config = parseBotConfig(input.botConfig);
  checks.push({
    id: "welcome_channel",
    status: config.welcomeChannelId ? "ok" : "warn",
  });
  checks.push({
    id: "logs_channel",
    status: config.logsChannelId ? "ok" : "warn",
  });

  return checks;
}
