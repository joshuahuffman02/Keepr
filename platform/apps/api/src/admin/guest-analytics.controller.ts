import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { GuestAnalyticsService } from "./guest-analytics.service";
import { JwtAuthGuard, RolesGuard, Roles } from "../auth/guards";
import { PlatformRole } from "@prisma/client";

@Controller("admin/guest-analytics")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PlatformRole.platform_admin, PlatformRole.support_agent)
export class GuestAnalyticsController {
  constructor(private readonly guestAnalyticsService: GuestAnalyticsService) {}

  @Get()
  async getFullAnalytics(@Query("range") range?: string) {
    return this.guestAnalyticsService.getFullAnalytics(range || "last_12_months");
  }

  @Get("overview")
  async getOverview(@Query("range") range?: string) {
    return this.guestAnalyticsService.getOverview(range || "last_12_months");
  }

  @Get("geographic")
  async getGeographicData(@Query("range") range?: string) {
    return this.guestAnalyticsService.getGeographicData(range || "last_12_months");
  }

  @Get("demographics")
  async getDemographics(@Query("range") range?: string) {
    return this.guestAnalyticsService.getDemographics(range || "last_12_months");
  }

  @Get("seasonal-trends")
  async getSeasonalTrends(@Query("range") range?: string) {
    return this.guestAnalyticsService.getSeasonalTrends(range || "last_12_months");
  }

  @Get("travel-behavior")
  async getTravelBehavior(@Query("range") range?: string) {
    return this.guestAnalyticsService.getTravelBehavior(range || "last_12_months");
  }

  @Get("insights")
  async getInsights(@Query("range") range?: string) {
    return this.guestAnalyticsService.generateInsights(range || "last_12_months");
  }
}
