import { Controller, Get, Post, Query, Param, Body, Res } from "@nestjs/common";
import { Response } from "express";
import { PlatformAnalyticsService, AnalyticsQueryParams } from "./platform-analytics.service";
import { RevenueIntelligenceService } from "./services/revenue-intelligence.service";
import { GuestJourneyService } from "./services/guest-journey.service";
import { AccommodationMixService } from "./services/accommodation-mix.service";
import { GeographicIntelligenceService } from "./services/geographic-intelligence.service";
import { BookingBehaviorService } from "./services/booking-behavior.service";
import { LengthOfStayService } from "./services/length-of-stay.service";
import { AmenityAnalyticsService } from "./services/amenity-analytics.service";
import { BenchmarkService } from "./services/benchmark.service";
import { NpsAnalyticsService } from "./services/nps-analytics.service";
import { AnalyticsExportService, ExportOptions } from "./export/analytics-export.service";

@Controller("admin/platform-analytics")
export class PlatformAnalyticsController {
  constructor(
    private analyticsService: PlatformAnalyticsService,
    private revenueService: RevenueIntelligenceService,
    private guestJourneyService: GuestJourneyService,
    private accommodationService: AccommodationMixService,
    private geographicService: GeographicIntelligenceService,
    private bookingService: BookingBehaviorService,
    private losService: LengthOfStayService,
    private amenityService: AmenityAnalyticsService,
    private benchmarkService: BenchmarkService,
    private npsService: NpsAnalyticsService,
    private exportService: AnalyticsExportService
  ) {}

  /**
   * Overview dashboard - high-level KPIs from all modules
   */
  @Get("overview")
  async getOverview(@Query() params: AnalyticsQueryParams) {
    return this.analyticsService.getOverview(params);
  }

  /**
   * Full analytics export - all modules combined
   */
  @Get("full")
  async getFullAnalytics(@Query() params: AnalyticsQueryParams) {
    return this.analyticsService.getFullAnalytics(params);
  }

  // ============================================
  // Revenue Intelligence
  // ============================================

  @Get("revenue")
  async getRevenue(@Query() params: AnalyticsQueryParams) {
    const dateRange = this.analyticsService.parseDateRange(params);
    return this.revenueService.getFullAnalytics(dateRange);
  }

  @Get("revenue/trends")
  async getRevenueTrends(@Query() params: AnalyticsQueryParams) {
    const dateRange = this.analyticsService.parseDateRange(params);
    return this.revenueService.getRevenueTrends(dateRange);
  }

  @Get("revenue/by-type")
  async getRevenueByType(@Query() params: AnalyticsQueryParams) {
    const dateRange = this.analyticsService.parseDateRange(params);
    return this.revenueService.getRevenueByAccommodationType(dateRange);
  }

  // ============================================
  // Guest Journey
  // ============================================

  @Get("guests/journey")
  async getGuestJourney(@Query() params: AnalyticsQueryParams) {
    const dateRange = this.analyticsService.parseDateRange(params);
    return this.guestJourneyService.getFullAnalytics(dateRange);
  }

  @Get("guests/progression")
  async getGuestProgression(@Query() params: AnalyticsQueryParams) {
    const dateRange = this.analyticsService.parseDateRange(params);
    return this.guestJourneyService.getAccommodationProgression(dateRange);
  }

  @Get("guests/lifetime-value")
  async getGuestLifetimeValue(@Query() params: AnalyticsQueryParams) {
    const dateRange = this.analyticsService.parseDateRange(params);
    return this.guestJourneyService.getLifetimeValueAnalysis(dateRange);
  }

  // ============================================
  // Accommodation Mix
  // ============================================

  @Get("accommodations")
  async getAccommodations(@Query() params: AnalyticsQueryParams) {
    const dateRange = this.analyticsService.parseDateRange(params);
    return this.accommodationService.getFullAnalytics(dateRange);
  }

  @Get("accommodations/rig-types")
  async getRigTypes(@Query() params: AnalyticsQueryParams) {
    const dateRange = this.analyticsService.parseDateRange(params);
    return this.accommodationService.getRigTypeBreakdown(dateRange);
  }

  @Get("accommodations/utilization")
  async getUtilization(@Query() params: AnalyticsQueryParams) {
    const dateRange = this.analyticsService.parseDateRange(params);
    return this.accommodationService.getUtilizationRates(dateRange);
  }

  // ============================================
  // Geographic Intelligence
  // ============================================

  @Get("geographic")
  async getGeographic(@Query() params: AnalyticsQueryParams) {
    const dateRange = this.analyticsService.parseDateRange(params);
    return this.geographicService.getFullAnalytics(dateRange);
  }

  @Get("geographic/heatmap")
  async getGeographicHeatmap(@Query() params: AnalyticsQueryParams) {
    const dateRange = this.analyticsService.parseDateRange(params);
    return this.geographicService.getOriginHeatmap(dateRange);
  }

  @Get("geographic/travel-distance")
  async getTravelDistance(@Query() params: AnalyticsQueryParams) {
    const dateRange = this.analyticsService.parseDateRange(params);
    return this.geographicService.getTravelDistanceAnalysis(dateRange);
  }

  // ============================================
  // Booking Behavior
  // ============================================

  @Get("booking")
  async getBookingBehavior(@Query() params: AnalyticsQueryParams) {
    const dateRange = this.analyticsService.parseDateRange(params);
    return this.bookingService.getFullAnalytics(dateRange);
  }

  @Get("booking/lead-time")
  async getLeadTime(@Query() params: AnalyticsQueryParams) {
    const dateRange = this.analyticsService.parseDateRange(params);
    return this.bookingService.getLeadTimeAnalysis(dateRange);
  }

  @Get("booking/cancellations")
  async getCancellations(@Query() params: AnalyticsQueryParams) {
    const dateRange = this.analyticsService.parseDateRange(params);
    return this.bookingService.getCancellationAnalysis(dateRange);
  }

  // ============================================
  // Length of Stay
  // ============================================

  @Get("los")
  async getLengthOfStay(@Query() params: AnalyticsQueryParams) {
    const dateRange = this.analyticsService.parseDateRange(params);
    return this.losService.getFullAnalytics(dateRange);
  }

  @Get("los/by-type")
  async getLosByType(@Query() params: AnalyticsQueryParams) {
    const dateRange = this.analyticsService.parseDateRange(params);
    return this.losService.getLosByAccommodationType(dateRange);
  }

  @Get("los/trends")
  async getLosTrends(@Query() params: AnalyticsQueryParams) {
    const dateRange = this.analyticsService.parseDateRange(params);
    return this.losService.getLosTrends(dateRange);
  }

  // ============================================
  // Amenity Analytics
  // ============================================

  @Get("amenities")
  async getAmenities(@Query() params: AnalyticsQueryParams) {
    const dateRange = this.analyticsService.parseDateRange(params);
    return this.amenityService.getFullAnalytics(dateRange);
  }

  @Get("amenities/correlation")
  async getAmenityCorrelation(@Query() params: AnalyticsQueryParams) {
    const dateRange = this.analyticsService.parseDateRange(params);
    return this.amenityService.getAmenityRevenueCorrelation(dateRange);
  }

  // ============================================
  // Benchmarks
  // ============================================

  @Get("benchmarks")
  async getPlatformBenchmarks(@Query() params: AnalyticsQueryParams) {
    const dateRange = this.analyticsService.parseDateRange(params);
    return this.benchmarkService.getPlatformBenchmarks(dateRange);
  }

  @Get("benchmarks/:campgroundId")
  async getCampgroundBenchmarks(
    @Param("campgroundId") campgroundId: string,
    @Query() params: AnalyticsQueryParams
  ) {
    const dateRange = this.analyticsService.parseDateRange(params);
    return this.benchmarkService.getCampgroundVsPlatform(campgroundId, dateRange);
  }

  // ============================================
  // NPS Analytics
  // ============================================

  @Get("nps")
  async getNps(@Query() params: AnalyticsQueryParams) {
    const dateRange = this.analyticsService.parseDateRange(params);
    return this.npsService.getFullAnalytics(dateRange);
  }

  @Get("nps/overview")
  async getNpsOverview(@Query() params: AnalyticsQueryParams) {
    const dateRange = this.analyticsService.parseDateRange(params);
    return this.npsService.getOverview(dateRange);
  }

  @Get("nps/trends")
  async getNpsTrends(@Query() params: AnalyticsQueryParams) {
    const dateRange = this.analyticsService.parseDateRange(params);
    return this.npsService.getNpsTrends(dateRange);
  }

  @Get("nps/distribution")
  async getNpsDistribution(@Query() params: AnalyticsQueryParams) {
    const dateRange = this.analyticsService.parseDateRange(params);
    return this.npsService.getScoreDistribution(dateRange);
  }

  @Get("nps/comments")
  async getNpsComments(@Query() params: AnalyticsQueryParams) {
    const dateRange = this.analyticsService.parseDateRange(params);
    return this.npsService.getRecentComments(dateRange);
  }

  // ============================================
  // Export
  // ============================================

  @Post("export")
  async createExport(@Body() options: ExportOptions) {
    return this.exportService.createExport(options);
  }

  @Get("export/:id/status")
  async getExportStatus(@Param("id") id: string) {
    return this.exportService.getExportStatus(id);
  }

  @Get("export/:id/download")
  async downloadExport(@Param("id") id: string, @Res() res: Response) {
    const exportData = await this.exportService.getExportData(id);

    if (!exportData) {
      return res.status(404).json({ error: "Export not found" });
    }

    const filename = `campreserv-analytics-${new Date().toISOString().split("T")[0]}`;

    if (exportData.format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}.json"`);
      return res.send(exportData.data);
    } else {
      res.setHeader("Content-Type", "text/markdown");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}.md"`);
      return res.send(exportData.data);
    }
  }
}
