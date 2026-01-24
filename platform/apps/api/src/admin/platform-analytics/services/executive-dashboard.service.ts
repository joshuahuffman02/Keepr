import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { DateRange } from "../platform-analytics.service";

export interface ExecutiveKpi {
  label: string;
  value: number | string;
  previousValue?: number | string;
  change?: number;
  changeType: "increase" | "decrease" | "neutral";
  format: "currency" | "percentage" | "number" | "score";
  status: "good" | "warning" | "critical" | "neutral";
}

export interface ExecutiveSummary {
  kpis: ExecutiveKpi[];
  alerts: Alert[];
  topPerformers: TopPerformer[];
  needsAttention: NeedsAttention[];
  recentActivity: RecentActivity[];
}

export interface Alert {
  id: string;
  type: "nps" | "revenue" | "occupancy" | "cancellation";
  severity: "warning" | "critical";
  message: string;
  campgroundName?: string;
  value: number;
  threshold: number;
  createdAt: Date;
}

export interface TopPerformer {
  campgroundId: string;
  campgroundName: string;
  metric: string;
  value: number;
  rank: number;
}

export interface NeedsAttention {
  campgroundId: string;
  campgroundName: string;
  issue: string;
  severity: "warning" | "critical";
  metric: number;
  recommendation: string;
}

export interface RecentActivity {
  type: "reservation" | "cancellation" | "nps_response" | "alert";
  description: string;
  campgroundName: string;
  timestamp: Date;
  value?: number;
}

@Injectable()
export class ExecutiveDashboardService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get executive dashboard summary with all KPIs
   */
  async getExecutiveSummary(dateRange: DateRange): Promise<ExecutiveSummary> {
    const [kpis, alerts, topPerformers, needsAttention, recentActivity] = await Promise.all([
      this.getExecutiveKpis(dateRange),
      this.getActiveAlerts(dateRange),
      this.getTopPerformers(dateRange),
      this.getNeedsAttention(dateRange),
      this.getRecentActivity(),
    ]);

    return {
      kpis,
      alerts,
      topPerformers,
      needsAttention,
      recentActivity,
    };
  }

  /**
   * Get executive-level KPIs
   */
  async getExecutiveKpis(dateRange: DateRange): Promise<ExecutiveKpi[]> {
    const { start, end } = dateRange;

    // Calculate previous period for comparison
    const periodLength = end.getTime() - start.getTime();
    const previousStart = new Date(start.getTime() - periodLength);
    const previousEnd = new Date(end.getTime() - periodLength);

    // Fetch all data in parallel
    const [
      currentReservations,
      previousReservations,
      currentNps,
      previousNps,
      totalSites,
      currentCancellations,
      previousCancellations,
    ] = await Promise.all([
      // Current period reservations
      this.prisma.reservation.findMany({
        where: {
          createdAt: { gte: start, lte: end },
          status: { not: "cancelled" },
        },
        select: { totalAmount: true, guestId: true },
      }),
      // Previous period reservations
      this.prisma.reservation.findMany({
        where: {
          createdAt: { gte: previousStart, lte: previousEnd },
          status: { not: "cancelled" },
        },
        select: { totalAmount: true },
      }),
      // Current NPS
      this.prisma.npsResponse.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: { score: true },
      }),
      // Previous NPS
      this.prisma.npsResponse.findMany({
        where: { createdAt: { gte: previousStart, lte: previousEnd } },
        select: { score: true },
      }),
      // Total sites for occupancy calculation
      this.prisma.site.count(),
      // Current cancellations
      this.prisma.reservation.count({
        where: {
          updatedAt: { gte: start, lte: end },
          status: "cancelled",
        },
      }),
      // Previous cancellations
      this.prisma.reservation.count({
        where: {
          updatedAt: { gte: previousStart, lte: previousEnd },
          status: "cancelled",
        },
      }),
    ]);

    // Calculate metrics
    const currentRevenue = currentReservations.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
    const previousRevenue = previousReservations.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
    const revenueChange =
      previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;

    const currentBookings = currentReservations.length;
    const previousBookings = previousReservations.length;
    const bookingsChange =
      previousBookings > 0 ? ((currentBookings - previousBookings) / previousBookings) * 100 : 0;

    const avgBookingValue = currentBookings > 0 ? currentRevenue / currentBookings : 0;
    const prevAvgBookingValue = previousBookings > 0 ? previousRevenue / previousBookings : 0;
    const avgBookingChange =
      prevAvgBookingValue > 0
        ? ((avgBookingValue - prevAvgBookingValue) / prevAvgBookingValue) * 100
        : 0;

    // NPS calculation
    const calculateNps = (responses: { score: number }[]) => {
      if (responses.length === 0) return 0;
      const promoters = responses.filter((r) => r.score >= 9).length;
      const detractors = responses.filter((r) => r.score <= 6).length;
      return Math.round(((promoters - detractors) / responses.length) * 100);
    };

    const currentNpsScore = calculateNps(currentNps);
    const previousNpsScore = calculateNps(previousNps);
    const npsChange = currentNpsScore - previousNpsScore;

    // Unique guests
    const uniqueGuests = new Set(currentReservations.map((r) => r.guestId)).size;

    // Cancellation rate
    const totalBookingAttempts = currentBookings + currentCancellations;
    const cancellationRate =
      totalBookingAttempts > 0 ? (currentCancellations / totalBookingAttempts) * 100 : 0;
    const prevTotalAttempts = previousBookings + previousCancellations;
    const prevCancellationRate =
      prevTotalAttempts > 0 ? (previousCancellations / prevTotalAttempts) * 100 : 0;
    const cancellationChange = cancellationRate - prevCancellationRate;

    return [
      {
        label: "Total Revenue",
        value: currentRevenue,
        previousValue: previousRevenue,
        change: revenueChange,
        changeType: revenueChange >= 0 ? "increase" : "decrease",
        format: "currency",
        status: revenueChange >= 10 ? "good" : revenueChange >= 0 ? "neutral" : "warning",
      },
      {
        label: "Total Reservations",
        value: currentBookings,
        previousValue: previousBookings,
        change: bookingsChange,
        changeType: bookingsChange >= 0 ? "increase" : "decrease",
        format: "number",
        status: bookingsChange >= 5 ? "good" : bookingsChange >= 0 ? "neutral" : "warning",
      },
      {
        label: "NPS Score",
        value: currentNpsScore,
        previousValue: previousNpsScore,
        change: npsChange,
        changeType: npsChange >= 0 ? "increase" : "decrease",
        format: "score",
        status: currentNpsScore >= 50 ? "good" : currentNpsScore >= 30 ? "neutral" : "warning",
      },
      {
        label: "Avg Booking Value",
        value: avgBookingValue,
        previousValue: prevAvgBookingValue,
        change: avgBookingChange,
        changeType: avgBookingChange >= 0 ? "increase" : "decrease",
        format: "currency",
        status: avgBookingChange >= 0 ? "good" : "warning",
      },
      {
        label: "Active Guests",
        value: uniqueGuests,
        format: "number",
        changeType: "neutral",
        status: "neutral",
      },
      {
        label: "Cancellation Rate",
        value: cancellationRate,
        previousValue: prevCancellationRate,
        change: cancellationChange,
        changeType: cancellationChange <= 0 ? "increase" : "decrease", // Lower is better
        format: "percentage",
        status: cancellationRate <= 5 ? "good" : cancellationRate <= 10 ? "neutral" : "warning",
      },
    ];
  }

  /**
   * Get active alerts that need attention
   */
  async getActiveAlerts(dateRange: DateRange): Promise<Alert[]> {
    const { start, end } = dateRange;
    const alerts: Alert[] = [];

    // Check for campgrounds with low NPS
    const npsResponses = await this.prisma.npsResponse.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: {
        score: true,
        campgroundId: true,
        Campground: { select: { name: true } },
      },
    });

    // Group by campground and calculate NPS
    const byCampground: Record<string, { name: string; scores: number[] }> = {};
    for (const r of npsResponses) {
      if (!byCampground[r.campgroundId]) {
        byCampground[r.campgroundId] = { name: r.Campground.name, scores: [] };
      }
      byCampground[r.campgroundId].scores.push(r.score);
    }

    for (const [campgroundId, data] of Object.entries(byCampground)) {
      if (data.scores.length >= 5) {
        const promoters = data.scores.filter((s) => s >= 9).length;
        const detractors = data.scores.filter((s) => s <= 6).length;
        const nps = Math.round(((promoters - detractors) / data.scores.length) * 100);

        if (nps < 0) {
          alerts.push({
            id: `nps-${campgroundId}`,
            type: "nps",
            severity: nps < -20 ? "critical" : "warning",
            message: `${data.name} has negative NPS score`,
            campgroundName: data.name,
            value: nps,
            threshold: 0,
            createdAt: new Date(),
          });
        }
      }
    }

    // Check for high cancellation rates
    const cancellations = await this.prisma.reservation.groupBy({
      by: ["campgroundId"],
      where: {
        updatedAt: { gte: start, lte: end },
        status: "cancelled",
      },
      _count: true,
    });

    for (const c of cancellations) {
      const total = await this.prisma.reservation.count({
        where: {
          campgroundId: c.campgroundId,
          createdAt: { gte: start, lte: end },
        },
      });

      if (total >= 10) {
        const rate = (c._count / total) * 100;
        if (rate > 15) {
          const campground = await this.prisma.campground.findUnique({
            where: { id: c.campgroundId },
            select: { name: true },
          });

          alerts.push({
            id: `cancel-${c.campgroundId}`,
            type: "cancellation",
            severity: rate > 25 ? "critical" : "warning",
            message: `${campground?.name || "Unknown"} has high cancellation rate`,
            campgroundName: campground?.name,
            value: rate,
            threshold: 15,
            createdAt: new Date(),
          });
        }
      }
    }

    return alerts.sort((a, b) => (a.severity === "critical" ? -1 : 1));
  }

  /**
   * Get top performing campgrounds
   */
  async getTopPerformers(dateRange: DateRange): Promise<TopPerformer[]> {
    const { start, end } = dateRange;

    // Get top by revenue
    const revenueByPark = await this.prisma.reservation.groupBy({
      by: ["campgroundId"],
      where: {
        createdAt: { gte: start, lte: end },
        status: { not: "cancelled" },
      },
      _sum: { totalAmount: true },
      orderBy: { _sum: { totalAmount: "desc" } },
      take: 5,
    });

    const performers: TopPerformer[] = [];
    let rank = 1;

    for (const r of revenueByPark) {
      const campground = await this.prisma.campground.findUnique({
        where: { id: r.campgroundId },
        select: { name: true },
      });

      performers.push({
        campgroundId: r.campgroundId,
        campgroundName: campground?.name || "Unknown",
        metric: "Revenue",
        value: r._sum.totalAmount || 0,
        rank: rank++,
      });
    }

    return performers;
  }

  /**
   * Get campgrounds that need attention
   */
  async getNeedsAttention(dateRange: DateRange): Promise<NeedsAttention[]> {
    const { start, end } = dateRange;
    const attention: NeedsAttention[] = [];

    // Find campgrounds with declining performance
    const npsResponses = await this.prisma.npsResponse.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: {
        score: true,
        campgroundId: true,
        Campground: { select: { name: true } },
      },
    });

    const byCampground: Record<string, { name: string; scores: number[] }> = {};
    for (const r of npsResponses) {
      if (!byCampground[r.campgroundId]) {
        byCampground[r.campgroundId] = { name: r.Campground.name, scores: [] };
      }
      byCampground[r.campgroundId].scores.push(r.score);
    }

    for (const [campgroundId, data] of Object.entries(byCampground)) {
      if (data.scores.length >= 5) {
        const promoters = data.scores.filter((s) => s >= 9).length;
        const detractors = data.scores.filter((s) => s <= 6).length;
        const nps = Math.round(((promoters - detractors) / data.scores.length) * 100);

        if (nps < 20) {
          attention.push({
            campgroundId,
            campgroundName: data.name,
            issue: nps < 0 ? "Negative NPS Score" : "Low NPS Score",
            severity: nps < 0 ? "critical" : "warning",
            metric: nps,
            recommendation: "Review recent negative feedback and address common complaints",
          });
        }
      }
    }

    return attention.slice(0, 5);
  }

  /**
   * Get recent activity feed
   */
  async getRecentActivity(): Promise<RecentActivity[]> {
    const activities: RecentActivity[] = [];

    // Recent reservations
    const recentReservations = await this.prisma.reservation.findMany({
      where: { status: { not: "cancelled" } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        totalAmount: true,
        createdAt: true,
        Campground: { select: { name: true } },
      },
    });

    for (const r of recentReservations) {
      activities.push({
        type: "reservation",
        description: `New reservation - $${r.totalAmount?.toFixed(2) || 0}`,
        campgroundName: r.Campground.name,
        timestamp: r.createdAt,
        value: r.totalAmount || 0,
      });
    }

    // Recent NPS responses
    const recentNps = await this.prisma.npsResponse.findMany({
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        score: true,
        createdAt: true,
        Campground: { select: { name: true } },
      },
    });

    for (const n of recentNps) {
      const category = n.score >= 9 ? "Promoter" : n.score >= 7 ? "Passive" : "Detractor";
      activities.push({
        type: "nps_response",
        description: `NPS Response: ${n.score}/10 (${category})`,
        campgroundName: n.Campground.name,
        timestamp: n.createdAt,
        value: n.score,
      });
    }

    return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 10);
  }
}
