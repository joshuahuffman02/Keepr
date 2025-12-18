"use client";

import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/components/ui/use-toast";
import {
  Upload,
  FileText,
  Download,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Loader2,
  MapPin,
  Users,
} from "lucide-react";

type EntityType = "sites" | "guests";
type ImportStep = "upload" | "mapping" | "preview" | "complete";

type FieldMapping = {
  sourceField: string;
  targetField: string;
};

type DetectedFormat = {
  format: string;
  confidence: number;
  headers: string[];
  suggestedMappings: Array<{
    sourceField: string;
    suggestedTarget: string;
    confidence: number;
  }>;
};

type ImportPreview = {
  totalRows: number;
  validRows: number;
  newSites?: number;
  updateSites?: number;
  newGuests?: number;
  updateGuests?: number;
  duplicateEmails?: number;
  errors: Array<{ row: number; message: string }>;
  warnings: Array<{ row: number; message: string }>;
  preview: Array<{
    rowNumber: number;
    data: Record<string, unknown>;
    action: "create" | "update" | "skip";
  }>;
};

type ImportResult = {
  jobId: string;
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
};

export default function DataImportPage() {
  const { toast } = useToast();
  const [campgroundId, setCampgroundId] = useState("");
  const [entityType, setEntityType] = useState<EntityType>("sites");
  const [csvContent, setCsvContent] = useState("");
  const [step, setStep] = useState<ImportStep>("upload");
  const [detectedFormat, setDetectedFormat] = useState<DetectedFormat | null>(null);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("campreserv:selectedCampground") : null;
    if (stored) {
      setCampgroundId(stored);
    }
  }, []);

  // Get schema for the selected entity type
  const schemaQuery = useQuery({
    queryKey: ["import-schema", campgroundId, entityType],
    queryFn: () => apiClient.getImportSchema(campgroundId, entityType),
    enabled: !!campgroundId,
  });

  // Detect format mutation
  const detectMutation = useMutation({
    mutationFn: () =>
      apiClient.detectImportFormat(campgroundId, { csvContent, entityType }),
    onSuccess: (data) => {
      setDetectedFormat(data);
      // Initialize field mappings from suggestions
      const mappings = data.suggestedMappings.map((s) => ({
        sourceField: s.sourceField,
        targetField: s.suggestedTarget,
      }));
      setFieldMappings(mappings);
      setStep("mapping");
    },
    onError: (err: any) => {
      toast({
        title: "Format detection failed",
        description: err?.message ?? "Unable to parse CSV",
        variant: "destructive",
      });
    },
  });

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: () =>
      apiClient.previewImport(campgroundId, { csvContent, entityType, fieldMappings }),
    onSuccess: (data) => {
      setPreview(data);
      setStep("preview");
    },
    onError: (err: any) => {
      toast({
        title: "Preview failed",
        description: err?.message ?? "Unable to preview import",
        variant: "destructive",
      });
    },
  });

  // Execute import mutation
  const executeMutation = useMutation({
    mutationFn: () =>
      apiClient.executeImport(campgroundId, { csvContent, entityType, fieldMappings, updateExisting }),
    onSuccess: (data) => {
      setImportResult(data);
      setStep("complete");
      toast({
        title: "Import complete",
        description: `Created ${data.created}, updated ${data.updated}, skipped ${data.skipped}`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Import failed",
        description: err?.message ?? "Unable to complete import",
        variant: "destructive",
      });
    },
  });

  // Handle file upload
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);
    };
    reader.readAsText(file);
  }, []);

  // Download template
  const handleDownloadTemplate = async () => {
    try {
      const csv = await apiClient.getImportTemplate(campgroundId, entityType);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${entityType}-import-template.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({
        title: "Download failed",
        description: err?.message ?? "Unable to download template",
        variant: "destructive",
      });
    }
  };

  // Update a field mapping
  const updateMapping = (sourceField: string, targetField: string) => {
    setFieldMappings((prev) => {
      const existing = prev.find((m) => m.sourceField === sourceField);
      if (existing) {
        return prev.map((m) =>
          m.sourceField === sourceField ? { ...m, targetField } : m
        );
      }
      return [...prev, { sourceField, targetField }];
    });
  };

  // Remove a field mapping
  const removeMapping = (sourceField: string) => {
    setFieldMappings((prev) => prev.filter((m) => m.sourceField !== sourceField));
  };

  // Reset the wizard
  const reset = () => {
    setCsvContent("");
    setStep("upload");
    setDetectedFormat(null);
    setFieldMappings([]);
    setPreview(null);
    setImportResult(null);
    setUpdateExisting(false);
  };

  const allTargetFields = schemaQuery.data
    ? [...schemaQuery.data.requiredFields, ...schemaQuery.data.optionalFields]
    : [];

  return (
    <DashboardShell>
      <div className="max-w-5xl mx-auto space-y-6 p-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Data Import</h1>
          <p className="text-slate-600">
            Import sites, guests, and reservations from CSV files or migrate from other systems
          </p>
        </div>

        {/* Entity Type Selector */}
        <Card>
          <CardHeader>
            <CardTitle>What would you like to import?</CardTitle>
            <CardDescription>
              Select the type of data you want to import
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={entityType} onValueChange={(v) => { setEntityType(v as EntityType); reset(); }}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="sites" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Sites
                </TabsTrigger>
                <TabsTrigger value="guests" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Guests
                </TabsTrigger>
              </TabsList>

              <TabsContent value="sites" className="mt-4">
                <p className="text-sm text-slate-600">
                  Import campsite information including site numbers, types, hookups, and amenities.
                  This is useful when migrating from another reservation system.
                </p>
              </TabsContent>

              <TabsContent value="guests" className="mt-4">
                <p className="text-sm text-slate-600">
                  Import guest records including names, contact information, and vehicle details.
                  Existing guests will be matched by email address.
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload CSV File
              </CardTitle>
              <CardDescription>
                Upload a CSV file or paste the content directly. We support exports from Campspot, NewBook, and generic CSV formats.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Template Download */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium text-slate-900">Need a template?</p>
                  <p className="text-sm text-slate-600">
                    Download our CSV template with all supported fields
                  </p>
                </div>
                <Button variant="outline" onClick={handleDownloadTemplate} disabled={!campgroundId}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>

              {/* File Upload */}
              <div>
                <Label htmlFor="file-upload">Upload CSV File</Label>
                <div className="mt-2">
                  <input
                    id="file-upload"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileUpload}
                    className="block w-full text-sm text-slate-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-md file:border-0
                      file:text-sm file:font-semibold
                      file:bg-emerald-50 file:text-emerald-700
                      hover:file:bg-emerald-100
                      cursor-pointer"
                  />
                </div>
              </div>

              {/* Or paste content */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-500">Or paste CSV content</span>
                </div>
              </div>

              <div>
                <Label htmlFor="csv-content">CSV Content</Label>
                <Textarea
                  id="csv-content"
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  placeholder="Paste your CSV content here..."
                  className="mt-2 font-mono text-sm h-48"
                />
              </div>

              {/* Supported Formats Info */}
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertTitle>Supported Formats</AlertTitle>
                <AlertDescription>
                  We automatically detect exports from <strong>Campspot</strong> and <strong>NewBook</strong>.
                  For other systems, use our CSV template or map your columns manually.
                </AlertDescription>
              </Alert>

              {/* Next Button */}
              <div className="flex justify-end">
                <Button
                  onClick={() => detectMutation.mutate()}
                  disabled={!csvContent.trim() || !campgroundId || detectMutation.isPending}
                >
                  {detectMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4 mr-2" />
                  )}
                  Analyze CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Field Mapping */}
        {step === "mapping" && detectedFormat && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Map Fields
              </CardTitle>
              <CardDescription>
                We detected <Badge variant="secondary">{detectedFormat.format.toUpperCase()}</Badge> format
                with {detectedFormat.headers.length} columns. Review and adjust the field mappings below.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Mapping Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source Column</TableHead>
                    <TableHead>Maps To</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detectedFormat.headers.map((header) => {
                    const mapping = fieldMappings.find((m) => m.sourceField === header);
                    const suggested = detectedFormat.suggestedMappings.find((s) => s.sourceField === header);

                    return (
                      <TableRow key={header}>
                        <TableCell className="font-mono text-sm">{header}</TableCell>
                        <TableCell>
                          <Select
                            value={mapping?.targetField || ""}
                            onValueChange={(v) => v ? updateMapping(header, v) : removeMapping(header)}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue placeholder="Select field..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">— Skip this column —</SelectItem>
                              {allTargetFields.map((field) => (
                                <SelectItem key={field} value={field}>
                                  {field}
                                  {schemaQuery.data?.requiredFields.includes(field) && (
                                    <span className="text-red-500 ml-1">*</span>
                                  )}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {suggested && (
                            <Badge
                              variant={suggested.confidence > 0.9 ? "default" : "secondary"}
                            >
                              {Math.round(suggested.confidence * 100)}%
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {mapping && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeMapping(header)}
                            >
                              <XCircle className="h-4 w-4 text-slate-400" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Required fields check */}
              {schemaQuery.data && (
                <div className="text-sm text-slate-600">
                  <strong>Required fields:</strong>{" "}
                  {schemaQuery.data.requiredFields.map((field, i) => {
                    const isMapped = fieldMappings.some((m) => m.targetField === field);
                    return (
                      <span key={field}>
                        <span className={isMapped ? "text-emerald-600" : "text-red-600"}>
                          {field}
                          {isMapped ? " ✓" : " ✗"}
                        </span>
                        {i < schemaQuery.data!.requiredFields.length - 1 && ", "}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep("upload")}>
                  Back
                </Button>
                <Button
                  onClick={() => previewMutation.mutate()}
                  disabled={previewMutation.isPending}
                >
                  {previewMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4 mr-2" />
                  )}
                  Preview Import
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Preview */}
        {step === "preview" && preview && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                Review Import
              </CardTitle>
              <CardDescription>
                Review the import results before committing changes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-slate-900">{preview.totalRows}</p>
                  <p className="text-sm text-slate-600">Total Rows</p>
                </div>
                <div className="p-4 bg-emerald-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-emerald-700">
                    {entityType === "sites" ? preview.newSites : preview.newGuests}
                  </p>
                  <p className="text-sm text-emerald-600">New {entityType}</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-700">
                    {entityType === "sites" ? preview.updateSites : preview.updateGuests}
                  </p>
                  <p className="text-sm text-blue-600">Updates</p>
                </div>
                <div className="p-4 bg-red-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-red-700">{preview.errors.length}</p>
                  <p className="text-sm text-red-600">Errors</p>
                </div>
              </div>

              {/* Errors */}
              {preview.errors.length > 0 && (
                <Alert className="border-red-200 bg-red-50 text-red-900">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <AlertTitle className="text-red-800">Validation Errors</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      {preview.errors.slice(0, 10).map((err, i) => (
                        <li key={i}>
                          Row {err.row}: {err.message}
                        </li>
                      ))}
                      {preview.errors.length > 10 && (
                        <li>... and {preview.errors.length - 10} more errors</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Warnings */}
              {preview.warnings.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Warnings</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      {preview.warnings.slice(0, 5).map((warn, i) => (
                        <li key={i}>
                          Row {warn.row}: {warn.message}
                        </li>
                      ))}
                      {preview.warnings.length > 5 && (
                        <li>... and {preview.warnings.length - 5} more warnings</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Preview Table */}
              <div>
                <h3 className="font-medium text-slate-900 mb-2">Preview (first 10 rows)</h3>
                <div className="border rounded-lg overflow-auto max-h-64">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Row</TableHead>
                        <TableHead className="w-24">Action</TableHead>
                        {fieldMappings.slice(0, 4).map((m) => (
                          <TableHead key={m.targetField}>{m.targetField}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.preview.slice(0, 10).map((row) => (
                        <TableRow key={row.rowNumber}>
                          <TableCell>{row.rowNumber}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                row.action === "create"
                                  ? "default"
                                  : row.action === "update"
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {row.action}
                            </Badge>
                          </TableCell>
                          {fieldMappings.slice(0, 4).map((m) => (
                            <TableCell key={m.targetField} className="text-sm">
                              {String(row.data[m.targetField] ?? "")}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Update Existing Option */}
              <div className="flex items-center space-x-2 p-4 bg-slate-50 rounded-lg">
                <Checkbox
                  id="update-existing"
                  checked={updateExisting}
                  onCheckedChange={(c) => setUpdateExisting(!!c)}
                />
                <div>
                  <Label htmlFor="update-existing" className="font-medium">
                    Update existing records
                  </Label>
                  <p className="text-sm text-slate-600">
                    If checked, existing {entityType} will be updated with the imported data.
                    Otherwise, they will be skipped.
                  </p>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep("mapping")}>
                  Back
                </Button>
                <Button
                  onClick={() => executeMutation.mutate()}
                  disabled={executeMutation.isPending || preview.validRows === 0}
                >
                  {executeMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Import {preview.validRows} Records
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Complete */}
        {step === "complete" && importResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {importResult.success ? (
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                )}
                Import {importResult.success ? "Complete" : "Finished with Errors"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Results Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-emerald-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-emerald-700">{importResult.created}</p>
                  <p className="text-sm text-emerald-600">Created</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-700">{importResult.updated}</p>
                  <p className="text-sm text-blue-600">Updated</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-slate-700">{importResult.skipped}</p>
                  <p className="text-sm text-slate-600">Skipped</p>
                </div>
              </div>

              {/* Errors if any */}
              {importResult.errors.length > 0 && (
                <Alert className="border-red-200 bg-red-50 text-red-900">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <AlertTitle className="text-red-800">Import Errors</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      {importResult.errors.slice(0, 10).map((err, i) => (
                        <li key={i}>
                          Row {err.row}: {err.message}
                        </li>
                      ))}
                      {importResult.errors.length > 10 && (
                        <li>... and {importResult.errors.length - 10} more errors</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Success Message */}
              {importResult.success && (
                <Alert className="bg-emerald-50 border-emerald-200">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <AlertTitle className="text-emerald-800">Success!</AlertTitle>
                  <AlertDescription className="text-emerald-700">
                    Your {entityType} have been imported successfully.
                    You can view them in the {entityType === "sites" ? "Sites" : "Guests"} section.
                  </AlertDescription>
                </Alert>
              )}

              {/* Actions */}
              <div className="flex gap-4">
                <Button onClick={reset}>
                  Import More Data
                </Button>
                <Button variant="outline" asChild>
                  <a href={entityType === "sites" ? "/dashboard/sites" : "/dashboard/guests"}>
                    View {entityType === "sites" ? "Sites" : "Guests"}
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}
