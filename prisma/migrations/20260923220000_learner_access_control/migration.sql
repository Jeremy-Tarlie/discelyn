-- Contrôle d’accès apprenant : Stripe client → rôle Discord

CREATE TYPE "LearnerAccessStatus" AS ENUM ('PENDING_CLAIM', 'AWAITING_JOIN', 'ACTIVE', 'REVOKED', 'EXPIRED');

CREATE TABLE "OrgStripeConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "webhookPathToken" TEXT NOT NULL,
    "webhookSecret" TEXT NOT NULL,
    "stripeSecretKey" TEXT,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgStripeConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrgStripeConfig_userId_key" ON "OrgStripeConfig"("userId");
CREATE UNIQUE INDEX "OrgStripeConfig_webhookPathToken_key" ON "OrgStripeConfig"("webhookPathToken");

ALTER TABLE "OrgStripeConfig" ADD CONSTRAINT "OrgStripeConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AccessProduct" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stripePriceId" TEXT NOT NULL,
    "discordRoleId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "revokeOnRefund" BOOLEAN NOT NULL DEFAULT true,
    "accessEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessProduct_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccessProduct_userId_stripePriceId_key" ON "AccessProduct"("userId", "stripePriceId");
CREATE INDEX "AccessProduct_botId_idx" ON "AccessProduct"("botId");
CREATE INDEX "AccessProduct_stripePriceId_idx" ON "AccessProduct"("stripePriceId");
CREATE INDEX "AccessProduct_userId_idx" ON "AccessProduct"("userId");

ALTER TABLE "AccessProduct" ADD CONSTRAINT "AccessProduct_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccessProduct" ADD CONSTRAINT "AccessProduct_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LearnerAccess" (
    "id" TEXT NOT NULL,
    "accessProductId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "status" "LearnerAccessStatus" NOT NULL DEFAULT 'PENDING_CLAIM',
    "customerEmail" TEXT,
    "discordUserId" TEXT,
    "claimToken" TEXT,
    "claimTokenExpiresAt" TIMESTAMP(3),
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripeCustomerId" TEXT,
    "inviteUrl" TEXT,
    "grantedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearnerAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LearnerAccess_claimToken_key" ON "LearnerAccess"("claimToken");
CREATE UNIQUE INDEX "LearnerAccess_stripeCheckoutSessionId_key" ON "LearnerAccess"("stripeCheckoutSessionId");
CREATE INDEX "LearnerAccess_botId_status_idx" ON "LearnerAccess"("botId", "status");
CREATE INDEX "LearnerAccess_guildId_discordUserId_idx" ON "LearnerAccess"("guildId", "discordUserId");
CREATE INDEX "LearnerAccess_discordUserId_status_idx" ON "LearnerAccess"("discordUserId", "status");
CREATE INDEX "LearnerAccess_stripeSubscriptionId_idx" ON "LearnerAccess"("stripeSubscriptionId");
CREATE INDEX "LearnerAccess_customerEmail_idx" ON "LearnerAccess"("customerEmail");
CREATE INDEX "LearnerAccess_accessProductId_idx" ON "LearnerAccess"("accessProductId");

ALTER TABLE "LearnerAccess" ADD CONSTRAINT "LearnerAccess_accessProductId_fkey" FOREIGN KEY ("accessProductId") REFERENCES "AccessProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearnerAccess" ADD CONSTRAINT "LearnerAccess_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LearnerAccessEvent" (
    "id" TEXT NOT NULL,
    "learnerAccessId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearnerAccessEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LearnerAccessEvent_learnerAccessId_createdAt_idx" ON "LearnerAccessEvent"("learnerAccessId", "createdAt");

ALTER TABLE "LearnerAccessEvent" ADD CONSTRAINT "LearnerAccessEvent_learnerAccessId_fkey" FOREIGN KEY ("learnerAccessId") REFERENCES "LearnerAccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;
