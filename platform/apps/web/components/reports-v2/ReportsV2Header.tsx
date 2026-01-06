"use client";

import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RefreshCw, SlidersHorizontal, Save, FileDown } from "lucide-react";

type ReportsV2HeaderProps = {
  title: string;
  description?: string;
  dateRange: { start: string; end: string };
  onDateRangeChange: (range: { start: string; end: string }) => void;
  live: boolean;
  onToggleLive: (value: boolean) => void;
  lastUpdatedAt?: Date | null;
  onRefresh: () => void;
  onOpenFilters: () => void;
  onSave: () => void;
  onExport: () => void;
  actionsSlot?: ReactNode;
};

function formatRelativeTime(date?: Date | null) {
  if (!date) return "Just now";
  const diff = Date.now() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 10) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function ReportsV2Header({
  title,
  description,
  dateRange,
  onDateRangeChange,
  live,
  onToggleLive,
  lastUpdatedAt,
  onRefresh,
  onOpenFilters,
  onSave,
  onExport,
  actionsSlot
}: ReportsV2HeaderProps) {
  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-4 shadow-sm space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={live ? "default" : "secondary"}>{live ? "Live" : "Paused"}</Badge>
          <div className="flex items-center gap-2">
            <Label htmlFor="live-toggle" className="text-xs text-muted-foreground">Auto-refresh</Label>
            <Switch id="live-toggle" checked={live} onCheckedChange={onToggleLive} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2">
          <Label htmlFor="range-start" className="text-xs text-muted-foreground">From</Label>
          <input
            id="range-start"
            type="date"
            value={dateRange.start}
            onChange={(e) => onDateRangeChange({ ...dateRange, start: e.target.value })}
            className="rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground"
          />
          <Label htmlFor="range-end" className="text-xs text-muted-foreground">To</Label>
          <input
            id="range-end"
            type="date"
            value={dateRange.end}
            onChange={(e) => onDateRangeChange({ ...dateRange, end: e.target.value })}
            className="rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground"
          />
        </div>

        <Button variant="outline" size="sm" className="gap-2" onClick={onOpenFilters}>
          <SlidersHorizontal className="h-4 w-4" />
          Customize
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={onSave}>
          <Save className="h-4 w-4" />
          Save
        </Button>
        <Button variant="secondary" size="sm" className="gap-2" onClick={onExport}>
          <FileDown className="h-4 w-4" />
          Export
        </Button>
        <Button variant="ghost" size="sm" className="gap-2" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
        {actionsSlot}
      </div>

      <div className="text-xs text-muted-foreground">
        Updated {formatRelativeTime(lastUpdatedAt)}
      </div>
    </div>
  );
}
