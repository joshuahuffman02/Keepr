import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RecreationGovService, RecreationGovFacility } from "./recreation-gov.service";
import { GeoAssociationService } from "./geo-association.service";
import { CampgroundDataSource, CampgroundClaimStatus } from "@prisma/client";
import { randomUUID } from "crypto";

/**
 * Campground Seeder Service
 *
 * Orchestrates the process of seeding campgrounds from external data sources
 * into the database. This creates "unclaimed" campground listings that can
 * later be claimed by their actual owners.
 */

export interface SeedResult {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  errorDetails: Array<{ record: string; error: string }>;
}

@Injectable()
export class CampgroundSeederService {
  private readonly logger = new Logger(CampgroundSeederService.name);

  // Default organization for seeded (unclaimed) campgrounds
  // This should be a platform-level organization
  private readonly defaultOrgId = process.env.SEEDED_CAMPGROUND_ORG_ID;

  constructor(
    private readonly prisma: PrismaService,
    private readonly recreationGov: RecreationGovService,
    private readonly geoAssociation: GeoAssociationService,
  ) {}

  /**
   * Seed campgrounds from Recreation.gov for a specific state
   */
  async seedFromRecreationGov(
    stateCode: string,
    options: { dryRun?: boolean; updateExisting?: boolean } = {},
  ): Promise<SeedResult> {
    const result: SeedResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      errorDetails: [],
    };

    // Ensure we have an organization for seeded campgrounds
    const orgId = await this.ensureSeededOrganization();

    this.logger.log(
      `Starting Recreation.gov seed for state: ${stateCode} (dryRun: ${options.dryRun})`,
    );

    // Fetch facilities from Recreation.gov
    const facilities = await this.recreationGov.getCampgroundsByState(
      stateCode,
      (processed, total) => {
        this.logger.log(`Fetching: ${processed}/${total} facilities...`);
      },
    );

    this.logger.log(`Fetched ${facilities.length} facilities. Processing...`);

    // Process each facility
    for (const facility of facilities) {
      try {
        const processResult = await this.processFacility(facility, orgId, options);
        if (processResult === "created") result.created++;
        else if (processResult === "updated") result.updated++;
        else if (processResult === "skipped") result.skipped++;
      } catch (error) {
        result.errors++;
        result.errorDetails.push({
          record: facility.FacilityID,
          error: error instanceof Error ? error.message : String(error),
        });
        this.logger.error(`Failed to process facility ${facility.FacilityID}: ${error}`);
      }
    }

    this.logger.log(
      `Completed seeding ${stateCode}: created=${result.created}, updated=${result.updated}, skipped=${result.skipped}, errors=${result.errors}`,
    );

    return result;
  }

  /**
   * Process a single Recreation.gov facility
   */
  private async processFacility(
    facility: RecreationGovFacility,
    organizationId: string,
    options: { dryRun?: boolean; updateExisting?: boolean },
  ): Promise<"created" | "updated" | "skipped"> {
    // Check if already exists
    const existing = await this.prisma.campground.findFirst({
      where: {
        seededDataSource: CampgroundDataSource.recreation_gov,
        seededDataSourceId: facility.FacilityID,
      },
      select: {
        id: true,
        claimStatus: true,
        updatedAt: true,
      },
    });

    // Skip if claimed (don't overwrite owner's data)
    if (existing?.claimStatus === CampgroundClaimStatus.claimed) {
      return "skipped";
    }

    // Skip if exists and not updating
    if (existing && !options.updateExisting) {
      return "skipped";
    }

    // Map to our format
    const campgroundData = this.recreationGov.mapFacilityToCampground(facility, organizationId);

    if (options.dryRun) {
      this.logger.debug(
        `[DRY RUN] Would ${existing ? "update" : "create"}: ${campgroundData.name}`,
      );
      return existing ? "updated" : "created";
    }

    if (existing) {
      // Update existing
      await this.prisma.campground.update({
        where: { id: existing.id },
        data: {
          ...campgroundData,
          seededAt: new Date(),
          lastEnrichedAt: new Date(),
        },
      });

      // Re-associate with locations
      await this.geoAssociation.associateCampgroundWithLocations(existing.id);
      await this.geoAssociation.associateCampgroundWithAttractions(existing.id);

      return "updated";
    } else {
      // Create new
      const created = await this.prisma.campground.create({
        data: {
          id: randomUUID(),
          ...campgroundData,
          organizationId,
          claimStatus: CampgroundClaimStatus.unclaimed,
          seededAt: new Date(),
          lastEnrichedAt: new Date(),
        },
      });

      // Associate with locations and attractions
      await this.geoAssociation.associateCampgroundWithLocations(created.id);
      await this.geoAssociation.associateCampgroundWithAttractions(created.id);

      return "created";
    }
  }

  /**
   * Seed all states from Recreation.gov (full nationwide seed)
   */
  async seedAllStatesFromRecreationGov(
    options: { dryRun?: boolean; updateExisting?: boolean } = {},
  ): Promise<SeedResult> {
    const states = [
      "AL",
      "AK",
      "AZ",
      "AR",
      "CA",
      "CO",
      "CT",
      "DE",
      "FL",
      "GA",
      "HI",
      "ID",
      "IL",
      "IN",
      "IA",
      "KS",
      "KY",
      "LA",
      "ME",
      "MD",
      "MA",
      "MI",
      "MN",
      "MS",
      "MO",
      "MT",
      "NE",
      "NV",
      "NH",
      "NJ",
      "NM",
      "NY",
      "NC",
      "ND",
      "OH",
      "OK",
      "OR",
      "PA",
      "RI",
      "SC",
      "SD",
      "TN",
      "TX",
      "UT",
      "VT",
      "VA",
      "WA",
      "WV",
      "WI",
      "WY",
    ];

    const totalResult: SeedResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      errorDetails: [],
    };

    for (const state of states) {
      try {
        const stateResult = await this.seedFromRecreationGov(state, options);
        totalResult.created += stateResult.created;
        totalResult.updated += stateResult.updated;
        totalResult.skipped += stateResult.skipped;
        totalResult.errors += stateResult.errors;
        totalResult.errorDetails.push(...stateResult.errorDetails);

        // Sleep between states to avoid rate limits
        await this.sleep(2000);
      } catch (error) {
        this.logger.error(`Failed to seed state ${state}: ${error}`);
      }
    }

    // Update location and attraction stats
    await this.geoAssociation.updateLocationStats();
    await this.geoAssociation.updateAttractionStats();

    return totalResult;
  }

  /**
   * Ensure we have an organization for seeded campgrounds
   */
  private async ensureSeededOrganization(): Promise<string> {
    if (this.defaultOrgId) {
      return this.defaultOrgId;
    }

    // Find or create a "Seeded Campgrounds" organization
    const existingOrg = await this.prisma.organization.findFirst({
      where: { name: "Seeded Campgrounds" },
      select: { id: true },
    });

    if (existingOrg) {
      return existingOrg.id;
    }

    const newOrg = await this.prisma.organization.create({
      data: {
        id: randomUUID(),
        name: "Seeded Campgrounds",
      },
    });

    this.logger.log(`Created organization for seeded campgrounds: ${newOrg.id}`);
    return newOrg.id;
  }

  /**
   * Calculate SEO score for a campground based on data completeness
   */
  async calculateSeoScore(campgroundId: string): Promise<{
    score: number;
    missingFields: string[];
  }> {
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      select: {
        name: true,
        description: true,
        tagline: true,
        heroImageUrl: true,
        photos: true,
        amenities: true,
        latitude: true,
        longitude: true,
        address1: true,
        city: true,
        state: true,
        postalCode: true,
        phone: true,
        email: true,
        website: true,
        checkInTime: true,
        checkOutTime: true,
      },
    });

    if (!campground) {
      return { score: 0, missingFields: ["campground_not_found"] };
    }

    const fields = [
      { name: "name", weight: 10, value: campground.name },
      { name: "description", weight: 15, value: campground.description },
      { name: "tagline", weight: 5, value: campground.tagline },
      { name: "heroImageUrl", weight: 10, value: campground.heroImageUrl },
      {
        name: "photos",
        weight: 10,
        value: campground.photos && campground.photos.length > 0,
      },
      {
        name: "amenities",
        weight: 10,
        value: campground.amenities && campground.amenities.length > 0,
      },
      {
        name: "coordinates",
        weight: 10,
        value: campground.latitude && campground.longitude,
      },
      { name: "address", weight: 5, value: campground.address1 },
      { name: "city", weight: 5, value: campground.city },
      { name: "state", weight: 5, value: campground.state },
      { name: "postalCode", weight: 3, value: campground.postalCode },
      { name: "phone", weight: 4, value: campground.phone },
      { name: "email", weight: 3, value: campground.email },
      { name: "website", weight: 3, value: campground.website },
      { name: "checkInTime", weight: 1, value: campground.checkInTime },
      { name: "checkOutTime", weight: 1, value: campground.checkOutTime },
    ];

    let totalWeight = 0;
    let earnedWeight = 0;
    const missingFields: string[] = [];

    for (const field of fields) {
      totalWeight += field.weight;
      if (field.value) {
        earnedWeight += field.weight;
      } else {
        missingFields.push(field.name);
      }
    }

    const score = Math.round((earnedWeight / totalWeight) * 100);

    // Update the campground with its SEO score
    await this.prisma.campground.update({
      where: { id: campgroundId },
      data: {
        seoScore: score,
        seoMissingFields: missingFields,
      },
    });

    return { score, missingFields };
  }

  /**
   * Batch calculate SEO scores for all seeded campgrounds
   */
  async batchCalculateSeoScores(): Promise<{
    processed: number;
    avgScore: number;
  }> {
    const campgrounds = await this.prisma.campground.findMany({
      where: {
        seededDataSource: { not: null },
        deletedAt: null,
      },
      select: { id: true },
    });

    let totalScore = 0;
    let processed = 0;

    for (const cg of campgrounds) {
      const result = await this.calculateSeoScore(cg.id);
      totalScore += result.score;
      processed++;

      if (processed % 100 === 0) {
        this.logger.log(`Calculated SEO scores: ${processed}/${campgrounds.length}`);
      }
    }

    return {
      processed,
      avgScore: processed > 0 ? Math.round(totalScore / processed) : 0,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
