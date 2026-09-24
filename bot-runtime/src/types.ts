import type { Guild } from "discord.js";
import type { WarningEntry } from "./helpers.js";

export type GuildBotConfig = {
  id: string;
  name: string;
  guildId: string;
  enabledModules: string[];
  config: Record<string, unknown>;
  customCommands: Array<{ name: string; response: string }>;
  forceBranding: boolean;
  /** Boutique accès (Payment Links) — slash /boutique */
  shop: Array<{ name: string; pitch: string | null; url: string }>;
};

export type WarningRepository = {
  add: (
    botId: string,
    guildId: string,
    targetUserId: string,
    entry: WarningEntry
  ) => Promise<number>;
  list: (
    botId: string,
    guildId: string,
    targetUserId: string
  ) => Promise<WarningEntry[]>;
  clear: (
    botId: string,
    guildId: string,
    targetUserId: string
  ) => Promise<number>;
};

export type ConfigProvider = {
  getByGuildId: (guildId: string) => GuildBotConfig | null;
  listGuildIds: () => string[];
};

/** Accès payant en attente de join Discord. */
export type LearnerAccessJoiner = {
  grantOnJoin: (guildId: string, discordUserId: string) => Promise<number>;
};

export async function sendLog(
  bot: GuildBotConfig,
  guild: Guild,
  text: string
): Promise<void> {
  if (!bot.enabledModules.includes("logs")) return;
  const logChannelId = asString(bot.config.logsChannelId);
  if (!logChannelId) return;
  const channel = guild.channels.cache.get(logChannelId);
  if (channel && channel.isTextBased() && "send" in channel) {
    await channel.send(text).catch(() => undefined);
  }
}

export function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function asPositiveInt(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback;
}
