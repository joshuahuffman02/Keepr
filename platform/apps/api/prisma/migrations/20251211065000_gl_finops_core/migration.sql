-- Core GL + recon + tax scaffolding

-- Enums
CREATE TYPE "GlAccountType" AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');
CREATE TYPE "GlMappingKind" AS ENUM (
  'revenue',
  'fee_platform',
  'fee_gateway',
  'fee_channel',
  'tax_payable',
  'deposit_liability',
  'stored_value_liability',
  'cash_clearing',
  'payout_clearing'
);
CREATE TYPE "PayoutReconStatus" AS ENUM ('draft', 'matched', 'approved', 'posted');
CREATE TYPE "PayoutReconLineType" AS ENUM ('payout', 'fee', 'chargeback', 'reserve', 'adjustment', 'other');
CREATE TYPE "PayoutReconLineStatus" AS ENUM ('matched', 'exception');
CREATE TYPE "TaxProductType" AS ENUM ('lodging', 'pos_item', 'addon', 'fee');

-- Ledger entry extensions
ALTER TABLE "LedgerEntry"
  ADD COLUMN "sourceType" TEXT,
  ADD COLUMN "sourceTxId" TEXT,
  ADD COLUMN "sourceTs" TIMESTAMP(3),
  ADD COLUMN "hash" TEXT,
  ADD COLUMN "adjustment" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX "LedgerEntry_sourceTxId_idx" ON "LedgerEntry" ("sourceTxId");

-- GL accounts
CREATE TABLE "GlAccount" (
  "id" TEXT PRIMARY KEY,
  "campgroundId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "GlAccountType" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

ALTER TABLE "GlAccount"
  ADD CONSTRAINT "GlAccount_campgroundId_fkey"
    FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "GlAccount_campground_code_uq" ON "GlAccount" ("campgroundId", "code");
CREATE INDEX "GlAccount_campground_type_idx" ON "GlAccount" ("campgroundId", "type");

-- GL mappings
CREATE TABLE "GlMapping" (
  "id" TEXT PRIMARY KEY,
  "campgroundId" TEXT NOT NULL,
  "kind" "GlMappingKind" NOT NULL,
  "key" TEXT NOT NULL DEFAULT '',
  "glAccountId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

ALTER TABLE "GlMapping"
  ADD CONSTRAINT "GlMapping_campgroundId_fkey"
    FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GlMapping"
  ADD CONSTRAINT "GlMapping_glAccountId_fkey"
    FOREIGN KEY ("glAccountId") REFERENCES "GlAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "GlMapping_campground_kind_key_uq" ON "GlMapping" ("campgroundId", "kind", "key");
CREATE INDEX "GlMapping_glAccountId_idx" ON "GlMapping" ("glAccountId");

-- Ledger lines (double-entry)
CREATE TABLE "LedgerLine" (
  "id" TEXT PRIMARY KEY,
  "ledgerEntryId" TEXT NOT NULL,
  "glAccountId" TEXT NOT NULL,
  "side" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "memo" TEXT,
  "productCode" TEXT,
  "channelCode" TEXT,
  "taxJurisdiction" TEXT,
  "taxRateBps" INTEGER,
  "taxableBaseCents" INTEGER,
  "reconciliationKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

ALTER TABLE "LedgerLine"
  ADD CONSTRAINT "LedgerLine_ledgerEntryId_fkey"
    FOREIGN KEY ("ledgerEntryId") REFERENCES "LedgerEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LedgerLine"
  ADD CONSTRAINT "LedgerLine_glAccountId_fkey"
    FOREIGN KEY ("glAccountId") REFERENCES "GlAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "LedgerLine_ledgerEntryId_idx" ON "LedgerLine" ("ledgerEntryId");
CREATE INDEX "LedgerLine_glAccountId_idx" ON "LedgerLine" ("glAccountId");
CREATE INDEX "LedgerLine_reconciliationKey_idx" ON "LedgerLine" ("reconciliationKey");

-- Payout reconciliation
CREATE TABLE "PayoutRecon" (
  "id" TEXT PRIMARY KEY,
  "campgroundId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "status" "PayoutReconStatus" NOT NULL DEFAULT 'draft',
  "expectedAmountCents" INTEGER,
  "actualAmountCents" INTEGER,
  "varianceCents" INTEGER,
  "varianceReason" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "payoutDate" TIMESTAMP(3),
  "approvedByUserId" TEXT,
  "postedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

ALTER TABLE "PayoutRecon"
  ADD CONSTRAINT "PayoutRecon_campgroundId_fkey"
    FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "PayoutRecon_campground_status_idx" ON "PayoutRecon" ("campgroundId", "status");
CREATE INDEX "PayoutRecon_payoutDate_idx" ON "PayoutRecon" ("payoutDate");

CREATE TABLE "PayoutReconLine" (
  "id" TEXT PRIMARY KEY,
  "payoutReconId" TEXT NOT NULL,
  "type" "PayoutReconLineType" NOT NULL DEFAULT 'other',
  "status" "PayoutReconLineStatus" NOT NULL DEFAULT 'matched',
  "sourceTxId" TEXT,
  "sourceTs" TIMESTAMP(3),
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "glEntryId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

ALTER TABLE "PayoutReconLine"
  ADD CONSTRAINT "PayoutReconLine_payoutReconId_fkey"
    FOREIGN KEY ("payoutReconId") REFERENCES "PayoutRecon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayoutReconLine"
  ADD CONSTRAINT "PayoutReconLine_glEntryId_fkey"
    FOREIGN KEY ("glEntryId") REFERENCES "LedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "PayoutReconLine_payoutReconId_idx" ON "PayoutReconLine" ("payoutReconId");
CREATE INDEX "PayoutReconLine_sourceTxId_idx" ON "PayoutReconLine" ("sourceTxId");
CREATE INDEX "PayoutReconLine_glEntryId_idx" ON "PayoutReconLine" ("glEntryId");

-- Tax configuration
CREATE TABLE "TaxJurisdiction" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "region" TEXT,
  "city" TEXT,
  "postalPattern" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX "TaxJurisdiction_code_uq" ON "TaxJurisdiction" ("code");

CREATE TABLE "TaxProduct" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "TaxProductType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX "TaxProduct_code_uq" ON "TaxProduct" ("code");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'TaxRule' AND table_schema = current_schema()
  ) THEN
    CREATE TABLE "TaxRule" (
      "id" TEXT PRIMARY KEY,
      "jurisdictionId" TEXT NOT NULL,
      "productId" TEXT NOT NULL,
      "rateBps" INTEGER,
      "startsAt" TIMESTAMP(3),
      "endsAt" TIMESTAMP(3),
      "exemptFlags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      "taxName" TEXT,
      "accrueToAccountId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
    );

    ALTER TABLE "TaxRule"
      ADD CONSTRAINT "TaxRule_jurisdictionId_fkey"
        FOREIGN KEY ("jurisdictionId") REFERENCES "TaxJurisdiction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "TaxRule"
      ADD CONSTRAINT "TaxRule_productId_fkey"
        FOREIGN KEY ("productId") REFERENCES "TaxProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "TaxRule"
      ADD CONSTRAINT "TaxRule_accrueToAccountId_fkey"
        FOREIGN KEY ("accrueToAccountId") REFERENCES "GlAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

    CREATE INDEX "TaxRule_jurisdictionId_idx" ON "TaxRule" ("jurisdictionId");
    CREATE INDEX "TaxRule_productId_idx" ON "TaxRule" ("productId");
    CREATE INDEX "TaxRule_accrueToAccountId_idx" ON "TaxRule" ("accrueToAccountId");
  END IF;
END
$$;
