import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { DateRange } from "../platform-analytics.service";

export interface AccommodationOverview {
  totalSites: number;
  activeReservations: number;
  overallOccupancy: number;
  topPerformingType: string;
}

export interface TypeDistribution {
  type: string;
  siteCount: number;
  reservations: number;
  revenue: number;
  occupancyRate: number;
  revenueShare: number;
}

export interface RigTypeBreakdown {
  rigType: string;
  count: number;
  percentage: number;
  averageLength: number;
  averageSpend: number;
}

@Injectable()
export class AccommodationMixService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get overview metrics for dashboard
   */
  async getOverview(dateRange: DateRange): Promise<AccommodationOverview> {
    const { start, end } = dateRange;

    const totalSites = await this.prisma.site.count({
      where: { isActive: true },
    });

    const activeReservations = await this.prisma.reservation.count({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
      },
    });

    // Calculate overall occupancy
    const daysInRange = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const totalAvailableNights = totalSites * daysInRange;

    const reservations = await this.prisma.reservation.findMany({
      where: {
        arrivalDate: { lte: end },
        departureDate: { gte: start },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
      },
      select: { arrivalDate: true, departureDate: true },
    });

    let occupiedNights = 0;
    for (const res of reservations) {
      const resStart = new Date(Math.max(res.arrivalDate.getTime(), start.getTime()));
      const resEnd = new Date(Math.min(res.departureDate.getTime(), end.getTime()));
      const nights = Math.ceil((resEnd.getTime() - resStart.getTime()) / (1000 * 60 * 60 * 24));
      occupiedNights += Math.max(0, nights);
    }

    const overallOccupancy =
      totalAvailableNights > 0 ? (occupiedNights / totalAvailableNights) * 100 : 0;

    // Find top performing type
    const typeDistribution = await this.getTypeDistribution(dateRange);
    const topType = typeDistribution.sort((a, b) => b.revenue - a.revenue)[0];

    return {
      totalSites,
      activeReservations,
      overallOccupancy,
      topPerformingType: topType?.type || "N/A",
    };
  }

  /**
   * Get full accommodation analytics
   */
  async getFullAnalytics(dateRange: DateRange) {
    const [overview, distribution, rigTypes, utilization] = await Promise.all([
      this.getOverview(dateRange),
      this.getTypeDistribution(dateRange),
      this.getRigTypeBreakdown(dateRange),
      this.getUtilizationRates(dateRange),
    ]);

    return {
      overview,
      typeDistribution: distribution,
      rigTypes,
      utilizationByType: utilization,
    };
  }

  /**
   * Get distribution of sites and revenue by accommodation type
   */
  async getTypeDistribution(dateRange: DateRange): Promise<TypeDistribution[]> {
    const { start, end } = dateRange;

    // Get site counts by type
    const siteCounts = await this.prisma.site.groupBy({
      by: ["siteType"],
      where: { isActive: true },
      _count: true,
    });

    // Get reservation data by site type
    const reservations = await this.prisma.reservation.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
      },
      select: {
        totalAmount: true,
        arrivalDate: true,
        departureDate: true,
        Site: { select: { siteType: true } },
      },
    });

    const daysInRange = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    let totalRevenue = 0;

    // Aggregate by type
    const byType: Record<string, { reservations: number; revenue: number; nights: number }> = {};

    for (const res of reservations) {
      const type = res.Site?.siteType || "unknown";
      const nights = Math.ceil(
        (new Date(res.departureDate).getTime() - new Date(res.arrivalDate).getTime()) /
          (1000 * 60 * 60 * 24),
      );

      if (!byType[type]) {
        byType[type] = { reservations: 0, revenue: 0, nights: 0 };
      }

      byType[type].reservations++;
      byType[type].revenue += res.totalAmount || 0;
      byType[type].nights += nights;
      totalRevenue += res.totalAmount || 0;
    }

    // Build result
    return siteCounts
      .map((sc) => {
        const type = sc.siteType;
        const data = byType[type] || { reservations: 0, revenue: 0, nights: 0 };
        const availableNights = sc._count * daysInRange;

        return {
          type,
          siteCount: sc._count,
          reservations: data.reservations,
          revenue: data.revenue,
          occupancyRate: availableNights > 0 ? (data.nights / availableNights) * 100 : 0,
          revenueShare: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }

  /**
   * Get breakdown of RV types (Class A, B, C, Fifth Wheel, etc.)
   */
  async getRigTypeBreakdown(dateRange: DateRange): Promise<RigTypeBreakdown[]> {
    const { start, end } = dateRange;

    // Get reservations with rig type data
    const reservations = await this.prisma.reservation.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
        rigType: { not: null },
      },
      select: {
        rigType: true,
        rigLength: true,
        totalAmount: true,
      },
    });

    // Group by rig type
    const byRigType: Record<
      string,
      { count: number; totalLength: number; totalSpend: number; lengthCount: number }
    > = {};

    for (const res of reservations) {
      const type = res.rigType || "Unknown";

      if (!byRigType[type]) {
        byRigType[type] = { count: 0, totalLength: 0, totalSpend: 0, lengthCount: 0 };
      }

      byRigType[type].count++;
      byRigType[type].totalSpend += res.totalAmount || 0;

      if (res.rigLength) {
        byRigType[type].totalLength += res.rigLength;
        byRigType[type].lengthCount++;
      }
    }

    const totalCount = Object.values(byRigType).reduce((sum, d) => sum + d.count, 0);

    return Object.entries(byRigType)
      .map(([type, data]) => ({
        rigType: type,
        count: data.count,
        percentage: totalCount > 0 ? (data.count / totalCount) * 100 : 0,
        averageLength: data.lengthCount > 0 ? data.totalLength / data.lengthCount : 0,
        averageSpend: data.count > 0 ? data.totalSpend / data.count : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get utilization rates by accommodation type over time
   */
  async getUtilizationRates(dateRange: DateRange) {
    const { start, end } = dateRange;

    // Get all site types
    const siteTypes = await this.prisma.site.groupBy({
      by: ["siteType"],
      where: { isActive: true },
      _count: true,
    });

    // Calculate monthly utilization for each type
    const months: string[] = [];
    const current = new Date(start);
    while (current <= end) {
      months.push(current.toISOString().slice(0, 7));
      current.setMonth(current.getMonth() + 1);
    }

    const utilization: Record<string, Record<string, number>> = {};

    for (const { siteType, _count: siteCount } of siteTypes) {
      utilization[siteType] = {};

      for (const month of months) {
        const monthStart = new Date(`${month}-01`);
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthEnd.getMonth() + 1);

        const daysInMonth = Math.ceil(
          (monthEnd.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24),
        );
        const availableNights = siteCount * daysInMonth;

        const reservations = await this.prisma.reservation.findMany({
          where: {
            Site: { siteType },
            arrivalDate: { lt: monthEnd },
            departureDate: { gt: monthStart },
            status: { in: ["confirmed", "checked_in", "checked_out"] },
          },
          select: { arrivalDate: true, departureDate: true },
        });

        let occupiedNights = 0;
        for (const res of reservations) {
          const resStart = new Date(Math.max(res.arrivalDate.getTime(), monthStart.getTime()));
          const resEnd = new Date(Math.min(res.departureDate.getTime(), monthEnd.getTime()));
          const nights = Math.ceil((resEnd.getTime() - resStart.getTime()) / (1000 * 60 * 60 * 24));
          occupiedNights += Math.max(0, nights);
        }

        utilization[siteType][month] =
          availableNights > 0 ? (occupiedNights / availableNights) * 100 : 0;
      }
    }

    return {
      months,
      byType: utilization,
    };
  }
}
