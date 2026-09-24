import { z } from "zod";

/** Forme UI / API du config bot — parsing souple depuis JSON Prisma. */
export const botConfigViewSchema = z.object({
  welcomeChannelId: z.string().optional().default(""),
  welcomeMessage: z.string().optional().default(""),
  welcomeRoleId: z.string().optional().default(""),
  rulesChannelId: z.string().optional().default(""),
  logsChannelId: z.string().optional().default(""),
  bannedWords: z.array(z.string()).optional().default([]),
  modPrefix: z.string().optional().default("!"),
  ticketsCategoryId: z.string().optional().default(""),
  ticketsStaffRoleId: z.string().optional().default(""),
  blockInvites: z.boolean().optional().default(true),
  blockLinks: z.boolean().optional().default(false),
  blockSpam: z.boolean().optional().default(true),
  maxMentions: z.number().optional().default(5),
  reactionRoles: z
    .array(
      z.object({
        messageId: z.string(),
        emoji: z.string(),
        roleId: z.string(),
      })
    )
    .optional()
    .default([]),
});

export type BotConfigView = z.infer<typeof botConfigViewSchema>;

export function parseBotConfig(value: unknown): BotConfigView {
  const record =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const bannedWords = Array.isArray(record.bannedWords)
    ? record.bannedWords.filter((item): item is string => typeof item === "string")
    : [];

  const reactionRoles = Array.isArray(record.reactionRoles)
    ? record.reactionRoles.flatMap((item) => {
        if (typeof item !== "object" || item === null) return [];
        const row = item as Record<string, unknown>;
        if (
          typeof row.messageId !== "string" ||
          typeof row.emoji !== "string" ||
          typeof row.roleId !== "string"
        ) {
          return [];
        }
        return [
          {
            messageId: row.messageId,
            emoji: row.emoji,
            roleId: row.roleId,
          },
        ];
      })
    : [];

  return botConfigViewSchema.parse({
    welcomeChannelId:
      typeof record.welcomeChannelId === "string" ? record.welcomeChannelId : "",
    welcomeMessage:
      typeof record.welcomeMessage === "string" ? record.welcomeMessage : "",
    welcomeRoleId:
      typeof record.welcomeRoleId === "string" ? record.welcomeRoleId : "",
    rulesChannelId:
      typeof record.rulesChannelId === "string" ? record.rulesChannelId : "",
    logsChannelId:
      typeof record.logsChannelId === "string" ? record.logsChannelId : "",
    bannedWords,
    modPrefix: typeof record.modPrefix === "string" ? record.modPrefix : "!",
    ticketsCategoryId:
      typeof record.ticketsCategoryId === "string"
        ? record.ticketsCategoryId
        : "",
    ticketsStaffRoleId:
      typeof record.ticketsStaffRoleId === "string"
        ? record.ticketsStaffRoleId
        : "",
    blockInvites:
      typeof record.blockInvites === "boolean" ? record.blockInvites : true,
    blockLinks:
      typeof record.blockLinks === "boolean" ? record.blockLinks : false,
    blockSpam: typeof record.blockSpam === "boolean" ? record.blockSpam : true,
    maxMentions:
      typeof record.maxMentions === "number" ? record.maxMentions : 5,
    reactionRoles,
  });
}
