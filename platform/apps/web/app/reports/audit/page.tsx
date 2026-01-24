"use client";

import { useEffect, useMemo as useReactMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { DashboardShell } from "../../../components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { apiClient } from "@/lib/api-client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ReportsNavBar } from "@/components/reports/ReportsNavBar";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

export default function AuditLogPage() {
  const pathname = usePathname();
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("campreserv:selectedCampground");
    if (stored) setCampgroundId(stored);
  }, []);

  const auditQuery = useQuery({
    queryKey: ["audit-log", campgroundId, actionFilter],
    queryFn: () =>
      apiClient.getAuditLogs(campgroundId!, {
        action: actionFilter === "all" ? undefined : actionFilter,
        start: start || undefined,
        end: end || undefined,
        limit: 200,
      }),
    enabled: !!campgroundId,
  });

  const actions = useReactMemo(() => {
    const set = new Set<string>();
    auditQuery.data?.forEach((row) => set.add(row.action));
    return Array.from(set).sort();
  }, [auditQuery.data]);

  const entities = useReactMemo(() => {
    const set = new Set<string>();
    auditQuery.data?.forEach((row) => set.add(row.entity));
    return Array.from(set).sort();
  }, [auditQuery.data]);

  const rows = useReactMemo(() => {
    let filtered = auditQuery.data || [];
    if (entityFilter !== "all") {
      filtered = filtered.filter((row) => row.entity === entityFilter);
    }
    return filtered;
  }, [auditQuery.data, entityFilter]);

  const reportNavLinks = [
    { label: "Saved", href: "/reports/saved", active: pathname === "/reports/saved" },
    {
      label: "Portfolio",
      href: "/reports/portfolio",
      active: pathname.startsWith("/reports/portfolio"),
    },
    { label: "Devices", href: "/reports/devices", active: pathname.startsWith("/reports/devices") },
  ];

  const formatDiff = (before: unknown, after: unknown) => {
    const beforeRecord = isRecord(before) ? before : null;
    const afterRecord = isRecord(after) ? after : null;
    if (!beforeRecord && !afterRecord) return null;
    const keys = Array.from(
      new Set([
        ...(beforeRecord ? Object.keys(beforeRecord) : []),
        ...(afterRecord ? Object.keys(afterRecord) : []),
      ]),
    );
    if (keys.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {keys.map((key) => {
          const prev = beforeRecord ? beforeRecord[key] : undefined;
          const next = afterRecord ? afterRecord[key] : undefined;
          if (prev === next) return null;
          return (
            <span key={key} className="rounded bg-muted px-2 py-1 border border-border">
              <span className="font-semibold">{key}</span>: {String(prev ?? "—")} →{" "}
              <span className="font-semibold text-emerald-700">{String(next ?? "—")}</span>
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <DashboardShell>
      <div className="space-y-4">
        <Breadcrumbs items={[{ label: "Reports" }, { label: "Audit log" }]} />
        <ReportsNavBar
          activeTab="audits"
          activeSubTab="audit-log"
          dateRange={{ start, end }}
          extraLinks={reportNavLinks}
        />
        <Card>
          <CardContent className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xl font-semibold text-foreground">Audit log</div>
              <div className="text-sm text-muted-foreground">
                Role changes, invites, and future sensitive actions.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="w-40"
                  aria-label="Start date"
                />
                <span className="text-muted-foreground text-xs">to</span>
                <Input
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="w-40"
                  aria-label="End date"
                />
              </div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-48" aria-label="Action filter">
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  {actions.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger className="w-48" aria-label="Entity filter">
                  <SelectValue placeholder="Entity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All entities</SelectItem>
                  {entities.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
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
                  window.open(
                    `/api-proxy/campgrounds/${campgroundId}/audit?${q.toString()}`,
                    "_blank",
                  );
                }}
              >
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>
        {auditQuery.isError && (
          <div
            role="alert"
            className="rounded-md border border-status-error/30 bg-status-error/10 px-3 py-2 text-sm text-status-error"
          >
            Failed to load audit log entries. Please try again.
          </div>
        )}

        <Card>
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Showing {rows.length} entries</div>
          </div>
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
                    <td colSpan={7} className="px-3 py-4 text-sm text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-4 text-sm text-muted-foreground">
                      No audit entries yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-b border-border">
                      <td className="px-3 py-2 text-foreground whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="secondary">{row.action}</Badge>
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        {row.entity}:{row.entityId.slice(0, 6)}
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        {row.actor
                          ? `${row.actor.firstName ?? ""} ${row.actor.lastName ?? ""}`.trim() ||
                            row.actor.email
                          : "System"}
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        {formatDiff(row.before, row.after) ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-foreground">{row.ip || "—"}</td>
                      <td
                        className="px-3 py-2 text-foreground max-w-xs truncate"
                        title={row.userAgent || undefined}
                      >
                        {row.userAgent || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
