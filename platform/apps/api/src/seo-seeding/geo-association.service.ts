import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

/**
 * Geo-association service for linking campgrounds to SEO locations and attractions.
 *
 * This service:
 * - Associates campgrounds with their state, city, and region locations
 * - Finds nearby attractions (national parks, lakes, etc.)
 * - Calculates distances for sorting/filtering
 */

// Distance calculation using Haversine formula
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

@Injectable()
export class GeoAssociationService {
  private readonly logger = new Logger(GeoAssociationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Associate a campground with its geographic locations (state, city)
   */
  async associateCampgroundWithLocations(campgroundId: string): Promise<void> {
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: {
        id: true,
        state: true,
        city: true,
        latitude: true,
        longitude: true,
      },
    });

    if (!campground) {
      this.logger.warn(`Campground ${campgroundId} not found`);
      return;
    }

    const associations: Array<Omit<Prisma.CampgroundLocationCreateManyInput, "id">> = [];

    // Find or create state location
    if (campground.state) {
      const stateLocation = await this.findOrCreateStateLocation(campground.state);
      if (stateLocation) {
        associations.push({
          campgroundId,
          locationId: stateLocation.id,
          isPrimary: false,
        });
      }

      // Find or create city location
      if (campground.city) {
        const cityLocation = await this.findOrCreateCityLocation(
          campground.city,
          campground.state,
          campground.latitude?.toNumber(),
          campground.longitude?.toNumber(),
        );
        if (cityLocation) {
          associations.push({
            campgroundId,
            locationId: cityLocation.id,
            isPrimary: true, // City is the primary location
            distanceMiles: 0,
          });
        }
      }
    }

    // Create associations (skip if already exists)
    for (const assoc of associations) {
      await this.prisma.campgroundLocation.upsert({
        where: {
          campgroundId_locationId: {
            campgroundId: assoc.campgroundId,
            locationId: assoc.locationId,
          },
        },
        update: {},
        create: {
          id: randomUUID(),
          ...assoc,
        },
      });
    }
  }

  /**
   * Find or create a state-level SeoLocation
   */
  private async findOrCreateStateLocation(stateCode: string) {
    const stateNames: Record<string, string> = {
      AL: "Alabama",
      AK: "Alaska",
      AZ: "Arizona",
      AR: "Arkansas",
      CA: "California",
      CO: "Colorado",
      CT: "Connecticut",
      DE: "Delaware",
      FL: "Florida",
      GA: "Georgia",
      HI: "Hawaii",
      ID: "Idaho",
      IL: "Illinois",
      IN: "Indiana",
      IA: "Iowa",
      KS: "Kansas",
      KY: "Kentucky",
      LA: "Louisiana",
      ME: "Maine",
      MD: "Maryland",
      MA: "Massachusetts",
      MI: "Michigan",
      MN: "Minnesota",
      MS: "Mississippi",
      MO: "Missouri",
      MT: "Montana",
      NE: "Nebraska",
      NV: "Nevada",
      NH: "New Hampshire",
      NJ: "New Jersey",
      NM: "New Mexico",
      NY: "New York",
      NC: "North Carolina",
      ND: "North Dakota",
      OH: "Ohio",
      OK: "Oklahoma",
      OR: "Oregon",
      PA: "Pennsylvania",
      RI: "Rhode Island",
      SC: "South Carolina",
      SD: "South Dakota",
      TN: "Tennessee",
      TX: "Texas",
      UT: "Utah",
      VT: "Vermont",
      VA: "Virginia",
      WA: "Washington",
      WV: "West Virginia",
      WI: "Wisconsin",
      WY: "Wyoming",
    };

    const stateName = stateNames[stateCode] || stateCode;
    const slug = stateName.toLowerCase().replace(/\s+/g, "-");

    return this.prisma.seoLocation.upsert({
      where: { slug },
      update: {},
      create: {
        id: randomUUID(),
        type: "state",
        name: stateName,
        slug,
        state: stateCode,
        country: "USA",
        metaTitle: `Camping in ${stateName} - Find the Best Campgrounds`,
        metaDescription: `Discover the best campgrounds and RV parks in ${stateName}. Find campsites near national parks, lakes, and outdoor adventures.`,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Find or create a city-level SeoLocation
   */
  private async findOrCreateCityLocation(
    cityName: string,
    stateCode: string,
    latitude?: number,
    longitude?: number,
  ) {
    const slug = `${cityName}-${stateCode}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Find parent state
    const stateSlug = this.getStateSlug(stateCode);
    const stateLocation = await this.prisma.seoLocation.findUnique({
      where: { slug: stateSlug },
      select: { id: true },
    });

    return this.prisma.seoLocation.upsert({
      where: { slug },
      update: {},
      create: {
        id: randomUUID(),
        type: "city",
        name: cityName,
        slug,
        state: stateCode,
        country: "USA",
        ...(stateLocation ? { SeoLocation: { connect: { id: stateLocation.id } } } : {}),
        latitude: latitude ? new Prisma.Decimal(latitude) : undefined,
        longitude: longitude ? new Prisma.Decimal(longitude) : undefined,
        metaTitle: `Camping near ${cityName}, ${stateCode} - Best Campgrounds & RV Parks`,
        metaDescription: `Find the best campgrounds and RV parks near ${cityName}, ${stateCode}. Book your perfect campsite today.`,
        updatedAt: new Date(),
      },
    });
  }

  private getStateSlug(stateCode: string): string {
    const stateNames: Record<string, string> = {
      AL: "alabama",
      AK: "alaska",
      AZ: "arizona",
      AR: "arkansas",
      CA: "california",
      CO: "colorado",
      CT: "connecticut",
      DE: "delaware",
      FL: "florida",
      GA: "georgia",
      HI: "hawaii",
      ID: "idaho",
      IL: "illinois",
      IN: "indiana",
      IA: "iowa",
      KS: "kansas",
      KY: "kentucky",
      LA: "louisiana",
      ME: "maine",
      MD: "maryland",
      MA: "massachusetts",
      MI: "michigan",
      MN: "minnesota",
      MS: "mississippi",
      MO: "missouri",
      MT: "montana",
      NE: "nebraska",
      NV: "nevada",
      NH: "new-hampshire",
      NJ: "new-jersey",
      NM: "new-mexico",
      NY: "new-york",
      NC: "north-carolina",
      ND: "north-dakota",
      OH: "ohio",
      OK: "oklahoma",
      OR: "oregon",
      PA: "pennsylvania",
      RI: "rhode-island",
      SC: "south-carolina",
      SD: "south-dakota",
      TN: "tennessee",
      TX: "texas",
      UT: "utah",
      VT: "vermont",
      VA: "virginia",
      WA: "washington",
      WV: "west-virginia",
      WI: "wisconsin",
      WY: "wyoming",
    };
    return stateNames[stateCode] || stateCode.toLowerCase();
  }

  /**
   * Associate a campground with nearby attractions
   */
  async associateCampgroundWithAttractions(
    campgroundId: string,
    maxDistanceMiles: number = 100,
  ): Promise<void> {
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: {
        id: true,
        latitude: true,
        longitude: true,
      },
    });

    if (!campground || !campground.latitude || !campground.longitude) {
      return;
    }

    const lat = campground.latitude.toNumber();
    const lon = campground.longitude.toNumber();

    // Find attractions within the bounding box (rough filter)
    // 1 degree lat ~= 69 miles, 1 degree lon ~= 55 miles (varies by latitude)
    const latRange = maxDistanceMiles / 69;
    const lonRange = maxDistanceMiles / 55;

    const nearbyAttractions = await this.prisma.attraction.findMany({
      where: {
        latitude: {
          gte: new Prisma.Decimal(lat - latRange),
          lte: new Prisma.Decimal(lat + latRange),
        },
        longitude: {
          gte: new Prisma.Decimal(lon - lonRange),
          lte: new Prisma.Decimal(lon + lonRange),
        },
      },
      select: {
        id: true,
        latitude: true,
        longitude: true,
      },
    });

    // Calculate exact distances and create associations
    for (const attraction of nearbyAttractions) {
      const distance = haversineDistance(
        lat,
        lon,
        attraction.latitude.toNumber(),
        attraction.longitude.toNumber(),
      );

      if (distance <= maxDistanceMiles) {
        await this.prisma.campgroundAttraction.upsert({
          where: {
            campgroundId_attractionId: {
              campgroundId,
              attractionId: attraction.id,
            },
          },
          update: {
            distanceMiles: distance,
            isNearby: distance <= 50,
          },
          create: {
            id: randomUUID(),
            campgroundId,
            attractionId: attraction.id,
            distanceMiles: distance,
            isNearby: distance <= 50,
          },
        });
      }
    }
  }

  /**
   * Bulk associate all campgrounds with locations
   */
  async bulkAssociateLocations(
    onProgress?: (processed: number, total: number) => void,
  ): Promise<{ processed: number; errors: number }> {
    const campgrounds = await this.prisma.campground.findMany({
      where: {
        deletedAt: null,
        OR: [{ state: { not: null } }, { city: { not: null } }],
      },
      select: { id: true },
    });

    let processed = 0;
    let errors = 0;

    for (const cg of campgrounds) {
      try {
        await this.associateCampgroundWithLocations(cg.id);
        processed++;
      } catch (error) {
        this.logger.error(`Failed to associate campground ${cg.id}: ${error}`);
        errors++;
      }

      if (onProgress && processed % 100 === 0) {
        onProgress(processed, campgrounds.length);
      }
    }

    return { processed, errors };
  }

  /**
   * Bulk associate all campgrounds with attractions
   */
  async bulkAssociateAttractions(
    onProgress?: (processed: number, total: number) => void,
  ): Promise<{ processed: number; errors: number }> {
    const campgrounds = await this.prisma.campground.findMany({
      where: {
        deletedAt: null,
        latitude: { not: null },
        longitude: { not: null },
      },
      select: { id: true },
    });

    let processed = 0;
    let errors = 0;

    for (const cg of campgrounds) {
      try {
        await this.associateCampgroundWithAttractions(cg.id);
        processed++;
      } catch (error) {
        this.logger.error(`Failed to associate attractions for campground ${cg.id}: ${error}`);
        errors++;
      }

      if (onProgress && processed % 100 === 0) {
        onProgress(processed, campgrounds.length);
      }
    }

    return { processed, errors };
  }

  /**
   * Update stats for all locations (campground counts, avg ratings)
   */
  async updateLocationStats(): Promise<void> {
    this.logger.log("Updating location stats...");

    // Update state-level stats
    const states = await this.prisma.seoLocation.findMany({
      where: { type: "state" },
      select: { id: true, slug: true },
    });

    for (const state of states) {
      const stats = await this.prisma.campgroundLocation.aggregate({
        where: { locationId: state.id },
        _count: { campgroundId: true },
      });

      await this.prisma.seoLocation.update({
        where: { id: state.id },
        data: {
          campgroundCount: stats._count.campgroundId,
          statsUpdatedAt: new Date(),
        },
      });
    }

    // Update city-level stats
    const cities = await this.prisma.seoLocation.findMany({
      where: { type: "city" },
      select: { id: true },
    });

    for (const city of cities) {
      const stats = await this.prisma.campgroundLocation.aggregate({
        where: { locationId: city.id },
        _count: { campgroundId: true },
      });

      await this.prisma.seoLocation.update({
        where: { id: city.id },
        data: {
          campgroundCount: stats._count.campgroundId,
          statsUpdatedAt: new Date(),
        },
      });
    }

    this.logger.log("Location stats updated");
  }

  /**
   * Update stats for all attractions
   */
  async updateAttractionStats(): Promise<void> {
    this.logger.log("Updating attraction stats...");

    const attractions = await this.prisma.attraction.findMany({
      select: { id: true },
    });

    for (const attraction of attractions) {
      const stats = await this.prisma.campgroundAttraction.aggregate({
        where: { attractionId: attraction.id, isNearby: true },
        _count: { campgroundId: true },
      });

      await this.prisma.attraction.update({
        where: { id: attraction.id },
        data: {
          nearbyCampgroundCount: stats._count.campgroundId,
          statsUpdatedAt: new Date(),
        },
      });
    }

    this.logger.log("Attraction stats updated");
  }
}
