"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { saveReport, type SavedReport } from "@/components/reports/savedReports";
import { useMenuConfig } from "@/hooks/use-menu-config";
import { buildReportHrefV2 } from "@/lib/report-links-v2";
import { Save } from "lucide-react";

interface SaveReportDialogV2Props {
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

export function SaveReportDialogV2({
  open,
  onOpenChange,
  reportConfig,
  onSaved,
}: SaveReportDialogV2Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pinToNav, setPinToNav] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { pinPage, unpinPage, isPinned } = useMenuConfig();

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
        pinned: pinToNav,
      });

      const href = buildReportHrefV2({
        tab: reportConfig.tab,
        subTab: reportConfig.subTab ?? null,
        dateRange: reportConfig.dateRange,
        filters: reportConfig.filters,
      });

      if (pinToNav) {
        pinPage(href);
      } else if (isPinned(href)) {
        unpinPage(href);
      }

      onSaved?.(saved);

      setName("");
      setDescription("");
      setPinToNav(true);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setName("");
      setDescription("");
      setPinToNav(true);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5 text-primary" />
            Save this report view
          </DialogTitle>
          <DialogDescription>
            Save filters, date range, and grouping so this view is one click away. You can pin it to
            your main menu.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="report-name">Report name</Label>
            <Input
              id="report-name"
              placeholder="e.g., Weekly occupancy pulse"
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
              placeholder="e.g., Occupancy by site class, last 30 days"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-muted px-4 py-3">
            <div>
              <div className="text-sm font-medium text-foreground">Pin to navigation</div>
              <div className="text-xs text-muted-foreground">
                Show this report in the main left menu for quick access.
              </div>
            </div>
            <Switch
              checked={pinToNav}
              onCheckedChange={setPinToNav}
              aria-label="Pin saved report"
            />
          </div>

          <div className="rounded-xl border border-border bg-muted px-4 py-3 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">Current configuration</div>
            <div className="mt-1">
              Report: {reportConfig.tab}
              {reportConfig.subTab ? ` / ${reportConfig.subTab}` : ""}
            </div>
            <div>
              Date range: {reportConfig.dateRange.start} to {reportConfig.dateRange.end}
            </div>
            {reportConfig.filters.status !== "all" && (
              <div>Status: {reportConfig.filters.status}</div>
            )}
            {reportConfig.filters.siteType !== "all" && (
              <div>Site type: {reportConfig.filters.siteType}</div>
            )}
            {reportConfig.filters.groupBy !== "none" && (
              <div>Group by: {reportConfig.filters.groupBy}</div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || isSaving}>
            <Save className="h-4 w-4 mr-2" />
            Save report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
