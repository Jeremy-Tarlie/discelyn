import type { Locale } from "@/i18n/config";
import { tApi } from "@/lib/i18n-api";
import { z } from "zod";

export function createBotSchemaFor(locale: Locale) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(2, tApi(locale, "nameTooShort"))
      .max(32, tApi(locale, "nameTooLong"))
      .regex(/^[\w\s\-àâäéèêëïîôùûüç]+$/i, tApi(locale, "invalidChars")),
    description: z.string().trim().max(300).optional(),
  });
}

export const createBotSchema = createBotSchemaFor("fr");

export const checkoutSchema = z.object({
  planId: z.enum(["STARTER", "OPS", "SCALE", "SETUP", "DIAGNOSTIC"]),
});

export function leadSchemaFor(locale: Locale) {
  return z.object({
    email: z.string().trim().email(),
    name: z.string().trim().min(1).max(120).optional(),
    company: z.string().trim().max(160).optional(),
    role: z.string().trim().max(120).optional(),
    message: z.string().trim().max(2000).optional(),
    offer: z
      .enum(["SETUP", "STARTER", "OPS", "SCALE", "DEMO", "DIAGNOSTIC", "OTHER"])
      .optional(),
    source: z.string().trim().max(64).optional(),
    marketingConsent: z
      .boolean()
      .refine((value) => value === true, {
        message: tApi(locale, "marketingConsentRequired"),
      }),
  });
}

export const leadSchema = leadSchemaFor("fr");

const snowflakeFor = (locale: Locale) =>
  z.string().regex(/^\d{17,20}$/, tApi(locale, "invalidDiscordId"));

const optionalSnowflakeFor = (locale: Locale) =>
  z.union([snowflakeFor(locale), z.literal("")]).optional();

export function reactionRoleSchemaFor(locale: Locale) {
  return z.object({
    messageId: snowflakeFor(locale),
    emoji: z.string().trim().min(1).max(64),
    roleId: snowflakeFor(locale),
  });
}

export const reactionRoleSchema = reactionRoleSchemaFor("fr");

export function botConfigSchemaFor(locale: Locale) {
  return z.object({
    welcomeChannelId: optionalSnowflakeFor(locale),
    welcomeMessage: z.string().max(1000).optional(),
    welcomeRoleId: optionalSnowflakeFor(locale),
    rulesChannelId: optionalSnowflakeFor(locale),
    logsChannelId: optionalSnowflakeFor(locale),
    bannedWords: z.array(z.string().trim().min(1).max(64)).max(100).optional(),
    modPrefix: z.string().min(1).max(5).optional(),
    ticketsCategoryId: optionalSnowflakeFor(locale),
    ticketsStaffRoleId: optionalSnowflakeFor(locale),
    blockInvites: z.boolean().optional(),
    blockLinks: z.boolean().optional(),
    blockSpam: z.boolean().optional(),
    maxMentions: z.number().int().min(0).max(50).optional(),
    reactionRoles: z.array(reactionRoleSchemaFor(locale)).max(50).optional(),
  });
}

export const botConfigSchema = botConfigSchemaFor("fr");

export function updateBotSchemaFor(locale: Locale) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(2, tApi(locale, "nameTooShort"))
      .max(32, tApi(locale, "nameTooLong"))
      .regex(/^[\w\s\-àâäéèêëïîôùûüç]+$/i, tApi(locale, "invalidChars"))
      .optional(),
    description: z.string().trim().max(300).nullable().optional(),
    enabledModules: z.array(z.string()).optional(),
    config: botConfigSchemaFor(locale).optional(),
    customCommands: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(32),
          description: z.string().trim().max(100).optional(),
          response: z.string().trim().min(1).max(2000),
        })
      )
      .max(50)
      .optional(),
  });
}

export const updateBotSchema = updateBotSchemaFor("fr");

export type CreateBotInput = z.infer<typeof createBotSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type BotConfigInput = z.infer<typeof botConfigSchema>;
export type UpdateBotInput = z.infer<typeof updateBotSchema>;

type SanitizedConfig = {
  welcomeChannelId?: string;
  welcomeMessage?: string;
  welcomeRoleId?: string;
  rulesChannelId?: string;
  logsChannelId?: string;
  bannedWords?: string[];
  modPrefix?: string;
  ticketsCategoryId?: string;
  ticketsStaffRoleId?: string;
  blockInvites?: boolean;
  blockLinks?: boolean;
  blockSpam?: boolean;
  maxMentions?: number;
  reactionRoles?: Array<{ messageId: string; emoji: string; roleId: string }>;
};

function emptyToUndefined(value: string | undefined): string | undefined {
  if (value === undefined || value === "") return undefined;
  return value;
}

export function sanitizeBotConfig(config: BotConfigInput): SanitizedConfig {
  const result: SanitizedConfig = {};
  const welcomeChannelId = emptyToUndefined(config.welcomeChannelId);
  const welcomeRoleId = emptyToUndefined(config.welcomeRoleId);
  const rulesChannelId = emptyToUndefined(config.rulesChannelId);
  const logsChannelId = emptyToUndefined(config.logsChannelId);
  const ticketsCategoryId = emptyToUndefined(config.ticketsCategoryId);
  const ticketsStaffRoleId = emptyToUndefined(config.ticketsStaffRoleId);

  if (welcomeChannelId !== undefined) result.welcomeChannelId = welcomeChannelId;
  if (config.welcomeMessage !== undefined)
    result.welcomeMessage = config.welcomeMessage;
  if (welcomeRoleId !== undefined) result.welcomeRoleId = welcomeRoleId;
  if (rulesChannelId !== undefined) result.rulesChannelId = rulesChannelId;
  if (logsChannelId !== undefined) result.logsChannelId = logsChannelId;
  if (config.bannedWords !== undefined) result.bannedWords = config.bannedWords;
  if (config.modPrefix !== undefined) result.modPrefix = config.modPrefix;
  if (ticketsCategoryId !== undefined)
    result.ticketsCategoryId = ticketsCategoryId;
  if (ticketsStaffRoleId !== undefined)
    result.ticketsStaffRoleId = ticketsStaffRoleId;
  if (config.blockInvites !== undefined)
    result.blockInvites = config.blockInvites;
  if (config.blockLinks !== undefined) result.blockLinks = config.blockLinks;
  if (config.blockSpam !== undefined) result.blockSpam = config.blockSpam;
  if (config.maxMentions !== undefined) result.maxMentions = config.maxMentions;
  if (config.reactionRoles !== undefined)
    result.reactionRoles = config.reactionRoles;
  return result;
}
