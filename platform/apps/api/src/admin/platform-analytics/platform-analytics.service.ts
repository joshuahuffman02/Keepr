import { Injectable } from "@nestjs/common";
import { RevenueIntelligenceService } from "./services/revenue-intelligence.service";
import { GuestJourneyService } from "./services/guest-journey.service";
import { AccommodationMixService } from "./services/accommodation-mix.service";
import { GeographicIntelligenceService } from "./services/geographic-intelligence.service";
import { BookingBehaviorService } from "./services/booking-behavior.service";
import { LengthOfStayService } from "./services/length-of-stay.service";
import { AmenityAnalyticsService } from "./services/amenity-analytics.service";
import { BenchmarkService } from "./services/benchmark.service";

export interface DateRange {
  start: Date;
  end: Date;
}

export interface AnalyticsQueryParams {
  range?: string; // last_30_days, last_90_days, last_12_months, ytd, all_time
  startDate?: string;
  endDate?: string;
}

@Injectable()
export class PlatformAnalyticsService {
  constructor(
    private revenueService: RevenueIntelligenceService,
    private guestJourneyService: GuestJourneyService,
    private accommodationService: AccommodationMixService,
    private geographicService: GeographicIntelligenceService,
    private bookingService: BookingBehaviorService,
    private losService: LengthOfStayService,
    private amenityService: AmenityAnalyticsService,
    private benchmarkService: BenchmarkService,
  ) {}

  /**
   * Parse date range from query params
   */
  parseDateRange(params: AnalyticsQueryParams): DateRange {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    if (params.startDate && params.endDate) {
      start = new Date(params.startDate);
      end = new Date(params.endDate);
    } else {
      switch (params.range) {
        case "last_30_days":
          start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "last_90_days":
          start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case "ytd":
          start = new Date(now.getFullYear(), 0, 1);
          break;
        case "all_time":
          start = new Date("2020-01-01");
          break;
        case "last_12_months":
        default:
          start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
      }
    }

    return { start, end };
  }

  /**
   * Get platform-wide overview dashboard data
   */
  async getOverview(params: AnalyticsQueryParams) {
    const dateRange = this.parseDateRange(params);

    const [revenue, guests, accommodations, booking, los] = await Promise.all([
      this.revenueService.getOverview(dateRange),
      this.guestJourneyService.getOverview(dateRange),
      this.accommodationService.getOverview(dateRange),
      this.bookingService.getOverview(dateRange),
      this.losService.getOverview(dateRange),
    ]);

    return {
      dateRange: {
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
      },
      revenue,
      guests,
      accommodations,
      booking,
      los,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get all analytics modules combined (for full export)
   */
  async getFullAnalytics(params: AnalyticsQueryParams) {
    const dateRange = this.parseDateRange(params);

    const [revenue, guestJourney, accommodations, geographic, booking, los, amenities] =
      await Promise.all([
        this.revenueService.getFullAnalytics(dateRange),
        this.guestJourneyService.getFullAnalytics(dateRange),
        this.accommodationService.getFullAnalytics(dateRange),
        this.geographicService.getFullAnalytics(dateRange),
        this.bookingService.getFullAnalytics(dateRange),
        this.losService.getFullAnalytics(dateRange),
        this.amenityService.getFullAnalytics(dateRange),
      ]);

    return {
      metadata: {
        exportedAt: new Date().toISOString(),
        dateRange: {
          start: dateRange.start.toISOString(),
          end: dateRange.end.toISOString(),
        },
        platform: "Campreserv",
        version: "1.0",
      },
      modules: {
        revenue,
        guestJourney,
        accommodations,
        geographic,
        booking,
        los,
        amenities,
      },
    };
  }
}
