-- CreateEnum
CREATE TYPE "SignatureDocumentType" AS ENUM ('long_term_stay', 'park_rules', 'deposit', 'waiver', 'coi', 'other');

-- CreateEnum
CREATE TYPE "SignatureRequestStatus" AS ENUM ('draft', 'sent', 'viewed', 'signed', 'declined', 'voided', 'expired');

-- CreateEnum
CREATE TYPE "SignatureDeliveryChannel" AS ENUM ('email', 'sms', 'email_and_sms');

-- CreateEnum
CREATE TYPE "CoiStatus" AS ENUM ('pending', 'active', 'expired', 'voided');

-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SignatureDocumentType" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureRequest" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "reservationId" TEXT,
    "guestId" TEXT,
    "templateId" TEXT,
    "documentType" "SignatureDocumentType" NOT NULL,
    "status" "SignatureRequestStatus" NOT NULL DEFAULT 'draft',
    "deliveryChannel" "SignatureDeliveryChannel" NOT NULL DEFAULT 'email',
    "token" TEXT NOT NULL,
    "subject" TEXT,
    "message" TEXT,
    "recipientName" TEXT,
    "recipientEmail" TEXT,
    "recipientPhone" TEXT,
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "reminderAt" TIMESTAMP(3),
    "reminderCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignatureRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureArtifact" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "reservationId" TEXT,
    "guestId" TEXT,
    "pdfUrl" TEXT NOT NULL,
    "storageKey" TEXT,
    "checksum" TEXT,
    "metadata" JSONB,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignatureArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoiUpload" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "reservationId" TEXT,
    "guestId" TEXT,
    "fileUrl" TEXT NOT NULL,
    "storageKey" TEXT,
    "status" "CoiStatus" NOT NULL DEFAULT 'active',
    "expiresAt" TIMESTAMP(3),
    "reminderAt" TIMESTAMP(3),
    "reminderCount" INTEGER NOT NULL DEFAULT 0,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "CoiUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTemplate_campgroundId_name_version_key" ON "DocumentTemplate"("campgroundId", "name", "version");

-- CreateIndex
CREATE INDEX "DocumentTemplate_campgroundId_type_idx" ON "DocumentTemplate"("campgroundId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "SignatureRequest_token_key" ON "SignatureRequest"("token");

-- CreateIndex
CREATE INDEX "SignatureRequest_campgroundId_status_idx" ON "SignatureRequest"("campgroundId", "status");

-- CreateIndex
CREATE INDEX "SignatureRequest_reservationId_idx" ON "SignatureRequest"("reservationId");

-- CreateIndex
CREATE INDEX "SignatureRequest_guestId_idx" ON "SignatureRequest"("guestId");

-- CreateIndex
CREATE INDEX "SignatureRequest_expiresAt_idx" ON "SignatureRequest"("expiresAt");

-- CreateIndex
CREATE INDEX "SignatureArtifact_campgroundId_idx" ON "SignatureArtifact"("campgroundId");

-- CreateIndex
CREATE INDEX "SignatureArtifact_reservationId_idx" ON "SignatureArtifact"("reservationId");

-- CreateIndex
CREATE INDEX "SignatureArtifact_guestId_idx" ON "SignatureArtifact"("guestId");

-- CreateIndex
CREATE INDEX "CoiUpload_campgroundId_idx" ON "CoiUpload"("campgroundId");

-- CreateIndex
CREATE INDEX "CoiUpload_reservationId_idx" ON "CoiUpload"("reservationId");

-- CreateIndex
CREATE INDEX "CoiUpload_guestId_idx" ON "CoiUpload"("guestId");

-- CreateIndex
CREATE INDEX "CoiUpload_expiresAt_idx" ON "CoiUpload"("expiresAt");

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureArtifact" ADD CONSTRAINT "SignatureArtifact_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SignatureRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureArtifact" ADD CONSTRAINT "SignatureArtifact_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureArtifact" ADD CONSTRAINT "SignatureArtifact_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureArtifact" ADD CONSTRAINT "SignatureArtifact_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoiUpload" ADD CONSTRAINT "CoiUpload_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoiUpload" ADD CONSTRAINT "CoiUpload_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoiUpload" ADD CONSTRAINT "CoiUpload_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
