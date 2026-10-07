-- CreateTable
CREATE TABLE "CookieConsentLog" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "userId" TEXT,
    "choice" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CookieConsentLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CookieConsentLog_userId_createdAt_idx" ON "CookieConsentLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CookieConsentLog_visitorId_createdAt_idx" ON "CookieConsentLog"("visitorId", "createdAt");

-- CreateIndex
CREATE INDEX "CookieConsentLog_createdAt_idx" ON "CookieConsentLog"("createdAt");

-- AddForeignKey
ALTER TABLE "CookieConsentLog" ADD CONSTRAINT "CookieConsentLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
