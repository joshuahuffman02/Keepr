import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { DateRange } from "../platform-analytics.service";

export interface RevenueSummary {
  totalRevenue: number;
  totalReservations: number;
  averageOrderValue: number;
  revenuePerAvailableNight: number;
  yoyGrowth: number | null;
}

export interface RevenueByType {
  type: string;
  revenue: number;
  reservations: number;
  percentage: number;
  adr: number; // Average Daily Rate
}

export interface MonthlyTrend {
  month: string;
  revenue: number;
  reservations: number;
  adr: number;
}

@Injectable()
export class RevenueIntelligenceService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get overview metrics for dashboard
   */
  async getOverview(dateRange: DateRange): Promise<RevenueSummary> {
    const { start, end } = dateRange;

    // Get current period data
    const currentPeriod = await this.prisma.reservation.aggregate({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
      },
      _sum: { totalAmount: true },
      _count: true,
      _avg: { totalAmount: true },
    });

    // Calculate previous period for YoY
    const periodLength = end.getTime() - start.getTime();
    const previousStart = new Date(start.getTime() - periodLength);
    const previousEnd = new Date(end.getTime() - periodLength);

    const previousPeriod = await this.prisma.reservation.aggregate({
      where: {
        createdAt: { gte: previousStart, lte: previousEnd },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
      },
      _sum: { totalAmount: true },
    });

    // Calculate total available nights (sites * days in range)
    const totalSites = await this.prisma.site.count({
      where: { isActive: true },
    });
    const daysInRange = Math.ceil(periodLength / (1000 * 60 * 60 * 24));
    const availableNights = totalSites * daysInRange;

    const totalRevenue = currentPeriod._sum.totalAmount || 0;
    const previousRevenue = previousPeriod._sum.totalAmount || 0;
    const yoyGrowth =
      previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : null;

    return {
      totalRevenue,
      totalReservations: currentPeriod._count,
      averageOrderValue: currentPeriod._avg.totalAmount || 0,
      revenuePerAvailableNight: availableNights > 0 ? totalRevenue / availableNights : 0,
      yoyGrowth,
    };
  }

  /**
   * Get full revenue analytics
   */
  async getFullAnalytics(dateRange: DateRange) {
    const [overview, byType, trends, topCampgrounds] = await Promise.all([
      this.getOverview(dateRange),
      this.getRevenueByAccommodationType(dateRange),
      this.getRevenueTrends(dateRange),
      this.getTopCampgroundsByRevenue(dateRange),
    ]);

    return {
      overview,
      byAccommodationType: byType,
      monthlyTrends: trends,
      topCampgrounds,
    };
  }

  /**
   * Get revenue broken down by accommodation type
   */
  async getRevenueByAccommodationType(dateRange: DateRange): Promise<RevenueByType[]> {
    const { start, end } = dateRange;

    // Get reservations with site type
    const reservations = await this.prisma.reservation.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
      },
      select: {
        totalAmount: true,
        arrivalDate: true,
        departureDate: true,
        Site: {
          select: { siteType: true },
        },
      },
    });

    // Group by site type
    const byType: Record<string, { revenue: number; count: number; totalNights: number }> = {};
    let totalRevenue = 0;

    for (const res of reservations) {
      const type = res.Site?.siteType || "unknown";
      const nights = Math.ceil(
        (new Date(res.departureDate).getTime() - new Date(res.arrivalDate).getTime()) /
          (1000 * 60 * 60 * 24),
      );

      if (!byType[type]) {
        byType[type] = { revenue: 0, count: 0, totalNights: 0 };
      }

      byType[type].revenue += res.totalAmount || 0;
      byType[type].count += 1;
      byType[type].totalNights += nights;
      totalRevenue += res.totalAmount || 0;
    }

    return Object.entries(byType)
      .map(([type, data]) => ({
        type,
        revenue: data.revenue,
        reservations: data.count,
        percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
        adr: data.totalNights > 0 ? data.revenue / data.totalNights : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  /**
   * Get monthly revenue trends
   */
  async getRevenueTrends(dateRange: DateRange): Promise<MonthlyTrend[]> {
    const { start, end } = dateRange;

    const reservations = await this.prisma.reservation.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
      },
      select: {
        totalAmount: true,
        createdAt: true,
        arrivalDate: true,
        departureDate: true,
      },
    });

    // Group by month
    const byMonth: Record<string, { revenue: number; count: number; totalNights: number }> = {};

    for (const res of reservations) {
      const monthKey = res.createdAt.toISOString().slice(0, 7); // YYYY-MM
      const nights = Math.ceil(
        (new Date(res.departureDate).getTime() - new Date(res.arrivalDate).getTime()) /
          (1000 * 60 * 60 * 24),
      );

      if (!byMonth[monthKey]) {
        byMonth[monthKey] = { revenue: 0, count: 0, totalNights: 0 };
      }

      byMonth[monthKey].revenue += res.totalAmount || 0;
      byMonth[monthKey].count += 1;
      byMonth[monthKey].totalNights += nights;
    }

    return Object.entries(byMonth)
      .map(([month, data]) => ({
        month,
        revenue: data.revenue,
        reservations: data.count,
        adr: data.totalNights > 0 ? data.revenue / data.totalNights : 0,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  /**
   * Get top performing campgrounds
   */
  async getTopCampgroundsByRevenue(dateRange: DateRange, limit = 10) {
    const { start, end } = dateRange;

    const results = await this.prisma.reservation.groupBy({
      by: ["campgroundId"],
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
      },
      _sum: { totalAmount: true },
      _count: true,
      orderBy: { _sum: { totalAmount: "desc" } },
      take: limit,
    });

    // Get campground details
    const campgroundIds = results.map((r) => r.campgroundId);
    const campgrounds = await this.prisma.campground.findMany({
      where: { id: { in: campgroundIds } },
      select: { id: true, name: true, city: true, state: true },
    });

    const campgroundMap = new Map(campgrounds.map((c) => [c.id, c]));

    return results.map((r) => ({
      campground: campgroundMap.get(r.campgroundId),
      revenue: r._sum.totalAmount || 0,
      reservations: r._count,
    }));
  }
}
