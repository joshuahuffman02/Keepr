import type { Request } from "express";
import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { EnhancedAnalyticsService } from "./enhanced-analytics.service";
import {
  TrackAdminEventDto,
  TrackSessionDto,
  UpdateSessionDto,
  TrackFunnelDto,
  CompleteFunnelDto,
  TrackFeatureUsageDto,
} from "./dto/track-admin-event.dto";
import { JwtAuthGuard, Roles, RolesGuard } from "../auth/guards";
import { UserRole } from "@prisma/client";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getRequestString = (req: Request, key: "campgroundId" | "organizationId"): string | null => {
  if (!isRecord(req)) return null;
  const raw = req[key];
  return typeof raw === "string" ? raw : null;
};

const getRequestUserId = (req: Request): string | null => {
  if (!isRecord(req)) return null;
  const user = req.user;
  if (!isRecord(user)) return null;
  const id = user.id;
  return typeof id === "string" ? id : null;
};

@Controller("analytics/enhanced")
export class EnhancedAnalyticsController {
  constructor(private readonly service: EnhancedAnalyticsService) {}

  // ============================================================================
  // SESSION ENDPOINTS
  // ============================================================================

  /**
   * Start a new session or resume existing one
   * Public endpoint - no auth required for anonymous tracking
   */
  @Post("session/start")
  async startSession(@Body() dto: TrackSessionDto, @Req() req: Request) {
    const scope = {
      campgroundId: getRequestString(req, "campgroundId"),
      organizationId: getRequestString(req, "organizationId"),
      userId: getRequestUserId(req),
    };
    return this.service.startSession(dto, scope);
  }

  /**
   * Update session with heartbeat data
   * Public endpoint
   */
  @Post("session/update")
  async updateSession(@Body() dto: UpdateSessionDto) {
    return this.service.updateSession(dto);
  }

  /**
   * End a session
   * Public endpoint
   */
  @Post("session/end")
  async endSession(@Body() body: { sessionId: string; exitPage?: string }) {
    return this.service.endSession(body.sessionId, body.exitPage);
  }

  // ============================================================================
  // ADMIN EVENT TRACKING
  // ============================================================================

  /**
   * Track an admin/staff event
   * Public endpoint for frontend tracking
   */
  @Post("event")
  async trackEvent(@Body() dto: TrackAdminEventDto, @Req() req: Request) {
    const headerCampgroundId = this.getHeader(req, "x-campground-id");
    const headerOrganizationId = this.getHeader(req, "x-organization-id");
    const scope = {
      campgroundId: getRequestString(req, "campgroundId") || headerCampgroundId || null,
      organizationId: getRequestString(req, "organizationId") || headerOrganizationId || null,
      userId: getRequestUserId(req),
    };
    return this.service.trackAdminEvent(dto, scope);
  }

  // ============================================================================
  // FUNNEL TRACKING
  // ============================================================================

  /**
   * Track funnel step progression
   * Public endpoint for frontend tracking
   */
  @Post("funnel/step")
  async trackFunnelStep(@Body() dto: TrackFunnelDto, @Req() req: Request) {
    const headerCampgroundId = this.getHeader(req, "x-campground-id");
    const headerOrganizationId = this.getHeader(req, "x-organization-id");
    const scope = {
      campgroundId: getRequestString(req, "campgroundId") || headerCampgroundId || null,
      organizationId: getRequestString(req, "organizationId") || headerOrganizationId || null,
      userId: getRequestUserId(req),
    };
    return this.service.trackFunnelStep(dto, scope);
  }

  /**
   * Complete or abandon a funnel
   * Public endpoint
   */
  @Post("funnel/complete")
  async completeFunnel(@Body() dto: CompleteFunnelDto, @Req() req: Request) {
    const headerCampgroundId = this.getHeader(req, "x-campground-id");
    const headerOrganizationId = this.getHeader(req, "x-organization-id");
    const scope = {
      campgroundId: getRequestString(req, "campgroundId") || headerCampgroundId || null,
      organizationId: getRequestString(req, "organizationId") || headerOrganizationId || null,
      userId: getRequestUserId(req),
    };
    return this.service.completeFunnel(dto, scope);
  }

  // ============================================================================
  // FEATURE USAGE
  // ============================================================================

  /**
   * Track feature usage
   * Public endpoint
   */
  @Post("feature")
  async trackFeature(@Body() dto: TrackFeatureUsageDto, @Req() req: Request) {
    const headerCampgroundId = this.getHeader(req, "x-campground-id");
    const headerOrganizationId = this.getHeader(req, "x-organization-id");
    const scope = {
      campgroundId: getRequestString(req, "campgroundId") || headerCampgroundId || null,
      organizationId: getRequestString(req, "organizationId") || headerOrganizationId || null,
      userId: getRequestUserId(req),
    };
    return this.service.trackFeatureUsage(dto, scope);
  }

  // ============================================================================
  // REPORTING ENDPOINTS (Authenticated)
  // ============================================================================

  /**
   * Get page stats for a campground
   */
  @UseGuards(JwtAuthGuard)
  @Get("reports/pages")
  async getPageStats(
    @Query("campgroundId") campgroundId: string,
    @Query("days") days: string,
    @Req() req: Request,
  ) {
    const cgId =
      campgroundId ||
      getRequestString(req, "campgroundId") ||
      this.getHeader(req, "x-campground-id");
    if (!cgId) throw new BadRequestException("campgroundId required");
    return this.service.getPageStats(cgId, days ? parseInt(days, 10) : 30);
  }

  /**
   * Get feature usage stats
   */
  @UseGuards(JwtAuthGuard)
  @Get("reports/features")
  async getFeatureUsage(
    @Query("campgroundId") campgroundId: string,
    @Query("days") days: string,
    @Req() req: Request,
  ) {
    const cgId =
      campgroundId ||
      getRequestString(req, "campgroundId") ||
      this.getHeader(req, "x-campground-id");
    if (!cgId) throw new BadRequestException("campgroundId required");
    return this.service.getFeatureUsage(cgId, days ? parseInt(days, 10) : 30);
  }

  /**
   * Get funnel analysis
   */
  @UseGuards(JwtAuthGuard)
  @Get("reports/funnel")
  async getFunnelAnalysis(
    @Query("campgroundId") campgroundId: string,
    @Query("funnelName") funnelName: string,
    @Query("days") days: string,
    @Req() req: Request,
  ) {
    const cgId =
      campgroundId ||
      getRequestString(req, "campgroundId") ||
      this.getHeader(req, "x-campground-id");
    if (!cgId) throw new BadRequestException("campgroundId required");
    if (!funnelName) throw new BadRequestException("funnelName required");
    return this.service.getFunnelAnalysis(cgId, funnelName, days ? parseInt(days, 10) : 30);
  }

  /**
   * Get session stats
   */
  @UseGuards(JwtAuthGuard)
  @Get("reports/sessions")
  async getSessionStats(
    @Query("campgroundId") campgroundId: string,
    @Query("days") days: string,
    @Req() req: Request,
  ) {
    const cgId =
      campgroundId ||
      getRequestString(req, "campgroundId") ||
      this.getHeader(req, "x-campground-id");
    if (!cgId) throw new BadRequestException("campgroundId required");
    return this.service.getSessionStats(cgId, days ? parseInt(days, 10) : 30);
  }

  /**
   * Get staff metrics
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.owner, UserRole.manager)
  @Get("reports/staff")
  async getStaffMetrics(
    @Query("campgroundId") campgroundId: string,
    @Query("days") days: string,
    @Req() req: Request,
  ) {
    const cgId =
      campgroundId ||
      getRequestString(req, "campgroundId") ||
      this.getHeader(req, "x-campground-id");
    if (!cgId) throw new BadRequestException("campgroundId required");
    return this.service.getStaffMetrics(cgId, days ? parseInt(days, 10) : 30);
  }

  /**
   * Get live events for real-time dashboard
   */
  @UseGuards(JwtAuthGuard)
  @Get("live")
  async getLiveEvents(
    @Query("campgroundId") campgroundId: string,
    @Query("limit") limit: string,
    @Req() req: Request,
  ) {
    const cgId =
      campgroundId ||
      getRequestString(req, "campgroundId") ||
      this.getHeader(req, "x-campground-id");
    if (!cgId) throw new BadRequestException("campgroundId required");
    return this.service.getLiveEvents(cgId, limit ? parseInt(limit, 10) : 50);
  }

  private getHeader(req: Request, name: string): string | undefined {
    const value = req.get(name);
    return value ?? undefined;
  }
}
