import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { DateRange } from "../platform-analytics.service";

export interface BookingOverview {
  totalBookings: number;
  averageLeadTime: number;
  cancellationRate: number;
  lastMinutePercentage: number;
}

export interface LeadTimeBucket {
  range: string;
  count: number;
  percentage: number;
  averageOrderValue: number;
}

export interface ChannelData {
  channel: string;
  bookings: number;
  revenue: number;
  percentage: number;
  averageLeadTime: number;
}

@Injectable()
export class BookingBehaviorService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get overview metrics for dashboard
   */
  async getOverview(dateRange: DateRange): Promise<BookingOverview> {
    const { start, end } = dateRange;

    const reservations = await this.prisma.reservation.findMany({
      where: {
        createdAt: { gte: start, lte: end },
      },
      select: {
        status: true,
        leadTimeDays: true,
      },
    });

    const totalBookings = reservations.length;
    const cancelled = reservations.filter((r) => r.status === "cancelled").length;
    const leadTimes = reservations
      .filter((r) => r.leadTimeDays !== null)
      .map((r) => r.leadTimeDays!);

    const avgLeadTime =
      leadTimes.length > 0 ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length : 0;

    // Last minute = less than 3 days lead time
    const lastMinute = leadTimes.filter((lt) => lt < 3).length;

    return {
      totalBookings,
      averageLeadTime: avgLeadTime,
      cancellationRate: totalBookings > 0 ? (cancelled / totalBookings) * 100 : 0,
      lastMinutePercentage: leadTimes.length > 0 ? (lastMinute / leadTimes.length) * 100 : 0,
    };
  }

  /**
   * Get full booking behavior analytics
   */
  async getFullAnalytics(dateRange: DateRange) {
    const [overview, leadTime, channels, cancellations, trends] = await Promise.all([
      this.getOverview(dateRange),
      this.getLeadTimeAnalysis(dateRange),
      this.getChannelAnalysis(dateRange),
      this.getCancellationAnalysis(dateRange),
      this.getBookingTrends(dateRange),
    ]);

    return {
      overview,
      leadTimeAnalysis: leadTime,
      channelBreakdown: channels,
      cancellationAnalysis: cancellations,
      bookingTrends: trends,
    };
  }

  /**
   * Analyze booking lead times (how far in advance people book)
   */
  async getLeadTimeAnalysis(dateRange: DateRange): Promise<{
    average: number;
    median: number;
    buckets: LeadTimeBucket[];
    trends: { month: string; averageLeadTime: number }[];
  }> {
    const { start, end } = dateRange;

    const reservations = await this.prisma.reservation.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
        leadTimeDays: { not: null },
      },
      select: {
        leadTimeDays: true,
        totalAmount: true,
        createdAt: true,
      },
    });

    if (reservations.length === 0) {
      return {
        average: 0,
        median: 0,
        buckets: [],
        trends: [],
      };
    }

    const leadTimes = reservations.map((r) => ({
      days: r.leadTimeDays!,
      amount: r.totalAmount || 0,
      month: r.createdAt.toISOString().slice(0, 7),
    }));

    leadTimes.sort((a, b) => a.days - b.days);

    const avg = leadTimes.reduce((sum, lt) => sum + lt.days, 0) / leadTimes.length;
    const median = leadTimes[Math.floor(leadTimes.length / 2)].days;

    // Lead time buckets
    const bucketRanges = [
      { range: "Same day", min: 0, max: 1 },
      { range: "1-3 days", min: 1, max: 3 },
      { range: "3-7 days", min: 3, max: 7 },
      { range: "1-2 weeks", min: 7, max: 14 },
      { range: "2-4 weeks", min: 14, max: 28 },
      { range: "1-3 months", min: 28, max: 90 },
      { range: "3+ months", min: 90, max: Infinity },
    ];

    const buckets: LeadTimeBucket[] = bucketRanges.map(({ range, min, max }) => {
      const inBucket = leadTimes.filter((lt) => lt.days >= min && lt.days < max);
      const totalAmount = inBucket.reduce((sum, lt) => sum + lt.amount, 0);

      return {
        range,
        count: inBucket.length,
        percentage: (inBucket.length / leadTimes.length) * 100,
        averageOrderValue: inBucket.length > 0 ? totalAmount / inBucket.length : 0,
      };
    });

    // Monthly trends
    const byMonth: Record<string, { total: number; count: number }> = {};
    for (const lt of leadTimes) {
      if (!byMonth[lt.month]) byMonth[lt.month] = { total: 0, count: 0 };
      byMonth[lt.month].total += lt.days;
      byMonth[lt.month].count++;
    }

    const trends = Object.entries(byMonth)
      .map(([month, data]) => ({
        month,
        averageLeadTime: data.count > 0 ? data.total / data.count : 0,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return { average: avg, median, buckets, trends };
  }

  /**
   * Analyze booking channels (direct, OTA, etc.)
   */
  async getChannelAnalysis(dateRange: DateRange): Promise<ChannelData[]> {
    const { start, end } = dateRange;

    const reservations = await this.prisma.reservation.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
      },
      select: {
        source: true,
        totalAmount: true,
        leadTimeDays: true,
      },
    });

    // Group by source/channel
    const byChannel: Record<string, { count: number; revenue: number; leadTimes: number[] }> = {};

    for (const res of reservations) {
      const channel = res.source || "direct";

      if (!byChannel[channel]) {
        byChannel[channel] = { count: 0, revenue: 0, leadTimes: [] };
      }

      byChannel[channel].count++;
      byChannel[channel].revenue += res.totalAmount || 0;
      if (res.leadTimeDays !== null) {
        byChannel[channel].leadTimes.push(res.leadTimeDays);
      }
    }

    const totalBookings = reservations.length;

    return Object.entries(byChannel)
      .map(([channel, data]) => ({
        channel,
        bookings: data.count,
        revenue: data.revenue,
        percentage: totalBookings > 0 ? (data.count / totalBookings) * 100 : 0,
        averageLeadTime:
          data.leadTimes.length > 0
            ? data.leadTimes.reduce((a, b) => a + b, 0) / data.leadTimes.length
            : 0,
      }))
      .sort((a, b) => b.bookings - a.bookings);
  }

  /**
   * Analyze cancellation patterns
   */
  async getCancellationAnalysis(dateRange: DateRange) {
    const { start, end } = dateRange;

    const reservations = await this.prisma.reservation.findMany({
      where: {
        createdAt: { gte: start, lte: end },
      },
      select: {
        status: true,
        totalAmount: true,
        leadTimeDays: true,
        createdAt: true,
        Site: { select: { siteType: true } },
      },
    });

    const total = reservations.length;
    const cancelled = reservations.filter((r) => r.status === "cancelled");

    // Cancellation by accommodation type
    const byType: Record<string, { total: number; cancelled: number }> = {};
    for (const res of reservations) {
      const type = res.Site?.siteType || "unknown";
      if (!byType[type]) byType[type] = { total: 0, cancelled: 0 };
      byType[type].total++;
      if (res.status === "cancelled") byType[type].cancelled++;
    }

    // Cancellation by lead time
    const byLeadTime: Record<string, { total: number; cancelled: number }> = {
      "short (< 7 days)": { total: 0, cancelled: 0 },
      "medium (7-30 days)": { total: 0, cancelled: 0 },
      "long (30+ days)": { total: 0, cancelled: 0 },
    };

    for (const res of reservations) {
      const lt = res.leadTimeDays || 0;
      let bucket: string;
      if (lt < 7) bucket = "short (< 7 days)";
      else if (lt < 30) bucket = "medium (7-30 days)";
      else bucket = "long (30+ days)";

      byLeadTime[bucket].total++;
      if (res.status === "cancelled") byLeadTime[bucket].cancelled++;
    }

    // Monthly cancellation trend
    const byMonth: Record<string, { total: number; cancelled: number }> = {};
    for (const res of reservations) {
      const month = res.createdAt.toISOString().slice(0, 7);
      if (!byMonth[month]) byMonth[month] = { total: 0, cancelled: 0 };
      byMonth[month].total++;
      if (res.status === "cancelled") byMonth[month].cancelled++;
    }

    // Calculate lost revenue
    const lostRevenue = cancelled.reduce((sum, r) => sum + (r.totalAmount || 0), 0);

    return {
      overallRate: total > 0 ? (cancelled.length / total) * 100 : 0,
      totalCancelled: cancelled.length,
      lostRevenue,
      byAccommodationType: Object.entries(byType).map(([type, data]) => ({
        type,
        cancellationRate: data.total > 0 ? (data.cancelled / data.total) * 100 : 0,
        totalBookings: data.total,
        cancelled: data.cancelled,
      })),
      byLeadTime: Object.entries(byLeadTime).map(([bucket, data]) => ({
        bucket,
        cancellationRate: data.total > 0 ? (data.cancelled / data.total) * 100 : 0,
        totalBookings: data.total,
        cancelled: data.cancelled,
      })),
      monthlyTrend: Object.entries(byMonth)
        .map(([month, data]) => ({
          month,
          cancellationRate: data.total > 0 ? (data.cancelled / data.total) * 100 : 0,
          totalBookings: data.total,
          cancelled: data.cancelled,
        }))
        .sort((a, b) => a.month.localeCompare(b.month)),
    };
  }

  /**
   * Get booking volume trends over time
   */
  async getBookingTrends(dateRange: DateRange) {
    const { start, end } = dateRange;

    const reservations = await this.prisma.reservation.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
      },
      select: {
        createdAt: true,
        totalAmount: true,
      },
    });

    // Group by day of week
    const byDayOfWeek: Record<string, { count: number; revenue: number }> = {
      Sunday: { count: 0, revenue: 0 },
      Monday: { count: 0, revenue: 0 },
      Tuesday: { count: 0, revenue: 0 },
      Wednesday: { count: 0, revenue: 0 },
      Thursday: { count: 0, revenue: 0 },
      Friday: { count: 0, revenue: 0 },
      Saturday: { count: 0, revenue: 0 },
    };

    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    // Group by hour of day
    const byHourOfDay: Record<number, { count: number; revenue: number }> = {};
    for (let i = 0; i < 24; i++) {
      byHourOfDay[i] = { count: 0, revenue: 0 };
    }

    for (const res of reservations) {
      const dayName = days[res.createdAt.getDay()];
      byDayOfWeek[dayName].count++;
      byDayOfWeek[dayName].revenue += res.totalAmount || 0;

      const hour = res.createdAt.getHours();
      byHourOfDay[hour].count++;
      byHourOfDay[hour].revenue += res.totalAmount || 0;
    }

    return {
      byDayOfWeek: days.map((day) => ({
        day,
        bookings: byDayOfWeek[day].count,
        revenue: byDayOfWeek[day].revenue,
      })),
      byHourOfDay: Object.entries(byHourOfDay).map(([hour, data]) => ({
        hour: parseInt(hour),
        bookings: data.count,
        revenue: data.revenue,
      })),
    };
  }
}
