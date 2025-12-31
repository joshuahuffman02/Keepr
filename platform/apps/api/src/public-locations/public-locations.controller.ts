import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
} from "@nestjs/common";
import { PublicLocationsService } from "./public-locations.service";
import { AttractionType } from "@prisma/client";

/**
 * Public Locations Controller
 *
 * Unauthenticated endpoints for SEO location pages:
 * - /camping/[state-slug] - State camping pages
 * - /camping/[state-slug]/[city-slug] - City camping pages
 * - /near/[attraction-slug] - Camping near attractions
 * - /national-parks - List of national parks
 * - /states - List of all states
 */

@Controller("public/locations")
export class PublicLocationsController {
  constructor(private readonly locationsService: PublicLocationsService) {}

  /**
   * Get a location page by slug (state, city, or region)
   */
  @Get(":slug")
  async getLocation(
    @Param("slug") slug: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("sortBy") sortBy?: "name" | "rating" | "distance"
  ) {
    const location = await this.locationsService.getLocationBySlug(slug, {
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
      sortBy: sortBy || "name",
    });

    if (!location) {
      throw new NotFoundException(`Location not found: ${slug}`);
    }

    return location;
  }

  /**
   * Get cities in a state
   */
  @Get(":stateSlug/cities")
  async getCitiesInState(@Param("stateSlug") stateSlug: string) {
    return this.locationsService.listCitiesInState(stateSlug);
  }

  /**
   * List all states
   */
  @Get()
  async listStates() {
    return this.locationsService.listStates();
  }

  /**
   * Get popular destinations for homepage
   */
  @Get("featured/destinations")
  async getPopularDestinations() {
    return this.locationsService.getPopularDestinations();
  }
}

@Controller("public/attractions")
export class PublicAttractionsController {
  constructor(private readonly locationsService: PublicLocationsService) {}

  /**
   * Get an attraction page by slug
   */
  @Get(":slug")
  async getAttraction(
    @Param("slug") slug: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("maxDistance") maxDistance?: string
  ) {
    const attraction = await this.locationsService.getAttractionBySlug(slug, {
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
      maxDistance: maxDistance ? parseInt(maxDistance, 10) : 50,
    });

    if (!attraction) {
      throw new NotFoundException(`Attraction not found: ${slug}`);
    }

    return attraction;
  }

  /**
   * List all national parks
   */
  @Get("type/national-parks")
  async listNationalParks() {
    return this.locationsService.listNationalParks();
  }

  /**
   * List attractions by type
   */
  @Get("type/:type")
  async listByType(@Param("type") type: AttractionType) {
    return this.locationsService.listAttractionsByType(type);
  }
}
