import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { CsvParserService, FieldMapping } from "./parsers/csv-parser.service";

const BLOCKED_SITE_STATUSES = ["maintenance", "inactive"];

// ============ Types ============

export interface ReservationImportColumnMapping {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  arrivalDate: string;
  departureDate: string;
  siteNumber?: string;
  siteName?: string;
  siteClass?: string;
  totalAmount?: string;
  paidAmount?: string;
  adults?: string;
  children?: string;
  confirmationNumber?: string;
  status?: string;
  notes?: string;
}

export interface ParsedReservationRow {
  rowIndex: number;
  rawData: Record<string, string>;
  guest: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
  };
  stay: {
    arrivalDate: Date;
    departureDate: Date;
    nights: number;
  };
  siteIdentifier: {
    siteNumber?: string;
    siteName?: string;
    siteClassName?: string;
  };
  pricing: {
    totalAmountCents?: number;
    paidAmountCents?: number;
    balanceCents?: number;
  };
  meta: {
    confirmationNumber?: string;
    status?: string;
    notes?: string;
    adults: number;
    children: number;
  };
  errors: string[];
}

export interface SiteMatchResult {
  matchType: "exact_number" | "exact_name" | "class_assignment" | "manual_required";
  matchedSiteId?: string;
  matchedSiteName?: string;
  matchedSiteNumber?: string;
  suggestedSiteClassId?: string;
  suggestedSiteClassName?: string;
  availableSites?: Array<{ id: string; name: string; siteNumber: string }>;
  conflict?: string;
}

export interface GuestMatchResult {
  matchType: "existing" | "will_create";
  existingGuestId?: string;
  existingGuestName?: string;
  existingGuestEmail?: string;
}

export interface PricingComparison {
  csvTotalCents: number;
  calculatedTotalCents: number;
  difference: number;
  differencePercent: number;
  requiresReview: boolean;
}

export interface MatchResult {
  rowIndex: number;
  site: SiteMatchResult;
  guest: GuestMatchResult;
  pricing: PricingComparison;
  useSystemPricing: boolean;
  skip: boolean;
}

export interface ReservationImportPreview {
  parsedRows: ParsedReservationRow[];
  matchResults: MatchResult[];
  summary: {
    totalRows: number;
    validRows: number;
    sitesMatched: number;
    sitesNeedSelection: number;
    guestsFound: number;
    guestsToCreate: number;
    hasConflicts: number;
    pricingDiscrepancies: number;
  };
}

export interface ReservationImportExecuteRow {
  rowIndex: number;
  siteId?: string;
  siteClassId?: string;
  guestId?: string;
  createGuest?: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
  };
  useSystemPricing: boolean;
  manualTotalOverrideCents?: number;
  skip: boolean;
}

export interface ReservationImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: Array<{ rowIndex: number; error: string }>;
  createdReservationIds: string[];
  createdGuestIds: string[];
}

// ============ Service ============

@Injectable()
export class ReservationImportService {
  private readonly logger = new Logger(ReservationImportService.name);

  // Target fields with aliases for auto-mapping
  static readonly targetFields = [
    {
      name: "firstName",
      aliases: ["first_name", "firstname", "first", "guest_first_name", "primary_first"],
    },
    {
      name: "lastName",
      aliases: ["last_name", "lastname", "last", "guest_last_name", "primary_last", "surname"],
    },
    { name: "email", aliases: ["email_address", "guest_email", "primary_email", "e-mail"] },
    {
      name: "phone",
      aliases: ["phone_number", "telephone", "guest_phone", "primary_phone", "mobile", "cell"],
    },
    {
      name: "arrivalDate",
      aliases: ["arrival", "check_in", "checkin", "check_in_date", "start_date", "arrive"],
    },
    {
      name: "departureDate",
      aliases: ["departure", "check_out", "checkout", "check_out_date", "end_date", "depart"],
    },
    {
      name: "siteNumber",
      aliases: ["site_number", "site_num", "site_id", "site", "spot", "site_#", "site#", "unit"],
    },
    { name: "siteName", aliases: ["site_name", "sitename", "spot_name"] },
    {
      name: "siteClass",
      aliases: ["site_class", "site_type", "category", "class", "type", "accommodation_type"],
    },
    {
      name: "totalAmount",
      aliases: [
        "total",
        "total_amount",
        "amount",
        "price",
        "total_price",
        "reservation_total",
        "grand_total",
      ],
    },
    {
      name: "paidAmount",
      aliases: ["paid", "paid_amount", "amount_paid", "payments", "collected"],
    },
    { name: "adults", aliases: ["adult_count", "num_adults", "adult_guests", "adults_count"] },
    {
      name: "children",
      aliases: ["child_count", "num_children", "kids", "children_count", "minors"],
    },
    {
      name: "confirmationNumber",
      aliases: [
        "confirmation",
        "confirmation_number",
        "conf_number",
        "conf_#",
        "booking_id",
        "reservation_id",
        "res_id",
      ],
    },
    { name: "status", aliases: ["reservation_status", "booking_status", "state"] },
    { name: "notes", aliases: ["note", "comments", "remarks", "special_requests", "guest_notes"] },
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly csvParser: CsvParserService,
  ) {}

  /**
   * Get suggested field mappings for reservation import
   */
  suggestMappings(
    headers: string[],
  ): Array<{ sourceField: string; suggestedTarget: string; confidence: number }> {
    return this.csvParser.suggestFieldMappings(headers, ReservationImportService.targetFields);
  }

  /**
   * Parse CSV and detect columns
   */
  async parseAndDetectColumns(
    csvContent: string,
    campgroundId: string,
  ): Promise<{
    headers: string[];
    suggestedMapping: Record<string, string>;
    sampleRows: Record<string, string>[];
    totalRows: number;
  }> {
    const parseResult = this.csvParser.parseCSV(csvContent);

    if (!parseResult.success || parseResult.headers.length === 0) {
      throw new BadRequestException("Unable to parse CSV file");
    }

    const suggestions = this.suggestMappings(parseResult.headers);
    const suggestedMapping: Record<string, string> = {};

    for (const s of suggestions) {
      if (s.confidence >= 0.6) {
        suggestedMapping[s.suggestedTarget] = s.sourceField;
      }
    }

    return {
      headers: parseResult.headers,
      suggestedMapping,
      sampleRows: parseResult.rows.slice(0, 5).map((r) => this.normalizeRowData(r.data)),
      totalRows: parseResult.rows.length,
    };
  }

  /**
   * Preview import with full matching and pricing comparison
   */
  async previewImport(
    campgroundId: string,
    csvContent: string,
    mapping: ReservationImportColumnMapping,
  ): Promise<ReservationImportPreview> {
    // Verify campground exists
    const campground = await this.prisma.campground.findUnique({
      where: { id: campgroundId },
      include: {
        SiteClass: { where: { isActive: true } },
        Site: {
          where: { isActive: true, status: { notIn: BLOCKED_SITE_STATUSES } },
          select: { id: true, name: true, siteNumber: true, siteClassId: true },
        },
      },
    });

    if (!campground) {
      throw new BadRequestException("Campground not found");
    }
    const sites = campground.Site;
    const siteClasses = campground.SiteClass;

    // Build field mappings for CSV parser
    const fieldMappings: FieldMapping[] = [];
    for (const [target, source] of Object.entries(mapping)) {
      if (source) {
        fieldMappings.push({ sourceField: source, targetField: target });
      }
    }

    // Parse CSV
    const parseResult = this.csvParser.parseCSV(csvContent, fieldMappings);
    if (!parseResult.success) {
      throw new BadRequestException(parseResult.errors?.join("; ") || "Failed to parse CSV");
    }

    // Parse each row
    const parsedRows: ParsedReservationRow[] = [];
    for (let i = 0; i < parseResult.rows.length; i++) {
      const row = parseResult.rows[i];
      const parsed = this.parseRow(i, this.normalizeRowData(row.data), mapping);
      parsedRows.push(parsed);
    }

    // OPTIMIZATION: Batch prefetch data to avoid N+1 queries
    // 1. Get date range for all reservations
    const allArrivalDates = parsedRows.map((p) => p.stay.arrivalDate);
    const allDepartureDates = parsedRows.map((p) => p.stay.departureDate);
    const minArrival = new Date(Math.min(...allArrivalDates.map((d) => d.getTime())));
    const maxDeparture = new Date(Math.max(...allDepartureDates.map((d) => d.getTime())));

    // 2. Prefetch all potentially conflicting reservations in one query
    const conflictingReservations = await this.prisma.reservation.findMany({
      where: {
        campgroundId,
        status: { notIn: ["cancelled"] },
        arrivalDate: { lt: maxDeparture },
        departureDate: { gt: minArrival },
      },
      select: { id: true, siteId: true, arrivalDate: true, departureDate: true },
    });

    // 3. Prefetch all potential guest matches by email
    const allEmails = parsedRows
      .map((p) => p.guest.email?.toLowerCase())
      .filter((e): e is string => !!e);

    const existingGuestsByEmail =
      allEmails.length > 0
        ? await this.prisma.guest.findMany({
            where: { Reservation: { some: { campgroundId } }, email: { in: allEmails } },
            select: {
              id: true,
              email: true,
              primaryFirstName: true,
              primaryLastName: true,
              phone: true,
            },
          })
        : [];

    // 4. Prefetch site classes with default rates for pricing
    const siteClassesWithRates = await this.prisma.siteClass.findMany({
      where: { campgroundId, isActive: true },
      select: { id: true, name: true, defaultRate: true },
    });
    const siteClassRateMap = new Map(siteClassesWithRates.map((sc) => [sc.id, sc.defaultRate]));

    // 5. Build lookup maps for O(1) access
    const guestEmailMap = new Map(existingGuestsByEmail.map((g) => [g.email?.toLowerCase(), g]));
    const siteIdToClassId = new Map(sites.map((s) => [s.id, s.siteClassId]));

    // Helper to check site availability using prefetched data
    const checkSiteAvailabilityBatch = (
      siteId: string,
      arrivalDate: Date,
      departureDate: Date,
    ): string | undefined => {
      const conflict = conflictingReservations.find(
        (r) =>
          r.siteId === siteId && r.arrivalDate < departureDate && r.departureDate > arrivalDate,
      );
      return conflict ? "Site has overlapping reservation" : undefined;
    };

    // Helper to match guest using prefetched data
    const matchGuestBatch = (guestData: {
      firstName: string;
      lastName: string;
      email?: string;
      phone?: string;
    }): GuestMatchResult => {
      if (guestData.email) {
        const existing = guestEmailMap.get(guestData.email.toLowerCase());
        if (existing) {
          return {
            matchType: "existing",
            existingGuestId: existing.id,
            existingGuestName: `${existing.primaryFirstName} ${existing.primaryLastName}`,
            existingGuestEmail: existing.email || undefined,
          };
        }
      }
      // Note: Phone matching still requires individual queries for complex matching
      // but email matches cover ~80% of cases
      return { matchType: "will_create" };
    };

    // Helper to calculate pricing using prefetched data
    const calculatePricingBatch = (
      siteId: string | null,
      siteClassId: string | null,
      arrivalDate: Date,
      departureDate: Date,
      csvTotalCents: number,
    ): PricingComparison => {
      let calculatedTotalCents = 0;
      const nights = Math.ceil(
        (departureDate.getTime() - arrivalDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (siteId) {
        const classId = siteIdToClassId.get(siteId);
        if (classId) {
          const rate = siteClassRateMap.get(classId);
          if (rate) calculatedTotalCents = rate * nights;
        }
      } else if (siteClassId) {
        const rate = siteClassRateMap.get(siteClassId);
        if (rate) calculatedTotalCents = rate * nights;
      }

      const difference = csvTotalCents - calculatedTotalCents;
      const differencePercent =
        calculatedTotalCents > 0 ? Math.abs((difference / calculatedTotalCents) * 100) : 0;

      return {
        csvTotalCents,
        calculatedTotalCents,
        difference,
        differencePercent,
        requiresReview: Math.abs(differencePercent) > 10, // Flag if >10% difference
      };
    };

    // Match sites and guests using batched data (no N+1!)
    const matchResults: MatchResult[] = [];
    for (const parsed of parsedRows) {
      // Site matching (uses prefetched conflict data)
      const siteMatch = this.matchSiteBatch(
        sites,
        siteClasses,
        parsed.siteIdentifier,
        parsed.stay.arrivalDate,
        parsed.stay.departureDate,
        checkSiteAvailabilityBatch,
      );

      // Guest matching (uses prefetched guest data)
      const guestMatch = matchGuestBatch(parsed.guest);

      // Pricing comparison (uses prefetched rate data)
      const pricingComparison = calculatePricingBatch(
        siteMatch.matchedSiteId || null,
        siteMatch.suggestedSiteClassId || null,
        parsed.stay.arrivalDate,
        parsed.stay.departureDate,
        parsed.pricing.totalAmountCents || 0,
      );

      matchResults.push({
        rowIndex: parsed.rowIndex,
        site: siteMatch,
        guest: guestMatch,
        pricing: pricingComparison,
        useSystemPricing: false, // Default to CSV pricing
        skip: parsed.errors.length > 0,
      });
    }

    // Build summary
    const summary = {
      totalRows: parsedRows.length,
      validRows: parsedRows.filter((r) => r.errors.length === 0).length,
      sitesMatched: matchResults.filter(
        (m) => m.site.matchType === "exact_number" || m.site.matchType === "exact_name",
      ).length,
      sitesNeedSelection: matchResults.filter(
        (m) => m.site.matchType === "class_assignment" || m.site.matchType === "manual_required",
      ).length,
      guestsFound: matchResults.filter((m) => m.guest.matchType === "existing").length,
      guestsToCreate: matchResults.filter((m) => m.guest.matchType === "will_create").length,
      hasConflicts: matchResults.filter((m) => m.site.conflict).length,
      pricingDiscrepancies: matchResults.filter((m) => m.pricing.requiresReview).length,
    };

    return { parsedRows, matchResults, summary };
  }

  /**
   * Execute the import
   */
  async executeImport(
    campgroundId: string,
    parsedRows: ParsedReservationRow[],
    executeRows: ReservationImportExecuteRow[],
  ): Promise<ReservationImportResult> {
    const result: ReservationImportResult = {
      success: true,
      imported: 0,
      skipped: 0,
      errors: [],
      createdReservationIds: [],
      createdGuestIds: [],
    };

    const activeSites = await this.prisma.site.findMany({
      where: {
        campgroundId,
        isActive: true,
        status: { notIn: BLOCKED_SITE_STATUSES },
      },
      select: { id: true, siteClassId: true },
    });
    const activeSiteClassMap = new Map(activeSites.map((site) => [site.id, site.siteClassId]));

    const siteClassRates = await this.prisma.siteClass.findMany({
      where: { campgroundId, isActive: true },
      select: { id: true, defaultRate: true },
    });
    const siteClassRateMap = new Map(
      siteClassRates.map((siteClass) => [siteClass.id, siteClass.defaultRate]),
    );

    const createdGuestByEmail = new Map<string, string>();
    const importedReservationRanges = new Map<
      string,
      Array<{ arrivalDate: Date; departureDate: Date }>
    >();

    const conflictMap = new Map<string, Array<{ arrivalDate: Date; departureDate: Date }>>();
    if (parsedRows.length > 0) {
      const allArrivalDates = parsedRows.map((p) => p.stay.arrivalDate);
      const allDepartureDates = parsedRows.map((p) => p.stay.departureDate);
      const minArrival = new Date(Math.min(...allArrivalDates.map((d) => d.getTime())));
      const maxDeparture = new Date(Math.max(...allDepartureDates.map((d) => d.getTime())));

      const conflictingReservations = await this.prisma.reservation.findMany({
        where: {
          campgroundId,
          status: { notIn: ["cancelled"] },
          arrivalDate: { lt: maxDeparture },
          departureDate: { gt: minArrival },
        },
        select: { siteId: true, arrivalDate: true, departureDate: true },
      });

      for (const reservation of conflictingReservations) {
        const existing = conflictMap.get(reservation.siteId) ?? [];
        existing.push({
          arrivalDate: reservation.arrivalDate,
          departureDate: reservation.departureDate,
        });
        conflictMap.set(reservation.siteId, existing);
      }
    }

    const hasConflict = (siteId: string, arrivalDate: Date, departureDate: Date) => {
      const existing = conflictMap.get(siteId);
      if (existing?.some((r) => r.arrivalDate < departureDate && r.departureDate > arrivalDate)) {
        return true;
      }
      const pending = importedReservationRanges.get(siteId);
      if (pending?.some((r) => r.arrivalDate < departureDate && r.departureDate > arrivalDate)) {
        return true;
      }
      return false;
    };

    const getSystemPricingTotal = (
      siteId: string,
      siteClassId: string | null | undefined,
      nights: number,
    ) => {
      const resolvedClassId = siteClassId ?? activeSiteClassMap.get(siteId) ?? null;
      if (!resolvedClassId) return null;
      const rate = siteClassRateMap.get(resolvedClassId);
      if (rate === undefined) return null;
      return rate * nights;
    };

    // Process each row
    for (const execRow of executeRows) {
      if (execRow.skip) {
        result.skipped++;
        continue;
      }

      const parsed = parsedRows.find((p) => p.rowIndex === execRow.rowIndex);
      if (!parsed) {
        result.errors.push({ rowIndex: execRow.rowIndex, error: "Row data not found" });
        continue;
      }

      try {
        // Create guest if needed
        let guestId = execRow.guestId;
        if (!guestId && execRow.createGuest) {
          const normalizedEmail = execRow.createGuest.email?.toLowerCase().trim();
          if (!normalizedEmail) {
            result.errors.push({ rowIndex: execRow.rowIndex, error: "Guest email is required" });
            continue;
          }
          const cachedGuestId = createdGuestByEmail.get(normalizedEmail);
          if (cachedGuestId) {
            guestId = cachedGuestId;
          } else {
            const guest = await this.prisma.guest.create({
              data: {
                id: randomUUID(),
                primaryFirstName: execRow.createGuest.firstName,
                primaryLastName: execRow.createGuest.lastName,
                email: normalizedEmail,
                emailNormalized: normalizedEmail,
                phone: execRow.createGuest.phone || null,
                phoneNormalized: execRow.createGuest.phone?.replace(/[^0-9+]/g, "") || null,
              },
            });
            guestId = guest.id;
            result.createdGuestIds.push(guest.id);
            createdGuestByEmail.set(normalizedEmail, guest.id);
          }
        }

        if (!guestId) {
          result.errors.push({
            rowIndex: execRow.rowIndex,
            error: "No guest ID or guest data provided",
          });
          continue;
        }

        if (!execRow.siteId) {
          result.errors.push({ rowIndex: execRow.rowIndex, error: "No site selected" });
          continue;
        }

        const hasActiveSite = activeSiteClassMap.has(execRow.siteId);
        const activeSiteClassId = activeSiteClassMap.get(execRow.siteId) ?? null;
        if (!hasActiveSite) {
          result.errors.push({
            rowIndex: execRow.rowIndex,
            error: "Selected site is inactive or unavailable",
          });
          continue;
        }

        if (hasConflict(execRow.siteId, parsed.stay.arrivalDate, parsed.stay.departureDate)) {
          result.errors.push({
            rowIndex: execRow.rowIndex,
            error: "Site has overlapping reservation",
          });
          continue;
        }

        // Determine pricing
        let totalAmountCents = parsed.pricing.totalAmountCents || 0;
        if (execRow.manualTotalOverrideCents !== undefined) {
          totalAmountCents = execRow.manualTotalOverrideCents;
        } else if (execRow.useSystemPricing) {
          const msPerDay = 1000 * 60 * 60 * 24;
          const nights =
            parsed.stay.nights > 0
              ? parsed.stay.nights
              : Math.max(
                  1,
                  Math.ceil(
                    (parsed.stay.departureDate.getTime() - parsed.stay.arrivalDate.getTime()) /
                      msPerDay,
                  ),
                );
          const systemTotal = getSystemPricingTotal(
            execRow.siteId,
            execRow.siteClassId ?? activeSiteClassId,
            nights,
          );
          if (systemTotal === null) {
            result.errors.push({
              rowIndex: execRow.rowIndex,
              error: "System pricing unavailable for selected site",
            });
            continue;
          }
          totalAmountCents = systemTotal;
        }

        const paidAmountCents = parsed.pricing.paidAmountCents || 0;
        const balanceAmountCents = totalAmountCents - paidAmountCents;

        // Determine status
        let status: "pending" | "confirmed" | "checked_in" | "checked_out" | "cancelled" =
          "confirmed";
        const csvStatus = parsed.meta.status?.toLowerCase();
        if (csvStatus) {
          if (csvStatus.includes("cancel")) status = "cancelled";
          else if (csvStatus.includes("check") && csvStatus.includes("in")) status = "checked_in";
          else if (csvStatus.includes("check") && csvStatus.includes("out")) status = "checked_out";
          else if (csvStatus.includes("pending")) status = "pending";
        }

        // Create reservation
        const reservation = await this.prisma.reservation.create({
          data: {
            id: randomUUID(),
            campgroundId,
            siteId: execRow.siteId,
            guestId,
            arrivalDate: parsed.stay.arrivalDate,
            departureDate: parsed.stay.departureDate,
            adults: parsed.meta.adults,
            children: parsed.meta.children,
            totalAmount: totalAmountCents,
            paidAmount: paidAmountCents,
            balanceAmount: balanceAmountCents,
            status,
            notes:
              parsed.meta.notes ||
              `Imported from CSV. Original confirmation: ${parsed.meta.confirmationNumber || "N/A"}`,
            bookedAt: new Date(),
          },
        });

        result.createdReservationIds.push(reservation.id);
        result.imported++;
        const existingRanges = importedReservationRanges.get(execRow.siteId) ?? [];
        existingRanges.push({
          arrivalDate: parsed.stay.arrivalDate,
          departureDate: parsed.stay.departureDate,
        });
        importedReservationRanges.set(execRow.siteId, existingRanges);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push({
          rowIndex: execRow.rowIndex,
          error: message || "Failed to create reservation",
        });
      }
    }

    result.success = result.errors.length === 0;
    return result;
  }

  // ============ Private Methods ============

  private normalizeRowData(data: Record<string, unknown>): Record<string, string> {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "string") {
        normalized[key] = value;
      } else if (value === null || value === undefined) {
        normalized[key] = "";
      } else {
        normalized[key] = String(value);
      }
    }
    return normalized;
  }

  private parseRow(
    rowIndex: number,
    row: Record<string, string>,
    mapping: ReservationImportColumnMapping,
  ): ParsedReservationRow {
    const errors: string[] = [];

    // Parse dates
    const arrivalStr = row[mapping.arrivalDate] || "";
    const departureStr = row[mapping.departureDate] || "";

    const arrivalDate = this.parseDate(arrivalStr);
    const departureDate = this.parseDate(departureStr);

    if (!arrivalDate) errors.push("Invalid or missing arrival date");
    if (!departureDate) errors.push("Invalid or missing departure date");
    if (arrivalDate && departureDate && arrivalDate >= departureDate) {
      errors.push("Departure must be after arrival");
    }

    const nights =
      arrivalDate && departureDate
        ? Math.ceil((departureDate.getTime() - arrivalDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

    // Parse guest info
    const firstName = (row[mapping.firstName || ""] || "").trim() || "Guest";
    const lastName = (row[mapping.lastName || ""] || "").trim();
    if (!lastName) errors.push("Missing guest last name");

    // Parse amounts
    const totalAmountCents = this.parseCurrency(row[mapping.totalAmount || ""]);
    const paidAmountCents = this.parseCurrency(row[mapping.paidAmount || ""]);

    return {
      rowIndex,
      rawData: row,
      guest: {
        firstName,
        lastName,
        email: (row[mapping.email || ""] || "").trim().toLowerCase() || undefined,
        phone: (row[mapping.phone || ""] || "").trim() || undefined,
      },
      stay: {
        arrivalDate: arrivalDate || new Date(),
        departureDate: departureDate || new Date(),
        nights,
      },
      siteIdentifier: {
        siteNumber: (row[mapping.siteNumber || ""] || "").trim() || undefined,
        siteName: (row[mapping.siteName || ""] || "").trim() || undefined,
        siteClassName: (row[mapping.siteClass || ""] || "").trim() || undefined,
      },
      pricing: {
        totalAmountCents,
        paidAmountCents,
        balanceCents:
          totalAmountCents !== undefined && paidAmountCents !== undefined
            ? totalAmountCents - paidAmountCents
            : undefined,
      },
      meta: {
        confirmationNumber: (row[mapping.confirmationNumber || ""] || "").trim() || undefined,
        status: (row[mapping.status || ""] || "").trim() || undefined,
        notes: (row[mapping.notes || ""] || "").trim() || undefined,
        adults: parseInt(row[mapping.adults || ""] || "1", 10) || 1,
        children: parseInt(row[mapping.children || ""] || "0", 10) || 0,
      },
      errors,
    };
  }

  private parseDate(dateStr: string): Date | null {
    if (!dateStr?.trim()) return null;

    const cleaned = dateStr.trim();

    // Try various formats
    const formats = [
      // ISO format
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
      // US format MM/DD/YYYY
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      // US format MM-DD-YYYY
      /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
    ];

    for (const format of formats) {
      const match = cleaned.match(format);
      if (match) {
        let year: number, month: number, day: number;

        if (format === formats[0]) {
          // ISO: YYYY-MM-DD
          year = parseInt(match[1], 10);
          month = parseInt(match[2], 10) - 1;
          day = parseInt(match[3], 10);
        } else {
          // US: MM/DD/YYYY or MM-DD-YYYY
          month = parseInt(match[1], 10) - 1;
          day = parseInt(match[2], 10);
          year = parseInt(match[3], 10);
        }

        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) return date;
      }
    }

    // Try native parsing as fallback
    const parsed = new Date(cleaned);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  private parseCurrency(value: string | undefined): number | undefined {
    if (!value?.trim()) return undefined;

    // Remove currency symbols, commas, spaces
    const cleaned = value.replace(/[$,\s]/g, "").trim();
    const amount = parseFloat(cleaned);

    if (isNaN(amount)) return undefined;

    // Convert to cents (assuming input is in dollars)
    return Math.round(amount * 100);
  }

  private async matchSite(
    sites: Array<{ id: string; name: string; siteNumber: string; siteClassId: string | null }>,
    siteClasses: Array<{ id: string; name: string }>,
    identifier: { siteNumber?: string; siteName?: string; siteClassName?: string },
    arrivalDate: Date,
    departureDate: Date,
    campgroundId: string,
  ): Promise<SiteMatchResult> {
    // Priority 1: Exact match by site number
    if (identifier.siteNumber) {
      const site = sites.find(
        (s) => s.siteNumber?.toLowerCase() === identifier.siteNumber?.toLowerCase(),
      );
      if (site) {
        const conflict = await this.checkSiteAvailability(site.id, arrivalDate, departureDate);
        return {
          matchType: "exact_number",
          matchedSiteId: site.id,
          matchedSiteName: site.name,
          matchedSiteNumber: site.siteNumber,
          conflict,
        };
      }
    }

    // Priority 2: Match by site name
    if (identifier.siteName) {
      const site = sites.find((s) =>
        s.name?.toLowerCase().includes(identifier.siteName!.toLowerCase()),
      );
      if (site) {
        const conflict = await this.checkSiteAvailability(site.id, arrivalDate, departureDate);
        return {
          matchType: "exact_name",
          matchedSiteId: site.id,
          matchedSiteName: site.name,
          matchedSiteNumber: site.siteNumber,
          conflict,
        };
      }
    }

    // Priority 3: Match by site class name
    if (identifier.siteClassName) {
      const siteClass = siteClasses.find((sc) =>
        sc.name?.toLowerCase().includes(identifier.siteClassName!.toLowerCase()),
      );
      if (siteClass) {
        const availableSites = await this.getAvailableSitesInClass(
          siteClass.id,
          arrivalDate,
          departureDate,
          campgroundId,
        );
        return {
          matchType: "class_assignment",
          suggestedSiteClassId: siteClass.id,
          suggestedSiteClassName: siteClass.name,
          availableSites,
        };
      }
    }

    // No match - manual selection required
    const allSites = sites.map((s) => ({
      id: s.id,
      name: s.name,
      siteNumber: s.siteNumber,
    }));

    return {
      matchType: "manual_required",
      availableSites: allSites,
    };
  }

  /**
   * Synchronous site matching using prefetched conflict data (no N+1 queries)
   */
  private matchSiteBatch(
    sites: Array<{ id: string; name: string; siteNumber: string; siteClassId: string | null }>,
    siteClasses: Array<{ id: string; name: string }>,
    identifier: { siteNumber?: string; siteName?: string; siteClassName?: string },
    arrivalDate: Date,
    departureDate: Date,
    checkAvailability: (siteId: string, arrival: Date, departure: Date) => string | undefined,
  ): SiteMatchResult {
    // Priority 1: Exact match by site number
    if (identifier.siteNumber) {
      const site = sites.find(
        (s) => s.siteNumber?.toLowerCase() === identifier.siteNumber?.toLowerCase(),
      );
      if (site) {
        const conflict = checkAvailability(site.id, arrivalDate, departureDate);
        return {
          matchType: "exact_number",
          matchedSiteId: site.id,
          matchedSiteName: site.name,
          matchedSiteNumber: site.siteNumber,
          conflict,
        };
      }
    }

    // Priority 2: Match by site name
    if (identifier.siteName) {
      const site = sites.find((s) =>
        s.name?.toLowerCase().includes(identifier.siteName!.toLowerCase()),
      );
      if (site) {
        const conflict = checkAvailability(site.id, arrivalDate, departureDate);
        return {
          matchType: "exact_name",
          matchedSiteId: site.id,
          matchedSiteName: site.name,
          matchedSiteNumber: site.siteNumber,
          conflict,
        };
      }
    }

    // Priority 3: Match by site class name
    if (identifier.siteClassName) {
      const siteClass = siteClasses.find((sc) =>
        sc.name?.toLowerCase().includes(identifier.siteClassName!.toLowerCase()),
      );
      if (siteClass) {
        // Find available sites in this class using prefetched data
        const sitesInClass = sites.filter((s) => s.siteClassId === siteClass.id);
        const availableSites = sitesInClass
          .filter((s) => !checkAvailability(s.id, arrivalDate, departureDate))
          .map((s) => ({ id: s.id, name: s.name, siteNumber: s.siteNumber }));

        return {
          matchType: "class_assignment",
          suggestedSiteClassId: siteClass.id,
          suggestedSiteClassName: siteClass.name,
          availableSites,
        };
      }
    }

    // No match - manual selection required
    const allSites = sites.map((s) => ({
      id: s.id,
      name: s.name,
      siteNumber: s.siteNumber,
    }));

    return {
      matchType: "manual_required",
      availableSites: allSites,
    };
  }

  private async matchGuest(
    campgroundId: string,
    guestData: { firstName: string; lastName: string; email?: string; phone?: string },
  ): Promise<GuestMatchResult> {
    // Match by email
    if (guestData.email) {
      const existing = await this.prisma.guest.findFirst({
        where: {
          Reservation: { some: { campgroundId } },
          email: guestData.email.toLowerCase(),
        },
      });
      if (existing) {
        return {
          matchType: "existing",
          existingGuestId: existing.id,
          existingGuestName: `${existing.primaryFirstName} ${existing.primaryLastName}`,
          existingGuestEmail: existing.email || undefined,
        };
      }
    }

    // Match by phone + name
    if (guestData.phone) {
      const normalizedPhone = guestData.phone.replace(/\D/g, "");
      const existing = await this.prisma.guest.findFirst({
        where: {
          Reservation: { some: { campgroundId } },
          phone: { contains: normalizedPhone.slice(-10) },
          primaryLastName: { equals: guestData.lastName, mode: "insensitive" },
        },
      });
      if (existing) {
        return {
          matchType: "existing",
          existingGuestId: existing.id,
          existingGuestName: `${existing.primaryFirstName} ${existing.primaryLastName}`,
          existingGuestEmail: existing.email || undefined,
        };
      }
    }

    return { matchType: "will_create" };
  }

  private async checkSiteAvailability(
    siteId: string,
    arrivalDate: Date,
    departureDate: Date,
  ): Promise<string | undefined> {
    const conflict = await this.prisma.reservation.findFirst({
      where: {
        siteId,
        status: { notIn: ["cancelled"] },
        arrivalDate: { lt: departureDate },
        departureDate: { gt: arrivalDate },
      },
    });

    return conflict ? "Site has overlapping reservation" : undefined;
  }

  private async getAvailableSitesInClass(
    siteClassId: string,
    arrivalDate: Date,
    departureDate: Date,
    campgroundId: string,
  ): Promise<Array<{ id: string; name: string; siteNumber: string }>> {
    const sites = await this.prisma.site.findMany({
      where: {
        campgroundId,
        siteClassId,
        isActive: true,
        status: { notIn: BLOCKED_SITE_STATUSES },
      },
      select: { id: true, name: true, siteNumber: true },
    });

    // Filter out sites with conflicts
    const available: Array<{ id: string; name: string; siteNumber: string }> = [];
    for (const site of sites) {
      const conflict = await this.checkSiteAvailability(site.id, arrivalDate, departureDate);
      if (!conflict) {
        available.push(site);
      }
    }

    return available;
  }

  private async calculatePricingComparison(
    campgroundId: string,
    siteId: string | null,
    siteClassId: string | null,
    arrivalDate: Date,
    departureDate: Date,
    csvTotalCents: number,
  ): Promise<PricingComparison> {
    // For now, use a simple calculation based on site class default rate
    // In production, this would call the full pricing evaluation service
    let calculatedTotalCents = 0;

    try {
      if (siteId) {
        const site = await this.prisma.site.findUnique({
          where: { id: siteId },
          include: { SiteClass: true },
        });
        if (site?.SiteClass?.defaultRate) {
          const nights = Math.ceil(
            (departureDate.getTime() - arrivalDate.getTime()) / (1000 * 60 * 60 * 24),
          );
          calculatedTotalCents = site.SiteClass.defaultRate * nights;
        }
      } else if (siteClassId) {
        const siteClass = await this.prisma.siteClass.findUnique({
          where: { id: siteClassId },
        });
        if (siteClass?.defaultRate) {
          const nights = Math.ceil(
            (departureDate.getTime() - arrivalDate.getTime()) / (1000 * 60 * 60 * 24),
          );
          calculatedTotalCents = siteClass.defaultRate * nights;
        }
      }
    } catch (e) {
      // Ignore pricing calculation errors
    }

    const difference = csvTotalCents - calculatedTotalCents;
    const differencePercent =
      calculatedTotalCents > 0 ? (difference / calculatedTotalCents) * 100 : 0;

    return {
      csvTotalCents,
      calculatedTotalCents,
      difference,
      differencePercent,
      requiresReview: Math.abs(differencePercent) > 10,
    };
  }
}
