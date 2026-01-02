import { BadGatewayException, BadRequestException } from "@nestjs/common";
import { BaseOtaProvider, OtaBooking, OtaProviderConfig } from "./base-ota.provider";

/**
 * iCal Provider for syncing bookings from Airbnb, VRBO, Booking.com, etc.
 * Most OTAs provide iCal feeds for availability sync
 *
 * Patterns from scraping-apis:
 * - Rate limiting from fetch_apify_actors.js:122
 * - Retry logic from fetch_apify_actors.js:124-128
 * - Data transformation from generate_readme_clean.js
 */
export class ICalProvider extends BaseOtaProvider {
  get providerName(): string {
    return "ical";
  }

  async fetchBookings(): Promise<OtaBooking[]> {
    if (!this.config.icalUrl) {
      throw new BadRequestException("iCal URL is required for iCal provider");
    }

    const icalData = await this.fetchWithRetry(
      () => this.fetchICalFeed(this.config.icalUrl!),
      "iCal feed fetch"
    );

    return this.parseICalEvents(icalData);
  }

  /**
   * Fetch iCal feed from URL
   */
  private async fetchICalFeed(url: string): Promise<string> {
    this.logger.log(`Fetching iCal feed from ${url}`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Campreserv/1.0 (OTA Sync)",
        Accept: "text/calendar",
      },
    });

    if (!response.ok) {
      throw new BadGatewayException(`iCal fetch failed: HTTP ${response.status}`);
    }

    return response.text();
  }

  /**
   * Parse iCal format into OtaBooking objects
   * iCal format spec: https://icalendar.org/iCalendar-RFC-5545/
   */
  private parseICalEvents(icalData: string): OtaBooking[] {
    const bookings: OtaBooking[] = [];
    const events = this.extractEvents(icalData);

    for (const event of events) {
      try {
        const booking = this.parseEvent(event);
        if (booking) {
          bookings.push(booking);
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to parse iCal event: ${message}`);
      }
    }

    this.logger.log(`Parsed ${bookings.length} bookings from iCal feed`);
    return bookings;
  }

  /**
   * Extract VEVENT blocks from iCal data
   */
  private extractEvents(icalData: string): string[] {
    const events: string[] = [];
    const lines = icalData.split(/\r?\n/);

    let inEvent = false;
    let currentEvent: string[] = [];

    for (const line of lines) {
      if (line.startsWith("BEGIN:VEVENT")) {
        inEvent = true;
        currentEvent = [line];
      } else if (line.startsWith("END:VEVENT")) {
        currentEvent.push(line);
        events.push(currentEvent.join("\n"));
        inEvent = false;
        currentEvent = [];
      } else if (inEvent) {
        // Handle line folding (lines starting with space/tab are continuations)
        if (line.startsWith(" ") || line.startsWith("\t")) {
          if (currentEvent.length > 0) {
            currentEvent[currentEvent.length - 1] += line.slice(1);
          }
        } else {
          currentEvent.push(line);
        }
      }
    }

    return events;
  }

  /**
   * Parse a single VEVENT into an OtaBooking
   */
  private parseEvent(eventData: string): OtaBooking | null {
    const props = this.parseProperties(eventData);

    const uid = props.get("UID");
    const dtstart = props.get("DTSTART");
    const dtend = props.get("DTEND");
    const summary = props.get("SUMMARY");
    const description = props.get("DESCRIPTION");
    const status = props.get("STATUS");

    // UID and dates are required
    if (!uid || !dtstart || !dtend) {
      return null;
    }

    const arrivalDate = this.parseICalDate(dtstart);
    const departureDate = this.parseICalDate(dtend);

    if (!arrivalDate || !departureDate) {
      return null;
    }

    // Extract guest info from SUMMARY/DESCRIPTION
    // Common formats:
    // - "John Smith" (just name)
    // - "Reserved" or "Blocked" (no guest info)
    // - "Booking: John Smith" (with prefix)
    const guestInfo = this.extractGuestInfo(summary || "", description || "");

    // Determine booking status
    let bookingStatus: "confirmed" | "cancelled" | "pending" = "confirmed";
    if (status?.toUpperCase() === "CANCELLED") {
      bookingStatus = "cancelled";
    } else if (status?.toUpperCase() === "TENTATIVE") {
      bookingStatus = "pending";
    }

    // Skip blocked dates (no real guest)
    if (this.isBlockedDate(summary || "", description || "")) {
      return null;
    }

    return {
      externalId: uid,
      guestName: guestInfo.name || "Guest",
      guestEmail: guestInfo.email,
      guestPhone: guestInfo.phone,
      arrivalDate,
      departureDate,
      status: bookingStatus,
      adults: 2, // iCal doesn't typically include guest count
      children: 0,
      notes: description,
      rawData: Object.fromEntries(props),
    };
  }

  /**
   * Parse iCal properties from event data
   */
  private parseProperties(eventData: string): Map<string, string> {
    const props = new Map<string, string>();
    const lines = eventData.split("\n");

    for (const line of lines) {
      // Handle properties with parameters (e.g., DTSTART;VALUE=DATE:20240101)
      const colonIndex = line.indexOf(":");
      if (colonIndex === -1) continue;

      let key = line.slice(0, colonIndex);
      const value = line.slice(colonIndex + 1).trim();

      // Remove parameters from key
      const semicolonIndex = key.indexOf(";");
      if (semicolonIndex !== -1) {
        key = key.slice(0, semicolonIndex);
      }

      props.set(key.toUpperCase(), value);
    }

    return props;
  }

  /**
   * Parse iCal date formats
   * Formats: YYYYMMDD, YYYYMMDDTHHMMSS, YYYYMMDDTHHMMSSZ
   */
  private parseICalDate(dateStr: string): Date | null {
    // Remove any VALUE=DATE prefix handling
    const cleanDate = dateStr.replace(/^.*:/, "");

    // YYYYMMDD format (date only)
    if (/^\d{8}$/.test(cleanDate)) {
      const year = cleanDate.slice(0, 4);
      const month = cleanDate.slice(4, 6);
      const day = cleanDate.slice(6, 8);
      return new Date(`${year}-${month}-${day}T00:00:00`);
    }

    // YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ format
    const match = cleanDate.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
    if (match) {
      const [, year, month, day, hour, minute, second, utc] = match;
      const dateString = `${year}-${month}-${day}T${hour}:${minute}:${second}${utc || ""}`;
      return new Date(dateString);
    }

    // Try parsing as ISO date
    return this.parseDate(cleanDate);
  }

  /**
   * Extract guest information from SUMMARY and DESCRIPTION
   */
  private extractGuestInfo(summary: string, description: string): {
    name?: string;
    email?: string;
    phone?: string;
  } {
    const result: { name?: string; email?: string; phone?: string } = {};

    // Try to extract name from summary
    // Remove common prefixes
    const nameFromSummary = summary
      .replace(/^(Reserved|Booking|Reservation|Blocked)[:\s-]*/i, "")
      .replace(/\s*\(.*\)\s*$/, "") // Remove trailing parentheses
      .trim();

    if (nameFromSummary && !this.isBlockedIndicator(nameFromSummary)) {
      result.name = nameFromSummary;
    }

    // Try to extract email from description
    const emailMatch = description.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch) {
      result.email = emailMatch[0].toLowerCase();
    }

    // Try to extract phone from description
    const phoneMatch = description.match(/[\d\s()-]{10,}/);
    if (phoneMatch) {
      result.phone = phoneMatch[0].replace(/\D/g, "");
    }

    return result;
  }

  /**
   * Check if this is a blocked date rather than a real booking
   */
  private isBlockedDate(summary: string, description: string): boolean {
    const combined = `${summary} ${description}`.toLowerCase();
    const blockedIndicators = [
      "blocked",
      "not available",
      "unavailable",
      "closed",
      "maintenance",
      "owner block",
      "owner stay",
    ];

    return blockedIndicators.some((indicator) => combined.includes(indicator));
  }

  /**
   * Check if a name string is actually a blocked indicator
   */
  private isBlockedIndicator(name: string): boolean {
    const normalized = name.toLowerCase().trim();
    const indicators = ["reserved", "blocked", "unavailable", "closed", "n/a"];
    return indicators.includes(normalized);
  }
}
