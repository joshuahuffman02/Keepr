"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listSavedReports, deleteReport } from "@/components/reports/savedReports";
import Link from "next/link";
import { Trash2, Play, RotateCcw, RefreshCw } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/components/ui/use-toast";
import { ReportsNavBar } from "@/components/reports/ReportsNavBar";
import { buildReportHref } from "@/lib/report-links";

export default function SavedReportsPage() {
  const pathname = usePathname();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [reports, setReports] = useState(() => listSavedReports());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("campreserv:selectedCampground");
    setCampgroundId(stored);
    setReports(listSavedReports(stored));
  }, []);

  const exportsQuery = useQuery({
    queryKey: ["report-exports", campgroundId],
    queryFn: () => apiClient.listReportExports(campgroundId!, 15),
    enabled: !!campgroundId
  });

  const queueExport = useMutation({
    mutationFn: () => apiClient.queueReportExport(campgroundId!, { filters: { range: "last_30_days", tab: "overview" } }),
    onSuccess: () => {
      toast({ title: "Export queued" });
      qc.invalidateQueries({ queryKey: ["report-exports", campgroundId] });
    },
    onError: (err: any) => toast({ title: "Queue failed", description: err?.message ?? "Unknown error", variant: "destructive" })
  });

  const rerunExport = useMutation({
    mutationFn: (id: string) => apiClient.rerunReportExport(campgroundId!, id),
    onSuccess: () => {
      toast({ title: "Export re-run" });
      qc.invalidateQueries({ queryKey: ["report-exports", campgroundId] });
    },
    onError: (err: any) => toast({ title: "Re-run failed", description: err?.message ?? "Unknown error", variant: "destructive" })
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) =>
      !q ||
      r.name.toLowerCase().includes(q) ||
      (r.description || "").toLowerCase().includes(q) ||
      r.tab.toLowerCase().includes(q) ||
      (r.subTab || "").toLowerCase().includes(q)
    );
  }, [reports, search]);

  const reportNavLinks = [
    { label: "Saved", href: "/reports/saved", active: pathname === "/reports/saved" },
    { label: "Portfolio", href: "/reports/portfolio", active: pathname.startsWith("/reports/portfolio") },
    { label: "Devices", href: "/reports/devices", active: pathname.startsWith("/reports/devices") }
  ];

  return (
    <DashboardShell>
      <div className="space-y-4">
        <Breadcrumbs items={[{ label: "Reports", href: "/reports" }, { label: "Saved" }]} />
        <ReportsNavBar activeTab={null} extraLinks={reportNavLinks} />
        <div className="rounded-xl border border-border bg-card shadow-sm p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold text-foreground">Saved reports</h1>
              <p className="text-muted-foreground text-sm">Your favorite report views by tab/sub-report.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="Search saved reports..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64"
                aria-label="Search saved reports"
              />
              <Button variant="outline" onClick={() => setReports(listSavedReports(campgroundId))}>Refresh</Button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground">No saved reports yet. Use “Save report” from the Reports page.</div>
          ) : (
            <div className="grid gap-3">
              {filtered.map((r) => (
                <Card key={r.id} className="border-border">
                  <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-foreground">{r.name}</CardTitle>
                        <Badge variant="secondary">{r.tab}</Badge>
                        {r.subTab && <Badge variant="outline">{r.subTab}</Badge>}
                      </div>
                      {r.description && <CardDescription>{r.description}</CardDescription>}
                      <div className="text-xs text-muted-foreground">
                        Saved {new Date(r.updatedAt).toLocaleString()}
                        {r.dateRange && ` • ${r.dateRange.start} → ${r.dateRange.end}`}
                      </div>
                      {r.filters && (r.filters.status !== "all" || r.filters.siteType !== "all" || r.filters.groupBy !== "none") && (
                        <div className="flex items-center gap-1 flex-wrap mt-1">
                          {r.filters.status !== "all" && (
                            <span className="text-xs px-2 py-0.5 rounded bg-status-info/15 text-status-info">
                              {r.filters.status}
                            </span>
                          )}
                          {r.filters.siteType !== "all" && (
                            <span className="text-xs px-2 py-0.5 rounded bg-status-success/15 text-status-success">
                              {r.filters.siteType}
                            </span>
                          )}
                          {r.filters.groupBy !== "none" && (
                            <span className="text-xs px-2 py-0.5 rounded bg-status-warning/15 text-status-warning">
                              Grouped by {r.filters.groupBy}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={buildReportHref({
                        tab: r.tab,
                        subTab: r.subTab ?? null,
                        dateRange: r.dateRange,
                        filters: r.filters
                      })}>
                        <Button size="sm" className="gap-1">
                          <Play className="h-4 w-4" /> Run
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          deleteReport(r.id);
                          setReports(listSavedReports(campgroundId));
                        }}
                        aria-label={`Delete saved report ${r.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Card className="border-border">
          <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div className="space-y-1">
              <CardTitle className="text-foreground">Recent exports</CardTitle>
              <CardDescription>Exports are scoped per campground with filters captured for auditing.</CardDescription>
            </div>
            <Button
              size="sm"
              className="gap-1"
              disabled={!campgroundId || queueExport.isPending}
              onClick={() => queueExport.mutate()}
            >
              <RefreshCw className="h-4 w-4" /> Queue export
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {!campgroundId && <div className="text-sm text-muted-foreground">Select a campground to view exports.</div>}
            {campgroundId && exportsQuery.isLoading && <div className="text-sm text-muted-foreground">Loading exports...</div>}
            {campgroundId && !exportsQuery.isLoading && (exportsQuery.data?.length ?? 0) === 0 && (
              <div className="text-sm text-muted-foreground">No exports yet for this campground.</div>
            )}
            {campgroundId && (exportsQuery.data ?? []).map((exp) => (
              <div key={exp.id} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{exp.resource || "reports"}</span>
                      <Badge variant={exp.status === "success" ? "default" : exp.status === "failed" ? "destructive" : "secondary"}>
                        {exp.status}
                      </Badge>
                      {exp.location && <Badge variant="outline">{exp.location}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Requested {new Date(exp.createdAt || "").toLocaleString()} {exp.completedAt ? `• Completed ${new Date(exp.completedAt).toLocaleString()}` : ""}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    disabled={rerunExport.isPending}
                    onClick={() => rerunExport.mutate(exp.id)}
                  >
                    <RotateCcw className="h-4 w-4" /> Re-run
                  </Button>
                </div>
                {exp.filters && (
                  <pre className="bg-muted text-xs text-foreground rounded-md p-2 overflow-x-auto">
                    {JSON.stringify(exp.filters, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
