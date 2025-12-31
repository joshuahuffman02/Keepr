import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AttractionType, Prisma } from "@prisma/client";

/**
 * Attraction Service
 *
 * Manages attractions (National Parks, Lakes, etc.) for SEO pages.
 * These are key destinations that campgrounds can be associated with
 * for "Camping near [Attraction]" landing pages.
 */

export interface CreateAttractionDto {
  type: AttractionType;
  name: string;
  slug: string;
  state?: string;
  city?: string;
  country?: string;
  latitude: number;
  longitude: number;
  npsCode?: string;
  googlePlaceId?: string;
  wikipediaUrl?: string;
  metaTitle?: string;
  metaDescription?: string;
  heroImageUrl?: string;
  description?: string;
  activities?: string[];
  bestSeason?: string;
}

export interface AttractionWithCampgrounds {
  id: string;
  type: AttractionType;
  name: string;
  slug: string;
  metaTitle: string | null;
  metaDescription: string | null;
  heroImageUrl: string | null;
  description: string | null;
  activities: string[];
  bestSeason: string | null;
  nearbyCampgroundCount: number;
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
    distanceMiles: number;
  }>;
}

@Injectable()
export class AttractionService {
  private readonly logger = new Logger(AttractionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new attraction
   */
  async create(dto: CreateAttractionDto) {
    return this.prisma.attraction.create({
      data: {
        type: dto.type,
        name: dto.name,
        slug: dto.slug,
        state: dto.state,
        city: dto.city,
        country: dto.country || "USA",
        latitude: new Prisma.Decimal(dto.latitude),
        longitude: new Prisma.Decimal(dto.longitude),
        npsCode: dto.npsCode,
        googlePlaceId: dto.googlePlaceId,
        wikipediaUrl: dto.wikipediaUrl,
        metaTitle: dto.metaTitle,
        metaDescription: dto.metaDescription,
        heroImageUrl: dto.heroImageUrl,
        description: dto.description,
        activities: dto.activities || [],
        bestSeason: dto.bestSeason,
      },
    });
  }

  /**
   * Get attraction by slug with nearby campgrounds
   */
  async getBySlug(
    slug: string,
    options: {
      limit?: number;
      offset?: number;
      maxDistance?: number;
    } = {}
  ): Promise<AttractionWithCampgrounds | null> {
    const { limit = 20, offset = 0, maxDistance = 50 } = options;

    const attraction = await this.prisma.attraction.findUnique({
      where: { slug },
      include: {
        campgroundMappings: {
          where: {
            distanceMiles: { lte: maxDistance },
          },
          take: limit,
          skip: offset,
          orderBy: { distanceMiles: "asc" },
          include: {
            campground: {
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

    if (!attraction) {
      return null;
    }

    return {
      id: attraction.id,
      type: attraction.type,
      name: attraction.name,
      slug: attraction.slug,
      metaTitle: attraction.metaTitle,
      metaDescription: attraction.metaDescription,
      heroImageUrl: attraction.heroImageUrl,
      description: attraction.description,
      activities: attraction.activities,
      bestSeason: attraction.bestSeason,
      nearbyCampgroundCount: attraction.nearbyCampgroundCount,
      campgrounds: attraction.campgroundMappings
        .filter((m) => !m.campground.deletedAt)
        .map((m) => ({
          id: m.campground.id,
          name: m.campground.name,
          slug: m.campground.slug,
          heroImageUrl: m.campground.heroImageUrl,
          city: m.campground.city,
          state: m.campground.state,
          reviewScore: m.campground.reviewScore?.toNumber() ?? null,
          reviewCount: m.campground.reviewCount,
          amenities: m.campground.amenities,
          distanceMiles: m.distanceMiles,
        })),
    };
  }

  /**
   * List attractions by type
   */
  async listByType(
    type: AttractionType,
    options: { published?: boolean; minCampgrounds?: number } = {}
  ) {
    const where: Prisma.AttractionWhereInput = { type };

    if (options.published !== undefined) {
      where.isPublished = options.published;
    }

    if (options.minCampgrounds !== undefined) {
      where.nearbyCampgroundCount = { gte: options.minCampgrounds };
    }

    return this.prisma.attraction.findMany({
      where,
      orderBy: { nearbyCampgroundCount: "desc" },
    });
  }

  /**
   * List all national parks
   */
  async listNationalParks() {
    return this.prisma.attraction.findMany({
      where: { type: "national_park" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        state: true,
        npsCode: true,
        nearbyCampgroundCount: true,
        heroImageUrl: true,
        isPublished: true,
      },
    });
  }

  /**
   * Publish an attraction
   */
  async publish(id: string) {
    return this.prisma.attraction.update({
      where: { id },
      data: {
        isPublished: true,
        publishedAt: new Date(),
      },
    });
  }

  /**
   * Seed major US National Parks
   */
  async seedNationalParks(): Promise<number> {
    const parks = [
      { name: "Yellowstone National Park", slug: "yellowstone-national-park", state: "WY", npsCode: "YELL", lat: 44.428, lon: -110.5885 },
      { name: "Yosemite National Park", slug: "yosemite-national-park", state: "CA", npsCode: "YOSE", lat: 37.8651, lon: -119.5383 },
      { name: "Grand Canyon National Park", slug: "grand-canyon-national-park", state: "AZ", npsCode: "GRCA", lat: 36.1069, lon: -112.1129 },
      { name: "Zion National Park", slug: "zion-national-park", state: "UT", npsCode: "ZION", lat: 37.2982, lon: -113.0263 },
      { name: "Glacier National Park", slug: "glacier-national-park", state: "MT", npsCode: "GLAC", lat: 48.7596, lon: -113.787 },
      { name: "Rocky Mountain National Park", slug: "rocky-mountain-national-park", state: "CO", npsCode: "ROMO", lat: 40.3428, lon: -105.6836 },
      { name: "Acadia National Park", slug: "acadia-national-park", state: "ME", npsCode: "ACAD", lat: 44.35, lon: -68.2167 },
      { name: "Great Smoky Mountains National Park", slug: "great-smoky-mountains-national-park", state: "TN", npsCode: "GRSM", lat: 35.6532, lon: -83.5071 },
      { name: "Joshua Tree National Park", slug: "joshua-tree-national-park", state: "CA", npsCode: "JOTR", lat: 33.8734, lon: -115.9010 },
      { name: "Olympic National Park", slug: "olympic-national-park", state: "WA", npsCode: "OLYM", lat: 47.8021, lon: -123.6044 },
      { name: "Mount Rainier National Park", slug: "mount-rainier-national-park", state: "WA", npsCode: "MORA", lat: 46.8800, lon: -121.7269 },
      { name: "Crater Lake National Park", slug: "crater-lake-national-park", state: "OR", npsCode: "CRLA", lat: 42.8684, lon: -122.1685 },
      { name: "Arches National Park", slug: "arches-national-park", state: "UT", npsCode: "ARCH", lat: 38.7331, lon: -109.5925 },
      { name: "Bryce Canyon National Park", slug: "bryce-canyon-national-park", state: "UT", npsCode: "BRCA", lat: 37.5930, lon: -112.1871 },
      { name: "Canyonlands National Park", slug: "canyonlands-national-park", state: "UT", npsCode: "CANY", lat: 38.3269, lon: -109.8783 },
      { name: "Capitol Reef National Park", slug: "capitol-reef-national-park", state: "UT", npsCode: "CARE", lat: 38.2800, lon: -111.1700 },
      { name: "Death Valley National Park", slug: "death-valley-national-park", state: "CA", npsCode: "DEVA", lat: 36.5054, lon: -117.0794 },
      { name: "Redwood National and State Parks", slug: "redwood-national-park", state: "CA", npsCode: "REDW", lat: 41.2132, lon: -124.0046 },
      { name: "Sequoia National Park", slug: "sequoia-national-park", state: "CA", npsCode: "SEQU", lat: 36.4864, lon: -118.5658 },
      { name: "Kings Canyon National Park", slug: "kings-canyon-national-park", state: "CA", npsCode: "KICA", lat: 36.8879, lon: -118.5551 },
      { name: "Denali National Park", slug: "denali-national-park", state: "AK", npsCode: "DENA", lat: 63.1148, lon: -151.1926 },
      { name: "Grand Teton National Park", slug: "grand-teton-national-park", state: "WY", npsCode: "GRTE", lat: 43.7904, lon: -110.6818 },
      { name: "Badlands National Park", slug: "badlands-national-park", state: "SD", npsCode: "BADL", lat: 43.8554, lon: -102.3397 },
      { name: "Shenandoah National Park", slug: "shenandoah-national-park", state: "VA", npsCode: "SHEN", lat: 38.4755, lon: -78.4535 },
      { name: "Big Bend National Park", slug: "big-bend-national-park", state: "TX", npsCode: "BIBE", lat: 29.2500, lon: -103.2500 },
    ];

    let created = 0;

    for (const park of parks) {
      await this.prisma.attraction.upsert({
        where: { slug: park.slug },
        update: {},
        create: {
          type: "national_park",
          name: park.name,
          slug: park.slug,
          state: park.state,
          country: "USA",
          latitude: new Prisma.Decimal(park.lat),
          longitude: new Prisma.Decimal(park.lon),
          npsCode: park.npsCode,
          metaTitle: `Camping near ${park.name} - Best Campgrounds & RV Parks`,
          metaDescription: `Find the best campgrounds and RV parks near ${park.name}. Book campsites close to the park for your next outdoor adventure.`,
          activities: ["hiking", "wildlife viewing", "photography", "camping"],
        },
      });

      created++;
    }

    this.logger.log(`Seeded ${created} national parks`);
    return created;
  }

  /**
   * Seed popular lakes
   */
  async seedLakes(): Promise<number> {
    const lakes = [
      { name: "Lake Tahoe", slug: "lake-tahoe", state: "CA", lat: 39.0968, lon: -120.0324 },
      { name: "Lake Powell", slug: "lake-powell", state: "UT", lat: 37.0683, lon: -111.2433 },
      { name: "Lake Mead", slug: "lake-mead", state: "NV", lat: 36.145, lon: -114.39 },
      { name: "Flathead Lake", slug: "flathead-lake", state: "MT", lat: 47.8833, lon: -114.15 },
      { name: "Lake Chelan", slug: "lake-chelan", state: "WA", lat: 47.8395, lon: -120.0164 },
      { name: "Lake Michigan", slug: "lake-michigan", state: "MI", lat: 43.9167, lon: -86.9167 },
      { name: "Lake Superior", slug: "lake-superior", state: "MN", lat: 47.7, lon: -87.5 },
      { name: "Lake of the Ozarks", slug: "lake-of-the-ozarks", state: "MO", lat: 38.1064, lon: -92.7419 },
      { name: "Lake George", slug: "lake-george", state: "NY", lat: 43.4228, lon: -73.7126 },
      { name: "Lake Havasu", slug: "lake-havasu", state: "AZ", lat: 34.4839, lon: -114.3225 },
    ];

    let created = 0;

    for (const lake of lakes) {
      await this.prisma.attraction.upsert({
        where: { slug: lake.slug },
        update: {},
        create: {
          type: "lake",
          name: lake.name,
          slug: lake.slug,
          state: lake.state,
          country: "USA",
          latitude: new Prisma.Decimal(lake.lat),
          longitude: new Prisma.Decimal(lake.lon),
          metaTitle: `Camping at ${lake.name} - Lakeside Campgrounds & RV Parks`,
          metaDescription: `Find waterfront campgrounds and RV parks at ${lake.name}. Enjoy swimming, fishing, boating, and stunning lake views.`,
          activities: ["swimming", "fishing", "boating", "kayaking", "camping"],
        },
      });

      created++;
    }

    this.logger.log(`Seeded ${created} lakes`);
    return created;
  }
}
