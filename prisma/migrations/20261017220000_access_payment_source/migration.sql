-- CreateEnum (idempotent pour apply manuel / recover)
DO $$ BEGIN
  CREATE TYPE "AccessPaymentSource" AS ENUM ('DISCELYN_LINK', 'EXTERNAL_STRIPE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "AccessProduct" ADD COLUMN IF NOT EXISTS "stripeProductId" TEXT;
ALTER TABLE "AccessProduct" ADD COLUMN IF NOT EXISTS "paymentSource" "AccessPaymentSource" NOT NULL DEFAULT 'DISCELYN_LINK';
ALTER TABLE "AccessProduct" ADD COLUMN IF NOT EXISTS "amountCents" INTEGER;
ALTER TABLE "AccessProduct" ADD COLUMN IF NOT EXISTS "currency" TEXT;
ALTER TABLE "AccessProduct" ADD COLUMN IF NOT EXISTS "recurringInterval" TEXT;

-- Backfill: products without a Discelyn-managed Payment Link were bound externally
UPDATE "AccessProduct"
SET "paymentSource" = 'EXTERNAL_STRIPE'
WHERE "paymentLinkId" IS NULL;
