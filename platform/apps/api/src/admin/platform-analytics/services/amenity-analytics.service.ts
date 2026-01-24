import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { DateRange } from "../platform-analytics.service";

export interface AmenityData {
  amenity: string;
  siteCount: number;
  reservations: number;
  revenue: number;
  averageRate: number;
  occupancyRate: number;
}

export interface HookupAnalysis {
  hookupType: string;
  siteCount: number;
  reservations: number;
  revenue: number;
  averageNightlyRate: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

@Injectable()
export class AmenityAnalyticsService {
  constructor(private prisma: PrismaService) {}

  private getHookupType(site: {
    hookupsPower: boolean;
    hookupsWater: boolean;
    hookupsSewer: boolean;
  }): string {
    const { hookupsPower, hookupsWater, hookupsSewer } = site;
    if (hookupsPower && hookupsWater && hookupsSewer) return "full";
    if (hookupsPower && hookupsWater) return "water_electric";
    if (hookupsPower) return "electric";
    return "none";
  }

  /**
   * Get full amenity analytics
   */
  async getFullAnalytics(dateRange: DateRange) {
    const [topAmenities, hookups, correlation, campgroundAmenities] = await Promise.all([
      this.getTopAmenities(dateRange),
      this.getHookupAnalysis(dateRange),
      this.getAmenityRevenueCorrelation(dateRange),
      this.getCampgroundAmenityAnalysis(dateRange),
    ]);

    return {
      topSiteAmenities: topAmenities,
      hookupAnalysis: hookups,
      revenueCorrelation: correlation,
      campgroundAmenities,
    };
  }

  /**
   * Get most common site amenities and their performance
   */
  async getTopAmenities(dateRange: DateRange): Promise<AmenityData[]> {
    const { start, end } = dateRange;
    const daysInRange = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    // Get all sites with their amenity tags
    const sites = await this.prisma.site.findMany({
      where: { isActive: true },
      select: {
        id: true,
        amenityTags: true,
      },
    });

    // Get reservations with site info
    const reservations = await this.prisma.reservation.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
      },
      select: {
        siteId: true,
        totalAmount: true,
        arrivalDate: true,
        departureDate: true,
      },
    });

    // Build site ID to reservation mapping
    const siteReservations: Record<string, { count: number; revenue: number; nights: number }> = {};
    for (const res of reservations) {
      if (!siteReservations[res.siteId]) {
        siteReservations[res.siteId] = { count: 0, revenue: 0, nights: 0 };
      }
      siteReservations[res.siteId].count++;
      siteReservations[res.siteId].revenue += res.totalAmount || 0;
      const nights = Math.ceil(
        (new Date(res.departureDate).getTime() - new Date(res.arrivalDate).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      siteReservations[res.siteId].nights += nights;
    }

    // Aggregate by amenity
    const byAmenity: Record<
      string,
      { sites: Set<string>; reservations: number; revenue: number; nights: number }
    > = {};

    for (const site of sites) {
      const tags = site.amenityTags || [];
      for (const tag of tags) {
        if (!byAmenity[tag]) {
          byAmenity[tag] = { sites: new Set(), reservations: 0, revenue: 0, nights: 0 };
        }
        byAmenity[tag].sites.add(site.id);

        const siteData = siteReservations[site.id];
        if (siteData) {
          byAmenity[tag].reservations += siteData.count;
          byAmenity[tag].revenue += siteData.revenue;
          byAmenity[tag].nights += siteData.nights;
        }
      }
    }

    return Object.entries(byAmenity)
      .map(([amenity, data]) => {
        const siteCount = data.sites.size;
        const availableNights = siteCount * daysInRange;

        return {
          amenity,
          siteCount,
          reservations: data.reservations,
          revenue: data.revenue,
          averageRate: data.nights > 0 ? data.revenue / data.nights : 0,
          occupancyRate: availableNights > 0 ? (data.nights / availableNights) * 100 : 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20);
  }

  /**
   * Analyze hookup types (full, water/electric, dry camping)
   */
  async getHookupAnalysis(dateRange: DateRange): Promise<HookupAnalysis[]> {
    const { start, end } = dateRange;

    // Get sites grouped by hookup configuration
    const sites = await this.prisma.site.findMany({
      where: { isActive: true },
      select: {
        id: true,
        hookupsPower: true,
        hookupsWater: true,
        hookupsSewer: true,
      },
    });

    // Get reservations
    const reservations = await this.prisma.reservation.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
      },
      select: {
        siteId: true,
        totalAmount: true,
        arrivalDate: true,
        departureDate: true,
      },
    });

    // Build site to hookup mapping
    const siteHookups: Record<string, string> = {};
    for (const site of sites) {
      siteHookups[site.id] = this.getHookupType(site);
    }

    // Group by hookup type
    const byHookup: Record<
      string,
      { sites: Set<string>; reservations: number; revenue: number; nights: number }
    > = {};

    for (const res of reservations) {
      const hookup = siteHookups[res.siteId] || "unknown";

      if (!byHookup[hookup]) {
        byHookup[hookup] = { sites: new Set(), reservations: 0, revenue: 0, nights: 0 };
      }

      byHookup[hookup].sites.add(res.siteId);
      byHookup[hookup].reservations++;
      byHookup[hookup].revenue += res.totalAmount || 0;

      const nights = Math.ceil(
        (new Date(res.departureDate).getTime() - new Date(res.arrivalDate).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      byHookup[hookup].nights += nights;
    }

    // Map hookup codes to friendly names
    const hookupNames: Record<string, string> = {
      full: "Full Hookups (W/E/S)",
      water_electric: "Water & Electric",
      electric: "Electric Only",
      none: "No Hookups (Dry)",
      unknown: "Unknown",
    };

    return Object.entries(byHookup)
      .map(([hookup, data]) => ({
        hookupType: hookupNames[hookup] || hookup,
        siteCount: data.sites.size,
        reservations: data.reservations,
        revenue: data.revenue,
        averageNightlyRate: data.nights > 0 ? data.revenue / data.nights : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  /**
   * Analyze correlation between amenities and revenue/bookings
   */
  async getAmenityRevenueCorrelation(dateRange: DateRange) {
    const { start, end } = dateRange;

    // Get all reservations with site amenities
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
          select: { amenityTags: true },
        },
      },
    });

    // Calculate average revenue per night for sites with/without each amenity
    const amenityImpact: Record<string, { withAmenity: number[]; withoutAmenity: number[] }> = {};

    // First, get all unique amenities
    const allAmenities = new Set<string>();
    for (const res of reservations) {
      for (const tag of res.Site?.amenityTags || []) {
        allAmenities.add(tag);
      }
    }

    // Initialize
    for (const amenity of allAmenities) {
      amenityImpact[amenity] = { withAmenity: [], withoutAmenity: [] };
    }

    // Calculate revenue per night for each reservation
    for (const res of reservations) {
      const nights = Math.ceil(
        (new Date(res.departureDate).getTime() - new Date(res.arrivalDate).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      const ratePerNight = nights > 0 ? (res.totalAmount || 0) / nights : 0;
      const siteAmenities = new Set(res.Site?.amenityTags || []);

      for (const amenity of allAmenities) {
        if (siteAmenities.has(amenity)) {
          amenityImpact[amenity].withAmenity.push(ratePerNight);
        } else {
          amenityImpact[amenity].withoutAmenity.push(ratePerNight);
        }
      }
    }

    // Calculate impact scores
    return Object.entries(amenityImpact)
      .map(([amenity, data]) => {
        const avgWith =
          data.withAmenity.length > 0
            ? data.withAmenity.reduce((a, b) => a + b, 0) / data.withAmenity.length
            : 0;
        const avgWithout =
          data.withoutAmenity.length > 0
            ? data.withoutAmenity.reduce((a, b) => a + b, 0) / data.withoutAmenity.length
            : 0;

        const impact = avgWithout > 0 ? ((avgWith - avgWithout) / avgWithout) * 100 : 0;

        return {
          amenity,
          sitesWithAmenity: data.withAmenity.length,
          sitesWithoutAmenity: data.withoutAmenity.length,
          avgRateWithAmenity: avgWith,
          avgRateWithoutAmenity: avgWithout,
          revenueImpactPercent: impact,
        };
      })
      .filter((a) => a.sitesWithAmenity >= 5) // Only include amenities with enough data
      .sort((a, b) => b.revenueImpactPercent - a.revenueImpactPercent);
  }

  /**
   * Analyze campground-level amenities
   */
  async getCampgroundAmenityAnalysis(dateRange: DateRange) {
    const { start, end } = dateRange;

    // Get campgrounds with their amenities
    const campgrounds = await this.prisma.campground.findMany({
      select: {
        id: true,
        name: true,
        amenitySummary: true,
      },
    });

    // Get revenue by campground
    const revenueBycamp = await this.prisma.reservation.groupBy({
      by: ["campgroundId"],
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
      },
      _sum: { totalAmount: true },
      _count: true,
    });

    const revenueMap = new Map(
      revenueBycamp.map((r) => [
        r.campgroundId,
        { revenue: r._sum.totalAmount || 0, count: r._count },
      ]),
    );

    // Aggregate by amenity
    const byAmenity: Record<
      string,
      { campgrounds: number; totalRevenue: number; totalBookings: number }
    > = {};

    for (const campground of campgrounds) {
      const amenities = isRecord(campground.amenitySummary)
        ? Object.keys(campground.amenitySummary)
        : [];
      const campRevenue = revenueMap.get(campground.id);

      for (const amenity of amenities) {
        if (!byAmenity[amenity]) {
          byAmenity[amenity] = { campgrounds: 0, totalRevenue: 0, totalBookings: 0 };
        }
        byAmenity[amenity].campgrounds++;
        if (campRevenue) {
          byAmenity[amenity].totalRevenue += campRevenue.revenue;
          byAmenity[amenity].totalBookings += campRevenue.count;
        }
      }
    }

    return Object.entries(byAmenity)
      .map(([amenity, data]) => ({
        amenity,
        campgroundCount: data.campgrounds,
        totalRevenue: data.totalRevenue,
        totalBookings: data.totalBookings,
        avgRevenuePerCampground: data.campgrounds > 0 ? data.totalRevenue / data.campgrounds : 0,
      }))
      .sort((a, b) => b.campgroundCount - a.campgroundCount)
      .slice(0, 30);
  }
}
