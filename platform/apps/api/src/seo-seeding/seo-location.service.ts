import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SeoLocationType, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

/**
 * SEO Location Service
 *
 * Manages geographic locations used for SEO landing pages.
 * Locations form a hierarchy: Country -> Region -> State -> County -> City
 */

export interface CreateLocationDto {
  type: SeoLocationType;
  name: string;
  slug: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  boundingBox?: { north: number; south: number; east: number; west: number };
  parentId?: string;
  metaTitle?: string;
  metaDescription?: string;
  heroImageUrl?: string;
  description?: string;
  highlights?: string[];
  bestTimeToVisit?: string;
}

export interface LocationWithCampgrounds {
  id: string;
  type: SeoLocationType;
  name: string;
  slug: string;
  metaTitle: string | null;
  metaDescription: string | null;
  heroImageUrl: string | null;
  description: string | null;
  campgroundCount: number;
  campgrounds: Array<{
    id: string;
    name: string;
    slug: string;
    heroImageUrl: string | null;
    city: string | null;
    state: string | null;
    reviewScore: number | null;
    reviewCount: number;
    amenities: string[];
    distanceMiles: number | null;
  }>;
}

@Injectable()
export class SeoLocationService {
  private readonly logger = new Logger(SeoLocationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new SEO location
   */
  async create(dto: CreateLocationDto) {
    return this.prisma.seoLocation.create({
      data: {
        id: randomUUID(),
        type: dto.type,
        name: dto.name,
        slug: dto.slug,
        state: dto.state,
        country: dto.country || "USA",
        latitude: dto.latitude ? new Prisma.Decimal(dto.latitude) : undefined,
        longitude: dto.longitude ? new Prisma.Decimal(dto.longitude) : undefined,
        boundingBox: dto.boundingBox,
        ...(dto.parentId ? { SeoLocation: { connect: { id: dto.parentId } } } : {}),
        metaTitle: dto.metaTitle,
        metaDescription: dto.metaDescription,
        heroImageUrl: dto.heroImageUrl,
        description: dto.description,
        highlights: dto.highlights || [],
        bestTimeToVisit: dto.bestTimeToVisit,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get location by slug with campgrounds
   */
  async getBySlug(
    slug: string,
    options: {
      limit?: number;
      offset?: number;
      sortBy?: "distance" | "rating" | "name";
    } = {},
  ): Promise<LocationWithCampgrounds | null> {
    const { limit = 20, offset = 0, sortBy = "name" } = options;

    const location = await this.prisma.seoLocation.findUnique({
      where: { slug },
      include: {
        CampgroundLocation: {
          take: limit,
          skip: offset,
          orderBy:
            sortBy === "distance"
              ? { distanceMiles: "asc" }
              : sortBy === "rating"
                ? { Campground: { reviewScore: "desc" } }
                : { Campground: { name: "asc" } },
          include: {
            Campground: {
              select: {
                id: true,
                name: true,
                slug: true,
                heroImageUrl: true,
                city: true,
                state: true,
                reviewScore: true,
                reviewCount: true,
                amenities: true,
                deletedAt: true,
              },
            },
          },
        },
      },
    });

    if (!location) {
      return null;
    }

    return {
      id: location.id,
      type: location.type,
      name: location.name,
      slug: location.slug,
      metaTitle: location.metaTitle,
      metaDescription: location.metaDescription,
      heroImageUrl: location.heroImageUrl,
      description: location.description,
      campgroundCount: location.campgroundCount,
      campgrounds: location.CampgroundLocation.filter((m) => !m.Campground.deletedAt).map((m) => ({
        id: m.Campground.id,
        name: m.Campground.name,
        slug: m.Campground.slug,
        heroImageUrl: m.Campground.heroImageUrl,
        city: m.Campground.city,
        state: m.Campground.state,
        reviewScore: m.Campground.reviewScore?.toNumber() ?? null,
        reviewCount: m.Campground.reviewCount,
        amenities: m.Campground.amenities,
        distanceMiles: m.distanceMiles,
      })),
    };
  }

  /**
   * List all locations of a given type
   */
  async listByType(
    type: SeoLocationType,
    options: { published?: boolean; minCampgrounds?: number } = {},
  ) {
    const where: Prisma.SeoLocationWhereInput = { type };

    if (options.published !== undefined) {
      where.isPublished = options.published;
    }

    if (options.minCampgrounds !== undefined) {
      where.campgroundCount = { gte: options.minCampgrounds };
    }

    return this.prisma.seoLocation.findMany({
      where,
      orderBy: { campgroundCount: "desc" },
    });
  }

  /**
   * List all states with campground counts
   */
  async listStates() {
    return this.prisma.seoLocation.findMany({
      where: { type: "state" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        state: true,
        campgroundCount: true,
        heroImageUrl: true,
        isPublished: true,
      },
    });
  }

  /**
   * List cities within a state
   */
  async listCitiesInState(stateSlug: string) {
    const stateLocation = await this.prisma.seoLocation.findUnique({
      where: { slug: stateSlug },
      select: { id: true, state: true },
    });

    if (!stateLocation) {
      throw new NotFoundException(`State not found: ${stateSlug}`);
    }

    return this.prisma.seoLocation.findMany({
      where: {
        type: "city",
        state: stateLocation.state,
        campgroundCount: { gt: 0 },
      },
      orderBy: { campgroundCount: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        campgroundCount: true,
        heroImageUrl: true,
        isPublished: true,
      },
    });
  }

  /**
   * Publish a location (make it visible in sitemap and navigation)
   */
  async publish(id: string) {
    return this.prisma.seoLocation.update({
      where: { id },
      data: {
        isPublished: true,
        publishedAt: new Date(),
      },
    });
  }

  /**
   * Unpublish a location
   */
  async unpublish(id: string) {
    return this.prisma.seoLocation.update({
      where: { id },
      data: {
        isPublished: false,
      },
    });
  }

  /**
   * Auto-publish locations with sufficient campgrounds
   */
  async autoPublishLocations(minCampgrounds: number = 5): Promise<number> {
    const result = await this.prisma.seoLocation.updateMany({
      where: {
        isPublished: false,
        campgroundCount: { gte: minCampgrounds },
      },
      data: {
        isPublished: true,
        publishedAt: new Date(),
      },
    });

    this.logger.log(`Auto-published ${result.count} locations with ${minCampgrounds}+ campgrounds`);
    return result.count;
  }

  /**
   * Seed initial state locations for all US states
   */
  async seedAllStates(): Promise<number> {
    const states = [
      { code: "AL", name: "Alabama" },
      { code: "AK", name: "Alaska" },
      { code: "AZ", name: "Arizona" },
      { code: "AR", name: "Arkansas" },
      { code: "CA", name: "California" },
      { code: "CO", name: "Colorado" },
      { code: "CT", name: "Connecticut" },
      { code: "DE", name: "Delaware" },
      { code: "FL", name: "Florida" },
      { code: "GA", name: "Georgia" },
      { code: "HI", name: "Hawaii" },
      { code: "ID", name: "Idaho" },
      { code: "IL", name: "Illinois" },
      { code: "IN", name: "Indiana" },
      { code: "IA", name: "Iowa" },
      { code: "KS", name: "Kansas" },
      { code: "KY", name: "Kentucky" },
      { code: "LA", name: "Louisiana" },
      { code: "ME", name: "Maine" },
      { code: "MD", name: "Maryland" },
      { code: "MA", name: "Massachusetts" },
      { code: "MI", name: "Michigan" },
      { code: "MN", name: "Minnesota" },
      { code: "MS", name: "Mississippi" },
      { code: "MO", name: "Missouri" },
      { code: "MT", name: "Montana" },
      { code: "NE", name: "Nebraska" },
      { code: "NV", name: "Nevada" },
      { code: "NH", name: "New Hampshire" },
      { code: "NJ", name: "New Jersey" },
      { code: "NM", name: "New Mexico" },
      { code: "NY", name: "New York" },
      { code: "NC", name: "North Carolina" },
      { code: "ND", name: "North Dakota" },
      { code: "OH", name: "Ohio" },
      { code: "OK", name: "Oklahoma" },
      { code: "OR", name: "Oregon" },
      { code: "PA", name: "Pennsylvania" },
      { code: "RI", name: "Rhode Island" },
      { code: "SC", name: "South Carolina" },
      { code: "SD", name: "South Dakota" },
      { code: "TN", name: "Tennessee" },
      { code: "TX", name: "Texas" },
      { code: "UT", name: "Utah" },
      { code: "VT", name: "Vermont" },
      { code: "VA", name: "Virginia" },
      { code: "WA", name: "Washington" },
      { code: "WV", name: "West Virginia" },
      { code: "WI", name: "Wisconsin" },
      { code: "WY", name: "Wyoming" },
    ];

    let created = 0;

    for (const state of states) {
      const slug = state.name.toLowerCase().replace(/\s+/g, "-");

      await this.prisma.seoLocation.upsert({
        where: { slug },
        update: {},
        create: {
          id: randomUUID(),
          type: "state",
          name: state.name,
          slug,
          state: state.code,
          country: "USA",
          metaTitle: `Camping in ${state.name} - Find the Best Campgrounds & RV Parks`,
          metaDescription: `Discover the best campgrounds and RV parks in ${state.name}. Find campsites near national parks, lakes, mountains, and outdoor adventures. Book your perfect camping trip today.`,
          updatedAt: new Date(),
        },
      });

      created++;
    }

    this.logger.log(`Seeded ${created} US state locations`);
    return created;
  }
}
