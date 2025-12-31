import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SeoLocationType, AttractionType, CampgroundClaimStatus } from "@prisma/client";

/**
 * Public Locations Service
 *
 * Serves public-facing location pages for SEO:
 * - State pages: "Camping in California"
 * - City pages: "Camping near Los Angeles, CA"
 * - Region pages: "Camping in the Pacific Northwest"
 * - Attraction pages: "Camping near Yellowstone"
 */

export interface LocationPageData {
  // Location info
  id: string;
  type: SeoLocationType;
  name: string;
  slug: string;
  state: string | null;

  // SEO metadata
  metaTitle: string;
  metaDescription: string;
  heroImageUrl: string | null;
  description: string | null;

  // Content
  highlights: string[];
  bestTimeToVisit: string | null;

  // Stats
  campgroundCount: number;

  // Campgrounds in this location
  campgrounds: Array<{
    id: string;
    slug: string;
    name: string;
    city: string | null;
    state: string | null;
    heroImageUrl: string | null;
    reviewScore: number | null;
    reviewCount: number;
    amenities: string[];
    distanceMiles: number | null;
    claimStatus: CampgroundClaimStatus;
  }>;

  // Nearby attractions
  nearbyAttractions: Array<{
    id: string;
    name: string;
    slug: string;
    type: AttractionType;
    campgroundCount: number;
  }>;

  // Child locations (cities in a state, etc.)
  childLocations: Array<{
    id: string;
    name: string;
    slug: string;
    campgroundCount: number;
  }>;
}

export interface AttractionPageData {
  // Attraction info
  id: string;
  type: AttractionType;
  name: string;
  slug: string;
  state: string | null;

  // SEO metadata
  metaTitle: string;
  metaDescription: string;
  heroImageUrl: string | null;
  description: string | null;

  // Content
  activities: string[];
  bestSeason: string | null;

  // Stats
  campgroundCount: number;

  // Campgrounds near this attraction
  campgrounds: Array<{
    id: string;
    slug: string;
    name: string;
    city: string | null;
    state: string | null;
    heroImageUrl: string | null;
    reviewScore: number | null;
    reviewCount: number;
    amenities: string[];
    distanceMiles: number;
    claimStatus: CampgroundClaimStatus;
  }>;

  // Other nearby attractions
  relatedAttractions: Array<{
    id: string;
    name: string;
    slug: string;
    type: AttractionType;
  }>;
}

export interface StateListItem {
  name: string;
  slug: string;
  state: string;
  campgroundCount: number;
  heroImageUrl: string | null;
}

export interface AttractionListItem {
  name: string;
  slug: string;
  type: AttractionType;
  state: string | null;
  campgroundCount: number;
  heroImageUrl: string | null;
}

@Injectable()
export class PublicLocationsService {
  private readonly logger = new Logger(PublicLocationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get location page data by slug
   */
  async getLocationBySlug(
    slug: string,
    options: { limit?: number; offset?: number; sortBy?: "name" | "rating" | "distance" } = {}
  ): Promise<LocationPageData | null> {
    const { limit = 20, offset = 0, sortBy = "name" } = options;

    const location = await this.prisma.seoLocation.findUnique({
      where: { slug },
      include: {
        children: {
          where: { campgroundCount: { gt: 0 } },
          orderBy: { campgroundCount: "desc" },
          take: 20,
          select: {
            id: true,
            name: true,
            slug: true,
            campgroundCount: true,
          },
        },
      },
    });

    if (!location || !location.isPublished) {
      return null;
    }

    // Get campgrounds in this location
    const campgroundMappings = await this.prisma.campgroundLocation.findMany({
      where: { locationId: location.id },
      orderBy:
        sortBy === "rating"
          ? { campground: { reviewScore: "desc" } }
          : sortBy === "distance"
            ? { distanceMiles: "asc" }
            : { campground: { name: "asc" } },
      take: limit,
      skip: offset,
      include: {
        campground: {
          select: {
            id: true,
            slug: true,
            name: true,
            city: true,
            state: true,
            heroImageUrl: true,
            reviewScore: true,
            reviewCount: true,
            amenities: true,
            claimStatus: true,
            deletedAt: true,
          },
        },
      },
    });

    // Get nearby attractions for state-level pages
    let nearbyAttractions: Array<{
      id: string;
      name: string;
      slug: string;
      type: AttractionType;
      campgroundCount: number;
    }> = [];

    if (location.type === "state" && location.state) {
      const attractions = await this.prisma.attraction.findMany({
        where: {
          state: location.state,
          isPublished: true,
          nearbyCampgroundCount: { gt: 0 },
        },
        orderBy: { nearbyCampgroundCount: "desc" },
        take: 10,
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          nearbyCampgroundCount: true,
        },
      });

      nearbyAttractions = attractions.map((a) => ({
        id: a.id,
        name: a.name,
        slug: a.slug,
        type: a.type,
        campgroundCount: a.nearbyCampgroundCount,
      }));
    }

    const metaTitle = location.metaTitle || `Camping in ${location.name}`;
    const metaDescription =
      location.metaDescription ||
      `Find the best campgrounds and RV parks in ${location.name}. Discover ${location.campgroundCount} camping options for your next outdoor adventure.`;

    return {
      id: location.id,
      type: location.type,
      name: location.name,
      slug: location.slug,
      state: location.state,
      metaTitle,
      metaDescription,
      heroImageUrl: location.heroImageUrl,
      description: location.description,
      highlights: location.highlights || [],
      bestTimeToVisit: location.bestTimeToVisit,
      campgroundCount: location.campgroundCount,
      campgrounds: campgroundMappings
        .filter((m) => !m.campground.deletedAt)
        .map((m) => ({
          id: m.campground.id,
          slug: m.campground.slug,
          name: m.campground.name,
          city: m.campground.city,
          state: m.campground.state,
          heroImageUrl: m.campground.heroImageUrl,
          reviewScore: m.campground.reviewScore?.toNumber() ?? null,
          reviewCount: m.campground.reviewCount,
          amenities: m.campground.amenities,
          distanceMiles: m.distanceMiles,
          claimStatus: m.campground.claimStatus,
        })),
      nearbyAttractions,
      childLocations: location.children,
    };
  }

  /**
   * Get attraction page data by slug
   */
  async getAttractionBySlug(
    slug: string,
    options: { limit?: number; offset?: number; maxDistance?: number } = {}
  ): Promise<AttractionPageData | null> {
    const { limit = 20, offset = 0, maxDistance = 50 } = options;

    const attraction = await this.prisma.attraction.findUnique({
      where: { slug },
    });

    if (!attraction || !attraction.isPublished) {
      return null;
    }

    // Get campgrounds near this attraction
    const campgroundMappings = await this.prisma.campgroundAttraction.findMany({
      where: {
        attractionId: attraction.id,
        distanceMiles: { lte: maxDistance },
      },
      orderBy: { distanceMiles: "asc" },
      take: limit,
      skip: offset,
      include: {
        campground: {
          select: {
            id: true,
            slug: true,
            name: true,
            city: true,
            state: true,
            heroImageUrl: true,
            reviewScore: true,
            reviewCount: true,
            amenities: true,
            claimStatus: true,
            deletedAt: true,
          },
        },
      },
    });

    // Get related attractions in the same state
    let relatedAttractions: Array<{
      id: string;
      name: string;
      slug: string;
      type: AttractionType;
    }> = [];

    if (attraction.state) {
      const related = await this.prisma.attraction.findMany({
        where: {
          id: { not: attraction.id },
          state: attraction.state,
          isPublished: true,
        },
        take: 5,
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
        },
      });

      relatedAttractions = related;
    }

    const metaTitle =
      attraction.metaTitle ||
      `Camping near ${attraction.name} - Best Campgrounds & RV Parks`;
    const metaDescription =
      attraction.metaDescription ||
      `Find the best campgrounds and RV parks near ${attraction.name}. ${attraction.nearbyCampgroundCount} camping options within ${maxDistance} miles.`;

    return {
      id: attraction.id,
      type: attraction.type,
      name: attraction.name,
      slug: attraction.slug,
      state: attraction.state,
      metaTitle,
      metaDescription,
      heroImageUrl: attraction.heroImageUrl,
      description: attraction.description,
      activities: attraction.activities || [],
      bestSeason: attraction.bestSeason,
      campgroundCount: attraction.nearbyCampgroundCount,
      campgrounds: campgroundMappings
        .filter((m) => !m.campground.deletedAt)
        .map((m) => ({
          id: m.campground.id,
          slug: m.campground.slug,
          name: m.campground.name,
          city: m.campground.city,
          state: m.campground.state,
          heroImageUrl: m.campground.heroImageUrl,
          reviewScore: m.campground.reviewScore?.toNumber() ?? null,
          reviewCount: m.campground.reviewCount,
          amenities: m.campground.amenities,
          distanceMiles: m.distanceMiles,
          claimStatus: m.campground.claimStatus,
        })),
      relatedAttractions,
    };
  }

  /**
   * List all states for the states index page
   */
  async listStates(): Promise<StateListItem[]> {
    const states = await this.prisma.seoLocation.findMany({
      where: {
        type: "state",
        isPublished: true,
        campgroundCount: { gt: 0 },
      },
      orderBy: { name: "asc" },
      select: {
        name: true,
        slug: true,
        state: true,
        campgroundCount: true,
        heroImageUrl: true,
      },
    });

    return states.map((s) => ({
      name: s.name,
      slug: s.slug,
      state: s.state || "",
      campgroundCount: s.campgroundCount,
      heroImageUrl: s.heroImageUrl,
    }));
  }

  /**
   * List all national parks
   */
  async listNationalParks(): Promise<AttractionListItem[]> {
    const parks = await this.prisma.attraction.findMany({
      where: {
        type: "national_park",
        isPublished: true,
        nearbyCampgroundCount: { gt: 0 },
      },
      orderBy: { name: "asc" },
      select: {
        name: true,
        slug: true,
        type: true,
        state: true,
        nearbyCampgroundCount: true,
        heroImageUrl: true,
      },
    });

    return parks.map((p) => ({
      name: p.name,
      slug: p.slug,
      type: p.type,
      state: p.state,
      campgroundCount: p.nearbyCampgroundCount,
      heroImageUrl: p.heroImageUrl,
    }));
  }

  /**
   * List attractions by type
   */
  async listAttractionsByType(type: AttractionType): Promise<AttractionListItem[]> {
    const attractions = await this.prisma.attraction.findMany({
      where: {
        type,
        isPublished: true,
        nearbyCampgroundCount: { gt: 0 },
      },
      orderBy: { nearbyCampgroundCount: "desc" },
      select: {
        name: true,
        slug: true,
        type: true,
        state: true,
        nearbyCampgroundCount: true,
        heroImageUrl: true,
      },
    });

    return attractions.map((a) => ({
      name: a.name,
      slug: a.slug,
      type: a.type,
      state: a.state,
      campgroundCount: a.nearbyCampgroundCount,
      heroImageUrl: a.heroImageUrl,
    }));
  }

  /**
   * Get cities in a state
   */
  async listCitiesInState(stateSlug: string): Promise<Array<{
    name: string;
    slug: string;
    campgroundCount: number;
  }>> {
    const state = await this.prisma.seoLocation.findUnique({
      where: { slug: stateSlug },
      select: { state: true },
    });

    if (!state?.state) {
      return [];
    }

    const cities = await this.prisma.seoLocation.findMany({
      where: {
        type: "city",
        state: state.state,
        isPublished: true,
        campgroundCount: { gt: 0 },
      },
      orderBy: { campgroundCount: "desc" },
      take: 50,
      select: {
        name: true,
        slug: true,
        campgroundCount: true,
      },
    });

    return cities;
  }

  /**
   * Get popular destinations for homepage
   */
  async getPopularDestinations(): Promise<{
    states: StateListItem[];
    attractions: AttractionListItem[];
  }> {
    const [topStates, topAttractions] = await Promise.all([
      this.prisma.seoLocation.findMany({
        where: {
          type: "state",
          isPublished: true,
          campgroundCount: { gt: 0 },
        },
        orderBy: { campgroundCount: "desc" },
        take: 6,
        select: {
          name: true,
          slug: true,
          state: true,
          campgroundCount: true,
          heroImageUrl: true,
        },
      }),
      this.prisma.attraction.findMany({
        where: {
          type: "national_park",
          isPublished: true,
          nearbyCampgroundCount: { gt: 0 },
        },
        orderBy: { nearbyCampgroundCount: "desc" },
        take: 6,
        select: {
          name: true,
          slug: true,
          type: true,
          state: true,
          nearbyCampgroundCount: true,
          heroImageUrl: true,
        },
      }),
    ]);

    return {
      states: topStates.map((s) => ({
        name: s.name,
        slug: s.slug,
        state: s.state || "",
        campgroundCount: s.campgroundCount,
        heroImageUrl: s.heroImageUrl,
      })),
      attractions: topAttractions.map((a) => ({
        name: a.name,
        slug: a.slug,
        type: a.type,
        state: a.state,
        campgroundCount: a.nearbyCampgroundCount,
        heroImageUrl: a.heroImageUrl,
      })),
    };
  }
}
