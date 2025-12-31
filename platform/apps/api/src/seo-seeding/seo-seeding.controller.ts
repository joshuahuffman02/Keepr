import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Logger,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { JwtAuthGuard, RolesGuard, Roles } from "../auth/guards";
import { PlatformRole, CampgroundDataSource, AttractionType, SeoLocationType } from "@prisma/client";
import { CampgroundSeederService } from "./campground-seeder.service";
import { SeedJobService } from "./seed-job.service";
import { SeoLocationService } from "./seo-location.service";
import { AttractionService } from "./attraction.service";
import { GeoAssociationService } from "./geo-association.service";

/**
 * SEO Seeding Controller
 *
 * Admin-only endpoints for:
 * - Triggering campground seeding from external sources
 * - Managing SEO locations (states, cities)
 * - Managing attractions (national parks, lakes)
 * - Viewing seeding job status
 */

// Valid US state codes
const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

@Controller("admin/seo-seeding")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PlatformRole.platform_admin)
export class SeoSeedingController {
  private readonly logger = new Logger(SeoSeedingController.name);

  constructor(
    private readonly seeder: CampgroundSeederService,
    private readonly seedJobs: SeedJobService,
    private readonly locations: SeoLocationService,
    private readonly attractions: AttractionService,
    private readonly geoAssociation: GeoAssociationService
  ) {}

  // =========================================================================
  // SEEDING ENDPOINTS
  // =========================================================================

  /**
   * Trigger seeding from Recreation.gov for a specific state
   */
  @Post("seed/recreation-gov/:stateCode")
  async seedRecreationGovState(
    @Param("stateCode") stateCode: string,
    @Body() body: { dryRun?: boolean; updateExisting?: boolean }
  ) {
    const state = stateCode.toUpperCase();
    if (!US_STATES.includes(state)) {
      throw new BadRequestException(`Invalid state code: ${stateCode}`);
    }

    // Check if already running
    const isRunning = await this.seedJobs.isJobRunning(
      CampgroundDataSource.recreation_gov,
      state
    );
    if (isRunning) {
      throw new BadRequestException(
        `A seeding job is already running for ${state}`
      );
    }

    // Create job
    const jobId = await this.seedJobs.createJob({
      dataSource: CampgroundDataSource.recreation_gov,
      targetState: state,
    });

    // Start async seeding (don't await)
    this.runSeedJob(jobId, state, body).catch((err) => {
      this.logger.error(`Seed job ${jobId} failed: ${err}`);
    });

    return {
      jobId,
      message: `Seeding job started for ${state}`,
      status: "pending",
    };
  }

  /**
   * Trigger seeding for all states (full nationwide seed)
   */
  @Post("seed/recreation-gov/all")
  async seedRecreationGovAll(
    @Body() body: { dryRun?: boolean; updateExisting?: boolean }
  ) {
    // Check if any nationwide job is running
    const isRunning = await this.seedJobs.isJobRunning(
      CampgroundDataSource.recreation_gov
    );
    if (isRunning) {
      throw new BadRequestException("A nationwide seeding job is already running");
    }

    // Create job
    const jobId = await this.seedJobs.createJob({
      dataSource: CampgroundDataSource.recreation_gov,
    });

    // Start async seeding
    this.runFullSeedJob(jobId, body).catch((err) => {
      this.logger.error(`Full seed job ${jobId} failed: ${err}`);
    });

    return {
      jobId,
      message: "Nationwide seeding job started",
      status: "pending",
    };
  }

  /**
   * Get seeding job status
   */
  @Get("jobs/:jobId")
  async getJobStatus(@Param("jobId") jobId: string) {
    const progress = await this.seedJobs.getJobProgress(jobId);
    if (!progress) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }
    return progress;
  }

  /**
   * List recent seeding jobs
   */
  @Get("jobs")
  async listJobs(
    @Query("limit") limit?: string,
    @Query("dataSource") dataSource?: CampgroundDataSource
  ) {
    return this.seedJobs.listJobs({
      limit: limit ? parseInt(limit, 10) : 20,
      dataSource,
    });
  }

  /**
   * Get overall seeding statistics
   */
  @Get("stats")
  async getStats() {
    const jobStats = await this.seedJobs.getJobStats();
    return jobStats;
  }

  // =========================================================================
  // LOCATION ENDPOINTS
  // =========================================================================

  /**
   * Seed all US states as SEO locations
   */
  @Post("locations/seed-states")
  async seedStates() {
    const created = await this.locations.seedAllStates();
    return { message: `Seeded ${created} US states`, created };
  }

  /**
   * List all state locations
   */
  @Get("locations/states")
  async listStates() {
    return this.locations.listStates();
  }

  /**
   * List cities in a state
   */
  @Get("locations/states/:stateSlug/cities")
  async listCitiesInState(@Param("stateSlug") stateSlug: string) {
    return this.locations.listCitiesInState(stateSlug);
  }

  /**
   * Get location by slug with campgrounds
   */
  @Get("locations/:slug")
  async getLocation(
    @Param("slug") slug: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string
  ) {
    const location = await this.locations.getBySlug(slug, {
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    if (!location) {
      throw new NotFoundException(`Location ${slug} not found`);
    }

    return location;
  }

  /**
   * List locations by type
   */
  @Get("locations")
  async listLocations(
    @Query("type") type: SeoLocationType,
    @Query("published") published?: string,
    @Query("minCampgrounds") minCampgrounds?: string
  ) {
    return this.locations.listByType(type, {
      published: published === "true" ? true : published === "false" ? false : undefined,
      minCampgrounds: minCampgrounds ? parseInt(minCampgrounds, 10) : undefined,
    });
  }

  /**
   * Publish a location
   */
  @Post("locations/:id/publish")
  async publishLocation(@Param("id") id: string) {
    return this.locations.publish(id);
  }

  /**
   * Auto-publish locations with enough campgrounds
   */
  @Post("locations/auto-publish")
  async autoPublishLocations(@Body() body: { minCampgrounds?: number }) {
    const count = await this.locations.autoPublishLocations(
      body.minCampgrounds || 5
    );
    return { message: `Auto-published ${count} locations`, count };
  }

  // =========================================================================
  // ATTRACTION ENDPOINTS
  // =========================================================================

  /**
   * Seed national parks
   */
  @Post("attractions/seed-national-parks")
  async seedNationalParks() {
    const created = await this.attractions.seedNationalParks();
    return { message: `Seeded ${created} national parks`, created };
  }

  /**
   * Seed lakes
   */
  @Post("attractions/seed-lakes")
  async seedLakes() {
    const created = await this.attractions.seedLakes();
    return { message: `Seeded ${created} lakes`, created };
  }

  /**
   * List national parks
   */
  @Get("attractions/national-parks")
  async listNationalParks() {
    return this.attractions.listNationalParks();
  }

  /**
   * Get attraction by slug with campgrounds
   */
  @Get("attractions/:slug")
  async getAttraction(
    @Param("slug") slug: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("maxDistance") maxDistance?: string
  ) {
    const attraction = await this.attractions.getBySlug(slug, {
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
      maxDistance: maxDistance ? parseInt(maxDistance, 10) : 50,
    });

    if (!attraction) {
      throw new NotFoundException(`Attraction ${slug} not found`);
    }

    return attraction;
  }

  /**
   * List attractions by type
   */
  @Get("attractions")
  async listAttractions(
    @Query("type") type: AttractionType,
    @Query("published") published?: string,
    @Query("minCampgrounds") minCampgrounds?: string
  ) {
    return this.attractions.listByType(type, {
      published: published === "true" ? true : published === "false" ? false : undefined,
      minCampgrounds: minCampgrounds ? parseInt(minCampgrounds, 10) : undefined,
    });
  }

  /**
   * Publish an attraction
   */
  @Post("attractions/:id/publish")
  async publishAttraction(@Param("id") id: string) {
    return this.attractions.publish(id);
  }

  // =========================================================================
  // GEO-ASSOCIATION ENDPOINTS
  // =========================================================================

  /**
   * Run bulk location association for all campgrounds
   */
  @Post("geo/associate-locations")
  async bulkAssociateLocations() {
    const result = await this.geoAssociation.bulkAssociateLocations(
      (processed, total) => {
        this.logger.log(`Location association: ${processed}/${total}`);
      }
    );
    return {
      message: `Associated ${result.processed} campgrounds with locations`,
      ...result,
    };
  }

  /**
   * Run bulk attraction association for all campgrounds
   */
  @Post("geo/associate-attractions")
  async bulkAssociateAttractions() {
    const result = await this.geoAssociation.bulkAssociateAttractions(
      (processed, total) => {
        this.logger.log(`Attraction association: ${processed}/${total}`);
      }
    );
    return {
      message: `Associated ${result.processed} campgrounds with attractions`,
      ...result,
    };
  }

  /**
   * Update location statistics
   */
  @Post("geo/update-location-stats")
  async updateLocationStats() {
    await this.geoAssociation.updateLocationStats();
    return { message: "Location stats updated" };
  }

  /**
   * Update attraction statistics
   */
  @Post("geo/update-attraction-stats")
  async updateAttractionStats() {
    await this.geoAssociation.updateAttractionStats();
    return { message: "Attraction stats updated" };
  }

  // =========================================================================
  // SEO SCORE ENDPOINTS
  // =========================================================================

  /**
   * Calculate SEO scores for all seeded campgrounds
   */
  @Post("seo-scores/calculate")
  async calculateSeoScores() {
    const result = await this.seeder.batchCalculateSeoScores();
    return {
      message: `Calculated SEO scores for ${result.processed} campgrounds`,
      avgScore: result.avgScore,
      processed: result.processed,
    };
  }

  // =========================================================================
  // PRIVATE HELPER METHODS
  // =========================================================================

  /**
   * Run a state-specific seed job
   */
  private async runSeedJob(
    jobId: string,
    stateCode: string,
    options: { dryRun?: boolean; updateExisting?: boolean }
  ): Promise<void> {
    try {
      await this.seedJobs.startJob(jobId);

      const result = await this.seeder.seedFromRecreationGov(stateCode, options);

      await this.seedJobs.completeJob(jobId, {
        recordsProcessed: result.created + result.updated + result.skipped,
        recordsCreated: result.created,
        recordsUpdated: result.updated,
        recordsFailed: result.errors,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.seedJobs.failJob(jobId, message);
      throw error;
    }
  }

  /**
   * Run a full nationwide seed job
   */
  private async runFullSeedJob(
    jobId: string,
    options: { dryRun?: boolean; updateExisting?: boolean }
  ): Promise<void> {
    try {
      await this.seedJobs.startJob(jobId);

      const result = await this.seeder.seedAllStatesFromRecreationGov(options);

      await this.seedJobs.completeJob(jobId, {
        recordsProcessed: result.created + result.updated + result.skipped,
        recordsCreated: result.created,
        recordsUpdated: result.updated,
        recordsFailed: result.errors,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.seedJobs.failJob(jobId, message);
      throw error;
    }
  }
}
