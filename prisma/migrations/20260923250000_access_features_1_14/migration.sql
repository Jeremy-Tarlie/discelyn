-- Access features 1-14 schema expansion

CREATE TYPE "AccessBillingMode" AS ENUM ('ONE_TIME', 'RECURRING');
CREATE TYPE "LearnerAccessSource" AS ENUM ('STRIPE', 'ACCESS_CODE', 'MANUAL');

-- OrgStripeConfig branding
ALTER TABLE "OrgStripeConfig" ADD COLUMN IF NOT EXISTS "displayName" TEXT;
ALTER TABLE "OrgStripeConfig" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "OrgStripeConfig" ADD COLUMN IF NOT EXISTS "primaryColor" TEXT;
ALTER TABLE "OrgStripeConfig" ADD COLUMN IF NOT EXISTS "supportUrl" TEXT;

-- AccessProduct expansions
ALTER TABLE "AccessProduct" ADD COLUMN IF NOT EXISTS "billingMode" "AccessBillingMode" NOT NULL DEFAULT 'ONE_TIME';
ALTER TABLE "AccessProduct" ADD COLUMN IF NOT EXISTS "maxSeats" INTEGER;
ALTER TABLE "AccessProduct" ADD COLUMN IF NOT EXISTS "seatsUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AccessProduct" ADD COLUMN IF NOT EXISTS "reminderDaysBefore" INTEGER DEFAULT 7;
ALTER TABLE "AccessProduct" ADD COLUMN IF NOT EXISTS "onboardingSteps" JSONB;
ALTER TABLE "AccessProduct" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AccessProduct" ADD COLUMN IF NOT EXISTS "brandName" TEXT;
ALTER TABLE "AccessProduct" ADD COLUMN IF NOT EXISTS "brandLogoUrl" TEXT;
ALTER TABLE "AccessProduct" ADD COLUMN IF NOT EXISTS "brandColor" TEXT;

-- LearnerAccess expansions
ALTER TABLE "LearnerAccess" ADD COLUMN IF NOT EXISTS "source" "LearnerAccessSource" NOT NULL DEFAULT 'STRIPE';
ALTER TABLE "LearnerAccess" ADD COLUMN IF NOT EXISTS "amountTotal" INTEGER;
ALTER TABLE "LearnerAccess" ADD COLUMN IF NOT EXISTS "currency" TEXT;
ALTER TABLE "LearnerAccess" ADD COLUMN IF NOT EXISTS "amountSubtotal" INTEGER;
ALTER TABLE "LearnerAccess" ADD COLUMN IF NOT EXISTS "claimReminderSentAt" TIMESTAMP(3);
ALTER TABLE "LearnerAccess" ADD COLUMN IF NOT EXISTS "claimReminderCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LearnerAccess" ADD COLUMN IF NOT EXISTS "expiryReminderSentAt" TIMESTAMP(3);
ALTER TABLE "LearnerAccess" ADD COLUMN IF NOT EXISTS "onboardingStep" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LearnerAccess" ADD COLUMN IF NOT EXISTS "onboardingLastSentAt" TIMESTAMP(3);
ALTER TABLE "LearnerAccess" ADD COLUMN IF NOT EXISTS "affiliateId" TEXT;

CREATE TABLE IF NOT EXISTS "AccessProductGuildGrant" (
    "id" TEXT NOT NULL,
    "accessProductId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "discordRoleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccessProductGuildGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AccessProductGuildGrant_accessProductId_botId_key"
  ON "AccessProductGuildGrant"("accessProductId", "botId");
CREATE INDEX IF NOT EXISTS "AccessProductGuildGrant_guildId_idx" ON "AccessProductGuildGrant"("guildId");
CREATE INDEX IF NOT EXISTS "AccessProductGuildGrant_botId_idx" ON "AccessProductGuildGrant"("botId");

ALTER TABLE "AccessProductGuildGrant"
  DROP CONSTRAINT IF EXISTS "AccessProductGuildGrant_accessProductId_fkey";
ALTER TABLE "AccessProductGuildGrant"
  ADD CONSTRAINT "AccessProductGuildGrant_accessProductId_fkey"
  FOREIGN KEY ("accessProductId") REFERENCES "AccessProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccessProductGuildGrant"
  DROP CONSTRAINT IF EXISTS "AccessProductGuildGrant_botId_fkey";
ALTER TABLE "AccessProductGuildGrant"
  ADD CONSTRAINT "AccessProductGuildGrant_botId_fkey"
  FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill primary guild grant from existing products
INSERT INTO "AccessProductGuildGrant" ("id", "accessProductId", "botId", "guildId", "discordRoleId", "createdAt", "updatedAt")
SELECT
  'gg_' || p."id",
  p."id",
  p."botId",
  b."guildId",
  p."discordRoleId",
  NOW(),
  NOW()
FROM "AccessProduct" p
INNER JOIN "Bot" b ON b."id" = p."botId"
WHERE b."guildId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "AccessProductGuildGrant" g
    WHERE g."accessProductId" = p."id" AND g."botId" = p."botId"
  );

CREATE TABLE IF NOT EXISTS "AccessCode" (
    "id" TEXT NOT NULL,
    "accessProductId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "maxRedemptions" INTEGER NOT NULL DEFAULT 1,
    "redemptions" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccessCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AccessCode_code_key" ON "AccessCode"("code");
CREATE INDEX IF NOT EXISTS "AccessCode_accessProductId_idx" ON "AccessCode"("accessProductId");
CREATE INDEX IF NOT EXISTS "AccessCode_createdByUserId_idx" ON "AccessCode"("createdByUserId");

ALTER TABLE "AccessCode"
  DROP CONSTRAINT IF EXISTS "AccessCode_accessProductId_fkey";
ALTER TABLE "AccessCode"
  ADD CONSTRAINT "AccessCode_accessProductId_fkey"
  FOREIGN KEY ("accessProductId") REFERENCES "AccessProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccessCode"
  DROP CONSTRAINT IF EXISTS "AccessCode_createdByUserId_fkey";
ALTER TABLE "AccessCode"
  ADD CONSTRAINT "AccessCode_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "Affiliate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "commissionBps" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Affiliate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Affiliate_code_key" ON "Affiliate"("code");
CREATE INDEX IF NOT EXISTS "Affiliate_userId_idx" ON "Affiliate"("userId");

ALTER TABLE "Affiliate"
  DROP CONSTRAINT IF EXISTS "Affiliate_userId_fkey";
ALTER TABLE "Affiliate"
  ADD CONSTRAINT "Affiliate_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "AffiliateClick" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "accessProductId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AffiliateClick_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AffiliateClick_affiliateId_createdAt_idx"
  ON "AffiliateClick"("affiliateId", "createdAt");

ALTER TABLE "AffiliateClick"
  DROP CONSTRAINT IF EXISTS "AffiliateClick_affiliateId_fkey";
ALTER TABLE "AffiliateClick"
  ADD CONSTRAINT "AffiliateClick_affiliateId_fkey"
  FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "OrgOutboundWebhook" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrgOutboundWebhook_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OrgOutboundWebhook_userId_idx" ON "OrgOutboundWebhook"("userId");

ALTER TABLE "OrgOutboundWebhook"
  DROP CONSTRAINT IF EXISTS "OrgOutboundWebhook_userId_fkey";
ALTER TABLE "OrgOutboundWebhook"
  ADD CONSTRAINT "OrgOutboundWebhook_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "OutboundWebhookDelivery" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "statusCode" INTEGER,
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OutboundWebhookDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OutboundWebhookDelivery_webhookId_createdAt_idx"
  ON "OutboundWebhookDelivery"("webhookId", "createdAt");

ALTER TABLE "OutboundWebhookDelivery"
  DROP CONSTRAINT IF EXISTS "OutboundWebhookDelivery_webhookId_fkey";
ALTER TABLE "OutboundWebhookDelivery"
  ADD CONSTRAINT "OutboundWebhookDelivery_webhookId_fkey"
  FOREIGN KEY ("webhookId") REFERENCES "OrgOutboundWebhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- LearnerAccess affiliate FK + indexes
ALTER TABLE "LearnerAccess"
  DROP CONSTRAINT IF EXISTS "LearnerAccess_affiliateId_fkey";
ALTER TABLE "LearnerAccess"
  ADD CONSTRAINT "LearnerAccess_affiliateId_fkey"
  FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "LearnerAccess_affiliateId_idx" ON "LearnerAccess"("affiliateId");
CREATE INDEX IF NOT EXISTS "LearnerAccess_status_createdAt_idx" ON "LearnerAccess"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "LearnerAccess_status_claimReminderSentAt_idx"
  ON "LearnerAccess"("status", "claimReminderSentAt");
CREATE INDEX IF NOT EXISTS "LearnerAccessEvent_type_createdAt_idx"
  ON "LearnerAccessEvent"("type", "createdAt");
