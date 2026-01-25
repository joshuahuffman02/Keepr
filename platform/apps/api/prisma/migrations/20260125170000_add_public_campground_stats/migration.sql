-- Public campground stats snapshot table
-- Precomputes NPS and ranking data for public listings

CREATE TABLE "PublicCampgroundStats" (
    "campgroundId" TEXT NOT NULL,
    "npsScore" INTEGER,
    "npsResponseCount" INTEGER NOT NULL DEFAULT 0,
    "npsRank" INTEGER,
    "npsPercentile" DOUBLE PRECISION,
    "npsImprovement" INTEGER,
    "isWorldClassNps" BOOLEAN NOT NULL DEFAULT false,
    "isTopCampground" BOOLEAN NOT NULL DEFAULT false,
    "isTop1PercentNps" BOOLEAN NOT NULL DEFAULT false,
    "isTop5PercentNps" BOOLEAN NOT NULL DEFAULT false,
    "isTop10PercentNps" BOOLEAN NOT NULL DEFAULT false,
    "isRisingStar" BOOLEAN NOT NULL DEFAULT false,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "previousPeriodStart" TIMESTAMP(3) NOT NULL,
    "previousPeriodEnd" TIMESTAMP(3) NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PublicCampgroundStats_pkey" PRIMARY KEY ("campgroundId")
);

ALTER TABLE "PublicCampgroundStats" ADD CONSTRAINT "PublicCampgroundStats_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "PublicCampgroundStats_calculatedAt_idx" ON "PublicCampgroundStats"("calculatedAt");
