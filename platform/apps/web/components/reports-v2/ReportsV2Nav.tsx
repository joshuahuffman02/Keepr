"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { reportCatalogV2, subTabsV2, type ReportTabV2 } from "@/lib/report-registry-v2";
import { buildReportHrefV2, type ReportFiltersV2 } from "@/lib/report-links-v2";
import type { SavedReport } from "@/components/reports/savedReports";

type ReportsV2NavProps = {
  activeTab?: ReportTabV2 | null;
  activeSubTab?: string | null;
  activeShortcut?: "saved" | "portfolio" | "devices" | "audit" | null;
  dateRange?: { start: string; end: string };
  filters?: ReportFiltersV2;
  pinnedReports?: SavedReport[];
};

type SearchItem = {
  tab: ReportTabV2;
  subTab?: string | null;
  label: string;
  category: string;
  description?: string;
};

const isSubTabCategory = (value: string): value is keyof typeof subTabsV2 =>
  Object.prototype.hasOwnProperty.call(subTabsV2, value);

export function ReportsV2Nav({
  activeTab,
  activeSubTab,
  activeShortcut,
  dateRange,
  filters,
  pinnedReports = [],
}: ReportsV2NavProps) {
  const [search, setSearch] = useState("");

  const searchItems = useMemo<SearchItem[]>(() => {
    const items: SearchItem[] = [];
    reportCatalogV2.forEach((category) => {
      if (category.id === "overview") {
        items.push({
          tab: "overview",
          subTab: null,
          label: category.label,
          category: "Overview",
          description: category.description,
        });
        return;
      }
      const reports = isSubTabCategory(category.id) ? subTabsV2[category.id] : category.subReports;
      reports.forEach((sub) => {
        items.push({
          tab: category.id,
          subTab: sub.id,
          label: sub.label,
          category: category.label,
          description: sub.description,
        });
      });
    });
    return items;
  }, []);

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return searchItems
      .filter((item) => {
        return (
          item.label.toLowerCase().includes(term) ||
          item.category.toLowerCase().includes(term) ||
          item.description?.toLowerCase().includes(term)
        );
      })
      .slice(0, 8);
  }, [search, searchItems]);

  const pinned = pinnedReports.filter((r) => r.pinned);
  const resolvedShortcut =
    activeShortcut ?? (activeTab === null && activeSubTab === null ? "saved" : null);
  const isSavedActive = resolvedShortcut === "saved";
  const isPortfolioActive = resolvedShortcut === "portfolio";
  const isDevicesActive = resolvedShortcut === "devices";
  const isAuditActive = resolvedShortcut === "audit";

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card px-4 py-4 shadow-sm">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find a report"
          aria-label="Find a report"
          className="pl-8"
        />
        {matches.length > 0 && (
          <div className="absolute left-0 right-0 mt-2 rounded-md border border-border bg-card shadow-lg z-20">
            {matches.map((item) => {
              const href = buildReportHrefV2({
                tab: item.tab,
                subTab: item.subTab,
                dateRange,
                filters,
              });
              return (
                <Link
                  key={`${item.tab}-${item.subTab ?? "overview"}`}
                  href={href}
                  onClick={() => setSearch("")}
                  className="block px-3 py-2 text-sm hover:bg-muted transition-colors"
                >
                  <div className="font-medium text-foreground">{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.category}</div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {pinned.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Pinned
          </div>
          <div className="flex flex-col gap-1">
            {pinned.map((report) => (
              <Link
                key={report.id}
                href={buildReportHrefV2({
                  tab: report.tab,
                  subTab: report.subTab ?? null,
                  dateRange: report.dateRange,
                  filters: report.filters,
                })}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm text-foreground hover:bg-muted"
              >
                <span className="truncate">{report.name}</span>
                <Star className="h-3.5 w-3.5 text-primary" />
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Categories
        </div>
        <div className="flex flex-col gap-1">
          {reportCatalogV2.map((category) => {
            const isActive = activeTab === category.id;
            const href = buildReportHrefV2({ tab: category.id, dateRange, filters });
            return (
              <Link key={category.id} href={href}>
                <Button
                  variant={isActive ? "outline" : "ghost"}
                  size="sm"
                  className={cn(
                    "w-full justify-start",
                    isActive && "border-primary/30 text-primary",
                  )}
                >
                  {category.label}
                </Button>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Shortcuts
        </div>
        <div className="flex flex-col gap-1">
          <Link href="/reports-v2/saved">
            <Button
              variant={isSavedActive ? "outline" : "ghost"}
              size="sm"
              className="w-full justify-start"
            >
              Saved reports
            </Button>
          </Link>
          <Link href="/reports-v2/portfolio">
            <Button
              variant={isPortfolioActive ? "outline" : "ghost"}
              size="sm"
              className="w-full justify-start"
            >
              Portfolio
            </Button>
          </Link>
          <Link href="/reports-v2/devices">
            <Button
              variant={isDevicesActive ? "outline" : "ghost"}
              size="sm"
              className="w-full justify-start"
            >
              Devices
            </Button>
          </Link>
          <Link href="/reports-v2/audit">
            <Button
              variant={isAuditActive ? "outline" : "ghost"}
              size="sm"
              className="w-full justify-start"
            >
              Audit log
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
