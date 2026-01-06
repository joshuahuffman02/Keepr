"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

export type ReportsV2Filters = {
  status: "all" | "confirmed" | "checked_in" | "pending" | "cancelled";
  siteType: string;
  groupBy: "none" | "site" | "status" | "date" | "siteType";
};

type ReportsV2FiltersSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateRange: { start: string; end: string };
  onDateRangeChange: (range: { start: string; end: string }) => void;
  filters: ReportsV2Filters;
  onFiltersChange: (filters: ReportsV2Filters) => void;
};

const PRESETS = [
  { label: "Today", days: 0 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "This year", days: 365 }
];

export function ReportsV2FiltersSheet({
  open,
  onOpenChange,
  dateRange,
  onDateRangeChange,
  filters,
  onFiltersChange
}: ReportsV2FiltersSheetProps) {
  const [draftRange, setDraftRange] = useState(dateRange);
  const [draftFilters, setDraftFilters] = useState(filters);

  useEffect(() => {
    if (open) {
      setDraftRange(dateRange);
      setDraftFilters(filters);
    }
  }, [open, dateRange, filters]);

  const applyPreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setDraftRange({
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10)
    });
  };

  const handleApply = () => {
    onDateRangeChange(draftRange);
    onFiltersChange(draftFilters);
    onOpenChange(false);
  };

  const handleReset = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    setDraftRange({
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10)
    });
    setDraftFilters({ status: "all", siteType: "all", groupBy: "none" });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Customize report</SheetTitle>
          <SheetDescription>Adjust the date range, filters, and grouping for this view.</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 py-4">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quick date range</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <Button key={preset.label} size="sm" variant="outline" onClick={() => applyPreset(preset.days)}>
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="filter-start">Start date</Label>
              <input
                id="filter-start"
                type="date"
                value={draftRange.start}
                onChange={(e) => setDraftRange((prev) => ({ ...prev, start: e.target.value }))}
                className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <Label htmlFor="filter-end">End date</Label>
              <input
                id="filter-end"
                type="date"
                value={draftRange.end}
                onChange={(e) => setDraftRange((prev) => ({ ...prev, end: e.target.value }))}
                className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label>Status</Label>
              <Select
                value={draftFilters.status}
                onValueChange={(value) => setDraftFilters((prev) => ({ ...prev, status: value as ReportsV2Filters["status"] }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="checked_in">Checked In</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Site type</Label>
              <Select
                value={draftFilters.siteType}
                onValueChange={(value) => setDraftFilters((prev) => ({ ...prev, siteType: value }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All site types</SelectItem>
                  <SelectItem value="RV">RV Sites</SelectItem>
                  <SelectItem value="Tent">Tent Sites</SelectItem>
                  <SelectItem value="Cabin">Cabins</SelectItem>
                  <SelectItem value="Glamping">Glamping</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Group by</Label>
              <Select
                value={draftFilters.groupBy}
                onValueChange={(value) => setDraftFilters((prev) => ({ ...prev, groupBy: value as ReportsV2Filters["groupBy"] }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No grouping</SelectItem>
                  <SelectItem value="site">By site</SelectItem>
                  <SelectItem value="status">By status</SelectItem>
                  <SelectItem value="date">By date</SelectItem>
                  <SelectItem value="siteType">By site type</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <SheetFooter className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>Reset</Button>
          <Button onClick={handleApply}>Apply filters</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
