import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CsvParserService, FieldMapping, ParseResult } from "./parsers/csv-parser.service";

export interface SiteImportRow {
  siteNumber: string;
  name?: string;
  siteType: "rv" | "tent" | "cabin" | "group" | "glamping";
  siteClassName?: string;
  maxOccupancy?: number;
  rigMaxLength?: number;
  hookupsPower?: boolean;
  hookupsWater?: boolean;
  hookupsSewer?: boolean;
  powerAmps?: number;
  petFriendly?: boolean;
  accessible?: boolean;
  pullThrough?: boolean;
  description?: string;
  status?: string;
}

export interface SiteImportPreview {
  totalRows: number;
  validRows: number;
  newSites: number;
  updateSites: number;
  errors: Array<{ row: number; message: string }>;
  warnings: Array<{ row: number; message: string }>;
  preview: Array<{
    rowNumber: number;
    data: SiteImportRow;
    action: "create" | "update" | "skip";
    existingSite?: { id: string; siteNumber: string };
  }>;
}

export interface SiteImportResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

@Injectable()
export class SiteImportService {
  private readonly logger = new Logger(SiteImportService.name);

  // Target fields with their aliases for auto-mapping
  static readonly targetFields = [
    { name: "siteNumber", aliases: ["site_number", "site_num", "site_id", "site", "number", "spot", "site #", "site#"] },
    { name: "name", aliases: ["site_name", "sitename", "display_name", "title"] },
    { name: "siteType", aliases: ["site_type", "type", "category", "site_category"] },
    { name: "siteClassName", aliases: ["site_class", "class", "class_name", "category_name"] },
    { name: "maxOccupancy", aliases: ["max_occupancy", "occupancy", "max_guests", "capacity", "max_people"] },
    { name: "rigMaxLength", aliases: ["max_length", "rig_length", "rv_length", "length_max", "max_rig_length"] },
    { name: "hookupsPower", aliases: ["power", "electric", "electricity", "has_power", "power_hookup"] },
    { name: "hookupsWater", aliases: ["water", "has_water", "water_hookup"] },
    { name: "hookupsSewer", aliases: ["sewer", "has_sewer", "sewer_hookup", "sewage"] },
    { name: "powerAmps", aliases: ["amps", "amperage", "power_amps", "electric_amps"] },
    { name: "petFriendly", aliases: ["pets", "pet_friendly", "allows_pets", "pets_allowed"] },
    { name: "accessible", aliases: ["ada", "handicap", "wheelchair", "accessibility", "ada_accessible"] },
    { name: "pullThrough", aliases: ["pull_through", "pullthru", "pull_thru", "back_in"] },
    { name: "description", aliases: ["desc", "notes", "site_description"] },
    { name: "status", aliases: ["site_status", "availability"] },
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly csvParser: CsvParserService
  ) {}

  /**
   * Get suggested field mappings for site import
   */
  suggestMappings(headers: string[]) {
    return this.csvParser.suggestFieldMappings(headers, SiteImportService.targetFields);
  }

  /**
   * Preview site import without committing
   */
  async previewImport(
    campgroundId: string,
    csvContent: string,
    fieldMappings: FieldMapping[]
  ): Promise<SiteImportPreview> {
    // Verify campground exists
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
    });

    if (!campground) {
      throw new BadRequestException("Campground not found");
    }

    // Parse CSV with mappings
    const parseResult = this.csvParser.parseCSV(csvContent, fieldMappings);

    if (!parseResult.success) {
      throw new BadRequestException(parseResult.errors.join("; "));
    }

    // Get existing sites for this campground
    const existingSites = await this.prisma.site.findMany({
      where: { campgroundId },
      select: { id: true, siteNumber: true },
    });

    const existingSiteMap = new Map(
      existingSites.map((s) => [s.siteNumber?.toLowerCase(), s])
    );

    // Get existing site classes
    const existingClasses = await this.prisma.siteClass.findMany({
      where: { campgroundId },
      select: { id: true, name: true },
    });

    const classMap = new Map(
      existingClasses.map((c) => [c.name.toLowerCase(), c.id])
    );

    const errors: Array<{ row: number; message: string }> = [];
    const warnings: Array<{ row: number; message: string }> = [];
    const preview: SiteImportPreview["preview"] = [];

    let newSites = 0;
    let updateSites = 0;

    for (const row of parseResult.rows) {
      const data = row.data as unknown as SiteImportRow;

      // Validate required fields
      if (!data.siteNumber) {
        errors.push({ row: row.rowNumber, message: "Site number is required" });
        continue;
      }

      if (!data.siteType) {
        errors.push({ row: row.rowNumber, message: "Site type is required" });
        continue;
      }

      // Validate site type
      const validTypes = ["rv", "tent", "cabin", "group", "glamping"];
      const normalizedType = data.siteType.toLowerCase();
      if (!validTypes.includes(normalizedType)) {
        errors.push({
          row: row.rowNumber,
          message: `Invalid site type "${data.siteType}". Must be one of: ${validTypes.join(", ")}`,
        });
        continue;
      }

      // Check if site exists
      const existing = existingSiteMap.get(data.siteNumber.toLowerCase());

      // Warn about unmapped site class
      if (data.siteClassName && !classMap.has(data.siteClassName.toLowerCase())) {
        warnings.push({
          row: row.rowNumber,
          message: `Site class "${data.siteClassName}" doesn't exist and will be created`,
        });
      }

      if (existing) {
        updateSites++;
        preview.push({
          rowNumber: row.rowNumber,
          data: { ...data, siteType: normalizedType as any },
          action: "update",
          existingSite: existing,
        });
      } else {
        newSites++;
        preview.push({
          rowNumber: row.rowNumber,
          data: { ...data, siteType: normalizedType as any },
          action: "create",
        });
      }
    }

    return {
      totalRows: parseResult.totalRows,
      validRows: preview.length,
      newSites,
      updateSites,
      errors,
      warnings,
      preview: preview.slice(0, 100), // Limit preview to 100 rows
    };
  }

  /**
   * Execute site import
   */
  async executeImport(
    campgroundId: string,
    csvContent: string,
    fieldMappings: FieldMapping[],
    options: { updateExisting?: boolean } = {}
  ): Promise<SiteImportResult> {
    const preview = await this.previewImport(campgroundId, csvContent, fieldMappings);

    if (preview.errors.length > 0 && preview.validRows === 0) {
      throw new BadRequestException("No valid rows to import");
    }

    const errors: Array<{ row: number; message: string }> = [...preview.errors];
    let created = 0;
    let updated = 0;
    let skipped = 0;

    // Get or create site classes
    const classMap = new Map<string, string>();
    const existingClasses = await this.prisma.siteClass.findMany({
      where: { campgroundId },
      select: { id: true, name: true },
    });

    for (const c of existingClasses) {
      classMap.set(c.name.toLowerCase(), c.id);
    }

    // Process each row
    for (const item of preview.preview) {
      try {
        // Resolve site class
        let siteClassId: string | undefined;
        if (item.data.siteClassName) {
          const className = item.data.siteClassName.toLowerCase();
          if (!classMap.has(className)) {
            // Create new site class
            const newClass = await this.prisma.siteClass.create({
              data: {
                campgroundId,
                name: item.data.siteClassName,
                siteType: item.data.siteType,
                maxOccupancy: item.data.maxOccupancy || 6,
              },
            });
            classMap.set(className, newClass.id);
          }
          siteClassId = classMap.get(className);
        }

        const siteData = {
          siteNumber: item.data.siteNumber,
          name: item.data.name || item.data.siteNumber,
          siteType: item.data.siteType,
          siteClassId,
          maxOccupancy: item.data.maxOccupancy || 6,
          rigMaxLength: item.data.rigMaxLength,
          hookupsPower: item.data.hookupsPower ?? false,
          hookupsWater: item.data.hookupsWater ?? false,
          hookupsSewer: item.data.hookupsSewer ?? false,
          powerAmps: item.data.powerAmps,
          petFriendly: item.data.petFriendly ?? true,
          accessible: item.data.accessible ?? false,
          pullThrough: item.data.pullThrough ?? false,
          description: item.data.description,
          status: item.data.status || "available",
          isActive: true,
        };

        if (item.action === "create") {
          await this.prisma.site.create({
            data: {
              campgroundId,
              ...siteData,
            },
          });
          created++;
        } else if (item.action === "update" && options.updateExisting) {
          await this.prisma.site.update({
            where: { id: item.existingSite!.id },
            data: siteData,
          });
          updated++;
        } else {
          skipped++;
        }
      } catch (err: any) {
        this.logger.error(`Error importing row ${item.rowNumber}: ${err.message}`);
        errors.push({ row: item.rowNumber, message: err.message });
      }
    }

    this.logger.log(
      `Site import complete: ${created} created, ${updated} updated, ${skipped} skipped`
    );

    return {
      success: errors.length === 0,
      created,
      updated,
      skipped,
      errors,
    };
  }

  /**
   * Get import template headers
   */
  getTemplateHeaders(): string[] {
    return [
      "siteNumber",
      "name",
      "siteType",
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
    ];
  }

  /**
   * Generate example CSV content
   */
  generateExampleCSV(): string {
    const headers = this.getTemplateHeaders();
    const exampleRows = [
      ["1", "Site 1", "rv", "Full Hookup", "6", "45", "true", "true", "true", "50", "true", "false", "true", "Large pull-through site"],
      ["2", "Site 2", "rv", "Full Hookup", "4", "35", "true", "true", "true", "30", "true", "false", "false", "Back-in site"],
      ["T1", "Tent Site 1", "tent", "Tent Sites", "4", "", "false", "false", "false", "", "true", "false", "false", "Shaded tent pad"],
      ["C1", "Cabin 1", "cabin", "Standard Cabin", "4", "", "true", "true", "false", "", "false", "true", "false", "ADA accessible cabin"],
    ];

    return [headers.join(","), ...exampleRows.map((r) => r.join(","))].join("\n");
  }
}
