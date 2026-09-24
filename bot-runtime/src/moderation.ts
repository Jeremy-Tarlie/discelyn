import type { Guild, GuildMember } from "discord.js";
import { PermissionFlagsBits } from "discord.js";
import type { ModerationAction, WarningEntry } from "./helpers.js";
import type { GuildBotConfig, WarningRepository } from "./types.js";

export function canModerate(
  member: GuildMember,
  action: ModerationAction
): boolean {
  const perms = member.permissions;
  switch (action.type) {
    case "kick":
      return perms.has(PermissionFlagsBits.KickMembers);
    case "ban":
      return perms.has(PermissionFlagsBits.BanMembers);
    case "timeout":
    case "untimeout":
      return perms.has(PermissionFlagsBits.ModerateMembers);
    case "warn":
    case "warnings":
    case "clearwarns":
      return (
        perms.has(PermissionFlagsBits.ModerateMembers) ||
        perms.has(PermissionFlagsBits.KickMembers) ||
        perms.has(PermissionFlagsBits.BanMembers)
      );
  }
}

export async function applyModerationAction(
  bot: GuildBotConfig,
  guild: Guild,
  moderator: GuildMember,
  moderatorTag: string,
  action: ModerationAction,
  warnings: WarningRepository
): Promise<string> {
  if (!canModerate(moderator, action)) {
    return "Permissions insuffisantes.";
  }

  const target = await guild.members.fetch(action.targetId).catch(() => null);

  if (!target) {
    return "Membre introuvable.";
  }

  if (
    !target.moderatable &&
    (action.type === "kick" ||
      action.type === "ban" ||
      action.type === "timeout" ||
      action.type === "untimeout")
  ) {
    return "Je ne peux pas modérer ce membre (rôle trop haut).";
  }

  switch (action.type) {
    case "kick":
      await target.kick(action.reason);
      return `👢 ${target.user.tag} expulsé — ${action.reason}`;
    case "ban":
      await target.ban({ reason: action.reason });
      return `🔨 ${target.user.tag} banni — ${action.reason}`;
    case "timeout": {
      await target.timeout(action.minutes * 60_000, action.reason);
      return `⏱️ ${target.user.tag} timeout ${action.minutes} min — ${action.reason}`;
    }
    case "untimeout":
      await target.timeout(null);
      return `✅ Timeout levé pour ${target.user.tag}`;
    case "warn": {
      const count = await warnings.add(bot.id, guild.id, action.targetId, {
        reason: action.reason,
        by: moderatorTag,
        at: Date.now(),
      } satisfies WarningEntry);
      return `⚠️ Warn ${target.user.tag} (${count}) — ${action.reason}`;
    }
    case "warnings": {
      const list = await warnings.list(bot.id, guild.id, action.targetId);
      if (list.length === 0) {
        return `Aucun warn pour ${target.user.tag}.`;
      }
      const lines = list
        .slice(-10)
        .map((entry, index) => `${index + 1}. ${entry.reason} — par ${entry.by}`)
        .join("\n");
      return `Warns ${target.user.tag} (${list.length}) :\n${lines}`;
    }
    case "clearwarns": {
      const cleared = await warnings.clear(bot.id, guild.id, action.targetId);
      return `Warns effacés pour ${target.user.tag} (${cleared}).`;
    }
  }
}
