import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards
} from "@nestjs/common";
import { EarlyAccessService } from "./early-access.service";
import { EnrollEarlyAccessDto, EarlyAccessTierType, EarlyAccessSignupDto } from "./dto/enroll-early-access.dto";
import { JwtAuthGuard } from "../auth/guards";

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
      this.earlyAccess.getEnrolledCount()
    ]);

    return {
      isActive,
      enrolledCount,
      totalSpots: 45 // 5 + 15 + 25
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
}
