import type { Locale } from "@/i18n/config";
import { tApi } from "@/lib/i18n-api";
import { z } from "zod";

const snowflakeFor = (locale: Locale) =>
  z
    .string()
    .trim()
    .regex(/^\d{17,20}$/, tApi(locale, "invalidDiscordId"));

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null));

export function accessProductCreateSchemaFor(locale: Locale) {
  return z.object({
    name: z.string().trim().min(2).max(80),
    stripePriceId: z
      .string()
      .trim()
      .regex(/^price_[a-zA-Z0-9]+$/, tApi(locale, "invalidStripePrice")),
    discordRoleId: snowflakeFor(locale),
    pitch: optionalText(280),
    welcomeDm: optionalText(1000),
    revokeOnRefund: z.boolean().optional().default(true),
    maxSeats: z.number().int().min(1).max(100_000).nullable().optional(),
    reminderDaysBefore: z.number().int().min(1).max(90).nullable().optional(),
    onboardingSteps: z
      .array(z.string().trim().min(1).max(1000))
      .max(5)
      .optional()
      .nullable(),
    brandName: optionalText(80),
    brandLogoUrl: z
      .union([z.string().trim().url().max(500), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    brandColor: z
      .union([
        z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/),
        z.literal(""),
        z.null(),
      ])
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    accessEndsAt: z
      .string()
      .datetime()
      .nullable()
      .optional()
      .transform((v) => (v ? new Date(v) : null)),
    sortOrder: z.number().int().min(0).max(999).optional(),
  });
}

export const accessProductCreateSchema = accessProductCreateSchemaFor("fr");

export function accessProductUpdateSchemaFor(locale: Locale) {
  return accessProductCreateSchemaFor(locale).partial().extend({
    active: z.boolean().optional(),
  });
}

export const accessProductUpdateSchema = accessProductUpdateSchemaFor("fr");

export function guildGrantSchemaFor(locale: Locale) {
  return z.object({
    botId: z.string().trim().min(1),
    discordRoleId: snowflakeFor(locale),
  });
}

export const guildGrantSchema = guildGrantSchemaFor("fr");

export function accessCodeCreateSchemaFor(locale: Locale) {
  return z.object({
    accessProductId: z.string().trim().min(1),
    maxRedemptions: z.number().int().min(1).max(10_000).optional().default(1),
    expiresAt: z
      .string()
      .datetime()
      .nullable()
      .optional()
      .transform((v) => (v ? new Date(v) : null)),
    code: z
      .string()
      .trim()
      .min(4)
      .max(32)
      .regex(/^[A-Za-z0-9_-]+$/)
      .optional(),
  });
}

export const accessCodeCreateSchema = accessCodeCreateSchemaFor("fr");

export function accessCodeRedeemSchemaFor(_locale: Locale) {
  return z.object({
    code: z.string().trim().min(4).max(32),
  });
}

export const accessCodeRedeemSchema = accessCodeRedeemSchemaFor("fr");

export function affiliateCreateSchemaFor(_locale: Locale) {
  return z.object({
    code: z
      .string()
      .trim()
      .min(2)
      .max(32)
      .regex(/^[a-zA-Z0-9_-]+$/),
    label: z.string().trim().min(2).max(80),
    commissionBps: z.number().int().min(0).max(10_000).optional().default(0),
  });
}

export const affiliateCreateSchema = affiliateCreateSchemaFor("fr");

export function outboundWebhookSchemaFor(_locale: Locale) {
  return z.object({
    url: z.string().trim().url().max(500),
    events: z
      .array(
        z.enum([
          "payment_received",
          "role_granted",
          "revoked",
          "expired",
          "sold_out",
        ])
      )
      .min(1),
    active: z.boolean().optional().default(true),
  });
}

export const outboundWebhookSchema = outboundWebhookSchemaFor("fr");

export function orgStripeConfigSchemaFor(locale: Locale) {
  return z.object({
    webhookSecret: z
      .string()
      .trim()
      .min(10)
      .regex(/^whsec_/, tApi(locale, "invalidWebhookSecret"))
      .optional(),
    stripeSecretKey: z
      .union([
        z.literal(""),
        z
          .string()
          .trim()
          .regex(/^sk_(test_|live_)/, tApi(locale, "invalidStripeSecret")),
      ])
      .optional(),
    label: z.string().trim().max(80).optional().nullable(),
    displayName: optionalText(80),
    logoUrl: z
      .union([z.string().trim().url().max(500), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    primaryColor: z
      .union([
        z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/),
        z.literal(""),
        z.null(),
      ])
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    supportUrl: z
      .union([z.string().trim().url().max(500), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
  });
}

export const orgStripeConfigSchema = orgStripeConfigSchemaFor("fr");

export function postShopSchemaFor(locale: Locale) {
  return z.object({
    channelId: snowflakeFor(locale),
  });
}

export const postShopSchema = postShopSchemaFor("fr");
