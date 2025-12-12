-- Create GL period status enum
CREATE TYPE "GlPeriodStatus" AS ENUM ('open', 'closed', 'locked');

-- Periods table for close/lock control
CREATE TABLE "GlPeriod" (
  "id" TEXT PRIMARY KEY,
  "campgroundId" TEXT NOT NULL,
  "name" TEXT,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "status" "GlPeriodStatus" NOT NULL DEFAULT 'open',
  "closedAt" TIMESTAMP(3),
  "lockedAt" TIMESTAMP(3),
  "closedBy" TEXT,
  "lockedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

ALTER TABLE "GlPeriod"
ADD CONSTRAINT "GlPeriod_campgroundId_fkey"
FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "GlPeriod_campground_status_idx" ON "GlPeriod" ("campgroundId", "status");
CREATE INDEX "GlPeriod_campground_range_idx" ON "GlPeriod" ("campgroundId", "startDate", "endDate");

-- Ledger entry extensions for dedupe + period linkage
ALTER TABLE "LedgerEntry"
ADD COLUMN "periodId" TEXT,
ADD COLUMN "externalRef" TEXT,
ADD COLUMN "dedupeKey" TEXT;

ALTER TABLE "LedgerEntry"
ADD CONSTRAINT "LedgerEntry_periodId_fkey"
FOREIGN KEY ("periodId") REFERENCES "GlPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "LedgerEntry_periodId_idx" ON "LedgerEntry" ("periodId");
CREATE INDEX "LedgerEntry_dedupeKey_idx" ON "LedgerEntry" ("dedupeKey");
