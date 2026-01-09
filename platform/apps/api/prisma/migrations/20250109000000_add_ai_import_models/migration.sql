-- CreateEnum
CREATE TYPE "ImportDraftStatus" AS ENUM ('pending_upload', 'pending_classification', 'pending_extraction', 'extraction_complete', 'review_in_progress', 'confirmed', 'imported', 'failed', 'expired');

-- AlterTable: OnboardingSession - Add AI import fields
ALTER TABLE "OnboardingSession" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OnboardingSession" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "OnboardingSession" ADD COLUMN IF NOT EXISTS "emailVerifyCode" TEXT;
ALTER TABLE "OnboardingSession" ADD COLUMN IF NOT EXISTS "emailVerifyExpiry" TIMESTAMP(3);
ALTER TABLE "OnboardingSession" ADD COLUMN IF NOT EXISTS "aiCallsUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OnboardingSession" ADD COLUMN IF NOT EXISTS "aiAccessTier" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "OnboardingSession" ADD COLUMN IF NOT EXISTS "lastAiCallAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OnboardingImportDraft" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "targetEntity" TEXT NOT NULL,
    "originalFile" TEXT NOT NULL,
    "fileName" TEXT,
    "extractedData" JSONB,
    "corrections" JSONB,
    "status" "ImportDraftStatus" NOT NULL DEFAULT 'pending_upload',
    "aiCallsUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingImportDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OnboardingAiUsage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "featureType" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "costCents" INTEGER NOT NULL,
    "modelUsed" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingAiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OnboardingImportDraft_documentId_key" ON "OnboardingImportDraft"("documentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OnboardingImportDraft_sessionId_idx" ON "OnboardingImportDraft"("sessionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OnboardingImportDraft_expiresAt_idx" ON "OnboardingImportDraft"("expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OnboardingImportDraft_status_idx" ON "OnboardingImportDraft"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OnboardingAiUsage_sessionId_createdAt_idx" ON "OnboardingAiUsage"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "OnboardingImportDraft" ADD CONSTRAINT "OnboardingImportDraft_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "OnboardingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingAiUsage" ADD CONSTRAINT "OnboardingAiUsage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "OnboardingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
