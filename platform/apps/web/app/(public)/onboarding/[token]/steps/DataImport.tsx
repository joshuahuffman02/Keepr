"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertCircle,
  Table,
  Loader2,
  X,
  Download,
  ChevronDown,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface FieldMapping {
  sourceField: string;
  targetField: string;
}

interface PreviewRow {
  [key: string]: string;
}

interface ImportPreview {
  totalRows: number;
  newCount: number;
  updateCount: number;
  errorCount: number;
  errors: Array<{ row: number; message: string }>;
  preview: PreviewRow[];
}

interface DataImportProps {
  campgroundId: string;
  token: string;
  onComplete: (result: { sitesCreated: number; siteClassesCreated: number }) => void;
  onSkip: () => void;
  isLoading?: boolean;
}

type ImportStep = "upload" | "mapping" | "preview" | "complete";

const SITE_TARGET_FIELDS = [
  { value: "siteNumber", label: "Site Number", required: true },
  { value: "name", label: "Site Name", required: false },
  { value: "siteType", label: "Site Type (rv/tent/cabin)", required: true },
  { value: "siteClassName", label: "Site Class Name", required: false },
  { value: "maxLength", label: "Max Length (ft)", required: false },
  { value: "maxOccupancy", label: "Max Occupancy", required: false },
  { value: "defaultRate", label: "Nightly Rate ($)", required: false },
  { value: "hookupsPower", label: "Power Hookup (yes/no)", required: false },
  { value: "hookupsWater", label: "Water Hookup (yes/no)", required: false },
  { value: "hookupsSewer", label: "Sewer Hookup (yes/no)", required: false },
  { value: "petFriendly", label: "Pet Friendly (yes/no)", required: false },
  { value: "description", label: "Description", required: false },
];

export function DataImport({
  campgroundId,
  token,
  onComplete,
  onSkip,
  isLoading = false,
}: DataImportProps) {
  const prefersReducedMotion = useReducedMotion();
  const [step, setStep] = useState<ImportStep>("upload");
  const [csvContent, setCsvContent] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [sourceFields, setSourceFields] = useState<string[]>([]);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parse CSV headers
  const parseCSVHeaders = (content: string): string[] => {
    const lines = content.trim().split("\n");
    if (lines.length === 0) return [];
    const headerLine = lines[0];
    return headerLine.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  };

  // Handle file upload
  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setFileName(file.name);
      setError(null);

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setCsvContent(content);
        const headers = parseCSVHeaders(content);
        setSourceFields(headers);

        // Auto-suggest mappings based on field name similarity
        const autoMappings: FieldMapping[] = [];
        headers.forEach((header) => {
          const normalizedHeader = header.toLowerCase().replace(/[_\s-]/g, "");
          const match = SITE_TARGET_FIELDS.find((field) => {
            const normalizedTarget = field.value.toLowerCase();
            const normalizedLabel = field.label.toLowerCase().replace(/[_\s-]/g, "");
            return (
              normalizedHeader.includes(normalizedTarget) ||
              normalizedTarget.includes(normalizedHeader) ||
              normalizedHeader.includes(normalizedLabel) ||
              normalizedLabel.includes(normalizedHeader)
            );
          });
          if (match) {
            autoMappings.push({
              sourceField: header,
              targetField: match.value,
            });
          }
        });
        setMappings(autoMappings);
        setStep("mapping");
      };
      reader.readAsText(file);
    },
    []
  );

  // Handle drag and drop
  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      if (file && file.name.endsWith(".csv")) {
        const input = document.createElement("input");
        input.type = "file";
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        input.files = dataTransfer.files;
        handleFileUpload({ target: input } as any);
      }
    },
    [handleFileUpload]
  );

  // Update mapping
  const updateMapping = (sourceField: string, targetField: string) => {
    setMappings((prev) => {
      const existing = prev.find((m) => m.sourceField === sourceField);
      if (existing) {
        if (targetField === "") {
          return prev.filter((m) => m.sourceField !== sourceField);
        }
        return prev.map((m) =>
          m.sourceField === sourceField ? { ...m, targetField } : m
        );
      }
      if (targetField !== "") {
        return [...prev, { sourceField, targetField }];
      }
      return prev;
    });
  };

  // Run preview
  const runPreview = async () => {
    setImporting(true);
    setError(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE}/campgrounds/${campgroundId}/import/preview`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Onboarding-Token": token,
          },
          body: JSON.stringify({
            entityType: "sites",
            csvContent,
            mappings,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Preview failed");
      }

      const result = await response.json();
      setPreview(result);
      setStep("preview");
    } catch (err: any) {
      setError(err.message || "Failed to preview import");
    } finally {
      setImporting(false);
    }
  };

  // Execute import
  const executeImport = async () => {
    setImporting(true);
    setError(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE}/campgrounds/${campgroundId}/import/execute`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Onboarding-Token": token,
          },
          body: JSON.stringify({
            entityType: "sites",
            csvContent,
            mappings,
            updateExisting: false,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Import failed");
      }

      const result = await response.json();
      setStep("complete");
      onComplete({
        sitesCreated: result.createdCount || 0,
        siteClassesCreated: result.siteClassesCreated || 0,
      });
    } catch (err: any) {
      setError(err.message || "Failed to execute import");
    } finally {
      setImporting(false);
    }
  };

  // Check if required fields are mapped
  const requiredFieldsMapped = SITE_TARGET_FIELDS.filter((f) => f.required).every(
    (field) => mappings.some((m) => m.targetField === field.value)
  );

  return (
    <div className="max-w-3xl">
      <motion.div
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
        className="space-y-8"
      >
        {/* Header */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/20 mb-4">
            <FileSpreadsheet className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Import Your Sites
          </h2>
          <p className="text-slate-400">
            Upload a CSV file with your existing site inventory
          </p>
        </motion.div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2">
          {(["upload", "mapping", "preview", "complete"] as ImportStep[]).map(
            (s, i) => (
              <div key={s} className="flex items-center">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                    step === s
                      ? "bg-emerald-500 text-white"
                      : ["upload", "mapping", "preview", "complete"].indexOf(step) > i
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-slate-700 text-slate-500"
                  )}
                >
                  {["upload", "mapping", "preview", "complete"].indexOf(step) > i ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    i + 1
                  )}
                </div>
                {i < 3 && (
                  <div
                    className={cn(
                      "w-12 h-0.5 mx-1",
                      ["upload", "mapping", "preview", "complete"].indexOf(step) > i
                        ? "bg-emerald-500/50"
                        : "bg-slate-700"
                    )}
                  />
                )}
              </div>
            )
          )}
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          {/* Upload step */}
          {step === "upload" && (
            <motion.div
              key="upload"
              initial={prefersReducedMotion ? {} : { opacity: 0, x: 20 }}
              animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
              exit={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-slate-700 rounded-xl p-12 text-center hover:border-slate-600 transition-colors"
              >
                <Upload className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                <p className="text-slate-300 mb-2">
                  Drag and drop your CSV file here
                </p>
                <p className="text-slate-500 text-sm mb-4">or</p>
                <label className="inline-block">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <span className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-medium cursor-pointer hover:bg-slate-700 transition-colors">
                    Browse Files
                  </span>
                </label>
              </div>

              <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-slate-400 flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-slate-300 font-medium">
                        CSV Format Tips
                      </p>
                      <button
                        onClick={() => {
                          const template = `site_number,name,site_type,site_class,max_length,max_occupancy,nightly_rate,power_hookup,water_hookup,sewer_hookup,pet_friendly,description
A1,Site A1,rv,Full Hookup RV,45,6,55.00,yes,yes,yes,yes,Spacious pull-through site
A2,Site A2,rv,Full Hookup RV,45,6,55.00,yes,yes,yes,yes,Back-in site with shade
T1,Site T1,tent,Tent Sites,0,4,25.00,no,yes,no,yes,Walk-in tent site near creek
C1,Cabin 1,cabin,Rustic Cabins,0,4,95.00,yes,no,no,no,One room cabin with queen bed`;
                          const blob = new Blob([template], { type: "text/csv" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = "site-import-template.csv";
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="text-xs text-emerald-400 hover:text-emerald-300 underline flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        Download Template
                      </button>
                    </div>
                    <ul className="list-disc list-inside space-y-1">
                      <li>First row should be column headers</li>
                      <li>Required: Site Number and Site Type</li>
                      <li>
                        Site types: rv, tent, cabin, yurt, glamping
                      </li>
                      <li>Hookups can be yes/no, true/false, or 1/0</li>
                    </ul>
                  </div>
                </div>
              </div>

              <button
                onClick={onSkip}
                className="w-full text-center text-sm text-slate-500 hover:text-slate-400 transition-colors"
              >
                Skip import and build sites manually
              </button>
            </motion.div>
          )}

          {/* Mapping step */}
          {step === "mapping" && (
            <motion.div
              key="mapping"
              initial={prefersReducedMotion ? {} : { opacity: 0, x: 20 }}
              animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
              exit={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-white">{fileName}</h3>
                  <p className="text-sm text-slate-500">
                    {sourceFields.length} columns detected
                  </p>
                </div>
                <button
                  onClick={() => {
                    setStep("upload");
                    setCsvContent("");
                    setFileName("");
                    setSourceFields([]);
                    setMappings([]);
                  }}
                  className="text-sm text-slate-500 hover:text-slate-300"
                >
                  Change file
                </button>
              </div>

              <div className="space-y-3">
                <Label className="text-sm text-slate-400">
                  Map your columns to site fields
                </Label>
                <div className="bg-slate-800/30 border border-slate-700 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-2 gap-4 p-3 bg-slate-800/50 text-sm font-medium text-slate-400 border-b border-slate-700">
                    <div>Your Column</div>
                    <div>Maps To</div>
                  </div>
                  <div className="divide-y divide-slate-700/50">
                    {sourceFields.map((field) => {
                      const mapping = mappings.find(
                        (m) => m.sourceField === field
                      );
                      return (
                        <div
                          key={field}
                          className="grid grid-cols-2 gap-4 p-3 items-center"
                        >
                          <div className="font-mono text-sm text-white truncate">
                            {field}
                          </div>
                          <Select
                            value={mapping?.targetField || ""}
                            onValueChange={(v) => updateMapping(field, v)}
                          >
                            <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                              <SelectValue placeholder="Select field..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">-- Skip --</SelectItem>
                              {SITE_TARGET_FIELDS.map((target) => (
                                <SelectItem
                                  key={target.value}
                                  value={target.value}
                                  disabled={
                                    mappings.some(
                                      (m) =>
                                        m.targetField === target.value &&
                                        m.sourceField !== field
                                    )
                                  }
                                >
                                  {target.label}
                                  {target.required && " *"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {!requiredFieldsMapped && (
                  <p className="text-sm text-amber-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Please map required fields: Site Number and Site Type
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep("upload")}
                  className="border-slate-700 text-slate-300"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={runPreview}
                  disabled={!requiredFieldsMapped || importing}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Preview Import
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Preview step */}
          {step === "preview" && preview && (
            <motion.div
              key="preview"
              initial={prefersReducedMotion ? {} : { opacity: 0, x: 20 }}
              animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
              exit={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-400">
                    {preview.newCount}
                  </p>
                  <p className="text-sm text-slate-400">Sites to Create</p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-blue-400">
                    {preview.updateCount}
                  </p>
                  <p className="text-sm text-slate-400">To Update</p>
                </div>
                <div
                  className={cn(
                    "rounded-lg p-4 text-center border",
                    preview.errorCount > 0
                      ? "bg-red-500/10 border-red-500/30"
                      : "bg-slate-800/30 border-slate-700"
                  )}
                >
                  <p
                    className={cn(
                      "text-2xl font-bold",
                      preview.errorCount > 0 ? "text-red-400" : "text-slate-500"
                    )}
                  >
                    {preview.errorCount}
                  </p>
                  <p className="text-sm text-slate-400">Errors</p>
                </div>
              </div>

              {/* Errors */}
              {preview.errors.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-400 mb-2">
                    {preview.errors.length} row(s) have errors:
                  </p>
                  <ul className="text-sm text-red-300 space-y-1 max-h-32 overflow-y-auto">
                    {preview.errors.slice(0, 10).map((err, i) => (
                      <li key={i}>
                        Row {err.row}: {err.message}
                      </li>
                    ))}
                    {preview.errors.length > 10 && (
                      <li className="text-slate-500">
                        ...and {preview.errors.length - 10} more
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Preview table */}
              <div className="bg-slate-800/30 border border-slate-700 rounded-lg overflow-hidden">
                <div className="p-3 border-b border-slate-700">
                  <h4 className="font-medium text-white flex items-center gap-2">
                    <Table className="w-4 h-4" />
                    Preview (first 10 rows)
                  </h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-800/50">
                      <tr>
                        {mappings.map((m) => (
                          <th
                            key={m.targetField}
                            className="px-3 py-2 text-left text-slate-400 font-medium"
                          >
                            {SITE_TARGET_FIELDS.find(
                              (f) => f.value === m.targetField
                            )?.label || m.targetField}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {preview.preview.slice(0, 10).map((row, i) => (
                        <tr key={i} className="hover:bg-slate-800/30">
                          {mappings.map((m) => (
                            <td
                              key={m.targetField}
                              className="px-3 py-2 text-white truncate max-w-[200px]"
                            >
                              {row[m.sourceField] || "-"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <p className="text-red-300">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep("mapping")}
                  className="border-slate-700 text-slate-300"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={executeImport}
                  disabled={importing || preview.newCount === 0}
                  className={cn(
                    "flex-1 py-6 text-lg font-semibold",
                    "bg-gradient-to-r from-emerald-500 to-teal-500",
                    "hover:from-emerald-400 hover:to-teal-400"
                  )}
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      Import {preview.newCount} Sites
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Complete step */}
          {step === "complete" && (
            <motion.div
              key="complete"
              initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.95 }}
              animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1 }}
              className="text-center py-8"
            >
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/20 mb-6">
                <Check className="w-10 h-10 text-emerald-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">
                Import Complete!
              </h3>
              <p className="text-slate-400">
                Your sites have been imported successfully.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
