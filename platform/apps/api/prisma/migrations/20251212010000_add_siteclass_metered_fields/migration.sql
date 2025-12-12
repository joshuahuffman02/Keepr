-- Add metered utility defaults to SiteClass
-- These fields exist in schema.prisma but were never migrated into the DB.

ALTER TABLE "SiteClass"
  ADD COLUMN IF NOT EXISTS "meteredEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "meteredType" TEXT,
  ADD COLUMN IF NOT EXISTS "meteredBillingMode" TEXT,
  ADD COLUMN IF NOT EXISTS "meteredBillTo" TEXT,
  ADD COLUMN IF NOT EXISTS "meteredMultiplier" DECIMAL(10,4) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS "meteredRatePlanId" TEXT,
  ADD COLUMN IF NOT EXISTS "meteredAutoEmail" BOOLEAN NOT NULL DEFAULT false;

