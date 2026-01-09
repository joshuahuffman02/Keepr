"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileSpreadsheet,
  FileText,
  Image,
  Loader2,
  Check,
  AlertCircle,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ClassificationResult {
  documentType: string;
  contentType: string;
  confidence: number;
  suggestedEntity: string | null;
  detectedColumns?: string[];
  sampleData?: Record<string, string>[];
  reasoning?: string;
}

interface UploadResult {
  documentId: string;
  fileName: string;
  documentType: string;
  classification: ClassificationResult;
  status: string;
}

interface AiImportUploaderProps {
  sessionId: string;
  token: string;
  onUploadComplete: (result: UploadResult) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
}

const FILE_ICONS: Record<string, typeof FileSpreadsheet> = {
  csv: FileSpreadsheet,
  excel: FileSpreadsheet,
  pdf: FileText,
  image: Image,
};

const ENTITY_LABELS: Record<string, string> = {
  sites: "Campground Sites",
  guests: "Guest Records",
  reservations: "Reservations",
  rates: "Rate Schedules",
  policies: "Policies",
};

export function AiImportUploader({
  sessionId,
  token,
  onUploadComplete,
  onError,
  disabled = false,
}: AiImportUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        await uploadFile(files[0]);
      }
    },
    [sessionId, token]
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        await uploadFile(files[0]);
      }
    },
    [sessionId, token]
  );

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setError(null);
    setUploadedFile(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("token", token);

      const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";
      const response = await fetch(
        `${apiBase}/onboarding/session/${sessionId}/ai-import/upload`,
        {
          method: "POST",
          headers: {
            "x-onboarding-token": token,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Upload failed");
      }

      const result: UploadResult = await response.json();
      setUploadedFile(result);
      onUploadComplete(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
      onError?.(message);
    } finally {
      setIsUploading(false);
    }
  };

  const clearUpload = () => {
    setUploadedFile(null);
    setError(null);
  };

  const FileIcon = uploadedFile
    ? FILE_ICONS[uploadedFile.documentType] || FileText
    : FileSpreadsheet;

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-600";
    if (confidence >= 0.5) return "text-yellow-600";
    return "text-red-600";
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return "High confidence";
    if (confidence >= 0.5) return "Medium confidence";
    return "Low confidence";
  };

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      {!uploadedFile && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "relative border-2 border-dashed rounded-xl p-8 transition-all duration-200",
            isDragging
              ? "border-primary bg-primary/5 scale-[1.02]"
              : "border-muted-foreground/25 hover:border-primary/50",
            disabled && "opacity-50 pointer-events-none"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={handleFileSelect}
            accept=".csv,.xlsx,.xls,.pdf,.png,.jpg,.jpeg,.gif,.webp"
            disabled={disabled || isUploading}
          />

          <div className="flex flex-col items-center justify-center text-center space-y-4">
            {isUploading ? (
              <>
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
                <div>
                  <p className="text-lg font-medium">Analyzing document...</p>
                  <p className="text-sm text-muted-foreground">
                    AI is classifying your file
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-medium">
                    Drop your file here or click to browse
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Supports CSV, Excel, PDF, and images
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span>AI will automatically detect and extract your data</span>
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}

      {/* Error State */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-destructive/10 border border-destructive/20 rounded-lg p-4"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-destructive">Upload failed</p>
                <p className="text-sm text-destructive/80">{error}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError(null)}
                className="shrink-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Uploaded File Card */}
      <AnimatePresence>
        {uploadedFile && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="border rounded-xl p-6 bg-card"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileIcon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{uploadedFile.fileName}</h3>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary uppercase">
                      {uploadedFile.documentType}
                    </span>
                  </div>

                  {uploadedFile.classification.suggestedEntity && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Detected:{" "}
                      <span className="font-medium text-foreground">
                        {ENTITY_LABELS[uploadedFile.classification.suggestedEntity] ||
                          uploadedFile.classification.suggestedEntity}
                      </span>
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-2">
                    <Check className="w-4 h-4 text-green-600" />
                    <span
                      className={cn(
                        "text-sm",
                        getConfidenceColor(uploadedFile.classification.confidence)
                      )}
                    >
                      {getConfidenceLabel(uploadedFile.classification.confidence)} (
                      {Math.round(uploadedFile.classification.confidence * 100)}%)
                    </span>
                  </div>

                  {uploadedFile.classification.detectedColumns && (
                    <div className="mt-3">
                      <p className="text-xs text-muted-foreground mb-1">
                        Detected columns:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {uploadedFile.classification.detectedColumns
                          .slice(0, 6)
                          .map((col) => (
                            <span
                              key={col}
                              className="px-2 py-0.5 text-xs rounded bg-muted"
                            >
                              {col}
                            </span>
                          ))}
                        {uploadedFile.classification.detectedColumns.length > 6 && (
                          <span className="px-2 py-0.5 text-xs rounded bg-muted">
                            +{uploadedFile.classification.detectedColumns.length - 6} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Button variant="ghost" size="sm" onClick={clearUpload}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
