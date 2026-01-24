"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ReportSection } from "@/components/reports-v2/ReportPanels";
import { ReportsV2Shell } from "@/components/reports-v2/ReportsV2Shell";
import { ReportsV2PageHeader } from "@/components/reports-v2/ReportsV2PageHeader";
import {
  deleteReport,
  listSavedReports,
  togglePinnedReport,
  type SavedReport,
} from "@/components/reports/savedReports";
import { buildReportHrefV2 } from "@/lib/report-links-v2";
import { useMenuConfig } from "@/hooks/use-menu-config";
import { Pin, PinOff, Play, Trash2 } from "lucide-react";

export default function ReportsV2SavedPage() {
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [reports, setReports] = useState<SavedReport[]>([]);
  const { pinPage, unpinPage } = useMenuConfig();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("campreserv:selectedCampground");
    setCampgroundId(stored);
    setReports(listSavedReports(stored));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter(
      (r) =>
        !q ||
        r.name.toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q) ||
        r.tab.toLowerCase().includes(q) ||
        (r.subTab || "").toLowerCase().includes(q),
    );
  }, [reports, search]);

  const buildHref = (report: SavedReport) =>
    buildReportHrefV2({
      tab: report.tab,
      subTab: report.subTab ?? null,
      dateRange: report.dateRange,
      filters: report.filters,
    });

  return (
    <DashboardShell>
      <div className="space-y-5">
        <Breadcrumbs items={[{ label: "Reports v2", href: "/reports-v2" }, { label: "Saved" }]} />
        <ReportsV2Shell
          activeTab={null}
          activeSubTab={null}
          activeShortcut="saved"
          pinnedReports={reports.filter((r) => r.pinned)}
        >
          <ReportsV2PageHeader
            title="Saved reports"
            description="All saved report views with filters, date range, and grouping preserved."
            actions={
              <Input
                className="w-72"
                placeholder="Search saved reports"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search saved reports"
              />
            }
          />

          <ReportSection
            title="Saved views"
            description={`${filtered.length} saved report${filtered.length === 1 ? "" : "s"} available.`}
          >
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-10 text-center text-sm text-muted-foreground">
                No saved reports yet. Save a report view to keep quick access.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filtered.map((report) => (
                  <div
                    key={report.id}
                    className="rounded-2xl border border-border bg-card px-4 py-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="text-base font-semibold text-foreground">
                            {report.name}
                          </div>
                          {report.pinned && <Badge variant="secondary">Pinned</Badge>}
                        </div>
                        {report.description && (
                          <p className="text-sm text-muted-foreground">{report.description}</p>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {report.tab}
                          {report.subTab ? ` / ${report.subTab}` : ""} · {report.dateRange?.start}{" "}
                          to {report.dateRange?.end}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={buildReportHrefV2({
                            tab: report.tab,
                            subTab: report.subTab ?? null,
                            dateRange: report.dateRange,
                            filters: report.filters,
                          })}
                        >
                          <Button size="sm" className="gap-1">
                            <Play className="h-4 w-4" /> Run
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => {
                            const nextPinned = !report.pinned;
                            const href = buildHref(report);
                            togglePinnedReport(report.id, nextPinned);
                            if (nextPinned) {
                              pinPage(href);
                            } else {
                              unpinPage(href);
                            }
                            setReports(listSavedReports(campgroundId));
                          }}
                        >
                          {report.pinned ? (
                            <PinOff className="h-4 w-4" />
                          ) : (
                            <Pin className="h-4 w-4" />
                          )}
                          {report.pinned ? "Unpin" : "Pin"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            if (report.pinned) {
                              unpinPage(buildHref(report));
                            }
                            deleteReport(report.id);
                            setReports(listSavedReports(campgroundId));
                          }}
                          aria-label={`Delete saved report ${report.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ReportSection>
        </ReportsV2Shell>
      </div>
    </DashboardShell>
  );
}
