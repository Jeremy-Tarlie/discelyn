import { z } from "zod";

const snowflake = z
  .string()
  .trim()
  .regex(/^\d{17,20}$/, "ID Discord invalide");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null));

export const accessProductCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  stripePriceId: z
    .string()
    .trim()
    .regex(/^price_[a-zA-Z0-9]+$/, "Price ID Stripe invalide (price_…)"),
  discordRoleId: snowflake,
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

export const accessProductUpdateSchema = accessProductCreateSchema
  .partial()
  .extend({
    active: z.boolean().optional(),
  });

export const guildGrantSchema = z.object({
  botId: z.string().trim().min(1),
  discordRoleId: snowflake,
});

export const accessCodeCreateSchema = z.object({
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

export const accessCodeRedeemSchema = z.object({
  code: z.string().trim().min(4).max(32),
});

export const affiliateCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[a-zA-Z0-9_-]+$/),
  label: z.string().trim().min(2).max(80),
  commissionBps: z.number().int().min(0).max(10_000).optional().default(0),
});

export const outboundWebhookSchema = z.object({
  url: z.string().trim().url().max(500),
  events: z
    .array(
      z.enum(["payment_received", "role_granted", "revoked", "expired"])
    )
    .min(1),
  active: z.boolean().optional().default(true),
});

export const orgStripeConfigSchema = z.object({
  webhookSecret: z
    .string()
    .trim()
    .min(10)
    .regex(/^whsec_/, "Secret webhook Stripe invalide (whsec_…)")
    .optional(),
  stripeSecretKey: z
    .union([
      z.literal(""),
      z
        .string()
        .trim()
        .regex(/^sk_(test_|live_)/, "Clé secrète Stripe invalide"),
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

export const postShopSchema = z.object({
  channelId: snowflake,
});
