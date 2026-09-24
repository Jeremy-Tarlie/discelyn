-- Access codes: store hash only (plaintext shown once at creation).
-- Requires pgcrypto for digest() backfill of legacy plaintext rows.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "AccessCode" ADD COLUMN IF NOT EXISTS "codeHash" TEXT;
ALTER TABLE "AccessCode" ADD COLUMN IF NOT EXISTS "codePrefix" TEXT;

UPDATE "AccessCode"
SET
  "codeHash" = encode(digest(upper(trim("code")), 'sha256'), 'hex'),
  "codePrefix" = left(upper(trim("code")), 4)
WHERE "codeHash" IS NULL AND "code" IS NOT NULL;

ALTER TABLE "AccessCode" ALTER COLUMN "codeHash" SET NOT NULL;
ALTER TABLE "AccessCode" ALTER COLUMN "codePrefix" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "AccessCode_codeHash_key" ON "AccessCode"("codeHash");

ALTER TABLE "AccessCode" DROP CONSTRAINT IF EXISTS "AccessCode_code_key";
ALTER TABLE "AccessCode" DROP COLUMN IF EXISTS "code";
