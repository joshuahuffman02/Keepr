import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { DateRange } from "../platform-analytics.service";

interface PlatformBenchmarks {
  revenue: {
    averagePerCampground: number;
    medianPerCampground: number;
    top10Percentile: number;
    bottom10Percentile: number;
  };
  occupancy: {
    platformAverage: number;
    top10Percentile: number;
    bySeasonAverage: Record<string, number>;
  };
  los: {
    platformAverage: number;
    byTypeAverage: Record<string, number>;
  };
  adr: {
    platformAverage: number;
    byTypeAverage: Record<string, number>;
  };
  bookingWindow: {
    platformAverage: number;
  };
}

interface CampgroundComparison {
  campground: {
    id: string;
    name: string;
  };
  metrics: {
    metric: string;
    campgroundValue: number;
    platformAverage: number;
    percentile: number;
    status: "above" | "below" | "average";
  }[];
  overallScore: number;
}

@Injectable()
export class BenchmarkService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get platform-wide benchmarks
   */
  async getPlatformBenchmarks(dateRange: DateRange): Promise<PlatformBenchmarks> {
    const { start, end } = dateRange;
    const daysInRange = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    // Get revenue by campground
    const revenueBycamp = await this.prisma.reservation.groupBy({
      by: ["campgroundId"],
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
      },
      _sum: { totalAmount: true },
    });

    const revenues = revenueBycamp
      .map((r) => r._sum.totalAmount || 0)
      .sort((a, b) => a - b);

    // Get reservations for other metrics
    const reservations = await this.prisma.reservation.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
      },
      select: {
        totalAmount: true,
        arrivalDate: true,
        departureDate: true,
        leadTimeDays: true,
        site: { select: { siteType: true } },
      },
    });

    // Calculate LOS
    const losData: { los: number; type: string }[] = [];
    for (const res of reservations) {
      const los = Math.ceil(
        (new Date(res.departureDate).getTime() - new Date(res.arrivalDate).getTime()) /
        (1000 * 60 * 60 * 24)
      );
      losData.push({ los, type: res.site?.siteType || "unknown" });
    }

    const avgLos = losData.length > 0
      ? losData.reduce((sum, d) => sum + d.los, 0) / losData.length
      : 0;

    // LOS by type
    const losByType: Record<string, number[]> = {};
    for (const d of losData) {
      if (!losByType[d.type]) losByType[d.type] = [];
      losByType[d.type].push(d.los);
    }
    const losByTypeAvg: Record<string, number> = {};
    for (const [type, values] of Object.entries(losByType)) {
      losByTypeAvg[type] = values.reduce((a, b) => a + b, 0) / values.length;
    }

    // Calculate ADR
    const adrData: { rate: number; type: string }[] = [];
    for (const res of reservations) {
      const nights = Math.ceil(
        (new Date(res.departureDate).getTime() - new Date(res.arrivalDate).getTime()) /
        (1000 * 60 * 60 * 24)
      );
      if (nights > 0) {
        adrData.push({
          rate: (res.totalAmount || 0) / nights,
          type: res.site?.siteType || "unknown",
        });
      }
    }

    const avgAdr = adrData.length > 0
      ? adrData.reduce((sum, d) => sum + d.rate, 0) / adrData.length
      : 0;

    // ADR by type
    const adrByType: Record<string, number[]> = {};
    for (const d of adrData) {
      if (!adrByType[d.type]) adrByType[d.type] = [];
      adrByType[d.type].push(d.rate);
    }
    const adrByTypeAvg: Record<string, number> = {};
    for (const [type, values] of Object.entries(adrByType)) {
      adrByTypeAvg[type] = values.reduce((a, b) => a + b, 0) / values.length;
    }

    // Booking window
    const leadTimes = reservations
      .filter((r) => r.leadTimeDays !== null)
      .map((r) => r.leadTimeDays!);
    const avgLeadTime = leadTimes.length > 0
      ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length
      : 0;

    // Calculate occupancy
    const totalSites = await this.prisma.site.count({ where: { isActive: true } });
    const totalAvailableNights = totalSites * daysInRange;
    let occupiedNights = 0;
    for (const res of reservations) {
      const nights = Math.ceil(
        (new Date(res.departureDate).getTime() - new Date(res.arrivalDate).getTime()) /
        (1000 * 60 * 60 * 24)
      );
      occupiedNights += nights;
    }
    const avgOccupancy = totalAvailableNights > 0
      ? (occupiedNights / totalAvailableNights) * 100
      : 0;

    // Occupancy by season (simplified by quarter)
    const seasons: Record<string, { occupied: number; available: number }> = {
      winter: { occupied: 0, available: 0 },
      spring: { occupied: 0, available: 0 },
      summer: { occupied: 0, available: 0 },
      fall: { occupied: 0, available: 0 },
    };

    for (const res of reservations) {
      const month = res.arrivalDate.getMonth();
      let season: string;
      if (month >= 11 || month <= 1) season = "winter";
      else if (month >= 2 && month <= 4) season = "spring";
      else if (month >= 5 && month <= 7) season = "summer";
      else season = "fall";

      const nights = Math.ceil(
        (new Date(res.departureDate).getTime() - new Date(res.arrivalDate).getTime()) /
        (1000 * 60 * 60 * 24)
      );
      seasons[season].occupied += nights;
    }

    const seasonAvg: Record<string, number> = {};
    for (const [season, data] of Object.entries(seasons)) {
      // Estimate available nights per season (approx 91 days per season)
      const seasonDays = Math.min(91, daysInRange / 4);
      const seasonAvailable = totalSites * seasonDays;
      seasonAvg[season] = seasonAvailable > 0 ? (data.occupied / seasonAvailable) * 100 : 0;
    }

    return {
      revenue: {
        averagePerCampground: revenues.length > 0
          ? revenues.reduce((a, b) => a + b, 0) / revenues.length
          : 0,
        medianPerCampground: revenues.length > 0
          ? revenues[Math.floor(revenues.length / 2)]
          : 0,
        top10Percentile: revenues.length > 0
          ? revenues[Math.floor(revenues.length * 0.9)]
          : 0,
        bottom10Percentile: revenues.length > 0
          ? revenues[Math.floor(revenues.length * 0.1)]
          : 0,
      },
      occupancy: {
        platformAverage: avgOccupancy,
        top10Percentile: Math.min(avgOccupancy * 1.5, 100), // Estimate
        bySeasonAverage: seasonAvg,
      },
      los: {
        platformAverage: avgLos,
        byTypeAverage: losByTypeAvg,
      },
      adr: {
        platformAverage: avgAdr,
        byTypeAverage: adrByTypeAvg,
      },
      bookingWindow: {
        platformAverage: avgLeadTime,
      },
    };
  }

  /**
   * Compare a specific campground against platform benchmarks
   */
  async getCampgroundVsPlatform(
    campgroundId: string,
    dateRange: DateRange
  ): Promise<CampgroundComparison> {
    const { start, end } = dateRange;
    const daysInRange = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    // Get campground info
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { id: true, name: true },
    });

    if (!campground) {
      throw new NotFoundException("Campground not found");
    }

    // Get platform benchmarks
    const platformBenchmarks = await this.getPlatformBenchmarks(dateRange);

    // Get campground-specific metrics
    const campgroundReservations = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        createdAt: { gte: start, lte: end },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
      },
      select: {
        totalAmount: true,
        arrivalDate: true,
        departureDate: true,
        leadTimeDays: true,
      },
    });

    // Calculate campground metrics
    const campgroundRevenue = campgroundReservations.reduce(
      (sum, r) => sum + (r.totalAmount || 0),
      0
    );

    let totalNights = 0;
    for (const res of campgroundReservations) {
      const nights = Math.ceil(
        (new Date(res.departureDate).getTime() - new Date(res.arrivalDate).getTime()) /
        (1000 * 60 * 60 * 24)
      );
      totalNights += nights;
    }

    const campgroundLos = campgroundReservations.length > 0
      ? totalNights / campgroundReservations.length
      : 0;

    const campgroundAdr = totalNights > 0 ? campgroundRevenue / totalNights : 0;

    const leadTimes = campgroundReservations
      .filter((r) => r.leadTimeDays !== null)
      .map((r) => r.leadTimeDays!);
    const campgroundLeadTime = leadTimes.length > 0
      ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length
      : 0;

    // Calculate occupancy
    const campgroundSites = await this.prisma.site.count({
      where: { campgroundId, isActive: true },
    });
    const availableNights = campgroundSites * daysInRange;
    const campgroundOccupancy = availableNights > 0
      ? (totalNights / availableNights) * 100
      : 0;

    // Get all campground revenues for percentile calculation
    const allCampgroundRevenues = await this.prisma.reservation.groupBy({
      by: ["campgroundId"],
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
      },
      _sum: { totalAmount: true },
    });

    const revenues = allCampgroundRevenues
      .map((r) => r._sum.totalAmount || 0)
      .sort((a, b) => a - b);

    const revenuePercentile = this.calculatePercentile(revenues, campgroundRevenue);

    // Build comparison metrics
    const metrics = [
      {
        metric: "Total Revenue",
        campgroundValue: campgroundRevenue,
        platformAverage: platformBenchmarks.revenue.averagePerCampground,
        percentile: revenuePercentile,
        status: this.getStatus(campgroundRevenue, platformBenchmarks.revenue.averagePerCampground),
      },
      {
        metric: "Occupancy Rate (%)",
        campgroundValue: campgroundOccupancy,
        platformAverage: platformBenchmarks.occupancy.platformAverage,
        percentile: this.estimatePercentile(campgroundOccupancy, platformBenchmarks.occupancy.platformAverage),
        status: this.getStatus(campgroundOccupancy, platformBenchmarks.occupancy.platformAverage),
      },
      {
        metric: "Average Length of Stay",
        campgroundValue: campgroundLos,
        platformAverage: platformBenchmarks.los.platformAverage,
        percentile: this.estimatePercentile(campgroundLos, platformBenchmarks.los.platformAverage),
        status: this.getStatus(campgroundLos, platformBenchmarks.los.platformAverage),
      },
      {
        metric: "Average Daily Rate ($)",
        campgroundValue: campgroundAdr,
        platformAverage: platformBenchmarks.adr.platformAverage,
        percentile: this.estimatePercentile(campgroundAdr, platformBenchmarks.adr.platformAverage),
        status: this.getStatus(campgroundAdr, platformBenchmarks.adr.platformAverage),
      },
      {
        metric: "Average Booking Window (days)",
        campgroundValue: campgroundLeadTime,
        platformAverage: platformBenchmarks.bookingWindow.platformAverage,
        percentile: this.estimatePercentile(campgroundLeadTime, platformBenchmarks.bookingWindow.platformAverage),
        status: this.getStatus(campgroundLeadTime, platformBenchmarks.bookingWindow.platformAverage),
      },
    ];

    // Calculate overall score (average of percentiles)
    const overallScore = metrics.reduce((sum, m) => sum + m.percentile, 0) / metrics.length;

    return {
      campground,
      metrics,
      overallScore,
    };
  }

  /**
   * Calculate percentile ranking
   */
  private calculatePercentile(sortedValues: number[], value: number): number {
    if (sortedValues.length === 0) return 50;

    let count = 0;
    for (const v of sortedValues) {
      if (v < value) count++;
    }

    return (count / sortedValues.length) * 100;
  }

  /**
   * Estimate percentile based on comparison to average
   */
  private estimatePercentile(value: number, average: number): number {
    if (average === 0) return 50;
    const ratio = value / average;

    // Map ratio to percentile (rough estimate)
    if (ratio >= 2) return 95;
    if (ratio >= 1.5) return 85;
    if (ratio >= 1.2) return 70;
    if (ratio >= 1) return 55;
    if (ratio >= 0.8) return 40;
    if (ratio >= 0.5) return 25;
    return 10;
  }

  /**
   * Determine status relative to average
   */
  private getStatus(value: number, average: number): "above" | "below" | "average" {
    if (average === 0) return "average";
    const ratio = value / average;

    if (ratio >= 1.1) return "above";
    if (ratio <= 0.9) return "below";
    return "average";
  }
}
