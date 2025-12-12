-- CreateEnum
CREATE TYPE "PosProviderType" AS ENUM ('clover', 'square', 'toast');

-- CreateEnum
CREATE TYPE "PosProviderCapability" AS ENUM ('payments', 'items_sync', 'receipts');

-- CreateEnum
CREATE TYPE "PosIntegrationStatus" AS ENUM ('enabled', 'disabled', 'error');

-- CreateEnum
CREATE TYPE "PosSyncTarget" AS ENUM ('catalog', 'tenders', 'payments');

-- CreateEnum
CREATE TYPE "PosSyncStatus" AS ENUM ('idle', 'running', 'succeeded', 'failed');

-- CreateTable
CREATE TABLE "PosProviderIntegration" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "provider" "PosProviderType" NOT NULL,
    "displayName" TEXT,
    "status" "PosIntegrationStatus" NOT NULL DEFAULT 'enabled',
    "capabilities" "PosProviderCapability"[] NOT NULL,
    "credentials" JSONB NOT NULL,
    "locations" JSONB,
    "devices" JSONB,
    "webhookSecret" TEXT,
    "lastValidatedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosProviderIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosProviderSync" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "type" "PosSyncTarget" NOT NULL,
    "status" "PosSyncStatus" NOT NULL DEFAULT 'idle',
    "lastRunAt" TIMESTAMP(3),
    "lastError" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosProviderSync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PosProviderIntegration_campgroundId_provider_key" ON "PosProviderIntegration"("campgroundId", "provider");

-- CreateIndex
CREATE INDEX "PosProviderIntegration_campgroundId_status_idx" ON "PosProviderIntegration"("campgroundId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PosProviderSync_integrationId_type_key" ON "PosProviderSync"("integrationId", "type");

-- CreateIndex
CREATE INDEX "PosProviderSync_integrationId_type_idx" ON "PosProviderSync"("integrationId", "type");

-- AddForeignKey
ALTER TABLE "PosProviderIntegration" ADD CONSTRAINT "PosProviderIntegration_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosProviderSync" ADD CONSTRAINT "PosProviderSync_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "PosProviderIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
