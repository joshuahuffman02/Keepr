import { BadRequestException } from "@nestjs/common";
import { ReservationImportRecord } from "../dto/reservation-import.dto";

/**
 * NewBook CSV Export Format
 * Columns:
 * - Booking Name: Guest full name
 * - Site: Full site name including category (e.g., "Pull Through 50/30/20 W/E/S 142")
 * - Arrival: Date in "MMM D YYYY" format (e.g., "Sep 3 2026")
 * - Departure: Date in same format
 * - Calculated Stay Cost: Total amount as decimal string (e.g., "224.42")
 * - Default Client Account: Contains booking/group ID (e.g., "(Booking #348)" or "(Group #348)")
 * - Booking Client Account Balance: Balance due as decimal string
 * - Booking Duration: Human-readable duration (e.g., "4 Nights")
 * - Category Name: Site class name (e.g., "Pull Through 50/30/20 W/E/S")
 */

export type NewbookCsvRow = {
    "Booking Name": string;
    Site: string;
    Arrival: string;
    Departure: string;
    "Calculated Stay Cost": string;
    "Default Client Account": string;
    "Booking Client Account Balance": string;
    "Booking Duration": string;
    "Category Name": string;
};

export type NewbookImportResult = {
    record: Partial<ReservationImportRecord>;
    suggestions: {
        createSiteClass?: { name: string };
        createSite?: { name: string; siteClassName: string };
        createGuest?: { firstName: string; lastName: string; email: string };
    };
    warnings: string[];
    externalBookingId: string;
    isGroupBooking: boolean;
    groupId?: string;
};

/**
 * Parse NewBook date format "MMM D YYYY" to ISO string
 * e.g., "Sep 3 2026" -> "2026-09-03"
 */
export function parseNewbookDate(dateStr: string): string {
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) {
        throw new BadRequestException(`Invalid date: ${dateStr}`);
    }
    return parsed.toISOString().split("T")[0];
}

/**
 * Extract booking or group ID from Default Client Account field
 * e.g., "(Booking #348) Dr C McGinnis - Group" -> { type: "booking", id: "348" }
 * e.g., "(Group #348) Dr C McGinnis - Group" -> { type: "group", id: "348" }
 */
export function extractBookingId(accountField: string): { type: "booking" | "group" | "guest"; id: string } {
    const bookingMatch = accountField.match(/\(Booking #(\d+)\)/i);
    if (bookingMatch) {
        return { type: "booking", id: bookingMatch[1] };
    }

    const groupMatch = accountField.match(/\(Group #(\d+)\)/i);
    if (groupMatch) {
        return { type: "group", id: groupMatch[1] };
    }

    const guestMatch = accountField.match(/\(Guest #(\d+)\)/i);
    if (guestMatch) {
        return { type: "guest", id: guestMatch[1] };
    }

    // Fallback: generate ID from account field
    return { type: "booking", id: accountField.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 50) };
}

/**
 * Extract site number from full site name
 * e.g., "Pull Through 50/30/20 W/E/S 142" -> "142"
 * e.g., "Cabin 20 Amp 302c" -> "302c"
 * e.g., "Tent 135t" -> "135t"
 */
export function extractSiteNumber(siteFullName: string): string {
    // Site number is typically the last "word" in the name
    const parts = siteFullName.trim().split(/\s+/);
    const lastPart = parts[parts.length - 1];

    // Check if it looks like a site identifier (contains digits)
    if (/\d/.test(lastPart)) {
        return lastPart;
    }

    // Fallback to full name if no clear number
    return siteFullName;
}

/**
 * Parse guest name into first/last name
 * e.g., "Cheryl Purath" -> { firstName: "Cheryl", lastName: "Purath" }
 * e.g., "Mr Frank Kania" -> { firstName: "Frank", lastName: "Kania" }
 * e.g., "No Guest Data" -> { firstName: "Unknown", lastName: "Guest" }
 */
export function parseGuestName(fullName: string): { firstName: string; lastName: string } {
    if (!fullName || fullName === "No Guest Data") {
        return { firstName: "Unknown", lastName: "Guest" };
    }

    // Remove common titles
    const cleaned = fullName
        .replace(/^(Mr|Mrs|Ms|Dr|Miss|Prof)\s+/i, "")
        .replace(/\s+&\s+/g, " and ")
        .trim();

    const parts = cleaned.split(/\s+/);
    if (parts.length === 1) {
        return { firstName: parts[0], lastName: "Guest" };
    }

    return {
        firstName: parts.slice(0, -1).join(" "),
        lastName: parts[parts.length - 1],
    };
}

/**
 * Generate a placeholder email for imported guests
 * e.g., "cheryl.purath@newbook-import.local"
 */
export function generatePlaceholderEmail(firstName: string, lastName: string, bookingId: string): string {
    const slug = `${firstName}.${lastName}`
        .toLowerCase()
        .replace(/[^a-z0-9.]/g, "")
        .slice(0, 40);
    return `${slug}.${bookingId}@newbook-import.local`;
}

/**
 * Convert decimal dollar string to cents
 * e.g., "224.42" -> 22442
 */
export function dollarsToCents(dollarStr: string): number {
    const cleaned = dollarStr.replace(/[^0-9.-]/g, "");
    const dollars = parseFloat(cleaned);
    if (isNaN(dollars)) return 0;
    return Math.round(dollars * 100);
}

/**
 * Map a NewBook CSV row to internal reservation import format
 */
export function mapNewbookToInternal(row: NewbookCsvRow): NewbookImportResult {
    const warnings: string[] = [];
    const suggestions: NewbookImportResult["suggestions"] = {};

    // Parse dates
    let arrivalDate: string;
    let departureDate: string;
    try {
        arrivalDate = parseNewbookDate(row.Arrival);
        departureDate = parseNewbookDate(row.Departure);
    } catch (e: any) {
        warnings.push(`Date parsing error: ${e.message}`);
        arrivalDate = "";
        departureDate = "";
    }

    // Extract booking info
    const bookingInfo = extractBookingId(row["Default Client Account"]);
    const externalBookingId = `newbook-${bookingInfo.type}-${bookingInfo.id}`;

    // Parse guest
    const { firstName, lastName } = parseGuestName(row["Booking Name"]);
    const guestEmail = generatePlaceholderEmail(firstName, lastName, bookingInfo.id);

    // Suggest guest creation
    suggestions.createGuest = { firstName, lastName, email: guestEmail };

    // Extract site info
    const siteClassName = row["Category Name"].trim();
    const siteNumber = extractSiteNumber(row.Site);

    // Suggest site class and site creation if needed
    suggestions.createSiteClass = { name: siteClassName };
    suggestions.createSite = { name: siteNumber, siteClassName };

    // Parse amounts
    const totalCents = dollarsToCents(row["Calculated Stay Cost"]);
    const balanceCents = dollarsToCents(row["Booking Client Account Balance"]);
    const paidCents = totalCents - balanceCents;

    // Build the record (without campgroundId/siteId/guestId - those need to be resolved)
    const record: Partial<ReservationImportRecord> = {
        externalId: externalBookingId,
        arrivalDate,
        departureDate,
        adults: 2, // Default, NewBook doesn't provide this in basic export
        children: 0,
        status: "confirmed",
        totalAmount: totalCents,
        paidAmount: Math.max(0, paidCents),
        source: "newbook",
        notes: `Imported from NewBook. Original site: ${row.Site}. Duration: ${row["Booking Duration"]}.`,
    };

    return {
        record,
        suggestions,
        warnings,
        externalBookingId,
        isGroupBooking: bookingInfo.type === "group",
        groupId: bookingInfo.type === "group" ? bookingInfo.id : undefined,
    };
}

/**
 * Parse a complete NewBook CSV file
 */
export function parseNewbookCsv(csvContent: string): NewbookCsvRow[] {
    const lines = csvContent.split("\n").filter(line => line.trim());
    if (lines.length < 2) return [];

    // Parse header
    const headerLine = lines[0];
    const headers = parseCSVLine(headerLine);

    // Parse data rows
    const rows: NewbookCsvRow[] = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length !== headers.length) continue;

        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
            row[h] = values[idx];
        });

        rows.push(row as unknown as NewbookCsvRow);
    }

    return rows;
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === "," && !inQuotes) {
            values.push(current.trim());
            current = "";
        } else {
            current += char;
        }
    }

    values.push(current.trim());
    return values;
}

/**
 * Export: Map internal reservation back to NewBook format (for future sync)
 */
export function mapInternalToNewbook(reservation: ReservationImportRecord): NewbookCsvRow {
    const formatDate = (iso: string) => {
        const d = new Date(iso);
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${months[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`;
    };

    const nights = Math.ceil(
        (new Date(reservation.departureDate).getTime() - new Date(reservation.arrivalDate).getTime())
        / (1000 * 60 * 60 * 24)
    );

    return {
        "Booking Name": `${reservation.guestId}`, // Would need guest lookup
        Site: reservation.siteId, // Would need site lookup for full name
        Arrival: formatDate(reservation.arrivalDate),
        Departure: formatDate(reservation.departureDate),
        "Calculated Stay Cost": (reservation.totalAmount / 100).toFixed(2),
        "Default Client Account": `(Booking #${reservation.externalId?.replace(/\D/g, "") || "0"})`,
        "Booking Client Account Balance": ((reservation.totalAmount - (reservation.paidAmount ?? 0)) / 100).toFixed(2),
        "Booking Duration": `${nights} Nights`,
        "Category Name": "", // Would need site class lookup
    };
}

// Notes for future enhancements
export const newbookAdapterNotes = `
NewBook Integration Notes:
- Basic CSV import supported
- Guest matching by email (placeholder emails generated during import)
- Site matching requires running resolver after import
- Group bookings are tagged but not linked (would need separate group import step)
- For ongoing sync, NewBook has an API - would need credentials setup
`;
