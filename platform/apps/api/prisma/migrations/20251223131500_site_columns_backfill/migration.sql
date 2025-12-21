-- Ensure Site columns added after baseline exist in all environments.
-- This is a safe, idempotent migration for older DBs that missed prior changes.

ALTER TABLE "Site"
  ADD COLUMN IF NOT EXISTS "rigMaxWidth" INTEGER,
  ADD COLUMN IF NOT EXISTS "rigMaxHeight" INTEGER,
  ADD COLUMN IF NOT EXISTS "pullThrough" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "amenityTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "surfaceType" TEXT,
  ADD COLUMN IF NOT EXISTS "padSlopePercent" INTEGER,
  ADD COLUMN IF NOT EXISTS "mapLabel" TEXT;
