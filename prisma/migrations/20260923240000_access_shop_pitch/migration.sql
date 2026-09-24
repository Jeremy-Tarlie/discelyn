-- Accroche boutique + DM bienvenue après accès
ALTER TABLE "AccessProduct" ADD COLUMN IF NOT EXISTS "pitch" TEXT;
ALTER TABLE "AccessProduct" ADD COLUMN IF NOT EXISTS "welcomeDm" TEXT;
