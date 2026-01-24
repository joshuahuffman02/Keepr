import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { IngestAnalyticsEventDto } from "./dto/ingest-analytics-event.dto";
import { ApplyRecommendationDto } from "./dto/apply-recommendation.dto";
import { ProposeRecommendationDto } from "./dto/propose-recommendation.dto";
import { JwtAuthGuard, Roles, RolesGuard } from "../auth/guards";
import { UserRole } from "@prisma/client";
import type { Request } from "express";
import type { AuthUser } from "../auth/auth.types";

type AnalyticsRequest = Request & {
  user?: AuthUser;
  campgroundId?: string | null;
  organizationId?: string | null;
};

const getHeaderValue = (req: Request, key: string): string | undefined => {
  const value = req.headers[key];
  return Array.isArray(value) ? value[0] : value;
};

const resolveCampgroundId = (
  campgroundId: string | undefined,
  req: AnalyticsRequest,
): string | null => {
  const headerValue = getHeaderValue(req, "x-campground-id");
  const cgId = campgroundId || req.campgroundId || headerValue;
  return typeof cgId === "string" && cgId ? cgId : null;
};

@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post("events")
  async ingestEvent(@Body() dto: IngestAnalyticsEventDto, @Req() req: AnalyticsRequest) {
    const scope = {
      campgroundId: req?.campgroundId || null,
      organizationId: req?.organizationId || null,
      userId: req?.user?.id || null,
    };
    return this.analyticsService.ingest(dto, scope);
  }

  @UseGuards(JwtAuthGuard)
  @Get("recommendations")
  async listRecommendations(
    @Query("campgroundId") campgroundId: string,
    @Req() req: AnalyticsRequest,
  ) {
    const cgId = resolveCampgroundId(campgroundId, req);
    if (!cgId) throw new BadRequestException("campgroundId required");
    return this.analyticsService.getRecommendations(cgId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @Post("recommendations/apply")
  async applyRecommendation(@Body() dto: ApplyRecommendationDto, @Req() req: AnalyticsRequest) {
    const user = req.user;
    if (!user) throw new UnauthorizedException("Unauthorized");
    if (!user.role) throw new UnauthorizedException("User role required");
    const campId = resolveCampgroundId(dto.campgroundId, req);
    if (!campId) throw new BadRequestException("campgroundId required");
    return this.analyticsService.applyRecommendation(
      dto,
      { id: user.id, role: user.role },
      {
        campgroundId: campId,
        organizationId: req?.organizationId || null,
        userId: req?.user?.id || null,
      },
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager, UserRole.marketing, UserRole.front_desk)
  @Post("recommendations/propose")
  async proposeRecommendation(@Body() dto: ProposeRecommendationDto, @Req() req: AnalyticsRequest) {
    const user = req.user;
    if (!user) throw new UnauthorizedException("Unauthorized");
    if (!user.role) throw new UnauthorizedException("User role required");
    return this.analyticsService.proposeRecommendation(
      dto,
      { id: user.id, role: user.role },
      {
        campgroundId: req?.campgroundId || null,
        organizationId: req?.organizationId || null,
        userId: req?.user?.id || null,
      },
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get("reports/funnel")
  async getFunnel(
    @Query("campgroundId") campgroundId: string,
    @Query("days") days: string,
    @Req() req: AnalyticsRequest,
  ) {
    const cgId = resolveCampgroundId(campgroundId, req);
    if (!cgId) throw new BadRequestException("campgroundId required");
    return this.analyticsService.getFunnel(cgId, days ? parseInt(days, 10) : 30);
  }

  @UseGuards(JwtAuthGuard)
  @Get("reports/images")
  async getImagePerformance(
    @Query("campgroundId") campgroundId: string,
    @Query("days") days: string,
    @Req() req: AnalyticsRequest,
  ) {
    const cgId = resolveCampgroundId(campgroundId, req);
    if (!cgId) throw new BadRequestException("campgroundId required");
    return this.analyticsService.getImagePerformance(cgId, days ? parseInt(days, 10) : 30);
  }

  @UseGuards(JwtAuthGuard)
  @Get("reports/deals")
  async getDealPerformance(
    @Query("campgroundId") campgroundId: string,
    @Query("days") days: string,
    @Req() req: AnalyticsRequest,
  ) {
    const cgId = resolveCampgroundId(campgroundId, req);
    if (!cgId) throw new BadRequestException("campgroundId required");
    return this.analyticsService.getDealPerformance(cgId, days ? parseInt(days, 10) : 30);
  }

  @UseGuards(JwtAuthGuard)
  @Get("reports/attribution")
  async getAttribution(
    @Query("campgroundId") campgroundId: string,
    @Query("days") days: string,
    @Req() req: AnalyticsRequest,
  ) {
    const cgId = resolveCampgroundId(campgroundId, req);
    if (!cgId) throw new BadRequestException("campgroundId required");
    return this.analyticsService.getAttribution(cgId, days ? parseInt(days, 10) : 30);
  }

  @UseGuards(JwtAuthGuard)
  @Get("reports/pricing")
  async getPricingSignals(
    @Query("campgroundId") campgroundId: string,
    @Query("days") days: string,
    @Req() req: AnalyticsRequest,
  ) {
    const cgId = resolveCampgroundId(campgroundId, req);
    if (!cgId) throw new BadRequestException("campgroundId required");
    return this.analyticsService.getPricingSignals(cgId, days ? parseInt(days, 10) : 30);
  }

  @UseGuards(JwtAuthGuard)
  @Get("reports/annual")
  async getAnnualReport(
    @Query("campgroundId") campgroundId: string,
    @Query("year") year: string,
    @Query("format") format: string,
    @Req() req: AnalyticsRequest,
  ) {
    const cgId = resolveCampgroundId(campgroundId, req);
    if (!cgId) throw new BadRequestException("campgroundId required");
    const yr = year ? parseInt(year, 10) : undefined;
    return this.analyticsService.getAnnualReport(cgId, yr, format);
  }

  @UseGuards(JwtAuthGuard)
  @Get("reports/devices")
  async getDeviceBreakdown(
    @Query("campgroundId") campgroundId: string,
    @Query("days") days: string,
    @Req() req: AnalyticsRequest,
  ) {
    const cgId = resolveCampgroundId(campgroundId, req);
    if (!cgId) throw new BadRequestException("campgroundId required");
    return this.analyticsService.getDeviceBreakdown(cgId, days ? parseInt(days, 10) : 30);
  }
}
