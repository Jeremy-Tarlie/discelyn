-- PlanId: STARTER/PRO/BUSINESS → OPS/SCALE
ALTER TYPE "PlanId" RENAME TO "PlanId_old";

CREATE TYPE "PlanId" AS ENUM ('FREE', 'OPS', 'SCALE');

ALTER TABLE "Subscription"
  ALTER COLUMN "plan" DROP DEFAULT;

ALTER TABLE "Subscription"
  ALTER COLUMN "plan" TYPE "PlanId"
  USING (
    CASE "plan"::text
      WHEN 'STARTER' THEN 'OPS'::"PlanId"
      WHEN 'PRO' THEN 'SCALE'::"PlanId"
      WHEN 'BUSINESS' THEN 'SCALE'::"PlanId"
      WHEN 'FREE' THEN 'FREE'::"PlanId"
      ELSE 'FREE'::"PlanId"
    END
  );

ALTER TABLE "Subscription"
  ALTER COLUMN "plan" SET DEFAULT 'FREE'::"PlanId";

DROP TYPE "PlanId_old";

CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "company" TEXT,
    "role" TEXT,
    "message" TEXT,
    "offer" TEXT,
    "source" TEXT NOT NULL DEFAULT 'landing',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "path" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Lead_email_idx" ON "Lead"("email");
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");
CREATE INDEX "AnalyticsEvent_name_createdAt_idx" ON "AnalyticsEvent"("name", "createdAt");
CREATE INDEX "AnalyticsEvent_userId_idx" ON "AnalyticsEvent"("userId");
