"use client";

import { useState, useEffect, useMemo } from "react";
import { History, User, Settings, Database, Search, Filter, RefreshCw } from "lucide-react";

type AuditEntry = {
  id: string;
  createdAt: string;
  userEmail: string | null;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  details: string | null;
  ipAddress: string | null;
};

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("campreserv:authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const actionColors: Record<string, string> = {
  CREATE: "bg-status-success/15 text-status-success",
  UPDATE: "bg-status-info/15 text-status-info",
  DELETE: "bg-status-error/15 text-status-error",
  LOGIN: "bg-purple-500/20 text-purple-400",
  LOGOUT: "bg-muted0/20 text-muted-foreground",
  SYNC: "bg-cyan-500/20 text-cyan-400",
  EXPORT: "bg-status-warning/15 text-status-warning",
  IMPORT: "bg-teal-500/20 text-teal-400",
};

const resourceIcons: Record<string, typeof User> = {
  Campground: Database,
  User: User,
  Reservation: History,
  Settings: Settings,
};

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [resourceFilter, setResourceFilter] = useState<string>("all");

  const loadAuditLog = async () => {
    setLoading(true);
    setError(null);
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE || "";
      const params = new URLSearchParams({ limit: "100" });
      if (actionFilter !== "all") params.set("action", actionFilter);
      if (resourceFilter !== "all") params.set("resource", resourceFilter);

      const res = await fetch(`${base}/admin/audit?${params}`, {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`Failed to load audit log (${res.status})`);
      const data = await res.json();
      setEntries(Array.isArray(data.items) ? data.items : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLog();
  }, [actionFilter, resourceFilter]);

  const filtered = useMemo(() => {
    return entries.filter((entry) => {
      if (search) {
        const q = search.toLowerCase();
        return (
          entry.userEmail?.toLowerCase().includes(q) ||
          entry.details?.toLowerCase().includes(q) ||
          entry.resource.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [search, entries]);

  const actions = ["CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "SYNC", "EXPORT", "IMPORT"];
  const resources = [...new Set(entries.map((e) => e.resource))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
          <p className="text-muted-foreground mt-1">Track all admin actions and system events</p>
        </div>
        <button
          onClick={loadAuditLog}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-muted text-muted-foreground border border-border rounded-lg hover:bg-muted disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by user, action, or details..."
            className="w-full pl-10 pr-4 py-2 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select
            value={resourceFilter}
            onChange={(e) => setResourceFilter(e.target.value)}
            className="px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Resources</option>
            {resources.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-status-error/15 border border-status-error/30 rounded-lg p-4 text-status-error">
          {error}
        </div>
      )}

      {/* Log Entries */}
      <div className="bg-muted rounded-lg border border-border overflow-hidden">
        <div className="divide-y divide-border">
          {loading && entries.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">Loading audit log...</div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">No audit entries found</div>
          )}
          {filtered.map((entry) => {
            const Icon = resourceIcons[entry.resource] || History;
            return (
              <div key={entry.id} className="p-4 hover:bg-muted transition-colors">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-muted rounded-lg">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded ${actionColors[entry.action] || "bg-muted text-muted-foreground"}`}
                      >
                        {entry.action}
                      </span>
                      <span className="text-foreground font-medium">{entry.resource}</span>
                      {entry.resourceId && (
                        <span className="text-muted-foreground text-sm font-mono">
                          {entry.resourceId}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {entry.details || "No details"}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                      <span>by {entry.userEmail || entry.userId || "system"}</span>
                      <span>{new Date(entry.createdAt).toLocaleString()}</span>
                      {entry.ipAddress && <span>IP: {entry.ipAddress}</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-sm text-muted-foreground text-center">
        Showing {filtered.length} entries
      </div>
    </div>
  );
}
