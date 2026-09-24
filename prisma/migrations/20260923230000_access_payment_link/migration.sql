-- Payment Link généré par Botly (setup simplifié)
ALTER TABLE "AccessProduct" ADD COLUMN IF NOT EXISTS "paymentLinkUrl" TEXT;
ALTER TABLE "AccessProduct" ADD COLUMN IF NOT EXISTS "paymentLinkId" TEXT;
