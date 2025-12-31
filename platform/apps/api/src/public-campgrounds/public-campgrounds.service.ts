import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CampgroundClaimStatus } from "@prisma/client";

/**
 * Public Campgrounds Service
 *
 * Serves public-facing campground pages for SEO and guest browsing.
 * Returns different data based on claim status:
 *
 * - unclaimed: Basic info + "Claim this listing" CTA
 * - claim_pending: Basic info + "Coming Soon" badge
 * - claimed: Full details, photos, amenities, booking
 */

export interface PublicCampgroundView {
  // Basic info (always available)
  id: string;
  slug: string;
  name: string;
  city: string | null;
  state: string | null;
  description: string | null;
  claimStatus: CampgroundClaimStatus;

  // SEO metadata
  metaTitle: string;
  metaDescription: string;

  // Location
  latitude: number | null;
  longitude: number | null;

  // Status-dependent content
  heroImageUrl: string | null;
  photos: string[];
  amenities: string[];

  // Claim status specific
  isClaimable: boolean;
  isComingSoon: boolean;
  isBookable: boolean;

  // Only for claimed campgrounds
  tagline?: string;
  website?: string;
  phone?: string;
  email?: string;
  checkInTime?: string;
  checkOutTime?: string;
  reviewScore?: number;
  reviewCount?: number;

  // Nearby attractions (for SEO)
  nearbyAttractions: Array<{
    id: string;
    name: string;
    slug: string;
    type: string;
    distanceMiles: number;
  }>;

  // Organization info (only if claimed)
  organization?: {
    id: string;
    name: string;
    logo?: string;
  };
}

export interface CampgroundSearchResult {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  state: string | null;
  heroImageUrl: string | null;
  reviewScore: number | null;
  reviewCount: number;
  amenities: string[];
  claimStatus: CampgroundClaimStatus;
  distanceMiles?: number;
}

export interface CampgroundSearchOptions {
  state?: string;
  city?: string;
  near?: { lat: number; lon: number; radiusMiles: number };
  amenities?: string[];
  minRating?: number;
  claimStatus?: CampgroundClaimStatus;
  limit?: number;
  offset?: number;
  sortBy?: "name" | "rating" | "distance" | "reviewCount";
}

@Injectable()
export class PublicCampgroundsService {
  private readonly logger = new Logger(PublicCampgroundsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get a campground by slug for public display
   */
  async getBySlug(slug: string): Promise<PublicCampgroundView | null> {
    const campground = await this.prisma.campground.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        tagline: true,
        description: true,
        city: true,
        state: true,
        latitude: true,
        longitude: true,
        heroImageUrl: true,
        photos: true,
        amenities: true,
        phone: true,
        email: true,
        website: true,
        checkInTime: true,
        checkOutTime: true,
        reviewScore: true,
        reviewCount: true,
        claimStatus: true,
        deletedAt: true,
        organization: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
          },
        },
        attractionMappings: {
          where: { isNearby: true },
          orderBy: { distanceMiles: "asc" },
          take: 5,
          select: {
            distanceMiles: true,
            attraction: {
              select: {
                id: true,
                name: true,
                slug: true,
                type: true,
              },
            },
          },
        },
      },
    });

    if (!campground || campground.deletedAt) {
      return null;
    }

    const isClaimable = campground.claimStatus === CampgroundClaimStatus.unclaimed;
    const isComingSoon = campground.claimStatus === CampgroundClaimStatus.claim_pending;
    const isClaimed = campground.claimStatus === CampgroundClaimStatus.claimed;

    // Build meta description
    const metaDescription = this.buildMetaDescription(campground);
    const metaTitle = this.buildMetaTitle(campground);

    const baseView: PublicCampgroundView = {
      id: campground.id,
      slug: campground.slug,
      name: campground.name,
      city: campground.city,
      state: campground.state,
      description: campground.description,
      claimStatus: campground.claimStatus,
      metaTitle,
      metaDescription,
      latitude: campground.latitude?.toNumber() ?? null,
      longitude: campground.longitude?.toNumber() ?? null,
      heroImageUrl: campground.heroImageUrl,
      photos: campground.photos || [],
      amenities: campground.amenities || [],
      isClaimable,
      isComingSoon,
      isBookable: isClaimed,
      nearbyAttractions: campground.attractionMappings.map((m) => ({
        id: m.attraction.id,
        name: m.attraction.name,
        slug: m.attraction.slug,
        type: m.attraction.type,
        distanceMiles: m.distanceMiles,
      })),
    };

    // Add claimed-only fields
    if (isClaimed) {
      return {
        ...baseView,
        tagline: campground.tagline ?? undefined,
        website: campground.website ?? undefined,
        phone: campground.phone ?? undefined,
        email: campground.email ?? undefined,
        checkInTime: campground.checkInTime ?? undefined,
        checkOutTime: campground.checkOutTime ?? undefined,
        reviewScore: campground.reviewScore?.toNumber(),
        reviewCount: campground.reviewCount,
        organization: campground.organization
          ? {
              id: campground.organization.id,
              name: campground.organization.name,
              logo: campground.organization.logoUrl ?? undefined,
            }
          : undefined,
      };
    }

    return baseView;
  }

  /**
   * Search campgrounds with filters
   */
  async search(options: CampgroundSearchOptions): Promise<{
    results: CampgroundSearchResult[];
    total: number;
  }> {
    const {
      state,
      city,
      amenities,
      minRating,
      claimStatus,
      limit = 20,
      offset = 0,
      sortBy = "name",
    } = options;

    const where: any = {
      deletedAt: null,
    };

    if (state) {
      where.state = state.toUpperCase();
    }

    if (city) {
      where.city = { contains: city, mode: "insensitive" };
    }

    if (amenities && amenities.length > 0) {
      where.amenities = { hasEvery: amenities };
    }

    if (minRating) {
      where.reviewScore = { gte: minRating };
    }

    if (claimStatus) {
      where.claimStatus = claimStatus;
    }

    // Determine sort order
    const orderBy: any = {};
    switch (sortBy) {
      case "rating":
        orderBy.reviewScore = { sort: "desc", nulls: "last" };
        break;
      case "reviewCount":
        orderBy.reviewCount = "desc";
        break;
      case "name":
      default:
        orderBy.name = "asc";
        break;
    }

    const [results, total] = await Promise.all([
      this.prisma.campground.findMany({
        where,
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
        },
        orderBy,
        take: limit,
        skip: offset,
      }),
      this.prisma.campground.count({ where }),
    ]);

    return {
      results: results.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        city: c.city,
        state: c.state,
        heroImageUrl: c.heroImageUrl,
        reviewScore: c.reviewScore?.toNumber() ?? null,
        reviewCount: c.reviewCount,
        amenities: c.amenities,
        claimStatus: c.claimStatus,
      })),
      total,
    };
  }

  /**
   * Get featured campgrounds for homepage/landing pages
   */
  async getFeatured(limit: number = 8): Promise<CampgroundSearchResult[]> {
    const campgrounds = await this.prisma.campground.findMany({
      where: {
        deletedAt: null,
        claimStatus: CampgroundClaimStatus.claimed,
        reviewScore: { gte: 4 },
        heroImageUrl: { not: null },
      },
      orderBy: [{ reviewScore: "desc" }, { reviewCount: "desc" }],
      take: limit,
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
      },
    });

    return campgrounds.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      city: c.city,
      state: c.state,
      heroImageUrl: c.heroImageUrl,
      reviewScore: c.reviewScore?.toNumber() ?? null,
      reviewCount: c.reviewCount,
      amenities: c.amenities,
      claimStatus: c.claimStatus,
    }));
  }

  /**
   * Get unclaimed campgrounds for the "Claim your listing" page
   */
  async getUnclaimedForClaim(options: {
    state?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ results: CampgroundSearchResult[]; total: number }> {
    const { state, search, limit = 20, offset = 0 } = options;

    const where: any = {
      deletedAt: null,
      claimStatus: CampgroundClaimStatus.unclaimed,
      seededDataSource: { not: null },
    };

    if (state) {
      where.state = state.toUpperCase();
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
      ];
    }

    const [results, total] = await Promise.all([
      this.prisma.campground.findMany({
        where,
        orderBy: { name: "asc" },
        take: limit,
        skip: offset,
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
        },
      }),
      this.prisma.campground.count({ where }),
    ]);

    return {
      results: results.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        city: c.city,
        state: c.state,
        heroImageUrl: c.heroImageUrl,
        reviewScore: c.reviewScore?.toNumber() ?? null,
        reviewCount: c.reviewCount,
        amenities: c.amenities,
        claimStatus: c.claimStatus,
      })),
      total,
    };
  }

  /**
   * Get similar campgrounds for recommendations
   */
  async getSimilar(
    campgroundId: string,
    limit: number = 4
  ): Promise<CampgroundSearchResult[]> {
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { state: true, amenities: true, claimStatus: true },
    });

    if (!campground) {
      return [];
    }

    // Find campgrounds in the same state with similar amenities
    const similar = await this.prisma.campground.findMany({
      where: {
        id: { not: campgroundId },
        deletedAt: null,
        state: campground.state,
        claimStatus: CampgroundClaimStatus.claimed,
        amenities: {
          hasSome: campground.amenities.slice(0, 3),
        },
      },
      orderBy: { reviewScore: "desc" },
      take: limit,
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
      },
    });

    return similar.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      city: c.city,
      state: c.state,
      heroImageUrl: c.heroImageUrl,
      reviewScore: c.reviewScore?.toNumber() ?? null,
      reviewCount: c.reviewCount,
      amenities: c.amenities,
      claimStatus: c.claimStatus,
    }));
  }

  private buildMetaTitle(campground: {
    name: string;
    city: string | null;
    state: string | null;
    claimStatus: CampgroundClaimStatus;
  }): string {
    const location = [campground.city, campground.state]
      .filter(Boolean)
      .join(", ");

    if (campground.claimStatus === CampgroundClaimStatus.claimed) {
      return location
        ? `${campground.name} - Camping in ${location} | Book Now`
        : `${campground.name} - Book Your Campsite`;
    }

    return location
      ? `${campground.name} - Camping near ${location}`
      : campground.name;
  }

  private buildMetaDescription(campground: {
    name: string;
    description: string | null;
    city: string | null;
    state: string | null;
    amenities: string[];
    claimStatus: CampgroundClaimStatus;
  }): string {
    if (campground.description) {
      return campground.description.slice(0, 160);
    }

    const location = [campground.city, campground.state]
      .filter(Boolean)
      .join(", ");
    const amenityList = campground.amenities.slice(0, 3).join(", ");

    if (campground.claimStatus === CampgroundClaimStatus.claimed) {
      return `Book your stay at ${campground.name}${location ? ` in ${location}` : ""}. ${amenityList ? `Enjoy ${amenityList.toLowerCase()} and more.` : "Reserve your campsite today."}`;
    }

    return `Discover camping at ${campground.name}${location ? ` near ${location}` : ""}. ${amenityList ? `Features include ${amenityList.toLowerCase()}.` : ""}`;
  }
}
