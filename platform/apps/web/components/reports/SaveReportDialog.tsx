"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { saveReport, type SavedReport } from "./savedReports";
import { Save } from "lucide-react";

interface SaveReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportConfig: {
    tab: string;
    subTab?: string | null;
    dateRange: { start: string; end: string };
    filters: {
      status: string;
      siteType: string;
      groupBy: string;
    };
    campgroundId: string;
  };
  onSaved?: (report: SavedReport) => void;
}

export function SaveReportDialog({
  open,
  onOpenChange,
  reportConfig,
  onSaved,
}: SaveReportDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      const saved = saveReport({
        name: name.trim(),
        description: description.trim() || undefined,
        tab: reportConfig.tab,
        subTab: reportConfig.subTab,
        dateRange: reportConfig.dateRange,
        filters: reportConfig.filters,
        campgroundId: reportConfig.campgroundId,
      });

      onSaved?.(saved);

      // Reset form
      setName("");
      setDescription("");
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form when closing
      setName("");
      setDescription("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5 text-indigo-600" />
            Save Report Configuration
          </DialogTitle>
          <DialogDescription>
            Save the current report settings including filters, date range, and grouping for quick
            access later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="report-name">Report Name *</Label>
            <Input
              id="report-name"
              placeholder="e.g., Monthly Revenue Summary"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) {
                  handleSave();
                }
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-description">Description (optional)</Label>
            <Input
              id="report-description"
              placeholder="e.g., Monthly revenue breakdown by site type"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="rounded-lg border border-border bg-muted p-4 space-y-2">
            <h4 className="text-sm font-medium text-foreground">Current Configuration</h4>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>
                <span className="font-medium">Report:</span> {reportConfig.tab}
                {reportConfig.subTab && <span> / {reportConfig.subTab}</span>}
              </div>
              <div>
                <span className="font-medium">Date Range:</span> {reportConfig.dateRange.start} →{" "}
                {reportConfig.dateRange.end}
              </div>
              {reportConfig.filters.status !== "all" && (
                <div>
                  <span className="font-medium">Status:</span> {reportConfig.filters.status}
                </div>
              )}
              {reportConfig.filters.siteType !== "all" && (
                <div>
                  <span className="font-medium">Site Type:</span> {reportConfig.filters.siteType}
                </div>
              )}
              {reportConfig.filters.groupBy !== "none" && (
                <div>
                  <span className="font-medium">Group By:</span> {reportConfig.filters.groupBy}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || isSaving}>
            <Save className="h-4 w-4 mr-2" />
            Save Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
