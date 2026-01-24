import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface DateRange {
  start: Date;
  end: Date;
}

export interface GuestAnalyticsOverview {
  totalGuests: number;
  newGuestsThisMonth: number;
  newGuestsLastMonth: number;
  repeatGuests: number;
  repeatRate: number;
  avgPartySize: number;
  avgStayLength: number;
  avgLeadTime: number;
}

export interface GeographicData {
  byCountry: { country: string; count: number; percentage: number }[];
  byState: { state: string; country: string; count: number; percentage: number }[];
  topCities: { city: string; state: string; count: number }[];
  snowbirdPatterns: {
    northernStates: number;
    southernDestinations: number;
    avgMigrationMonth: number;
  };
}

export interface DemographicsData {
  partyComposition: {
    adultsOnly: number;
    withChildren: number;
    avgAdults: number;
    avgChildren: number;
  };
  rigTypes: { type: string; count: number; percentage: number }[];
  avgRigLength: number;
  hasPets: number;
  petPercentage: number;
}

export interface SeasonalTrends {
  byMonth: { month: string; reservations: number; revenue: number; avgStayLength: number }[];
  peakSeason: string;
  shoulderSeason: string;
  offSeason: string;
}

export interface TravelBehavior {
  stayReasons: { reason: string; count: number; percentage: number }[];
  bookingSources: { source: string; count: number; percentage: number }[];
  avgBookingWindow: number;
  weekdayVsWeekend: { weekday: number; weekend: number };
}

export interface Insight {
  title: string;
  description: string;
  type: "info" | "warning" | "success";
  metric?: string;
}

@Injectable()
export class GuestAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private getDateRange(range: string): DateRange {
    const now = new Date();
    let start: Date;

    switch (range) {
      case "last_30_days":
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "last_90_days":
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "ytd":
        start = new Date(now.getFullYear(), 0, 1);
        break;
      case "all_time":
        start = new Date(2020, 0, 1);
        break;
      case "last_12_months":
      default:
        start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
    }

    return { start, end: now };
  }

  async getOverview(range: string): Promise<GuestAnalyticsOverview> {
    const { start, end } = this.getDateRange(range);
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Total guests
    const totalGuests = await this.prisma.guest.count({
      where: {
        createdAt: { gte: start, lte: end },
      },
    });

    // New guests this month
    const newGuestsThisMonth = await this.prisma.guest.count({
      where: {
        createdAt: { gte: startOfThisMonth },
      },
    });

    // New guests last month
    const newGuestsLastMonth = await this.prisma.guest.count({
      where: {
        createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
      },
    });

    // Repeat guests (more than 1 reservation)
    const repeatGuests = await this.prisma.guest.count({
      where: {
        createdAt: { gte: start, lte: end },
        repeatStays: { gt: 1 },
      },
    });

    // Average party size and stay length from reservations
    const reservationStats = await this.prisma.reservation.aggregate({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
      },
      _avg: {
        adults: true,
        children: true,
        leadTimeDays: true,
      },
    });

    // Calculate average stay length
    const reservationsWithDates = await this.prisma.reservation.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
      },
      select: {
        arrivalDate: true,
        departureDate: true,
      },
    });

    let totalNights = 0;
    for (const res of reservationsWithDates) {
      const nights = Math.ceil(
        (res.departureDate.getTime() - res.arrivalDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      totalNights += nights;
    }
    const avgStayLength =
      reservationsWithDates.length > 0 ? totalNights / reservationsWithDates.length : 0;

    const avgAdults = reservationStats._avg.adults || 0;
    const avgChildren = reservationStats._avg.children || 0;

    return {
      totalGuests,
      newGuestsThisMonth,
      newGuestsLastMonth,
      repeatGuests,
      repeatRate: totalGuests > 0 ? (repeatGuests / totalGuests) * 100 : 0,
      avgPartySize: avgAdults + avgChildren,
      avgStayLength: Math.round(avgStayLength * 10) / 10,
      avgLeadTime: Math.round(reservationStats._avg.leadTimeDays || 0),
    };
  }

  async getGeographicData(range: string): Promise<GeographicData> {
    const { start, end } = this.getDateRange(range);

    // By country
    const countryData = await this.prisma.guest.groupBy({
      by: ["country"],
      where: {
        createdAt: { gte: start, lte: end },
        country: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    });

    const totalByCountry = countryData.reduce((sum, c) => sum + c._count.id, 0);
    const byCountry = countryData.map((c) => ({
      country: c.country || "Unknown",
      count: c._count.id,
      percentage: totalByCountry > 0 ? Math.round((c._count.id / totalByCountry) * 1000) / 10 : 0,
    }));

    // By state
    const stateData = await this.prisma.guest.groupBy({
      by: ["state", "country"],
      where: {
        createdAt: { gte: start, lte: end },
        state: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    });

    const totalByState = stateData.reduce((sum, s) => sum + s._count.id, 0);
    const byState = stateData.map((s) => ({
      state: s.state || "Unknown",
      country: s.country || "Unknown",
      count: s._count.id,
      percentage: totalByState > 0 ? Math.round((s._count.id / totalByState) * 1000) / 10 : 0,
    }));

    // Top cities
    const cityData = await this.prisma.guest.groupBy({
      by: ["city", "state"],
      where: {
        createdAt: { gte: start, lte: end },
        city: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    });

    const topCities = cityData.map((c) => ({
      city: c.city || "Unknown",
      state: c.state || "Unknown",
      count: c._count.id,
    }));

    // Snowbird patterns - guests from northern states booking in winter months
    const northernStates = ["MI", "OH", "MN", "WI", "IL", "IN", "NY", "PA", "MA"];
    const northernProvinces = ["ON", "QC", "BC", "AB"];

    const snowbirdGuests = await this.prisma.guest.count({
      where: {
        createdAt: { gte: start, lte: end },
        OR: [{ state: { in: northernStates } }, { state: { in: northernProvinces } }],
      },
    });

    // Southern destinations (reservations at TX, AZ, FL campgrounds from northern guests)
    const southernDestinations = await this.prisma.reservation.count({
      where: {
        createdAt: { gte: start, lte: end },
        arrivalDate: {
          gte: new Date(new Date().getFullYear(), 9, 1), // October
          lte: new Date(new Date().getFullYear() + 1, 2, 31), // March
        },
        Guest: {
          OR: [{ state: { in: northernStates } }, { state: { in: northernProvinces } }],
        },
      },
    });

    return {
      byCountry,
      byState,
      topCities,
      snowbirdPatterns: {
        northernStates: snowbirdGuests,
        southernDestinations,
        avgMigrationMonth: 10, // October
      },
    };
  }

  async getDemographics(range: string): Promise<DemographicsData> {
    const { start, end } = this.getDateRange(range);

    // Party composition from reservations
    const adultsOnlyCount = await this.prisma.reservation.count({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
        children: 0,
      },
    });

    const withChildrenCount = await this.prisma.reservation.count({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
        children: { gt: 0 },
      },
    });

    const partyStats = await this.prisma.reservation.aggregate({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
      },
      _avg: {
        adults: true,
        children: true,
      },
    });

    // Rig types from guests
    const rigTypeData = await this.prisma.guest.groupBy({
      by: ["rigType"],
      where: {
        createdAt: { gte: start, lte: end },
        rigType: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    const totalRigs = rigTypeData.reduce((sum, r) => sum + r._count.id, 0);
    const rigTypes = rigTypeData.map((r) => ({
      type: this.formatRigType(r.rigType || "unknown"),
      count: r._count.id,
      percentage: totalRigs > 0 ? Math.round((r._count.id / totalRigs) * 1000) / 10 : 0,
    }));

    // Average rig length
    const rigLengthStats = await this.prisma.guest.aggregate({
      where: {
        createdAt: { gte: start, lte: end },
        rigLength: { gt: 0 },
      },
      _avg: { rigLength: true },
    });

    // Pets - check tags for pet-related entries
    const totalGuests = await this.prisma.guest.count({
      where: { createdAt: { gte: start, lte: end } },
    });

    // This is a simplified check - in reality, you'd track pets more explicitly
    const guestsWithPets = await this.prisma.reservation.count({
      where: {
        createdAt: { gte: start, lte: end },
        // Check if reservation has pet-related fees or tags
        // This would need custom logic based on your data model
      },
    });

    return {
      partyComposition: {
        adultsOnly: adultsOnlyCount,
        withChildren: withChildrenCount,
        avgAdults: Math.round((partyStats._avg.adults || 0) * 10) / 10,
        avgChildren: Math.round((partyStats._avg.children || 0) * 10) / 10,
      },
      rigTypes,
      avgRigLength: Math.round(rigLengthStats._avg.rigLength || 0),
      hasPets: Math.round(totalGuests * 0.35), // Estimated - implement actual tracking
      petPercentage: 35, // Estimated - implement actual tracking
    };
  }

  async getSeasonalTrends(range: string): Promise<SeasonalTrends> {
    const { start, end } = this.getDateRange(range);

    // Get monthly aggregations
    const monthlyData = await this.prisma.$queryRaw<
      {
        month: number;
        year: number;
        count: bigint;
        revenue: bigint | number | null;
        avg_stay: number | null;
      }[]
    >`
            SELECT
                EXTRACT(MONTH FROM "arrivalDate") as month,
                EXTRACT(YEAR FROM "arrivalDate") as year,
                COUNT(*) as count,
                SUM("totalAmount") as revenue,
                AVG(EXTRACT(DAY FROM ("departureDate" - "arrivalDate"))) as avg_stay
            FROM "Reservation"
            WHERE "arrivalDate" >= ${start}
                AND "arrivalDate" <= ${end}
                AND "status" IN ('confirmed', 'checked_in', 'checked_out')
            GROUP BY EXTRACT(MONTH FROM "arrivalDate"), EXTRACT(YEAR FROM "arrivalDate")
            ORDER BY year, month
        `;

    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    // Aggregate by month name (combining years)
    const monthlyAggregates = new Map<
      string,
      { reservations: number; revenue: number; stayLength: number; count: number }
    >();

    for (const row of monthlyData) {
      const monthName = monthNames[Number(row.month) - 1];
      const existing = monthlyAggregates.get(monthName) || {
        reservations: 0,
        revenue: 0,
        stayLength: 0,
        count: 0,
      };
      existing.reservations += Number(row.count);
      existing.revenue += Number(row.revenue ?? 0);
      existing.stayLength += Number(row.avg_stay ?? 0);
      existing.count += 1;
      monthlyAggregates.set(monthName, existing);
    }

    const byMonth = monthNames.map((month) => {
      const data = monthlyAggregates.get(month);
      return {
        month,
        reservations: data?.reservations || 0,
        revenue: Math.round((data?.revenue || 0) / 100), // Convert cents to dollars
        avgStayLength:
          data && data.count > 0 ? Math.round((data.stayLength / data.count) * 10) / 10 : 0,
      };
    });

    return {
      byMonth,
      peakSeason: "June - August",
      shoulderSeason: "April - May, September - October",
      offSeason: "November - March",
    };
  }

  async getTravelBehavior(range: string): Promise<TravelBehavior> {
    const { start, end } = this.getDateRange(range);

    // Stay reasons
    const stayReasonData = await this.prisma.reservation.groupBy({
      by: ["stayReasonPreset"],
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
        stayReasonPreset: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    const totalReasons = stayReasonData.reduce((sum, r) => sum + r._count.id, 0);
    const stayReasons = stayReasonData.map((r) => ({
      reason: this.formatStayReason(r.stayReasonPreset || "other"),
      count: r._count.id,
      percentage: totalReasons > 0 ? Math.round((r._count.id / totalReasons) * 1000) / 10 : 0,
    }));

    // Booking sources
    const sourceData = await this.prisma.reservation.groupBy({
      by: ["source"],
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    const totalSources = sourceData.reduce((sum, s) => sum + s._count.id, 0);
    const bookingSources = sourceData.map((s) => ({
      source: s.source || "Direct",
      count: s._count.id,
      percentage: totalSources > 0 ? Math.round((s._count.id / totalSources) * 1000) / 10 : 0,
    }));

    // Average booking window
    const leadTimeStats = await this.prisma.reservation.aggregate({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
        leadTimeDays: { gt: 0 },
      },
      _avg: { leadTimeDays: true },
    });

    // Weekday vs weekend arrivals
    const weekdayArrivals = await this.prisma.$queryRaw<{ count: bigint }[]>`
            SELECT COUNT(*) as count
            FROM "Reservation"
            WHERE "arrivalDate" >= ${start}
                AND "arrivalDate" <= ${end}
                AND "status" IN ('confirmed', 'checked_in', 'checked_out')
                AND EXTRACT(DOW FROM "arrivalDate") BETWEEN 1 AND 4
        `;

    const weekendArrivals = await this.prisma.$queryRaw<{ count: bigint }[]>`
            SELECT COUNT(*) as count
            FROM "Reservation"
            WHERE "arrivalDate" >= ${start}
                AND "arrivalDate" <= ${end}
                AND "status" IN ('confirmed', 'checked_in', 'checked_out')
                AND EXTRACT(DOW FROM "arrivalDate") IN (0, 5, 6)
        `;

    const weekdayCount = Number(weekdayArrivals[0]?.count || 0);
    const weekendCount = Number(weekendArrivals[0]?.count || 0);
    const totalArrivals = weekdayCount + weekendCount;

    return {
      stayReasons,
      bookingSources,
      avgBookingWindow: Math.round(leadTimeStats._avg.leadTimeDays || 0),
      weekdayVsWeekend: {
        weekday: totalArrivals > 0 ? Math.round((weekdayCount / totalArrivals) * 100) : 50,
        weekend: totalArrivals > 0 ? Math.round((weekendCount / totalArrivals) * 100) : 50,
      },
    };
  }

  async generateInsights(range: string): Promise<Insight[]> {
    const insights: Insight[] = [];
    const { start, end } = this.getDateRange(range);

    // Compare to previous period
    const periodLength = end.getTime() - start.getTime();
    const previousStart = new Date(start.getTime() - periodLength);
    const previousEnd = start;

    // Check repeat guest trend
    const currentRepeat = await this.prisma.guest.count({
      where: {
        createdAt: { gte: start, lte: end },
        repeatStays: { gt: 1 },
      },
    });

    const previousRepeat = await this.prisma.guest.count({
      where: {
        createdAt: { gte: previousStart, lte: previousEnd },
        repeatStays: { gt: 1 },
      },
    });

    if (previousRepeat > 0) {
      const repeatChange = ((currentRepeat - previousRepeat) / previousRepeat) * 100;
      if (repeatChange > 10) {
        insights.push({
          title: "Repeat Guests Growing",
          description: `Repeat guest bookings increased ${Math.round(repeatChange)}% compared to the previous period. Loyalty programs may be working.`,
          type: "success",
          metric: `+${Math.round(repeatChange)}%`,
        });
      } else if (repeatChange < -10) {
        insights.push({
          title: "Repeat Guest Decline",
          description: `Repeat guest bookings decreased ${Math.round(Math.abs(repeatChange))}%. Consider guest retention strategies.`,
          type: "warning",
          metric: `${Math.round(repeatChange)}%`,
        });
      }
    }

    // Check family travel trend
    const currentFamilies = await this.prisma.reservation.count({
      where: {
        createdAt: { gte: start, lte: end },
        children: { gt: 0 },
      },
    });

    const previousFamilies = await this.prisma.reservation.count({
      where: {
        createdAt: { gte: previousStart, lte: previousEnd },
        children: { gt: 0 },
      },
    });

    if (previousFamilies > 0) {
      const familyChange = ((currentFamilies - previousFamilies) / previousFamilies) * 100;
      if (familyChange > 15) {
        insights.push({
          title: "Family Travel Trending Up",
          description: `Reservations with children increased ${Math.round(familyChange)}%. Consider family-focused amenities and activities.`,
          type: "success",
          metric: `+${Math.round(familyChange)}% YoY`,
        });
      }
    }

    // Check Canadian guests (snowbird potential)
    const canadianGuests = await this.prisma.guest.count({
      where: {
        createdAt: { gte: start, lte: end },
        country: { in: ["Canada", "CA", "CAN"] },
      },
    });

    const totalGuests = await this.prisma.guest.count({
      where: { createdAt: { gte: start, lte: end } },
    });

    if (totalGuests > 0 && canadianGuests / totalGuests > 0.1) {
      insights.push({
        title: "Canadian Guest Segment",
        description: `${Math.round((canadianGuests / totalGuests) * 100)}% of guests are from Canada. Consider winter migration patterns and early booking incentives.`,
        type: "info",
        metric: `${Math.round((canadianGuests / totalGuests) * 100)}% Canadian`,
      });
    }

    // Add default insight if none generated
    if (insights.length === 0) {
      insights.push({
        title: "Data Collection Active",
        description:
          "Guest analytics are being collected. Insights will appear as more data becomes available.",
        type: "info",
      });
    }

    return insights;
  }

  async getFullAnalytics(range: string) {
    const [overview, geographic, demographics, seasonalTrends, travelBehavior, insights] =
      await Promise.all([
        this.getOverview(range),
        this.getGeographicData(range),
        this.getDemographics(range),
        this.getSeasonalTrends(range),
        this.getTravelBehavior(range),
        this.generateInsights(range),
      ]);

    return {
      overview,
      geographic,
      demographics,
      seasonalTrends,
      travelBehavior,
      insights,
    };
  }

  private formatRigType(type: string): string {
    const mapping: Record<string, string> = {
      class_a: "Class A Motorhome",
      class_b: "Class B Motorhome",
      class_c: "Class C Motorhome",
      fifth_wheel: "Fifth Wheel",
      travel_trailer: "Travel Trailer",
      pop_up: "Pop-up Camper",
      tent: "Tent",
      van: "Camper Van",
      truck_camper: "Truck Camper",
      cabin: "Cabin/Other",
    };
    return mapping[type.toLowerCase()] || type;
  }

  private formatStayReason(reason: string): string {
    const mapping: Record<string, string> = {
      vacation: "Vacation",
      family_visit: "Family Visit",
      event: "Event/Festival",
      work_remote: "Remote Work",
      stopover: "Stopover/Transit",
      relocation: "Relocation",
      other: "Other",
    };
    return mapping[reason.toLowerCase()] || reason;
  }
}
