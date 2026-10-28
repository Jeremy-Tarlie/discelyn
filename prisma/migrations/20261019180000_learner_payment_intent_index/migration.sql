-- Speed revokeByPaymentIntentId (charge.refunded webhook)
CREATE INDEX IF NOT EXISTS "LearnerAccess_stripePaymentIntentId_idx"
  ON "LearnerAccess"("stripePaymentIntentId");
