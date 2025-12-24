"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Upload,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertTriangle,
  Users,
  MapPin,
  DollarSign,
  Loader2,
  CheckCircle2,
  XCircle,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  ReservationImportModalProps,
  ImportStep,
  ReservationImportColumnMapping,
  UploadResponse,
  ReservationImportPreview,
  MatchResult,
  ParsedReservationRow,
  ReservationImportExecuteRow,
  RowOverride,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

// ============ Main Modal ============

export function ReservationImportModal({
  isOpen,
  onClose,
  campgroundId,
  token,
  sites,
  siteClasses,
  onComplete,
}: ReservationImportModalProps) {
  const [step, setStep] = useState<ImportStep>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Upload
  const [csvContent, setCsvContent] = useState<string>("");
  const [uploadResponse, setUploadResponse] = useState<UploadResponse | null>(null);

  // Step 2: Mapping
  const [mapping, setMapping] = useState<ReservationImportColumnMapping>({
    arrivalDate: "",
    departureDate: "",
  });

  // Step 3: Preview
  const [preview, setPreview] = useState<ReservationImportPreview | null>(null);
  const [rowOverrides, setRowOverrides] = useState<Map<number, RowOverride>>(new Map());

  // ============ API Calls ============

  const uploadCSV = async (content: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/campgrounds/${campgroundId}/import/reservations/upload`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-onboarding-token": token,
          },
          body: JSON.stringify({ csvContent: content }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to upload CSV");
      }
      const data: UploadResponse = await res.json();
      setUploadResponse(data);
      setCsvContent(content);

      // Apply suggested mapping
      const newMapping: ReservationImportColumnMapping = {
        arrivalDate: data.suggestedMapping.arrivalDate || "",
        departureDate: data.suggestedMapping.departureDate || "",
        firstName: data.suggestedMapping.firstName,
        lastName: data.suggestedMapping.lastName,
        email: data.suggestedMapping.email,
        phone: data.suggestedMapping.phone,
        siteNumber: data.suggestedMapping.siteNumber,
        siteName: data.suggestedMapping.siteName,
        siteClass: data.suggestedMapping.siteClass,
        totalAmount: data.suggestedMapping.totalAmount,
        paidAmount: data.suggestedMapping.paidAmount,
        adults: data.suggestedMapping.adults,
        children: data.suggestedMapping.children,
        confirmationNumber: data.suggestedMapping.confirmationNumber,
        status: data.suggestedMapping.status,
        notes: data.suggestedMapping.notes,
      };
      setMapping(newMapping);
      setStep(2);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const getPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/campgrounds/${campgroundId}/import/reservations/preview`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-onboarding-token": token,
          },
          body: JSON.stringify({ csvContent, mapping }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to preview import");
      }
      const data: ReservationImportPreview = await res.json();
      setPreview(data);

      // Initialize overrides from match results
      const overrides = new Map<number, RowOverride>();
      for (const m of data.matchResults) {
        overrides.set(m.rowIndex, {
          siteId: m.site.matchedSiteId,
          siteClassId: m.site.suggestedSiteClassId,
          useSystemPricing: false,
          skip: m.site.conflict ? true : false,
        });
      }
      setRowOverrides(overrides);
      setStep(3);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const executeImport = async () => {
    if (!preview) return;

    setLoading(true);
    setError(null);
    try {
      // Build execute rows from overrides
      const defaultOverride: RowOverride = { useSystemPricing: false, skip: false };
      const rows: ReservationImportExecuteRow[] = preview.matchResults.map((m) => {
        const override = rowOverrides.get(m.rowIndex) ?? defaultOverride;
        const parsed = preview.parsedRows.find((p) => p.rowIndex === m.rowIndex);

        return {
          rowIndex: m.rowIndex,
          siteId: override.siteId || m.site.matchedSiteId,
          siteClassId: override.siteClassId || m.site.suggestedSiteClassId,
          guestId: m.guest.existingGuestId,
          createGuest: m.guest.matchType === "will_create" && parsed ? {
            firstName: parsed.guest.firstName,
            lastName: parsed.guest.lastName,
            email: parsed.guest.email,
            phone: parsed.guest.phone,
          } : undefined,
          useSystemPricing: override.useSystemPricing ?? false,
          manualTotalOverrideCents: override.manualTotalOverrideCents,
          skip: override.skip ?? false,
        };
      });

      const res = await fetch(
        `${API_BASE}/campgrounds/${campgroundId}/import/reservations/execute`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-onboarding-token": token,
          },
          body: JSON.stringify({ csvContent, mapping, rows }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to execute import");
      }
      const result = await res.json();
      setStep(4);
      onComplete(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ============ File Handling ============

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      uploadCSV(content);
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      uploadCSV(content);
    };
    reader.readAsText(file);
  }, []);

  // ============ Override Handlers ============

  const updateRowOverride = (rowIndex: number, updates: Partial<RowOverride>) => {
    setRowOverrides((prev) => {
      const next = new Map(prev);
      const current = next.get(rowIndex) || {
        useSystemPricing: false,
        skip: false,
      };
      next.set(rowIndex, { ...current, ...updates });
      return next;
    });
  };

  // ============ Render ============

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-hidden bg-slate-900 border border-slate-700 rounded-xl shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-white">Import Reservations</h2>
            <p className="text-sm text-slate-400">
              Step {step} of 4 -{" "}
              {step === 1 && "Upload CSV"}
              {step === 2 && "Map Columns"}
              {step === 3 && "Review & Match"}
              {step === 4 && "Complete"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="px-6 py-3 bg-slate-800/50">
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  s <= step ? "bg-emerald-500" : "bg-slate-700"
                )}
              />
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <Step1Upload
                loading={loading}
                onFileChange={handleFileChange}
                onDrop={handleDrop}
              />
            )}
            {step === 2 && uploadResponse && (
              <Step2Mapping
                headers={uploadResponse.headers}
                sampleRows={uploadResponse.sampleRows}
                mapping={mapping}
                onMappingChange={setMapping}
              />
            )}
            {step === 3 && preview && (
              <Step3Preview
                preview={preview}
                rowOverrides={rowOverrides}
                sites={sites}
                siteClasses={siteClasses}
                onUpdateRow={updateRowOverride}
              />
            )}
            {step === 4 && (
              <Step4Complete />
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700 bg-slate-800/50">
          <div>
            {step > 1 && step < 4 && (
              <Button
                variant="ghost"
                onClick={() => setStep((s) => (s - 1) as ImportStep)}
                disabled={loading}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            {step < 4 && (
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
            )}
            {step === 2 && (
              <Button
                onClick={getPreview}
                disabled={loading || !mapping.arrivalDate || !mapping.departureDate}
                className="bg-emerald-600 hover:bg-emerald-500"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4 mr-2" />
                )}
                Preview Import
              </Button>
            )}
            {step === 3 && (
              <Button
                onClick={executeImport}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-500"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Import {preview?.summary.validRows || 0} Reservations
              </Button>
            )}
            {step === 4 && (
              <Button onClick={onClose} className="bg-emerald-600 hover:bg-emerald-500">
                Done
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ============ Step 1: Upload ============

function Step1Upload({
  loading,
  onFileChange,
  onDrop,
}: {
  loading: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className={cn(
          "border-2 border-dashed rounded-xl p-12 text-center transition-colors",
          loading
            ? "border-slate-600 bg-slate-800/30"
            : "border-slate-600 hover:border-emerald-500 cursor-pointer"
        )}
      >
        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
            <p className="text-slate-400">Processing CSV...</p>
          </div>
        ) : (
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".csv"
              onChange={onFileChange}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
                <Upload className="w-8 h-8 text-emerald-500" />
              </div>
              <div>
                <p className="text-white font-medium">
                  Drop your CSV file here or click to browse
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  Export reservations from your current system as CSV
                </p>
              </div>
            </div>
          </label>
        )}
      </div>

      <div className="bg-slate-800/50 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="w-5 h-5 text-slate-400 mt-0.5" />
          <div className="text-sm flex-1">
            <div className="flex items-center justify-between">
              <p className="text-slate-300 font-medium">Expected columns:</p>
              <button
                onClick={() => {
                  const template = `arrival_date,departure_date,first_name,last_name,email,phone,site_number,total_amount,paid_amount,adults,children,confirmation_number,status,notes
2025-01-15,2025-01-18,John,Doe,john@example.com,555-1234,A1,150.00,150.00,2,1,RES-001,confirmed,Returning guest
2025-01-20,2025-01-22,Jane,Smith,jane@example.com,555-5678,B3,100.00,50.00,2,0,RES-002,confirmed,`;
                  const blob = new Blob([template], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "reservation-import-template.csv";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="text-xs text-emerald-400 hover:text-emerald-300 underline"
              >
                Download Template
              </button>
            </div>
            <p className="text-slate-500 mt-1">
              arrival_date, departure_date, first_name, last_name, email, site_number (or site_class), total_amount
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============ Step 2: Column Mapping ============

function Step2Mapping({
  headers,
  sampleRows,
  mapping,
  onMappingChange,
}: {
  headers: string[];
  sampleRows: Record<string, string>[];
  mapping: ReservationImportColumnMapping;
  onMappingChange: (m: ReservationImportColumnMapping) => void;
}) {
  const fields = [
    { key: "arrivalDate", label: "Arrival Date", required: true },
    { key: "departureDate", label: "Departure Date", required: true },
    { key: "firstName", label: "First Name", required: false },
    { key: "lastName", label: "Last Name", required: false },
    { key: "email", label: "Email", required: false },
    { key: "phone", label: "Phone", required: false },
    { key: "siteNumber", label: "Site Number", required: false },
    { key: "siteClass", label: "Site Class", required: false },
    { key: "totalAmount", label: "Total Amount", required: false },
    { key: "paidAmount", label: "Paid Amount", required: false },
    { key: "adults", label: "Adults", required: false },
    { key: "children", label: "Children", required: false },
    { key: "confirmationNumber", label: "Confirmation #", required: false },
    { key: "status", label: "Status", required: false },
    { key: "notes", label: "Notes", required: false },
  ];

  const updateMapping = (key: string, value: string) => {
    onMappingChange({ ...mapping, [key]: value || undefined });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <p className="text-slate-400 text-sm">
        Map your CSV columns to reservation fields. Required fields are marked with *.
      </p>

      <div className="grid grid-cols-2 gap-4">
        {fields.map((field) => (
          <div key={field.key} className="space-y-1">
            <Label className="text-sm text-slate-300">
              {field.label}
              {field.required && <span className="text-red-400 ml-1">*</span>}
            </Label>
            <Select
              value={(mapping as any)[field.key] || ""}
              onValueChange={(v) => updateMapping(field.key, v)}
            >
              <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                <SelectValue placeholder="Select column..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {headers.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      {/* Sample data preview */}
      {sampleRows.length > 0 && (
        <div className="mt-6">
          <p className="text-sm text-slate-400 mb-2">Sample data (first 3 rows):</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  {headers.slice(0, 6).map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-slate-400 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sampleRows.slice(0, 3).map((row, i) => (
                  <tr key={i} className="border-b border-slate-800">
                    {headers.slice(0, 6).map((h) => (
                      <td key={h} className="px-3 py-2 text-slate-300">
                        {row[h] || "-"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ============ Step 3: Preview ============

function Step3Preview({
  preview,
  rowOverrides,
  sites,
  siteClasses,
  onUpdateRow,
}: {
  preview: ReservationImportPreview;
  rowOverrides: Map<number, RowOverride>;
  sites: Array<{ id: string; name: string; siteNumber: string }>;
  siteClasses: Array<{ id: string; name: string }>;
  onUpdateRow: (rowIndex: number, updates: Partial<RowOverride>) => void;
}) {
  const { summary, parsedRows, matchResults } = preview;

  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-white">{summary.totalRows}</p>
          <p className="text-xs text-slate-400">Total Rows</p>
        </div>
        <div className="bg-emerald-500/20 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-emerald-400">{summary.sitesMatched}</p>
          <p className="text-xs text-slate-400">Sites Matched</p>
        </div>
        <div className="bg-blue-500/20 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-blue-400">{summary.guestsToCreate}</p>
          <p className="text-xs text-slate-400">New Guests</p>
        </div>
        <div className="bg-amber-500/20 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-amber-400">{summary.hasConflicts}</p>
          <p className="text-xs text-slate-400">Conflicts</p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="px-2 py-2 text-left text-slate-400 font-medium w-8">#</th>
              <th className="px-2 py-2 text-left text-slate-400 font-medium">Guest</th>
              <th className="px-2 py-2 text-left text-slate-400 font-medium">Dates</th>
              <th className="px-2 py-2 text-left text-slate-400 font-medium">Site</th>
              <th className="px-2 py-2 text-left text-slate-400 font-medium">Pricing</th>
              <th className="px-2 py-2 text-left text-slate-400 font-medium w-16">Skip</th>
            </tr>
          </thead>
          <tbody>
            {matchResults.map((match) => {
              const parsed = parsedRows.find((p) => p.rowIndex === match.rowIndex);
              const defaultOverride: RowOverride = { useSystemPricing: false, skip: false };
              const override = rowOverrides.get(match.rowIndex) ?? defaultOverride;
              if (!parsed) return null;

              return (
                <tr
                  key={match.rowIndex}
                  className={cn(
                    "border-b border-slate-800",
                    override.skip && "opacity-50"
                  )}
                >
                  <td className="px-2 py-3 text-slate-500">{match.rowIndex + 1}</td>

                  {/* Guest */}
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2">
                      {match.guest.matchType === "existing" ? (
                        <Users className="w-4 h-4 text-blue-400" />
                      ) : (
                        <UserPlus className="w-4 h-4 text-emerald-400" />
                      )}
                      <div>
                        <p className="text-white">
                          {parsed.guest.firstName} {parsed.guest.lastName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {match.guest.matchType === "existing"
                            ? "Existing guest"
                            : "Will create"}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Dates */}
                  <td className="px-2 py-3">
                    <p className="text-white">
                      {new Date(parsed.stay.arrivalDate).toLocaleDateString()} -{" "}
                      {new Date(parsed.stay.departureDate).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-slate-500">{parsed.stay.nights} nights</p>
                  </td>

                  {/* Site */}
                  <td className="px-2 py-3">
                    {match.site.matchType === "exact_number" ||
                    match.site.matchType === "exact_name" ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-white">
                          {match.site.matchedSiteNumber || match.site.matchedSiteName}
                        </span>
                        {match.site.conflict && (
                          <span className="text-xs text-red-400 ml-2">
                            (conflict)
                          </span>
                        )}
                      </div>
                    ) : (
                      <Select
                        value={override.siteId || ""}
                        onValueChange={(v) => onUpdateRow(match.rowIndex, { siteId: v })}
                      >
                        <SelectTrigger className="h-8 bg-slate-800 border-slate-600 text-white text-xs">
                          <SelectValue placeholder="Select site..." />
                        </SelectTrigger>
                        <SelectContent>
                          {(match.site.availableSites || sites).map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.siteNumber} - {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </td>

                  {/* Pricing */}
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="text-white">
                          {formatCents(match.pricing.csvTotalCents)}
                        </p>
                        {match.pricing.calculatedTotalCents > 0 && (
                          <p
                            className={cn(
                              "text-xs",
                              match.pricing.requiresReview
                                ? "text-amber-400"
                                : "text-slate-500"
                            )}
                          >
                            System: {formatCents(match.pricing.calculatedTotalCents)}
                          </p>
                        )}
                      </div>
                      {match.pricing.requiresReview && (
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                      )}
                    </div>
                  </td>

                  {/* Skip */}
                  <td className="px-2 py-3">
                    <input
                      type="checkbox"
                      checked={override.skip || false}
                      onChange={(e) =>
                        onUpdateRow(match.rowIndex, { skip: e.target.checked })
                      }
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

// ============ Step 4: Complete ============

function Step4Complete() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center py-12"
    >
      <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center mb-6">
        <CheckCircle2 className="w-10 h-10 text-emerald-400" />
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">Import Complete!</h3>
      <p className="text-slate-400">
        Your reservations have been imported successfully.
      </p>
    </motion.div>
  );
}

export default ReservationImportModal;
