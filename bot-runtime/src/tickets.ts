import {
  ChannelType,
  PermissionFlagsBits,
  type Guild,
  type GuildMember,
} from "discord.js";
import type { GuildBotConfig } from "./types.js";
import { asString } from "./config-helpers.js";

export async function openTicketChannel(
  bot: GuildBotConfig,
  guild: Guild,
  opener: GuildMember,
  subject: string | null
): Promise<string> {
  const categoryId = asString(bot.config.ticketsCategoryId) || undefined;
  const staffRoleId = asString(bot.config.ticketsStaffRoleId) || undefined;
  const subjectLabels: Record<string, string> = {
    acces: "Accès / connexion",
    facturation: "Facturation",
    contenu: "Contenu / cours",
    autre: "Autre",
  };
  const subjectLabel =
    subject && subject in subjectLabels ? subjectLabels[subject] : null;
  const channel = await guild.channels.create({
    name: `ticket-${opener.user.username}`.slice(0, 90),
    type: ChannelType.GuildText,
    parent: categoryId,
    topic: `ticket-owner:${opener.id}`,
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: opener.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
        ],
      },
      ...(staffRoleId
        ? [
            {
              id: staffRoleId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ManageChannels,
              ],
            },
          ]
        : []),
    ],
  });
  if (channel.isTextBased() && "send" in channel) {
    const subjectLine = subjectLabel
      ? `\n**Sujet :** ${subjectLabel}`
      : "\nPrécise ton besoin : accès, facturation ou contenu de formation.";
    await channel
      .send(
        `${opener} — ticket support formation ouvert.${subjectLine}\nUn membre du staff te répond ici (hors chat général). Ferme avec \`!close\` quand c’est réglé.`
      )
      .catch(() => undefined);
  }
  return `Ticket ouvert : ${channel}`;
}
