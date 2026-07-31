import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  PermissionFlagsBits,
  type Message,
  type GuildMember,
} from "discord.js";

export type RuntimeBotConfig = {
  id: string;
  name: string;
  token: string;
  enabledModules: string[];
  config: Record<string, unknown>;
  customCommands: Array<{ name: string; response: string }>;
  forceBranding: boolean;
};

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function createBotClient(bot: RuntimeBotConfig): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildModeration,
    ],
    partials: [Partials.Channel],
  });

  client.once(Events.ClientReady, (readyClient) => {
    console.log(`[${bot.id}] online as ${readyClient.user.tag}`);
  });

  client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
    if (bot.enabledModules.includes("welcome")) {
      const channelId = asString(bot.config.welcomeChannelId);
      const message =
        asString(bot.config.welcomeMessage) ||
        `Bienvenue ${member} !` +
          (bot.forceBranding ? " (powered by Botly)" : "");

      if (channelId) {
        const channel = member.guild.channels.cache.get(channelId);
        if (channel && channel.isTextBased() && "send" in channel) {
          await channel.send(message).catch(() => undefined);
        }
      }

      const roleId = asString(bot.config.welcomeRoleId);
      if (roleId) {
        const role = member.guild.roles.cache.get(roleId);
        if (role) {
          await member.roles.add(role).catch(() => undefined);
        }
      }
    }

    if (bot.enabledModules.includes("logs")) {
      const logChannelId = asString(bot.config.logsChannelId);
      if (logChannelId) {
        const channel = member.guild.channels.cache.get(logChannelId);
        if (channel && channel.isTextBased() && "send" in channel) {
          await channel
            .send(`📥 ${member.user.tag} a rejoint le serveur.`)
            .catch(() => undefined);
        }
      }
    }
  });

  client.on(Events.GuildMemberRemove, async (member) => {
    if (!bot.enabledModules.includes("logs")) return;
    const logChannelId = asString(bot.config.logsChannelId);
    if (!logChannelId || !member.guild) return;
    const channel = member.guild.channels.cache.get(logChannelId);
    if (channel && channel.isTextBased() && "send" in channel) {
      await channel
        .send(`📤 ${member.user?.tag ?? member.id} a quitté le serveur.`)
        .catch(() => undefined);
    }
  });

  client.on(Events.MessageCreate, async (message: Message) => {
    if (message.author.bot || !message.guild) return;

    if (bot.enabledModules.includes("automod")) {
      const banned = asStringArray(bot.config.bannedWords).map((word) =>
        word.toLowerCase()
      );
      const content = message.content.toLowerCase();
      if (banned.some((word) => word && content.includes(word))) {
        await message.delete().catch(() => undefined);
        await message.channel
          .send(`${message.author}, message bloqué par l'automod.`)
          .catch(() => undefined);
        return;
      }
    }

    if (bot.enabledModules.includes("moderation")) {
      const prefix = asString(bot.config.modPrefix, "!");
      if (message.content.startsWith(`${prefix}ping`)) {
        await message.reply("Pong.");
        return;
      }
    }

    if (
      bot.enabledModules.includes("tickets") &&
      message.content.trim().toLowerCase() === "!ticket"
    ) {
      const categoryId = asString(bot.config.ticketsCategoryId) || undefined;
      const channel = await message.guild.channels
        .create({
          name: `ticket-${message.author.username}`.slice(0, 90),
          type: ChannelType.GuildText,
          parent: categoryId,
          permissionOverwrites: [
            {
              id: message.guild.id,
              deny: [PermissionFlagsBits.ViewChannel],
            },
            {
              id: message.author.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
              ],
            },
          ],
        })
        .catch(() => null);

      if (channel) {
        await message.reply(`Ticket créé : ${channel}`);
      } else {
        await message.reply("Impossible de créer le ticket (permissions).");
      }
      return;
    }

    if (bot.enabledModules.includes("custom_commands")) {
      const content = message.content.trim().toLowerCase();
      for (const command of bot.customCommands) {
        const trigger = command.name.startsWith("/")
          ? command.name.slice(1).toLowerCase()
          : command.name.toLowerCase();
        if (content === `!${trigger}` || content === `/${trigger}`) {
          const response =
            command.response + (bot.forceBranding ? "\n— Botly" : "");
          await message.reply(response);
          return;
        }
      }
    }
  });

  return client;
}
