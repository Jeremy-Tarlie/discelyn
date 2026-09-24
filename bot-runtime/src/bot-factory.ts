import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  Partials,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type Message,
  type GuildMember,
  type MessageReaction,
  type PartialMessageReaction,
  type User,
  type PartialUser,
} from "discord.js";
import {
  emojiMatches,
  evaluateAutomod,
  isTicketChannelName,
  matchPrefixCommand,
  parseModerationCommand,
  parseReactionRoles,
  RecentMessageTracker,
  resolveWelcomeText,
  type ModerationAction,
} from "./helpers.js";
import { applyModerationAction } from "./moderation.js";
import { openTicketChannel } from "./tickets.js";
import {
  asBoolean,
  asPositiveInt,
  asString,
  asStringArray,
  sendLog,
  type ConfigProvider,
  type GuildBotConfig,
  type LearnerAccessJoiner,
  type WarningRepository,
} from "./types.js";

export type {
  ConfigProvider,
  GuildBotConfig,
  LearnerAccessJoiner,
  WarningRepository,
} from "./types.js";

async function applyModeration(
  bot: GuildBotConfig,
  message: Message,
  action: ModerationAction,
  warnings: WarningRepository
): Promise<string> {
  if (!message.guild || !message.member) {
    return "Action impossible hors serveur.";
  }
  return applyModerationAction(
    bot,
    message.guild,
    message.member,
    message.author.tag,
    action,
    warnings
  );
}

export function attachPlatformHandlers(
  client: Client,
  configs: ConfigProvider,
  warnings: WarningRepository,
  learnerAccess?: LearnerAccessJoiner
): void {
  const spamTracker = new RecentMessageTracker();

  client.once(Events.ClientReady, async (readyClient) => {
    console.log(`[platform] online as ${readyClient.user.tag}`);
    try {
      await readyClient.application.commands.set([
        new SlashCommandBuilder()
          .setName("ticket")
          .setDescription(
            "Ouvre un ticket support formation (accès, facturation, contenu)"
          )
          .addStringOption((option) =>
            option
              .setName("sujet")
              .setDescription("Type de demande")
              .setRequired(false)
              .addChoices(
                { name: "Accès / connexion", value: "acces" },
                { name: "Facturation", value: "facturation" },
                { name: "Contenu / cours", value: "contenu" },
                { name: "Autre", value: "autre" }
              )
          ),
        new SlashCommandBuilder()
          .setName("warn")
          .setDescription("Ajoute un avertissement à un membre")
          .addUserOption((option) =>
            option.setName("membre").setDescription("Cible").setRequired(true)
          )
          .addStringOption((option) =>
            option.setName("raison").setDescription("Motif").setRequired(false)
          ),
        new SlashCommandBuilder()
          .setName("kick")
          .setDescription("Expulse un membre")
          .addUserOption((option) =>
            option.setName("membre").setDescription("Cible").setRequired(true)
          )
          .addStringOption((option) =>
            option.setName("raison").setDescription("Motif").setRequired(false)
          ),
        new SlashCommandBuilder()
          .setName("ban")
          .setDescription("Bannit un membre")
          .addUserOption((option) =>
            option.setName("membre").setDescription("Cible").setRequired(true)
          )
          .addStringOption((option) =>
            option.setName("raison").setDescription("Motif").setRequired(false)
          ),
        new SlashCommandBuilder()
          .setName("close")
          .setDescription("Ferme le ticket du salon courant"),
        new SlashCommandBuilder()
          .setName("boutique")
          .setDescription(
            "Affiche les formations à acheter (paiement → accès Discord)"
          ),
      ]);
      console.log("[platform] slash commands registered");
    } catch (error) {
      console.error("[platform] slash register failed", error);
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    const bot = configs.getByGuildId(interaction.guild.id);
    if (!bot) {
      await interaction
        .reply({
          content: "Ce serveur n’est pas lié à Botly.",
          ephemeral: true,
        })
        .catch(() => undefined);
      return;
    }

    const member = await interaction.guild.members
      .fetch(interaction.user.id)
      .catch(() => null);
    if (!member) {
      await interaction
        .reply({ content: "Membre introuvable.", ephemeral: true })
        .catch(() => undefined);
      return;
    }

    if (interaction.commandName === "boutique") {
      const shop = bot.shop.filter((item) => item.url.startsWith("http"));
      if (shop.length === 0) {
        await interaction
          .reply({
            content:
              "Aucune formation en vente pour l’instant. Configure l’accès dans le dashboard Botly.",
            ephemeral: true,
          })
          .catch(() => undefined);
        return;
      }
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`Boutique — ${bot.name}`)
        .setDescription(
          shop
            .map(
              (item, i) =>
                `**${i + 1}. ${item.name}**${item.pitch ? `\n${item.pitch}` : ""}`
            )
            .join("\n\n")
            .slice(0, 4096)
        )
        .setFooter({
          text: "Paiement Stripe → accès Discord auto · Botly",
        });
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...shop.slice(0, 5).map((item) =>
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel(`Acheter — ${item.name}`.slice(0, 80))
            .setURL(item.url)
        )
      );
      await interaction
        .reply({ embeds: [embed], components: [row] })
        .catch(() => undefined);
      return;
    }

    if (interaction.commandName === "ticket") {
      if (!bot.enabledModules.includes("tickets")) {
        await interaction
          .reply({
            content: "Module tickets non activé sur ce plan.",
            ephemeral: true,
          })
          .catch(() => undefined);
        return;
      }
      try {
        const subject = interaction.options.getString("sujet");
        const result = await openTicketChannel(
          bot,
          interaction.guild,
          member,
          subject
        );
        await interaction.reply({ content: result, ephemeral: true });
        await sendLog(
          bot,
          interaction.guild,
          `🎫 ${interaction.user.tag}: ticket${subject ? ` (${subject})` : ""}`
        );
      } catch (error) {
        const detail =
          error instanceof Error ? error.message : "erreur inconnue";
        await interaction
          .reply({ content: `Échec: ${detail}`, ephemeral: true })
          .catch(() => undefined);
      }
      return;
    }

    if (interaction.commandName === "close") {
      if (!bot.enabledModules.includes("tickets")) {
        await interaction
          .reply({
            content: "Module tickets non activé sur ce plan.",
            ephemeral: true,
          })
          .catch(() => undefined);
        return;
      }
      const channel = interaction.channel;
      if (
        !channel ||
        !channel.isTextBased() ||
        !("name" in channel) ||
        typeof channel.name !== "string" ||
        !isTicketChannelName(channel.name) ||
        !("topic" in channel) ||
        !("delete" in channel)
      ) {
        await interaction
          .reply({
            content: "Cette commande ne fonctionne que dans un salon ticket.",
            ephemeral: true,
          })
          .catch(() => undefined);
        return;
      }

      const staffRoleId = asString(bot.config.ticketsStaffRoleId);
      const isStaff =
        Boolean(staffRoleId) && Boolean(member.roles.cache.has(staffRoleId));
      const topic =
        typeof channel.topic === "string" ? channel.topic : "";
      const ownerMatch = topic.match(/^ticket-owner:(\d{17,20})$/);
      const isAuthor = ownerMatch?.[1] === interaction.user.id;
      const canManage =
        isAuthor ||
        isStaff ||
        member.permissions.has(PermissionFlagsBits.ManageChannels);

      if (!canManage) {
        await interaction
          .reply({
            content: "Tu ne peux pas fermer ce ticket.",
            ephemeral: true,
          })
          .catch(() => undefined);
        return;
      }

      await interaction.reply({ content: "Fermeture du ticket…", ephemeral: true });
      await channel.delete("Ticket fermé").catch(() => undefined);
      return;
    }

    if (!bot.enabledModules.includes("moderation")) {
      await interaction
        .reply({
          content: "Module modération non activé sur ce plan.",
          ephemeral: true,
        })
        .catch(() => undefined);
      return;
    }

    const targetUser = interaction.options.getUser("membre", true);
    const reason =
      interaction.options.getString("raison")?.trim() || "Sans motif";
    let action: ModerationAction | null = null;
    if (interaction.commandName === "warn") {
      action = { type: "warn", targetId: targetUser.id, reason };
    } else if (interaction.commandName === "kick") {
      action = { type: "kick", targetId: targetUser.id, reason };
    } else if (interaction.commandName === "ban") {
      action = { type: "ban", targetId: targetUser.id, reason };
    }
    if (!action) return;

    try {
      const result = await applyModerationAction(
        bot,
        interaction.guild,
        member,
        interaction.user.tag,
        action,
        warnings
      );
      await interaction.reply({ content: result, ephemeral: true });
      await sendLog(
        bot,
        interaction.guild,
        `🛡️ ${interaction.user.tag}: ${result}`
      );
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "erreur inconnue";
      await interaction
        .reply({ content: `Échec: ${detail}`, ephemeral: true })
        .catch(() => undefined);
    }
  });

  client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
    if (learnerAccess) {
      const n = await learnerAccess
        .grantOnJoin(member.guild.id, member.id)
        .catch(() => 0);
      if (n > 0) {
        console.log(
          `[access] granted ${n} paid role(s) on join user=${member.id} guild=${member.guild.id}`
        );
      }
    }

    const bot = configs.getByGuildId(member.guild.id);
    if (!bot) return;

    if (bot.enabledModules.includes("welcome")) {
      const channelId = asString(bot.config.welcomeChannelId);
      const rulesChannelId = asString(bot.config.rulesChannelId);
      const rawMessage =
        asString(bot.config.welcomeMessage) ||
        "Tu es bien sur le Discord de la formation.\nLis {rules}, puis ouvre `/ticket` pour un souci d’accès, de facturation ou de contenu.";
      const body = resolveWelcomeText({
        template: rawMessage,
        memberMention: `${member}`,
        username: member.user.username,
        rulesChannelId,
        channels: member.guild.channels.cache.map((ch) => ({
          id: ch.id,
          name: typeof ch.name === "string" ? ch.name : "",
        })),
      });
      const welcomeText =
        bot.forceBranding && !/—\s*Botly\s*$/i.test(body.trim())
          ? `${body.trim()} — Botly`
          : body;

      if (channelId) {
        const channel = member.guild.channels.cache.get(channelId);
        if (channel && channel.isTextBased() && "send" in channel) {
          const embed = new EmbedBuilder()
            .setColor(0x3dcfb0)
            .setTitle(`Bienvenue — ${bot.name}`)
            .setDescription(welcomeText.slice(0, 4096))
            .addFields({
              name: "Support formation",
              value:
                "Besoin d’aide ? `/ticket` → accès · facturation · contenu (hors chat général).",
            })
            .setFooter({ text: "Botly · ops Discord pour organismes de formation" });
          await channel
            .send({ content: `${member}`, embeds: [embed] })
            .catch(() => undefined);
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
      await sendLog(
        bot,
        member.guild,
        `📥 ${member.user.tag} a rejoint le serveur.`
      );
    }
  });

  client.on(Events.GuildMemberRemove, async (member) => {
    if (!member.guild) return;
    const bot = configs.getByGuildId(member.guild.id);
    if (!bot?.enabledModules.includes("logs")) return;
    await sendLog(
      bot,
      member.guild,
      `📤 ${member.user?.tag ?? member.id} a quitté le serveur.`
    );
  });

  async function handleReactionRole(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
    add: boolean
  ): Promise<void> {
    if (user.bot || !reaction.message.guild) return;
    const bot = configs.getByGuildId(reaction.message.guild.id);
    if (!bot?.enabledModules.includes("roles")) return;

    const reactionRoles = parseReactionRoles(bot.config.reactionRoles);
    if (reactionRoles.length === 0) return;

    if (reaction.partial) await reaction.fetch().catch(() => null);
    if (user.partial) await user.fetch().catch(() => null);

    const emoji = reaction.emoji.id
      ? reaction.emoji.identifier
      : (reaction.emoji.name ?? "");
    if (!emoji) return;

    const match = reactionRoles.find(
      (role) =>
        role.messageId === reaction.message.id &&
        emojiMatches(emoji, role.emoji)
    );
    if (!match) return;

    const member = await reaction.message.guild.members
      .fetch(user.id)
      .catch(() => null);
    if (!member) return;

    if (add) {
      await member.roles.add(match.roleId).catch(() => undefined);
    } else {
      await member.roles.remove(match.roleId).catch(() => undefined);
    }
  }

  client.on(Events.MessageReactionAdd, (reaction, user) => {
    void handleReactionRole(reaction, user, true);
  });
  client.on(Events.MessageReactionRemove, (reaction, user) => {
    void handleReactionRole(reaction, user, false);
  });

  client.on(Events.MessageCreate, async (message: Message) => {
    if (message.author.bot || !message.guild) return;
    const bot = configs.getByGuildId(message.guild.id);
    if (!bot) return;

    if (bot.enabledModules.includes("automod")) {
      const spam =
        asBoolean(bot.config.blockSpam, true) &&
        spamTracker.isSpam(message.author.id, message.content);
      const hit = spam
        ? ({ kind: "spam" } as const)
        : evaluateAutomod(message.content, {
            bannedWords: asStringArray(bot.config.bannedWords),
            blockInvites: asBoolean(bot.config.blockInvites, true),
            blockLinks: asBoolean(bot.config.blockLinks, false),
            maxMentions: asPositiveInt(bot.config.maxMentions, 5),
          });

      if (hit) {
        await message.delete().catch(() => undefined);
        const label =
          hit.kind === "banned_word"
            ? `mot interdit (${hit.detail})`
            : hit.kind === "invite"
              ? "invitation Discord"
              : hit.kind === "link"
                ? "lien"
                : hit.kind === "mentions"
                  ? `trop de mentions (${hit.count})`
                  : "spam";
        if (message.channel.isTextBased() && "send" in message.channel) {
          await message.channel
            .send(`${message.author}, message bloqué — ${label}.`)
            .catch(() => undefined);
        }
        await sendLog(
          bot,
          message.guild,
          `🤖 Automod ${label} — ${message.author.tag}`
        );
        return;
      }
    }

    if (bot.enabledModules.includes("moderation")) {
      const prefix = asString(bot.config.modPrefix, "!");
      const action = parseModerationCommand(message.content, prefix);
      if (action) {
        try {
          const result = await applyModeration(bot, message, action, warnings);
          await message.reply(result).catch(() => undefined);
          await sendLog(
            bot,
            message.guild,
            `🛡️ ${message.author.tag}: ${result}`
          );
        } catch (error) {
          const detail =
            error instanceof Error ? error.message : "erreur inconnue";
          await message
            .reply(`Échec de la commande: ${detail}`)
            .catch(() => undefined);
        }
        return;
      }
    }

    if (bot.enabledModules.includes("tickets")) {
      const content = message.content.trim().toLowerCase();
      if (content === "!ticket") {
        if (!message.member) {
          await message.reply("Action impossible hors serveur.");
          return;
        }
        try {
          const result = await openTicketChannel(
            bot,
            message.guild,
            message.member,
            null
          );
          await message.reply(result);
        } catch {
          await message.reply("Impossible de créer le ticket (permissions).");
        }
        return;
      }

      if (
        content === "!close" &&
        message.channel.isTextBased() &&
        "name" in message.channel &&
        typeof message.channel.name === "string" &&
        isTicketChannelName(message.channel.name) &&
        "topic" in message.channel
      ) {
        const staffRoleId = asString(bot.config.ticketsStaffRoleId);
        const isStaff =
          Boolean(staffRoleId) &&
          Boolean(message.member?.roles.cache.has(staffRoleId));
        const topic =
          typeof message.channel.topic === "string"
            ? message.channel.topic
            : "";
        const ownerMatch = topic.match(/^ticket-owner:(\d{17,20})$/);
        const isAuthor = ownerMatch?.[1] === message.author.id;
        const canManage =
          isAuthor ||
          isStaff ||
          Boolean(
            message.member?.permissions.has(PermissionFlagsBits.ManageChannels)
          );

        if (!canManage) {
          await message.reply("Tu ne peux pas fermer ce ticket.");
          return;
        }
        await message.reply("Fermeture du ticket…").catch(() => undefined);
        await message.channel.delete("Ticket fermé").catch(() => undefined);
        return;
      }
    }

    if (bot.enabledModules.includes("custom_commands")) {
      const matched = matchPrefixCommand(message.content, bot.customCommands);
      if (matched) {
        const response = matched + (bot.forceBranding ? "\n— Botly" : "");
        await message.reply(response);
      }
    }
  });
}

export function createPlatformClient(): Client {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildModeration,
    ],
    partials: [
      Partials.Channel,
      Partials.Message,
      Partials.Reaction,
      Partials.User,
    ],
  });
}
