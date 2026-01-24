import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { DateRange } from "../platform-analytics.service";

export interface LosOverview {
  averageLos: number;
  medianLos: number;
  weeklyStayPercentage: number;
  monthlyStayPercentage: number;
}

export interface LosBucket {
  range: string;
  count: number;
  percentage: number;
  revenue: number;
  revenuePerNight: number;
}

export interface LosByType {
  type: string;
  averageLos: number;
  medianLos: number;
  reservations: number;
}

@Injectable()
export class LengthOfStayService {
  constructor(private prisma: PrismaService) {}

  /**
   * Calculate length of stay from arrival and departure dates
   */
  private calculateLos(arrivalDate: Date, departureDate: Date): number {
    return Math.ceil(
      (new Date(departureDate).getTime() - new Date(arrivalDate).getTime()) / (1000 * 60 * 60 * 24),
    );
  }

  /**
   * Get overview metrics for dashboard
   */
  async getOverview(dateRange: DateRange): Promise<LosOverview> {
    const { start, end } = dateRange;

    const reservations = await this.prisma.reservation.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
      },
      select: {
        arrivalDate: true,
        departureDate: true,
        stayType: true,
      },
    });

    if (reservations.length === 0) {
      return {
        averageLos: 0,
        medianLos: 0,
        weeklyStayPercentage: 0,
        monthlyStayPercentage: 0,
      };
    }

    const lengths = reservations
      .map((r) => this.calculateLos(r.arrivalDate, r.departureDate))
      .sort((a, b) => a - b);

    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const median = lengths[Math.floor(lengths.length / 2)];

    // Weekly = 7+ nights
    const weekly = lengths.filter((l) => l >= 7).length;
    // Monthly = 28+ nights
    const monthly = lengths.filter((l) => l >= 28).length;

    return {
      averageLos: avg,
      medianLos: median,
      weeklyStayPercentage: (weekly / lengths.length) * 100,
      monthlyStayPercentage: (monthly / lengths.length) * 100,
    };
  }

  /**
   * Get full length of stay analytics
   */
  async getFullAnalytics(dateRange: DateRange) {
    const [overview, distribution, byType, trends, seasonality] = await Promise.all([
      this.getOverview(dateRange),
      this.getLosDistribution(dateRange),
      this.getLosByAccommodationType(dateRange),
      this.getLosTrends(dateRange),
      this.getLosSeasonality(dateRange),
    ]);

    return {
      overview,
      distribution,
      byAccommodationType: byType,
      monthlyTrends: trends,
      seasonality,
    };
  }

  /**
   * Get LOS distribution buckets
   */
  async getLosDistribution(dateRange: DateRange): Promise<LosBucket[]> {
    const { start, end } = dateRange;

    const reservations = await this.prisma.reservation.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
      },
      select: {
        arrivalDate: true,
        departureDate: true,
        totalAmount: true,
      },
    });

    if (reservations.length === 0) return [];

    const data = reservations.map((r) => ({
      los: this.calculateLos(r.arrivalDate, r.departureDate),
      amount: r.totalAmount || 0,
    }));

    // Define LOS buckets
    const bucketRanges = [
      { range: "1 night", min: 1, max: 2 },
      { range: "2-3 nights", min: 2, max: 4 },
      { range: "4-6 nights", min: 4, max: 7 },
      { range: "1 week", min: 7, max: 8 },
      { range: "8-13 nights", min: 8, max: 14 },
      { range: "2 weeks", min: 14, max: 15 },
      { range: "15-27 nights", min: 15, max: 28 },
      { range: "Monthly (28+)", min: 28, max: Infinity },
    ];

    return bucketRanges.map(({ range, min, max }) => {
      const inBucket = data.filter((d) => d.los >= min && d.los < max);
      const totalRevenue = inBucket.reduce((sum, d) => sum + d.amount, 0);
      const totalNights = inBucket.reduce((sum, d) => sum + d.los, 0);

      return {
        range,
        count: inBucket.length,
        percentage: (inBucket.length / data.length) * 100,
        revenue: totalRevenue,
        revenuePerNight: totalNights > 0 ? totalRevenue / totalNights : 0,
      };
    });
  }

  /**
   * Get LOS by accommodation type
   */
  async getLosByAccommodationType(dateRange: DateRange): Promise<LosByType[]> {
    const { start, end } = dateRange;

    const reservations = await this.prisma.reservation.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
      },
      select: {
        arrivalDate: true,
        departureDate: true,
        Site: { select: { siteType: true } },
      },
    });

    // Group by site type
    const byType: Record<string, number[]> = {};

    for (const res of reservations) {
      const type = res.Site?.siteType || "unknown";
      const los = this.calculateLos(res.arrivalDate, res.departureDate);

      if (!byType[type]) byType[type] = [];
      byType[type].push(los);
    }

    return Object.entries(byType)
      .map(([type, lengths]) => {
        lengths.sort((a, b) => a - b);
        const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
        const median = lengths[Math.floor(lengths.length / 2)];

        return {
          type,
          averageLos: avg,
          medianLos: median,
          reservations: lengths.length,
        };
      })
      .sort((a, b) => b.averageLos - a.averageLos);
  }

  /**
   * Get LOS trends over time
   */
  async getLosTrends(dateRange: DateRange) {
    const { start, end } = dateRange;

    const reservations = await this.prisma.reservation.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
      },
      select: {
        createdAt: true,
        arrivalDate: true,
        departureDate: true,
      },
    });

    // Group by month
    const byMonth: Record<string, number[]> = {};

    for (const res of reservations) {
      const month = res.createdAt.toISOString().slice(0, 7);
      const los = this.calculateLos(res.arrivalDate, res.departureDate);

      if (!byMonth[month]) byMonth[month] = [];
      byMonth[month].push(los);
    }

    return Object.entries(byMonth)
      .map(([month, lengths]) => ({
        month,
        averageLos: lengths.length > 0 ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0,
        reservations: lengths.length,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  /**
   * Analyze LOS by season/month of stay
   */
  async getLosSeasonality(dateRange: DateRange) {
    const { start, end } = dateRange;

    const reservations = await this.prisma.reservation.findMany({
      where: {
        arrivalDate: { gte: start, lte: end },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
      },
      select: {
        arrivalDate: true,
        departureDate: true,
      },
    });

    // Group by arrival month
    const byArrivalMonth: Record<number, { totalLos: number; count: number }> = {};
    for (let i = 0; i < 12; i++) {
      byArrivalMonth[i] = { totalLos: 0, count: 0 };
    }

    for (const res of reservations) {
      const month = res.arrivalDate.getMonth();
      const los = this.calculateLos(res.arrivalDate, res.departureDate);

      byArrivalMonth[month].totalLos += los;
      byArrivalMonth[month].count++;
    }

    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    return monthNames.map((name, i) => ({
      month: name,
      averageLos:
        byArrivalMonth[i].count > 0 ? byArrivalMonth[i].totalLos / byArrivalMonth[i].count : 0,
      reservations: byArrivalMonth[i].count,
    }));
  }
}
