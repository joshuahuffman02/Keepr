import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";

// ==================== INTERFACES ====================

export interface DemandForecast {
  date: string;
  predictedOccupancy: number; // 0-100
  predictedRevenue: number; // cents
  confidenceLow: number; // lower bound occupancy
  confidenceHigh: number; // upper bound occupancy
  demandLevel: "very_low" | "low" | "moderate" | "high" | "very_high";
  factors: DemandFactor[];
  existingBookings: number; // floor from actual reservations
}

interface DemandFactor {
  name: string;
  impact: number; // -1 to 1 (negative = reduces demand)
  description: string;
}

interface SeasonalityPattern {
  month: number;
  factor: number; // multiplier (1.0 = average, 1.5 = 50% above)
  isHighSeason: boolean;
}

interface DayOfWeekPattern {
  dayOfWeek: number; // 0 = Sunday
  factor: number;
  avgOccupancy: number;
}

export interface HistoricalAnalysis {
  baselineOccupancy: number; // average overall
  seasonality: SeasonalityPattern[];
  dayOfWeek: DayOfWeekPattern[];
  recentTrend: number; // -1 to 1 (declining to growing)
  variance: number; // standard deviation of occupancy
  dataPoints: number;
}

export interface DemandHeatmapDay {
  date: string;
  demandScore: number; // 0-100
  demandLevel: "very_low" | "low" | "moderate" | "high" | "very_high";
  predictedOccupancy: number;
  existingOccupancy: number;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
}

// US Federal Holidays (approximate dates - some move year to year)
const US_HOLIDAYS: Array<{ month: number; day: number; name: string; boost: number }> = [
  { month: 1, day: 1, name: "New Year's Day", boost: 0.1 },
  { month: 1, day: 15, name: "MLK Day Weekend", boost: 0.3 }, // 3rd Monday
  { month: 2, day: 19, name: "Presidents Day Weekend", boost: 0.3 },
  { month: 5, day: 27, name: "Memorial Day Weekend", boost: 0.5 },
  { month: 7, day: 4, name: "Independence Day", boost: 0.6 },
  { month: 9, day: 2, name: "Labor Day Weekend", boost: 0.5 },
  { month: 10, day: 14, name: "Columbus Day Weekend", boost: 0.2 },
  { month: 11, day: 11, name: "Veterans Day", boost: 0.1 },
  { month: 11, day: 28, name: "Thanksgiving", boost: 0.4 },
  { month: 12, day: 25, name: "Christmas", boost: 0.3 },
];

@Injectable()
export class AiDemandForecastService {
  private readonly logger = new Logger(AiDemandForecastService.name);

  // Cache for historical analysis (expires after 1 hour)
  private analysisCache = new Map<string, { analysis: HistoricalAnalysis; timestamp: number }>();
  private readonly CACHE_TTL = 60 * 60 * 1000; // 1 hour

  constructor(private readonly prisma: PrismaService) {}

  // ==================== HISTORICAL ANALYSIS ====================

  /**
   * Analyze historical booking patterns to extract seasonality and trends
   */
  async analyzeHistoricalPatterns(campgroundId: string): Promise<HistoricalAnalysis> {
    // Check cache
    const cached = this.analysisCache.get(campgroundId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.analysis;
    }

    this.logger.log(`Analyzing historical patterns for ${campgroundId}`);

    // Get historical snapshots (up to 2 years)
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const snapshots = await this.prisma.occupancySnapshot.findMany({
      where: {
        campgroundId,
        date: { gte: twoYearsAgo },
      },
      orderBy: { date: "asc" },
    });

    if (snapshots.length < 30) {
      // Not enough data - return defaults
      return this.getDefaultAnalysis();
    }

    // Calculate baseline occupancy
    const occupancies = snapshots.map((s) => s.occupancyPct);
    const baselineOccupancy = occupancies.reduce((a, b) => a + b, 0) / occupancies.length;

    // Calculate variance (standard deviation)
    const squaredDiffs = occupancies.map((o) => Math.pow(o - baselineOccupancy, 2));
    const variance = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / occupancies.length);

    // Analyze seasonality by month
    const monthlyData = new Map<number, number[]>();
    for (const snapshot of snapshots) {
      const month = snapshot.date.getMonth();
      if (!monthlyData.has(month)) {
        monthlyData.set(month, []);
      }
      monthlyData.get(month)!.push(snapshot.occupancyPct);
    }

    const seasonality: SeasonalityPattern[] = [];
    for (let month = 0; month < 12; month++) {
      const monthOccupancies = monthlyData.get(month) || [];
      const avgOccupancy =
        monthOccupancies.length > 0
          ? monthOccupancies.reduce((a, b) => a + b, 0) / monthOccupancies.length
          : baselineOccupancy;
      const factor = baselineOccupancy > 0 ? avgOccupancy / baselineOccupancy : 1;

      seasonality.push({
        month,
        factor,
        isHighSeason: factor > 1.2,
      });
    }

    // Analyze day-of-week patterns
    const dowData = new Map<number, number[]>();
    for (const snapshot of snapshots) {
      const dow = snapshot.date.getDay();
      if (!dowData.has(dow)) {
        dowData.set(dow, []);
      }
      dowData.get(dow)!.push(snapshot.occupancyPct);
    }

    const dayOfWeek: DayOfWeekPattern[] = [];
    for (let dow = 0; dow < 7; dow++) {
      const dowOccupancies = dowData.get(dow) || [];
      const avgOccupancy =
        dowOccupancies.length > 0
          ? dowOccupancies.reduce((a, b) => a + b, 0) / dowOccupancies.length
          : baselineOccupancy;
      const factor = baselineOccupancy > 0 ? avgOccupancy / baselineOccupancy : 1;

      dayOfWeek.push({
        dayOfWeek: dow,
        factor,
        avgOccupancy,
      });
    }

    // Calculate recent trend (last 30 days vs previous 30 days)
    const last30 = snapshots.slice(-30);
    const prev30 = snapshots.slice(-60, -30);
    let recentTrend = 0;

    if (last30.length >= 15 && prev30.length >= 15) {
      const last30Avg = last30.reduce((sum, s) => sum + s.occupancyPct, 0) / last30.length;
      const prev30Avg = prev30.reduce((sum, s) => sum + s.occupancyPct, 0) / prev30.length;

      if (prev30Avg > 0) {
        recentTrend = (last30Avg - prev30Avg) / prev30Avg;
        // Clamp to -1 to 1
        recentTrend = Math.max(-1, Math.min(1, recentTrend));
      }
    }

    const analysis: HistoricalAnalysis = {
      baselineOccupancy,
      seasonality,
      dayOfWeek,
      recentTrend,
      variance,
      dataPoints: snapshots.length,
    };

    // Cache result
    this.analysisCache.set(campgroundId, { analysis, timestamp: Date.now() });

    return analysis;
  }

  /**
   * Default analysis when not enough historical data
   */
  private getDefaultAnalysis(): HistoricalAnalysis {
    // Industry-standard campground seasonality
    const defaultSeasonality: SeasonalityPattern[] = [
      { month: 0, factor: 0.4, isHighSeason: false }, // Jan
      { month: 1, factor: 0.4, isHighSeason: false }, // Feb
      { month: 2, factor: 0.6, isHighSeason: false }, // Mar
      { month: 3, factor: 0.7, isHighSeason: false }, // Apr
      { month: 4, factor: 0.9, isHighSeason: false }, // May
      { month: 5, factor: 1.3, isHighSeason: true }, // Jun
      { month: 6, factor: 1.5, isHighSeason: true }, // Jul
      { month: 7, factor: 1.5, isHighSeason: true }, // Aug
      { month: 8, factor: 1.0, isHighSeason: false }, // Sep
      { month: 9, factor: 0.8, isHighSeason: false }, // Oct
      { month: 10, factor: 0.5, isHighSeason: false }, // Nov
      { month: 11, factor: 0.5, isHighSeason: false }, // Dec
    ];

    // Weekend-heavy pattern typical for campgrounds
    const defaultDow: DayOfWeekPattern[] = [
      { dayOfWeek: 0, factor: 1.1, avgOccupancy: 55 }, // Sun
      { dayOfWeek: 1, factor: 0.7, avgOccupancy: 35 }, // Mon
      { dayOfWeek: 2, factor: 0.6, avgOccupancy: 30 }, // Tue
      { dayOfWeek: 3, factor: 0.6, avgOccupancy: 30 }, // Wed
      { dayOfWeek: 4, factor: 0.7, avgOccupancy: 35 }, // Thu
      { dayOfWeek: 5, factor: 1.2, avgOccupancy: 60 }, // Fri
      { dayOfWeek: 6, factor: 1.4, avgOccupancy: 70 }, // Sat
    ];

    return {
      baselineOccupancy: 50,
      seasonality: defaultSeasonality,
      dayOfWeek: defaultDow,
      recentTrend: 0,
      variance: 15,
      dataPoints: 0,
    };
  }

  // ==================== HOLIDAY DETECTION ====================

  /**
   * Check if a date is near a holiday and get the boost factor
   */
  private getHolidayInfo(date: Date): { isHoliday: boolean; name?: string; boost: number } {
    const month = date.getMonth() + 1; // 1-indexed
    const day = date.getDate();

    for (const holiday of US_HOLIDAYS) {
      // Check if within 3 days of holiday (to capture holiday weekends)
      if (holiday.month === month && Math.abs(holiday.day - day) <= 3) {
        return { isHoliday: true, name: holiday.name, boost: holiday.boost };
      }
    }

    return { isHoliday: false, boost: 0 };
  }

  // ==================== DEMAND FORECASTING ====================

  /**
   * Generate 90-day demand forecast with confidence intervals
   */
  async generateForecast(
    campgroundId: string,
    days: number = 90,
  ): Promise<{
    forecasts: DemandForecast[];
    summary: {
      avgPredictedOccupancy: number;
      totalPredictedRevenue: number;
      highDemandDays: number;
      lowDemandDays: number;
      confidenceScore: number; // 0-100 based on data quality
    };
  }> {
    this.logger.log(`Generating ${days}-day demand forecast for ${campgroundId}`);

    // Get historical analysis
    const analysis = await this.analyzeHistoricalPatterns(campgroundId);

    // Get site count and average rate
    const sites = await this.prisma.site.count({
      where: { campgroundId, isActive: true },
    });

    // Get average nightly rate from recent reservations
    const recentRes = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
        totalAmount: { gt: 0 },
      },
      select: { totalAmount: true, arrivalDate: true, departureDate: true },
      take: 100,
    });

    // Filter reservations with valid dates and calculate average nightly rate
    const validRes = recentRes.filter((r) => {
      const nights = Math.ceil(
        (r.departureDate.getTime() - r.arrivalDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      return nights > 0;
    });

    const avgNightlyRate =
      validRes.length > 0
        ? Math.round(
            validRes.reduce((sum, r) => {
              const nights = Math.ceil(
                (r.departureDate.getTime() - r.arrivalDate.getTime()) / (1000 * 60 * 60 * 24),
              );
              return sum + r.totalAmount / nights;
            }, 0) / validRes.length,
          )
        : 5000; // Default $50/night

    // Get existing reservations for the forecast period
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + days);

    const existingReservations = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        status: { in: ["confirmed", "checked_in", "pending"] },
        arrivalDate: { lte: endDate },
        departureDate: { gt: today },
      },
      select: { siteId: true, arrivalDate: true, departureDate: true },
    });

    // Build a map of existing bookings per date
    const existingByDate = new Map<string, Set<string>>();
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];
      existingByDate.set(dateStr, new Set());
    }

    for (const res of existingReservations) {
      const start = new Date(res.arrivalDate);
      const end = new Date(res.departureDate);
      for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split("T")[0];
        if (existingByDate.has(dateStr)) {
          existingByDate.get(dateStr)!.add(res.siteId);
        }
      }
    }

    // Generate forecasts
    const forecasts: DemandForecast[] = [];
    let totalOccupancy = 0;
    let totalRevenue = 0;
    let highDemandDays = 0;
    let lowDemandDays = 0;

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];

      // Get existing bookings
      const existingBookings = existingByDate.get(dateStr)?.size || 0;
      const existingOccupancy = sites > 0 ? (existingBookings / sites) * 100 : 0;

      // Calculate predicted occupancy
      const forecast = this.calculateDayForecast(
        date,
        analysis,
        existingOccupancy,
        avgNightlyRate,
        sites,
        i, // days from now
      );

      forecasts.push(forecast);

      totalOccupancy += forecast.predictedOccupancy;
      totalRevenue += forecast.predictedRevenue;

      if (forecast.demandLevel === "high" || forecast.demandLevel === "very_high") {
        highDemandDays++;
      } else if (forecast.demandLevel === "low" || forecast.demandLevel === "very_low") {
        lowDemandDays++;
      }
    }

    // Calculate confidence score based on data quality
    let confidenceScore = 50; // Base confidence
    if (analysis.dataPoints >= 365) confidenceScore += 30;
    else if (analysis.dataPoints >= 180) confidenceScore += 20;
    else if (analysis.dataPoints >= 90) confidenceScore += 10;

    if (analysis.variance < 10) confidenceScore += 10;
    else if (analysis.variance < 20) confidenceScore += 5;

    confidenceScore = Math.min(100, confidenceScore);

    return {
      forecasts,
      summary: {
        avgPredictedOccupancy: days > 0 ? totalOccupancy / days : 0,
        totalPredictedRevenue: totalRevenue,
        highDemandDays,
        lowDemandDays,
        confidenceScore,
      },
    };
  }

  /**
   * Calculate forecast for a single day
   */
  private calculateDayForecast(
    date: Date,
    analysis: HistoricalAnalysis,
    existingOccupancy: number,
    avgNightlyRate: number,
    totalSites: number,
    daysFromNow: number,
  ): DemandForecast {
    const factors: DemandFactor[] = [];

    // Start with baseline
    let predictedOccupancy = analysis.baselineOccupancy;

    // Apply seasonality factor
    const monthFactor = analysis.seasonality[date.getMonth()]?.factor || 1;
    predictedOccupancy *= monthFactor;
    if (monthFactor > 1.1) {
      factors.push({
        name: "Seasonal Demand",
        impact: Math.min(1, (monthFactor - 1) * 2),
        description: `${date.toLocaleString("default", { month: "long" })} is typically busy`,
      });
    } else if (monthFactor < 0.9) {
      factors.push({
        name: "Off-Season",
        impact: Math.max(-1, (monthFactor - 1) * 2),
        description: `${date.toLocaleString("default", { month: "long" })} is typically slow`,
      });
    }

    // Apply day-of-week factor
    const dowFactor = analysis.dayOfWeek[date.getDay()]?.factor || 1;
    predictedOccupancy *= dowFactor;
    const isWeekend = date.getDay() === 0 || date.getDay() === 5 || date.getDay() === 6;
    if (isWeekend && dowFactor > 1.1) {
      factors.push({
        name: "Weekend",
        impact: 0.3,
        description: "Weekend demand boost",
      });
    } else if (!isWeekend && dowFactor < 0.9) {
      factors.push({
        name: "Weekday",
        impact: -0.3,
        description: "Weekday typically slower",
      });
    }

    // Apply holiday boost
    const holiday = this.getHolidayInfo(date);
    if (holiday.isHoliday) {
      predictedOccupancy *= 1 + holiday.boost;
      factors.push({
        name: "Holiday",
        impact: holiday.boost,
        description: `${holiday.name} weekend`,
      });
    }

    // Apply recent trend (fading effect over time)
    const trendWeight = Math.max(0, 1 - daysFromNow / 90);
    const trendAdjustment = analysis.recentTrend * trendWeight * 10; // up to 10% adjustment
    predictedOccupancy += trendAdjustment;
    if (Math.abs(analysis.recentTrend) > 0.1) {
      factors.push({
        name: analysis.recentTrend > 0 ? "Upward Trend" : "Downward Trend",
        impact: analysis.recentTrend * trendWeight,
        description: `Recent ${analysis.recentTrend > 0 ? "growth" : "decline"} in bookings`,
      });
    }

    // Blend with existing bookings (more weight as we get closer)
    const bookingWeight = Math.max(0, 1 - daysFromNow / 30);
    predictedOccupancy =
      predictedOccupancy * (1 - bookingWeight) + existingOccupancy * bookingWeight;

    // Ensure existing bookings are the floor
    predictedOccupancy = Math.max(predictedOccupancy, existingOccupancy);

    // Clamp to 0-100
    predictedOccupancy = Math.max(0, Math.min(100, predictedOccupancy));

    // Calculate confidence interval (wider for further dates)
    const baseVariance = analysis.variance;
    const distanceMultiplier = 1 + (daysFromNow / 90) * 0.5; // 50% wider at 90 days
    const interval = baseVariance * distanceMultiplier;

    const confidenceLow = Math.max(existingOccupancy, predictedOccupancy - interval);
    const confidenceHigh = Math.min(100, predictedOccupancy + interval);

    // Determine demand level
    let demandLevel: DemandForecast["demandLevel"];
    if (predictedOccupancy >= 85) demandLevel = "very_high";
    else if (predictedOccupancy >= 70) demandLevel = "high";
    else if (predictedOccupancy >= 45) demandLevel = "moderate";
    else if (predictedOccupancy >= 25) demandLevel = "low";
    else demandLevel = "very_low";

    // Calculate predicted revenue
    const predictedSites = Math.round((predictedOccupancy / 100) * totalSites);
    const predictedRevenue = predictedSites * avgNightlyRate;

    return {
      date: date.toISOString().split("T")[0],
      predictedOccupancy: Math.round(predictedOccupancy * 10) / 10,
      predictedRevenue,
      confidenceLow: Math.round(confidenceLow * 10) / 10,
      confidenceHigh: Math.round(confidenceHigh * 10) / 10,
      demandLevel,
      factors,
      existingBookings: Math.round(existingOccupancy),
    };
  }

  // ==================== DEMAND HEATMAP ====================

  /**
   * Get demand heatmap for calendar visualization
   */
  async getDemandHeatmap(
    campgroundId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DemandHeatmapDay[]> {
    const analysis = await this.analyzeHistoricalPatterns(campgroundId);

    // Get site count
    const sites = await this.prisma.site.count({
      where: { campgroundId, isActive: true },
    });

    // Get existing reservations
    const existingReservations = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        status: { in: ["confirmed", "checked_in", "pending"] },
        arrivalDate: { lte: endDate },
        departureDate: { gt: startDate },
      },
      select: { siteId: true, arrivalDate: true, departureDate: true },
    });

    // Build existing bookings map
    const existingByDate = new Map<string, Set<string>>();
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      existingByDate.set(d.toISOString().split("T")[0], new Set());
    }

    for (const res of existingReservations) {
      const start = new Date(res.arrivalDate);
      const end = new Date(res.departureDate);
      for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split("T")[0];
        if (existingByDate.has(dateStr)) {
          existingByDate.get(dateStr)!.add(res.siteId);
        }
      }
    }

    // Generate heatmap
    const heatmap: DemandHeatmapDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      const daysFromNow = Math.floor((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

      const existingCount = existingByDate.get(dateStr)?.size || 0;
      const existingOccupancy = sites > 0 ? (existingCount / sites) * 100 : 0;

      // Calculate predicted demand
      const monthFactor = analysis.seasonality[d.getMonth()]?.factor || 1;
      const dowFactor = analysis.dayOfWeek[d.getDay()]?.factor || 1;
      const holiday = this.getHolidayInfo(d);

      let demandScore = analysis.baselineOccupancy * monthFactor * dowFactor;
      if (holiday.isHoliday) {
        demandScore *= 1 + holiday.boost;
      }

      // Blend with existing for near-term
      if (daysFromNow <= 30 && daysFromNow >= 0) {
        const weight = 1 - daysFromNow / 30;
        demandScore = demandScore * (1 - weight) + existingOccupancy * weight;
      }

      demandScore = Math.max(existingOccupancy, Math.min(100, demandScore));

      let demandLevel: DemandHeatmapDay["demandLevel"];
      if (demandScore >= 85) demandLevel = "very_high";
      else if (demandScore >= 70) demandLevel = "high";
      else if (demandScore >= 45) demandLevel = "moderate";
      else if (demandScore >= 25) demandLevel = "low";
      else demandLevel = "very_low";

      const isWeekend = d.getDay() === 0 || d.getDay() === 5 || d.getDay() === 6;

      heatmap.push({
        date: dateStr,
        demandScore: Math.round(demandScore),
        demandLevel,
        predictedOccupancy: Math.round(demandScore),
        existingOccupancy: Math.round(existingOccupancy),
        isWeekend,
        isHoliday: holiday.isHoliday,
        holidayName: holiday.name,
      });
    }

    return heatmap;
  }

  // ==================== CRON JOBS ====================

  /**
   * Refresh demand forecasts daily at 2 AM
   */
  @Cron("0 2 * * *")
  async refreshDailyForecasts(): Promise<void> {
    this.logger.log("Refreshing daily demand forecasts...");

    // Clear analysis cache to force recalculation
    this.analysisCache.clear();

    const campgrounds = await this.prisma.campground.findMany({
      where: { aiEnabled: true },
      select: { id: true },
    });

    for (const campground of campgrounds) {
      try {
        // Pre-warm the cache by generating forecast
        await this.generateForecast(campground.id, 90);
        this.logger.log(`Refreshed forecast for campground ${campground.id}`);
      } catch (error) {
        this.logger.error(`Failed to refresh forecast for ${campground.id}: ${error}`);
      }
    }

    this.logger.log(`Refreshed forecasts for ${campgrounds.length} campgrounds`);
  }

  // ==================== INSIGHTS ====================

  /**
   * Get demand insights for upcoming period
   */
  async getDemandInsights(campgroundId: string): Promise<{
    peakDemandPeriods: Array<{
      startDate: string;
      endDate: string;
      avgDemand: number;
      reason: string;
    }>;
    lowDemandPeriods: Array<{
      startDate: string;
      endDate: string;
      avgDemand: number;
      suggestion: string;
    }>;
    upcomingOpportunities: Array<{ date: string; type: string; description: string }>;
  }> {
    const { forecasts } = await this.generateForecast(campgroundId, 90);

    // Find peak periods (3+ consecutive high demand days)
    const peakPeriods: Array<{
      startDate: string;
      endDate: string;
      avgDemand: number;
      reason: string;
    }> = [];
    let peakStart: number | null = null;

    for (let i = 0; i < forecasts.length; i++) {
      const isHigh =
        forecasts[i].demandLevel === "high" || forecasts[i].demandLevel === "very_high";

      if (isHigh && peakStart === null) {
        peakStart = i;
      } else if (!isHigh && peakStart !== null) {
        if (i - peakStart >= 3) {
          const periodForecasts = forecasts.slice(peakStart, i);
          const avgDemand =
            periodForecasts.reduce((s, f) => s + f.predictedOccupancy, 0) / periodForecasts.length;
          const mainFactor = this.getMainFactor(periodForecasts);

          peakPeriods.push({
            startDate: forecasts[peakStart].date,
            endDate: forecasts[i - 1].date,
            avgDemand: Math.round(avgDemand),
            reason: mainFactor,
          });
        }
        peakStart = null;
      }
    }

    // Find low periods (3+ consecutive low demand days)
    const lowPeriods: Array<{
      startDate: string;
      endDate: string;
      avgDemand: number;
      suggestion: string;
    }> = [];
    let lowStart: number | null = null;

    for (let i = 0; i < forecasts.length; i++) {
      const isLow = forecasts[i].demandLevel === "low" || forecasts[i].demandLevel === "very_low";

      if (isLow && lowStart === null) {
        lowStart = i;
      } else if (!isLow && lowStart !== null) {
        if (i - lowStart >= 3) {
          const periodForecasts = forecasts.slice(lowStart, i);
          const avgDemand =
            periodForecasts.reduce((s, f) => s + f.predictedOccupancy, 0) / periodForecasts.length;

          lowPeriods.push({
            startDate: forecasts[lowStart].date,
            endDate: forecasts[i - 1].date,
            avgDemand: Math.round(avgDemand),
            suggestion: "Consider promotions, discounts, or special events to boost occupancy",
          });
        }
        lowStart = null;
      }
    }

    // Find specific opportunities
    const opportunities: Array<{ date: string; type: string; description: string }> = [];

    for (const forecast of forecasts.slice(0, 30)) {
      // Only look at next 30 days
      // High demand with low existing bookings = pricing opportunity
      if (
        (forecast.demandLevel === "high" || forecast.demandLevel === "very_high") &&
        forecast.existingBookings < 50
      ) {
        opportunities.push({
          date: forecast.date,
          type: "pricing",
          description: `High demand expected (${Math.round(forecast.predictedOccupancy)}%) but only ${forecast.existingBookings}% booked - consider premium pricing`,
        });
      }

      // Holiday with moderate demand = marketing opportunity
      const holiday = this.getHolidayInfo(new Date(forecast.date));
      if (holiday.isHoliday && forecast.existingBookings < 60) {
        opportunities.push({
          date: forecast.date,
          type: "marketing",
          description: `${holiday.name} coming up - promote to fill remaining sites`,
        });
      }
    }

    return {
      peakDemandPeriods: peakPeriods.slice(0, 5),
      lowDemandPeriods: lowPeriods.slice(0, 5),
      upcomingOpportunities: opportunities.slice(0, 10),
    };
  }

  /**
   * Get the main contributing factor for a period
   */
  private getMainFactor(forecasts: DemandForecast[]): string {
    const factorCounts = new Map<string, number>();

    for (const forecast of forecasts) {
      for (const factor of forecast.factors) {
        if (factor.impact > 0) {
          factorCounts.set(factor.name, (factorCounts.get(factor.name) || 0) + factor.impact);
        }
      }
    }

    let maxFactor = "Seasonal Demand";
    let maxCount = 0;

    for (const [name, count] of factorCounts) {
      if (count > maxCount) {
        maxCount = count;
        maxFactor = name;
      }
    }

    return maxFactor;
  }
}
