-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('open', 'investigating', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('injury', 'property_damage', 'safety', 'security', 'near_miss', 'environmental', 'other');

-- CreateEnum
CREATE TYPE "IncidentTaskStatus" AS ENUM ('pending', 'in_progress', 'done', 'cancelled');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('photo', 'document', 'note', 'audio', 'video', 'other');

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('pending', 'in_progress', 'completed', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "OnboardingStep" AS ENUM ('account_profile', 'payment_gateway', 'taxes_and_fees', 'inventory_sites', 'rates_and_fees', 'policies', 'communications_templates', 'pos_hardware', 'imports');

-- CreateEnum
CREATE TYPE "AccessProviderType" AS ENUM ('kisi', 'brivo', 'cloudkey');

-- CreateEnum
CREATE TYPE "AccessGrantStatus" AS ENUM ('pending', 'active', 'revoked', 'blocked', 'expired', 'failed');

-- CreateEnum
CREATE TYPE "AccessCredentialType" AS ENUM ('pin', 'card', 'fob', 'mobile', 'qr');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('scheduled', 'in_progress', 'submitted', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "ShiftApprovalStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "TimeEntryStatus" AS ENUM ('open', 'submitted', 'approved', 'rejected', 'corrected');

-- CreateEnum
CREATE TYPE "TimeEntrySource" AS ENUM ('kiosk', 'mobile', 'web', 'manual');

-- CreateEnum
CREATE TYPE "OverrideType" AS ENUM ('comp', 'void', 'discount');

-- CreateEnum
CREATE TYPE "OverrideStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "PayrollProvider" AS ENUM ('generic', 'onpay');

-- CreateEnum
CREATE TYPE "PayrollExportStatus" AS ENUM ('pending', 'generated', 'failed');

-- CreateEnum
CREATE TYPE "PayrollExportFormat" AS ENUM ('csv', 'json');

-- DropForeignKey
ALTER TABLE "GlAccount" DROP CONSTRAINT "GlAccount_campgroundId_fkey";

-- DropForeignKey
ALTER TABLE "GlMapping" DROP CONSTRAINT "GlMapping_campgroundId_fkey";

-- DropForeignKey
ALTER TABLE "GlMapping" DROP CONSTRAINT "GlMapping_glAccountId_fkey";

-- DropForeignKey
ALTER TABLE "LedgerLine" DROP CONSTRAINT "LedgerLine_glAccountId_fkey";

-- DropForeignKey
ALTER TABLE "LedgerLine" DROP CONSTRAINT "LedgerLine_ledgerEntryId_fkey";

-- DropForeignKey
ALTER TABLE "PayoutRecon" DROP CONSTRAINT "PayoutRecon_campgroundId_fkey";

-- DropForeignKey
ALTER TABLE "PayoutReconLine" DROP CONSTRAINT "PayoutReconLine_glEntryId_fkey";

-- DropForeignKey
ALTER TABLE "PayoutReconLine" DROP CONSTRAINT "PayoutReconLine_payoutReconId_fkey";

-- DropIndex
DROP INDEX "LedgerEntry_sourceTxId_idx";

-- AlterTable
ALTER TABLE "CampgroundPaymentGatewayConfig" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "GatewayFeePreset" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "LedgerEntry" DROP COLUMN "adjustment",
DROP COLUMN "hash",
DROP COLUMN "sourceTs",
DROP COLUMN "sourceTxId",
DROP COLUMN "sourceType";

-- AlterTable
ALTER TABLE "Payout" DROP COLUMN "cashPostedAt",
DROP COLUMN "reconAt",
DROP COLUMN "reconDriftCents",
DROP COLUMN "reconLedgerNetCents",
DROP COLUMN "reconLineSumCents",
DROP COLUMN "reconStatus";

-- AlterTable
ALTER TABLE "PosOfflineReplay" ALTER COLUMN "status" DROP NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SiteClass" ALTER COLUMN "meteredMultiplier" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "StaffShift" ADD COLUMN     "actualMinutes" INTEGER,
ADD COLUMN     "approvalNote" TEXT,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "roleId" TEXT,
ADD COLUMN     "scheduledMinutes" INTEGER,
ADD COLUMN     "status" "ShiftStatus" NOT NULL DEFAULT 'scheduled';

-- DropTable
DROP TABLE "GlAccount";

-- DropTable
DROP TABLE "GlMapping";

-- DropTable
DROP TABLE "LedgerLine";

-- DropTable
DROP TABLE "PayoutRecon";

-- DropTable
DROP TABLE "PayoutReconLine";

-- DropTable
DROP TABLE "TaxJurisdiction";

-- DropTable
DROP TABLE "TaxProduct";

-- DropEnum
DROP TYPE "GlAccountType";

-- DropEnum
DROP TYPE "GlMappingKind";

-- DropEnum
DROP TYPE "PayoutReconLineStatus";

-- DropEnum
DROP TYPE "PayoutReconLineType";

-- DropEnum
DROP TYPE "PayoutReconStatus";

-- DropEnum
DROP TYPE "TaxProductType";

-- CreateTable
CREATE TABLE "SiteMapLayout" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "geometry" JSONB NOT NULL,
    "centroid" JSONB,
    "label" TEXT,
    "rotation" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteMapLayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampgroundMapConfig" (
    "campgroundId" TEXT NOT NULL,
    "bounds" JSONB,
    "defaultCenter" JSONB,
    "defaultZoom" DOUBLE PRECISION,
    "layers" JSONB,
    "legend" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampgroundMapConfig_pkey" PRIMARY KEY ("campgroundId")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "reservationId" TEXT,
    "guestId" TEXT,
    "type" "IncidentType" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'open',
    "severity" "Severity",
    "notes" TEXT,
    "photos" JSONB,
    "witnesses" JSONB,
    "occurredAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "claimId" TEXT,
    "reminderAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentTask" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "IncidentTaskStatus" NOT NULL DEFAULT 'pending',
    "dueAt" TIMESTAMP(3),
    "reminderAt" TIMESTAMP(3),
    "assignedTo" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentEvidence" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "type" "EvidenceType" NOT NULL DEFAULT 'photo',
    "url" TEXT,
    "storageKey" TEXT,
    "description" TEXT,
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "IncidentEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificateOfInsurance" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "guestId" TEXT,
    "reservationId" TEXT,
    "incidentId" TEXT,
    "provider" TEXT,
    "policyNumber" TEXT,
    "coverageType" TEXT,
    "fileUrl" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertificateOfInsurance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingCycle" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "cadence" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "generatedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "BillingCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "billingCycleId" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "balanceCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "unitCents" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "meta" JSONB,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UtilityRatePlan" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "pricingMode" TEXT NOT NULL,
    "baseRateCents" INTEGER NOT NULL,
    "tiers" JSONB,
    "demandFeeCents" INTEGER,
    "minimumCents" INTEGER,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),

    CONSTRAINT "UtilityRatePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UtilityMeter" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "serialNumber" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "ratePlanId" TEXT,
    "billingMode" TEXT NOT NULL DEFAULT 'cycle',
    "billTo" TEXT NOT NULL DEFAULT 'reservation',
    "multiplier" DECIMAL(65,30) NOT NULL DEFAULT 1.0,
    "autoEmail" BOOLEAN NOT NULL DEFAULT false,
    "lastBilledReadAt" TIMESTAMP(3),

    CONSTRAINT "UtilityMeter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UtilityMeterRead" (
    "id" TEXT NOT NULL,
    "meterId" TEXT NOT NULL,
    "readingValue" DECIMAL(65,30) NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "note" TEXT,
    "readBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UtilityMeterRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LateFeeRule" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "cadence" TEXT NOT NULL,
    "graceDays" INTEGER NOT NULL DEFAULT 3,
    "feeType" TEXT NOT NULL,
    "feeCents" INTEGER,
    "feePercentBp" INTEGER,
    "applyPerInvoice" BOOLEAN NOT NULL DEFAULT true,
    "maxOccurrences" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),

    CONSTRAINT "LateFeeRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArLedgerEntry" (
    "id" TEXT NOT NULL,
    "ledgerEntryId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "invoiceLineId" TEXT,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralProgram" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "linkSlug" TEXT,
    "source" TEXT,
    "channel" TEXT,
    "incentiveType" "ReferralIncentiveType" NOT NULL DEFAULT 'percent_discount',
    "incentiveValue" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingInvite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "organizationId" TEXT,
    "campgroundId" TEXT,
    "invitedById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingSession" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "organizationId" TEXT,
    "campgroundId" TEXT,
    "status" "OnboardingStatus" NOT NULL DEFAULT 'pending',
    "currentStep" "OnboardingStep" NOT NULL DEFAULT 'account_profile',
    "completedSteps" "OnboardingStep"[] DEFAULT ARRAY[]::"OnboardingStep"[],
    "data" JSONB,
    "progress" JSONB,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessIntegration" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "provider" "AccessProviderType" NOT NULL,
    "displayName" TEXT,
    "status" TEXT DEFAULT 'enabled',
    "credentials" JSONB NOT NULL,
    "webhookSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "reservationId" TEXT,
    "guestId" TEXT,
    "plate" TEXT,
    "state" TEXT,
    "rigType" TEXT,
    "rigLength" INTEGER,
    "description" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessCredential" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "reservationId" TEXT,
    "vehicleId" TEXT,
    "integrationId" TEXT,
    "provider" "AccessProviderType" NOT NULL,
    "type" "AccessCredentialType" NOT NULL,
    "maskedValue" TEXT,
    "secretHash" TEXT,
    "label" TEXT,
    "metadata" JSONB,
    "status" "AccessGrantStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessGrant" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "siteId" TEXT,
    "vehicleId" TEXT,
    "credentialId" TEXT,
    "integrationId" TEXT,
    "provider" "AccessProviderType" NOT NULL,
    "status" "AccessGrantStatus" NOT NULL DEFAULT 'pending',
    "providerAccessId" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "blockedReason" TEXT,
    "idempotencyKey" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffRole" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hourlyRate" DECIMAL(10,2),
    "earningCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffTimeEntry" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clockInAt" TIMESTAMP(3) NOT NULL,
    "clockOutAt" TIMESTAMP(3),
    "source" "TimeEntrySource" NOT NULL DEFAULT 'web',
    "status" "TimeEntryStatus" NOT NULL DEFAULT 'open',
    "note" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffTimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftApproval" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "status" "ShiftApprovalStatus" NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OverrideRequest" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "approverId" TEXT,
    "type" "OverrideType" NOT NULL,
    "reason" TEXT,
    "status" "OverrideStatus" NOT NULL DEFAULT 'pending',
    "targetEntity" TEXT,
    "targetId" TEXT,
    "deltaAmount" DECIMAL(10,2),
    "metadata" JSONB,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OverrideRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollEarningCode" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "roleCode" TEXT NOT NULL,
    "provider" "PayrollProvider" NOT NULL DEFAULT 'generic',
    "earningCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollEarningCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollExport" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "provider" "PayrollProvider" NOT NULL DEFAULT 'generic',
    "format" "PayrollExportFormat" NOT NULL DEFAULT 'csv',
    "status" "PayrollExportStatus" NOT NULL DEFAULT 'pending',
    "requestedById" TEXT NOT NULL,
    "rowCount" INTEGER,
    "totalHours" DOUBLE PRECISION,
    "fileKey" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PayrollExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollExportLine" (
    "id" TEXT NOT NULL,
    "exportId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shiftId" TEXT,
    "timeEntryId" TEXT,
    "hours" DOUBLE PRECISION NOT NULL,
    "earningCode" TEXT,
    "rate" DECIMAL(10,2),
    "roleCode" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollExportLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteMapLayout_siteId_key" ON "SiteMapLayout"("siteId");

-- CreateIndex
CREATE INDEX "SiteMapLayout_campgroundId_idx" ON "SiteMapLayout"("campgroundId");

-- CreateIndex
CREATE INDEX "Incident_campgroundId_idx" ON "Incident"("campgroundId");

-- CreateIndex
CREATE INDEX "Incident_reservationId_idx" ON "Incident"("reservationId");

-- CreateIndex
CREATE INDEX "Incident_guestId_idx" ON "Incident"("guestId");

-- CreateIndex
CREATE INDEX "Incident_status_idx" ON "Incident"("status");

-- CreateIndex
CREATE INDEX "Incident_type_idx" ON "Incident"("type");

-- CreateIndex
CREATE INDEX "IncidentTask_incidentId_idx" ON "IncidentTask"("incidentId");

-- CreateIndex
CREATE INDEX "IncidentTask_status_idx" ON "IncidentTask"("status");

-- CreateIndex
CREATE INDEX "IncidentTask_dueAt_idx" ON "IncidentTask"("dueAt");

-- CreateIndex
CREATE INDEX "IncidentEvidence_incidentId_idx" ON "IncidentEvidence"("incidentId");

-- CreateIndex
CREATE INDEX "IncidentEvidence_type_idx" ON "IncidentEvidence"("type");

-- CreateIndex
CREATE INDEX "CertificateOfInsurance_campgroundId_idx" ON "CertificateOfInsurance"("campgroundId");

-- CreateIndex
CREATE INDEX "CertificateOfInsurance_guestId_idx" ON "CertificateOfInsurance"("guestId");

-- CreateIndex
CREATE INDEX "CertificateOfInsurance_reservationId_idx" ON "CertificateOfInsurance"("reservationId");

-- CreateIndex
CREATE INDEX "CertificateOfInsurance_incidentId_idx" ON "CertificateOfInsurance"("incidentId");

-- CreateIndex
CREATE INDEX "CertificateOfInsurance_expiresAt_idx" ON "CertificateOfInsurance"("expiresAt");

-- CreateIndex
CREATE INDEX "BillingCycle_campgroundId_reservationId_periodStart_periodE_idx" ON "BillingCycle"("campgroundId", "reservationId", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE INDEX "Invoice_reservationId_status_idx" ON "Invoice"("reservationId", "status");

-- CreateIndex
CREATE INDEX "Invoice_campgroundId_idx" ON "Invoice"("campgroundId");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceId_type_idx" ON "InvoiceLine"("invoiceId", "type");

-- CreateIndex
CREATE INDEX "UtilityRatePlan_campgroundId_type_effectiveFrom_idx" ON "UtilityRatePlan"("campgroundId", "type", "effectiveFrom");

-- CreateIndex
CREATE INDEX "UtilityMeter_campgroundId_idx" ON "UtilityMeter"("campgroundId");

-- CreateIndex
CREATE INDEX "UtilityMeter_siteId_type_idx" ON "UtilityMeter"("siteId", "type");

-- CreateIndex
CREATE INDEX "UtilityMeterRead_meterId_readAt_idx" ON "UtilityMeterRead"("meterId", "readAt");

-- CreateIndex
CREATE INDEX "LateFeeRule_campgroundId_cadence_active_idx" ON "LateFeeRule"("campgroundId", "cadence", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ArLedgerEntry_ledgerEntryId_key" ON "ArLedgerEntry"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "ArLedgerEntry_invoiceId_idx" ON "ArLedgerEntry"("invoiceId");

-- CreateIndex
CREATE INDEX "ArLedgerEntry_invoiceLineId_idx" ON "ArLedgerEntry"("invoiceLineId");

-- CreateIndex
CREATE INDEX "ReferralProgram_campgroundId_isActive_idx" ON "ReferralProgram"("campgroundId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralProgram_campgroundId_code_key" ON "ReferralProgram"("campgroundId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralProgram_campgroundId_linkSlug_key" ON "ReferralProgram"("campgroundId", "linkSlug");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingInvite_token_key" ON "OnboardingInvite"("token");

-- CreateIndex
CREATE INDEX "OnboardingInvite_token_idx" ON "OnboardingInvite"("token");

-- CreateIndex
CREATE INDEX "OnboardingInvite_organizationId_createdAt_idx" ON "OnboardingInvite"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "OnboardingInvite_campgroundId_createdAt_idx" ON "OnboardingInvite"("campgroundId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingSession_inviteId_key" ON "OnboardingSession"("inviteId");

-- CreateIndex
CREATE INDEX "OnboardingSession_inviteId_idx" ON "OnboardingSession"("inviteId");

-- CreateIndex
CREATE INDEX "OnboardingSession_organizationId_idx" ON "OnboardingSession"("organizationId");

-- CreateIndex
CREATE INDEX "OnboardingSession_campgroundId_idx" ON "OnboardingSession"("campgroundId");

-- CreateIndex
CREATE INDEX "AccessIntegration_campgroundId_idx" ON "AccessIntegration"("campgroundId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessIntegration_campgroundId_provider_key" ON "AccessIntegration"("campgroundId", "provider");

-- CreateIndex
CREATE INDEX "Vehicle_campgroundId_idx" ON "Vehicle"("campgroundId");

-- CreateIndex
CREATE INDEX "Vehicle_plate_state_idx" ON "Vehicle"("plate", "state");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_reservationId_key" ON "Vehicle"("reservationId");

-- CreateIndex
CREATE INDEX "AccessCredential_campgroundId_idx" ON "AccessCredential"("campgroundId");

-- CreateIndex
CREATE INDEX "AccessCredential_reservationId_idx" ON "AccessCredential"("reservationId");

-- CreateIndex
CREATE INDEX "AccessCredential_vehicleId_idx" ON "AccessCredential"("vehicleId");

-- CreateIndex
CREATE INDEX "AccessGrant_campgroundId_idx" ON "AccessGrant"("campgroundId");

-- CreateIndex
CREATE INDEX "AccessGrant_reservationId_idx" ON "AccessGrant"("reservationId");

-- CreateIndex
CREATE INDEX "AccessGrant_siteId_idx" ON "AccessGrant"("siteId");

-- CreateIndex
CREATE INDEX "AccessGrant_provider_idempotencyKey_idx" ON "AccessGrant"("provider", "idempotencyKey");

-- CreateIndex
CREATE INDEX "AccessGrant_endsAt_idx" ON "AccessGrant"("endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccessGrant_reservationId_provider_key" ON "AccessGrant"("reservationId", "provider");

-- CreateIndex
CREATE INDEX "StaffRole_campgroundId_isActive_idx" ON "StaffRole"("campgroundId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "StaffRole_campgroundId_code_key" ON "StaffRole"("campgroundId", "code");

-- CreateIndex
CREATE INDEX "StaffTimeEntry_campgroundId_userId_status_idx" ON "StaffTimeEntry"("campgroundId", "userId", "status");

-- CreateIndex
CREATE INDEX "StaffTimeEntry_shiftId_idx" ON "StaffTimeEntry"("shiftId");

-- CreateIndex
CREATE INDEX "ShiftApproval_shiftId_status_idx" ON "ShiftApproval"("shiftId", "status");

-- CreateIndex
CREATE INDEX "ShiftApproval_approverId_idx" ON "ShiftApproval"("approverId");

-- CreateIndex
CREATE INDEX "OverrideRequest_campgroundId_status_type_idx" ON "OverrideRequest"("campgroundId", "status", "type");

-- CreateIndex
CREATE INDEX "OverrideRequest_targetEntity_targetId_idx" ON "OverrideRequest"("targetEntity", "targetId");

-- CreateIndex
CREATE INDEX "PayrollEarningCode_campgroundId_provider_idx" ON "PayrollEarningCode"("campgroundId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollEarningCode_campgroundId_roleCode_provider_key" ON "PayrollEarningCode"("campgroundId", "roleCode", "provider");

-- CreateIndex
CREATE INDEX "PayrollExport_campgroundId_periodStart_periodEnd_idx" ON "PayrollExport"("campgroundId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "PayrollExport_provider_status_idx" ON "PayrollExport"("provider", "status");

-- CreateIndex
CREATE INDEX "PayrollExportLine_exportId_idx" ON "PayrollExportLine"("exportId");

-- CreateIndex
CREATE INDEX "PayrollExportLine_userId_idx" ON "PayrollExportLine"("userId");

-- CreateIndex
CREATE INDEX "CampgroundPaymentGatewayConfig_campgroundId_idx" ON "CampgroundPaymentGatewayConfig"("campgroundId");

-- CreateIndex
CREATE INDEX "PosOfflineReplay_campgroundId_idx" ON "PosOfflineReplay"("campgroundId");

-- CreateIndex
CREATE INDEX "Reservation_referralCode_idx" ON "Reservation"("referralCode");

-- CreateIndex
CREATE INDEX "Reservation_referralProgramId_idx" ON "Reservation"("referralProgramId");

-- CreateIndex
CREATE UNIQUE INDEX "SignatureArtifact_requestId_key" ON "SignatureArtifact"("requestId");

-- CreateIndex
CREATE INDEX "StaffShift_roleId_idx" ON "StaffShift"("roleId");

-- CreateIndex
CREATE INDEX "StaffShift_status_idx" ON "StaffShift"("status");

-- AddForeignKey
ALTER TABLE "SiteMapLayout" ADD CONSTRAINT "SiteMapLayout_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteMapLayout" ADD CONSTRAINT "SiteMapLayout_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampgroundMapConfig" ADD CONSTRAINT "CampgroundMapConfig_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_referralProgramId_fkey" FOREIGN KEY ("referralProgramId") REFERENCES "ReferralProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentTask" ADD CONSTRAINT "IncidentTask_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentEvidence" ADD CONSTRAINT "IncidentEvidence_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateOfInsurance" ADD CONSTRAINT "CertificateOfInsurance_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateOfInsurance" ADD CONSTRAINT "CertificateOfInsurance_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateOfInsurance" ADD CONSTRAINT "CertificateOfInsurance_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateOfInsurance" ADD CONSTRAINT "CertificateOfInsurance_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingCycle" ADD CONSTRAINT "BillingCycle_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingCycle" ADD CONSTRAINT "BillingCycle_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_billingCycleId_fkey" FOREIGN KEY ("billingCycleId") REFERENCES "BillingCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilityRatePlan" ADD CONSTRAINT "UtilityRatePlan_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilityMeter" ADD CONSTRAINT "UtilityMeter_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "UtilityRatePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilityMeter" ADD CONSTRAINT "UtilityMeter_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilityMeter" ADD CONSTRAINT "UtilityMeter_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilityMeterRead" ADD CONSTRAINT "UtilityMeterRead_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "UtilityMeter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LateFeeRule" ADD CONSTRAINT "LateFeeRule_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArLedgerEntry" ADD CONSTRAINT "ArLedgerEntry_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "LedgerEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArLedgerEntry" ADD CONSTRAINT "ArLedgerEntry_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArLedgerEntry" ADD CONSTRAINT "ArLedgerEntry_invoiceLineId_fkey" FOREIGN KEY ("invoiceLineId") REFERENCES "InvoiceLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralProgram" ADD CONSTRAINT "ReferralProgram_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingInvite" ADD CONSTRAINT "OnboardingInvite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingInvite" ADD CONSTRAINT "OnboardingInvite_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingInvite" ADD CONSTRAINT "OnboardingInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingSession" ADD CONSTRAINT "OnboardingSession_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "OnboardingInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingSession" ADD CONSTRAINT "OnboardingSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingSession" ADD CONSTRAINT "OnboardingSession_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessIntegration" ADD CONSTRAINT "AccessIntegration_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessCredential" ADD CONSTRAINT "AccessCredential_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessCredential" ADD CONSTRAINT "AccessCredential_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessCredential" ADD CONSTRAINT "AccessCredential_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessCredential" ADD CONSTRAINT "AccessCredential_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "AccessIntegration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "AccessCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "AccessIntegration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffShift" ADD CONSTRAINT "StaffShift_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "StaffRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffRole" ADD CONSTRAINT "StaffRole_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffTimeEntry" ADD CONSTRAINT "StaffTimeEntry_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "StaffShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffTimeEntry" ADD CONSTRAINT "StaffTimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffTimeEntry" ADD CONSTRAINT "StaffTimeEntry_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftApproval" ADD CONSTRAINT "ShiftApproval_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "StaffShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftApproval" ADD CONSTRAINT "ShiftApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OverrideRequest" ADD CONSTRAINT "OverrideRequest_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OverrideRequest" ADD CONSTRAINT "OverrideRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OverrideRequest" ADD CONSTRAINT "OverrideRequest_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollExport" ADD CONSTRAINT "PayrollExport_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollExport" ADD CONSTRAINT "PayrollExport_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollExportLine" ADD CONSTRAINT "PayrollExportLine_exportId_fkey" FOREIGN KEY ("exportId") REFERENCES "PayrollExport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollExportLine" ADD CONSTRAINT "PayrollExportLine_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollExportLine" ADD CONSTRAINT "PayrollExportLine_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "StaffShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollExportLine" ADD CONSTRAINT "PayrollExportLine_timeEntryId_fkey" FOREIGN KEY ("timeEntryId") REFERENCES "StaffTimeEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosOfflineReplay" ADD CONSTRAINT "PosOfflineReplay_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "GlPeriod_campground_range_idx" RENAME TO "GlPeriod_campgroundId_startDate_endDate_idx";

-- RenameIndex
ALTER INDEX "GlPeriod_campground_status_idx" RENAME TO "GlPeriod_campgroundId_status_idx";

