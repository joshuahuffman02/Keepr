import { Injectable, Logger } from "@nestjs/common";
import { CsvParserService, FieldMapping } from "./csv-parser.service";

/**
 * Parser for NewBook PMS export format
 *
 * NewBook exports typically include:
 * - Sites: Site Number, Category Name, Description
 * - Guests: Booking Name, Contact details
 * - Reservations: Booking details with site and guest info
 */
@Injectable()
export class NewbookParserService {
  private readonly logger = new Logger(NewbookParserService.name);

  constructor(private readonly csvParser: CsvParserService) {}

  /**
   * Detect if CSV is NewBook format
   */
  detectFormat(headers: string[]): boolean {
    const newbookIndicators = [
      "booking_name",
      "bookingname",
      "category_name",
      "categoryname",
      "calculated_stay_cost",
      "booking_duration",
      "default_client_account",
      "newbook",
    ];

    const normalizedHeaders = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
    return newbookIndicators.some((indicator) =>
      normalizedHeaders.some((h) => h.includes(indicator.replace(/[^a-z0-9]/g, "")))
    );
  }

  /**
   * Get field mappings for NewBook site export
   */
  getSiteMappings(): FieldMapping[] {
    return [
      { sourceField: "Site", targetField: "siteNumber" },
      { sourceField: "Site Name", targetField: "name" },
      { sourceField: "Category Name", targetField: "siteClassName" },
      { sourceField: "Site Type", targetField: "siteType", transform: this.mapSiteType },
      { sourceField: "Max Guests", targetField: "maxOccupancy", transform: CsvParserService.transforms.toInteger },
      { sourceField: "Max Length", targetField: "rigMaxLength", transform: CsvParserService.transforms.toInteger },
      { sourceField: "Power", targetField: "hookupsPower", transform: CsvParserService.transforms.toBoolean },
      { sourceField: "Water", targetField: "hookupsWater", transform: CsvParserService.transforms.toBoolean },
      { sourceField: "Sewerage", targetField: "hookupsSewer", transform: CsvParserService.transforms.toBoolean },
      { sourceField: "Pets Allowed", targetField: "petFriendly", transform: CsvParserService.transforms.toBoolean },
      { sourceField: "Disabled Access", targetField: "accessible", transform: CsvParserService.transforms.toBoolean },
      { sourceField: "Drive Through", targetField: "pullThrough", transform: CsvParserService.transforms.toBoolean },
      { sourceField: "Description", targetField: "description" },
    ];
  }

  /**
   * Get field mappings for NewBook guest export
   */
  getGuestMappings(): FieldMapping[] {
    return [
      { sourceField: "First Name", targetField: "firstName" },
      { sourceField: "Surname", targetField: "lastName" },
      { sourceField: "Email", targetField: "email", transform: CsvParserService.transforms.toEmail },
      { sourceField: "Mobile", targetField: "phone", transform: CsvParserService.transforms.toPhone },
      { sourceField: "Phone", targetField: "phone", transform: CsvParserService.transforms.toPhone },
      { sourceField: "Street Address", targetField: "address1" },
      { sourceField: "Suburb", targetField: "city" },
      { sourceField: "State", targetField: "state" },
      { sourceField: "Postcode", targetField: "postalCode" },
      { sourceField: "Country", targetField: "country" },
      { sourceField: "Vehicle Type", targetField: "rigType" },
      { sourceField: "Vehicle Length", targetField: "rigLength", transform: this.parseLengthWithUnit },
      { sourceField: "Rego", targetField: "vehiclePlate" },
      { sourceField: "Notes", targetField: "notes" },
    ];
  }

  /**
   * Get field mappings for NewBook reservation export
   */
  getReservationMappings(): FieldMapping[] {
    return [
      { sourceField: "Default Client Account", targetField: "externalId" },
      { sourceField: "Site", targetField: "siteNumber" },
      { sourceField: "Booking Name", targetField: "guestName" },
      { sourceField: "Arrival", targetField: "arrivalDate", transform: this.parseNewbookDate },
      { sourceField: "Departure", targetField: "departureDate", transform: this.parseNewbookDate },
      { sourceField: "Adults", targetField: "adults", transform: CsvParserService.transforms.toInteger },
      { sourceField: "Children", targetField: "children", transform: CsvParserService.transforms.toInteger },
      { sourceField: "Calculated Stay Cost", targetField: "totalAmount", transform: this.parseNewbookAmount },
      { sourceField: "Booking Client Account Balance", targetField: "balance", transform: this.parseNewbookAmount },
      { sourceField: "Status", targetField: "status", transform: this.mapReservationStatus },
      { sourceField: "Booking Duration", targetField: "nights", transform: this.parseBookingDuration },
      { sourceField: "Category Name", targetField: "siteClassName" },
    ];
  }

  /**
   * Parse NewBook date format (DD/MM/YYYY or other formats)
   */
  private parseNewbookDate(value: string): string | null {
    if (!value) return null;

    // Try DD/MM/YYYY format first (common in Australia/NZ where NewBook is popular)
    const ddmmyyyy = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyy) {
      const [, day, month, year] = ddmmyyyy;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return isNaN(date.getTime()) ? null : date.toISOString();
    }

    // Try standard date parsing
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date.toISOString();
  }

  /**
   * Parse NewBook amount (may include currency symbols)
   */
  private parseNewbookAmount(value: string): number | null {
    if (!value) return null;

    // Remove currency symbols and parse
    const cleaned = value.replace(/[$€£¥,\s]/g, "");
    const num = parseFloat(cleaned);

    if (isNaN(num)) return null;

    // Convert to cents
    return Math.round(num * 100);
  }

  /**
   * Parse booking duration (e.g., "3 nights", "1 night")
   */
  private parseBookingDuration(value: string): number | null {
    if (!value) return null;

    const match = value.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Parse length with unit (e.g., "35ft", "10m")
   */
  private parseLengthWithUnit(value: string): number | null {
    if (!value) return null;

    const match = value.match(/^([\d.]+)\s*(ft|feet|m|meters?)?$/i);
    if (!match) return null;

    let length = parseFloat(match[1]);
    const unit = (match[2] || "ft").toLowerCase();

    // Convert meters to feet if needed
    if (unit === "m" || unit.startsWith("meter")) {
      length = length * 3.28084;
    }

    return Math.round(length);
  }

  /**
   * Map NewBook site type to our site type
   */
  private mapSiteType(value: string): string {
    const normalized = value.toLowerCase().trim();

    // NewBook often uses category names
    if (normalized.includes("caravan") || normalized.includes("rv") || normalized.includes("powered")) {
      return "rv";
    }
    if (normalized.includes("tent") || normalized.includes("unpowered")) {
      return "tent";
    }
    if (normalized.includes("cabin") || normalized.includes("cottage") || normalized.includes("ensuite")) {
      return "cabin";
    }
    if (normalized.includes("group") || normalized.includes("rally")) {
      return "group";
    }
    if (normalized.includes("glamp") || normalized.includes("safari") || normalized.includes("bell tent")) {
      return "glamping";
    }

    return "rv"; // Default for caravan parks
  }

  /**
   * Map NewBook reservation status to our status
   */
  private mapReservationStatus(value: string): string {
    const normalized = value.toLowerCase().trim();

    if (normalized.includes("confirm") || normalized === "booked") return "confirmed";
    if (normalized.includes("pend") || normalized === "tentative") return "pending";
    if (normalized.includes("cancel")) return "cancelled";
    if (normalized.includes("arrived") || normalized.includes("in-house")) return "checked_in";
    if (normalized.includes("departed") || normalized.includes("checked out")) return "checked_out";
    if (normalized.includes("no show")) return "cancelled";

    return "confirmed"; // Default
  }

  /**
   * Extract guest name parts from "Booking Name" field
   * NewBook often has format: "LASTNAME, Firstname" or "Firstname LASTNAME"
   */
  parseBookingName(bookingName: string): { firstName: string; lastName: string } {
    if (!bookingName) {
      return { firstName: "", lastName: "" };
    }

    const trimmed = bookingName.trim();

    // Check for "LASTNAME, Firstname" format
    if (trimmed.includes(",")) {
      const [last, first] = trimmed.split(",").map((s) => s.trim());
      return {
        firstName: this.titleCase(first || ""),
        lastName: this.titleCase(last || ""),
      };
    }

    // Check for all caps last name at end (e.g., "John SMITH")
    const words = trimmed.split(/\s+/);
    if (words.length >= 2) {
      const lastWord = words[words.length - 1];
      if (lastWord === lastWord.toUpperCase() && lastWord.length > 1) {
        return {
          firstName: words.slice(0, -1).map(this.titleCase).join(" "),
          lastName: this.titleCase(lastWord),
        };
      }
    }

    // Default: first word is first name, rest is last name
    if (words.length >= 2) {
      return {
        firstName: this.titleCase(words[0]),
        lastName: words.slice(1).map(this.titleCase).join(" "),
      };
    }

    return { firstName: trimmed, lastName: "" };
  }

  private titleCase(str: string): string {
    return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
