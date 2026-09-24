-- Idempotency webhooks Stripe (plateforme + formation) + tracking oversell post-paiement

CREATE TABLE "AccessOversoldEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessProductId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "stripeCheckoutSessionId" TEXT NOT NULL,
    "stripePaymentIntentId" TEXT,
    "customerEmail" TEXT,
    "amountTotal" INTEGER,
    "currency" TEXT,
    "refundStatus" TEXT NOT NULL DEFAULT 'pending',
    "stripeRefundId" TEXT,
    "refundError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessOversoldEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccessOversoldEvent_stripeCheckoutSessionId_key" ON "AccessOversoldEvent"("stripeCheckoutSessionId");
CREATE INDEX "AccessOversoldEvent_userId_createdAt_idx" ON "AccessOversoldEvent"("userId", "createdAt");
CREATE INDEX "AccessOversoldEvent_accessProductId_idx" ON "AccessOversoldEvent"("accessProductId");
CREATE INDEX "AccessOversoldEvent_refundStatus_idx" ON "AccessOversoldEvent"("refundStatus");

ALTER TABLE "AccessOversoldEvent" ADD CONSTRAINT "AccessOversoldEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccessOversoldEvent" ADD CONSTRAINT "AccessOversoldEvent_accessProductId_fkey" FOREIGN KEY ("accessProductId") REFERENCES "AccessProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccessOversoldEvent" ADD CONSTRAINT "AccessOversoldEvent_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StripeProcessedEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeProcessedEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StripeProcessedEvent_eventId_key" ON "StripeProcessedEvent"("eventId");
CREATE INDEX "StripeProcessedEvent_processedAt_idx" ON "StripeProcessedEvent"("processedAt");
