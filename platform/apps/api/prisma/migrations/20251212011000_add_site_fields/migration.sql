-- Add missing Site fields that exist in schema.prisma but not in the DB.
-- This keeps the dev database aligned so seeds and API work.

ALTER TABLE "Site"
  ADD COLUMN IF NOT EXISTS "rigMaxWidth" INTEGER,
  ADD COLUMN IF NOT EXISTS "rigMaxHeight" INTEGER,
  ADD COLUMN IF NOT EXISTS "pullThrough" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "amenityTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "surfaceType" TEXT,
  ADD COLUMN IF NOT EXISTS "padSlopePercent" INTEGER,
  ADD COLUMN IF NOT EXISTS "mapLabel" TEXT;

