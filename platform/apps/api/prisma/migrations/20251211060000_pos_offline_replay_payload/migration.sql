-- Persist offline replay payloads and tender/line items for reconciliation
CREATE TABLE "PosOfflineReplay" (
    "id" TEXT NOT NULL,
    "clientTxId" TEXT,
    "cartId" TEXT,
    "campgroundId" TEXT,
    "recordedTotalsHash" TEXT,
    "expectedHash" TEXT,
    "payloadHash" TEXT,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "payload" JSONB,
    "tender" JSONB,
    "items" JSONB,
    "expectedBreakdown" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PosOfflineReplay_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PosOfflineReplay_clientTxId_idx" ON "PosOfflineReplay"("clientTxId");
CREATE INDEX "PosOfflineReplay_cartId_idx" ON "PosOfflineReplay"("cartId");

ALTER TABLE "PosOfflineReplay" ADD CONSTRAINT "PosOfflineReplay_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "PosCart"("id") ON DELETE SET NULL ON UPDATE CASCADE;
