"use client";

import { useState, useEffect } from "react";
import { listSavedReports, deleteReport, type SavedReport } from "./savedReports";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ChevronDown, Clock, Trash2, BookmarkCheck } from "lucide-react";
import Link from "next/link";
import { buildReportHref } from "@/lib/report-links";

interface SavedReportsDropdownProps {
  campgroundId: string | null;
  onLoadReport?: (report: SavedReport) => void;
}

export function SavedReportsDropdown({ campgroundId, onLoadReport }: SavedReportsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reports, setReports] = useState<SavedReport[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = listSavedReports(campgroundId);
    setReports(saved.slice(0, 5)); // Show only 5 most recent
  }, [campgroundId, isOpen]); // Refresh when dropdown opens

  const handleDelete = (e: React.MouseEvent, reportId: string) => {
    e.preventDefault();
    e.stopPropagation();
    deleteReport(reportId);
    setReports(listSavedReports(campgroundId).slice(0, 5));
  };

  const handleLoadReport = (report: SavedReport) => {
    setIsOpen(false);
    onLoadReport?.(report);
  };

  if (!campgroundId) return null;

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2"
      >
        <BookmarkCheck className="h-4 w-4" />
        Quick Load
        <ChevronDown className="h-3 w-3" />
        {reports.length > 0 && (
          <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
            {reports.length}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-96 bg-card rounded-lg border border-border shadow-lg z-50">
            <div className="p-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-foreground text-sm">Recent Saved Reports</span>
                </div>
                <Link href="/reports/saved" onClick={() => setIsOpen(false)}>
                  <span className="text-xs text-indigo-600 hover:text-indigo-700 hover:underline">
                    View all
                  </span>
                </Link>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {reports.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No saved reports yet. Save your current configuration to get started.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {reports.map((report) => {
                    const url = buildReportHref({
                      tab: report.tab,
                      subTab: report.subTab ?? null,
                      dateRange: report.dateRange,
                      filters: report.filters,
                    });

                    return (
                      <div key={report.id} className="p-3 hover:bg-muted transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={url}
                            className="flex-1 min-w-0"
                            onClick={() => handleLoadReport(report)}
                          >
                            <div className="space-y-1">
                              <div className="font-medium text-foreground text-sm truncate">
                                {report.name}
                              </div>
                              {report.description && (
                                <div className="text-xs text-muted-foreground truncate">
                                  {report.description}
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge variant="secondary" className="text-xs">
                                  {report.tab}
                                </Badge>
                                {report.subTab && (
                                  <Badge variant="outline" className="text-xs">
                                    {report.subTab}
                                  </Badge>
                                )}
                                {report.dateRange && (
                                  <span className="text-xs text-muted-foreground">
                                    {report.dateRange.start} → {report.dateRange.end}
                                  </span>
                                )}
                              </div>
                              {report.filters && (
                                <div className="flex items-center gap-1 flex-wrap">
                                  {report.filters.status !== "all" && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-status-info-bg text-status-info-text">
                                      {report.filters.status}
                                    </span>
                                  )}
                                  {report.filters.siteType !== "all" && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-status-success-bg text-status-success-text">
                                      {report.filters.siteType}
                                    </span>
                                  )}
                                  {report.filters.groupBy !== "none" && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-status-warning-bg text-status-warning-text">
                                      {report.filters.groupBy}
                                    </span>
                                  )}
                                </div>
                              )}
                              <div className="text-xs text-muted-foreground">
                                Saved {new Date(report.updatedAt).toLocaleDateString()}
                              </div>
                            </div>
                          </Link>
                          <button
                            onClick={(e) => handleDelete(e, report.id)}
                            className="p-1 hover:bg-rose-50 rounded text-rose-600 hover:text-rose-700 transition-colors flex-shrink-0"
                            title="Delete saved report"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {reports.length > 0 && (
              <div className="p-2 border-t border-border bg-muted">
                <Link href="/reports/saved" onClick={() => setIsOpen(false)}>
                  <Button variant="ghost" size="sm" className="w-full text-xs">
                    View all saved reports ({listSavedReports(campgroundId).length})
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
