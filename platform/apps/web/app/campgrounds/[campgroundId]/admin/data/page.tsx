"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiClient } from "@/lib/api-client";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { NewbookImport } from "@/components/settings/NewbookImport";
import { cn } from "@/lib/utils";
import {
    Database,
    Upload,
    Download,
    FileSpreadsheet,
    FileJson,
    AlertCircle,
    CheckCircle2,
    Loader2,
    FileText,
    Sparkles,
    XCircle,
    HelpCircle,
    Clock
} from "lucide-react";

const SPRING_CONFIG = {
    type: "spring" as const,
    stiffness: 200,
    damping: 20,
};

export default function DataOperationsPage() {
    const params = useParams();
    const campgroundId = params?.campgroundId as string;
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Import state
    const [importFormat, setImportFormat] = useState<"csv" | "json">("csv");
    const [dryRun, setDryRun] = useState(true);
    const [importing, setImporting] = useState(false);
    const [importMessage, setImportMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
    const [importSchemaLoading, setImportSchemaLoading] = useState(false);

    // Export state
    const [exportFormat, setExportFormat] = useState<"csv" | "json">("csv");
    const [includePii, setIncludePii] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [exportMessage, setExportMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

    // Fetch campground for breadcrumb
    const campgroundQuery = useQuery({
        queryKey: ["campground", campgroundId],
        queryFn: () => apiClient.getCampground(campgroundId),
        enabled: !!campgroundId
    });

    const cg = campgroundQuery.data;

    const downloadBlob = (content: string, filename: string, type: string) => {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImportFile = async (file: File) => {
        if (!campgroundId) return;
        setImporting(true);
        setImportMessage(null);
        try {
            const raw = await file.text();
            let payload: any = raw;
            if (importFormat === "json") {
                try {
                    payload = JSON.parse(raw);
                } catch {
                    setImportMessage({ type: "error", text: "Invalid JSON file. Please check the format and try again." });
                    setImporting(false);
                    return;
                }
            }
            const res = await apiClient.importReservations(campgroundId, {
                format: importFormat,
                payload,
                dryRun,
                filename: file.name
            });
            if (dryRun) {
                const valid = res.validCount ?? 0;
                const errors = res.errorCount ?? 0;
                if (errors === 0) {
                    setImportMessage({
                        type: "success",
                        text: `Validation passed! ${valid} reservations ready to import. Turn off "Validate only" to import.`
                    });
                } else {
                    setImportMessage({
                        type: "error",
                        text: `Found ${errors} errors in ${valid + errors} rows. Fix errors and try again.`
                    });
                }
            } else if (res.jobId) {
                setImportMessage({
                    type: "success",
                    text: `Import started! Job ID: ${res.jobId}. We'll process your data in the background.`
                });
            } else {
                setImportMessage({ type: "success", text: "Import completed successfully!" });
            }
        } catch (err: any) {
            setImportMessage({ type: "error", text: err?.message || "Import failed. Please try again." });
        } finally {
            setImporting(false);
        }
    };

    const handleDownloadTemplate = async () => {
        if (!campgroundId) return;
        setImportSchemaLoading(true);
        setImportMessage(null);
        try {
            const schema = await apiClient.getReservationImportSchema(campgroundId);
            const headers: string[] = schema?.csvColumns ?? [
                "campgroundId", "siteId", "guestId", "arrivalDate", "departureDate",
                "adults", "totalAmount"
            ];
            const sampleRow: Record<string, string | number> = {
                campgroundId,
                siteId: "SITE-123",
                guestId: "GUEST-123",
                arrivalDate: "2025-01-10",
                departureDate: "2025-01-12",
                adults: 2,
                totalAmount: 10000,
                children: 0,
                status: "confirmed",
                paidAmount: 0,
                source: "import"
            };
            const line = headers.join(",");
            const sample = headers.map((h) => (sampleRow as any)[h] ?? "").join(",");
            const csv = `${line}\n${sample}\n`;
            downloadBlob(csv, "reservation-import-template.csv", "text/csv");
            setImportMessage({ type: "success", text: "Template downloaded! Fill it out and import above." });
        } catch (err: any) {
            setImportMessage({ type: "error", text: err?.message || "Failed to download template" });
        } finally {
            setImportSchemaLoading(false);
        }
    };

    const handleExportQuick = async () => {
        if (!campgroundId) return;
        setExporting(true);
        setExportMessage(null);
        try {
            const res = await apiClient.exportReservationsPage(campgroundId, {
                format: exportFormat,
                includePII: includePii
            });
            if (exportFormat === "csv" && res.csv) {
                downloadBlob(res.csv, `reservations-${campgroundId}.csv`, "text/csv");
            } else {
                downloadBlob(JSON.stringify(res, null, 2), `reservations-${campgroundId}.json`, "application/json");
            }
            setExportMessage({
                type: "success",
                text: res.nextToken
                    ? "Downloaded first page. More data available - use export job for complete data."
                    : "Export downloaded successfully!"
            });
        } catch (err: any) {
            setExportMessage({ type: "error", text: err?.message || "Export failed" });
        } finally {
            setExporting(false);
        }
    };

    const handleQueueExportJob = async () => {
        if (!campgroundId) return;
        setExporting(true);
        setExportMessage(null);
        try {
            const job = await apiClient.queueReservationExportJob(campgroundId, { format: exportFormat });
            setExportMessage({
                type: "success",
                text: `Export job started! You'll receive an email when it's ready.`
            });
        } catch (err: any) {
            setExportMessage({ type: "error", text: err?.message || "Failed to queue export job" });
        } finally {
            setExporting(false);
        }
    };

    const MessageBanner = ({ message, onDismiss }: { message: { type: string; text: string }; onDismiss: () => void }) => (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
                "flex items-center gap-3 rounded-lg border px-4 py-3",
                message.type === "success" && "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300",
                message.type === "error" && "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300",
                message.type === "info" && "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300"
            )}
        >
            {message.type === "success" && <CheckCircle2 className="h-5 w-5 shrink-0" />}
            {message.type === "error" && <AlertCircle className="h-5 w-5 shrink-0" />}
            {message.type === "info" && <HelpCircle className="h-5 w-5 shrink-0" />}
            <span className="text-sm font-medium flex-1">{message.text}</span>
            <button onClick={onDismiss} className="text-current opacity-60 hover:opacity-100 shrink-0">
                <XCircle className="h-4 w-4" />
            </button>
        </motion.div>
    );

    return (
        <DashboardShell>
            <div className="space-y-6">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={SPRING_CONFIG}
                >
                    <Breadcrumbs
                        items={[
                            { label: "Campgrounds", href: "/campgrounds?all=true" },
                            { label: cg?.name || "...", href: `/campgrounds/${campgroundId}` },
                            { label: "Data Operations" }
                        ]}
                    />
                    <div className="mt-4 flex items-start justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <Database className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                                <h1 className="text-2xl font-bold text-foreground">Data Operations</h1>
                            </div>
                            <p className="text-muted-foreground">
                                Import reservations from other systems or export your data
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Import Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...SPRING_CONFIG, delay: 0.05 }}
                >
                    <Card className="border-border bg-card">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Upload className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                <div>
                                    <CardTitle className="text-foreground">Import Reservations</CardTitle>
                                    <CardDescription className="text-muted-foreground">
                                        Upload a CSV or JSON file to import reservation data
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <AnimatePresence>
                                {importMessage && (
                                    <MessageBanner message={importMessage} onDismiss={() => setImportMessage(null)} />
                                )}
                            </AnimatePresence>

                            <div className="grid gap-6 md:grid-cols-2">
                                {/* Format Selection */}
                                <div className="space-y-4">
                                    <div>
                                        <Label className="text-foreground mb-2 block">File Format</Label>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setImportFormat("csv")}
                                                className={cn(
                                                    "flex items-center gap-2 px-4 py-2 rounded-lg border transition-all",
                                                    importFormat === "csv"
                                                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                                                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                                                )}
                                            >
                                                <FileSpreadsheet className="h-4 w-4" />
                                                CSV
                                            </button>
                                            <button
                                                onClick={() => setImportFormat("json")}
                                                className={cn(
                                                    "flex items-center gap-2 px-4 py-2 rounded-lg border transition-all",
                                                    importFormat === "json"
                                                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                                                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                                                )}
                                            >
                                                <FileJson className="h-4 w-4" />
                                                JSON
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <Switch
                                            id="dry-run"
                                            checked={dryRun}
                                            onCheckedChange={setDryRun}
                                        />
                                        <div>
                                            <Label htmlFor="dry-run" className="text-foreground">Validate only</Label>
                                            <p className="text-xs text-muted-foreground">
                                                Check for errors without importing
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Upload Area */}
                                <div className="space-y-3">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept={importFormat === "csv" ? ".csv,text/csv" : ".json,application/json"}
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleImportFile(file);
                                        }}
                                    />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={importing}
                                        className={cn(
                                            "w-full flex flex-col items-center justify-center gap-2 p-8 rounded-lg border-2 border-dashed transition-all",
                                            "hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10",
                                            importing ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                                            "border-border bg-muted/30"
                                        )}
                                    >
                                        {importing ? (
                                            <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
                                        ) : (
                                            <Upload className="h-8 w-8 text-muted-foreground" />
                                        )}
                                        <span className="text-sm font-medium text-foreground">
                                            {importing ? "Importing..." : "Click to upload or drag & drop"}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {importFormat.toUpperCase()} files only
                                        </span>
                                    </button>

                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleDownloadTemplate}
                                            disabled={importSchemaLoading}
                                            className="flex-1"
                                        >
                                            {importSchemaLoading ? (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            ) : (
                                                <FileText className="mr-2 h-4 w-4" />
                                            )}
                                            Download Template
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={async () => {
                                                const schema = await apiClient.getReservationImportSchema(campgroundId);
                                                downloadBlob(JSON.stringify(schema, null, 2), "import-schema.json", "application/json");
                                            }}
                                        >
                                            <HelpCircle className="mr-2 h-4 w-4" />
                                            View Schema
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Export Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...SPRING_CONFIG, delay: 0.1 }}
                >
                    <Card className="border-border bg-card">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Download className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                <div>
                                    <CardTitle className="text-foreground">Export Reservations</CardTitle>
                                    <CardDescription className="text-muted-foreground">
                                        Download your reservation data for backup or analysis
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <AnimatePresence>
                                {exportMessage && (
                                    <MessageBanner message={exportMessage} onDismiss={() => setExportMessage(null)} />
                                )}
                            </AnimatePresence>

                            <div className="grid gap-6 md:grid-cols-2">
                                {/* Options */}
                                <div className="space-y-4">
                                    <div>
                                        <Label className="text-foreground mb-2 block">Export Format</Label>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setExportFormat("csv")}
                                                className={cn(
                                                    "flex items-center gap-2 px-4 py-2 rounded-lg border transition-all",
                                                    exportFormat === "csv"
                                                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                                                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                                                )}
                                            >
                                                <FileSpreadsheet className="h-4 w-4" />
                                                CSV
                                            </button>
                                            <button
                                                onClick={() => setExportFormat("json")}
                                                className={cn(
                                                    "flex items-center gap-2 px-4 py-2 rounded-lg border transition-all",
                                                    exportFormat === "json"
                                                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                                                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                                                )}
                                            >
                                                <FileJson className="h-4 w-4" />
                                                JSON
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <Switch
                                            id="include-pii"
                                            checked={includePii}
                                            onCheckedChange={setIncludePii}
                                        />
                                        <div>
                                            <Label htmlFor="include-pii" className="text-foreground">Include personal info</Label>
                                            <p className="text-xs text-muted-foreground">
                                                Names, emails, phone numbers
                                            </p>
                                        </div>
                                    </div>

                                    {includePii && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2"
                                        >
                                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                            <span>Handle exported PII data securely and in compliance with privacy regulations.</span>
                                        </motion.div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="space-y-3">
                                    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-medium text-foreground">Quick Download</p>
                                                <p className="text-xs text-muted-foreground">First page of results (up to 1,000 rows)</p>
                                            </div>
                                            <Button
                                                onClick={handleExportQuick}
                                                disabled={exporting}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                            >
                                                {exporting ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Download className="mr-2 h-4 w-4" />
                                                )}
                                                Download
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-medium text-foreground">Full Export Job</p>
                                                <p className="text-xs text-muted-foreground">All data, emailed when ready</p>
                                            </div>
                                            <Button
                                                variant="outline"
                                                onClick={handleQueueExportJob}
                                                disabled={exporting}
                                            >
                                                {exporting ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Clock className="mr-2 h-4 w-4" />
                                                )}
                                                Queue Job
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* NewBook Integration */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...SPRING_CONFIG, delay: 0.15 }}
                >
                    <NewbookImport campgroundId={campgroundId} />
                </motion.div>
            </div>
        </DashboardShell>
    );
}
