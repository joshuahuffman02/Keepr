"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ReportsV2Shell } from "@/components/reports-v2/ReportsV2Shell";
import { ReportsV2PageHeader } from "@/components/reports-v2/ReportsV2PageHeader";
import { ReportSection } from "@/components/reports-v2/ReportPanels";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import { listSavedReports, type SavedReport } from "@/components/reports/savedReports";

export default function ReportsV2AuditPage() {
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("campreserv:selectedCampground");
    setCampgroundId(stored);
    setSavedReports(listSavedReports(stored));
  }, []);

  const auditQuery = useQuery({
    queryKey: ["audit-log", campgroundId, actionFilter, start, end],
    queryFn: () => apiClient.getAuditLogs(campgroundId!, {
      action: actionFilter === "all" ? undefined : actionFilter,
      start: start || undefined,
      end: end || undefined,
      limit: 200
    }),
    enabled: !!campgroundId
  });

  const actions = useMemo(() => {
    const set = new Set<string>();
    auditQuery.data?.forEach((row) => set.add(row.action));
    return Array.from(set).sort();
  }, [auditQuery.data]);

  const entities = useMemo(() => {
    const set = new Set<string>();
    auditQuery.data?.forEach((row) => set.add(row.entity));
    return Array.from(set).sort();
  }, [auditQuery.data]);

  const rows = useMemo(() => {
    let filtered = auditQuery.data || [];
    if (entityFilter !== "all") {
      filtered = filtered.filter((row) => row.entity === entityFilter);
    }
    return filtered;
  }, [auditQuery.data, entityFilter]);

  return (
    <DashboardShell>
      <div className="space-y-5">
        <Breadcrumbs items={[{ label: "Reports v2", href: "/reports-v2" }, { label: "Audit" }]} />
        <ReportsV2Shell activeTab={null} activeSubTab={null} activeShortcut="audit" pinnedReports={savedReports.filter((r) => r.pinned)}>
          <ReportsV2PageHeader
            title="Audit log"
            description="Track staff actions, configuration changes, and system events."
          />

          {!campgroundId && (
            <div className="rounded-2xl border border-status-warning/30 bg-status-warning/10 px-4 py-3 text-sm text-status-warning">
              Select a campground from the sidebar to load audit history.
            </div>
          )}

          {campgroundId && (
            <>
              <ReportSection title="Filters" description="Refine the audit log to a specific action, entity, or date range.">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                      className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
                      aria-label="Start date"
                    />
                    <span className="text-xs text-muted-foreground">to</span>
                    <input
                      type="date"
                      value={end}
                      onChange={(e) => setEnd(e.target.value)}
                      className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
                      aria-label="End date"
                    />
                  </div>
                  <Select value={actionFilter} onValueChange={setActionFilter}>
                    <SelectTrigger className="w-48" aria-label="Action filter">
                      <SelectValue placeholder="Action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All actions</SelectItem>
                      {actions.map((action) => (
                        <SelectItem key={action} value={action}>{action}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={entityFilter} onValueChange={setEntityFilter}>
                    <SelectTrigger className="w-48" aria-label="Entity filter">
                      <SelectValue placeholder="Entity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All entities</SelectItem>
                      {entities.map((entity) => (
                        <SelectItem key={entity} value={entity}>{entity}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => auditQuery.refetch()}
                    disabled={auditQuery.isFetching}
                  >
                    {auditQuery.isFetching ? "Refreshing..." : "Refresh"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!campgroundId) return;
                      const q = new URLSearchParams();
                      if (actionFilter !== "all") q.set("action", actionFilter);
                      if (start) q.set("start", start);
                      if (end) q.set("end", end);
                      q.set("format", "csv");
                      window.open(`/api-proxy/campgrounds/${campgroundId}/audit?${q.toString()}`, "_blank");
                    }}
                  >
                    Export CSV
                  </Button>
                </div>
              </ReportSection>

              <ReportSection title="Audit activity" description={`Showing ${rows.length} entries`}>
                {auditQuery.isError && (
                  <div role="alert" className="rounded-md border border-status-error/30 bg-status-error/10 px-3 py-2 text-sm text-status-error">
                    Failed to load audit log entries. Please try again.
                  </div>
                )}
                <div className="overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-border text-left text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Time</th>
                        <th className="px-3 py-2">Action</th>
                        <th className="px-3 py-2">Entity</th>
                        <th className="px-3 py-2">Actor</th>
                        <th className="px-3 py-2">Details</th>
                        <th className="px-3 py-2">IP</th>
                        <th className="px-3 py-2">User agent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditQuery.isLoading ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-4 text-sm text-muted-foreground">Loading...</td>
                        </tr>
                      ) : rows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-4 text-sm text-muted-foreground">No audit entries yet.</td>
                        </tr>
                      ) : (
                        rows.map((row) => (
                          <tr key={row.id} className="border-b border-border">
                            <td className="px-3 py-2 text-foreground whitespace-nowrap">{new Date(row.createdAt).toLocaleString()}</td>
                            <td className="px-3 py-2">
                              <Badge variant="secondary">{row.action}</Badge>
                            </td>
                            <td className="px-3 py-2 text-foreground">
                              {row.entity}:{row.entityId.slice(0, 6)}
                            </td>
                            <td className="px-3 py-2 text-foreground">
                              {row.actor ? `${row.actor.firstName ?? ""} ${row.actor.lastName ?? ""}`.trim() || row.actor.email : "System"}
                            </td>
                            <td className="px-3 py-2 text-foreground">
                              {row.before || row.after ? "Change" : "—"}
                            </td>
                            <td className="px-3 py-2 text-foreground">{row.ip || "—"}</td>
                            <td className="px-3 py-2 text-foreground max-w-xs truncate" title={row.userAgent || undefined}>
                              {row.userAgent || "—"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </ReportSection>
            </>
          )}
        </ReportsV2Shell>
      </div>
    </DashboardShell>
  );
}
