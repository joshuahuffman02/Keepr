"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Check, AlertTriangle, X, Edit2, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

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

interface ExtractionSummary {
  totalRows: number;
  validRows: number;
  createCount: number;
  updateCount: number;
  skipCount: number;
  missingRequired: string[];
  warnings: string[];
}

interface AiExtractionPreviewProps {
  documentId: string;
  rows: RowConfidence[];
  summary: ExtractionSummary;
  targetEntity: string;
  onCorrection: (rowNumber: number, field: string, value: FieldValue) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isConfirming?: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  siteNumber: "Site #",
  name: "Name",
  siteType: "Type",
  siteClassName: "Class",
  maxOccupancy: "Max Occ.",
  rigMaxLength: "Max Length",
  hookupsPower: "Power",
  hookupsWater: "Water",
  hookupsSewer: "Sewer",
  petFriendly: "Pets",
  defaultRate: "Rate",
  firstName: "First Name",
  lastName: "Last Name",
  email: "Email",
  phone: "Phone",
  arrivalDate: "Arrival",
  departureDate: "Departure",
  totalAmount: "Total",
  status: "Status",
};

export function AiExtractionPreview({
  documentId,
  rows,
  summary,
  targetEntity,
  onCorrection,
  onConfirm,
  onCancel,
  isConfirming = false,
}: AiExtractionPreviewProps) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [showLowConfidence, setShowLowConfidence] = useState(true);

  // Get visible fields based on entity type
  const visibleFields = useMemo(() => {
    if (rows.length === 0) return [];

    const firstRow = rows[0];
    return Object.keys(firstRow.fields).filter((field) => {
      // Always show fields that have values or are required
      const hasValue = rows.some(
        (r) => r.fields[field]?.value !== null && r.fields[field]?.value !== undefined,
      );
      return hasValue;
    });
  }, [rows]);

  // Filter rows by confidence if needed
  const displayRows = useMemo(() => {
    if (showLowConfidence) return rows;
    return rows.filter((r) => r.overallConfidence >= 0.8);
  }, [rows, showLowConfidence]);

  const startEdit = (rowNumber: number, field: string, currentValue: FieldValue) => {
    setEditingCell({ row: rowNumber, field });
    setEditValue(String(currentValue ?? ""));
  };

  const saveEdit = () => {
    if (editingCell) {
      onCorrection(editingCell.row, editingCell.field, editValue);
      setEditingCell(null);
      setEditValue("");
    }
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.95) {
      return <Check className="w-4 h-4 text-green-600" />;
    }
    if (confidence >= 0.8) {
      return <Check className="w-4 h-4 text-green-500" />;
    }
    if (confidence >= 0.5) {
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    }
    return <X className="w-4 h-4 text-red-500" />;
  };

  const getConfidenceBg = (confidence: number) => {
    if (confidence >= 0.95) return "bg-green-50";
    if (confidence >= 0.8) return "bg-green-50/50";
    if (confidence >= 0.5) return "bg-yellow-50";
    return "bg-red-50";
  };

  const formatValue = (value: FieldValue): string => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value);
  };

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border rounded-xl p-6"
      >
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{summary.totalRows}</p>
            <p className="text-sm text-muted-foreground">Total Rows</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">{summary.validRows}</p>
            <p className="text-sm text-muted-foreground">Valid</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">{summary.createCount}</p>
            <p className="text-sm text-muted-foreground">To Create</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600">{summary.updateCount}</p>
            <p className="text-sm text-muted-foreground">To Update</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-muted-foreground">{summary.skipCount}</p>
            <p className="text-sm text-muted-foreground">Skipped</p>
          </div>
        </div>

        {summary.missingRequired.length > 0 && (
          <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
            <p className="text-sm text-yellow-800">
              <AlertTriangle className="w-4 h-4 inline mr-1" />
              Missing required fields:{" "}
              <span className="font-medium">{summary.missingRequired.join(", ")}</span>
            </p>
          </div>
        )}
      </motion.div>

      {/* Filter Toggle */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {displayRows.length} of {rows.length} rows
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowLowConfidence(!showLowConfidence)}
        >
          {showLowConfidence ? "Hide" : "Show"} Low Confidence
        </Button>
      </div>

      {/* Data Table */}
      <div className="border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead className="w-12">Conf.</TableHead>
              {visibleFields.slice(0, 6).map((field) => (
                <TableHead key={field}>{FIELD_LABELS[field] || field}</TableHead>
              ))}
              <TableHead className="w-20">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.slice(0, 50).map((row) => (
              <Collapsible key={row.rowNumber} asChild>
                <>
                  <TableRow
                    className={cn(
                      "cursor-pointer hover:bg-muted/50",
                      row.action === "skip" && "opacity-50",
                    )}
                  >
                    <TableCell className="font-mono text-sm">{row.rowNumber}</TableCell>
                    <TableCell>
                      <div
                        className="flex items-center gap-1"
                        title={`${Math.round(row.overallConfidence * 100)}%`}
                      >
                        {getConfidenceIcon(row.overallConfidence)}
                      </div>
                    </TableCell>
                    {visibleFields.slice(0, 6).map((field) => {
                      const fieldData = row.fields[field];
                      const isEditing =
                        editingCell?.row === row.rowNumber && editingCell?.field === field;

                      return (
                        <TableCell
                          key={field}
                          className={cn(
                            "relative",
                            fieldData?.requiresReview && getConfidenceBg(fieldData.confidence),
                          )}
                          onClick={() => {
                            if (!isEditing && fieldData) {
                              startEdit(row.rowNumber, field, fieldData.value);
                            }
                          }}
                        >
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="h-7 text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEdit();
                                  if (e.key === "Escape") cancelEdit();
                                }}
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  saveEdit();
                                }}
                                aria-label="Save"
                              >
                                <Check className="w-3 h-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cancelEdit();
                                }}
                                aria-label="Cancel"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <span className="flex items-center gap-1">
                              {formatValue(fieldData?.value)}
                              {fieldData?.requiresReview && (
                                <Edit2 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                              )}
                            </span>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setExpandedRow(expandedRow === row.rowNumber ? null : row.rowNumber)
                          }
                        >
                          {expandedRow === row.rowNumber ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </TableCell>
                  </TableRow>
                  <CollapsibleContent asChild>
                    <TableRow>
                      <TableCell colSpan={visibleFields.length + 3}>
                        <div className="py-4 px-2 bg-muted/30 rounded">
                          <p className="text-sm font-medium mb-2">All Fields</p>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                            {Object.entries(row.fields).map(([field, data]) => (
                              <div
                                key={field}
                                className={cn(
                                  "p-2 rounded border text-sm",
                                  data.requiresReview
                                    ? getConfidenceBg(data.confidence)
                                    : "bg-white",
                                )}
                              >
                                <p className="text-xs text-muted-foreground">
                                  {FIELD_LABELS[field] || field}
                                </p>
                                <p className="font-medium truncate">{formatValue(data.value)}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {Math.round(data.confidence * 100)}% • {data.source}
                                </p>
                              </div>
                            ))}
                          </div>
                          {row.issues.length > 0 && (
                            <div className="mt-3 p-2 bg-red-50 rounded">
                              <p className="text-sm text-red-800">
                                Issues: {row.issues.join(", ")}
                              </p>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  </CollapsibleContent>
                </>
              </Collapsible>
            ))}
          </TableBody>
        </Table>

        {displayRows.length > 50 && (
          <div className="p-4 text-center text-sm text-muted-foreground border-t">
            Showing first 50 rows of {displayRows.length}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button variant="outline" onClick={onCancel} disabled={isConfirming}>
          Cancel
        </Button>
        <Button onClick={onConfirm} disabled={isConfirming || summary.validRows === 0}>
          {isConfirming ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Import {summary.validRows} Records
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
