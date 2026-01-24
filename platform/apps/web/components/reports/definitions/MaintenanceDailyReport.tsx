import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Wrench } from "lucide-react";
import Link from "next/link";

interface MaintenanceDailyReportProps {
  campgroundId: string;
  dateRange: { start: string; end: string };
}

export function MaintenanceDailyReport({ campgroundId, dateRange }: MaintenanceDailyReportProps) {
  // Determine status filter based on what "Daily" implies.
  // Daily report usually focuses on "What needs to be done today" or "What was done today".
  // Let's fetch all active tickets (open, in_progress) and those resolved recently?
  // The API signature is (status?, campgroundId?).
  // If we pass status, we only get one type.
  // Use `undefined` to fetch all and filter locally for flexibility.
  const { data: tickets, isLoading } = useQuery({
    queryKey: ["maintenance", campgroundId],
    queryFn: () => apiClient.getMaintenanceTickets(undefined, campgroundId),
  });

  const { data: sites } = useQuery({
    queryKey: ["sites", campgroundId],
    queryFn: () => apiClient.getSites(campgroundId),
  });

  const reportData = useMemo(() => {
    if (!tickets) return { active: [], completed: [] };

    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    end.setHours(23, 59, 59, 999);

    // Filter:
    // 1. Active: status != 'closed'
    // 2. Completed: status == 'closed' AND resolvedAt/updatedAt in range

    const active = tickets.filter((t) => t.status !== "closed");
    const completed = tickets.filter((t) => {
      if (t.status !== "closed") return false;
      // resolvedAt check
      const date = t.resolvedAt
        ? new Date(t.resolvedAt)
        : new Date(t.updatedAt || t.createdAt || new Date());
      return date >= start && date <= end;
    });

    return {
      active: active.sort((a, b) => {
        const dateB = b.priority === "high" ? "2099-01-01" : b.createdAt || new Date();
        const dateA = a.priority === "high" ? "2099-01-01" : a.createdAt || new Date();
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      }),
      completed: completed.sort((a, b) => {
        const dateB = b.resolvedAt || b.updatedAt || b.createdAt || new Date();
        const dateA = a.resolvedAt || a.updatedAt || a.createdAt || new Date();
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      }),
    };
  }, [tickets, dateRange]);

  const getSiteName = (siteId: string | null | undefined) => {
    if (!siteId) return "General / Building";
    return sites?.find((s) => s.id === siteId)?.name ?? "Unknown Site";
  };

  const formatDateValue = (value: string | null | undefined) =>
    format(new Date(value ?? Date.now()), "MMM d");

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading maintenance requests...</div>;
  }

  if (!tickets) {
    return <div className="text-sm text-muted-foreground">No maintenance tickets found.</div>;
  }

  return (
    <div className="space-y-8">
      {/* Active Tickets Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Open Tickets (Backlog)</h2>
            <p className="text-sm text-muted-foreground">
              {reportData.active.length} active issues requiring attention
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-muted text-xs uppercase font-semibold text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Issue</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Assigned To</th>
                  <th className="px-4 py-3">Reported</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reportData.active.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No open tickets. Good job!
                    </td>
                  </tr>
                ) : (
                  reportData.active.map((t) => (
                    <tr key={t.id} className="hover:bg-muted group transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <Wrench className="w-4 h-4 text-muted-foreground" />
                          {t.title}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                        {getSiteName(t.siteId)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            t.priority === "high" || t.priority === "critical"
                              ? "destructive"
                              : t.priority === "medium"
                                ? "secondary"
                                : "outline"
                          }
                          className="capitalize"
                        >
                          {t.priority}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {t.assignedTo || (
                          <span className="text-muted-foreground italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateValue(t.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/maintenance/${t.id}`}
                          className="text-emerald-600 hover:text-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-1"
                        >
                          View <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Completed Tickets Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Completed (Selected Period)</h2>
            <p className="text-sm text-muted-foreground">
              {reportData.completed.length} issues resolved between {dateRange.start} and{" "}
              {dateRange.end}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/50 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-muted text-xs uppercase font-semibold text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Issue</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Resolved By</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reportData.completed.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      No resolved tickets in this period.
                    </td>
                  </tr>
                ) : (
                  reportData.completed.map((t) => (
                    <tr key={t.id} className="hover:bg-muted">
                      <td className="px-4 py-3 font-medium text-foreground line-through decoration-slate-400">
                        {t.title}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                        {getSiteName(t.siteId)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{t.assignedTo || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateValue(t.resolvedAt || t.updatedAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
