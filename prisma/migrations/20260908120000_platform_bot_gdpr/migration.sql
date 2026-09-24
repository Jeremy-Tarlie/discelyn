-- Pivot: bot plateforme Botly (plus de tokens utilisateurs) + warns persistés

ALTER TABLE "Bot" ADD COLUMN IF NOT EXISTS "guildId" TEXT;

-- Nettoyage des secrets tokens utilisateurs
ALTER TABLE "Bot" DROP COLUMN IF EXISTS "tokenCiphertext";
ALTER TABLE "Bot" DROP COLUMN IF EXISTS "tokenNonce";
ALTER TABLE "Bot" DROP COLUMN IF EXISTS "tokenAuthTag";
ALTER TABLE "Bot" DROP COLUMN IF EXISTS "hasToken";
ALTER TABLE "Bot" DROP COLUMN IF EXISTS "discordAppId";
ALTER TABLE "Bot" DROP COLUMN IF EXISTS "containerId";

CREATE UNIQUE INDEX IF NOT EXISTS "Bot_guildId_key" ON "Bot"("guildId");

CREATE TABLE IF NOT EXISTS "ModerationWarning" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "moderatorTag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationWarning_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ModerationWarning_botId_guildId_targetUserId_idx" ON "ModerationWarning"("botId", "guildId", "targetUserId");
CREATE INDEX IF NOT EXISTS "ModerationWarning_guildId_targetUserId_idx" ON "ModerationWarning"("guildId", "targetUserId");

ALTER TABLE "ModerationWarning" DROP CONSTRAINT IF EXISTS "ModerationWarning_botId_fkey";
ALTER TABLE "ModerationWarning" ADD CONSTRAINT "ModerationWarning_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
