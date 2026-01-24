import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { randomUUID } from "crypto";

interface MetricSnapshot {
  campgroundId: string;
  metric: string;
  value: number;
  timestamp: Date;
}

interface AnomalyConfig {
  metric: string;
  type: "booking_drop" | "error_spike" | "abandonment_increase" | "traffic_spike" | "revenue_drop";
  thresholdPercent: number; // Deviation threshold to trigger alert
  minSampleSize: number; // Minimum data points needed
  severity: "info" | "warning" | "critical";
}

/**
 * Anomaly detection service for identifying unusual patterns in analytics data.
 * Uses statistical analysis to detect deviations from expected behavior.
 */
@Injectable()
export class AnomalyDetectionService {
  private readonly logger = new Logger(AnomalyDetectionService.name);
  private readonly isEnabled = (process.env.DISABLE_HEAVY_JOBS ?? "false").toLowerCase() !== "true";

  // Anomaly detection configurations
  private readonly configs: AnomalyConfig[] = [
    {
      metric: "bookings_completed",
      type: "booking_drop",
      thresholdPercent: 40,
      minSampleSize: 7,
      severity: "critical",
    },
    {
      metric: "error_count",
      type: "error_spike",
      thresholdPercent: 100,
      minSampleSize: 7,
      severity: "warning",
    },
    {
      metric: "abandonment_rate",
      type: "abandonment_increase",
      thresholdPercent: 30,
      minSampleSize: 7,
      severity: "warning",
    },
    {
      metric: "page_views",
      type: "traffic_spike",
      thresholdPercent: 200,
      minSampleSize: 7,
      severity: "info",
    },
    {
      metric: "revenue_cents",
      type: "revenue_drop",
      thresholdPercent: 50,
      minSampleSize: 7,
      severity: "critical",
    },
  ];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Run anomaly detection for all campgrounds
   */
  @Cron(CronExpression.EVERY_HOUR)
  async detectAnomalies() {
    if (!this.isEnabled) {
      this.logger.debug("Anomaly detection skipped (DISABLE_HEAVY_JOBS=true)");
      return;
    }

    try {
      // Get all active campgrounds
      const campgrounds = await this.prisma.campground.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
      });

      for (const campground of campgrounds) {
        await this.detectAnomaliesForCampground(campground.id);
      }
    } catch (error) {
      this.logger.error("Anomaly detection failed", error);
    }
  }

  /**
   * Detect anomalies for a specific campground
   */
  async detectAnomaliesForCampground(campgroundId: string) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Get historical data for the past 30 days
    const historicalDays = 30;
    const since = new Date(today);
    since.setDate(since.getDate() - historicalDays);

    // Check each metric
    for (const config of this.configs) {
      try {
        const anomaly = await this.checkMetric(campgroundId, config, since, today);
        if (anomaly) {
          await this.createAnomaly(campgroundId, anomaly);
        }
      } catch (error) {
        this.logger.warn(`Failed to check ${config.metric} for campground ${campgroundId}`, error);
      }
    }
  }

  /**
   * Check a specific metric for anomalies
   */
  private async checkMetric(
    campgroundId: string,
    config: AnomalyConfig,
    since: Date,
    today: Date,
  ): Promise<{
    type: string;
    severity: string;
    metric: string;
    expectedValue: number;
    actualValue: number;
    deviation: number;
  } | null> {
    // Get historical values
    const historical = await this.getMetricHistory(campgroundId, config.metric, since, today);

    if (historical.length < config.minSampleSize) {
      return null; // Not enough data
    }

    // Calculate baseline (average of previous days excluding today)
    const previousDays = historical.slice(0, -1);
    if (previousDays.length === 0) return null;

    const mean = previousDays.reduce((sum, v) => sum + v, 0) / previousDays.length;
    const stdDev = this.calculateStdDev(previousDays, mean);

    // Get today's value
    const todayValue = historical[historical.length - 1] || 0;

    // Calculate deviation
    const deviation = mean > 0 ? ((todayValue - mean) / mean) * 100 : 0;

    // Check if deviation exceeds threshold
    const isAnomaly = this.isAnomalous(config.type, deviation, config.thresholdPercent);

    if (isAnomaly) {
      return {
        type: config.type,
        severity: config.severity,
        metric: config.metric,
        expectedValue: mean,
        actualValue: todayValue,
        deviation,
      };
    }

    return null;
  }

  /**
   * Get historical values for a metric
   */
  private async getMetricHistory(
    campgroundId: string,
    metric: string,
    since: Date,
    until: Date,
  ): Promise<number[]> {
    switch (metric) {
      case "bookings_completed":
        return this.getBookingHistory(campgroundId, since, until);
      case "error_count":
        return this.getErrorHistory(campgroundId, since, until);
      case "abandonment_rate":
        return this.getAbandonmentHistory(campgroundId, since, until);
      case "page_views":
        return this.getPageViewHistory(campgroundId, since, until);
      case "revenue_cents":
        return this.getRevenueHistory(campgroundId, since, until);
      default:
        return [];
    }
  }

  private async getBookingHistory(
    campgroundId: string,
    since: Date,
    until: Date,
  ): Promise<number[]> {
    const rows = await this.prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
      SELECT DATE_TRUNC('day', "occurredAt") as date, COUNT(*)::bigint as count
      FROM "AnalyticsEvent"
      WHERE "campgroundId" = ${campgroundId}
        AND "eventName" = 'reservation_completed'
        AND "occurredAt" >= ${since}
        AND "occurredAt" < ${until}
      GROUP BY DATE_TRUNC('day', "occurredAt")
      ORDER BY date ASC
    `;
    return this.fillDateGaps(rows, since, until);
  }

  private async getErrorHistory(campgroundId: string, since: Date, until: Date): Promise<number[]> {
    const rows = await this.prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
      SELECT DATE_TRUNC('day', "occurredAt") as date, COUNT(*)::bigint as count
      FROM "AnalyticsEvent"
      WHERE "campgroundId" = ${campgroundId}
        AND "eventName" = 'admin_error'
        AND "occurredAt" >= ${since}
        AND "occurredAt" < ${until}
      GROUP BY DATE_TRUNC('day', "occurredAt")
      ORDER BY date ASC
    `;
    return this.fillDateGaps(rows, since, until);
  }

  private async getAbandonmentHistory(
    campgroundId: string,
    since: Date,
    until: Date,
  ): Promise<number[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{ date: Date; starts: bigint; abandons: bigint }>
    >`
      SELECT
        DATE_TRUNC('day', "occurredAt") as date,
        SUM(CASE WHEN "eventName" = 'reservation_start' THEN 1 ELSE 0 END)::bigint as starts,
        SUM(CASE WHEN "eventName" = 'reservation_abandoned' THEN 1 ELSE 0 END)::bigint as abandons
      FROM "AnalyticsEvent"
      WHERE "campgroundId" = ${campgroundId}
        AND "eventName" IN ('reservation_start', 'reservation_abandoned')
        AND "occurredAt" >= ${since}
        AND "occurredAt" < ${until}
      GROUP BY DATE_TRUNC('day', "occurredAt")
      ORDER BY date ASC
    `;

    return rows.map((r) => {
      const starts = Number(r.starts);
      const abandons = Number(r.abandons);
      return starts > 0 ? (abandons / starts) * 100 : 0;
    });
  }

  private async getPageViewHistory(
    campgroundId: string,
    since: Date,
    until: Date,
  ): Promise<number[]> {
    const rows = await this.prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
      SELECT DATE_TRUNC('day', "occurredAt") as date, COUNT(*)::bigint as count
      FROM "AnalyticsEvent"
      WHERE "campgroundId" = ${campgroundId}
        AND "eventName" IN ('page_view', 'admin_page_view')
        AND "occurredAt" >= ${since}
        AND "occurredAt" < ${until}
      GROUP BY DATE_TRUNC('day', "occurredAt")
      ORDER BY date ASC
    `;
    return this.fillDateGaps(rows, since, until);
  }

  private async getRevenueHistory(
    campgroundId: string,
    since: Date,
    until: Date,
  ): Promise<number[]> {
    const rows = await this.prisma.$queryRaw<Array<{ date: Date; total: bigint }>>`
      SELECT DATE_TRUNC('day', "paidAt") as date, SUM("amountCents")::bigint as total
      FROM "Payment"
      WHERE "campgroundId" = ${campgroundId}
        AND "status" = 'succeeded'
        AND "paidAt" >= ${since}
        AND "paidAt" < ${until}
      GROUP BY DATE_TRUNC('day', "paidAt")
      ORDER BY date ASC
    `;
    return rows.map((r) => Number(r.total));
  }

  /**
   * Fill gaps in date series with zeros
   */
  private fillDateGaps(
    rows: Array<{ date: Date; count: bigint }>,
    since: Date,
    until: Date,
  ): number[] {
    const result: number[] = [];
    const valueMap = new Map(
      rows.map((r) => [r.date.toISOString().split("T")[0], Number(r.count)]),
    );

    const current = new Date(since);
    while (current < until) {
      const key = current.toISOString().split("T")[0];
      result.push(valueMap.get(key) || 0);
      current.setDate(current.getDate() + 1);
    }

    return result;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[], mean: number): number {
    if (values.length === 0) return 0;
    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Determine if a deviation is anomalous based on type
   */
  private isAnomalous(type: string, deviation: number, threshold: number): boolean {
    switch (type) {
      case "booking_drop":
      case "revenue_drop":
        // Alert when value drops significantly below expected
        return deviation < -threshold;
      case "error_spike":
      case "traffic_spike":
        // Alert when value spikes significantly above expected
        return deviation > threshold;
      case "abandonment_increase":
        // Alert when abandonment rate increases
        return deviation > threshold;
      default:
        return Math.abs(deviation) > threshold;
    }
  }

  /**
   * Create an anomaly record
   */
  private async createAnomaly(
    campgroundId: string,
    anomaly: {
      type: string;
      severity: string;
      metric: string;
      expectedValue: number;
      actualValue: number;
      deviation: number;
    },
  ) {
    // Check if we already have an unacknowledged anomaly of this type in the last 24 hours
    const recentAnomaly = await this.prisma.analyticsAnomaly.findFirst({
      where: {
        campgroundId,
        anomalyType: anomaly.type,
        acknowledgedAt: null,
        detectedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    if (recentAnomaly) {
      // Update existing anomaly with latest values
      await this.prisma.analyticsAnomaly.update({
        where: { id: recentAnomaly.id },
        data: {
          expectedValue: anomaly.expectedValue,
          actualValue: anomaly.actualValue,
          deviation: anomaly.deviation,
        },
      });
      return;
    }

    // Create new anomaly
    await this.prisma.analyticsAnomaly.create({
      data: {
        id: randomUUID(),
        campgroundId,
        anomalyType: anomaly.type,
        severity: anomaly.severity,
        metric: anomaly.metric,
        expectedValue: anomaly.expectedValue,
        actualValue: anomaly.actualValue,
        deviation: anomaly.deviation,
        metadata: {
          detectedBy: "automated",
          algorithm: "deviation_from_mean",
        },
      },
    });

    this.logger.log(
      `Anomaly detected for campground ${campgroundId}: ${anomaly.type} ` +
        `(${anomaly.metric}: expected ${anomaly.expectedValue.toFixed(2)}, ` +
        `got ${anomaly.actualValue.toFixed(2)}, deviation ${anomaly.deviation.toFixed(1)}%)`,
    );
  }

  /**
   * Get recent anomalies for a campground
   */
  async getAnomalies(campgroundId: string, days = 7, includeAcknowledged = false) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return this.prisma.analyticsAnomaly.findMany({
      where: {
        campgroundId,
        detectedAt: { gte: since },
        ...(includeAcknowledged ? {} : { acknowledgedAt: null }),
      },
      orderBy: { detectedAt: "desc" },
    });
  }

  /**
   * Acknowledge an anomaly
   */
  async acknowledgeAnomaly(anomalyId: string, userId: string, notes?: string) {
    return this.prisma.analyticsAnomaly.update({
      where: { id: anomalyId },
      data: {
        acknowledgedAt: new Date(),
        acknowledgedBy: userId,
        notes,
      },
    });
  }

  /**
   * Get anomaly summary for dashboard
   */
  async getAnomalySummary(campgroundId: string) {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [unacknowledged, last24hCount, last7dCount, bySeverity] = await Promise.all([
      this.prisma.analyticsAnomaly.count({
        where: { campgroundId, acknowledgedAt: null },
      }),
      this.prisma.analyticsAnomaly.count({
        where: { campgroundId, detectedAt: { gte: last24h } },
      }),
      this.prisma.analyticsAnomaly.count({
        where: { campgroundId, detectedAt: { gte: last7d } },
      }),
      this.prisma.analyticsAnomaly.groupBy({
        by: ["severity"],
        where: { campgroundId, acknowledgedAt: null },
        _count: true,
      }),
    ]);

    return {
      unacknowledged,
      last24h: last24hCount,
      last7d: last7dCount,
      bySeverity: Object.fromEntries(bySeverity.map((s) => [s.severity, s._count])),
    };
  }
}
