import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CsvParserService, FieldMapping } from "./parsers/csv-parser.service";

export interface GuestImportRow {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  rigType?: string;
  rigLength?: number;
  vehiclePlate?: string;
  vehicleState?: string;
  notes?: string;
  vip?: boolean;
  tags?: string;
}

export interface GuestImportPreview {
  totalRows: number;
  validRows: number;
  newGuests: number;
  updateGuests: number;
  duplicateEmails: number;
  errors: Array<{ row: number; message: string }>;
  warnings: Array<{ row: number; message: string }>;
  preview: Array<{
    rowNumber: number;
    data: GuestImportRow;
    action: "create" | "update" | "skip";
    existingGuest?: { id: string; email: string };
  }>;
}

export interface GuestImportResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

@Injectable()
export class GuestImportService {
  private readonly logger = new Logger(GuestImportService.name);

  // Target fields with their aliases for auto-mapping
  static readonly targetFields = [
    { name: "firstName", aliases: ["first_name", "fname", "first", "given_name", "primary_first_name"] },
    { name: "lastName", aliases: ["last_name", "lname", "last", "surname", "family_name", "primary_last_name"] },
    { name: "email", aliases: ["email_address", "e_mail", "emailaddress", "contact_email"] },
    { name: "phone", aliases: ["phone_number", "telephone", "mobile", "cell", "primary_phone", "contact_phone"] },
    { name: "address1", aliases: ["address", "street_address", "street", "address_line_1", "address_1"] },
    { name: "address2", aliases: ["address_line_2", "apt", "suite", "unit", "address_2"] },
    { name: "city", aliases: ["town", "municipality"] },
    { name: "state", aliases: ["province", "region", "state_province"] },
    { name: "postalCode", aliases: ["postal_code", "zip", "zipcode", "zip_code", "postcode"] },
    { name: "country", aliases: ["nation", "country_code"] },
    { name: "rigType", aliases: ["rig_type", "rv_type", "vehicle_type", "unit_type"] },
    { name: "rigLength", aliases: ["rig_length", "rv_length", "vehicle_length", "unit_length"] },
    { name: "vehiclePlate", aliases: ["vehicle_plate", "license_plate", "plate", "plate_number"] },
    { name: "vehicleState", aliases: ["vehicle_state", "plate_state", "license_state"] },
    { name: "notes", aliases: ["guest_notes", "comments", "remarks"] },
    { name: "vip", aliases: ["is_vip", "vip_status", "priority"] },
    { name: "tags", aliases: ["guest_tags", "labels", "categories"] },
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly csvParser: CsvParserService
  ) {}

  /**
   * Get suggested field mappings for guest import
   */
  suggestMappings(headers: string[]) {
    return this.csvParser.suggestFieldMappings(headers, GuestImportService.targetFields);
  }

  /**
   * Preview guest import without committing
   */
  async previewImport(
    campgroundId: string,
    csvContent: string,
    fieldMappings: FieldMapping[]
  ): Promise<GuestImportPreview> {
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

    // Collect all emails from import
    const importEmails = new Set<string>();
    const emailCounts = new Map<string, number>();

    for (const row of parseResult.rows) {
      const email = (row.data.email as string)?.toLowerCase()?.trim();
      if (email) {
        importEmails.add(email);
        emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
      }
    }

    // Find existing guests by email
    const existingGuests = await this.prisma.guest.findMany({
      where: {
        campgroundId,
        emailNormalized: { in: Array.from(importEmails) },
      },
      select: { id: true, email: true, emailNormalized: true },
    });

    const existingGuestMap = new Map(
      existingGuests.map((g) => [g.emailNormalized, g])
    );

    const errors: Array<{ row: number; message: string }> = [];
    const warnings: Array<{ row: number; message: string }> = [];
    const preview: GuestImportPreview["preview"] = [];
    const seenEmails = new Set<string>();

    let newGuests = 0;
    let updateGuests = 0;
    let duplicateEmails = 0;

    for (const row of parseResult.rows) {
      const data = row.data as unknown as GuestImportRow;

      // Validate required fields
      if (!data.firstName) {
        errors.push({ row: row.rowNumber, message: "First name is required" });
        continue;
      }

      if (!data.lastName) {
        errors.push({ row: row.rowNumber, message: "Last name is required" });
        continue;
      }

      if (!data.email) {
        errors.push({ row: row.rowNumber, message: "Email is required" });
        continue;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        errors.push({ row: row.rowNumber, message: `Invalid email format: ${data.email}` });
        continue;
      }

      const normalizedEmail = data.email.toLowerCase().trim();

      // Check for duplicate in this import
      if (seenEmails.has(normalizedEmail)) {
        duplicateEmails++;
        warnings.push({
          row: row.rowNumber,
          message: `Duplicate email in import: ${data.email}`,
        });
        preview.push({
          rowNumber: row.rowNumber,
          data,
          action: "skip",
        });
        continue;
      }
      seenEmails.add(normalizedEmail);

      // Check if guest exists
      const existing = existingGuestMap.get(normalizedEmail);

      if (existing) {
        updateGuests++;
        preview.push({
          rowNumber: row.rowNumber,
          data,
          action: "update",
          existingGuest: { id: existing.id, email: existing.email },
        });
      } else {
        newGuests++;
        preview.push({
          rowNumber: row.rowNumber,
          data,
          action: "create",
        });
      }
    }

    return {
      totalRows: parseResult.totalRows,
      validRows: preview.filter((p) => p.action !== "skip").length,
      newGuests,
      updateGuests,
      duplicateEmails,
      errors,
      warnings,
      preview: preview.slice(0, 100), // Limit preview to 100 rows
    };
  }

  /**
   * Execute guest import
   */
  async executeImport(
    campgroundId: string,
    csvContent: string,
    fieldMappings: FieldMapping[],
    options: { updateExisting?: boolean; skipDuplicates?: boolean } = {}
  ): Promise<GuestImportResult> {
    const preview = await this.previewImport(campgroundId, csvContent, fieldMappings);

    if (preview.errors.length > 0 && preview.validRows === 0) {
      throw new BadRequestException("No valid rows to import");
    }

    const errors: Array<{ row: number; message: string }> = [...preview.errors];
    let created = 0;
    let updated = 0;
    let skipped = 0;

    // Process each row
    for (const item of preview.preview) {
      if (item.action === "skip") {
        skipped++;
        continue;
      }

      try {
        const guestData = {
          primaryFirstName: item.data.firstName,
          primaryLastName: item.data.lastName,
          email: item.data.email,
          emailNormalized: item.data.email.toLowerCase().trim(),
          phone: item.data.phone || null,
          phoneNormalized: item.data.phone?.replace(/[^0-9+]/g, "") || null,
          address1: item.data.address1 || null,
          address2: item.data.address2 || null,
          city: item.data.city || null,
          state: item.data.state || null,
          postalCode: item.data.postalCode || null,
          country: item.data.country || "US",
          rigType: item.data.rigType || null,
          rigLength: item.data.rigLength || null,
          vehiclePlate: item.data.vehiclePlate || null,
          vehicleState: item.data.vehicleState || null,
          notes: item.data.notes || null,
          vip: item.data.vip || false,
          tags: item.data.tags ? item.data.tags.split(",").map((t) => t.trim()) : [],
        };

        if (item.action === "create") {
          await this.prisma.guest.create({
            data: {
              campgroundId,
              ...guestData,
            },
          });
          created++;
        } else if (item.action === "update" && options.updateExisting) {
          await this.prisma.guest.update({
            where: { id: item.existingGuest!.id },
            data: guestData,
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
      `Guest import complete: ${created} created, ${updated} updated, ${skipped} skipped`
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
      "firstName",
      "lastName",
      "email",
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
    ];
  }

  /**
   * Generate example CSV content
   */
  generateExampleCSV(): string {
    const headers = this.getTemplateHeaders();
    const exampleRows = [
      ["John", "Smith", "john.smith@email.com", "555-123-4567", "123 Main St", "Apt 1", "Denver", "CO", "80202", "US", "Class A", "35", "ABC123", "CO", "Regular guest", "false", "repeat,family"],
      ["Jane", "Doe", "jane.doe@email.com", "555-987-6543", "456 Oak Ave", "", "Boulder", "CO", "80301", "US", "Fifth Wheel", "28", "XYZ789", "TX", "", "true", "vip,snowbird"],
      ["Bob", "Johnson", "bob.j@email.com", "555-555-5555", "789 Pine Rd", "", "Fort Collins", "CO", "80521", "US", "Travel Trailer", "22", "", "", "First time camper", "false", ""],
    ];

    return [headers.join(","), ...exampleRows.map((r) => r.join(","))].join("\n");
  }
}
