import { Body, Controller, Get, Post, Query, Req, UseGuards, UnauthorizedException, BadRequestException } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { IngestAnalyticsEventDto } from "./dto/ingest-analytics-event.dto";
import { ApplyRecommendationDto } from "./dto/apply-recommendation.dto";
import { ProposeRecommendationDto } from "./dto/propose-recommendation.dto";
import { JwtAuthGuard, Roles, RolesGuard } from "../auth/guards";
import { UserRole } from "@prisma/client";
import { Request } from "express";

@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post("events")
  async ingestEvent(@Body() dto: IngestAnalyticsEventDto, @Req() req: Request) {
    const scope = {
      campgroundId: req?.campgroundId || null,
      organizationId: req?.organizationId || null,
      userId: req?.user?.id || null,
    };
    return this.analyticsService.ingest(dto, scope);
  }

  @UseGuards(JwtAuthGuard)
  @Get("recommendations")
  async listRecommendations(@Query("campgroundId") campgroundId: string, @Req() req: Request) {
    const cgId = campgroundId || req?.campgroundId || (req.headers as any)["x-campground-id"];
    return this.analyticsService.getRecommendations(cgId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @Post("recommendations/apply")
  async applyRecommendation(@Body() dto: ApplyRecommendationDto, @Req() req: Request & { user?: any; campgroundId?: string }) {
    const user = req.user;
    if (!user) throw new UnauthorizedException("Unauthorized");
    const campId = dto.campgroundId || req?.campgroundId || (req.headers as any)["x-campground-id"];
    if (!campId) throw new BadRequestException("campgroundId required");
    return this.analyticsService.applyRecommendation(dto, req?.user, {
      campgroundId: campId,
      organizationId: req?.organizationId || null,
      userId: req?.user?.id || null,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.marketing, UserRole.front_desk)
  @Post("recommendations/propose")
  async proposeRecommendation(@Body() dto: ProposeRecommendationDto, @Req() req: Request) {
    return this.analyticsService.proposeRecommendation(dto, req?.user, {
      campgroundId: req?.campgroundId || null,
      organizationId: req?.organizationId || null,
      userId: req?.user?.id || null,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get("reports/funnel")
  async getFunnel(@Query("campgroundId") campgroundId: string, @Query("days") days: string, @Req() req: Request) {
    const cgId = campgroundId || req?.campgroundId || (req.headers as any)["x-campground-id"];
    return this.analyticsService.getFunnel(cgId, days ? parseInt(days, 10) : 30);
  }

  @UseGuards(JwtAuthGuard)
  @Get("reports/images")
  async getImagePerformance(@Query("campgroundId") campgroundId: string, @Query("days") days: string, @Req() req: Request) {
    const cgId = campgroundId || req?.campgroundId || (req.headers as any)["x-campground-id"];
    return this.analyticsService.getImagePerformance(cgId, days ? parseInt(days, 10) : 30);
  }

  @UseGuards(JwtAuthGuard)
  @Get("reports/deals")
  async getDealPerformance(@Query("campgroundId") campgroundId: string, @Query("days") days: string, @Req() req: Request) {
    const cgId = campgroundId || req?.campgroundId || (req.headers as any)["x-campground-id"];
    return this.analyticsService.getDealPerformance(cgId, days ? parseInt(days, 10) : 30);
  }

  @UseGuards(JwtAuthGuard)
  @Get("reports/attribution")
  async getAttribution(@Query("campgroundId") campgroundId: string, @Query("days") days: string, @Req() req: Request) {
    const cgId = campgroundId || req?.campgroundId || (req.headers as any)["x-campground-id"];
    return this.analyticsService.getAttribution(cgId, days ? parseInt(days, 10) : 30);
  }

  @UseGuards(JwtAuthGuard)
  @Get("reports/pricing")
  async getPricingSignals(@Query("campgroundId") campgroundId: string, @Query("days") days: string, @Req() req: Request) {
    const cgId = campgroundId || req?.campgroundId || (req.headers as any)["x-campground-id"];
    return this.analyticsService.getPricingSignals(cgId, days ? parseInt(days, 10) : 30);
  }

  @UseGuards(JwtAuthGuard)
  @Get("reports/annual")
  async getAnnualReport(
    @Query("campgroundId") campgroundId: string,
    @Query("year") year: string,
    @Query("format") format: string,
    @Req() req: Request
  ) {
    const cgId = campgroundId || req?.campgroundId || (req.headers as any)["x-campground-id"];
    const yr = year ? parseInt(year, 10) : undefined;
    return this.analyticsService.getAnnualReport(cgId, yr, format);
  }

  @UseGuards(JwtAuthGuard)
  @Get("reports/devices")
  async getDeviceBreakdown(
    @Query("campgroundId") campgroundId: string,
    @Query("days") days: string,
    @Req() req: Request
  ) {
    const cgId = campgroundId || req?.campgroundId || (req.headers as any)["x-campground-id"];
    return this.analyticsService.getDeviceBreakdown(cgId, days ? parseInt(days, 10) : 30);
  }
}

