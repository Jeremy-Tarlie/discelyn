-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "marketingConsentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_marketingConsentAt_idx" ON "User"("marketingConsentAt");

-- CreateTable
CREATE TABLE IF NOT EXISTS "MarketingCampaign" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "audience" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EmailEvent" (
    "id" TEXT NOT NULL,
    "resendId" TEXT,
    "email" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "campaignId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MarketingCampaign_createdAt_idx" ON "MarketingCampaign"("createdAt");
CREATE INDEX IF NOT EXISTS "MarketingCampaign_status_idx" ON "MarketingCampaign"("status");
CREATE INDEX IF NOT EXISTS "EmailEvent_email_createdAt_idx" ON "EmailEvent"("email", "createdAt");
CREATE INDEX IF NOT EXISTS "EmailEvent_campaignId_type_idx" ON "EmailEvent"("campaignId", "type");
CREATE INDEX IF NOT EXISTS "EmailEvent_resendId_idx" ON "EmailEvent"("resendId");
CREATE INDEX IF NOT EXISTS "EmailEvent_type_createdAt_idx" ON "EmailEvent"("type", "createdAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
