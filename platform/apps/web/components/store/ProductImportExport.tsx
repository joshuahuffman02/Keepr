"use client";

import { useState, useRef } from "react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Download, Upload, FileSpreadsheet, ArrowRight, Check, AlertCircle } from "lucide-react";
import { apiClient } from "../../lib/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface ProductImportExportProps {
    campgroundId: string;
}

// Template columns for CSV export/import
const PRODUCT_COLUMNS = [
    { key: "name", label: "Name", required: true, example: "Firewood Bundle" },
    { key: "description", label: "Description", required: false, example: "Premium oak firewood, 10 pieces" },
    { key: "priceCents", label: "Price (cents)", required: true, example: "1500" },
    { key: "sku", label: "SKU", required: false, example: "FIRE-001" },
    { key: "stockQty", label: "Stock Quantity", required: false, example: "50" },
    { key: "lowStockAlert", label: "Low Stock Alert", required: false, example: "10" },
    { key: "trackInventory", label: "Track Inventory (true/false)", required: false, example: "true" },
    { key: "isActive", label: "Active (true/false)", required: false, example: "true" },
    { key: "categoryName", label: "Category Name", required: false, example: "Essentials" },
    { key: "glCode", label: "GL Code", required: false, example: "4100" },
] as const;

export function ProductImportExport({ campgroundId }: ProductImportExportProps) {
    const qc = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [importStep, setImportStep] = useState<"upload" | "mapping" | "preview" | "importing" | "complete">("upload");
    const [rawData, setRawData] = useState<string[][]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [importResults, setImportResults] = useState<{ success: number; failed: number; errors: string[] }>({ success: 0, failed: 0, errors: [] });

    const categoriesQuery = useQuery({
        queryKey: ["store-categories", campgroundId],
        queryFn: () => apiClient.getStoreCategories(campgroundId),
    });
    const productsQuery = useQuery({
        queryKey: ["store-products", campgroundId],
        queryFn: () => apiClient.getStoreProducts(campgroundId),
    });

    const categories = categoriesQuery.data || [];
    const products = productsQuery.data || [];

    // ========== EXPORT FUNCTIONS ==========
    const downloadTemplate = () => {
        const headerRow = PRODUCT_COLUMNS.map(c => c.label).join(",");
        const exampleRow = PRODUCT_COLUMNS.map(c => c.example).join(",");
        const csv = `${headerRow}\n${exampleRow}`;
        downloadCSV(csv, "product-import-template.csv");
    };

    const exportProducts = () => {
        if (products.length === 0) {
            alert("No products to export");
            return;
        }

        const headerRow = PRODUCT_COLUMNS.map(c => c.label).join(",");
        const dataRows = products.map(p => {
            const categoryName = categories.find(c => c.id === p.categoryId)?.name || "";
            return [
                escapeCSV(p.name),
                escapeCSV(p.description || ""),
                p.priceCents?.toString() || "0",
                escapeCSV(p.sku || ""),
                p.stockQty?.toString() || "0",
                p.lowStockAlert?.toString() || "",
                p.trackInventory ? "true" : "false",
                p.isActive !== false ? "true" : "false",
                escapeCSV(categoryName),
                escapeCSV(p.glCode || ""),
            ].join(",");
        });

        const csv = [headerRow, ...dataRows].join("\n");
        downloadCSV(csv, `products-export-${new Date().toISOString().slice(0, 10)}.csv`);
    };

    const downloadCSV = (content: string, filename: string) => {
        const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const escapeCSV = (value: string) => {
        if (value.includes(",") || value.includes('"') || value.includes("\n")) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    };

    // ========== IMPORT FUNCTIONS ==========
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            const rows = parseCSV(text);
            if (rows.length < 2) {
                alert("CSV must have at least a header row and one data row");
                return;
            }

            setHeaders(rows[0]);
            setRawData(rows.slice(1));

            // Auto-map columns
            const autoMapping: Record<string, string> = {};
            rows[0].forEach((header, idx) => {
                const normalizedHeader = header.toLowerCase().trim();
                const matchedCol = PRODUCT_COLUMNS.find(c =>
                    c.label.toLowerCase() === normalizedHeader ||
                    c.key.toLowerCase() === normalizedHeader
                );
                if (matchedCol) {
                    autoMapping[matchedCol.key] = idx.toString();
                }
            });
            setColumnMapping(autoMapping);
            setImportStep("mapping");
        };
        reader.readAsText(file);
    };

    const parseCSV = (text: string): string[][] => {
        const rows: string[][] = [];
        let row: string[] = [];
        let cell = "";
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i + 1];

            if (inQuotes) {
                if (char === '"' && nextChar === '"') {
                    cell += '"';
                    i++;
                } else if (char === '"') {
                    inQuotes = false;
                } else {
                    cell += char;
                }
            } else {
                if (char === '"') {
                    inQuotes = true;
                } else if (char === ",") {
                    row.push(cell.trim());
                    cell = "";
                } else if (char === "\n" || (char === "\r" && nextChar === "\n")) {
                    row.push(cell.trim());
                    rows.push(row);
                    row = [];
                    cell = "";
                    if (char === "\r") i++;
                } else if (char !== "\r") {
                    cell += char;
                }
            }
        }
        if (cell || row.length > 0) {
            row.push(cell.trim());
            rows.push(row);
        }
        return rows;
    };

    const generatePreview = () => {
        const preview = rawData.slice(0, 5).map((row, idx) => {
            const product: any = { _rowNum: idx + 2 };

            PRODUCT_COLUMNS.forEach(col => {
                const colIdx = parseInt(columnMapping[col.key] ?? "-1");
                if (colIdx >= 0 && colIdx < row.length) {
                    product[col.key] = row[colIdx];
                }
            });

            return product;
        });
        setPreviewData(preview);
        setImportStep("preview");
    };

    const runImport = async () => {
        setImportStep("importing");
        let success = 0;
        let failed = 0;
        const errors: string[] = [];

        for (let i = 0; i < rawData.length; i++) {
            const row = rawData[i];
            try {
                const product: any = {};

                PRODUCT_COLUMNS.forEach(col => {
                    const colIdx = parseInt(columnMapping[col.key] ?? "-1");
                    if (colIdx >= 0 && colIdx < row.length) {
                        const value = row[colIdx];
                        if (value) {
                            if (col.key === "priceCents" || col.key === "stockQty" || col.key === "lowStockAlert") {
                                product[col.key] = parseInt(value) || 0;
                            } else if (col.key === "trackInventory" || col.key === "isActive") {
                                product[col.key] = value.toLowerCase() === "true";
                            } else if (col.key === "categoryName") {
                                const cat = categories.find(c => c.name.toLowerCase() === value.toLowerCase());
                                if (cat) product.categoryId = cat.id;
                            } else {
                                product[col.key] = value;
                            }
                        }
                    }
                });

                if (!product.name) {
                    throw new Error("Name is required");
                }
                if (!product.priceCents && product.priceCents !== 0) {
                    throw new Error("Price is required");
                }

                await apiClient.createStoreProduct(campgroundId, product);
                success++;
            } catch (err: any) {
                failed++;
                errors.push(`Row ${i + 2}: ${err.message || "Unknown error"}`);
            }
        }

        setImportResults({ success, failed, errors });
        setImportStep("complete");
        qc.invalidateQueries({ queryKey: ["store-products"] });
    };

    const resetImport = () => {
        setImportStep("upload");
        setRawData([]);
        setHeaders([]);
        setColumnMapping({});
        setPreviewData([]);
        setImportResults({ success: 0, failed: 0, errors: [] });
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
        <>
            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                    <FileSpreadsheet className="h-4 w-4 mr-1" />
                    Template
                </Button>
                <Button variant="outline" size="sm" onClick={exportProducts}>
                    <Download className="h-4 w-4 mr-1" />
                    Export
                </Button>
                <Button variant="outline" size="sm" onClick={() => { resetImport(); setIsImportDialogOpen(true); }}>
                    <Upload className="h-4 w-4 mr-1" />
                    Import
                </Button>
            </div>

            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Import Products</DialogTitle>
                        <DialogDescription>
                            Upload a CSV file to bulk import products
                        </DialogDescription>
                    </DialogHeader>

                    {/* Progress Steps */}
                    <div className="flex items-center gap-2 py-4 border-b">
                        {["upload", "mapping", "preview", "complete"].map((step, idx) => (
                            <div key={step} className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${importStep === step ? "bg-primary text-primary-foreground" :
                                        ["upload", "mapping", "preview", "importing", "complete"].indexOf(importStep) > idx
                                            ? "bg-status-success-bg text-status-success-text"
                                            : "bg-muted text-muted-foreground"
                                    }`}>
                                    {idx + 1}
                                </div>
                                <span className="text-sm text-muted-foreground capitalize">{step}</span>
                                {idx < 3 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
                            </div>
                        ))}
                    </div>

                    {/* Step 1: Upload */}
                    {importStep === "upload" && (
                        <div className="py-8 text-center space-y-4">
                            <div className="border-2 border-dashed border-border rounded-lg p-8">
                                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                <p className="text-muted-foreground mb-4">Drop a CSV file here or click to browse</p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                    id="csv-upload"
                                />
                                <Button variant="outline" asChild>
                                    <label htmlFor="csv-upload" className="cursor-pointer">
                                        Choose File
                                    </label>
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Need a template? <button onClick={downloadTemplate} className="text-emerald-600 underline">Download here</button>
                            </p>
                        </div>
                    )}

                    {/* Step 2: Column Mapping */}
                    {importStep === "mapping" && (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Map your CSV columns to product fields. Found {rawData.length} rows.
                            </p>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {PRODUCT_COLUMNS.map(col => (
                                    <div key={col.key} className="flex items-center gap-4 p-2 rounded-lg bg-muted">
                                        <div className="w-40 text-sm font-medium text-foreground">
                                            {col.label}
                                            {col.required && <span className="text-red-500 ml-1">*</span>}
                                        </div>
                                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                        <select
                                            value={columnMapping[col.key] ?? ""}
                                            onChange={(e) => setColumnMapping({ ...columnMapping, [col.key]: e.target.value })}
                                            className="flex-1 rounded-md border border-border px-3 py-2 text-sm"
                                        >
                                            <option value="">-- Skip --</option>
                                            {headers.map((h, idx) => (
                                                <option key={idx} value={idx.toString()}>{h}</option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <Button variant="outline" onClick={resetImport}>Cancel</Button>
                                <Button onClick={generatePreview}>
                                    Preview Import
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Preview */}
                    {importStep === "preview" && (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Preview of first 5 rows ({rawData.length} total)
                            </p>
                            <div className="overflow-x-auto border rounded-lg">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Row</th>
                                            <th className="px-3 py-2 text-left">Name</th>
                                            <th className="px-3 py-2 text-left">Price</th>
                                            <th className="px-3 py-2 text-left">SKU</th>
                                            <th className="px-3 py-2 text-left">Stock</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {previewData.map(row => (
                                            <tr key={row._rowNum}>
                                                <td className="px-3 py-2 text-muted-foreground">{row._rowNum}</td>
                                                <td className="px-3 py-2 font-medium">{row.name || <span className="text-red-500">Missing</span>}</td>
                                                <td className="px-3 py-2">{row.priceCents ? `$${(parseInt(row.priceCents) / 100).toFixed(2)}` : <span className="text-red-500">Missing</span>}</td>
                                                <td className="px-3 py-2">{row.sku || "—"}</td>
                                                <td className="px-3 py-2">{row.stockQty || "—"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <Button variant="outline" onClick={() => setImportStep("mapping")}>Back</Button>
                                <Button onClick={runImport}>
                                    Import {rawData.length} Products
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Importing */}
                    {importStep === "importing" && (
                        <div className="py-12 text-center">
                            <div className="animate-spin w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4" />
                            <p className="text-muted-foreground">Importing products...</p>
                        </div>
                    )}

                    {/* Step 5: Complete */}
                    {importStep === "complete" && (
                        <div className="py-8 text-center space-y-4">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${importResults.failed === 0 ? "bg-emerald-100" : "bg-amber-100"
                                }`}>
                                {importResults.failed === 0 ? (
                                    <Check className="h-8 w-8 text-emerald-600" />
                                ) : (
                                    <AlertCircle className="h-8 w-8 text-amber-600" />
                                )}
                            </div>
                            <div>
                                <p className="text-lg font-medium text-foreground">Import Complete</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {importResults.success} products imported successfully
                                    {importResults.failed > 0 && `, ${importResults.failed} failed`}
                                </p>
                            </div>
                            {importResults.errors.length > 0 && (
                                <div className="text-left max-h-32 overflow-y-auto bg-red-50 p-3 rounded-lg text-sm text-red-700">
                                    {importResults.errors.slice(0, 10).map((err, idx) => (
                                        <div key={idx}>{err}</div>
                                    ))}
                                    {importResults.errors.length > 10 && (
                                        <div className="text-red-500">...and {importResults.errors.length - 10} more</div>
                                    )}
                                </div>
                            )}
                            <Button onClick={() => setIsImportDialogOpen(false)}>Done</Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
