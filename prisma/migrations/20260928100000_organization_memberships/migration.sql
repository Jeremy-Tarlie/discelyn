-- Organization + Memberships : User n'est plus l'orga.
-- Migre Subscription, Bot, OrgStripeConfig, AccessProduct, Affiliate,
-- OrgOutboundWebhook, AccessOversoldEvent vers organizationId.

CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Organization_deletedAt_idx" ON "Organization"("deletedAt");

CREATE TABLE "OrganizationMembership" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationMembership_organizationId_userId_key" ON "OrganizationMembership"("organizationId", "userId");
CREATE INDEX "OrganizationMembership_userId_idx" ON "OrganizationMembership"("userId");
CREATE INDEX "OrganizationMembership_organizationId_idx" ON "OrganizationMembership"("organizationId");

ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Mapping temporaire userId → organizationId
CREATE TEMP TABLE "_user_org_map" (
    "userId" TEXT PRIMARY KEY,
    "organizationId" TEXT NOT NULL
);

INSERT INTO "Organization" ("id", "name", "deletedAt", "createdAt", "updatedAt")
SELECT
    'org_' || u."id",
    COALESCE(NULLIF(TRIM(u."name"), ''), 'Organisation'),
    u."deletedAt",
    u."createdAt",
    u."updatedAt"
FROM "User" u;

INSERT INTO "_user_org_map" ("userId", "organizationId")
SELECT u."id", 'org_' || u."id" FROM "User" u;

INSERT INTO "OrganizationMembership" ("id", "organizationId", "userId", "role", "createdAt", "updatedAt")
SELECT
    'mem_' || u."id",
    m."organizationId",
    u."id",
    'OWNER'::"OrgRole",
    u."createdAt",
    u."updatedAt"
FROM "User" u
JOIN "_user_org_map" m ON m."userId" = u."id";

-- Subscription: userId → organizationId
ALTER TABLE "Subscription" ADD COLUMN "organizationId" TEXT;

UPDATE "Subscription" s
SET "organizationId" = m."organizationId"
FROM "_user_org_map" m
WHERE m."userId" = s."userId";

ALTER TABLE "Subscription" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_userId_fkey";
DROP INDEX IF EXISTS "Subscription_userId_key";
ALTER TABLE "Subscription" DROP COLUMN "userId";
CREATE UNIQUE INDEX "Subscription_organizationId_key" ON "Subscription"("organizationId");
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Bot
ALTER TABLE "Bot" ADD COLUMN "organizationId" TEXT;

UPDATE "Bot" b
SET "organizationId" = m."organizationId"
FROM "_user_org_map" m
WHERE m."userId" = b."userId";

ALTER TABLE "Bot" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Bot" DROP CONSTRAINT "Bot_userId_fkey";
DROP INDEX IF EXISTS "Bot_userId_idx";
ALTER TABLE "Bot" DROP COLUMN "userId";
CREATE INDEX "Bot_organizationId_idx" ON "Bot"("organizationId");
ALTER TABLE "Bot" ADD CONSTRAINT "Bot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- OrgStripeConfig
ALTER TABLE "OrgStripeConfig" ADD COLUMN "organizationId" TEXT;

UPDATE "OrgStripeConfig" c
SET "organizationId" = m."organizationId"
FROM "_user_org_map" m
WHERE m."userId" = c."userId";

ALTER TABLE "OrgStripeConfig" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "OrgStripeConfig" DROP CONSTRAINT "OrgStripeConfig_userId_fkey";
DROP INDEX IF EXISTS "OrgStripeConfig_userId_key";
ALTER TABLE "OrgStripeConfig" DROP COLUMN "userId";
CREATE UNIQUE INDEX "OrgStripeConfig_organizationId_key" ON "OrgStripeConfig"("organizationId");
ALTER TABLE "OrgStripeConfig" ADD CONSTRAINT "OrgStripeConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AccessProduct
ALTER TABLE "AccessProduct" ADD COLUMN "organizationId" TEXT;

UPDATE "AccessProduct" p
SET "organizationId" = m."organizationId"
FROM "_user_org_map" m
WHERE m."userId" = p."userId";

ALTER TABLE "AccessProduct" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AccessProduct" DROP CONSTRAINT "AccessProduct_userId_fkey";
DROP INDEX IF EXISTS "AccessProduct_userId_stripePriceId_key";
DROP INDEX IF EXISTS "AccessProduct_userId_idx";
ALTER TABLE "AccessProduct" DROP COLUMN "userId";
CREATE UNIQUE INDEX "AccessProduct_organizationId_stripePriceId_key" ON "AccessProduct"("organizationId", "stripePriceId");
CREATE INDEX "AccessProduct_organizationId_idx" ON "AccessProduct"("organizationId");
ALTER TABLE "AccessProduct" ADD CONSTRAINT "AccessProduct_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Affiliate
ALTER TABLE "Affiliate" ADD COLUMN "organizationId" TEXT;

UPDATE "Affiliate" a
SET "organizationId" = m."organizationId"
FROM "_user_org_map" m
WHERE m."userId" = a."userId";

ALTER TABLE "Affiliate" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Affiliate" DROP CONSTRAINT "Affiliate_userId_fkey";
DROP INDEX IF EXISTS "Affiliate_userId_idx";
ALTER TABLE "Affiliate" DROP COLUMN "userId";
CREATE INDEX "Affiliate_organizationId_idx" ON "Affiliate"("organizationId");
ALTER TABLE "Affiliate" ADD CONSTRAINT "Affiliate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- OrgOutboundWebhook
ALTER TABLE "OrgOutboundWebhook" ADD COLUMN "organizationId" TEXT;

UPDATE "OrgOutboundWebhook" w
SET "organizationId" = m."organizationId"
FROM "_user_org_map" m
WHERE m."userId" = w."userId";

ALTER TABLE "OrgOutboundWebhook" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "OrgOutboundWebhook" DROP CONSTRAINT "OrgOutboundWebhook_userId_fkey";
DROP INDEX IF EXISTS "OrgOutboundWebhook_userId_idx";
ALTER TABLE "OrgOutboundWebhook" DROP COLUMN "userId";
CREATE INDEX "OrgOutboundWebhook_organizationId_idx" ON "OrgOutboundWebhook"("organizationId");
ALTER TABLE "OrgOutboundWebhook" ADD CONSTRAINT "OrgOutboundWebhook_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AccessOversoldEvent
ALTER TABLE "AccessOversoldEvent" ADD COLUMN "organizationId" TEXT;

UPDATE "AccessOversoldEvent" e
SET "organizationId" = m."organizationId"
FROM "_user_org_map" m
WHERE m."userId" = e."userId";

ALTER TABLE "AccessOversoldEvent" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AccessOversoldEvent" DROP CONSTRAINT "AccessOversoldEvent_userId_fkey";
DROP INDEX IF EXISTS "AccessOversoldEvent_userId_createdAt_idx";
ALTER TABLE "AccessOversoldEvent" DROP COLUMN "userId";
CREATE INDEX "AccessOversoldEvent_organizationId_createdAt_idx" ON "AccessOversoldEvent"("organizationId", "createdAt");
ALTER TABLE "AccessOversoldEvent" ADD CONSTRAINT "AccessOversoldEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP TABLE "_user_org_map";
