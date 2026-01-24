"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

export type ReportsV2Filters = {
  status: "all" | "confirmed" | "checked_in" | "pending" | "cancelled";
  siteType: string;
  groupBy: "none" | "site" | "status" | "date" | "siteType";
};

const statusOptions: ReportsV2Filters["status"][] = [
  "all",
  "confirmed",
  "checked_in",
  "pending",
  "cancelled",
];
const groupByOptions: ReportsV2Filters["groupBy"][] = [
  "none",
  "site",
  "status",
  "date",
  "siteType",
];

const isStatus = (value: string): value is ReportsV2Filters["status"] =>
  statusOptions.some((status) => status === value);
const isGroupBy = (value: string): value is ReportsV2Filters["groupBy"] =>
  groupByOptions.some((groupBy) => groupBy === value);

const toDateInput = (value: Date) => value.toISOString().slice(0, 10);

const rangeFromToday = (days: number) => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  return { start: toDateInput(start), end: toDateInput(end) };
};

const rangeNextDays = (days: number) => {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + (days - 1));
  return { start: toDateInput(start), end: toDateInput(end) };
};

const rangeThisMonth = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: toDateInput(start), end: toDateInput(end) };
};

const rangePreviousMonth = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return { start: toDateInput(start), end: toDateInput(end) };
};

const rangeNextMonth = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  return { start: toDateInput(start), end: toDateInput(end) };
};

const rangeLastQuarter = () => {
  const now = new Date();
  const quarterIndex = Math.floor(now.getMonth() / 3);
  const end = new Date(now.getFullYear(), quarterIndex * 3, 0);
  const start = new Date(end.getFullYear(), end.getMonth() - 2, 1);
  return { start: toDateInput(start), end: toDateInput(end) };
};

const rangeYearToDate = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return { start: toDateInput(start), end: toDateInput(now) };
};

const rangePastYear = () => {
  const end = new Date();
  const start = new Date();
  start.setFullYear(start.getFullYear() - 1);
  start.setDate(start.getDate() + 1);
  return { start: toDateInput(start), end: toDateInput(end) };
};

const rangeNextYear = () => {
  const start = new Date();
  const end = new Date();
  end.setFullYear(end.getFullYear() + 1);
  end.setDate(end.getDate() - 1);
  return { start: toDateInput(start), end: toDateInput(end) };
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
  { label: "Today", range: () => rangeFromToday(1) },
  { label: "Past 7 days", range: () => rangeFromToday(7) },
  { label: "Past 30 days", range: () => rangeFromToday(30) },
  { label: "Past 90 days", range: () => rangeFromToday(90) },
  { label: "This month", range: rangeThisMonth },
  { label: "Past month", range: rangePreviousMonth },
  { label: "Next month", range: rangeNextMonth },
  { label: "Last quarter", range: rangeLastQuarter },
  { label: "YTD", range: rangeYearToDate },
  { label: "Past year", range: rangePastYear },
  { label: "Next 90 days", range: () => rangeNextDays(90) },
  { label: "Next year", range: rangeNextYear },
];

export function ReportsV2FiltersSheet({
  open,
  onOpenChange,
  dateRange,
  onDateRangeChange,
  filters,
  onFiltersChange,
}: ReportsV2FiltersSheetProps) {
  const [draftRange, setDraftRange] = useState(dateRange);
  const [draftFilters, setDraftFilters] = useState(filters);

  useEffect(() => {
    if (open) {
      setDraftRange(dateRange);
      setDraftFilters(filters);
    }
  }, [open, dateRange, filters]);

  const applyPreset = (range: { start: string; end: string }) => {
    setDraftRange(range);
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
      end: end.toISOString().slice(0, 10),
    });
    setDraftFilters({ status: "all", siteType: "all", groupBy: "none" });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Customize report</SheetTitle>
          <SheetDescription>
            Adjust the date range, filters, and grouping for this view.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 py-4">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Quick date range
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  size="sm"
                  variant="outline"
                  onClick={() => applyPreset(preset.range())}
                >
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
                onValueChange={(value) => {
                  if (isStatus(value)) {
                    setDraftFilters((prev) => ({ ...prev, status: value }));
                  }
                }}
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
                onValueChange={(value) => {
                  if (isGroupBy(value)) {
                    setDraftFilters((prev) => ({ ...prev, groupBy: value }));
                  }
                }}
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
          <Button variant="outline" onClick={handleReset}>
            Reset
          </Button>
          <Button onClick={handleApply}>Apply filters</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
