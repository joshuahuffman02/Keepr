import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { EarlyAccessService } from "./early-access.service";
import {
  EnrollEarlyAccessDto,
  EarlyAccessTierType,
  EarlyAccessSignupDto,
} from "./dto/enroll-early-access.dto";
import { JwtAuthGuard, Roles, RolesGuard } from "../auth/guards";
import { UserRole } from "@prisma/client";

@Controller("early-access")
export class EarlyAccessController {
  constructor(private readonly earlyAccess: EarlyAccessService) {}

  /**
   * Public endpoint - get availability for all tiers
   * No auth required - used on public pricing page
   */
  @Get("availability")
  getAvailability() {
    return this.earlyAccess.getAvailability();
  }

  /**
   * Public endpoint - get availability for specific tier
   */
  @Get("availability/:tier")
  getTierAvailability(@Param("tier") tier: EarlyAccessTierType) {
    return this.earlyAccess.getTierAvailability(tier);
  }

  /**
   * Public endpoint - check if program is still active
   */
  @Get("status")
  async getStatus() {
    const [isActive, enrolledCount] = await Promise.all([
      this.earlyAccess.isProgramActive(),
      this.earlyAccess.getEnrolledCount(),
    ]);

    return {
      isActive,
      enrolledCount,
      totalSpots: 45, // 5 + 15 + 25
    };
  }

  /**
   * Protected endpoint - enroll organization in early access
   * Called during signup flow after org is created
   */
  @UseGuards(JwtAuthGuard)
  @Post("enroll")
  enroll(@Body() dto: EnrollEarlyAccessDto) {
    return this.earlyAccess.enrollOrganization(dto.organizationId, dto.tier);
  }

  /**
   * Protected endpoint - get enrollment for an organization
   */
  @UseGuards(JwtAuthGuard)
  @Get("enrollment/:organizationId")
  getEnrollment(@Param("organizationId") organizationId: string) {
    return this.earlyAccess.getEnrollment(organizationId);
  }

  /**
   * Protected endpoint - self-service signup
   * Creates org, reserves spot, creates onboarding session, sends welcome email
   */
  @UseGuards(JwtAuthGuard)
  @Post("signup")
  signup(@Body() dto: EarlyAccessSignupDto) {
    return this.earlyAccess.signup(dto);
  }

  /**
   * Protected endpoint - resend onboarding email for current user
   */
  @UseGuards(JwtAuthGuard)
  @Post("resend-email/:userId")
  resendEmail(@Param("userId") userId: string) {
    return this.earlyAccess.resendOnboardingEmail(userId);
  }

  /**
   * Public endpoint - resend onboarding email by email address
   * For users who started signup but lost their email
   */
  @Post("resend-by-email")
  resendByEmail(@Body() body: { email: string }) {
    return this.earlyAccess.resendOnboardingByEmail(body.email);
  }

  /**
   * Admin endpoint - get early access stats
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("platform_admin")
  @Get("admin/stats")
  getStats() {
    return this.earlyAccess.getEarlyAccessStats();
  }

  /**
   * Admin endpoint - get all pending onboardings
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("platform_admin")
  @Get("admin/pending")
  getPendingOnboardings() {
    return this.earlyAccess.getPendingOnboardings();
  }

  /**
   * Admin endpoint - resend email for a specific session
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("platform_admin")
  @Post("admin/resend/:sessionId")
  adminResendEmail(@Param("sessionId") sessionId: string) {
    return this.earlyAccess.adminResendEmail(sessionId);
  }
}
