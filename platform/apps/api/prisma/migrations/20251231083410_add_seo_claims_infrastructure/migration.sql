-- SEO & Campground Claims Infrastructure Migration
-- Adds enums, tables, and fields for:
-- - Campground claiming system
-- - SEO location pages (states, cities, regions)
-- - Attractions (national parks, lakes, etc.)
-- - B2B software comparison pages
-- - Bulk seeding job tracking

-- CreateEnum
CREATE TYPE "CampgroundClaimStatus" AS ENUM ('unclaimed', 'claim_pending', 'claimed');

-- CreateEnum
CREATE TYPE "ClaimVerificationMethod" AS ENUM ('phone', 'email', 'document', 'domain', 'manual');

-- CreateEnum
CREATE TYPE "CampgroundDataSource" AS ENUM ('recreation_gov', 'reserve_california', 'reserve_america', 'nps', 'usfs', 'blm', 'state_parks', 'osm', 'manual', 'user_submitted', 'claimed');

-- CreateEnum
CREATE TYPE "SeoLocationType" AS ENUM ('country', 'state', 'region', 'county', 'city', 'neighborhood', 'attraction');

-- CreateEnum
CREATE TYPE "AttractionType" AS ENUM ('national_park', 'state_park', 'national_forest', 'national_monument', 'lake', 'beach', 'river', 'mountain', 'ski_resort', 'theme_park', 'historic_site', 'scenic_byway', 'wildlife_area', 'recreation_area', 'other');

-- AlterTable: Add claim/SEO fields to Campground
ALTER TABLE "Campground" ADD COLUMN IF NOT EXISTS "claimStatus" "CampgroundClaimStatus" NOT NULL DEFAULT 'unclaimed';
ALTER TABLE "Campground" ADD COLUMN IF NOT EXISTS "claimedAt" TIMESTAMP(3);
ALTER TABLE "Campground" ADD COLUMN IF NOT EXISTS "claimedByUserId" TEXT;
ALTER TABLE "Campground" ADD COLUMN IF NOT EXISTS "verificationMethod" "ClaimVerificationMethod";
ALTER TABLE "Campground" ADD COLUMN IF NOT EXISTS "verificationCode" TEXT;
ALTER TABLE "Campground" ADD COLUMN IF NOT EXISTS "verificationCodeExpiry" TIMESTAMP(3);
ALTER TABLE "Campground" ADD COLUMN IF NOT EXISTS "verificationAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Campground" ADD COLUMN IF NOT EXISTS "seededDataSource" "CampgroundDataSource";
ALTER TABLE "Campground" ADD COLUMN IF NOT EXISTS "seededDataSourceId" TEXT;
ALTER TABLE "Campground" ADD COLUMN IF NOT EXISTS "seededAt" TIMESTAMP(3);
ALTER TABLE "Campground" ADD COLUMN IF NOT EXISTS "lastEnrichedAt" TIMESTAMP(3);
ALTER TABLE "Campground" ADD COLUMN IF NOT EXISTS "seoScore" INTEGER;
ALTER TABLE "Campground" ADD COLUMN IF NOT EXISTS "seoMissingFields" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable: CampgroundClaim
CREATE TABLE "CampgroundClaim" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "claimantName" TEXT NOT NULL,
    "claimantEmail" TEXT NOT NULL,
    "claimantPhone" TEXT,
    "claimantRole" TEXT,
    "businessName" TEXT,
    "businessAddress" TEXT,
    "verificationMethod" "ClaimVerificationMethod",
    "verificationCode" TEXT,
    "verificationExpiry" TIMESTAMP(3),
    "verificationAttempts" INTEGER NOT NULL DEFAULT 0,
    "verifiedAt" TIMESTAMP(3),
    "documents" JSONB,
    "notes" TEXT,
    "rejectionReason" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CampgroundClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SeoLocation
CREATE TABLE "SeoLocation" (
    "id" TEXT NOT NULL,
    "type" "SeoLocationType" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'USA',
    "latitude" DECIMAL(12,8),
    "longitude" DECIMAL(12,8),
    "boundingBox" JSONB,
    "parentId" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "heroImageUrl" TEXT,
    "description" TEXT,
    "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bestTimeToVisit" TEXT,
    "campgroundCount" INTEGER NOT NULL DEFAULT 0,
    "avgRating" DECIMAL(3,2),
    "popularAmenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priceRangeLow" INTEGER,
    "priceRangeHigh" INTEGER,
    "statsUpdatedAt" TIMESTAMP(3),
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SeoLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CampgroundLocation
CREATE TABLE "CampgroundLocation" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "distanceMiles" DOUBLE PRECISION,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampgroundLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Attraction
CREATE TABLE "Attraction" (
    "id" TEXT NOT NULL,
    "type" "AttractionType" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "state" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'USA',
    "latitude" DECIMAL(12,8) NOT NULL,
    "longitude" DECIMAL(12,8) NOT NULL,
    "npsCode" TEXT,
    "googlePlaceId" TEXT,
    "wikipediaUrl" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "heroImageUrl" TEXT,
    "description" TEXT,
    "activities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bestSeason" TEXT,
    "nearbyCampgroundCount" INTEGER NOT NULL DEFAULT 0,
    "avgCampgroundRating" DECIMAL(3,2),
    "statsUpdatedAt" TIMESTAMP(3),
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Attraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CampgroundAttraction
CREATE TABLE "CampgroundAttraction" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "attractionId" TEXT NOT NULL,
    "distanceMiles" DOUBLE PRECISION NOT NULL,
    "driveTimeMinutes" INTEGER,
    "isNearby" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampgroundAttraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SoftwarePage
CREATE TABLE "SoftwarePage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "heroImageUrl" TEXT,
    "content" JSONB,
    "competitorName" TEXT,
    "competitorSlug" TEXT,
    "primaryKeyword" TEXT,
    "secondaryKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "pageViews" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SoftwarePage_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CampgroundSeedJob
CREATE TABLE "CampgroundSeedJob" (
    "id" TEXT NOT NULL,
    "source" "CampgroundDataSource" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "processedRecords" INTEGER NOT NULL DEFAULT 0,
    "createdRecords" INTEGER NOT NULL DEFAULT 0,
    "updatedRecords" INTEGER NOT NULL DEFAULT 0,
    "skippedRecords" INTEGER NOT NULL DEFAULT 0,
    "errorRecords" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CampgroundSeedJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Campground_claimStatus_idx" ON "Campground"("claimStatus");
CREATE INDEX "Campground_seededDataSource_seededDataSourceId_idx" ON "Campground"("seededDataSource", "seededDataSourceId");
CREATE INDEX "Campground_state_city_idx" ON "Campground"("state", "city");
CREATE INDEX "Campground_latitude_longitude_idx" ON "Campground"("latitude", "longitude");

CREATE INDEX "CampgroundClaim_campgroundId_idx" ON "CampgroundClaim"("campgroundId");
CREATE INDEX "CampgroundClaim_userId_idx" ON "CampgroundClaim"("userId");
CREATE INDEX "CampgroundClaim_status_idx" ON "CampgroundClaim"("status");
CREATE INDEX "CampgroundClaim_createdAt_idx" ON "CampgroundClaim"("createdAt");

CREATE UNIQUE INDEX "SeoLocation_slug_key" ON "SeoLocation"("slug");
CREATE INDEX "SeoLocation_type_idx" ON "SeoLocation"("type");
CREATE INDEX "SeoLocation_state_idx" ON "SeoLocation"("state");
CREATE INDEX "SeoLocation_parentId_idx" ON "SeoLocation"("parentId");
CREATE INDEX "SeoLocation_isPublished_idx" ON "SeoLocation"("isPublished");

CREATE UNIQUE INDEX "CampgroundLocation_campgroundId_locationId_key" ON "CampgroundLocation"("campgroundId", "locationId");
CREATE INDEX "CampgroundLocation_locationId_idx" ON "CampgroundLocation"("locationId");
CREATE INDEX "CampgroundLocation_isPrimary_idx" ON "CampgroundLocation"("isPrimary");

CREATE UNIQUE INDEX "Attraction_slug_key" ON "Attraction"("slug");
CREATE INDEX "Attraction_type_idx" ON "Attraction"("type");
CREATE INDEX "Attraction_state_idx" ON "Attraction"("state");
CREATE INDEX "Attraction_isPublished_idx" ON "Attraction"("isPublished");

CREATE UNIQUE INDEX "CampgroundAttraction_campgroundId_attractionId_key" ON "CampgroundAttraction"("campgroundId", "attractionId");
CREATE INDEX "CampgroundAttraction_attractionId_idx" ON "CampgroundAttraction"("attractionId");
CREATE INDEX "CampgroundAttraction_distanceMiles_idx" ON "CampgroundAttraction"("distanceMiles");
CREATE INDEX "CampgroundAttraction_isNearby_idx" ON "CampgroundAttraction"("isNearby");

CREATE UNIQUE INDEX "SoftwarePage_slug_key" ON "SoftwarePage"("slug");
CREATE INDEX "SoftwarePage_type_idx" ON "SoftwarePage"("type");
CREATE INDEX "SoftwarePage_isPublished_idx" ON "SoftwarePage"("isPublished");
CREATE INDEX "SoftwarePage_competitorSlug_idx" ON "SoftwarePage"("competitorSlug");

CREATE INDEX "CampgroundSeedJob_source_idx" ON "CampgroundSeedJob"("source");
CREATE INDEX "CampgroundSeedJob_status_idx" ON "CampgroundSeedJob"("status");
CREATE INDEX "CampgroundSeedJob_createdAt_idx" ON "CampgroundSeedJob"("createdAt");

-- AddForeignKey
ALTER TABLE "Campground" ADD CONSTRAINT "Campground_claimedByUserId_fkey" FOREIGN KEY ("claimedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CampgroundClaim" ADD CONSTRAINT "CampgroundClaim_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampgroundClaim" ADD CONSTRAINT "CampgroundClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SeoLocation" ADD CONSTRAINT "SeoLocation_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SeoLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CampgroundLocation" ADD CONSTRAINT "CampgroundLocation_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampgroundLocation" ADD CONSTRAINT "CampgroundLocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "SeoLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampgroundAttraction" ADD CONSTRAINT "CampgroundAttraction_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampgroundAttraction" ADD CONSTRAINT "CampgroundAttraction_attractionId_fkey" FOREIGN KEY ("attractionId") REFERENCES "Attraction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
