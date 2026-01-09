"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Check,
  X,
  AlertTriangle,
  Loader2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface SuggestedValue {
  rowNumber: number;
  field: string;
  fieldLabel: string;
  currentValue: string | null;
  suggestedValue: string | number | boolean;
  confidence: number;
  reasoning?: string;
}

interface AiAutoFillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions: SuggestedValue[];
  onConfirm: (selectedSuggestions: SuggestedValue[]) => void;
  isLoading?: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  siteNumber: "Site Number",
  name: "Site Name",
  siteType: "Site Type",
  siteClassName: "Site Class",
  maxOccupancy: "Max Occupancy",
  rigMaxLength: "Max Length",
  hookupsPower: "Power Hookup",
  hookupsWater: "Water Hookup",
  hookupsSewer: "Sewer Hookup",
  petFriendly: "Pet Friendly",
  defaultRate: "Nightly Rate",
};

export function AiAutoFillDialog({
  open,
  onOpenChange,
  suggestions,
  onConfirm,
  isLoading = false,
}: AiAutoFillDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(suggestions.map((s) => `${s.rowNumber}-${s.field}`))
  );

  const toggleSuggestion = (rowNumber: number, field: string) => {
    const id = `${rowNumber}-${field}`;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(suggestions.map((s) => `${s.rowNumber}-${s.field}`)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleConfirm = () => {
    const selected = suggestions.filter((s) =>
      selectedIds.has(`${s.rowNumber}-${s.field}`)
    );
    onConfirm(selected);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return "text-green-600";
    if (confidence >= 0.7) return "text-yellow-600";
    return "text-orange-600";
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "number") {
      // Format as currency if it looks like a rate
      if (value >= 10 && value <= 1000) return `$${value.toFixed(2)}`;
      return String(value);
    }
    return String(value);
  };

  // Group suggestions by row for better display
  const groupedByRow = suggestions.reduce((acc, s) => {
    if (!acc[s.rowNumber]) {
      acc[s.rowNumber] = [];
    }
    acc[s.rowNumber].push(s);
    return acc;
  }, {} as Record<number, SuggestedValue[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-primary" />
            AI Auto-Fill Suggestions
          </DialogTitle>
          <DialogDescription>
            AI has suggestions for {suggestions.length} missing or uncertain values.
            Review and select which ones to apply.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 -mx-6 px-6">
          {/* Quick Actions */}
          <div className="flex items-center justify-between py-2 border-b mb-4">
            <span className="text-sm text-muted-foreground">
              {selectedIds.size} of {suggestions.length} selected
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={selectAll}>
                Select All
              </Button>
              <Button variant="ghost" size="sm" onClick={deselectAll}>
                Deselect All
              </Button>
            </div>
          </div>

          {/* Suggestions List */}
          <div className="space-y-4">
            {Object.entries(groupedByRow).map(([rowNum, rowSuggestions]) => (
              <motion.div
                key={rowNum}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="border rounded-lg overflow-hidden"
              >
                <div className="bg-muted/50 px-4 py-2 text-sm font-medium">
                  Row {rowNum}
                </div>
                <div className="divide-y">
                  {rowSuggestions.map((suggestion) => {
                    const id = `${suggestion.rowNumber}-${suggestion.field}`;
                    const isSelected = selectedIds.has(id);
                    const label =
                      suggestion.fieldLabel ||
                      FIELD_LABELS[suggestion.field] ||
                      suggestion.field;

                    return (
                      <div
                        key={id}
                        className={cn(
                          "px-4 py-3 flex items-start gap-3 cursor-pointer hover:bg-muted/30 transition-colors",
                          isSelected && "bg-primary/5"
                        )}
                        onClick={() =>
                          toggleSuggestion(suggestion.rowNumber, suggestion.field)
                        }
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() =>
                            toggleSuggestion(suggestion.rowNumber, suggestion.field)
                          }
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-sm">{label}</span>
                            <span
                              className={cn(
                                "text-xs",
                                getConfidenceColor(suggestion.confidence)
                              )}
                            >
                              {Math.round(suggestion.confidence * 100)}% confident
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-muted-foreground line-through">
                              {suggestion.currentValue || "Empty"}
                            </span>
                            <span className="text-muted-foreground">→</span>
                            <span className="text-sm font-medium text-primary">
                              {formatValue(suggestion.suggestedValue)}
                            </span>
                          </div>
                          {suggestion.reasoning && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {suggestion.reasoning}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>

          {suggestions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No suggestions available</p>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4 mt-4">
          <div className="flex items-center gap-2 mr-auto">
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
            <span className="text-xs text-muted-foreground">
              Review suggestions carefully before applying
            </span>
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedIds.size === 0 || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Apply {selectedIds.size} Suggestion{selectedIds.size !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
