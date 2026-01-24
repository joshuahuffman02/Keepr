import type { Request } from "express";
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Headers,
} from "@nestjs/common";
import { ValueStackService } from "./value-stack.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ScopeGuard } from "../auth/guards/scope.guard";
import { GuaranteeType } from "@prisma/client";
import { extractClientIp } from "../common/ip-utils";

@Controller("campgrounds/:campgroundId/value-stack")
@UseGuards(JwtAuthGuard, ScopeGuard)
export class ValueStackController {
  constructor(private readonly valueStackService: ValueStackService) {}

  // ==================== GUARANTEES ====================

  @Get("guarantees")
  async getGuarantees(@Param("campgroundId") campgroundId: string) {
    return this.valueStackService.getGuarantees(campgroundId);
  }

  @Post("guarantees")
  async createGuarantee(
    @Param("campgroundId") campgroundId: string,
    @Body()
    body: {
      type: GuaranteeType;
      title: string;
      description: string;
      iconName?: string;
      sortOrder?: number;
    },
  ) {
    return this.valueStackService.createGuarantee({ campgroundId, ...body });
  }

  @Put("guarantees/:id")
  async updateGuarantee(
    @Param("campgroundId") campgroundId: string,
    @Param("id") id: string,
    @Body()
    body: Partial<{
      type: GuaranteeType;
      title: string;
      description: string;
      iconName: string;
      sortOrder: number;
      isActive: boolean;
    }>,
  ) {
    return this.valueStackService.updateGuarantee(id, campgroundId, body);
  }

  @Delete("guarantees/:id")
  async deleteGuarantee(@Param("campgroundId") campgroundId: string, @Param("id") id: string) {
    return this.valueStackService.deleteGuarantee(id, campgroundId);
  }

  // ==================== BONUSES ====================

  @Get("bonuses")
  async getBonuses(@Param("campgroundId") campgroundId: string) {
    return this.valueStackService.getBonuses(campgroundId);
  }

  @Post("bonuses")
  async createBonus(
    @Param("campgroundId") campgroundId: string,
    @Body()
    body: {
      name: string;
      description?: string;
      valueCents: number;
      iconName?: string;
      siteClassIds?: string[];
      isAutoIncluded?: boolean;
      sortOrder?: number;
    },
  ) {
    return this.valueStackService.createBonus({ campgroundId, ...body });
  }

  @Put("bonuses/:id")
  async updateBonus(
    @Param("campgroundId") campgroundId: string,
    @Param("id") id: string,
    @Body()
    body: Partial<{
      name: string;
      description: string;
      valueCents: number;
      iconName: string;
      siteClassIds: string[];
      isAutoIncluded: boolean;
      sortOrder: number;
      isActive: boolean;
    }>,
  ) {
    return this.valueStackService.updateBonus(id, campgroundId, body);
  }

  @Delete("bonuses/:id")
  async deleteBonus(@Param("campgroundId") campgroundId: string, @Param("id") id: string) {
    return this.valueStackService.deleteBonus(id, campgroundId);
  }

  // ==================== LEAD CAPTURE CONFIG ====================

  @Get("lead-capture")
  async getLeadCaptureConfig(@Param("campgroundId") campgroundId: string) {
    return this.valueStackService.getLeadCaptureConfig(campgroundId);
  }

  @Put("lead-capture")
  async updateLeadCaptureConfig(
    @Param("campgroundId") campgroundId: string,
    @Body()
    body: Partial<{
      eventsEnabled: boolean;
      eventsHeadline: string;
      eventsSubtext: string;
      eventsButtonText: string;
      newsletterEnabled: boolean;
      newsletterHeadline: string;
      newsletterSubtext: string;
      newsletterButtonText: string;
      firstBookingEnabled: boolean;
      firstBookingDiscount: number;
      firstBookingHeadline: string;
    }>,
  ) {
    return this.valueStackService.upsertLeadCaptureConfig(campgroundId, body);
  }

  // ==================== BOOKING PAGE CONFIG ====================

  @Get("booking-page")
  async getBookingPageConfig(@Param("campgroundId") campgroundId: string) {
    return this.valueStackService.getBookingPageConfig(campgroundId);
  }

  @Put("booking-page")
  async updateBookingPageConfig(
    @Param("campgroundId") campgroundId: string,
    @Body()
    body: Partial<{
      heroHeadline: string;
      heroSubline: string;
      dreamOutcome: string;
      showReviewCount: boolean;
      showTrustBadges: boolean;
      showScarcity: boolean;
      showLiveViewers: boolean;
      showLimitedAvail: boolean;
      bookButtonText: string;
      checkAvailText: string;
    }>,
  ) {
    return this.valueStackService.upsertBookingPageConfig(campgroundId, body);
  }

  // ==================== LEADS ====================

  @Get("leads")
  async getLeads(@Param("campgroundId") campgroundId: string, @Query("source") source?: string) {
    return this.valueStackService.getLeads(campgroundId, source);
  }
}

// Public controller for lead capture (no auth required)
@Controller("public/campgrounds/:campgroundId")
export class PublicValueStackController {
  constructor(private readonly valueStackService: ValueStackService) {}

  @Get("value-stack")
  async getPublicValueStack(@Param("campgroundId") campgroundId: string) {
    return this.valueStackService.getPublicValueStack(campgroundId);
  }

  @Post("leads")
  async captureLead(
    @Param("campgroundId") campgroundId: string,
    @Body() body: { email: string; source: string; marketingOptIn?: boolean },
    @Headers("x-forwarded-for") forwardedFor?: string,
    @Headers("user-agent") userAgent?: string,
    @Req() req?: Request,
  ) {
    // Extract and validate client IP to prevent spoofing via x-forwarded-for
    const ipAddress = extractClientIp({
      forwardedFor,
      directIp: req?.ip,
      remoteAddress: req?.connection?.remoteAddress,
    });
    return this.valueStackService.captureLead({
      campgroundId,
      email: body.email,
      source: body.source,
      marketingOptIn: body.marketingOptIn,
      ipAddress: ipAddress ?? undefined,
      userAgent,
    });
  }
}
