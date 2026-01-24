/**
 * CSV/Excel export utilities for reports
 */

export type ExportFormat = "csv" | "xlsx";

/**
 * Escapes special characters in CSV fields
 */
function escapeCSVField(field: unknown): string {
  if (field === null || field === undefined) {
    return "";
  }

  const stringValue = String(field);

  // Check if field contains special characters that require quoting
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    // Escape double quotes by doubling them
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Converts an array of objects to CSV format
 */
export function convertToCSV(data: Array<Record<string, unknown>>, headers?: string[]): string {
  if (!data || data.length === 0) {
    return "";
  }

  // Use provided headers or extract from first object
  const columnHeaders = headers || Object.keys(data[0]);

  // Build header row
  const headerRow = columnHeaders.map(escapeCSVField).join(",");

  // Build data rows
  const dataRows = data.map((row) => {
    return columnHeaders
      .map((header) => {
        const value = row[header];
        return escapeCSVField(value);
      })
      .join(",");
  });

  return [headerRow, ...dataRows].join("\n");
}

/**
 * Converts an array of objects to CSV with multiple sections
 */
export function convertToCSVWithSections(
  sections: Array<{
    title: string;
    data: Array<Record<string, unknown>>;
    headers?: string[];
  }>,
): string {
  const csvParts: string[] = [];

  sections.forEach((section, index) => {
    // Add section title
    csvParts.push(section.title);

    // Add section data
    if (section.data && section.data.length > 0) {
      csvParts.push(convertToCSV(section.data, section.headers));
    } else {
      csvParts.push("No data available");
    }

    // Add blank line between sections (except after last section)
    if (index < sections.length - 1) {
      csvParts.push("");
    }
  });

  return csvParts.join("\n");
}

/**
 * Triggers a browser download of a file
 */
export function downloadFile(content: string, filename: string, mimeType: string = "text/csv") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads CSV data
 */
export function downloadCSV(content: string, filename: string) {
  // Add .csv extension if not present
  const csvFilename = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  downloadFile(content, csvFilename, "text/csv;charset=utf-8;");
}

/**
 * Formats currency values for export
 */
export function formatCurrencyForExport(cents: number | undefined | null): string {
  if (cents === null || cents === undefined) return "0.00";
  return (cents / 100).toFixed(2);
}

/**
 * Formats date for export
 */
export function formatDateForExport(date: string | Date): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().split("T")[0];
}

/**
 * Generates a timestamp-based filename
 */
export function generateExportFilename(reportName: string, format: ExportFormat = "csv"): string {
  const timestamp = new Date().toISOString().slice(0, 10);
  const safeName = reportName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `${safeName}-${timestamp}.${format}`;
}

/**
 * Converts tabular data to Excel-compatible CSV (with proper encoding)
 */
export function convertToExcelCSV(
  data: Array<Record<string, unknown>>,
  headers?: string[],
): string {
  const csv = convertToCSV(data, headers);
  // Add BOM for Excel to recognize UTF-8
  return "\uFEFF" + csv;
}

/**
 * Downloads Excel-compatible CSV
 */
export function downloadExcelCSV(content: string, filename: string) {
  const excelFilename = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  const contentWithBOM = content.startsWith("\uFEFF") ? content : "\uFEFF" + content;
  downloadFile(contentWithBOM, excelFilename, "text/csv;charset=utf-8;");
}
