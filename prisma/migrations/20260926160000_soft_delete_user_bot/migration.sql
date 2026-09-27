-- Soft-delete User / Bot : conserve l’audit (LearnerAccess, etc.) sans cascade destructive.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Bot" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "User_deletedAt_idx" ON "User"("deletedAt");
CREATE INDEX IF NOT EXISTS "Bot_deletedAt_idx" ON "Bot"("deletedAt");
