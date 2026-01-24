"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, FileText, AlertCircle, CheckCircle, Loader2 } from "lucide-react";

type ParsedRow = {
  guestName: string;
  siteName: string;
  siteClass: string;
  arrival: string;
  departure: string;
  total: string;
  balance: string;
  bookingId: string;
};

type ImportPreview = {
  rows: ParsedRow[];
  siteClasses: Set<string>;
  sites: Set<string>;
  guests: Set<string>;
  warnings: string[];
};

/**
 * Parse NewBook CSV locally for preview
 * This mirrors the backend adapter logic for client-side preview
 */
function parseNewbookCsvLocally(csvContent: string): ImportPreview {
  const lines = csvContent.split("\n").filter((line) => line.trim());
  if (lines.length < 2)
    return {
      rows: [],
      siteClasses: new Set(),
      sites: new Set(),
      guests: new Set(),
      warnings: ["No data rows found"],
    };

  // Parse header
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);

  // Parse data rows
  const rows: ParsedRow[] = [];
  const siteClasses = new Set<string>();
  const sites = new Set<string>();
  const guests = new Set<string>();
  const warnings: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) continue;

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx];
    });

    // Extract data
    const guestName = row["Booking Name"] || "";
    const siteFull = row["Site"] || "";
    const siteClass = row["Category Name"] || "";
    const arrival = row["Arrival"] || "";
    const departure = row["Departure"] || "";
    const total = row["Calculated Stay Cost"] || "0";
    const balance = row["Booking Client Account Balance"] || "0";
    const accountField = row["Default Client Account"] || "";

    // Extract site number from full name
    const siteParts = siteFull.trim().split(/\s+/);
    const siteNumber = siteParts[siteParts.length - 1] || siteFull;

    // Extract booking ID
    const bookingMatch = accountField.match(/\((Booking|Group|Guest) #(\d+)\)/i);
    const bookingId = bookingMatch ? `${bookingMatch[1]}-${bookingMatch[2]}` : "";

    rows.push({
      guestName,
      siteName: siteNumber,
      siteClass,
      arrival,
      departure,
      total,
      balance,
      bookingId,
    });

    if (siteClass) siteClasses.add(siteClass);
    if (siteNumber) sites.add(`${siteClass} > ${siteNumber}`);
    if (guestName && guestName !== "No Guest Data") guests.add(guestName);
  }

  return { rows, siteClasses, sites, guests, warnings };
}

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

type NewbookImportProps = {
  campgroundId: string;
  onImportComplete?: () => void;
};

export function NewbookImport({ campgroundId, onImportComplete }: NewbookImportProps) {
  const [csvContent, setCsvContent] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(
    null,
  );
  const [dragOver, setDragOver] = useState(false);

  const handleFileUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result !== "string") {
        setImportResult({
          success: false,
          message: "Unable to read CSV file",
        });
        return;
      }
      setCsvContent(result);
      const parsed = parseNewbookCsvLocally(result);
      setPreview(parsed);
      setImportResult(null);
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith(".csv")) {
        handleFileUpload(file);
      }
    },
    [handleFileUpload],
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileUpload(file);
      }
    },
    [handleFileUpload],
  );

  const handleImport = async (dryRun: boolean) => {
    if (!csvContent) return;

    setImporting(true);
    setImportResult(null);

    try {
      const response = await fetch(`/api/campgrounds/${campgroundId}/reservations/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: "newbook",
          payload: csvContent,
          dryRun,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setImportResult({
          success: true,
          message: dryRun
            ? `Validation passed! ${result.validCount} reservations ready to import.`
            : `Successfully imported ${result.validCount} reservations.`,
        });
        if (!dryRun && onImportComplete) {
          onImportComplete();
        }
      } else {
        setImportResult({
          success: false,
          message: result.message || "Import failed",
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to connect to server";
      setImportResult({
        success: false,
        message,
      });
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setCsvContent("");
    setPreview(null);
    setImportResult(null);
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">NewBook Import</h2>
          <p className="text-sm text-muted-foreground">
            Import reservations from NewBook CSV export
          </p>
        </div>
        {preview && (
          <Button variant="outline" size="sm" onClick={reset}>
            Start Over
          </Button>
        )}
      </div>

      {!preview ? (
        // Upload area
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragOver ? "border-blue-500 bg-blue-50" : "border-border hover:border-border"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">Drop your NewBook CSV here</p>
          <p className="text-xs text-muted-foreground mb-3">or click to select a file</p>
          <label className="cursor-pointer">
            <input type="file" accept=".csv" className="hidden" onChange={handleFileInputChange} />
            <Button variant="outline" size="sm" asChild>
              <span>Select CSV File</span>
            </Button>
          </label>
        </div>
      ) : (
        // Preview and import
        <div className="space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-blue-700">{preview.rows.length}</p>
              <p className="text-xs text-blue-600">Reservations</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-purple-700">{preview.guests.size}</p>
              <p className="text-xs text-purple-600">Unique Guests</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-emerald-700">{preview.siteClasses.size}</p>
              <p className="text-xs text-emerald-600">Site Classes</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-amber-700">{preview.sites.size}</p>
              <p className="text-xs text-amber-600">Unique Sites</p>
            </div>
          </div>

          {/* Site classes to create */}
          {preview.siteClasses.size > 0 && (
            <div className="bg-muted rounded-lg p-4">
              <h3 className="text-sm font-medium text-foreground mb-2">Site Classes Found</h3>
              <div className="flex flex-wrap gap-2">
                {Array.from(preview.siteClasses).map((cls) => (
                  <span
                    key={cls}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-card border border-border text-foreground"
                  >
                    {cls}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                These site classes will need to exist before import
              </p>
            </div>
          )}

          {/* Preview table */}
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-h-64">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Guest</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Site</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Arrival
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Departure
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      Total
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {preview.rows.slice(0, 20).map((row, idx) => (
                    <tr key={idx} className="hover:bg-muted">
                      <td className="px-3 py-2 text-foreground">{row.guestName}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.siteName}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.arrival}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.departure}</td>
                      <td className="px-3 py-2 text-right text-foreground">${row.total}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">${row.balance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.rows.length > 20 && (
              <div className="bg-muted px-3 py-2 text-xs text-muted-foreground text-center border-t">
                Showing first 20 of {preview.rows.length} reservations
              </div>
            )}
          </div>

          {/* Import result */}
          {importResult && (
            <div
              className={`rounded-lg p-4 flex items-start gap-3 ${
                importResult.success ? "bg-emerald-50" : "bg-red-50"
              }`}
            >
              {importResult.success ? (
                <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              )}
              <p
                className={`text-sm ${importResult.success ? "text-emerald-800" : "text-red-800"}`}
              >
                {importResult.message}
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => handleImport(true)} disabled={importing}>
              {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Validate Only
            </Button>
            <Button onClick={() => handleImport(false)} disabled={importing}>
              {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Import {preview.rows.length} Reservations
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
