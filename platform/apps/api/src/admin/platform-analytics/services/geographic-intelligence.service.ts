import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { DateRange } from "../platform-analytics.service";

export interface GeographicOverview {
  topOriginState: string;
  averageTravelDistance: number;
  uniqueStates: number;
  internationalPercentage: number;
}

export interface StateData {
  state: string;
  country: string;
  guestCount: number;
  reservations: number;
  revenue: number;
  averageDistance: number;
}

export interface DistanceBucket {
  range: string;
  count: number;
  percentage: number;
  averageSpend: number;
}

@Injectable()
export class GeographicIntelligenceService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get overview metrics for dashboard
   */
  async getOverview(dateRange: DateRange): Promise<GeographicOverview> {
    const { start, end } = dateRange;

    // Get guests with reservations in period
    const guestsWithLocation = await this.prisma.guest.findMany({
      where: {
        Reservation: {
          some: {
            createdAt: { gte: start, lte: end },
            status: { in: ["confirmed", "checked_in", "checked_out"] },
          },
        },
      },
      select: {
        state: true,
        country: true,
        city: true,
      },
    });

    // Count by state
    const stateCounts: Record<string, number> = {};
    let international = 0;
    const uniqueStates = new Set<string>();

    for (const guest of guestsWithLocation) {
      if (
        guest.country &&
        guest.country !== "US" &&
        guest.country !== "USA" &&
        guest.country !== "United States"
      ) {
        international++;
      }

      if (guest.state) {
        stateCounts[guest.state] = (stateCounts[guest.state] || 0) + 1;
        uniqueStates.add(guest.state);
      }
    }

    const topState = Object.entries(stateCounts).sort((a, b) => b[1] - a[1])[0];

    // Calculate average travel distance (simplified - based on state-level data)
    const distances = await this.getTravelDistanceAnalysis(dateRange);
    const avgDistance = distances.averageDistance;

    return {
      topOriginState: topState?.[0] || "N/A",
      averageTravelDistance: avgDistance,
      uniqueStates: uniqueStates.size,
      internationalPercentage:
        guestsWithLocation.length > 0 ? (international / guestsWithLocation.length) * 100 : 0,
    };
  }

  /**
   * Get full geographic analytics
   */
  async getFullAnalytics(dateRange: DateRange) {
    const [overview, heatmap, distance, regional] = await Promise.all([
      this.getOverview(dateRange),
      this.getOriginHeatmap(dateRange),
      this.getTravelDistanceAnalysis(dateRange),
      this.getRegionalTrends(dateRange),
    ]);

    return {
      overview,
      originHeatmap: heatmap,
      travelDistance: distance,
      regionalTrends: regional,
    };
  }

  /**
   * Get origin heatmap data (guests by state)
   */
  async getOriginHeatmap(dateRange: DateRange): Promise<StateData[]> {
    const { start, end } = dateRange;

    // Get reservations with guest location data
    const reservations = await this.prisma.reservation.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
      },
      select: {
        totalAmount: true,
        Guest: {
          select: { state: true, country: true, city: true },
        },
        Campground: {
          select: { latitude: true, longitude: true, state: true },
        },
      },
    });

    // Group by state
    const byState: Record<
      string,
      { guests: Set<string>; reservations: number; revenue: number; distances: number[] }
    > = {};

    for (const res of reservations) {
      const state = res.Guest?.state || "Unknown";
      const country = res.Guest?.country || "US";

      if (!byState[state]) {
        byState[state] = { guests: new Set(), reservations: 0, revenue: 0, distances: [] };
      }

      // Use guest state as unique identifier for deduplication
      byState[state].guests.add(`${state}-${res.Guest?.city || ""}`);
      byState[state].reservations++;
      byState[state].revenue += res.totalAmount || 0;

      // Estimate distance if we have coordinates
      if (res.Campground?.latitude && res.Campground?.longitude && res.Guest?.state) {
        const stateCenter = this.getStateCenterCoordinates(res.Guest.state);
        if (stateCenter) {
          const campgroundLat = res.Campground.latitude.toNumber();
          const campgroundLng = res.Campground.longitude.toNumber();
          const distance = this.calculateDistance(
            stateCenter.lat,
            stateCenter.lng,
            campgroundLat,
            campgroundLng,
          );
          byState[state].distances.push(distance);
        }
      }
    }

    return Object.entries(byState)
      .map(([state, data]) => ({
        state,
        country: "US", // Simplified
        guestCount: data.guests.size,
        reservations: data.reservations,
        revenue: data.revenue,
        averageDistance:
          data.distances.length > 0
            ? data.distances.reduce((a, b) => a + b, 0) / data.distances.length
            : 0,
      }))
      .sort((a, b) => b.guestCount - a.guestCount);
  }

  /**
   * Analyze travel distances
   */
  async getTravelDistanceAnalysis(dateRange: DateRange): Promise<{
    averageDistance: number;
    medianDistance: number;
    buckets: DistanceBucket[];
  }> {
    const { start, end } = dateRange;

    const reservations = await this.prisma.reservation.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
      },
      select: {
        totalAmount: true,
        Guest: { select: { state: true, city: true } },
        Campground: { select: { latitude: true, longitude: true } },
      },
    });

    const distances: { distance: number; spend: number }[] = [];

    for (const res of reservations) {
      if (res.Campground?.latitude && res.Campground?.longitude && res.Guest?.state) {
        const stateCenter = this.getStateCenterCoordinates(res.Guest.state);
        if (stateCenter) {
          const campgroundLat = res.Campground.latitude.toNumber();
          const campgroundLng = res.Campground.longitude.toNumber();
          const distance = this.calculateDistance(
            stateCenter.lat,
            stateCenter.lng,
            campgroundLat,
            campgroundLng,
          );
          distances.push({ distance, spend: res.totalAmount || 0 });
        }
      }
    }

    if (distances.length === 0) {
      return {
        averageDistance: 0,
        medianDistance: 0,
        buckets: [],
      };
    }

    distances.sort((a, b) => a.distance - b.distance);

    const avg = distances.reduce((sum, d) => sum + d.distance, 0) / distances.length;
    const median = distances[Math.floor(distances.length / 2)].distance;

    // Create distance buckets
    const bucketRanges = [
      { range: "0-50 miles", min: 0, max: 50 },
      { range: "50-100 miles", min: 50, max: 100 },
      { range: "100-250 miles", min: 100, max: 250 },
      { range: "250-500 miles", min: 250, max: 500 },
      { range: "500+ miles", min: 500, max: Infinity },
    ];

    const buckets: DistanceBucket[] = bucketRanges.map(({ range, min, max }) => {
      const inBucket = distances.filter((d) => d.distance >= min && d.distance < max);
      const totalSpend = inBucket.reduce((sum, d) => sum + d.spend, 0);

      return {
        range,
        count: inBucket.length,
        percentage: (inBucket.length / distances.length) * 100,
        averageSpend: inBucket.length > 0 ? totalSpend / inBucket.length : 0,
      };
    });

    return { averageDistance: avg, medianDistance: median, buckets };
  }

  /**
   * Get regional booking trends
   */
  async getRegionalTrends(dateRange: DateRange) {
    const { start, end } = dateRange;

    // Define US regions
    const regions: Record<string, string[]> = {
      Northeast: ["ME", "NH", "VT", "MA", "RI", "CT", "NY", "NJ", "PA"],
      Southeast: [
        "DE",
        "MD",
        "VA",
        "WV",
        "NC",
        "SC",
        "GA",
        "FL",
        "KY",
        "TN",
        "AL",
        "MS",
        "AR",
        "LA",
      ],
      Midwest: ["OH", "IN", "IL", "MI", "WI", "MN", "IA", "MO", "ND", "SD", "NE", "KS"],
      Southwest: ["TX", "OK", "NM", "AZ"],
      West: ["CO", "WY", "MT", "ID", "WA", "OR", "CA", "NV", "UT", "AK", "HI"],
    };

    const reservations = await this.prisma.reservation.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ["confirmed", "checked_in", "checked_out"] },
      },
      select: {
        totalAmount: true,
        createdAt: true,
        Guest: { select: { state: true } },
      },
    });

    // Group by region and month
    const byRegion: Record<string, Record<string, { count: number; revenue: number }>> = {};

    for (const [region] of Object.entries(regions)) {
      byRegion[region] = {};
    }

    for (const res of reservations) {
      const state = res.Guest?.state;
      if (!state) continue;

      const region =
        Object.entries(regions).find(([_, states]) => states.includes(state.toUpperCase()))?.[0] ||
        "Other";

      const month = res.createdAt.toISOString().slice(0, 7);

      if (!byRegion[region]) byRegion[region] = {};
      if (!byRegion[region][month]) byRegion[region][month] = { count: 0, revenue: 0 };

      byRegion[region][month].count++;
      byRegion[region][month].revenue += res.totalAmount || 0;
    }

    return byRegion;
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Get approximate center coordinates for US states
   */
  private getStateCenterCoordinates(state: string): { lat: number; lng: number } | null {
    const centers: Record<string, { lat: number; lng: number }> = {
      AL: { lat: 32.806671, lng: -86.79113 },
      AK: { lat: 61.370716, lng: -152.404419 },
      AZ: { lat: 33.729759, lng: -111.431221 },
      AR: { lat: 34.969704, lng: -92.373123 },
      CA: { lat: 36.116203, lng: -119.681564 },
      CO: { lat: 39.059811, lng: -105.311104 },
      CT: { lat: 41.597782, lng: -72.755371 },
      DE: { lat: 39.318523, lng: -75.507141 },
      FL: { lat: 27.766279, lng: -81.686783 },
      GA: { lat: 33.040619, lng: -83.643074 },
      HI: { lat: 21.094318, lng: -157.498337 },
      ID: { lat: 44.240459, lng: -114.478828 },
      IL: { lat: 40.349457, lng: -88.986137 },
      IN: { lat: 39.849426, lng: -86.258278 },
      IA: { lat: 42.011539, lng: -93.210526 },
      KS: { lat: 38.5266, lng: -96.726486 },
      KY: { lat: 37.66814, lng: -84.670067 },
      LA: { lat: 31.169546, lng: -91.867805 },
      ME: { lat: 44.693947, lng: -69.381927 },
      MD: { lat: 39.063946, lng: -76.802101 },
      MA: { lat: 42.230171, lng: -71.530106 },
      MI: { lat: 43.326618, lng: -84.536095 },
      MN: { lat: 45.694454, lng: -93.900192 },
      MS: { lat: 32.741646, lng: -89.678696 },
      MO: { lat: 38.456085, lng: -92.288368 },
      MT: { lat: 46.921925, lng: -110.454353 },
      NE: { lat: 41.12537, lng: -98.268082 },
      NV: { lat: 38.313515, lng: -117.055374 },
      NH: { lat: 43.452492, lng: -71.563896 },
      NJ: { lat: 40.298904, lng: -74.521011 },
      NM: { lat: 34.840515, lng: -106.248482 },
      NY: { lat: 42.165726, lng: -74.948051 },
      NC: { lat: 35.630066, lng: -79.806419 },
      ND: { lat: 47.528912, lng: -99.784012 },
      OH: { lat: 40.388783, lng: -82.764915 },
      OK: { lat: 35.565342, lng: -96.928917 },
      OR: { lat: 44.572021, lng: -122.070938 },
      PA: { lat: 40.590752, lng: -77.209755 },
      RI: { lat: 41.680893, lng: -71.51178 },
      SC: { lat: 33.856892, lng: -80.945007 },
      SD: { lat: 44.299782, lng: -99.438828 },
      TN: { lat: 35.747845, lng: -86.692345 },
      TX: { lat: 31.054487, lng: -97.563461 },
      UT: { lat: 40.150032, lng: -111.862434 },
      VT: { lat: 44.045876, lng: -72.710686 },
      VA: { lat: 37.769337, lng: -78.169968 },
      WA: { lat: 47.400902, lng: -121.490494 },
      WV: { lat: 38.491226, lng: -80.954456 },
      WI: { lat: 44.268543, lng: -89.616508 },
      WY: { lat: 42.755966, lng: -107.30249 },
    };

    return centers[state.toUpperCase()] || null;
  }
}
