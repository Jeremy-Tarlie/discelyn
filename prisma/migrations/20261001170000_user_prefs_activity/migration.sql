ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'Europe/Paris';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notifyBillingEmail" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notifySecurityEmail" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notifyProductEmail" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "UserActivityLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UserActivityLog_userId_createdAt_idx"
  ON "UserActivityLog"("userId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserActivityLog_userId_fkey'
  ) THEN
    ALTER TABLE "UserActivityLog"
      ADD CONSTRAINT "UserActivityLog_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
