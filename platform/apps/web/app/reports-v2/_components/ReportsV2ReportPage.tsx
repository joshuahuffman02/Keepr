"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { useReportExport } from "@/components/reports/useReportExport";
import { ExportDialog } from "@/components/reports/ExportDialog";
import type { ExportFormat } from "@/lib/export-utils";
import { ReportsV2Shell } from "@/components/reports-v2/ReportsV2Shell";
import { ReportsV2Header } from "@/components/reports-v2/ReportsV2Header";
import { ReportsV2SubNav } from "@/components/reports-v2/ReportsV2SubNav";
import {
  ReportsV2FiltersSheet,
  type ReportsV2Filters,
} from "@/components/reports-v2/ReportsV2FiltersSheet";
import { SaveReportDialogV2 } from "@/components/reports-v2/SaveReportDialogV2";
import { ReportRendererV2 } from "@/components/reports-v2/ReportRendererV2";
import { listSavedReports } from "@/components/reports/savedReports";
import { getReportMetaV2, type ReportTabV2 } from "@/lib/report-registry-v2";
import {
  buildReportHrefV2,
  buildReportQueryV2,
  normalizeReportSelectionV2,
} from "@/lib/report-links-v2";

const DEFAULT_FILTERS: ReportsV2Filters = {
  status: "all",
  siteType: "all",
  groupBy: "none",
};

const isStatusFilter = (value: string | null): value is ReportsV2Filters["status"] =>
  value === "all" ||
  value === "confirmed" ||
  value === "checked_in" ||
  value === "pending" ||
  value === "cancelled";

const isGroupByFilter = (value: string | null): value is ReportsV2Filters["groupBy"] =>
  value === "none" ||
  value === "site" ||
  value === "status" ||
  value === "date" ||
  value === "siteType";

export function ReportsV2ReportPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const rawTab = typeof params?.tab === "string" ? params.tab : "overview";
  const rawSub = typeof params?.sub === "string" ? params.sub : null;
  const normalized = normalizeReportSelectionV2(rawTab, rawSub) || {
    tab: "overview",
    subTab: null,
  };

  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  });
  const [filters, setFilters] = useState<ReportsV2Filters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [live, setLive] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [savedReports, setSavedReports] = useState(() => listSavedReports());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("campreserv:selectedCampground");
    setCampgroundId(stored);
    setSavedReports(listSavedReports(stored));
  }, []);

  const { exportReport } = useReportExport(campgroundId, dateRange);

  useEffect(() => {
    if (!searchParams) return;
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const status = searchParams.get("status");
    const siteType = searchParams.get("siteType");
    const groupBy = searchParams.get("groupBy");

    if (start || end) {
      setDateRange((prev) => ({
        start: start || prev.start,
        end: end || prev.end,
      }));
    }

    if (status || siteType || groupBy) {
      setFilters((prev) => ({
        status: isStatusFilter(status) ? status : prev.status,
        siteType: siteType || prev.siteType,
        groupBy: isGroupByFilter(groupBy) ? groupBy : prev.groupBy,
      }));
    }
    setIsReady(true);
  }, [searchParams]);

  useEffect(() => {
    if (!isReady) return;
    const currentQuery = buildReportQueryV2({ dateRange, filters });
    const desired = buildReportHrefV2({
      tab: normalized.tab,
      subTab: normalized.subTab,
      dateRange,
      filters,
    });
    const current = `${pathname}${currentQuery}`;
    if (current !== desired) {
      router.replace(desired);
    }
  }, [dateRange, filters, isReady, normalized.tab, normalized.subTab, pathname, router]);

  useEffect(() => {
    if (!campgroundId) return;
    setLastUpdatedAt(new Date());
  }, [campgroundId]);

  useEffect(() => {
    if (!live || !campgroundId) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) && query.queryKey.includes(campgroundId),
      });
      setLastUpdatedAt(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, [live, campgroundId, queryClient]);

  const handleRefresh = () => {
    if (!campgroundId) return;
    queryClient.invalidateQueries({
      predicate: (query) => Array.isArray(query.queryKey) && query.queryKey.includes(campgroundId),
    });
    setLastUpdatedAt(new Date());
  };

  const { reportLabel, description } = getReportMetaV2(normalized.tab, normalized.subTab);

  const pinnedReports = useMemo(() => savedReports.filter((r) => r.pinned), [savedReports]);

  return (
    <DashboardShell>
      <div className="space-y-5">
        <Breadcrumbs
          items={[{ label: "Reports v2", href: "/reports-v2" }, { label: reportLabel }]}
        />

        <ReportsV2Shell
          activeTab={normalized.tab}
          activeSubTab={normalized.subTab}
          dateRange={dateRange}
          filters={filters}
          pinnedReports={pinnedReports}
        >
          <ReportsV2Header
            title={reportLabel}
            description={description}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            live={live}
            onToggleLive={setLive}
            lastUpdatedAt={lastUpdatedAt}
            onRefresh={handleRefresh}
            onOpenFilters={() => setShowFilters(true)}
            onSave={() => setShowSaveDialog(true)}
            onExport={() => setShowExportDialog(true)}
          />

          <ReportsV2SubNav
            tab={normalized.tab}
            activeSubTab={normalized.subTab}
            dateRange={dateRange}
            filters={filters}
          />

          {!campgroundId && (
            <div className="rounded-2xl border border-status-warning/30 bg-status-warning/10 px-4 py-3 text-sm text-status-warning">
              Select a campground from the sidebar to load reports.
            </div>
          )}

          {campgroundId && (
            <ReportRendererV2
              tab={normalized.tab}
              subTab={normalized.subTab}
              campgroundId={campgroundId}
              dateRange={dateRange}
              reportFilters={filters}
            />
          )}
        </ReportsV2Shell>
      </div>

      <ReportsV2FiltersSheet
        open={showFilters}
        onOpenChange={setShowFilters}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        filters={filters}
        onFiltersChange={setFilters}
      />

      {campgroundId && (
        <SaveReportDialogV2
          open={showSaveDialog}
          onOpenChange={setShowSaveDialog}
          reportConfig={{
            tab: normalized.tab,
            subTab: normalized.subTab,
            dateRange,
            filters,
            campgroundId,
          }}
          onSaved={() => setSavedReports(listSavedReports(campgroundId))}
        />
      )}

      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        exportPreview={
          campgroundId
            ? {
                reportName: reportLabel,
                subReportName: normalized.subTab,
                dateRange,
                rowCount: 0,
                tabName: normalized.tab,
              }
            : null
        }
        onExport={(format: ExportFormat) => {
          exportReport(normalized.tab, normalized.subTab, format);
        }}
      />
    </DashboardShell>
  );
}
