-- Payout reconciliation status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PayoutReconStatus') THEN
    CREATE TYPE "PayoutReconStatus" AS ENUM ('pending', 'matched', 'drift', 'posted');
  END IF;
END
$$;

-- Ensure enum has required values
ALTER TYPE "PayoutReconStatus" ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE "PayoutReconStatus" ADD VALUE IF NOT EXISTS 'drift';

-- Extend payouts with reconciliation metadata
ALTER TABLE "Payout"
  ADD COLUMN "reconStatus" "PayoutReconStatus" NOT NULL DEFAULT 'draft',
  ADD COLUMN "reconDriftCents" INTEGER,
  ADD COLUMN "reconLedgerNetCents" INTEGER,
  ADD COLUMN "reconLineSumCents" INTEGER,
  ADD COLUMN "reconAt" TIMESTAMP(3),
  ADD COLUMN "cashPostedAt" TIMESTAMP(3);
