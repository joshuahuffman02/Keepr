-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ReportFrequency" AS ENUM ('daily', 'weekly', 'monthly');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ReportType" AS ENUM ('occupancy_summary', 'revenue_summary', 'arrivals_departures', 'maintenance_summary', 'reservation_activity', 'guest_activity', 'financial_summary');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReportSubscription" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "campgroundId" TEXT,
    "reportType" "ReportType" NOT NULL,
    "frequency" "ReportFrequency" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSentAt" TIMESTAMP(3),
    "nextSendAt" TIMESTAMP(3),
    "deliveryTime" TEXT NOT NULL DEFAULT '08:00',
    "dayOfWeek" INTEGER,
    "dayOfMonth" INTEGER,

    CONSTRAINT "ReportSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ReportSubscription_userId_campgroundId_reportType_key" ON "ReportSubscription"("userId", "campgroundId", "reportType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReportSubscription_userId_idx" ON "ReportSubscription"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReportSubscription_campgroundId_idx" ON "ReportSubscription"("campgroundId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReportSubscription_enabled_nextSendAt_idx" ON "ReportSubscription"("enabled", "nextSendAt");
