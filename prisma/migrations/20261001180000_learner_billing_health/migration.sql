-- AlterTable
ALTER TABLE "LearnerAccess" ADD COLUMN "stripeBillingStatus" TEXT;
ALTER TABLE "LearnerAccess" ADD COLUMN "lastPaymentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "LearnerAccess_stripeBillingStatus_idx" ON "LearnerAccess"("stripeBillingStatus");
