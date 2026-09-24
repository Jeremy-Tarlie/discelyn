/**
 * Discord REST helpers — bot plateforme + vérif ownership OAuth utilisateur.
 */

import { prisma } from "@/lib/prisma";
import {
  userCanManageGuild,
  type DiscordUserGuild,
} from "@/lib/discord-permissions";
import type { ApiMessageKey } from "@/lib/i18n-api";
import {
  isTokenEncryptionEnabled,
  requireSealToken,
  unsealToken,
} from "@/lib/token-crypto";

export type DiscordBotIdentity = {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
};

export { userCanManageGuild } from "@/lib/discord-permissions";
export type { DiscordUserGuild } from "@/lib/discord-permissions";

function platformBotToken(): string | null {
  const token = process.env.DISCORD_BOT_TOKEN;
  return token && token.length > 0 ? token : null;
}

async function refreshDiscordAccessToken(
  accountId: string,
  refreshToken: string
): Promise<string | null> {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const response = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
      cache: "no-store",
    });
    if (!response.ok) return null;

    const data = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!data.access_token) return null;

    const expiresAt =
      typeof data.expires_in === "number"
        ? Math.floor(Date.now() / 1000) + data.expires_in
        : null;

    await prisma.account.update({
      where: { id: accountId },
      data: {
        access_token: isTokenEncryptionEnabled()
          ? requireSealToken(data.access_token, "oauth_access")
          : data.access_token,
        refresh_token: isTokenEncryptionEnabled()
          ? requireSealToken(
              data.refresh_token ?? refreshToken,
              "oauth_refresh"
            )
          : (data.refresh_token ?? refreshToken),
        expires_at: expiresAt,
      },
    });

    return data.access_token;
  } catch {
    return null;
  }
}

/** Récupère un access_token Discord utilisateur (rafraîchi si besoin). */
export async function getDiscordUserAccessToken(
  userId: string
): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "discord" },
    select: {
      id: true,
      access_token: true,
      refresh_token: true,
      expires_at: true,
    },
  });
  if (!account?.access_token) return null;

  let accessToken: string;
  let refreshToken: string | null = null;
  try {
    accessToken = unsealToken(account.access_token) ?? account.access_token;
    refreshToken =
      unsealToken(account.refresh_token) ?? account.refresh_token ?? null;
  } catch (error) {
    console.error("[discord] oauth token decrypt failed", error);
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const stillValid = !account.expires_at || account.expires_at > now + 60;
  if (stillValid) return accessToken;

  if (refreshToken) {
    const refreshed = await refreshDiscordAccessToken(account.id, refreshToken);
    if (refreshed) return refreshed;
  }

  return accessToken;
}

export type ManageableGuild = {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
};

export type DiscordGuildTextChannel = {
  id: string;
  name: string;
};

export type DiscordLocalizedError = { ok: false; code: ApiMessageKey };
export type DiscordTechnicalError = { ok: false; error: string };
export type DiscordFailure = DiscordLocalizedError | DiscordTechnicalError;

async function fetchUserGuildsRaw(
  userId: string
): Promise<
  | { ok: true; guilds: DiscordUserGuild[] }
  | DiscordFailure
> {
  const accessToken = await getDiscordUserAccessToken(userId);
  if (!accessToken) {
    return { ok: false, code: "discordSessionExpired" };
  }

  try {
    const response = await fetch(
      "https://discord.com/api/v10/users/@me/guilds",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      }
    );

    if (response.status === 401) {
      return { ok: false, code: "discordSessionExpired" };
    }
    if (!response.ok) {
      return {
        ok: false,
        error: `Discord API erreur HTTP ${response.status}`,
      };
    }

    const guilds = (await response.json()) as DiscordUserGuild[];
    if (!Array.isArray(guilds)) {
      return { ok: false, error: "Réponse Discord inattendue" };
    }
    return { ok: true, guilds };
  } catch {
    return { ok: false, error: "Impossible de joindre Discord" };
  }
}

/** Serveurs Discord où l'utilisateur peut installer / lier Botly. */
export async function listManageableGuilds(
  userId: string
): Promise<
  { ok: true; guilds: ManageableGuild[] } | DiscordFailure
> {
  const result = await fetchUserGuildsRaw(userId);
  if (!result.ok) return result;

  const guilds = result.guilds
    .filter(userCanManageGuild)
    .map((guild) => ({
      id: guild.id,
      name: typeof guild.name === "string" && guild.name.length > 0
        ? guild.name
        : `Serveur ${guild.id}`,
      icon: typeof guild.icon === "string" ? guild.icon : null,
      owner: guild.owner,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return { ok: true, guilds };
}

/**
 * Vérifie que l'utilisateur OAuth administre le serveur (owner / Manage Guild / Admin).
 */
export async function assertUserManagesGuild(
  userId: string,
  guildId: string
): Promise<{ ok: true } | DiscordFailure> {
  const result = await fetchUserGuildsRaw(userId);
  if (!result.ok) return result;

  const match = result.guilds.find((guild) => guild.id === guildId);
  if (!match) {
    return { ok: false, code: "discordNotMember" };
  }
  if (!userCanManageGuild(match)) {
    return { ok: false, code: "discordNotAdmin" };
  }
  return { ok: true };
}

const GUILD_TEXT = 0;
const GUILD_ANNOUNCEMENT = 5;

/** Salons textuels du serveur (bot plateforme doit être présent). */
export async function fetchGuildTextChannels(
  guildId: string
): Promise<
  | { ok: true; channels: DiscordGuildTextChannel[] }
  | DiscordFailure
> {
  const token = platformBotToken();
  if (!token) {
    return { ok: false, error: "DISCORD_BOT_TOKEN non configuré côté serveur" };
  }

  try {
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/channels`,
      {
        headers: { Authorization: `Bot ${token}` },
        cache: "no-store",
      }
    );

    if (response.status === 404 || response.status === 403) {
      return { ok: false, code: "discordBotMissing" };
    }
    if (!response.ok) {
      return {
        ok: false,
        error: `Discord API erreur HTTP ${response.status}`,
      };
    }

    const raw = (await response.json()) as Array<{
      id?: string;
      name?: string;
      type?: number;
    }>;
    if (!Array.isArray(raw)) {
      return { ok: false, error: "Réponse Discord inattendue" };
    }

    const channels = raw
      .filter(
        (channel) =>
          typeof channel.id === "string" &&
          typeof channel.name === "string" &&
          (channel.type === GUILD_TEXT || channel.type === GUILD_ANNOUNCEMENT)
      )
      .map((channel) => ({
        id: channel.id as string,
        name: channel.name as string,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));

    return { ok: true, channels };
  } catch {
    return { ok: false, error: "Impossible de joindre Discord" };
  }
}

export async function fetchPlatformBotIdentity(): Promise<
  { ok: true; bot: DiscordBotIdentity } | { ok: false; error: string }
> {
  const token = platformBotToken();
  if (!token) {
    return { ok: false, error: "DISCORD_BOT_TOKEN non configuré côté serveur" };
  }

  try {
    const response = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bot ${token}` },
      cache: "no-store",
    });

    if (response.status === 401) {
      return { ok: false, error: "Token bot plateforme invalide" };
    }
    if (!response.ok) {
      return {
        ok: false,
        error: `Discord API erreur HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as DiscordBotIdentity;
    if (!data.id || !data.username) {
      return { ok: false, error: "Réponse Discord inattendue" };
    }
    return { ok: true, bot: data };
  } catch {
    return { ok: false, error: "Impossible de joindre Discord" };
  }
}

/** Vérifie que le bot plateforme est bien membre du serveur. */
export async function assertBotInGuild(
  guildId: string
): Promise<{ ok: true } | DiscordFailure> {
  const token = platformBotToken();
  if (!token) {
    return { ok: false, error: "DISCORD_BOT_TOKEN non configuré côté serveur" };
  }

  try {
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}`,
      {
        headers: { Authorization: `Bot ${token}` },
        cache: "no-store",
      }
    );

    if (response.status === 404 || response.status === 403) {
      return { ok: false, code: "discordBotMissing" };
    }
    if (!response.ok) {
      return {
        ok: false,
        error: `Discord API erreur HTTP ${response.status}`,
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Impossible de joindre Discord" };
  }
}
