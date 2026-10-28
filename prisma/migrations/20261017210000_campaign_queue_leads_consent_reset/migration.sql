-- AlterTable
ALTER TABLE "MarketingCampaign" ADD COLUMN IF NOT EXISTS "failCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "MarketingCampaignRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "MarketingCampaignRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MarketingCampaignRecipient_campaignId_email_key"
  ON "MarketingCampaignRecipient"("campaignId", "email");
CREATE INDEX IF NOT EXISTS "MarketingCampaignRecipient_status_createdAt_idx"
  ON "MarketingCampaignRecipient"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "MarketingCampaignRecipient_campaignId_status_idx"
  ON "MarketingCampaignRecipient"("campaignId", "status");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "MarketingCampaignRecipient"
    ADD CONSTRAINT "MarketingCampaignRecipient_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Reset historique : ancien consentement lead = recontact, pas marketing.
UPDATE "Lead" SET "marketingConsentAt" = NULL;