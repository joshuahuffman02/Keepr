-- CreateEnum
CREATE TYPE "PaymentGatewayProvider" AS ENUM ('stripe', 'adyen', 'authorize_net', 'other');

-- CreateEnum
CREATE TYPE "PaymentGatewayMode" AS ENUM ('test', 'prod');

-- CreateTable
CREATE TABLE "GatewayFeePreset" (
    "id" TEXT NOT NULL,
    "gateway" "PaymentGatewayProvider" NOT NULL,
    "mode" "PaymentGatewayMode" NOT NULL,
    "percentBasisPoints" INTEGER NOT NULL DEFAULT 0,
    "flatFeeCents" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GatewayFeePreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampgroundPaymentGatewayConfig" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "gateway" "PaymentGatewayProvider" NOT NULL,
    "mode" "PaymentGatewayMode" NOT NULL DEFAULT 'test',
    "feeMode" "PaymentFeeMode" NOT NULL DEFAULT 'absorb',
    "feePercentBasisPoints" INTEGER,
    "feeFlatCents" INTEGER,
    "feePresetId" TEXT,
    "publishableKeySecretId" TEXT,
    "secretKeySecretId" TEXT,
    "merchantAccountIdSecretId" TEXT,
    "webhookSecretId" TEXT,
    "additionalConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampgroundPaymentGatewayConfig_pkey" PRIMARY KEY ("id")
);

-- Seed presets for known gateways (editable later)
INSERT INTO "GatewayFeePreset" ("id", "gateway", "mode", "percentBasisPoints", "flatFeeCents", "label", "createdAt", "updatedAt") VALUES
  ('preset_stripe_test', 'stripe', 'test', 0, 0, 'Stripe test (no fees)', NOW(), NOW()),
  ('preset_stripe_prod', 'stripe', 'prod', 290, 30, 'Stripe default', NOW(), NOW()),
  ('preset_adyen_test', 'adyen', 'test', 0, 0, 'Adyen test (no fees)', NOW(), NOW()),
  ('preset_adyen_prod', 'adyen', 'prod', 250, 12, 'Adyen default', NOW(), NOW()),
  ('preset_authorize_test', 'authorize_net', 'test', 0, 0, 'Authorize.Net test', NOW(), NOW()),
  ('preset_authorize_prod', 'authorize_net', 'prod', 290, 30, 'Authorize.Net default', NOW(), NOW()),
  ('preset_other_prod', 'other', 'prod', 300, 30, 'Other gateway baseline', NOW(), NOW());

-- Backfill default config for existing campgrounds: Stripe test, absorb fees
INSERT INTO "CampgroundPaymentGatewayConfig" (
  "id",
  "campgroundId",
  "gateway",
  "mode",
  "feeMode",
  "feePercentBasisPoints",
  "feeFlatCents",
  "feePresetId",
  "createdAt",
  "updatedAt"
) SELECT
  concat('pgcfg_', "id"),
  "id",
  'stripe',
  'test',
  'absorb',
  0,
  0,
  'preset_stripe_test',
  NOW(),
  NOW()
FROM "Campground"
ON CONFLICT ("id") DO NOTHING;

-- CreateIndex
CREATE UNIQUE INDEX "CampgroundPaymentGatewayConfig_campgroundId_key" ON "CampgroundPaymentGatewayConfig"("campgroundId");

-- CreateIndex
CREATE INDEX "CampgroundPaymentGatewayConfig_gateway_mode_idx" ON "CampgroundPaymentGatewayConfig"("gateway", "mode");

-- CreateIndex
CREATE UNIQUE INDEX "GatewayFeePreset_gateway_mode_key" ON "GatewayFeePreset"("gateway", "mode");

-- CreateIndex
CREATE INDEX "GatewayFeePreset_gateway_mode_idx" ON "GatewayFeePreset"("gateway", "mode");

-- AddForeignKey
ALTER TABLE "CampgroundPaymentGatewayConfig" ADD CONSTRAINT "CampgroundPaymentGatewayConfig_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampgroundPaymentGatewayConfig" ADD CONSTRAINT "CampgroundPaymentGatewayConfig_feePresetId_fkey" FOREIGN KEY ("feePresetId") REFERENCES "GatewayFeePreset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
