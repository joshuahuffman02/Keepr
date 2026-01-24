import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { DateRange } from "../platform-analytics.service";

export interface GuestOverview {
  totalGuests: number;
  newGuests: number;
  returningGuests: number;
  returnRate: number;
  averageStaysPerGuest: number;
}

export interface ProgressionData {
  fromType: string;
  toType: string;
  count: number;
  percentage: number;
}

export interface LifetimeValueTier {
  tier: string;
  guestCount: number;
  totalRevenue: number;
  averageLtv: number;
  averageStays: number;
}

@Injectable()
export class GuestJourneyService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get overview metrics for dashboard
   */
  async getOverview(dateRange: DateRange): Promise<GuestOverview> {
    const { start, end } = dateRange;

    // Get all guests with reservations in period
    const guestsWithReservations = await this.prisma.guest.findMany({
      where: {
        Reservation: {
          some: {
            createdAt: { gte: start, lte: end },
          },
        },
      },
      select: {
        id: true,
        createdAt: true,
        _count: { select: { Reservation: true } },
      },
    });

    const totalGuests = guestsWithReservations.length;
    const newGuests = guestsWithReservations.filter(
      (g) => g.createdAt >= start && g.createdAt <= end,
    ).length;
    const returningGuests = guestsWithReservations.filter((g) => g._count.Reservation > 1).length;

    const totalStays = guestsWithReservations.reduce((sum, g) => sum + g._count.Reservation, 0);

    return {
      totalGuests,
      newGuests,
      returningGuests,
      returnRate: totalGuests > 0 ? (returningGuests / totalGuests) * 100 : 0,
      averageStaysPerGuest: totalGuests > 0 ? totalStays / totalGuests : 0,
    };
  }

  /**
   * Get full guest journey analytics
   */
  async getFullAnalytics(dateRange: DateRange) {
    const [overview, progression, ltv, retention] = await Promise.all([
      this.getOverview(dateRange),
      this.getAccommodationProgression(dateRange),
      this.getLifetimeValueAnalysis(dateRange),
      this.getRetentionCohorts(dateRange),
    ]);

    return {
      overview,
      accommodationProgression: progression,
      lifetimeValue: ltv,
      retentionCohorts: retention,
    };
  }

  /**
   * Analyze guest progression through accommodation types
   * Shows % of guests who move from tent → cabin → RV etc.
   */
  async getAccommodationProgression(dateRange: DateRange): Promise<{
    progressions: ProgressionData[];
    upgradeRate: number;
    downgradeRate: number;
  }> {
    const { start, end } = dateRange;

    // Define accommodation hierarchy (lower to higher)
    const hierarchy: Record<string, number> = {
      tent: 1,
      cabin: 2,
      glamping: 3,
      rv: 4,
    };

    // Get guests with multiple reservations
    const guestsWithHistory = await this.prisma.guest.findMany({
      where: {
        Reservation: {
          some: {
            createdAt: { lte: end },
          },
        },
      },
      select: {
        id: true,
        Reservation: {
          where: {
            status: { in: ["confirmed", "checked_in", "checked_out"] },
          },
          select: {
            createdAt: true,
            Site: { select: { siteType: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    // Analyze progressions
    const progressions: Record<string, number> = {};
    let upgradeCount = 0;
    let downgradeCount = 0;
    let totalTransitions = 0;

    for (const guest of guestsWithHistory) {
      const stays = guest.Reservation.filter((r) => r.Site?.siteType);
      if (stays.length < 2) continue;

      for (let i = 1; i < stays.length; i++) {
        const fromType = stays[i - 1].Site!.siteType;
        const toType = stays[i].Site!.siteType;

        if (fromType === toType) continue;

        const key = `${fromType}→${toType}`;
        progressions[key] = (progressions[key] || 0) + 1;
        totalTransitions++;

        const fromLevel = hierarchy[fromType] || 0;
        const toLevel = hierarchy[toType] || 0;

        if (toLevel > fromLevel) upgradeCount++;
        if (toLevel < fromLevel) downgradeCount++;
      }
    }

    return {
      progressions: Object.entries(progressions)
        .map(([key, count]) => {
          const [fromType, toType] = key.split("→");
          return {
            fromType,
            toType,
            count,
            percentage: totalTransitions > 0 ? (count / totalTransitions) * 100 : 0,
          };
        })
        .sort((a, b) => b.count - a.count),
      upgradeRate: totalTransitions > 0 ? (upgradeCount / totalTransitions) * 100 : 0,
      downgradeRate: totalTransitions > 0 ? (downgradeCount / totalTransitions) * 100 : 0,
    };
  }

  /**
   * Analyze guest lifetime value by tier
   */
  async getLifetimeValueAnalysis(dateRange: DateRange): Promise<{
    tiers: LifetimeValueTier[];
    averageLtv: number;
    topPercentileLtv: number;
  }> {
    const { end } = dateRange;

    // Get all guests with their total spend
    const guests = await this.prisma.guest.findMany({
      where: {
        Reservation: {
          some: {
            status: { in: ["confirmed", "checked_in", "checked_out"] },
            createdAt: { lte: end },
          },
        },
      },
      select: {
        id: true,
        Reservation: {
          where: {
            status: { in: ["confirmed", "checked_in", "checked_out"] },
            createdAt: { lte: end },
          },
          select: { totalAmount: true },
        },
      },
    });

    // Calculate LTV for each guest
    const guestLtvs = guests
      .map((g) => ({
        id: g.id,
        ltv: g.Reservation.reduce((sum, r) => sum + (r.totalAmount || 0), 0),
        stayCount: g.Reservation.length,
      }))
      .sort((a, b) => b.ltv - a.ltv);

    if (guestLtvs.length === 0) {
      return {
        tiers: [],
        averageLtv: 0,
        topPercentileLtv: 0,
      };
    }

    // Define LTV tiers
    const tierBoundaries = [100, 500, 1000, 5000, Infinity];
    const tierNames = ["$0-100", "$100-500", "$500-1K", "$1K-5K", "$5K+"];

    const tiers: LifetimeValueTier[] = tierNames.map((name, i) => {
      const lower = i === 0 ? 0 : tierBoundaries[i - 1];
      const upper = tierBoundaries[i];

      const inTier = guestLtvs.filter((g) => g.ltv >= lower && g.ltv < upper);
      const totalRevenue = inTier.reduce((sum, g) => sum + g.ltv, 0);
      const totalStays = inTier.reduce((sum, g) => sum + g.stayCount, 0);

      return {
        tier: name,
        guestCount: inTier.length,
        totalRevenue,
        averageLtv: inTier.length > 0 ? totalRevenue / inTier.length : 0,
        averageStays: inTier.length > 0 ? totalStays / inTier.length : 0,
      };
    });

    const totalLtv = guestLtvs.reduce((sum, g) => sum + g.ltv, 0);
    const top10Index = Math.floor(guestLtvs.length * 0.1);

    return {
      tiers,
      averageLtv: guestLtvs.length > 0 ? totalLtv / guestLtvs.length : 0,
      topPercentileLtv: guestLtvs[top10Index]?.ltv || 0,
    };
  }

  /**
   * Get retention cohorts (monthly signup cohorts and their return rates)
   */
  async getRetentionCohorts(dateRange: DateRange) {
    const { start, end } = dateRange;

    // Get guests grouped by signup month
    const guests = await this.prisma.guest.findMany({
      where: {
        createdAt: { gte: start, lte: end },
      },
      select: {
        id: true,
        createdAt: true,
        Reservation: {
          select: { createdAt: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    // Group by cohort month
    const cohorts: Record<
      string,
      { total: number; returnedMonth1: number; returnedMonth3: number; returnedMonth6: number }
    > = {};

    for (const guest of guests) {
      const cohortMonth = guest.createdAt.toISOString().slice(0, 7);

      if (!cohorts[cohortMonth]) {
        cohorts[cohortMonth] = {
          total: 0,
          returnedMonth1: 0,
          returnedMonth3: 0,
          returnedMonth6: 0,
        };
      }

      cohorts[cohortMonth].total++;

      // Check if they returned within various time windows
      const firstReservation = guest.Reservation[0]?.createdAt;
      if (!firstReservation) continue;

      const subsequentReservations = guest.Reservation.slice(1);
      for (const res of subsequentReservations) {
        const daysSinceFirst = Math.floor(
          (res.createdAt.getTime() - firstReservation.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysSinceFirst <= 30) cohorts[cohortMonth].returnedMonth1++;
        if (daysSinceFirst <= 90) cohorts[cohortMonth].returnedMonth3++;
        if (daysSinceFirst <= 180) cohorts[cohortMonth].returnedMonth6++;
      }
    }

    return Object.entries(cohorts)
      .map(([month, data]) => ({
        cohortMonth: month,
        totalGuests: data.total,
        returnedIn30Days: data.returnedMonth1,
        returnedIn90Days: data.returnedMonth3,
        returnedIn180Days: data.returnedMonth6,
        retention30: data.total > 0 ? (data.returnedMonth1 / data.total) * 100 : 0,
        retention90: data.total > 0 ? (data.returnedMonth3 / data.total) * 100 : 0,
        retention180: data.total > 0 ? (data.returnedMonth6 / data.total) * 100 : 0,
      }))
      .sort((a, b) => a.cohortMonth.localeCompare(b.cohortMonth));
  }
}
