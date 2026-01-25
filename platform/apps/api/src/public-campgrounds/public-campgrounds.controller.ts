import { Controller, Get, Param, Query, NotFoundException } from "@nestjs/common";
import { ApiExcludeEndpoint } from "@nestjs/swagger";
import { PublicCampgroundsService, CampgroundSearchOptions } from "./public-campgrounds.service";
import { CampgroundClaimStatus } from "@prisma/client";

/**
 * Public Campgrounds Controller
 *
 * Unauthenticated endpoints for browsing campgrounds.
 * Used for:
 * - SEO landing pages
 * - Campground detail pages
 * - Search results
 * - Featured campgrounds
 */

@Controller("public/campgrounds")
export class PublicCampgroundsController {
  constructor(private readonly publicCampgrounds: PublicCampgroundsService) {}

  /**
   * Get a campground by slug (for individual campground pages)
   */
  @Get(":slug")
  async getCampground(@Param("slug") slug: string) {
    const campground = await this.publicCampgrounds.getBySlug(slug);
    if (!campground) {
      throw new NotFoundException(`Campground not found: ${slug}`);
    }
    return campground;
  }

  /**
   * Get similar campgrounds (for recommendations)
   */
  @Get(":slug/similar")
  async getSimilar(@Param("slug") slug: string, @Query("limit") limit?: string) {
    const campground = await this.publicCampgrounds.getBySlug(slug);
    if (!campground) {
      throw new NotFoundException(`Campground not found: ${slug}`);
    }

    return this.publicCampgrounds.getSimilar(campground.id, limit ? parseInt(limit, 10) : 4);
  }

  /**
   * Search campgrounds with filters
   */
  @Get()
  @ApiExcludeEndpoint()
  async searchCampgrounds(
    @Query("state") state?: string,
    @Query("city") city?: string,
    @Query("amenities") amenities?: string,
    @Query("minRating") minRating?: string,
    @Query("claimStatus") claimStatus?: CampgroundClaimStatus,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("sortBy") sortBy?: "name" | "rating" | "distance" | "reviewCount",
  ) {
    const options: CampgroundSearchOptions = {
      state,
      city,
      amenities: amenities ? amenities.split(",") : undefined,
      minRating: minRating ? parseFloat(minRating) : undefined,
      claimStatus,
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
      sortBy: sortBy || "name",
    };

    return this.publicCampgrounds.search(options);
  }

  /**
   * Get featured campgrounds
   */
  @Get("featured/list")
  async getFeaturedCampgrounds(@Query("limit") limit?: string) {
    return this.publicCampgrounds.getFeatured(limit ? parseInt(limit, 10) : 8);
  }

  /**
   * Get unclaimed campgrounds for the claim page
   */
  @Get("unclaimed/list")
  async getUnclaimedCampgrounds(
    @Query("state") state?: string,
    @Query("search") search?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.publicCampgrounds.getUnclaimedForClaim({
      state,
      search,
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }
}
