import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from "@nestjs/common";
import { JwtAuthGuard, RolesGuard, Roles } from "../auth/guards";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { UserRole, PlatformRole, ClaimVerificationMethod } from "@prisma/client";
import { ClaimsService, SubmitClaimDto, VerifyClaimDto } from "./claims.service";
import { IsString, IsEmail, IsPhoneNumber, IsEnum, IsOptional, MinLength } from "class-validator";

/**
 * Claims Controller
 *
 * Endpoints for campground claiming:
 * - User endpoints: submit claim, verify, view my claims
 * - Admin endpoints: list pending, approve, reject
 */

// DTOs with validation
class SubmitClaimRequestDto implements SubmitClaimDto {
  @IsString()
  campgroundId!: string;

  @IsEnum(ClaimVerificationMethod)
  verificationMethod!: ClaimVerificationMethod;

  @IsString()
  @MinLength(2)
  businessName!: string;

  @IsString()
  @MinLength(2)
  contactName!: string;

  @IsEmail()
  contactEmail!: string;

  @IsString()
  contactPhone!: string;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class VerifyClaimRequestDto {
  @IsString()
  claimId!: string;

  @IsString()
  @MinLength(6)
  verificationCode!: string;
}

class ApproveClaimRequestDto {
  @IsString()
  organizationId!: string;
}

class RejectClaimRequestDto {
  @IsString()
  @MinLength(10)
  reason!: string;
}

// User payload type
interface UserPayload {
  sub: string;
  email: string;
  role?: string;
  platformRole?: string;
}

@Controller("claims")
@UseGuards(JwtAuthGuard)
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  // =========================================================================
  // USER ENDPOINTS
  // =========================================================================

  /**
   * Submit a new claim for a campground
   */
  @Post()
  async submitClaim(@CurrentUser() user: UserPayload, @Body() dto: SubmitClaimRequestDto) {
    return this.claimsService.submitClaim(user.sub, dto);
  }

  /**
   * Verify a claim with the verification code
   */
  @Post("verify")
  async verifyClaim(@CurrentUser() user: UserPayload, @Body() dto: VerifyClaimRequestDto) {
    return this.claimsService.verifyClaim(user.sub, {
      claimId: dto.claimId,
      verificationCode: dto.verificationCode,
    });
  }

  /**
   * Resend verification code for a claim
   */
  @Post(":id/resend-code")
  async resendCode(@CurrentUser() user: UserPayload, @Param("id") claimId: string) {
    await this.claimsService.resendVerificationCode(user.sub, claimId);
    return { success: true, message: "Verification code resent" };
  }

  /**
   * Get a specific claim by ID
   */
  @Get(":id")
  async getClaim(@CurrentUser() user: UserPayload, @Param("id") claimId: string) {
    const claim = await this.claimsService.getClaimById(claimId);
    if (!claim) {
      throw new NotFoundException("Claim not found");
    }
    return claim;
  }

  /**
   * List claims for the current user
   */
  @Get("user/my-claims")
  async listMyClaims(@CurrentUser() user: UserPayload) {
    return this.claimsService.listUserClaims(user.sub);
  }
}

// Separate admin controller for claim management
@Controller("admin/claims")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PlatformRole.platform_admin)
export class AdminClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  /**
   * List all claims (with optional status filter)
   */
  @Get()
  async listClaims(
    @Query("status") status?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.claimsService.listPendingClaims({
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  /**
   * Get claim statistics
   */
  @Get("stats")
  async getStats() {
    return this.claimsService.getClaimStats();
  }

  /**
   * Approve a claim and transfer campground ownership
   */
  @Post(":id/approve")
  async approveClaim(
    @CurrentUser() user: { sub: string },
    @Param("id") claimId: string,
    @Body() dto: ApproveClaimRequestDto,
  ) {
    return this.claimsService.approveClaim(user.sub, claimId, dto.organizationId);
  }

  /**
   * Reject a claim
   */
  @Post(":id/reject")
  async rejectClaim(
    @CurrentUser() user: { sub: string },
    @Param("id") claimId: string,
    @Body() dto: RejectClaimRequestDto,
  ) {
    return this.claimsService.rejectClaim(user.sub, claimId, dto.reason);
  }

  /**
   * Get a specific claim with full details
   */
  @Get(":id")
  async getClaim(@Param("id") claimId: string) {
    const claim = await this.claimsService.getClaimById(claimId);
    if (!claim) {
      throw new NotFoundException("Claim not found");
    }
    return claim;
  }
}
