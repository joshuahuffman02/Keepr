import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Headers
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards";
import { OrgReferralsService } from "./org-referrals.service";
import type { Request } from "express";
import { extractClientIpFromRequest } from "../common/ip-utils";

interface TrackClickDto {
  referralCode: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

interface TrackSignupDto {
  referralCode: string;
  email: string;
  organizationId?: string;
}

@Controller()
export class OrgReferralsController {
  constructor(private readonly referrals: OrgReferralsService) {}

  // ==================== AUTHENTICATED ENDPOINTS ====================

  /**
   * Get referral stats for an organization
   */
  @UseGuards(JwtAuthGuard)
  @Get("organizations/:organizationId/referrals")
  async getReferralStats(@Param("organizationId") organizationId: string) {
    const stats = await this.referrals.getReferralStats(organizationId);
    const history = await this.referrals.getReferralHistory(organizationId);

    return {
      ...stats,
      referrals: history
    };
  }

  /**
   * Get or create referral code for an organization
   */
  @UseGuards(JwtAuthGuard)
  @Post("organizations/:organizationId/referrals/code")
  async getOrCreateCode(@Param("organizationId") organizationId: string) {
    const code = await this.referrals.getOrCreateReferralCode(organizationId);
    return { referralCode: code };
  }

  // ==================== PUBLIC ENDPOINTS ====================

  /**
   * Track a referral link click (public, called when user lands on signup with ref param)
   */
  @Post("public/referrals/track-click")
  async trackClick(
    @Body() body: TrackClickDto,
    @Headers("user-agent") userAgent: string,
    @Req() req: Request
  ) {
    // Extract and validate client IP to prevent spoofing via x-forwarded-for
    const ipAddress = extractClientIpFromRequestreq || req.ip;

    return this.referrals.trackClick(body.referralCode, {
      utmSource: body.utmSource,
      utmMedium: body.utmMedium,
      utmCampaign: body.utmCampaign,
      ipAddress,
      userAgent
    });
  }

  /**
   * Track signup from referral (called after user creates account)
   */
  @Post("public/referrals/track-signup")
  async trackSignup(@Body() body: TrackSignupDto) {
    return this.referrals.trackSignup(
      body.referralCode,
      body.email,
      body.organizationId
    );
  }

  /**
   * Validate a referral code (public, for showing referral UI on signup)
   */
  @Get("public/referrals/validate/:code")
  async validateCode(@Param("code") code: string) {
    try {
      await this.referrals.trackClick(code, {});
      return { valid: true, code };
    } catch {
      return { valid: false, code };
    }
  }
}
