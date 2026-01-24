import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CsvParserService, FieldMapping } from "./parsers/csv-parser.service";
import { CampspotParserService } from "./parsers/campspot-parser.service";
import { NewbookParserService } from "./parsers/newbook-parser.service";
import { SiteImportService } from "./site-import.service";
import { GuestImportService } from "./guest-import.service";

export type ImportEntityType = "sites" | "guests" | "reservations";
export type ImportFormat = "csv" | "campspot" | "newbook" | "auto";

export interface ImportJob {
  id: string;
  campgroundId: string;
  entityType: ImportEntityType;
  format: ImportFormat;
  status: "pending" | "processing" | "completed" | "failed";
  fileName?: string;
  totalRows: number;
  processedRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: Array<{ row: number; message: string }>;
  createdAt: Date;
  completedAt?: Date;
}

export interface DetectedFormat {
  format: ImportFormat;
  confidence: number;
  headers: string[];
  suggestedMappings: Array<{
    sourceField: string;
    suggestedTarget: string;
    confidence: number;
  }>;
}

@Injectable()
export class DataImportService {
  private readonly logger = new Logger(DataImportService.name);
  private jobs = new Map<string, ImportJob>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly csvParser: CsvParserService,
    private readonly campspotParser: CampspotParserService,
    private readonly newbookParser: NewbookParserService,
    private readonly siteImport: SiteImportService,
    private readonly guestImport: GuestImportService,
  ) {}

  /**
   * Detect the format of uploaded CSV
   */
  detectFormat(csvContent: string, entityType: ImportEntityType): DetectedFormat {
    // Parse to get headers
    const parseResult = this.csvParser.parseCSV(csvContent);

    if (!parseResult.success || parseResult.headers.length === 0) {
      throw new BadRequestException("Unable to parse CSV file");
    }

    const headers = parseResult.headers;

    // Check for known formats
    const isCampspot = this.campspotParser.detectFormat(headers);
    const isNewbook = this.newbookParser.detectFormat(headers);

    let format: ImportFormat = "csv";
    let confidence = 0.5;
    let suggestedMappings;

    if (isCampspot) {
      format = "campspot";
      confidence = 0.9;
      suggestedMappings = this.getCampspotMappings(entityType, headers);
    } else if (isNewbook) {
      format = "newbook";
      confidence = 0.9;
      suggestedMappings = this.getNewbookMappings(entityType, headers);
    } else {
      // Generic CSV - suggest mappings based on entity type
      suggestedMappings = this.getGenericMappings(entityType, headers);
    }

    return {
      format,
      confidence,
      headers,
      suggestedMappings,
    };
  }

  /**
   * Get mappings for Campspot format
   */
  private getCampspotMappings(entityType: ImportEntityType, headers: string[]) {
    let mappings: FieldMapping[];

    switch (entityType) {
      case "sites":
        mappings = this.campspotParser.getSiteMappings();
        break;
      case "guests":
        mappings = this.campspotParser.getGuestMappings();
        break;
      case "reservations":
        mappings = this.campspotParser.getReservationMappings();
        break;
      default:
        mappings = [];
    }

    // Filter to only include mappings where source field exists
    const headerSet = new Set(headers.map((h) => h.toLowerCase()));
    return mappings
      .filter((m) => headerSet.has(m.sourceField.toLowerCase()))
      .map((m) => ({
        sourceField: m.sourceField,
        suggestedTarget: m.targetField,
        confidence: 0.95,
      }));
  }

  /**
   * Get mappings for NewBook format
   */
  private getNewbookMappings(entityType: ImportEntityType, headers: string[]) {
    let mappings: FieldMapping[];

    switch (entityType) {
      case "sites":
        mappings = this.newbookParser.getSiteMappings();
        break;
      case "guests":
        mappings = this.newbookParser.getGuestMappings();
        break;
      case "reservations":
        mappings = this.newbookParser.getReservationMappings();
        break;
      default:
        mappings = [];
    }

    // Filter to only include mappings where source field exists
    const headerSet = new Set(headers.map((h) => h.toLowerCase()));
    return mappings
      .filter((m) => headerSet.has(m.sourceField.toLowerCase()))
      .map((m) => ({
        sourceField: m.sourceField,
        suggestedTarget: m.targetField,
        confidence: 0.95,
      }));
  }

  /**
   * Get generic mappings based on header similarity
   */
  private getGenericMappings(entityType: ImportEntityType, headers: string[]) {
    switch (entityType) {
      case "sites":
        return this.siteImport.suggestMappings(headers);
      case "guests":
        return this.guestImport.suggestMappings(headers);
      default:
        return [];
    }
  }

  /**
   * Preview import
   */
  async previewImport(
    campgroundId: string,
    entityType: ImportEntityType,
    csvContent: string,
    fieldMappings: FieldMapping[],
  ) {
    switch (entityType) {
      case "sites":
        return this.siteImport.previewImport(campgroundId, csvContent, fieldMappings);
      case "guests":
        return this.guestImport.previewImport(campgroundId, csvContent, fieldMappings);
      default:
        throw new BadRequestException(`Unsupported entity type: ${entityType}`);
    }
  }

  /**
   * Execute import
   */
  async executeImport(
    campgroundId: string,
    entityType: ImportEntityType,
    csvContent: string,
    fieldMappings: FieldMapping[],
    options: { updateExisting?: boolean } = {},
  ) {
    // Create job record
    const jobId = this.generateJobId();
    const job: ImportJob = {
      id: jobId,
      campgroundId,
      entityType,
      format: "csv",
      status: "processing",
      totalRows: 0,
      processedRows: 0,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      errors: [],
      createdAt: new Date(),
    };
    this.jobs.set(jobId, job);

    try {
      let result;

      switch (entityType) {
        case "sites":
          result = await this.siteImport.executeImport(
            campgroundId,
            csvContent,
            fieldMappings,
            options,
          );
          break;
        case "guests":
          result = await this.guestImport.executeImport(
            campgroundId,
            csvContent,
            fieldMappings,
            options,
          );
          break;
        default:
          throw new BadRequestException(`Unsupported entity type: ${entityType}`);
      }

      // Update job with results
      job.status = result.success ? "completed" : "failed";
      job.createdCount = result.created;
      job.updatedCount = result.updated;
      job.skippedCount = result.skipped;
      job.errorCount = result.errors.length;
      job.errors = result.errors;
      job.completedAt = new Date();

      return { jobId, ...result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      job.status = "failed";
      job.errors = [{ row: 0, message }];
      job.completedAt = new Date();
      throw err;
    }
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): ImportJob | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Get import schema for entity type
   */
  getImportSchema(entityType: ImportEntityType) {
    switch (entityType) {
      case "sites":
        return {
          entityType,
          requiredFields: ["siteNumber", "siteType"],
          optionalFields: [
            "name",
            "siteClassName",
            "maxOccupancy",
            "rigMaxLength",
            "hookupsPower",
            "hookupsWater",
            "hookupsSewer",
            "powerAmps",
            "petFriendly",
            "accessible",
            "pullThrough",
            "description",
            "status",
          ],
          fieldDescriptions: {
            siteNumber: "Unique identifier for the site (e.g., '1', 'A1', 'T5')",
            name: "Display name (defaults to siteNumber if not provided)",
            siteType: "Type of site: rv, tent, cabin, group, or glamping",
            siteClassName: "Site class/category name",
            maxOccupancy: "Maximum number of guests",
            rigMaxLength: "Maximum RV/trailer length in feet",
            hookupsPower: "Has electric hookup (true/false)",
            hookupsWater: "Has water hookup (true/false)",
            hookupsSewer: "Has sewer hookup (true/false)",
            powerAmps: "Amperage available (15, 30, 50)",
            petFriendly: "Allows pets (true/false)",
            accessible: "ADA accessible (true/false)",
            pullThrough: "Pull-through site (true/false)",
            description: "Site description",
            status: "Site status (available, maintenance, etc.)",
          },
          exampleCSV: this.siteImport.generateExampleCSV(),
        };

      case "guests":
        return {
          entityType,
          requiredFields: ["firstName", "lastName", "email"],
          optionalFields: [
            "phone",
            "address1",
            "address2",
            "city",
            "state",
            "postalCode",
            "country",
            "rigType",
            "rigLength",
            "vehiclePlate",
            "vehicleState",
            "notes",
            "vip",
            "tags",
          ],
          fieldDescriptions: {
            firstName: "Guest's first name",
            lastName: "Guest's last name",
            email: "Email address (must be unique)",
            phone: "Phone number",
            address1: "Street address",
            address2: "Apt/Suite/Unit",
            city: "City",
            state: "State/Province",
            postalCode: "ZIP/Postal code",
            country: "Country (2-letter code)",
            rigType: "RV/Trailer type",
            rigLength: "RV/Trailer length in feet",
            vehiclePlate: "License plate number",
            vehicleState: "License plate state",
            notes: "Guest notes",
            vip: "VIP guest (true/false)",
            tags: "Comma-separated tags",
          },
          exampleCSV: this.guestImport.generateExampleCSV(),
        };

      default:
        throw new BadRequestException(`Unknown entity type: ${entityType}`);
    }
  }

  /**
   * Get template CSV for download
   */
  getTemplate(entityType: ImportEntityType): string {
    switch (entityType) {
      case "sites":
        return this.siteImport.generateExampleCSV();
      case "guests":
        return this.guestImport.generateExampleCSV();
      default:
        throw new BadRequestException(`Unknown entity type: ${entityType}`);
    }
  }

  private generateJobId(): string {
    return `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
