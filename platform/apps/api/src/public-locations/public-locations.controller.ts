import { Controller, Get, Param, Query, NotFoundException } from "@nestjs/common";
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
   * List all states
   */
  @Get()
  async listStates() {
    return this.locationsService.listStates();
  }

  /**
   * Get popular destinations for homepage
   * NOTE: Must be defined BEFORE :slug route to prevent "featured" being caught as a slug
   */
  @Get("featured/destinations")
  async getPopularDestinations() {
    return this.locationsService.getPopularDestinations();
  }

  /**
   * Get cities in a state
   * NOTE: Must be defined BEFORE :slug route to prevent ":stateSlug/cities" conflicts
   */
  @Get(":stateSlug/cities")
  async getCitiesInState(@Param("stateSlug") stateSlug: string) {
    return this.locationsService.listCitiesInState(stateSlug);
  }

  /**
   * Get a location page by slug (state, city, or region)
   * NOTE: Param routes must be LAST to avoid catching literal paths
   */
  @Get(":slug")
  async getLocation(
    @Param("slug") slug: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("sortBy") sortBy?: "name" | "rating" | "distance",
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
}

@Controller("public/attractions")
export class PublicAttractionsController {
  constructor(private readonly locationsService: PublicLocationsService) {}

  /**
   * List all national parks
   * NOTE: Literal routes must be defined BEFORE param routes
   */
  @Get("type/national-parks")
  async listNationalParks() {
    return this.locationsService.listNationalParks();
  }

  /**
   * List attractions by type
   * NOTE: Must be before :slug but after type/national-parks
   */
  @Get("type/:type")
  async listByType(@Param("type") type: AttractionType) {
    return this.locationsService.listAttractionsByType(type);
  }

  /**
   * Get an attraction page by slug
   * NOTE: Param routes must be LAST to avoid catching literal paths
   */
  @Get(":slug")
  async getAttraction(
    @Param("slug") slug: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("maxDistance") maxDistance?: string,
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
}
