import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";

interface YieldMetrics {
  // Today's metrics
  todayOccupancy: number; // percentage
  todayRevenue: number; // cents
  todayADR: number; // cents (Average Daily Rate)
  todayRevPAN: number; // cents (Revenue Per Available Night)

  // Period metrics
  periodOccupancy: number;
  periodRevenue: number;
  periodADR: number;
  periodRevPAN: number;
  periodNights: number;

  // Comparison metrics
  yoyChange: {
    occupancy: number; // percentage point change
    revenue: number; // percentage change
    adr: number; // percentage change
  } | null;

  // Forecasts
  next7DaysOccupancy: number;
  next30DaysOccupancy: number;
  forecastRevenue30Days: number;

  // Optimization opportunities
  gapNights: number; // 1-2 night gaps that could be filled
  pendingRecommendations: number;
  potentialRevenue: number; // cents
}

interface OccupancyForecast {
  date: string;
  occupiedSites: number;
  totalSites: number;
  occupancyPct: number;
  projectedRevenue: number;
}

@Injectable()
export class AiYieldService {
  private readonly logger = new Logger(AiYieldService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService
  ) {}

  // ==================== SNAPSHOT POPULATION ====================

  /**
   * Record daily occupancy snapshot for all campgrounds
   * Runs at 11:59 PM daily to capture end-of-day state
   */
  @Cron("59 23 * * *")
  async recordDailySnapshots(): Promise<void> {
    this.logger.log("Recording daily occupancy snapshots...");

    const campgrounds = await this.prisma.campground.findMany({
      where: { aiEnabled: true },
      select: { id: true },
    });

    for (const campground of campgrounds) {
      try {
        await this.recordSnapshot(campground.id, new Date());
      } catch (error) {
        this.logger.error(
          `Failed to record snapshot for campground ${campground.id}: ${error}`
        );
      }
    }

    this.logger.log(`Recorded snapshots for ${campgrounds.length} campgrounds`);
  }

  /**
   * Record occupancy snapshot for a specific date
   */
  async recordSnapshot(campgroundId: string, date: Date): Promise<void> {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    // Get all sites
    const sites = await this.prisma.site.findMany({
      where: { campgroundId, isActive: true },
      select: { id: true },
    });

    const totalSites = sites.length;
    if (totalSites === 0) return;

    // Get reservations for this date
    const reservations = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        status: { in: ["confirmed", "checked_in"] },
        arrivalDate: { lte: targetDate },
        departureDate: { gt: targetDate },
      },
      select: { siteId: true, totalAmountCents: true, nights: true },
    });

    // Get blocked sites
    const blockedSites = await this.prisma.siteBlock.count({
      where: {
        site: { campgroundId },
        startDate: { lte: targetDate },
        endDate: { gt: targetDate },
      },
    });

    const occupied = new Set(reservations.map((r) => r.siteId)).size;
    const blocked = blockedSites;
    const available = totalSites - occupied - blocked;
    const occupancyPct = (occupied / totalSites) * 100;

    // Calculate revenue for this date (pro-rata from reservations)
    const revenueCents = reservations.reduce((sum, r) => {
      const perNight = r.nights > 0 ? Math.round(r.totalAmountCents / r.nights) : 0;
      return sum + perNight;
    }, 0);

    // Upsert snapshot
    await this.prisma.occupancySnapshot.upsert({
      where: {
        campgroundId_date: {
          campgroundId,
          date: targetDate,
        },
      },
      create: {
        campgroundId,
        date: targetDate,
        totalSites,
        occupied,
        blocked,
        available,
        occupancyPct,
        revenueCents,
      },
      update: {
        totalSites,
        occupied,
        blocked,
        available,
        occupancyPct,
        revenueCents,
      },
    });
  }

  /**
   * Backfill historical snapshots (useful for initial setup)
   */
  async backfillSnapshots(
    campgroundId: string,
    days: number = 90
  ): Promise<number> {
    this.logger.log(`Backfilling ${days} days of snapshots for ${campgroundId}`);
    let recorded = 0;

    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      try {
        await this.recordSnapshot(campgroundId, date);
        recorded++;
      } catch (error) {
        this.logger.warn(`Failed to backfill snapshot for ${date}: ${error}`);
      }
    }

    return recorded;
  }

  // ==================== YIELD METRICS ====================

  /**
   * Get comprehensive yield metrics for dashboard
   */
  async getYieldMetrics(
    campgroundId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<YieldMetrics> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = options.startDate || new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const endDate = options.endDate || today;

    // Get today's metrics
    const todayMetrics = await this.getDayMetrics(campgroundId, today);

    // Get period metrics
    const periodMetrics = await this.getPeriodMetrics(campgroundId, startDate, endDate);

    // Get YoY comparison
    const yoyMetrics = await this.getYoyComparison(campgroundId, startDate, endDate);

    // Get forecasts
    const next7Days = await this.forecastOccupancy(campgroundId, 7);
    const next30Days = await this.forecastOccupancy(campgroundId, 30);

    // Get optimization opportunities
    const gapNights = await this.countGapNights(campgroundId);
    const pendingRecs = await this.prisma.aiPricingRecommendation.count({
      where: {
        campgroundId,
        status: "pending",
        expiresAt: { gt: new Date() },
      },
    });

    // Get potential revenue from insights
    const insights = await this.prisma.aiRevenueInsight.findMany({
      where: {
        campgroundId,
        status: { in: ["new", "in_progress"] },
      },
      select: { estimatedValueCents: true },
    });
    const potentialRevenue = insights.reduce(
      (sum, i) => sum + (i.estimatedValueCents || 0),
      0
    );

    return {
      todayOccupancy: todayMetrics.occupancyPct,
      todayRevenue: todayMetrics.revenueCents,
      todayADR: todayMetrics.adr,
      todayRevPAN: todayMetrics.revPAN,

      periodOccupancy: periodMetrics.occupancyPct,
      periodRevenue: periodMetrics.revenueCents,
      periodADR: periodMetrics.adr,
      periodRevPAN: periodMetrics.revPAN,
      periodNights: periodMetrics.nights,

      yoyChange: yoyMetrics,

      next7DaysOccupancy: next7Days.avgOccupancy,
      next30DaysOccupancy: next30Days.avgOccupancy,
      forecastRevenue30Days: next30Days.totalRevenue,

      gapNights,
      pendingRecommendations: pendingRecs,
      potentialRevenue,
    };
  }

  /**
   * Get metrics for a single day
   */
  private async getDayMetrics(
    campgroundId: string,
    date: Date
  ): Promise<{
    occupancyPct: number;
    revenueCents: number;
    adr: number;
    revPAN: number;
  }> {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    // Try to get from snapshot first
    const snapshot = await this.prisma.occupancySnapshot.findUnique({
      where: {
        campgroundId_date: {
          campgroundId,
          date: targetDate,
        },
      },
    });

    if (snapshot) {
      const adr = snapshot.occupied > 0 ? Math.round(snapshot.revenueCents / snapshot.occupied) : 0;
      const revPAN = snapshot.totalSites > 0 ? Math.round(snapshot.revenueCents / snapshot.totalSites) : 0;
      return {
        occupancyPct: snapshot.occupancyPct,
        revenueCents: snapshot.revenueCents,
        adr,
        revPAN,
      };
    }

    // Calculate on the fly if no snapshot
    const sites = await this.prisma.site.count({
      where: { campgroundId, isActive: true },
    });

    const reservations = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        status: { in: ["confirmed", "checked_in"] },
        arrivalDate: { lte: targetDate },
        departureDate: { gt: targetDate },
      },
      select: { siteId: true, totalAmountCents: true, nights: true },
    });

    const occupied = new Set(reservations.map((r) => r.siteId)).size;
    const occupancyPct = sites > 0 ? (occupied / sites) * 100 : 0;
    const revenueCents = reservations.reduce((sum, r) => {
      const perNight = r.nights > 0 ? Math.round(r.totalAmountCents / r.nights) : 0;
      return sum + perNight;
    }, 0);
    const adr = occupied > 0 ? Math.round(revenueCents / occupied) : 0;
    const revPAN = sites > 0 ? Math.round(revenueCents / sites) : 0;

    return { occupancyPct, revenueCents, adr, revPAN };
  }

  /**
   * Get aggregated metrics for a period
   */
  private async getPeriodMetrics(
    campgroundId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    occupancyPct: number;
    revenueCents: number;
    adr: number;
    revPAN: number;
    nights: number;
  }> {
    const snapshots = await this.prisma.occupancySnapshot.findMany({
      where: {
        campgroundId,
        date: { gte: startDate, lte: endDate },
      },
    });

    if (snapshots.length === 0) {
      return { occupancyPct: 0, revenueCents: 0, adr: 0, revPAN: 0, nights: 0 };
    }

    const totalOccupied = snapshots.reduce((sum, s) => sum + s.occupied, 0);
    const totalSites = snapshots.reduce((sum, s) => sum + s.totalSites, 0);
    const totalRevenue = snapshots.reduce((sum, s) => sum + s.revenueCents, 0);

    const occupancyPct = totalSites > 0 ? (totalOccupied / totalSites) * 100 : 0;
    const adr = totalOccupied > 0 ? Math.round(totalRevenue / totalOccupied) : 0;
    const revPAN = totalSites > 0 ? Math.round(totalRevenue / totalSites) : 0;

    return {
      occupancyPct,
      revenueCents: totalRevenue,
      adr,
      revPAN,
      nights: snapshots.length,
    };
  }

  /**
   * Get year-over-year comparison
   */
  private async getYoyComparison(
    campgroundId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    occupancy: number;
    revenue: number;
    adr: number;
  } | null> {
    // Get last year's period
    const lastYearStart = new Date(startDate);
    lastYearStart.setFullYear(lastYearStart.getFullYear() - 1);
    const lastYearEnd = new Date(endDate);
    lastYearEnd.setFullYear(lastYearEnd.getFullYear() - 1);

    const currentMetrics = await this.getPeriodMetrics(campgroundId, startDate, endDate);
    const lastYearMetrics = await this.getPeriodMetrics(campgroundId, lastYearStart, lastYearEnd);

    if (lastYearMetrics.nights === 0) {
      return null; // No YoY data available
    }

    return {
      occupancy: currentMetrics.occupancyPct - lastYearMetrics.occupancyPct,
      revenue:
        lastYearMetrics.revenueCents > 0
          ? ((currentMetrics.revenueCents - lastYearMetrics.revenueCents) /
              lastYearMetrics.revenueCents) *
            100
          : 0,
      adr:
        lastYearMetrics.adr > 0
          ? ((currentMetrics.adr - lastYearMetrics.adr) / lastYearMetrics.adr) * 100
          : 0,
    };
  }

  // ==================== FORECASTING ====================

  /**
   * Forecast occupancy for upcoming days
   */
  async forecastOccupancy(
    campgroundId: string,
    days: number = 30
  ): Promise<{
    forecasts: OccupancyForecast[];
    avgOccupancy: number;
    totalRevenue: number;
  }> {
    const sites = await this.prisma.site.count({
      where: { campgroundId, isActive: true },
    });

    if (sites === 0) {
      return { forecasts: [], avgOccupancy: 0, totalRevenue: 0 };
    }

    const forecasts: OccupancyForecast[] = [];
    let totalOccupancy = 0;
    let totalRevenue = 0;

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      date.setHours(0, 0, 0, 0);

      // Count reservations for this date
      const reservations = await this.prisma.reservation.findMany({
        where: {
          campgroundId,
          status: { in: ["confirmed", "checked_in", "pending"] },
          arrivalDate: { lte: date },
          departureDate: { gt: date },
        },
        select: { siteId: true, totalAmountCents: true, nights: true },
      });

      const occupiedSites = new Set(reservations.map((r) => r.siteId)).size;
      const occupancyPct = (occupiedSites / sites) * 100;
      const projectedRevenue = reservations.reduce((sum, r) => {
        const perNight = r.nights > 0 ? Math.round(r.totalAmountCents / r.nights) : 0;
        return sum + perNight;
      }, 0);

      forecasts.push({
        date: date.toISOString().split("T")[0],
        occupiedSites,
        totalSites: sites,
        occupancyPct,
        projectedRevenue,
      });

      totalOccupancy += occupancyPct;
      totalRevenue += projectedRevenue;
    }

    return {
      forecasts,
      avgOccupancy: days > 0 ? totalOccupancy / days : 0,
      totalRevenue,
    };
  }

  /**
   * Get occupancy trend for charts
   */
  async getOccupancyTrend(
    campgroundId: string,
    days: number = 30
  ): Promise<Array<{ date: string; occupancy: number; revenue: number }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const snapshots = await this.prisma.occupancySnapshot.findMany({
      where: {
        campgroundId,
        date: { gte: startDate },
      },
      orderBy: { date: "asc" },
    });

    return snapshots.map((s) => ({
      date: s.date.toISOString().split("T")[0],
      occupancy: s.occupancyPct,
      revenue: s.revenueCents,
    }));
  }

  // ==================== OPPORTUNITY DETECTION ====================

  /**
   * Count 1-2 night gaps that could be filled
   */
  private async countGapNights(campgroundId: string): Promise<number> {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);

    // Get all reservations in the next 30 days
    const reservations = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        status: { in: ["confirmed", "checked_in"] },
        OR: [
          { arrivalDate: { gte: today, lte: futureDate } },
          { departureDate: { gte: today, lte: futureDate } },
        ],
      },
      select: { siteId: true, arrivalDate: true, departureDate: true },
      orderBy: [{ siteId: "asc" }, { arrivalDate: "asc" }],
    });

    // Group by site and find gaps
    const siteReservations = new Map<string, Array<{ arrival: Date; departure: Date }>>();
    for (const r of reservations) {
      if (!siteReservations.has(r.siteId)) {
        siteReservations.set(r.siteId, []);
      }
      siteReservations.get(r.siteId)!.push({
        arrival: r.arrivalDate,
        departure: r.departureDate,
      });
    }

    let gapNights = 0;
    for (const [, siteRes] of siteReservations) {
      // Sort by arrival
      siteRes.sort((a, b) => a.arrival.getTime() - b.arrival.getTime());

      for (let i = 0; i < siteRes.length - 1; i++) {
        const current = siteRes[i];
        const next = siteRes[i + 1];
        const gapDays = Math.floor(
          (next.arrival.getTime() - current.departure.getTime()) / (24 * 60 * 60 * 1000)
        );

        if (gapDays === 1 || gapDays === 2) {
          gapNights += gapDays;
        }
      }
    }

    return gapNights;
  }

  // ==================== DASHBOARD DATA ====================

  /**
   * Get all data needed for yield dashboard in one call
   */
  async getYieldDashboard(
    campgroundId: string
  ): Promise<{
    metrics: YieldMetrics;
    occupancyTrend: Array<{ date: string; occupancy: number; revenue: number }>;
    forecasts: OccupancyForecast[];
    topRecommendations: any[];
    revenueInsights: any[];
  }> {
    const [metrics, occupancyTrend, forecastData, recommendations, insights] =
      await Promise.all([
        this.getYieldMetrics(campgroundId),
        this.getOccupancyTrend(campgroundId, 30),
        this.forecastOccupancy(campgroundId, 30),
        this.prisma.aiPricingRecommendation.findMany({
          where: {
            campgroundId,
            status: "pending",
            expiresAt: { gt: new Date() },
          },
          orderBy: { estimatedRevenueDelta: "desc" },
          take: 5,
        }),
        this.prisma.aiRevenueInsight.findMany({
          where: {
            campgroundId,
            status: { in: ["new", "in_progress"] },
          },
          orderBy: { priority: "desc" },
          take: 5,
        }),
      ]);

    return {
      metrics,
      occupancyTrend,
      forecasts: forecastData.forecasts,
      topRecommendations: recommendations,
      revenueInsights: insights,
    };
  }

  // ==================== REAL-TIME BROADCASTS ====================

  /**
   * Broadcast updated yield metrics to all connected clients
   * Call this after a reservation change, payment, or manual trigger
   */
  async broadcastYieldMetricsUpdate(
    campgroundId: string,
    triggeredBy: "reservation" | "payment" | "scheduled" | "manual" = "manual"
  ): Promise<void> {
    try {
      const metrics = await this.getYieldMetrics(campgroundId);

      this.realtime.emitYieldMetricsUpdated(campgroundId, {
        todayOccupancy: metrics.todayOccupancy,
        todayRevenue: metrics.todayRevenue,
        todayADR: metrics.todayADR,
        todayRevPAN: metrics.todayRevPAN,
        periodOccupancy: metrics.periodOccupancy,
        periodRevenue: metrics.periodRevenue,
        next7DaysOccupancy: metrics.next7DaysOccupancy,
        next30DaysOccupancy: metrics.next30DaysOccupancy,
        gapNights: metrics.gapNights,
        pendingRecommendations: metrics.pendingRecommendations,
        potentialRevenue: metrics.potentialRevenue,
        triggeredBy,
      });

      this.logger.debug(
        `Broadcast yield metrics update for campground ${campgroundId}, triggered by ${triggeredBy}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to broadcast yield metrics for ${campgroundId}: ${error}`
      );
    }
  }

  /**
   * Broadcast a new pricing recommendation to clients
   */
  async broadcastRecommendation(
    campgroundId: string,
    recommendation: {
      id: string;
      siteClassId?: string;
      dateStart: Date;
      dateEnd: Date;
      currentPrice: number;
      suggestedPrice: number;
      adjustmentPercent: number;
      estimatedRevenueDelta: number;
      confidence: number;
      reason: string;
    }
  ): Promise<void> {
    // Get site class name if available
    let siteClassName: string | undefined;
    if (recommendation.siteClassId) {
      const siteClass = await this.prisma.siteClass.findUnique({
        where: { id: recommendation.siteClassId },
        select: { name: true },
      });
      siteClassName = siteClass?.name;
    }

    this.realtime.emitYieldRecommendationGenerated(campgroundId, {
      recommendationId: recommendation.id,
      siteClassId: recommendation.siteClassId,
      siteClassName,
      dateStart: recommendation.dateStart.toISOString().split("T")[0],
      dateEnd: recommendation.dateEnd.toISOString().split("T")[0],
      currentPrice: recommendation.currentPrice,
      suggestedPrice: recommendation.suggestedPrice,
      adjustmentPercent: recommendation.adjustmentPercent,
      estimatedRevenueDelta: recommendation.estimatedRevenueDelta,
      confidence: recommendation.confidence,
      reason: recommendation.reason,
    });

    this.logger.debug(
      `Broadcast new pricing recommendation for campground ${campgroundId}`
    );
  }

  /**
   * Broadcast updated forecast data to clients
   */
  async broadcastForecastUpdate(campgroundId: string): Promise<void> {
    try {
      const forecast7 = await this.forecastOccupancy(campgroundId, 7);
      const forecast30 = await this.forecastOccupancy(campgroundId, 30);

      this.realtime.emitYieldForecastUpdated(campgroundId, {
        forecasts: forecast30.forecasts,
        avgOccupancy7Days: forecast7.avgOccupancy,
        avgOccupancy30Days: forecast30.avgOccupancy,
        totalProjectedRevenue: forecast30.totalRevenue,
      });

      this.logger.debug(`Broadcast forecast update for campground ${campgroundId}`);
    } catch (error) {
      this.logger.error(
        `Failed to broadcast forecast for ${campgroundId}: ${error}`
      );
    }
  }

  /**
   * Called when a reservation is created/updated/cancelled
   * Triggers yield metrics recalculation and broadcast
   */
  async onReservationChange(
    campgroundId: string,
    changeType: "created" | "updated" | "cancelled"
  ): Promise<void> {
    this.logger.log(
      `Reservation ${changeType} detected for campground ${campgroundId}, updating yield metrics`
    );

    // Broadcast updated metrics
    await this.broadcastYieldMetricsUpdate(campgroundId, "reservation");

    // Also update the forecast since reservation changes affect occupancy projections
    await this.broadcastForecastUpdate(campgroundId);
  }

  /**
   * Called when a payment is received
   * Updates revenue-related metrics
   */
  async onPaymentReceived(campgroundId: string): Promise<void> {
    this.logger.log(
      `Payment received for campground ${campgroundId}, updating yield metrics`
    );

    await this.broadcastYieldMetricsUpdate(campgroundId, "payment");
  }
}
