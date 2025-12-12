-- CreateEnum
CREATE TYPE "WaitlistOfferStatus" AS ENUM ('pending', 'sent', 'accepted', 'declined', 'expired', 'failed');

-- CreateEnum
CREATE TYPE "StoredValueType" AS ENUM ('gift', 'credit');

-- CreateEnum
CREATE TYPE "StoredValueStatus" AS ENUM ('active', 'frozen', 'expired');

-- CreateEnum
CREATE TYPE "StoredValueDirection" AS ENUM ('issue', 'redeem', 'adjust', 'expire', 'refund', 'hold_create', 'hold_capture', 'hold_release');

-- CreateEnum
CREATE TYPE "StoredValueHoldStatus" AS ENUM ('open', 'captured', 'released', 'expired');

-- CreateEnum
CREATE TYPE "PosCartStatus" AS ENUM ('open', 'checked_out', 'void');

-- CreateEnum
CREATE TYPE "PosPaymentMethod" AS ENUM ('card', 'cash', 'gift', 'store_credit', 'charge_to_site');

-- CreateEnum
CREATE TYPE "PosPaymentStatus" AS ENUM ('pending', 'succeeded', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "TillSessionStatus" AS ENUM ('open', 'closed');

-- CreateEnum
CREATE TYPE "TillMovementType" AS ENUM ('cash_sale', 'cash_refund', 'paid_in', 'paid_out', 'adjustment');

-- CreateEnum
CREATE TYPE "PosReturnStatus" AS ENUM ('pending', 'completed', 'failed');

-- AlterTable
ALTER TABLE "WaitlistEntry" ADD COLUMN     "cooldownUntil" TIMESTAMP(3),
ADD COLUMN     "lastOfferSentAt" TIMESTAMP(3),
ADD COLUMN     "lastOfferStatus" TEXT,
ADD COLUMN     "offerCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "throttleBucket" TEXT;

-- CreateTable
CREATE TABLE "WaitlistOffer" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "inventoryRef" TEXT NOT NULL,
    "offerExpiresAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "autoExpiredAt" TIMESTAMP(3),
    "status" "WaitlistOfferStatus" NOT NULL DEFAULT 'pending',
    "commsTemplateId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitlistOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistInventoryHold" (
    "id" TEXT NOT NULL,
    "inventoryRef" TEXT NOT NULL,
    "entryId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'held',
    "holdExpiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitlistInventoryHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredValueAccount" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "type" "StoredValueType" NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "StoredValueStatus" NOT NULL DEFAULT 'active',
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "liabilityAccount" TEXT,
    "createdBy" TEXT,
    "createdVia" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoredValueAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredValueCode" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "pinHash" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "redeemedByGuestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredValueCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredValueLedger" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "direction" "StoredValueDirection" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "beforeBalanceCents" INTEGER NOT NULL,
    "afterBalanceCents" INTEGER NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "actorType" TEXT,
    "actorId" TEXT,
    "channel" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredValueLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredValueHold" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "StoredValueHoldStatus" NOT NULL DEFAULT 'open',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoredValueHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosTerminal" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "locationId" TEXT,
    "offlineCapable" BOOLEAN NOT NULL DEFAULT false,
    "taxVersion" TEXT,
    "priceVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosTerminal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosCart" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "terminalId" TEXT,
    "status" "PosCartStatus" NOT NULL DEFAULT 'open',
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "netCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "feeCents" INTEGER NOT NULL DEFAULT 0,
    "grossCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL,
    "taxVersion" TEXT,
    "priceVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosCart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosCartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "feeCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "PosCartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosPayment" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "method" "PosPaymentMethod" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "PosPaymentStatus" NOT NULL DEFAULT 'pending',
    "idempotencyKey" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "processorIds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TillSession" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "terminalId" TEXT,
    "status" "TillSessionStatus" NOT NULL DEFAULT 'open',
    "openingFloatCents" INTEGER NOT NULL DEFAULT 0,
    "expectedCloseCents" INTEGER NOT NULL DEFAULT 0,
    "countedCloseCents" INTEGER,
    "overShortCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL,
    "notes" TEXT,
    "openedByUserId" TEXT NOT NULL,
    "closedByUserId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TillSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TillMovement" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "TillMovementType" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "sourceCartId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TillMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosReturn" (
    "id" TEXT NOT NULL,
    "originalCartId" TEXT NOT NULL,
    "status" "PosReturnStatus" NOT NULL DEFAULT 'pending',
    "reasonCode" TEXT,
    "restock" BOOLEAN NOT NULL DEFAULT false,
    "netCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "feeCents" INTEGER NOT NULL DEFAULT 0,
    "grossCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactReservationsDaily" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "metricDate" DATE NOT NULL,
    "roomsAvailable" INTEGER NOT NULL,
    "roomsSold" INTEGER NOT NULL,
    "roomRevenueCents" INTEGER NOT NULL,
    "taxesCents" INTEGER NOT NULL DEFAULT 0,
    "feesCents" INTEGER NOT NULL DEFAULT 0,
    "discountsCents" INTEGER NOT NULL DEFAULT 0,
    "channel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactReservationsDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactPosDaily" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "locationId" TEXT,
    "metricDate" DATE NOT NULL,
    "netCents" INTEGER NOT NULL,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "feeCents" INTEGER NOT NULL DEFAULT 0,
    "discountsCents" INTEGER NOT NULL DEFAULT 0,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactPosDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactStoredValueDaily" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "metricDate" DATE NOT NULL,
    "issuedCents" INTEGER NOT NULL DEFAULT 0,
    "redeemedCents" INTEGER NOT NULL DEFAULT 0,
    "expiredCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactStoredValueDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WaitlistOffer_entryId_status_idx" ON "WaitlistOffer"("entryId", "status");

-- CreateIndex
CREATE INDEX "WaitlistOffer_idempotencyKey_idx" ON "WaitlistOffer"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WaitlistOffer_inventoryRef_idx" ON "WaitlistOffer"("inventoryRef");

-- CreateIndex
CREATE INDEX "WaitlistInventoryHold_inventoryRef_status_idx" ON "WaitlistInventoryHold"("inventoryRef", "status");

-- CreateIndex
CREATE INDEX "WaitlistInventoryHold_entryId_idx" ON "WaitlistInventoryHold"("entryId");

-- CreateIndex
CREATE INDEX "StoredValueAccount_campgroundId_idx" ON "StoredValueAccount"("campgroundId");

-- CreateIndex
CREATE INDEX "StoredValueAccount_status_idx" ON "StoredValueAccount"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StoredValueCode_code_key" ON "StoredValueCode"("code");

-- CreateIndex
CREATE INDEX "StoredValueCode_accountId_idx" ON "StoredValueCode"("accountId");

-- CreateIndex
CREATE INDEX "StoredValueLedger_campgroundId_idempotencyKey_idx" ON "StoredValueLedger"("campgroundId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "StoredValueLedger_accountId_createdAt_idx" ON "StoredValueLedger"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "StoredValueHold_accountId_status_idx" ON "StoredValueHold"("accountId", "status");

-- CreateIndex
CREATE INDEX "PosTerminal_campgroundId_idx" ON "PosTerminal"("campgroundId");

-- CreateIndex
CREATE INDEX "PosCart_campgroundId_status_idx" ON "PosCart"("campgroundId", "status");

-- CreateIndex
CREATE INDEX "PosCart_terminalId_idx" ON "PosCart"("terminalId");

-- CreateIndex
CREATE INDEX "PosCartItem_cartId_idx" ON "PosCartItem"("cartId");

-- CreateIndex
CREATE INDEX "PosCartItem_productId_idx" ON "PosCartItem"("productId");

-- CreateIndex
CREATE INDEX "PosPayment_cartId_idx" ON "PosPayment"("cartId");

-- CreateIndex
CREATE INDEX "PosPayment_idempotencyKey_idx" ON "PosPayment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "TillSession_campgroundId_status_idx" ON "TillSession"("campgroundId", "status");

-- CreateIndex
CREATE INDEX "TillSession_terminalId_status_idx" ON "TillSession"("terminalId", "status");

-- CreateIndex
CREATE INDEX "TillMovement_sessionId_type_idx" ON "TillMovement"("sessionId", "type");

-- CreateIndex
CREATE INDEX "TillMovement_sourceCartId_idx" ON "TillMovement"("sourceCartId");

-- CreateIndex
CREATE INDEX "PosReturn_originalCartId_idx" ON "PosReturn"("originalCartId");

-- CreateIndex
CREATE INDEX "FactReservationsDaily_campgroundId_metricDate_idx" ON "FactReservationsDaily"("campgroundId", "metricDate");

-- CreateIndex
CREATE UNIQUE INDEX "FactReservationsDaily_campgroundId_metricDate_channel_key" ON "FactReservationsDaily"("campgroundId", "metricDate", "channel");

-- CreateIndex
CREATE INDEX "FactPosDaily_campgroundId_metricDate_idx" ON "FactPosDaily"("campgroundId", "metricDate");

-- CreateIndex
CREATE UNIQUE INDEX "FactPosDaily_campgroundId_metricDate_categoryId_key" ON "FactPosDaily"("campgroundId", "metricDate", "categoryId");

-- CreateIndex
CREATE INDEX "FactStoredValueDaily_campgroundId_metricDate_idx" ON "FactStoredValueDaily"("campgroundId", "metricDate");

-- CreateIndex
CREATE UNIQUE INDEX "FactStoredValueDaily_campgroundId_metricDate_key" ON "FactStoredValueDaily"("campgroundId", "metricDate");

-- AddForeignKey
ALTER TABLE "WaitlistOffer" ADD CONSTRAINT "WaitlistOffer_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "WaitlistEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistInventoryHold" ADD CONSTRAINT "WaitlistInventoryHold_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "WaitlistEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredValueAccount" ADD CONSTRAINT "StoredValueAccount_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredValueCode" ADD CONSTRAINT "StoredValueCode_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "StoredValueAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredValueCode" ADD CONSTRAINT "StoredValueCode_redeemedByGuestId_fkey" FOREIGN KEY ("redeemedByGuestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredValueLedger" ADD CONSTRAINT "StoredValueLedger_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredValueLedger" ADD CONSTRAINT "StoredValueLedger_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "StoredValueAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredValueHold" ADD CONSTRAINT "StoredValueHold_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "StoredValueAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosTerminal" ADD CONSTRAINT "PosTerminal_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosCart" ADD CONSTRAINT "PosCart_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosCart" ADD CONSTRAINT "PosCart_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "PosTerminal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosCartItem" ADD CONSTRAINT "PosCartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "PosCart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosCartItem" ADD CONSTRAINT "PosCartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosPayment" ADD CONSTRAINT "PosPayment_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "PosCart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TillSession" ADD CONSTRAINT "TillSession_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TillSession" ADD CONSTRAINT "TillSession_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "PosTerminal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TillSession" ADD CONSTRAINT "TillSession_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TillSession" ADD CONSTRAINT "TillSession_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TillMovement" ADD CONSTRAINT "TillMovement_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TillSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TillMovement" ADD CONSTRAINT "TillMovement_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TillMovement" ADD CONSTRAINT "TillMovement_sourceCartId_fkey" FOREIGN KEY ("sourceCartId") REFERENCES "PosCart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosReturn" ADD CONSTRAINT "PosReturn_originalCartId_fkey" FOREIGN KEY ("originalCartId") REFERENCES "PosCart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactReservationsDaily" ADD CONSTRAINT "FactReservationsDaily_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactPosDaily" ADD CONSTRAINT "FactPosDaily_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactStoredValueDaily" ADD CONSTRAINT "FactStoredValueDaily_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;
