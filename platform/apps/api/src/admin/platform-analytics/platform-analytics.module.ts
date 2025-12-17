import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { PlatformAnalyticsController } from "./platform-analytics.controller";
import { PlatformAnalyticsService } from "./platform-analytics.service";
import { RevenueIntelligenceService } from "./services/revenue-intelligence.service";
import { GuestJourneyService } from "./services/guest-journey.service";
import { AccommodationMixService } from "./services/accommodation-mix.service";
import { GeographicIntelligenceService } from "./services/geographic-intelligence.service";
import { BookingBehaviorService } from "./services/booking-behavior.service";
import { LengthOfStayService } from "./services/length-of-stay.service";
import { AmenityAnalyticsService } from "./services/amenity-analytics.service";
import { BenchmarkService } from "./services/benchmark.service";
import { NpsAnalyticsService } from "./services/nps-analytics.service";
import { AnalyticsExportService } from "./export/analytics-export.service";
import { ExecutiveDashboardService } from "./services/executive-dashboard.service";
import { AiSuggestionsService } from "./services/ai-suggestions.service";

@Module({
  imports: [PrismaModule],
  controllers: [PlatformAnalyticsController],
  providers: [
    PlatformAnalyticsService,
    RevenueIntelligenceService,
    GuestJourneyService,
    AccommodationMixService,
    GeographicIntelligenceService,
    BookingBehaviorService,
    LengthOfStayService,
    AmenityAnalyticsService,
    BenchmarkService,
    NpsAnalyticsService,
    AnalyticsExportService,
    ExecutiveDashboardService,
    AiSuggestionsService,
  ],
  exports: [
    PlatformAnalyticsService,
    RevenueIntelligenceService,
    GuestJourneyService,
    AccommodationMixService,
    GeographicIntelligenceService,
    BookingBehaviorService,
    LengthOfStayService,
    AmenityAnalyticsService,
    BenchmarkService,
    NpsAnalyticsService,
    AnalyticsExportService,
    ExecutiveDashboardService,
    AiSuggestionsService,
  ],
})
export class PlatformAnalyticsModule {}
