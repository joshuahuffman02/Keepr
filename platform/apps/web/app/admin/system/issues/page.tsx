"use client";

import { useState, useEffect } from "react";
import {
  Bug,
  RefreshCw,
  Search,
  Filter,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Circle,
  Eye,
  Plus,
  X,
} from "lucide-react";

type Issue = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

type IssueCounts = {
  statusCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
};

const STATUS_COLUMNS = [
  { key: "backlog", label: "Backlog", icon: Circle, color: "text-muted-foreground" },
  { key: "todo", label: "To Do", icon: Clock, color: "text-blue-400" },
  { key: "in_progress", label: "In Progress", icon: RefreshCw, color: "text-yellow-400" },
  { key: "review", label: "Review", icon: Eye, color: "text-purple-400" },
  { key: "done", label: "Done", icon: CheckCircle2, color: "text-green-400" },
];

const PRIORITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: "bg-red-500/20", text: "text-red-400", label: "Critical" },
  high: { bg: "bg-orange-500/20", text: "text-orange-400", label: "High" },
  medium: { bg: "bg-yellow-500/20", text: "text-yellow-400", label: "Medium" },
  low: { bg: "bg-muted0/20", text: "text-muted-foreground", label: "Low" },
};

const CATEGORY_STYLES: Record<string, { bg: string; text: string }> = {
  database: { bg: "bg-blue-500/20", text: "text-blue-400" },
  frontend: { bg: "bg-purple-500/20", text: "text-purple-400" },
  performance: { bg: "bg-green-500/20", text: "text-green-400" },
  security: { bg: "bg-red-500/20", text: "text-red-400" },
  api: { bg: "bg-cyan-500/20", text: "text-cyan-400" },
  infrastructure: { bg: "bg-amber-500/20", text: "text-amber-400" },
  documentation: { bg: "bg-emerald-500/20", text: "text-emerald-400" },
  other: { bg: "bg-muted0/20", text: "text-muted-foreground" },
};

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("campreserv:authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function IssueCard({
  issue,
  onStatusChange,
}: {
  issue: Issue;
  onStatusChange: (id: string, status: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const priority = PRIORITY_STYLES[issue.priority] || PRIORITY_STYLES.medium;
  const category = CATEGORY_STYLES[issue.category] || {
    bg: "bg-muted0/20",
    text: "text-muted-foreground",
  };

  return (
    <div
      className="bg-muted rounded-lg border border-border p-3 hover:border-border transition-colors cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${priority.text}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground font-medium line-clamp-2">{issue.title}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className={`text-xs px-1.5 py-0.5 rounded ${priority.bg} ${priority.text}`}>
              {priority.label}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${category.bg} ${category.text}`}>
              {issue.category}
            </span>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          {issue.description && (
            <p className="text-xs text-muted-foreground">{issue.description}</p>
          )}
          <div className="flex gap-1 flex-wrap">
            {STATUS_COLUMNS.filter((s) => s.key !== issue.status).map((status) => (
              <button
                key={status.key}
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange(issue.id, status.key);
                }}
                className="text-xs px-2 py-1 bg-muted hover:bg-muted rounded text-muted-foreground transition-colors"
              >
                Move to {status.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KanbanColumn({
  status,
  issues,
  onStatusChange,
}: {
  status: (typeof STATUS_COLUMNS)[0];
  issues: Issue[];
  onStatusChange: (id: string, status: string) => void;
}) {
  const StatusIcon = status.icon;

  return (
    <div className="flex-1 min-w-[280px] max-w-[320px] bg-muted rounded-lg border border-border">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon className={`h-4 w-4 ${status.color}`} />
          <span className="font-medium text-foreground">{status.label}</span>
        </div>
        <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded-full">
          {issues.length}
        </span>
      </div>
      <div className="p-2 space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
        {issues.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No issues</p>
        ) : (
          issues.map((issue) => (
            <IssueCard key={issue.id} issue={issue} onStatusChange={onStatusChange} />
          ))
        )}
      </div>
    </div>
  );
}

export default function IssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [counts, setCounts] = useState<IssueCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE || "";
      const headers = getAuthHeaders();

      const [issuesRes, countsRes] = await Promise.all([
        fetch(`${base}/admin/issues`, { credentials: "include", headers }),
        fetch(`${base}/admin/issues/counts`, { credentials: "include", headers }),
      ]);

      if (!issuesRes.ok) throw new Error(`Failed to load issues (${issuesRes.status})`);
      if (!countsRes.ok) throw new Error(`Failed to load counts (${countsRes.status})`);

      const [issuesData, countsData] = await Promise.all([issuesRes.json(), countsRes.json()]);

      setIssues(Array.isArray(issuesData) ? issuesData : []);
      setCounts(countsData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load issues");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE || "";
      const res = await fetch(`${base}/admin/issues/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update issue");
      const updated = await res.json();
      setIssues((prev) => prev.map((i) => (i.id === id ? updated : i)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update issue");
    }
  };

  const filteredIssues = issues.filter((issue) => {
    if (categoryFilter !== "all" && issue.category !== categoryFilter) return false;
    if (priorityFilter !== "all" && issue.priority !== priorityFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        issue.title.toLowerCase().includes(q) ||
        issue.description?.toLowerCase().includes(q) ||
        issue.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const issuesByStatus = STATUS_COLUMNS.reduce<Record<string, Issue[]>>((acc, status) => {
    acc[status.key] = filteredIssues.filter((i) => i.status === status.key);
    return acc;
  }, {});

  const categories = Array.from(new Set(issues.map((i) => i.category)));
  const totalIssues = issues.length;
  const doneIssues = issues.filter((i) => i.status === "done").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bug className="h-6 w-6 text-blue-400" />
            Issue Tracking
          </h1>
          <p className="text-muted-foreground mt-1">
            Track and manage platform issues and tech debt
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-muted text-muted-foreground border border-border rounded-lg hover:bg-muted disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <div className="text-right">
            <div className="text-2xl font-bold text-foreground">
              {doneIssues}/{totalIssues}
            </div>
            <div className="text-sm text-muted-foreground">Resolved</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      {counts && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(counts.categoryCounts).map(([category, count]) => {
            const style = CATEGORY_STYLES[category] || {
              bg: "bg-muted0/20",
              text: "text-muted-foreground",
            };
            return (
              <div key={category} className={`${style.bg} rounded-lg p-4 border border-border`}>
                <div className={`text-2xl font-bold ${style.text}`}>{count}</div>
                <div className="text-sm text-muted-foreground capitalize">{category}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search issues..."
            className="w-full pl-10 pr-4 py-2 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-500/15 border border-red-500/30 rounded-lg p-4 text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Kanban Board */}
      {loading && issues.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-8 w-8 text-muted-foreground animate-spin" />
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STATUS_COLUMNS.map((status) => (
            <KanbanColumn
              key={status.key}
              status={status}
              issues={issuesByStatus[status.key] || []}
              onStatusChange={updateStatus}
            />
          ))}
        </div>
      )}

      <div className="text-sm text-muted-foreground text-center">
        Click an issue to expand and change its status
      </div>
    </div>
  );
}
