/**
 * Report-specific export functionality
 * Handles exporting different report types to CSV/Excel
 */

import {
  convertToCSV,
  convertToCSVWithSections,
  downloadCSV,
  downloadExcelCSV,
  formatCurrencyForExport,
  formatDateForExport,
  generateExportFilename,
  ExportFormat,
} from "./export-utils";

export interface ReservationData {
  id: string;
  siteId: string;
  arrivalDate: string;
  departureDate: string;
  status: string;
  totalAmount: number;
  paidAmount?: number;
  balanceAmount?: number;
  guest?: {
    primaryFirstName?: string;
    primaryLastName?: string;
  };
  occupants?: {
    adults?: number;
    children?: number;
  };
}

export interface SiteData {
  id: string;
  name: string;
  siteClassId?: string | null;
}

export interface LedgerEntry {
  id: string;
  reservationId?: string | null;
  direction: string;
  amountCents: number;
  description?: string | null;
  occurredAt: string;
  glCode?: string | null;
  account?: string | null;
}

/**
 * Export arrivals report
 */
export function exportArrivalsReport(
  reservations: ReservationData[],
  sites: SiteData[],
  dateRange: { start: string; end: string },
  format: ExportFormat = "csv",
) {
  const start = new Date(dateRange.start);
  const end = new Date(dateRange.end);
  end.setHours(23, 59, 59, 999);

  const arrivals = reservations
    .filter((r) => {
      const arrivalDate = new Date(r.arrivalDate);
      return arrivalDate >= start && arrivalDate <= end && r.status !== "cancelled";
    })
    .sort((a, b) => new Date(a.arrivalDate).getTime() - new Date(b.arrivalDate).getTime());

  const getSiteName = (siteId: string) => sites.find((s) => s.id === siteId)?.name ?? "Unknown";

  const exportData = arrivals.map((r) => ({
    "Guest Name": `${r.guest?.primaryFirstName || ""} ${r.guest?.primaryLastName || ""}`.trim(),
    Site: getSiteName(r.siteId),
    "Arrival Date": formatDateForExport(r.arrivalDate),
    "Departure Date": formatDateForExport(r.departureDate),
    Adults: r.occupants?.adults || 0,
    Children: r.occupants?.children || 0,
    "Total Amount": formatCurrencyForExport(r.totalAmount),
    "Paid Amount": formatCurrencyForExport(r.paidAmount),
    Balance: formatCurrencyForExport((r.totalAmount || 0) - (r.paidAmount || 0)),
    Status: r.status,
  }));

  const csv = convertToCSV(exportData);
  const filename = generateExportFilename("arrivals-report", format);

  if (format === "xlsx") {
    downloadExcelCSV(csv, filename);
  } else {
    downloadCSV(csv, filename);
  }
}

/**
 * Export departures report
 */
export function exportDeparturesReport(
  reservations: ReservationData[],
  sites: SiteData[],
  dateRange: { start: string; end: string },
  format: ExportFormat = "csv",
) {
  const start = new Date(dateRange.start);
  const end = new Date(dateRange.end);
  end.setHours(23, 59, 59, 999);

  const departures = reservations
    .filter((r) => {
      const departureDate = new Date(r.departureDate);
      return departureDate >= start && departureDate <= end && r.status !== "cancelled";
    })
    .sort((a, b) => new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime());

  const getSiteName = (siteId: string) => sites.find((s) => s.id === siteId)?.name ?? "Unknown";

  const exportData = departures.map((r) => ({
    "Guest Name": `${r.guest?.primaryFirstName || ""} ${r.guest?.primaryLastName || ""}`.trim(),
    Site: getSiteName(r.siteId),
    "Arrival Date": formatDateForExport(r.arrivalDate),
    "Departure Date": formatDateForExport(r.departureDate),
    Adults: r.occupants?.adults || 0,
    Children: r.occupants?.children || 0,
    "Total Amount": formatCurrencyForExport(r.totalAmount),
    "Paid Amount": formatCurrencyForExport(r.paidAmount),
    Balance: formatCurrencyForExport((r.totalAmount || 0) - (r.paidAmount || 0)),
    Status: r.status,
  }));

  const csv = convertToCSV(exportData);
  const filename = generateExportFilename("departures-report", format);

  if (format === "xlsx") {
    downloadExcelCSV(csv, filename);
  } else {
    downloadCSV(csv, filename);
  }
}

/**
 * Export in-house guests report
 */
export function exportInHouseGuestsReport(
  reservations: ReservationData[],
  sites: SiteData[],
  dateRange: { start: string; end: string },
  format: ExportFormat = "csv",
) {
  const start = new Date(dateRange.start);
  const end = new Date(dateRange.end);

  const inHouse = reservations
    .filter((r) => {
      if (r.status === "cancelled") return false;
      const arrivalDate = new Date(r.arrivalDate);
      const departureDate = new Date(r.departureDate);
      return arrivalDate <= end && departureDate > start;
    })
    .sort((a, b) => new Date(a.arrivalDate).getTime() - new Date(b.arrivalDate).getTime());

  const getSiteName = (siteId: string) => sites.find((s) => s.id === siteId)?.name ?? "Unknown";

  const exportData = inHouse.map((r) => {
    const departureDate = new Date(r.departureDate);
    const today = new Date();
    const nightsRemaining = Math.max(
      0,
      Math.ceil((departureDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
    );

    return {
      "Guest Name": `${r.guest?.primaryFirstName || ""} ${r.guest?.primaryLastName || ""}`.trim(),
      Site: getSiteName(r.siteId),
      "Arrival Date": formatDateForExport(r.arrivalDate),
      "Departure Date": formatDateForExport(r.departureDate),
      "Nights Remaining": nightsRemaining,
      Adults: r.occupants?.adults || 0,
      Children: r.occupants?.children || 0,
      "Total Amount": formatCurrencyForExport(r.totalAmount),
      "Paid Amount": formatCurrencyForExport(r.paidAmount),
      Balance: formatCurrencyForExport((r.totalAmount || 0) - (r.paidAmount || 0)),
      Status: r.status,
    };
  });

  const csv = convertToCSV(exportData);
  const filename = generateExportFilename("in-house-guests-report", format);

  if (format === "xlsx") {
    downloadExcelCSV(csv, filename);
  } else {
    downloadCSV(csv, filename);
  }
}

/**
 * Export generic reservation list
 */
export function exportReservationList(
  reservations: ReservationData[],
  sites: SiteData[],
  reportName: string,
  format: ExportFormat = "csv",
) {
  const getSiteName = (siteId: string) => sites.find((s) => s.id === siteId)?.name ?? "Unknown";

  const exportData = reservations.map((r) => {
    const arrival = new Date(r.arrivalDate);
    const departure = new Date(r.departureDate);
    const nights = Math.max(
      1,
      Math.floor((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24)),
    );

    return {
      "Reservation ID": r.id,
      "Guest Name": `${r.guest?.primaryFirstName || ""} ${r.guest?.primaryLastName || ""}`.trim(),
      Site: getSiteName(r.siteId),
      "Arrival Date": formatDateForExport(r.arrivalDate),
      "Departure Date": formatDateForExport(r.departureDate),
      Nights: nights,
      Adults: r.occupants?.adults || 0,
      Children: r.occupants?.children || 0,
      "Total Amount": formatCurrencyForExport(r.totalAmount),
      "Paid Amount": formatCurrencyForExport(r.paidAmount),
      Balance: formatCurrencyForExport((r.totalAmount || 0) - (r.paidAmount || 0)),
      Status: r.status,
    };
  });

  const csv = convertToCSV(exportData);
  const filename = generateExportFilename(reportName, format);

  if (format === "xlsx") {
    downloadExcelCSV(csv, filename);
  } else {
    downloadCSV(csv, filename);
  }
}

/**
 * Export ledger/transaction data
 */
export function exportLedgerReport(
  ledgerEntries: LedgerEntry[],
  reportName: string,
  format: ExportFormat = "csv",
) {
  const exportData = ledgerEntries.map((entry) => ({
    Date: formatDateForExport(entry.occurredAt),
    "Reservation ID": entry.reservationId || "",
    Type: entry.direction,
    Description: entry.description || "",
    Amount: formatCurrencyForExport(entry.amountCents),
  }));

  const csv = convertToCSV(exportData);
  const filename = generateExportFilename(reportName, format);

  if (format === "xlsx") {
    downloadExcelCSV(csv, filename);
  } else {
    downloadCSV(csv, filename);
  }
}

/**
 * Export revenue summary data
 */
export function exportRevenueSummary(
  data: Array<{ date: string; revenue: number; bookings: number }>,
  reportName: string,
  format: ExportFormat = "csv",
) {
  const exportData = data.map((item) => ({
    Date: item.date,
    Bookings: item.bookings,
    Revenue: formatCurrencyForExport(item.revenue * 100), // Assuming revenue is in dollars
  }));

  const csv = convertToCSV(exportData);
  const filename = generateExportFilename(reportName, format);

  if (format === "xlsx") {
    downloadExcelCSV(csv, filename);
  } else {
    downloadCSV(csv, filename);
  }
}

/**
 * Export cancellations report
 */
export function exportCancellationsReport(
  reservations: ReservationData[],
  sites: SiteData[],
  dateRange: { start: string; end: string },
  format: ExportFormat = "csv",
) {
  const getSiteName = (siteId: string) => sites.find((s) => s.id === siteId)?.name ?? "Unknown";

  const cancellations = reservations.filter((r) => r.status === "cancelled");

  const exportData = cancellations.map((r) => ({
    "Guest Name": `${r.guest?.primaryFirstName || ""} ${r.guest?.primaryLastName || ""}`.trim(),
    Site: getSiteName(r.siteId),
    "Arrival Date": formatDateForExport(r.arrivalDate),
    "Departure Date": formatDateForExport(r.departureDate),
    "Total Amount": formatCurrencyForExport(r.totalAmount),
    "Paid Amount": formatCurrencyForExport(r.paidAmount),
    Refunded: formatCurrencyForExport(r.paidAmount), // Assuming paid amount was refunded
    "Lost Revenue": formatCurrencyForExport((r.totalAmount || 0) - (r.paidAmount || 0)),
  }));

  const csv = convertToCSV(exportData);
  const filename = generateExportFilename("cancellations-report", format);

  if (format === "xlsx") {
    downloadExcelCSV(csv, filename);
  } else {
    downloadCSV(csv, filename);
  }
}

/**
 * Generic export function that handles unknown report types
 */
export function exportGenericReport(
  data: Record<string, unknown>[],
  reportName: string,
  format: ExportFormat = "csv",
) {
  if (!data || data.length === 0) {
    throw new Error("No data available to export");
  }

  const csv = convertToCSV(data);
  const filename = generateExportFilename(reportName, format);

  if (format === "xlsx") {
    downloadExcelCSV(csv, filename);
  } else {
    downloadCSV(csv, filename);
  }
}
