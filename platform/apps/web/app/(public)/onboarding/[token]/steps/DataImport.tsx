"use client";

import { useState, useCallback, useEffect } from "react";
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
  Info,
  Sparkles,
  MessageCircle,
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
import {
  AiImportUploader,
  AiExtractionPreview,
  AiImportChat,
  AiAccessGate,
} from "../components/ai-import";

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

interface AiAccessLevel {
  tier: "none" | "trial" | "full" | "blocked";
  aiCallsUsed: number;
  aiCallsRemaining: number | null;
  reason?: string;
  canMakeAiCall: boolean;
  emailVerified: boolean;
  progressPercent: number;
}

interface FieldConfidence {
  field: string;
  value: string | number | boolean | null;
  confidence: number;
  source: "extracted" | "inferred" | "default";
  alternatives?: { value: any; confidence: number }[];
  requiresReview: boolean;
}

interface RowConfidence {
  rowNumber: number;
  fields: Record<string, FieldConfidence>;
  overallConfidence: number;
  issues: string[];
  action: "create" | "update" | "skip";
}

interface ExtractionResult {
  documentId: string;
  status: string;
  rows: RowConfidence[];
  summary: {
    totalRows: number;
    validRows: number;
    createCount: number;
    updateCount: number;
    skipCount: number;
    missingRequired: string[];
    warnings: string[];
  };
}

interface UploadResult {
  documentId: string;
  fileName: string;
  documentType: string;
  classification: {
    documentType: string;
    contentType: string;
    confidence: number;
    suggestedEntity: string | null;
    detectedColumns?: string[];
    sampleData?: Record<string, string>[];
    reasoning?: string;
  };
  status: string;
}

interface DataImportProps {
  sessionId: string;
  campgroundId: string;
  token: string;
  onComplete: (result: { sitesCreated: number; siteClassesCreated: number }) => void;
  onSkip: () => void;
  isLoading?: boolean;
}

type ImportStep = "upload" | "extraction" | "review" | "complete";
type ImportMode = "ai" | "manual";

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
  sessionId,
  campgroundId,
  token,
  onComplete,
  onSkip,
  isLoading = false,
}: DataImportProps) {
  const prefersReducedMotion = useReducedMotion();

  // AI Import state
  const [aiAccessLevel, setAiAccessLevel] = useState<AiAccessLevel | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [corrections, setCorrections] = useState<Record<string, Record<string, any>>>({});
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Import flow state
  const [step, setStep] = useState<ImportStep>("upload");
  const [mode, setMode] = useState<ImportMode>("ai");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manual CSV import state (fallback)
  const [csvContent, setCsvContent] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [sourceFields, setSourceFields] = useState<string[]>([]);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  // Fetch AI access level on mount
  useEffect(() => {
    const fetchAccessLevel = async () => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";
        const response = await fetch(
          `${apiBase}/onboarding/session/${sessionId}/ai-gate/status?token=${token}`,
          {
            headers: { "x-onboarding-token": token },
          }
        );
        if (response.ok) {
          const data = await response.json();
          setAiAccessLevel(data);
        }
      } catch (err) {
        console.error("Failed to fetch AI access level:", err);
      }
    };
    fetchAccessLevel();
  }, [sessionId, token]);

  // Handle AI upload complete
  const handleAiUploadComplete = async (result: UploadResult) => {
    setUploadResult(result);
    setError(null);

    // Auto-extract if AI access is available
    if (aiAccessLevel?.canMakeAiCall) {
      setStep("extraction");
      await runExtraction(result.documentId);
    }
  };

  // Run AI extraction
  const runExtraction = async (documentId: string) => {
    setImporting(true);
    setError(null);

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";
      const response = await fetch(
        `${apiBase}/onboarding/session/${sessionId}/ai-import/extract`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-onboarding-token": token,
          },
          body: JSON.stringify({
            token,
            documentId,
            targetEntity: uploadResult?.classification.suggestedEntity || "sites",
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Extraction failed");
      }

      const result = await response.json();
      setExtractionResult(result);
      setStep("review");
    } catch (err: any) {
      setError(err.message || "Failed to extract data");
    } finally {
      setImporting(false);
    }
  };

  // Handle correction
  const handleCorrection = (rowNumber: number, field: string, value: any) => {
    setCorrections((prev) => ({
      ...prev,
      [rowNumber]: {
        ...prev[rowNumber],
        [field]: value,
      },
    }));
  };

  // Confirm AI import
  const confirmAiImport = async () => {
    if (!uploadResult) return;

    setImporting(true);
    setError(null);

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";
      const response = await fetch(
        `${apiBase}/onboarding/session/${sessionId}/ai-import/confirm`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-onboarding-token": token,
          },
          body: JSON.stringify({
            token,
            documentId: uploadResult.documentId,
            corrections: Object.entries(corrections).map(([rowNum, fields]) => ({
              rowNumber: parseInt(rowNum),
              ...fields,
            })),
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
      setError(err.message || "Failed to import data");
    } finally {
      setImporting(false);
    }
  };

  // === Manual CSV Import Functions (Fallback) ===

  const parseCSVHeaders = (content: string): string[] => {
    const lines = content.trim().split("\n");
    if (lines.length === 0) return [];
    const headerLine = lines[0];
    return headerLine.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  };

  const handleManualFileUpload = useCallback(
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
            autoMappings.push({ sourceField: header, targetField: match.value });
          }
        });
        setMappings(autoMappings);
      };
      reader.readAsText(file);
    },
    []
  );

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

  const runManualPreview = async () => {
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
    } catch (err: any) {
      setError(err.message || "Failed to preview import");
    } finally {
      setImporting(false);
    }
  };

  const executeManualImport = async () => {
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

  const requiredFieldsMapped = SITE_TARGET_FIELDS.filter((f) => f.required).every(
    (field) => mappings.some((m) => m.targetField === field.value)
  );

  // Determine if AI mode is available
  const aiAvailable = aiAccessLevel && aiAccessLevel.canMakeAiCall;

  return (
    <div className="max-w-4xl">
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
            {mode === "ai" ? (
              <Sparkles className="w-8 h-8 text-blue-400" />
            ) : (
              <FileSpreadsheet className="w-8 h-8 text-blue-400" />
            )}
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            {mode === "ai" ? "AI-Assisted Import" : "Import Your Sites"}
          </h2>
          <p className="text-slate-400">
            {mode === "ai"
              ? "Upload any document and AI will extract your site data"
              : "Upload a CSV file with your existing site inventory"}
          </p>
        </motion.div>

        {/* Mode Toggle */}
        {step === "upload" && (
          <div className="flex justify-center">
            <div className="inline-flex rounded-lg bg-slate-800/50 p-1">
              <button
                onClick={() => setMode("ai")}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-all",
                  mode === "ai"
                    ? "bg-emerald-600 text-white"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <Sparkles className="w-4 h-4 inline mr-2" />
                AI Import
              </button>
              <button
                onClick={() => setMode("manual")}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-all",
                  mode === "manual"
                    ? "bg-emerald-600 text-white"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <FileSpreadsheet className="w-4 h-4 inline mr-2" />
                Manual CSV
              </button>
            </div>
          </div>
        )}

        {/* AI Access Gate */}
        {mode === "ai" && step === "upload" && (
          <AiAccessGate
            sessionId={sessionId}
            token={token}
            accessLevel={aiAccessLevel}
            onAccessChange={setAiAccessLevel}
          />
        )}

        {/* Step content */}
        <AnimatePresence mode="wait">
          {/* AI Import Flow */}
          {mode === "ai" && (
            <>
              {/* Upload step */}
              {step === "upload" && (
                <motion.div
                  key="ai-upload"
                  initial={prefersReducedMotion ? {} : { opacity: 0, x: 20 }}
                  animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
                  exit={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <AiImportUploader
                    sessionId={sessionId}
                    token={token}
                    onUploadComplete={handleAiUploadComplete}
                    onError={(err) => setError(err)}
                    disabled={!aiAvailable}
                  />

                  {uploadResult && !aiAvailable && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                      <p className="text-amber-300 text-sm">
                        <AlertCircle className="w-4 h-4 inline mr-2" />
                        Verify your email to unlock AI extraction
                      </p>
                    </div>
                  )}

                  {uploadResult && aiAvailable && (
                    <div className="flex justify-end">
                      <Button
                        onClick={() => runExtraction(uploadResult.documentId)}
                        disabled={importing}
                        className="bg-emerald-600 hover:bg-emerald-500"
                      >
                        {importing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Extracting...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Extract Data
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                      <p className="text-red-300 text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={onSkip}
                    className="w-full text-center text-sm text-slate-500 hover:text-slate-400 transition-colors"
                  >
                    Skip import and build sites manually
                  </button>
                </motion.div>
              )}

              {/* Extraction / Loading step */}
              {step === "extraction" && (
                <motion.div
                  key="ai-extraction"
                  initial={prefersReducedMotion ? {} : { opacity: 0 }}
                  animate={prefersReducedMotion ? {} : { opacity: 1 }}
                  exit={prefersReducedMotion ? {} : { opacity: 0 }}
                  className="text-center py-12"
                >
                  <Loader2 className="w-12 h-12 text-emerald-400 mx-auto mb-4 animate-spin" />
                  <h3 className="text-lg font-medium text-white mb-2">
                    Extracting Data...
                  </h3>
                  <p className="text-slate-400">
                    AI is analyzing your document and extracting site information
                  </p>
                </motion.div>
              )}

              {/* Review step */}
              {step === "review" && extractionResult && (
                <motion.div
                  key="ai-review"
                  initial={prefersReducedMotion ? {} : { opacity: 0, x: 20 }}
                  animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
                  exit={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-white">Review Extracted Data</h3>
                      <p className="text-sm text-slate-400">
                        Click any cell to edit. Yellow cells need review.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setIsChatOpen(!isChatOpen)}
                      className="border-slate-700"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Ask AI
                    </Button>
                  </div>

                  <AiExtractionPreview
                    documentId={uploadResult?.documentId || ""}
                    rows={extractionResult.rows}
                    summary={extractionResult.summary}
                    targetEntity={uploadResult?.classification.suggestedEntity || "sites"}
                    onCorrection={handleCorrection}
                    onConfirm={confirmAiImport}
                    onCancel={() => {
                      setStep("upload");
                      setUploadResult(null);
                      setExtractionResult(null);
                    }}
                    isConfirming={importing}
                  />

                  {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                      <p className="text-red-300 text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </>
          )}

          {/* Manual CSV Import Flow */}
          {mode === "manual" && (
            <>
              {/* Upload step */}
              {step === "upload" && (
                <motion.div
                  key="manual-upload"
                  initial={prefersReducedMotion ? {} : { opacity: 0, x: 20 }}
                  animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
                  exit={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  {!csvContent ? (
                    <div className="border-2 border-dashed border-slate-700 rounded-xl p-12 text-center hover:border-slate-600 transition-colors">
                      <Upload className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                      <p className="text-slate-300 mb-2">
                        Drag and drop your CSV file here
                      </p>
                      <p className="text-slate-500 text-sm mb-4">or</p>
                      <label className="inline-block">
                        <input
                          type="file"
                          accept=".csv"
                          onChange={handleManualFileUpload}
                          className="hidden"
                        />
                        <span className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-medium cursor-pointer hover:bg-slate-700 transition-colors">
                          Browse Files
                        </span>
                      </label>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* File info */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-white">{fileName}</h3>
                          <p className="text-sm text-slate-500">
                            {sourceFields.length} columns detected
                          </p>
                        </div>
                        <button
                          onClick={() => {
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

                      {/* Mapping */}
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

                      {/* Preview */}
                      {preview && (
                        <div className="space-y-4">
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
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-3">
                        {!preview ? (
                          <Button
                            onClick={runManualPreview}
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
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              onClick={() => setPreview(null)}
                              className="border-slate-700"
                            >
                              <ArrowLeft className="w-4 h-4 mr-2" />
                              Back
                            </Button>
                            <Button
                              onClick={executeManualImport}
                              disabled={importing || preview.newCount === 0}
                              className="flex-1 bg-emerald-600 hover:bg-emerald-500"
                            >
                              {importing ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Importing...
                                </>
                              ) : (
                                <>
                                  Import {preview.newCount} Sites
                                  <ArrowRight className="w-4 h-4 ml-2" />
                                </>
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-slate-400 flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-slate-300 font-medium">CSV Format Tips</p>
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
                          <li>Site types: rv, tent, cabin, yurt, glamping</li>
                          <li>Hookups can be yes/no, true/false, or 1/0</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                      <p className="text-red-300 text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={onSkip}
                    className="w-full text-center text-sm text-slate-500 hover:text-slate-400 transition-colors"
                  >
                    Skip import and build sites manually
                  </button>
                </motion.div>
              )}
            </>
          )}

          {/* Complete step (shared) */}
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

      {/* AI Chat Panel */}
      {mode === "ai" && (step === "review" || step === "extraction") && (
        <AiImportChat
          sessionId={sessionId}
          token={token}
          documentId={uploadResult?.documentId}
          isOpen={isChatOpen}
          onToggle={() => setIsChatOpen(!isChatOpen)}
        />
      )}
    </div>
  );
}
