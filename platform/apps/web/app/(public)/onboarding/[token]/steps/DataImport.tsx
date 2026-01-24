"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Upload,
  FileSpreadsheet,
  FileText,
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ClipboardList,
  Table,
  Loader2,
  X,
  Download,
  Info,
  Sparkles,
  MessageCircle,
  XCircle,
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
import { apiUrl } from "@/lib/api-config";
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

type FieldValue = string | number | boolean | null;

interface FieldConfidence {
  field: string;
  value: FieldValue;
  confidence: number;
  source: "extracted" | "inferred" | "default";
  alternatives?: { value: FieldValue; confidence: number }[];
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

type CoverageStatus = "complete" | "partial" | "missing";

interface CoverageGroupSummary {
  key: string;
  label: string;
  description: string;
  required: boolean;
  status: CoverageStatus;
  missingFields: string[];
  matchedFields: string[];
}

interface CoverageFormSummary {
  key: string;
  label: string;
  description: string;
  covers: string[];
  fileTypes: string[];
  status: CoverageStatus;
  missingCoverage: string[];
}

interface CoverageDocumentSummary {
  documentId: string;
  fileName: string | null;
  targetEntity: string;
  status: string;
  createdAt: string;
}

interface CoverageSystemOption {
  key: string;
  label: string;
}

interface CoverageSummary {
  system: CoverageSystemOption;
  systems: CoverageSystemOption[];
  coverage: CoverageGroupSummary[];
  forms: CoverageFormSummary[];
  requiredComplete: boolean;
  documents: CoverageDocumentSummary[];
}

export interface DataImportCompletion {
  sitesCreated: number;
  siteClassesCreated: number;
  importSystemKey: string;
  overrideAccepted: boolean;
  requiredComplete: boolean;
  missingRequired: Array<{ key: string; missingFields: string[] }>;
}

export interface DataImportDraft {
  importSystemKey: string;
  overrideAccepted: boolean;
  requiredComplete?: boolean;
  missingRequired?: Array<{ key: string; missingFields: string[] }>;
}

interface DataImportProps {
  sessionId: string;
  campgroundId: string;
  token: string;
  onComplete: (result: DataImportCompletion) => Promise<void> | void;
  onSkip: () => void;
  isLoading?: boolean;
  initialSystemKey?: string;
  initialOverrideAccepted?: boolean;
  initialImportTotals?: { sitesCreated: number; siteClassesCreated: number };
  onDraftChange?: (draft: DataImportDraft) => void;
}

type ImportStep = "upload" | "extraction" | "review" | "complete";
type ImportMode = "ai" | "manual";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (isRecord(error) && typeof error.message === "string") return error.message;
  return fallback;
};

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

const DEFAULT_SYSTEM_OPTIONS: CoverageSystemOption[] = [
  { key: "campspot", label: "Campspot" },
  { key: "newbook", label: "Newbook" },
  { key: "rms_cloud", label: "RMS Cloud" },
  { key: "campground_master", label: "Campground Master" },
  { key: "resnexus", label: "ResNexus" },
  { key: "other", label: "Other / Not Sure" },
];

const ENTITY_LABELS: Record<string, string> = {
  sites: "Sites",
  guests: "Guests",
  reservations: "Reservations",
  rates: "Rates",
  policies: "Policies",
};

const DOCUMENT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending_extraction: { label: "Uploaded", color: "text-slate-300" },
  extraction_complete: { label: "Ready for review", color: "text-amber-300" },
  imported: { label: "Imported", color: "text-emerald-300" },
  failed: { label: "Failed", color: "text-red-300" },
};

export function DataImport({
  sessionId,
  campgroundId,
  token,
  onComplete,
  onSkip,
  isLoading = false,
  initialSystemKey,
  initialOverrideAccepted = false,
  initialImportTotals,
  onDraftChange,
}: DataImportProps) {
  const prefersReducedMotion = useReducedMotion();

  // AI Import state
  const [aiAccessLevel, setAiAccessLevel] = useState<AiAccessLevel | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [corrections, setCorrections] = useState<Record<string, Record<string, FieldValue>>>({});
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [coverageSummary, setCoverageSummary] = useState<CoverageSummary | null>(null);
  const [coverageLoading, setCoverageLoading] = useState(false);
  const [coverageError, setCoverageError] = useState<string | null>(null);
  const [systemKey, setSystemKey] = useState<string>(
    initialSystemKey ?? DEFAULT_SYSTEM_OPTIONS[0]?.key ?? "campspot",
  );
  const [overrideAccepted, setOverrideAccepted] = useState(initialOverrideAccepted);
  const [importTotals, setImportTotals] = useState(() => ({
    sitesCreated: initialImportTotals?.sitesCreated ?? 0,
    siteClassesCreated: initialImportTotals?.siteClassesCreated ?? 0,
  }));
  const [uploaderResetKey, setUploaderResetKey] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const draftSignatureRef = useRef<string | null>(null);
  const draftSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const getCoverageIcon = (status: CoverageStatus) => {
    if (status === "complete") {
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    }
    if (status === "partial") {
      return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    }
    return <XCircle className="w-4 h-4 text-red-400" />;
  };

  const getCoverageLabel = (status: CoverageStatus) => {
    if (status === "complete") return "Complete";
    if (status === "partial") return "Partial";
    return "Missing";
  };

  const getCoverageTextColor = (status: CoverageStatus) => {
    if (status === "complete") return "text-emerald-300";
    if (status === "partial") return "text-amber-300";
    return "text-red-300";
  };

  const getCoverageRank = (status: CoverageStatus) => {
    if (status === "missing") return 0;
    if (status === "partial") return 1;
    return 2;
  };

  // Fetch AI access level on mount
  useEffect(() => {
    const fetchAccessLevel = async () => {
      try {
        const response = await fetch(
          apiUrl(`/onboarding/session/${sessionId}/ai-gate/status?token=${token}`),
          {
            headers: { "x-onboarding-token": token },
          },
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

  const refreshCoverage = useCallback(
    async (systemOverride?: string) => {
      if (!sessionId || !token) return;
      const selected = systemOverride ?? systemKey;
      setCoverageLoading(true);
      setCoverageError(null);
      try {
        const response = await fetch(
          apiUrl(
            `/onboarding/session/${sessionId}/ai-import/coverage?system=${encodeURIComponent(selected)}`,
          ),
          {
            headers: { "x-onboarding-token": token },
          },
        );
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.message || "Failed to load import checklist");
        }
        const data: CoverageSummary = await response.json();
        setCoverageSummary(data);
      } catch (err) {
        setCoverageError(getErrorMessage(err, "Failed to load import checklist"));
      } finally {
        setCoverageLoading(false);
      }
    },
    [sessionId, token, systemKey],
  );

  const saveDraft = useCallback(
    async (nextDraft: DataImportDraft, signature?: string) => {
      if (!sessionId || !token) return;
      try {
        const response = await fetch(apiUrl(`/onboarding/session/${sessionId}/data-import/draft`), {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-onboarding-token": token,
          },
          body: JSON.stringify({
            token,
            payload: {
              importSystemKey: nextDraft.importSystemKey,
              overrideAccepted: nextDraft.overrideAccepted,
              requiredComplete: nextDraft.requiredComplete,
              missingRequired: nextDraft.missingRequired,
            },
          }),
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.message || "Failed to save draft");
        }
        draftSignatureRef.current = signature ?? JSON.stringify(nextDraft);
      } catch (err) {
        console.warn("Failed to save data import draft:", err);
      }
    },
    [sessionId, token],
  );

  useEffect(() => {
    if (mode !== "ai") return;
    void refreshCoverage();
  }, [mode, systemKey, refreshCoverage]);

  const overrideResetRef = useRef(false);

  useEffect(() => {
    if (!overrideResetRef.current) {
      overrideResetRef.current = true;
      return;
    }
    setOverrideAccepted(false);
  }, [systemKey]);

  // Handle AI upload complete
  const handleAiUploadComplete = async (result: UploadResult) => {
    setUploadResult(result);
    setError(null);
    await refreshCoverage();

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
      const response = await fetch(apiUrl(`/onboarding/session/${sessionId}/ai-import/extract`), {
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
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Extraction failed");
      }

      const result = await response.json();
      setExtractionResult(result);
      setStep("review");
      await refreshCoverage();
    } catch (error) {
      setError(getErrorMessage(error, "Failed to extract data"));
    } finally {
      setImporting(false);
    }
  };

  // Handle correction
  const handleCorrection = (rowNumber: number, field: string, value: FieldValue) => {
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
      const response = await fetch(apiUrl(`/onboarding/session/${sessionId}/ai-import/confirm`), {
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
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Import failed");
      }

      const result = await response.json();
      const createdCount = typeof result.created === "number" ? result.created : 0;
      setImportTotals((prev) => ({
        sitesCreated: prev.sitesCreated + createdCount,
        siteClassesCreated: prev.siteClassesCreated,
      }));
      setStep("upload");
      setUploadResult(null);
      setExtractionResult(null);
      setCorrections({});
      setUploaderResetKey((prev) => prev + 1);
      await refreshCoverage();
    } catch (error) {
      setError(getErrorMessage(error, "Failed to import data"));
    } finally {
      setImporting(false);
    }
  };

  const handleContinue = async () => {
    setIsCompleting(true);
    setError(null);
    try {
      await onComplete({
        sitesCreated: importTotals.sitesCreated,
        siteClassesCreated: importTotals.siteClassesCreated,
        importSystemKey: systemKey,
        overrideAccepted,
        requiredComplete: requiredCompleteForSave,
        missingRequired: missingRequiredGroups.map((group) => ({
          key: group.key,
          missingFields: group.missingFields,
        })),
      });
    } catch (error) {
      setError(getErrorMessage(error, "Failed to continue"));
    } finally {
      setIsCompleting(false);
    }
  };

  // === Manual CSV Import Functions (Fallback) ===

  const parseCSVHeaders = (content: string): string[] => {
    const lines = content.trim().split("\n");
    if (lines.length === 0) return [];
    const headerLine = lines[0];
    return headerLine.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  };

  const handleManualFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content !== "string") return;
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
  }, []);

  const updateMapping = (sourceField: string, targetField: string) => {
    setMappings((prev) => {
      const existing = prev.find((m) => m.sourceField === sourceField);
      if (existing) {
        if (targetField === "") {
          return prev.filter((m) => m.sourceField !== sourceField);
        }
        return prev.map((m) => (m.sourceField === sourceField ? { ...m, targetField } : m));
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
      const response = await fetch(apiUrl(`/campgrounds/${campgroundId}/import/preview`), {
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
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Preview failed");
      }

      const result = await response.json();
      setPreview(result);
    } catch (error) {
      setError(getErrorMessage(error, "Failed to preview import"));
    } finally {
      setImporting(false);
    }
  };

  const executeManualImport = async () => {
    setImporting(true);
    setError(null);

    try {
      const response = await fetch(apiUrl(`/campgrounds/${campgroundId}/import/execute`), {
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
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Import failed");
      }

      const result = await response.json();
      await onComplete({
        sitesCreated: result.createdCount || 0,
        siteClassesCreated: result.siteClassesCreated || 0,
        importSystemKey: systemKey,
        overrideAccepted,
        requiredComplete: requiredCompleteForSave,
        missingRequired: missingRequiredGroups.map((group) => ({
          key: group.key,
          missingFields: group.missingFields,
        })),
      });
      setStep("complete");
    } catch (error) {
      setError(getErrorMessage(error, "Failed to execute import"));
    } finally {
      setImporting(false);
    }
  };

  const requiredFieldsMapped = SITE_TARGET_FIELDS.filter((f) => f.required).every((field) =>
    mappings.some((m) => m.targetField === field.value),
  );

  // Determine if AI mode is available
  const aiAvailable = aiAccessLevel && aiAccessLevel.canMakeAiCall;
  const missingRequiredGroups = coverageSummary
    ? coverageSummary.coverage.filter((group) => group.required && group.status !== "complete")
    : [];
  const canContinue = coverageSummary?.requiredComplete ?? false;
  const requiredCompleteForSave = mode === "ai" ? canContinue : true;
  const requiredCompleteForDraft = coverageSummary ? coverageSummary.requiredComplete : undefined;
  const missingRequiredForDraft = coverageSummary
    ? missingRequiredGroups.map((group) => ({
        key: group.key,
        missingFields: group.missingFields,
      }))
    : undefined;
  const draftPayload: DataImportDraft = {
    importSystemKey: systemKey,
    overrideAccepted,
    requiredComplete: requiredCompleteForDraft,
    missingRequired: missingRequiredForDraft,
  };
  const draftSignature = JSON.stringify(draftPayload);
  const coverageLabelByKey = coverageSummary
    ? coverageSummary.coverage.reduce<Record<string, string>>((acc, group) => {
        acc[group.key] = group.label;
        return acc;
      }, {})
    : null;
  const sortedForms = coverageSummary
    ? [...coverageSummary.forms].sort(
        (a, b) => getCoverageRank(a.status) - getCoverageRank(b.status),
      )
    : [];
  const missingRequiredKeys = new Set(missingRequiredGroups.map((group) => group.key));
  const nextForms = coverageSummary
    ? sortedForms.filter(
        (form) =>
          form.status !== "complete" && form.covers.some((key) => missingRequiredKeys.has(key)),
      )
    : [];

  useEffect(() => {
    if (mode !== "ai") return;
    onDraftChange?.(draftPayload);
  }, [mode, draftSignature, onDraftChange]);

  useEffect(() => {
    if (mode !== "ai" || !sessionId || !token) return;
    if (draftSignatureRef.current === draftSignature) {
      return;
    }
    if (draftSaveTimeoutRef.current) {
      clearTimeout(draftSaveTimeoutRef.current);
    }
    draftSaveTimeoutRef.current = setTimeout(() => {
      void saveDraft(draftPayload, draftSignature);
    }, 400);
    return () => {
      if (draftSaveTimeoutRef.current) {
        clearTimeout(draftSaveTimeoutRef.current);
      }
    };
  }, [mode, sessionId, token, draftSignature, saveDraft]);

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
              ? "Upload exports from your current system and we will track what is still needed"
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
                  mode === "ai" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white",
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
                    : "text-slate-400 hover:text-white",
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
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-white">
                          <ClipboardList className="w-5 h-5 text-emerald-400" />
                          <h3 className="text-lg font-semibold">Import checklist</h3>
                        </div>
                        <p className="text-sm text-slate-400">
                          Tell us your current system and we will show the exports to grab.
                        </p>
                      </div>
                      <div className="w-full md:w-64">
                        <Label className="text-xs text-slate-400">Current system</Label>
                        <Select value={systemKey} onValueChange={(value) => setSystemKey(value)}>
                          <SelectTrigger className="bg-slate-900/70 border-slate-700 text-white">
                            <SelectValue placeholder="Select system" />
                          </SelectTrigger>
                          <SelectContent>
                            {(coverageSummary?.systems || DEFAULT_SYSTEM_OPTIONS).map((option) => (
                              <SelectItem key={option.key} value={option.key}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {coverageLoading && (
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading checklist...
                      </div>
                    )}

                    {coverageError && (
                      <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
                        {coverageError}
                      </div>
                    )}

                    {coverageSummary && (
                      <>
                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className="space-y-3">
                            <p className="text-xs uppercase tracking-wide text-slate-500">
                              Required coverage
                            </p>
                            <div className="space-y-3">
                              {coverageSummary.coverage.map((group) => (
                                <div
                                  key={group.key}
                                  className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3"
                                >
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-white">
                                      {getCoverageIcon(group.status)}
                                      <span className="font-medium">{group.label}</span>
                                    </div>
                                    <p className="text-xs text-slate-500">{group.description}</p>
                                    {group.status !== "complete" &&
                                      group.missingFields.length > 0 && (
                                        <p className="text-xs text-amber-300">
                                          Missing: {group.missingFields.join(", ")}
                                        </p>
                                      )}
                                  </div>
                                  <span
                                    className={cn(
                                      "text-xs font-semibold uppercase",
                                      getCoverageTextColor(group.status),
                                    )}
                                  >
                                    {getCoverageLabel(group.status)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-3">
                            <p className="text-xs uppercase tracking-wide text-slate-500">
                              Recommended forms
                            </p>
                            <div className="space-y-3">
                              {sortedForms.map((form) => {
                                const missingCoverageLabels = coverageLabelByKey
                                  ? form.missingCoverage.map(
                                      (key) => coverageLabelByKey[key] ?? key,
                                    )
                                  : form.missingCoverage;
                                return (
                                  <div
                                    key={form.key}
                                    className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3"
                                  >
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2 text-white">
                                        <FileText className="w-4 h-4 text-slate-400" />
                                        <span className="font-medium">{form.label}</span>
                                      </div>
                                      <p className="text-xs text-slate-500">{form.description}</p>
                                      {form.status !== "complete" &&
                                        missingCoverageLabels.length > 0 && (
                                          <p className="text-xs text-amber-300">
                                            Still needed for: {missingCoverageLabels.join(", ")}
                                          </p>
                                        )}
                                      <p className="text-xs text-slate-600">
                                        Files: {form.fileTypes.join(", ").toUpperCase()}
                                      </p>
                                    </div>
                                    <span
                                      className={cn(
                                        "text-xs font-semibold uppercase",
                                        getCoverageTextColor(form.status),
                                      )}
                                    >
                                      {getCoverageLabel(form.status)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {nextForms.length > 0 && (
                          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-amber-200">
                              <AlertTriangle className="w-4 h-4" />
                              Next exports to grab
                            </div>
                            <ul className="mt-2 space-y-1 text-xs text-amber-100">
                              {nextForms.map((form) => (
                                <li
                                  key={form.key}
                                  className="flex items-start justify-between gap-2"
                                >
                                  <span className="font-medium">{form.label}</span>
                                  <span className="text-amber-200/70">
                                    {form.fileTypes.join(", ").toUpperCase()}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="space-y-3">
                          <p className="text-xs uppercase tracking-wide text-slate-500">
                            Uploaded documents
                          </p>
                          <div className="rounded-lg border border-slate-800 bg-slate-950/60">
                            {coverageSummary.documents.length === 0 ? (
                              <div className="px-4 py-3 text-xs text-slate-500">
                                No documents uploaded yet.
                              </div>
                            ) : (
                              <div className="divide-y divide-slate-800 max-h-48 overflow-y-auto">
                                {coverageSummary.documents.map((doc) => {
                                  const statusInfo = DOCUMENT_STATUS_LABELS[doc.status] || {
                                    label: doc.status.replace(/_/g, " "),
                                    color: "text-slate-400",
                                  };
                                  const entityLabel =
                                    ENTITY_LABELS[doc.targetEntity] || doc.targetEntity;
                                  const uploadedAt = doc.createdAt
                                    ? new Date(doc.createdAt).toLocaleString()
                                    : "Unknown time";
                                  return (
                                    <div
                                      key={doc.documentId}
                                      className="flex items-start justify-between gap-3 px-4 py-3 text-xs"
                                    >
                                      <div className="space-y-1">
                                        <p className="text-slate-200 font-medium">
                                          {doc.fileName || "Uploaded file"}
                                        </p>
                                        <p className="text-slate-500">
                                          {entityLabel} · {uploadedAt}
                                        </p>
                                      </div>
                                      <span className={cn("uppercase", statusInfo.color)}>
                                        {statusInfo.label}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    {coverageSummary && (
                      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                        <div className="flex items-start gap-3">
                          <ClipboardList className="w-5 h-5 text-emerald-400 mt-0.5" />
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-white">Ready to continue?</p>
                            <p className="text-xs text-slate-400">
                              {canContinue
                                ? "Required forms are covered. You can continue or import more."
                                : "Some required exports are still missing. You can continue with a warning."}
                            </p>
                            {importTotals.sitesCreated > 0 && (
                              <p className="text-xs text-slate-500">
                                Imported so far: {importTotals.sitesCreated} rows
                              </p>
                            )}
                          </div>
                        </div>

                        {!canContinue && missingRequiredGroups.length > 0 && (
                          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200 space-y-2">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4" />
                              <span className="font-semibold">Missing required data</span>
                            </div>
                            <ul className="space-y-1">
                              {missingRequiredGroups.map((group) => (
                                <li key={group.key}>
                                  {group.label}:{" "}
                                  {group.missingFields.join(", ") || "Missing export"}
                                </li>
                              ))}
                            </ul>
                            <label className="flex items-start gap-2 text-xs text-amber-200">
                              <input
                                type="checkbox"
                                checked={overrideAccepted}
                                onChange={(event) => setOverrideAccepted(event.target.checked)}
                                className="mt-0.5 h-4 w-4 rounded border-amber-300 bg-transparent"
                              />
                              <span>
                                I understand the missing data may affect accounting checks and
                                reservation accuracy.
                              </span>
                            </label>
                          </div>
                        )}

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <span className="text-xs text-slate-500">
                            You can upload multiple exports before moving on.
                          </span>
                          <Button
                            onClick={handleContinue}
                            disabled={(!canContinue && !overrideAccepted) || isCompleting}
                            className={cn(
                              "sm:min-w-[200px]",
                              !canContinue && "bg-amber-600 hover:bg-amber-500",
                            )}
                          >
                            {isCompleting ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Saving...
                              </>
                            ) : canContinue ? (
                              "Continue"
                            ) : (
                              "Continue Anyway"
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  <AiImportUploader
                    sessionId={sessionId}
                    token={token}
                    onUploadComplete={handleAiUploadComplete}
                    onError={(err) => setError(err)}
                    disabled={!aiAvailable}
                    resetKey={uploaderResetKey}
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
                  <h3 className="text-lg font-medium text-white mb-2">Extracting Data...</h3>
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
                      <p className="text-slate-300 mb-2">Drag and drop your CSV file here</p>
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
                              const mapping = mappings.find((m) => m.sourceField === field);
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
                                          disabled={mappings.some(
                                            (m) =>
                                              m.targetField === target.value &&
                                              m.sourceField !== field,
                                          )}
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
                                  : "bg-slate-800/30 border-slate-700",
                              )}
                            >
                              <p
                                className={cn(
                                  "text-2xl font-bold",
                                  preview.errorCount > 0 ? "text-red-400" : "text-slate-500",
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
              <h3 className="text-2xl font-bold text-white mb-2">Import Complete!</h3>
              <p className="text-slate-400">Your sites have been imported successfully.</p>
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
