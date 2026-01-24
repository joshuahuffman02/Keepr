import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CampgroundClaimStatus, ClaimVerificationMethod, Prisma } from "@prisma/client";
import { randomBytes, randomUUID } from "crypto";

/**
 * Claims Service
 *
 * Manages the campground claiming process where operators can claim
 * ownership of seeded (unclaimed) campground listings.
 *
 * Claim Flow:
 * 1. User finds unclaimed campground
 * 2. User submits claim with verification method preference
 * 3. System sends verification code (phone/email) or requests document
 * 4. User verifies ownership
 * 5. Admin reviews and approves/rejects claim
 * 6. Campground transferred to user's organization
 */

export interface SubmitClaimDto {
  campgroundId: string;
  verificationMethod: ClaimVerificationMethod;
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  organizationId?: string;
  notes?: string;
}

export interface VerifyClaimDto {
  claimId: string;
  verificationCode: string;
}

export interface ClaimDetails {
  id: string;
  campgroundId: string;
  campgroundName: string;
  status: string;
  verificationMethod: ClaimVerificationMethod | null;
  businessName: string | null;
  contactName: string;
  contactEmail: string;
  submittedAt: Date;
  verifiedAt: Date | null;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
}

@Injectable()
export class ClaimsService {
  private readonly logger = new Logger(ClaimsService.name);
  private readonly CODE_EXPIRY_MINUTES = 30;
  private readonly MAX_VERIFICATION_ATTEMPTS = 5;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Submit a claim for a campground
   */
  async submitClaim(userId: string, dto: SubmitClaimDto): Promise<ClaimDetails> {
    // Validate campground exists and is unclaimed
    const campground = await this.prisma.campground.findUnique({
      where: { id: dto.campgroundId },
      select: {
        id: true,
        name: true,
        claimStatus: true,
        seededDataSource: true,
      },
    });

    if (!campground) {
      throw new NotFoundException("Campground not found");
    }

    if (!campground.seededDataSource) {
      throw new BadRequestException(
        "This campground was not seeded from external data and cannot be claimed",
      );
    }

    if (campground.claimStatus === CampgroundClaimStatus.claimed) {
      throw new ConflictException("This campground has already been claimed");
    }

    if (campground.claimStatus === CampgroundClaimStatus.claim_pending) {
      throw new ConflictException("A claim is already pending for this campground");
    }

    // Check for existing pending claims by this user
    const existingClaim = await this.prisma.campgroundClaim.findFirst({
      where: {
        userId,
        campgroundId: dto.campgroundId,
        status: "pending",
      },
    });

    if (existingClaim) {
      throw new ConflictException("You already have a pending claim for this campground");
    }

    // Generate verification code
    const verificationCode = this.generateVerificationCode();
    const verificationExpiry = new Date();
    verificationExpiry.setMinutes(verificationExpiry.getMinutes() + this.CODE_EXPIRY_MINUTES);

    // Create claim and update campground status in transaction
    const claim = await this.prisma.$transaction(async (tx) => {
      // Create the claim
      const newClaim = await tx.campgroundClaim.create({
        data: {
          id: randomUUID(),
          campgroundId: dto.campgroundId,
          userId,
          status: "pending",
          verificationMethod: dto.verificationMethod,
          verificationCode,
          verificationExpiry: verificationExpiry,
          businessName: dto.businessName,
          claimantName: dto.contactName,
          claimantEmail: dto.contactEmail.trim().toLowerCase(),
          claimantPhone: dto.contactPhone,
          notes: dto.notes ?? null,
          updatedAt: new Date(),
        },
      });

      // Update campground status
      await tx.campground.update({
        where: { id: dto.campgroundId },
        data: {
          claimStatus: CampgroundClaimStatus.claim_pending,
          verificationMethod: dto.verificationMethod,
          verificationCode,
          verificationCodeExpiry: verificationExpiry,
          verificationAttempts: 0,
        },
      });

      return newClaim;
    });

    // Send verification code based on method
    await this.sendVerificationCode(claim, dto.verificationMethod);

    this.logger.log(`Claim submitted for campground ${dto.campgroundId} by user ${userId}`);

    return {
      id: claim.id,
      campgroundId: claim.campgroundId,
      campgroundName: campground.name,
      status: claim.status,
      verificationMethod: claim.verificationMethod ?? null,
      businessName: claim.businessName ?? null,
      contactName: claim.claimantName,
      contactEmail: claim.claimantEmail,
      submittedAt: claim.createdAt,
      verifiedAt: claim.verifiedAt,
      reviewedAt: claim.reviewedAt,
      reviewedBy: claim.reviewedByUserId,
      rejectionReason: claim.rejectionReason,
    };
  }

  /**
   * Verify a claim with the verification code
   */
  async verifyClaim(userId: string, dto: VerifyClaimDto): Promise<ClaimDetails> {
    const claim = await this.prisma.campgroundClaim.findUnique({
      where: { id: dto.claimId },
      include: {
        Campground: {
          select: { name: true },
        },
      },
    });

    if (!claim) {
      throw new NotFoundException("Claim not found");
    }

    if (claim.userId !== userId) {
      throw new BadRequestException("You are not the owner of this claim");
    }

    if (claim.status !== "pending") {
      throw new BadRequestException(`Claim is already ${claim.status}, cannot verify`);
    }

    // Check verification attempts
    if (claim.verificationAttempts >= this.MAX_VERIFICATION_ATTEMPTS) {
      throw new BadRequestException(
        "Maximum verification attempts exceeded. Please submit a new claim.",
      );
    }

    // Check code expiry
    if (claim.verificationExpiry && new Date() > claim.verificationExpiry) {
      throw new BadRequestException("Verification code has expired. Please request a new code.");
    }

    // Check code match
    if (claim.verificationCode !== dto.verificationCode) {
      // Increment attempts
      await this.prisma.campgroundClaim.update({
        where: { id: claim.id },
        data: {
          verificationAttempts: { increment: 1 },
        },
      });

      throw new BadRequestException("Invalid verification code");
    }

    // Mark claim as verified
    const updatedClaim = await this.prisma.campgroundClaim.update({
      where: { id: dto.claimId },
      data: {
        status: "verified",
        verifiedAt: new Date(),
      },
      include: {
        Campground: {
          select: { name: true },
        },
      },
    });

    this.logger.log(`Claim ${dto.claimId} verified for campground ${claim.campgroundId}`);

    return {
      id: updatedClaim.id,
      campgroundId: updatedClaim.campgroundId,
      campgroundName: updatedClaim.Campground.name,
      status: updatedClaim.status,
      verificationMethod: updatedClaim.verificationMethod ?? null,
      businessName: updatedClaim.businessName ?? null,
      contactName: updatedClaim.claimantName,
      contactEmail: updatedClaim.claimantEmail,
      submittedAt: updatedClaim.createdAt,
      verifiedAt: updatedClaim.verifiedAt,
      reviewedAt: updatedClaim.reviewedAt,
      reviewedBy: updatedClaim.reviewedByUserId,
      rejectionReason: updatedClaim.rejectionReason,
    };
  }

  /**
   * Resend verification code
   */
  async resendVerificationCode(userId: string, claimId: string): Promise<void> {
    const claim = await this.prisma.campgroundClaim.findUnique({
      where: { id: claimId },
    });

    if (!claim) {
      throw new NotFoundException("Claim not found");
    }

    if (claim.userId !== userId) {
      throw new BadRequestException("You are not the owner of this claim");
    }

    if (claim.status !== "pending") {
      throw new BadRequestException("Claim is not pending verification");
    }

    // Generate new verification code
    const newCode = this.generateVerificationCode();
    const newExpiry = new Date();
    newExpiry.setMinutes(newExpiry.getMinutes() + this.CODE_EXPIRY_MINUTES);

    // Update claim and campground
    await this.prisma.$transaction([
      this.prisma.campgroundClaim.update({
        where: { id: claimId },
        data: {
          verificationCode: newCode,
          verificationExpiry: newExpiry,
        },
      }),
      this.prisma.campground.update({
        where: { id: claim.campgroundId },
        data: {
          verificationCode: newCode,
          verificationCodeExpiry: newExpiry,
          verificationAttempts: 0,
        },
      }),
    ]);

    // Send the new code
    if (!claim.verificationMethod) {
      throw new BadRequestException("Claim verification method is missing");
    }
    await this.sendVerificationCode(claim, claim.verificationMethod);

    this.logger.log(`Verification code resent for claim ${claimId}`);
  }

  /**
   * Admin: Approve a verified claim
   */
  async approveClaim(
    adminUserId: string,
    claimId: string,
    organizationId: string,
  ): Promise<ClaimDetails> {
    const claim = await this.prisma.campgroundClaim.findUnique({
      where: { id: claimId },
      include: {
        Campground: { select: { name: true } },
      },
    });

    if (!claim) {
      throw new NotFoundException("Claim not found");
    }

    if (claim.status !== "verified" && claim.status !== "pending") {
      throw new BadRequestException(`Claim status is ${claim.status}, cannot approve`);
    }

    // Transfer campground to the claimant's organization
    const updatedClaim = await this.prisma.$transaction(async (tx) => {
      // Update claim status
      const updated = await tx.campgroundClaim.update({
        where: { id: claimId },
        data: {
          status: "approved",
          reviewedAt: new Date(),
          reviewedByUserId: adminUserId,
        },
        include: {
          Campground: { select: { name: true } },
        },
      });

      // Update campground ownership
      await tx.campground.update({
        where: { id: claim.campgroundId },
        data: {
          claimStatus: CampgroundClaimStatus.claimed,
          claimedAt: new Date(),
          claimedByUserId: claim.userId,
          organizationId,
          verificationCode: null,
          verificationCodeExpiry: null,
          verificationAttempts: 0,
        },
      });

      return updated;
    });

    this.logger.log(
      `Claim ${claimId} approved by admin ${adminUserId}, campground transferred to org ${organizationId}`,
    );

    return {
      id: updatedClaim.id,
      campgroundId: updatedClaim.campgroundId,
      campgroundName: updatedClaim.Campground.name,
      status: updatedClaim.status,
      verificationMethod: updatedClaim.verificationMethod ?? null,
      businessName: updatedClaim.businessName ?? null,
      contactName: updatedClaim.claimantName,
      contactEmail: updatedClaim.claimantEmail,
      submittedAt: updatedClaim.createdAt,
      verifiedAt: updatedClaim.verifiedAt,
      reviewedAt: updatedClaim.reviewedAt,
      reviewedBy: updatedClaim.reviewedByUserId,
      rejectionReason: updatedClaim.rejectionReason,
    };
  }

  /**
   * Admin: Reject a claim
   */
  async rejectClaim(adminUserId: string, claimId: string, reason: string): Promise<ClaimDetails> {
    const claim = await this.prisma.campgroundClaim.findUnique({
      where: { id: claimId },
      include: {
        Campground: { select: { name: true } },
      },
    });

    if (!claim) {
      throw new NotFoundException("Claim not found");
    }

    if (claim.status === "approved" || claim.status === "rejected") {
      throw new BadRequestException(`Claim has already been ${claim.status}`);
    }

    const updatedClaim = await this.prisma.$transaction(async (tx) => {
      // Update claim status
      const updated = await tx.campgroundClaim.update({
        where: { id: claimId },
        data: {
          status: "rejected",
          reviewedAt: new Date(),
          reviewedByUserId: adminUserId,
          rejectionReason: reason,
        },
        include: {
          Campground: { select: { name: true } },
        },
      });

      // Reset campground to unclaimed
      await tx.campground.update({
        where: { id: claim.campgroundId },
        data: {
          claimStatus: CampgroundClaimStatus.unclaimed,
          verificationCode: null,
          verificationCodeExpiry: null,
          verificationAttempts: 0,
          verificationMethod: null,
        },
      });

      return updated;
    });

    this.logger.log(`Claim ${claimId} rejected by admin ${adminUserId}: ${reason}`);

    return {
      id: updatedClaim.id,
      campgroundId: updatedClaim.campgroundId,
      campgroundName: updatedClaim.Campground.name,
      status: updatedClaim.status,
      verificationMethod: updatedClaim.verificationMethod ?? null,
      businessName: updatedClaim.businessName ?? null,
      contactName: updatedClaim.claimantName,
      contactEmail: updatedClaim.claimantEmail,
      submittedAt: updatedClaim.createdAt,
      verifiedAt: updatedClaim.verifiedAt,
      reviewedAt: updatedClaim.reviewedAt,
      reviewedBy: updatedClaim.reviewedByUserId,
      rejectionReason: updatedClaim.rejectionReason,
    };
  }

  /**
   * Get claim by ID
   */
  async getClaimById(claimId: string): Promise<ClaimDetails | null> {
    const claim = await this.prisma.campgroundClaim.findUnique({
      where: { id: claimId },
      include: {
        Campground: { select: { name: true } },
      },
    });

    if (!claim) {
      return null;
    }

    return {
      id: claim.id,
      campgroundId: claim.campgroundId,
      campgroundName: claim.Campground.name,
      status: claim.status,
      verificationMethod: claim.verificationMethod ?? null,
      businessName: claim.businessName ?? null,
      contactName: claim.claimantName,
      contactEmail: claim.claimantEmail,
      submittedAt: claim.createdAt,
      verifiedAt: claim.verifiedAt,
      reviewedAt: claim.reviewedAt,
      reviewedBy: claim.reviewedByUserId,
      rejectionReason: claim.rejectionReason,
    };
  }

  /**
   * List claims for a user
   */
  async listUserClaims(userId: string) {
    const claims = await this.prisma.campgroundClaim.findMany({
      where: { userId },
      include: {
        Campground: {
          select: {
            id: true,
            name: true,
            slug: true,
            city: true,
            state: true,
            heroImageUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return claims.map(({ Campground, ...claim }) => ({
      ...claim,
      campground: Campground,
    }));
  }

  /**
   * Admin: List all pending claims
   */
  async listPendingClaims(options: { status?: string; limit?: number; offset?: number } = {}) {
    const { status = "pending", limit = 50, offset = 0 } = options;

    const where: Prisma.CampgroundClaimWhereInput = {};
    if (status) {
      where.status = status;
    }

    const [claimsRaw, total] = await Promise.all([
      this.prisma.campgroundClaim.findMany({
        where,
        include: {
          Campground: {
            select: {
              id: true,
              name: true,
              slug: true,
              city: true,
              state: true,
              seededDataSource: true,
            },
          },
          User: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
        take: limit,
        skip: offset,
      }),
      this.prisma.campgroundClaim.count({ where }),
    ]);

    const claims = claimsRaw.map(({ Campground, User, ...claim }) => ({
      ...claim,
      campground: Campground,
      claimant: User,
    }));

    return { claims, total };
  }

  /**
   * Get claim statistics
   */
  async getClaimStats(): Promise<{
    pending: number;
    verified: number;
    approved: number;
    rejected: number;
    total: number;
  }> {
    const [pending, verified, approved, rejected, total] = await Promise.all([
      this.prisma.campgroundClaim.count({ where: { status: "pending" } }),
      this.prisma.campgroundClaim.count({ where: { status: "verified" } }),
      this.prisma.campgroundClaim.count({ where: { status: "approved" } }),
      this.prisma.campgroundClaim.count({ where: { status: "rejected" } }),
      this.prisma.campgroundClaim.count(),
    ]);

    return { pending, verified, approved, rejected, total };
  }

  /**
   * Generate a 6-digit verification code
   */
  private generateVerificationCode(): string {
    const buffer = randomBytes(3);
    const code = parseInt(buffer.toString("hex"), 16) % 1000000;
    return code.toString().padStart(6, "0");
  }

  /**
   * Send verification code via the appropriate method
   */
  private async sendVerificationCode(
    claim: { claimantEmail: string; claimantPhone: string | null; verificationCode: string | null },
    method: ClaimVerificationMethod,
  ): Promise<void> {
    const code = claim.verificationCode;
    if (!code) return;

    // TODO: Integrate with actual email/SMS services
    switch (method) {
      case ClaimVerificationMethod.email:
        this.logger.log(`[TODO] Send email verification code ${code} to ${claim.claimantEmail}`);
        // await this.emailService.sendClaimVerification(claim.contactEmail, code);
        break;

      case ClaimVerificationMethod.phone:
        this.logger.log(
          `[TODO] Send SMS verification code ${code} to ${claim.claimantPhone ?? ""}`,
        );
        // await this.smsService.sendClaimVerification(claim.contactPhone, code);
        break;

      case ClaimVerificationMethod.document:
        this.logger.log(`[TODO] Document verification requested for claim - no code sent`);
        // Document verification doesn't use a code
        break;

      case ClaimVerificationMethod.domain:
        this.logger.log(`[TODO] Domain verification - instruct user to add TXT record`);
        break;

      case ClaimVerificationMethod.manual:
        this.logger.log(`[TODO] Manual verification - admin will review`);
        break;
    }
  }
}
