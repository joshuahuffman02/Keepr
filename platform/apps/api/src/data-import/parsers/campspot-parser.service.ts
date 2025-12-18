import { Injectable, Logger } from "@nestjs/common";
import { CsvParserService, FieldMapping } from "./csv-parser.service";

/**
 * Parser for Campspot PMS export format
 *
 * Campspot exports typically include:
 * - Sites: Site Name, Site Type, Max Length, Hookups, etc.
 * - Guests: Name, Email, Phone, Address
 * - Reservations: Booking ID, Guest, Site, Dates, Amounts
 */
@Injectable()
export class CampspotParserService {
  private readonly logger = new Logger(CampspotParserService.name);

  constructor(private readonly csvParser: CsvParserService) {}

  /**
   * Detect if CSV is Campspot format
   */
  detectFormat(headers: string[]): boolean {
    const campspotIndicators = [
      "reservation_id",
      "reservationnumber",
      "booking_id",
      "site_external_id",
      "guest_external_id",
      "campspot",
    ];

    const normalizedHeaders = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
    return campspotIndicators.some((indicator) =>
      normalizedHeaders.some((h) => h.includes(indicator.replace(/[^a-z0-9]/g, "")))
    );
  }

  /**
   * Get field mappings for Campspot site export
   */
  getSiteMappings(): FieldMapping[] {
    return [
      { sourceField: "Site Name", targetField: "name" },
      { sourceField: "Site Number", targetField: "siteNumber" },
      { sourceField: "Site Type", targetField: "siteType", transform: this.mapSiteType },
      { sourceField: "Category", targetField: "siteClassName" },
      { sourceField: "Max Occupancy", targetField: "maxOccupancy", transform: CsvParserService.transforms.toInteger },
      { sourceField: "Max Length", targetField: "rigMaxLength", transform: CsvParserService.transforms.toInteger },
      { sourceField: "Electric", targetField: "hookupsPower", transform: CsvParserService.transforms.toBoolean },
      { sourceField: "Water", targetField: "hookupsWater", transform: CsvParserService.transforms.toBoolean },
      { sourceField: "Sewer", targetField: "hookupsSewer", transform: CsvParserService.transforms.toBoolean },
      { sourceField: "Amps", targetField: "powerAmps", transform: CsvParserService.transforms.toInteger },
      { sourceField: "Pet Friendly", targetField: "petFriendly", transform: CsvParserService.transforms.toBoolean },
      { sourceField: "ADA", targetField: "accessible", transform: CsvParserService.transforms.toBoolean },
      { sourceField: "Pull Through", targetField: "pullThrough", transform: CsvParserService.transforms.toBoolean },
      { sourceField: "Description", targetField: "description" },
    ];
  }

  /**
   * Get field mappings for Campspot guest export
   */
  getGuestMappings(): FieldMapping[] {
    return [
      { sourceField: "First Name", targetField: "firstName" },
      { sourceField: "Last Name", targetField: "lastName" },
      { sourceField: "Email", targetField: "email", transform: CsvParserService.transforms.toEmail },
      { sourceField: "Phone", targetField: "phone", transform: CsvParserService.transforms.toPhone },
      { sourceField: "Address", targetField: "address1" },
      { sourceField: "Address 2", targetField: "address2" },
      { sourceField: "City", targetField: "city" },
      { sourceField: "State", targetField: "state" },
      { sourceField: "Zip", targetField: "postalCode" },
      { sourceField: "Country", targetField: "country" },
      { sourceField: "RV Type", targetField: "rigType" },
      { sourceField: "RV Length", targetField: "rigLength", transform: CsvParserService.transforms.toInteger },
      { sourceField: "License Plate", targetField: "vehiclePlate" },
      { sourceField: "Plate State", targetField: "vehicleState" },
      { sourceField: "Notes", targetField: "notes" },
    ];
  }

  /**
   * Get field mappings for Campspot reservation export
   */
  getReservationMappings(): FieldMapping[] {
    return [
      { sourceField: "Reservation Number", targetField: "externalId" },
      { sourceField: "Site", targetField: "siteNumber" },
      { sourceField: "Guest Email", targetField: "guestEmail" },
      { sourceField: "Arrival", targetField: "arrivalDate", transform: CsvParserService.transforms.toISODate },
      { sourceField: "Departure", targetField: "departureDate", transform: CsvParserService.transforms.toISODate },
      { sourceField: "Adults", targetField: "adults", transform: CsvParserService.transforms.toInteger },
      { sourceField: "Children", targetField: "children", transform: CsvParserService.transforms.toInteger },
      { sourceField: "Total", targetField: "totalAmount", transform: CsvParserService.transforms.toCents },
      { sourceField: "Paid", targetField: "paidAmount", transform: CsvParserService.transforms.toCents },
      { sourceField: "Status", targetField: "status", transform: this.mapReservationStatus },
      { sourceField: "RV Type", targetField: "rigType" },
      { sourceField: "RV Length", targetField: "rigLength", transform: CsvParserService.transforms.toInteger },
      { sourceField: "Notes", targetField: "notes" },
    ];
  }

  /**
   * Map Campspot site type to our site type
   */
  private mapSiteType(value: string): string {
    const normalized = value.toLowerCase().trim();

    if (normalized.includes("rv") || normalized.includes("motorhome") || normalized.includes("camper")) {
      return "rv";
    }
    if (normalized.includes("tent")) {
      return "tent";
    }
    if (normalized.includes("cabin") || normalized.includes("cottage") || normalized.includes("lodge")) {
      return "cabin";
    }
    if (normalized.includes("group")) {
      return "group";
    }
    if (normalized.includes("glamp") || normalized.includes("yurt") || normalized.includes("tipi")) {
      return "glamping";
    }

    return "rv"; // Default
  }

  /**
   * Map Campspot reservation status to our status
   */
  private mapReservationStatus(value: string): string {
    const normalized = value.toLowerCase().trim();

    if (normalized.includes("confirm")) return "confirmed";
    if (normalized.includes("pend")) return "pending";
    if (normalized.includes("cancel")) return "cancelled";
    if (normalized.includes("check") && normalized.includes("in")) return "checked_in";
    if (normalized.includes("check") && normalized.includes("out")) return "checked_out";

    return "confirmed"; // Default
  }
}
