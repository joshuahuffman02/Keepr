import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AnomalyCheckDto } from "./dto/anomaly-check.dto";

export type AnomalyType =
  | "occupancy_drop"
  | "occupancy_spike"
  | "revenue_drop"
  | "revenue_spike"
  | "cancellation_spike"
  | "booking_drop"
  | "payment_failure_spike"
  | "lead_time_change"
  | "adr_change"
  | "system_error";

export interface AnomalyAlert {
  id: string;
  type: AnomalyType;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  detectedAt: Date;
  metric: string;
  currentValue: number;
  expectedValue: number;
  deviation: number; // Percentage deviation from expected
  metadata?: Record<string, unknown>;
}

interface MetricStats {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  count: number;
}

// Z-score thresholds for anomaly detection
const SEVERITY_THRESHOLDS = {
  low: 1.5, // 1.5 standard deviations
  medium: 2.0, // 2.0 standard deviations
  high: 2.5, // 2.5 standard deviations
  critical: 3.0, // 3.0 standard deviations
};

@Injectable()
export class AnomaliesService {
  private readonly logger = new Logger(AnomaliesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Run all anomaly checks for a campground
   */
  async check(dto: AnomalyCheckDto): Promise<AnomalyAlert[]> {
    const alerts: AnomalyAlert[] = [];
    const campgroundId = dto.campgroundId;

    try {
      // Run all checks in parallel
      const [occupancyAlerts, revenueAlerts, cancellationAlerts, bookingAlerts, adrAlerts] =
        await Promise.all([
          this.checkOccupancy(campgroundId),
          this.checkRevenue(campgroundId),
          this.checkCancellations(campgroundId),
          this.checkBookingVolume(campgroundId),
          this.checkADR(campgroundId),
        ]);

      alerts.push(
        ...occupancyAlerts,
        ...revenueAlerts,
        ...cancellationAlerts,
        ...bookingAlerts,
        ...adrAlerts,
      );
    } catch (error) {
      this.logger.error(`Anomaly check failed for ${campgroundId}:`, error);
      alerts.push({
        id: `alert-error-${Date.now()}`,
        type: "system_error",
        severity: "high",
        message: "Anomaly detection system encountered an error",
        detectedAt: new Date(),
        metric: "system",
        currentValue: 0,
        expectedValue: 0,
        deviation: 0,
        metadata: { error: String(error) },
      });
    }

    return alerts;
  }

  /**
   * Check for occupancy anomalies
   */
  private async checkOccupancy(campgroundId: string): Promise<AnomalyAlert[]> {
    const alerts: AnomalyAlert[] = [];

    // Get historical occupancy data (last 90 days)
    const historicalData = await this.getHistoricalOccupancy(campgroundId, 90);
    if (historicalData.length < 14) return alerts; // Need at least 2 weeks of data

    const stats = this.calculateStats(historicalData.slice(0, -7)); // Exclude last week for baseline
    const recentAvg = this.calculateMean(historicalData.slice(-7)); // Last 7 days average

    const zScore = this.calculateZScore(recentAvg, stats.mean, stats.stdDev);
    const deviation = ((recentAvg - stats.mean) / stats.mean) * 100;

    if (Math.abs(zScore) >= SEVERITY_THRESHOLDS.low) {
      const severity = this.getSeverity(Math.abs(zScore));
      const isDropping = zScore < 0;

      alerts.push({
        id: `occupancy-${Date.now()}`,
        type: isDropping ? "occupancy_drop" : "occupancy_spike",
        severity,
        message: isDropping
          ? `Occupancy dropped ${Math.abs(deviation).toFixed(1)}% below historical average`
          : `Occupancy spiked ${deviation.toFixed(1)}% above historical average`,
        detectedAt: new Date(),
        metric: "occupancy_rate",
        currentValue: Math.round(recentAvg * 100) / 100,
        expectedValue: Math.round(stats.mean * 100) / 100,
        deviation: Math.round(deviation * 10) / 10,
        metadata: {
          zScore: Math.round(zScore * 100) / 100,
          historicalStdDev: Math.round(stats.stdDev * 100) / 100,
          daysSampled: historicalData.length,
        },
      });
    }

    return alerts;
  }

  /**
   * Check for revenue anomalies
   */
  private async checkRevenue(campgroundId: string): Promise<AnomalyAlert[]> {
    const alerts: AnomalyAlert[] = [];

    const historicalData = await this.getHistoricalRevenue(campgroundId, 90);
    if (historicalData.length < 14) return alerts;

    const stats = this.calculateStats(historicalData.slice(0, -7));
    const recentSum = historicalData.slice(-7).reduce((a, b) => a + b, 0);
    const historicalWeeklyAvg = stats.mean * 7;

    const deviation = ((recentSum - historicalWeeklyAvg) / historicalWeeklyAvg) * 100;
    const zScore = this.calculateZScore(recentSum / 7, stats.mean, stats.stdDev);

    if (Math.abs(zScore) >= SEVERITY_THRESHOLDS.low) {
      const severity = this.getSeverity(Math.abs(zScore));
      const isDropping = zScore < 0;

      alerts.push({
        id: `revenue-${Date.now()}`,
        type: isDropping ? "revenue_drop" : "revenue_spike",
        severity,
        message: isDropping
          ? `Weekly revenue dropped ${Math.abs(deviation).toFixed(1)}% below average`
          : `Weekly revenue spiked ${deviation.toFixed(1)}% above average`,
        detectedAt: new Date(),
        metric: "weekly_revenue",
        currentValue: Math.round(recentSum),
        expectedValue: Math.round(historicalWeeklyAvg),
        deviation: Math.round(deviation * 10) / 10,
        metadata: {
          zScore: Math.round(zScore * 100) / 100,
          currency: "USD",
        },
      });
    }

    return alerts;
  }

  /**
   * Check for cancellation rate anomalies
   */
  private async checkCancellations(campgroundId: string): Promise<AnomalyAlert[]> {
    const alerts: AnomalyAlert[] = [];

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Get cancellation counts
    const [historicalCancels, recentCancels, historicalTotal, recentTotal] = await Promise.all([
      this.prisma.reservation.count({
        where: {
          campgroundId,
          status: "cancelled",
          updatedAt: { gte: ninetyDaysAgo, lt: sevenDaysAgo },
        },
      }),
      this.prisma.reservation.count({
        where: {
          campgroundId,
          status: "cancelled",
          updatedAt: { gte: sevenDaysAgo },
        },
      }),
      this.prisma.reservation.count({
        where: {
          campgroundId,
          createdAt: { gte: ninetyDaysAgo, lt: sevenDaysAgo },
        },
      }),
      this.prisma.reservation.count({
        where: {
          campgroundId,
          createdAt: { gte: sevenDaysAgo },
        },
      }),
    ]);

    if (historicalTotal < 10 || recentTotal < 3) return alerts;

    const historicalRate = (historicalCancels / historicalTotal) * 100;
    const recentRate = (recentCancels / recentTotal) * 100;
    const deviation = recentRate - historicalRate;

    // Alert if cancellation rate increased by more than 50% relative
    if (recentRate > historicalRate * 1.5 && deviation > 5) {
      alerts.push({
        id: `cancellation-${Date.now()}`,
        type: "cancellation_spike",
        severity: deviation > 20 ? "high" : deviation > 10 ? "medium" : "low",
        message: `Cancellation rate spiked to ${recentRate.toFixed(1)}% (was ${historicalRate.toFixed(1)}%)`,
        detectedAt: new Date(),
        metric: "cancellation_rate",
        currentValue: Math.round(recentRate * 10) / 10,
        expectedValue: Math.round(historicalRate * 10) / 10,
        deviation: Math.round(deviation * 10) / 10,
        metadata: {
          recentCancellations: recentCancels,
          recentTotal,
          historicalCancellations: historicalCancels,
          historicalTotal,
        },
      });
    }

    return alerts;
  }

  /**
   * Check for booking volume anomalies
   */
  private async checkBookingVolume(campgroundId: string): Promise<AnomalyAlert[]> {
    const alerts: AnomalyAlert[] = [];

    const historicalData = await this.getHistoricalBookings(campgroundId, 90);
    if (historicalData.length < 14) return alerts;

    const stats = this.calculateStats(historicalData.slice(0, -7));
    const recentSum = historicalData.slice(-7).reduce((a, b) => a + b, 0);
    const historicalWeeklyAvg = stats.mean * 7;

    if (historicalWeeklyAvg < 1) return alerts; // Too few bookings for analysis

    const deviation = ((recentSum - historicalWeeklyAvg) / historicalWeeklyAvg) * 100;
    const zScore = this.calculateZScore(recentSum / 7, stats.mean, stats.stdDev);

    // Only alert on significant drops (spikes are usually good!)
    if (zScore <= -SEVERITY_THRESHOLDS.low) {
      alerts.push({
        id: `booking-drop-${Date.now()}`,
        type: "booking_drop",
        severity: this.getSeverity(Math.abs(zScore)),
        message: `New bookings dropped ${Math.abs(deviation).toFixed(1)}% this week`,
        detectedAt: new Date(),
        metric: "weekly_bookings",
        currentValue: recentSum,
        expectedValue: Math.round(historicalWeeklyAvg),
        deviation: Math.round(deviation * 10) / 10,
        metadata: { zScore: Math.round(zScore * 100) / 100 },
      });
    }

    return alerts;
  }

  /**
   * Check for ADR (Average Daily Rate) anomalies
   */
  private async checkADR(campgroundId: string): Promise<AnomalyAlert[]> {
    const alerts: AnomalyAlert[] = [];

    const historicalData = await this.getHistoricalADR(campgroundId, 90);
    if (historicalData.length < 14) return alerts;

    const stats = this.calculateStats(historicalData.slice(0, -7));
    const recentAvg = this.calculateMean(historicalData.slice(-7));

    const deviation = ((recentAvg - stats.mean) / stats.mean) * 100;
    const zScore = this.calculateZScore(recentAvg, stats.mean, stats.stdDev);

    if (Math.abs(zScore) >= SEVERITY_THRESHOLDS.medium) {
      const severity = this.getSeverity(Math.abs(zScore));
      const isDropping = zScore < 0;

      alerts.push({
        id: `adr-${Date.now()}`,
        type: "adr_change",
        severity,
        message: isDropping
          ? `ADR dropped ${Math.abs(deviation).toFixed(1)}% below average`
          : `ADR increased ${deviation.toFixed(1)}% above average`,
        detectedAt: new Date(),
        metric: "average_daily_rate",
        currentValue: Math.round(recentAvg),
        expectedValue: Math.round(stats.mean),
        deviation: Math.round(deviation * 10) / 10,
        metadata: {
          zScore: Math.round(zScore * 100) / 100,
          currency: "USD",
        },
      });
    }

    return alerts;
  }

  // ============================================================================
  // Data Retrieval Methods
  // ============================================================================

  private async getHistoricalOccupancy(campgroundId: string, days: number): Promise<number[]> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    // Get total sites
    const totalSites = await this.prisma.site.count({ where: { campgroundId } });
    if (totalSites === 0) return [];

    // Get daily reservation counts
    const results = await this.prisma.$queryRaw<{ date: Date; count: bigint }[]>`
      SELECT DATE(arrival_date) as date, COUNT(DISTINCT site_id) as count
      FROM "Reservation"
      WHERE campground_id = ${campgroundId}
        AND status NOT IN ('cancelled', 'no_show')
        AND arrival_date >= ${startDate}
        AND arrival_date <= ${endDate}
      GROUP BY DATE(arrival_date)
      ORDER BY date
    `;

    return results.map((r) => (Number(r.count) / totalSites) * 100);
  }

  private async getHistoricalRevenue(campgroundId: string, days: number): Promise<number[]> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const results = await this.prisma.$queryRaw<{ date: Date; total: bigint }[]>`
      SELECT DATE(created_at) as date, SUM(total_amount) as total
      FROM "Reservation"
      WHERE campground_id = ${campgroundId}
        AND status NOT IN ('cancelled')
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
      GROUP BY DATE(created_at)
      ORDER BY date
    `;

    return results.map((r) => Number(r.total) / 100); // Convert cents to dollars
  }

  private async getHistoricalBookings(campgroundId: string, days: number): Promise<number[]> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const results = await this.prisma.$queryRaw<{ date: Date; count: bigint }[]>`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM "Reservation"
      WHERE campground_id = ${campgroundId}
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
      GROUP BY DATE(created_at)
      ORDER BY date
    `;

    return results.map((r) => Number(r.count));
  }

  private async getHistoricalADR(campgroundId: string, days: number): Promise<number[]> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const results = await this.prisma.$queryRaw<{ date: Date; adr: number }[]>`
      SELECT DATE(arrival_date) as date,
             AVG(total_amount::float / NULLIF(EXTRACT(DAY FROM (departure_date - arrival_date)), 0)) as adr
      FROM "Reservation"
      WHERE campground_id = ${campgroundId}
        AND status NOT IN ('cancelled')
        AND arrival_date >= ${startDate}
        AND arrival_date <= ${endDate}
        AND departure_date > arrival_date
      GROUP BY DATE(arrival_date)
      HAVING COUNT(*) >= 1
      ORDER BY date
    `;

    return results.map((r) => Number(r.adr) / 100); // Convert cents to dollars
  }

  // ============================================================================
  // Statistical Helpers
  // ============================================================================

  private calculateStats(data: number[]): MetricStats {
    if (data.length === 0) {
      return { mean: 0, stdDev: 0, min: 0, max: 0, count: 0 };
    }

    const mean = this.calculateMean(data);
    const squaredDiffs = data.map((value) => Math.pow(value - mean, 2));
    const avgSquaredDiff = this.calculateMean(squaredDiffs);
    const stdDev = Math.sqrt(avgSquaredDiff);

    return {
      mean,
      stdDev: stdDev || 1, // Avoid division by zero
      min: Math.min(...data),
      max: Math.max(...data),
      count: data.length,
    };
  }

  private calculateMean(data: number[]): number {
    if (data.length === 0) return 0;
    return data.reduce((sum, val) => sum + val, 0) / data.length;
  }

  private calculateZScore(value: number, mean: number, stdDev: number): number {
    if (stdDev === 0) return 0;
    return (value - mean) / stdDev;
  }

  private getSeverity(absZScore: number): "low" | "medium" | "high" | "critical" {
    if (absZScore >= SEVERITY_THRESHOLDS.critical) return "critical";
    if (absZScore >= SEVERITY_THRESHOLDS.high) return "high";
    if (absZScore >= SEVERITY_THRESHOLDS.medium) return "medium";
    return "low";
  }
}
