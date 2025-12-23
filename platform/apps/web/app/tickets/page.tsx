"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useWhoami } from "@/hooks/use-whoami";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Plus, X, Search, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Ticket = {
  id: string;
  createdAt: string;
  completedAt?: string;
  title: string;
  notes?: string;
  category?: "issue" | "question" | "feature" | "other";
  url?: string;
  path?: string;
  pageTitle?: string;
  userAgent?: string;
  selection?: string;
  extra?: Record<string, unknown>;
  status: "open" | "completed";
  agentNotes?: string;
  votes?: number;
  voteCount?: number; // compat
  area?: string;
  submitter?: {
    id?: string | null;
    name?: string | null;
    email?: string | null;
  };
  upvoters?: Array<{
    id?: string | null;
    name?: string | null;
    email?: string | null;
  }>;
  client?: {
    userAgent?: string | null;
    platform?: string | null;
    language?: string | null;
    deviceType?: "mobile" | "desktop" | "tablet" | "unknown";
  };
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [upvotingId, setUpvotingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "completed">("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "issue" | "question" | "feature" | "other">("all");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [detailTicket, setDetailTicket] = useState<Ticket | null>(null);
  const [response, setResponse] = useState("");
  const [responding, setResponding] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const { data: whoami } = useWhoami();

  // Create Ticket State
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTicket, setNewTicket] = useState({
    title: "",
    notes: "",
    category: "issue" as "issue" | "question" | "feature" | "other",
    area: "General"
  });

  const loadTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tickets", { cache: "no-store" });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      setTickets(data.tickets ?? []);
    } catch (err) {
      console.error(err);
      setError("Could not load tickets.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const openCount = tickets.filter((t) => t.status === "open").length;
  const completedCount = tickets.filter((t) => t.status === "completed").length;
  const issueCount = tickets.filter((t) => (t.category ?? "issue") === "issue").length;
  const questionCount = tickets.filter((t) => t.category === "question").length;
  const featureCount = tickets.filter((t) => t.category === "feature").length;

  // Get unique areas for filter
  const areas = ["all", ...Array.from(new Set(tickets.map((t) => t.area || "General"))).sort()];

  const filteredTickets = tickets
    .filter((t) => (statusFilter === "all" ? true : t.status === statusFilter))
    .filter((t) => (categoryFilter === "all" ? true : (t.category ?? "issue") === categoryFilter))
    .filter((t) => (areaFilter === "all" ? true : (t.area || "General") === areaFilter))
    .filter((t) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        (t.notes ?? "").toLowerCase().includes(q) ||
        (t.pageTitle ?? "").toLowerCase().includes(q) ||
        (t.path ?? "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const deviceLabel = (t: Ticket) => {
    const device = (t.client?.deviceType ?? "").toLowerCase();
    const platform = (t.client?.platform ?? "").toLowerCase();
    const ua = t.client?.userAgent ?? "";
    const browser =
      /chrome|crios/i.test(ua) && !/edg/i.test(ua)
        ? "Chrome"
        : /safari/i.test(ua) && !/chrome|crios/i.test(ua)
          ? "Safari"
          : /firefox/i.test(ua)
            ? "Firefox"
            : /edg/i.test(ua)
              ? "Edge"
              : "Browser";

    if (device === "mobile") {
      if (platform.includes("iphone")) return `Mobile · iPhone · ${browser}`;
      if (platform.includes("android")) return `Mobile · Android · ${browser}`;
      return `Mobile · ${browser}`;
    }
    if (device === "tablet") return `Tablet · ${browser}`;
    if (platform.includes("mac")) return `Desktop · Mac · ${browser}`;
    if (platform.includes("win")) return `Desktop · PC · ${browser}`;
    return `Desktop · ${browser}`;
  };

  const categoryBadge = (t: Ticket) => {
    const c = t.category || "issue";
    const area = t.area || "General";

    const map: Record<string, { label: string; className: string }> = {
      issue: { label: "Issue", className: "bg-rose-50 text-rose-700 border border-rose-100" },
      question: { label: "Question", className: "bg-sky-50 text-sky-700 border border-sky-100" },
      feature: { label: "Feature", className: "bg-amber-50 text-amber-800 border border-amber-100" },
      other: { label: "Other", className: "bg-slate-100 text-slate-700 border border-slate-200" },
    };

    const areaColors: Record<string, string> = {
      'UI/UX': 'bg-purple-50 text-purple-700 border-purple-100',
      'Payments': 'bg-emerald-50 text-emerald-700 border-emerald-100',
      'Auth': 'bg-indigo-50 text-indigo-700 border-indigo-100',
      'Reservations': 'bg-blue-50 text-blue-700 border-blue-100',
      'Admin': 'bg-slate-100 text-slate-700 border-slate-200',
      'General': 'bg-gray-50 text-gray-600 border-gray-100'
    };

    const picked = map[c] || map.issue;
    const areaClass = areaColors[area] || areaColors['General'];

    return (
      <div className="flex gap-1.5">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${picked.className}`}>
          {picked.label}
        </span>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border ${areaClass}`}>
          {area}
        </span>
      </div>
    );
  };

  const displayUrl = (raw?: string) => {
    if (!raw) return "";
    try {
      const u = new URL(raw);
      return u.host + u.pathname;
    } catch {
      return raw.length > 40 ? raw.slice(0, 37) + "..." : raw;
    }
  };

  const markCompleted = async (ticket: Ticket) => {
    const notes = window.prompt("Add quick notes (optional):", ticket.agentNotes ?? "") ?? ticket.agentNotes ?? "";
    setUpdatingId(ticket.id);
    try {
      const res = await fetch("/api/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ticket.id, status: "completed", agentNotes: notes }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      await loadTickets();
    } catch (err) {
      console.error(err);
      setError("Could not update ticket.");
    } finally {
      setUpdatingId(null);
    }
  };

  const upvote = async (ticket: Ticket) => {
    setUpvotingId(ticket.id);
    try {
      const actor = {
        id: (whoami as any)?.id ?? (whoami as any)?.user?.id ?? null,
        name:
          (whoami as any)?.name ??
          (whoami as any)?.user?.name ??
          (whoami as any)?.email ??
          (whoami as any)?.user?.email ??
          null,
        email: (whoami as any)?.email ?? (whoami as any)?.user?.email ?? null,
      };

      const res = await fetch("/api/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ticket.id, action: "upvote", actor }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      await loadTickets();
    } catch (err) {
      console.error(err);
      setError("Could not upvote ticket.");
    } finally {
      setUpvotingId(null);
    }
  };

  const submitResponse = async () => {
    if (!detailTicket) return;
    const trimmed = response.trim();
    if (!trimmed) return;
    setResponding(true);
    try {
      const timestamp = new Date().toLocaleString();
      const combinedNotes = detailTicket.agentNotes
        ? `${detailTicket.agentNotes}\n\n[${timestamp}] Response: ${trimmed}`
        : `[${timestamp}] Response: ${trimmed}`;

      // Reopen ticket if it was completed - new response means it needs attention
      const newStatus = detailTicket.status === "completed" ? "open" : detailTicket.status;

      const res = await fetch("/api/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: detailTicket.id,
          agentNotes: combinedNotes,
          status: newStatus
        }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setResponse("");
      setDetailTicket(null);
      await loadTickets();
    } catch (err) {
      console.error(err);
      setError("Could not save response.");
    } finally {
      setResponding(false);
    }
  };

  const handleCreate = async () => {
    if (!newTicket.title.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTicket.title,
          notes: newTicket.notes,
          category: newTicket.category,
          area: newTicket.area,
          status: "open",
          submitter: {
            id: (whoami as any)?.id,
            name: (whoami as any)?.name,
            email: (whoami as any)?.email
          }
        }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setCreateOpen(false);
      setNewTicket({
        title: "",
        notes: "",
        category: "issue",
        area: "General"
      });
      await loadTickets();
    } catch (err) {
      console.error(err);
      alert("Failed to create ticket");
    } finally {
      setCreating(false);
    }
  };


  return (
    <div className="w-full">
      <div className="flex w-full flex-col gap-5 px-4 md:px-8 py-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-100">
              Ticket desk <span className="text-[11px] text-emerald-600">with context capture</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Tickets</h1>
            <p className="text-sm text-slate-600">Track issues, questions, and ideas—then respond fast.</p>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <div className="flex flex-wrap gap-2 justify-end">
              <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
                {(["all", "open", "completed"] as const).map((key) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={statusFilter === key ? "default" : "ghost"}
                    onClick={() => setStatusFilter(key)}
                  >
                    {key === "all" ? "All" : key === "open" ? "Open" : "Completed"}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
                {(["all", "issue", "question", "feature", "other"] as const).map((key) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={categoryFilter === key ? "default" : "ghost"}
                    onClick={() => setCategoryFilter(key)}
                  >
                    {key === "issue"
                      ? "Issues"
                      : key === "question"
                        ? "Questions"
                        : key === "feature"
                          ? "Features"
                          : key === "other"
                            ? "Other"
                            : "All Types"}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
                {areas.map((key) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={areaFilter === key ? "default" : "ghost"}
                    onClick={() => setAreaFilter(key)}
                    className="capitalize"
                  >
                    {key}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 shadow-sm">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tickets..."
                  className="h-9 w-48 border-0 bg-transparent px-0 text-sm focus-visible:ring-0"
                />
              </div>
              <Button variant="outline" asChild>
                <a href="/roadmap" className="flex items-center gap-2" target="_blank" rel="noreferrer">
                  Roadmap
                </a>
              </Button>
              <Button onClick={() => setCreateOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                New Ticket
              </Button>
              <Button variant="secondary" onClick={loadTickets} disabled={loading}>
                {loading ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
              Open
            </div>
            <div className="text-2xl font-bold text-emerald-900">{openCount}</div>
            <div className="text-xs text-emerald-700/80">In flight</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 13l4 4L19 7" />
              </svg>
              Completed
            </div>
            <div className="text-2xl font-bold text-slate-900">{completedCount}</div>
            <div className="text-xs text-slate-500">Shipped & done</div>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-700">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3v18M5 9l7-6 7 6M5 15l7 6 7-6" />
              </svg>
              Features
            </div>
            <div className="text-2xl font-bold text-amber-900">{featureCount}</div>
            <div className="text-xs text-amber-700/80">Requests</div>
          </div>
          <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-sky-700">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9.5 9a2.5 2.5 0 1 1 4.9.5c0 1.5-1.5 2-2.4 2.9-.3.3-.5.8-.5 1.3" />
                <path d="M12 17h.01" />
                <circle cx="12" cy="12" r="9" />
              </svg>
              Questions
            </div>
            <div className="text-2xl font-bold text-sky-900">{questionCount}</div>
            <div className="text-xs text-sky-700/80">Need answers</div>
          </div>
        </div>

        {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading tickets...
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <div className="p-4 rounded-full bg-slate-50 border border-slate-200 mb-4">
              <Search className="h-6 w-6 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900">No tickets found</h3>
            <p className="text-sm mt-1 mb-4">You can create a new ticket to get started.</p>
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Ticket
            </Button>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden rounded-lg border border-slate-200 bg-white shadow-sm md:block">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Votes</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Details</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Submitter</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Device</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Page</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">When</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredTickets.map((ticket, idx) => (
                    <tr key={ticket.id} className={`bg-white hover:bg-slate-50 ${idx % 2 === 1 ? "bg-slate-50/40" : ""}`}>
                      <td className="px-4 py-4 align-top text-sm text-slate-700">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => upvote(ticket)}
                            disabled={upvotingId === ticket.id}
                          >
                            {upvotingId === ticket.id ? "…" : "Upvote"}
                          </Button>
                          <span className="text-sm font-semibold text-slate-900">{ticket.votes ?? 0}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top text-xs font-semibold">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 ${ticket.status === "completed"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                            }`}
                        >
                          {ticket.status === "completed" ? "Completed" : "Open"}
                        </span>
                        {ticket.completedAt && (
                          <div className="text-[11px] text-slate-500">
                            {new Date(ticket.completedAt).toLocaleString()}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 align-top text-sm font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          {categoryBadge(ticket)}
                          <span className="truncate">{ticket.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-slate-700 whitespace-pre-wrap space-y-2">
                        <div className={expandedNotes[ticket.id] ? "" : "line-clamp-3"}>{ticket.notes ?? "—"}</div>
                        {ticket.notes && ticket.notes.length > 140 && (
                          <button
                            className="text-xs font-semibold text-emerald-700 hover:underline"
                            onClick={() =>
                              setExpandedNotes((prev) => ({ ...prev, [ticket.id]: !prev[ticket.id] }))
                            }
                          >
                            {expandedNotes[ticket.id] ? "Show less" : "Show all"}
                          </button>
                        )}
                        {ticket.agentNotes && (
                          <Button size="sm" variant="ghost" className="px-0 text-emerald-700" onClick={() => setDetailTicket(ticket)}>
                            View agent notes
                          </Button>
                        )}
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-slate-700 space-y-1">
                        {ticket.submitter?.name && <div className="font-semibold text-slate-900">{ticket.submitter.name}</div>}
                        {ticket.submitter?.email && <div className="text-xs text-slate-500">{ticket.submitter.email}</div>}
                        {!ticket.submitter?.name && !ticket.submitter?.email && <div className="text-xs text-slate-500">Anonymous</div>}
                        {ticket.upvoters && ticket.upvoters.length > 0 && (
                          <div className="text-[11px] text-slate-500">
                            Upvoted by{" "}
                            {ticket.upvoters
                              .map((u) => u.name || u.email || "Someone")
                              .slice(0, 3)
                              .join(", ")}
                            {ticket.upvoters.length > 3 ? ` +${ticket.upvoters.length - 3}` : ""}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 align-top text-xs text-slate-600 space-y-1">
                        <div className="font-semibold text-slate-800">{deviceLabel(ticket)}</div>
                        {ticket.client?.language && <div className="text-xs text-slate-500">{ticket.client.language}</div>}
                      </td>
                      <td className="px-4 py-4 align-top text-xs text-slate-600 space-y-1 max-w-[220px]">
                        {ticket.pageTitle && <div className="font-semibold text-slate-800 line-clamp-1">{ticket.pageTitle}</div>}
                        {ticket.url && (
                          <a
                            href={ticket.url}
                            className="block text-emerald-700 hover:underline truncate"
                            title={ticket.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {displayUrl(ticket.url)}
                          </a>
                        )}
                        {ticket.path && <div className="text-slate-500 line-clamp-1" title={ticket.path}>{ticket.path}</div>}
                        {ticket.selection && <div className="text-slate-500 line-clamp-1" title={ticket.selection}>Selection: “{ticket.selection}”</div>}
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-slate-600">
                        {ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-slate-600 bg-white">
                        <div className="flex flex-col gap-2">
                          <Button size="sm" variant="ghost" className="justify-start px-0 text-emerald-700" onClick={() => setDetailTicket(ticket)}>
                            Details
                          </Button>
                          {ticket.url && (
                            <Button size="sm" variant="ghost" className="justify-start px-0 text-emerald-700" asChild>
                              <a href={ticket.url} target="_blank" rel="noreferrer">
                                Review page →
                              </a>
                            </Button>
                          )}
                          {ticket.status === "completed" ? (
                            <span className="text-xs text-slate-500">Done</span>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => markCompleted(ticket)}
                              disabled={updatingId === ticket.id}
                            >
                              {updatingId === ticket.id ? "Saving..." : "Mark completed"}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {filteredTickets.map((ticket) => (
                <div key={ticket.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold uppercase text-slate-500">{ticket.status === "completed" ? "Completed" : "Open"}</div>
                      <div className="flex items-center gap-2">
                        {categoryBadge(ticket)}
                        <div className="text-base font-semibold text-slate-900 line-clamp-2">{ticket.title}</div>
                      </div>
                      <div className="text-xs text-slate-500">{ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : "—"}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="secondary" onClick={() => upvote(ticket)} disabled={upvotingId === ticket.id}>
                        {upvotingId === ticket.id ? "…" : "Upvote"}
                      </Button>
                      <span className="text-sm font-semibold text-slate-900">{ticket.votes ?? 0}</span>
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-slate-700 line-clamp-3">{ticket.notes ?? "—"}</div>
                  {ticket.notes && ticket.notes.length > 140 && (
                    <button
                      className="text-xs font-semibold text-emerald-700 hover:underline"
                      onClick={() =>
                        setExpandedNotes((prev) => ({ ...prev, [ticket.id]: !prev[ticket.id] }))
                      }
                    >
                      {expandedNotes[ticket.id] ? "Show less" : "Show all"}
                    </button>
                  )}
                  <div className="mt-2 text-xs text-slate-600">
                    {ticket.submitter?.name || ticket.submitter?.email ? (
                      <>
                        <span className="font-semibold">{ticket.submitter?.name}</span>
                        {ticket.submitter?.email && <> · {ticket.submitter.email}</>}
                      </>
                    ) : (
                      "Anonymous"
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-600">{deviceLabel(ticket)}</div>
                  {ticket.pageTitle && (
                    <div className="mt-1 text-xs text-slate-600 line-clamp-1">
                      <span className="font-semibold">{ticket.pageTitle}</span>
                    </div>
                  )}
                  {ticket.url && (
                    <a
                      className="mt-1 block text-xs text-emerald-700 underline truncate"
                      href={ticket.url}
                      target="_blank"
                      rel="noreferrer"
                      title={ticket.url}
                    >
                      {displayUrl(ticket.url)}
                    </a>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" className="px-0 text-emerald-700" onClick={() => setDetailTicket(ticket)}>
                      Details
                    </Button>
                    {ticket.url && (
                      <Button size="sm" variant="ghost" className="px-0 text-emerald-700" asChild>
                        <a href={ticket.url} target="_blank" rel="noreferrer">
                          Review page →
                        </a>
                      </Button>
                    )}
                    {ticket.status === "completed" ? (
                      <span className="text-xs text-slate-500 self-center">Done</span>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => markCompleted(ticket)} disabled={updatingId === ticket.id}>
                        {updatingId === ticket.id ? "Saving..." : "Mark completed"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <Dialog open={!!detailTicket} onOpenChange={(open) => (!open ? setDetailTicket(null) : undefined)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{detailTicket?.title ?? "Details"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm text-slate-700">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold uppercase text-slate-500">Ticket details</div>
                <div className="mt-1 whitespace-pre-wrap">{detailTicket?.notes ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-slate-500">Agent notes</div>
                <div className="whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-3">
                  {detailTicket?.agentNotes ?? "No agent notes yet."}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase text-slate-500">Add response</div>
                <Textarea
                  rows={3}
                  placeholder="Reply or add context. This will append to agent notes."
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                />
                <div className="text-[11px] text-slate-500">
                  Saved to agent notes history.
                  {detailTicket?.status === "completed" && response.trim() && (
                    <span className="ml-1 text-amber-600 font-medium">
                      This will reopen the ticket.
                    </span>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <div className="flex w-full justify-end gap-2">
                <Button variant="ghost" onClick={() => setDetailTicket(null)} disabled={responding}>
                  Close
                </Button>
                <Button onClick={submitResponse} disabled={responding || !response.trim()}>
                  {responding
                    ? "Saving..."
                    : detailTicket?.status === "completed" && response.trim()
                      ? "Save & Reopen"
                      : "Save response"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Ticket Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Ticket</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  placeholder="Brief summary of the issue"
                  value={newTicket.title}
                  onChange={(e) => setNewTicket(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <Select
                    value={newTicket.category}
                    onValueChange={(val: any) => setNewTicket(prev => ({ ...prev, category: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="issue">Issue</SelectItem>
                      <SelectItem value="question">Question</SelectItem>
                      <SelectItem value="feature">Feature</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Area</label>
                  <Select
                    value={newTicket.area}
                    onValueChange={(val) => setNewTicket(prev => ({ ...prev, area: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="General">General</SelectItem>
                      <SelectItem value="Admin">Admin</SelectItem>
                      <SelectItem value="UI/UX">UI/UX</SelectItem>
                      <SelectItem value="Reservations">Reservations</SelectItem>
                      <SelectItem value="Payments">Payments</SelectItem>
                      <SelectItem value="Auth">Auth</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description / Notes</label>
                <Textarea
                  placeholder="Detailed description..."
                  rows={4}
                  value={newTicket.notes}
                  onChange={(e) => setNewTicket(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={creating || !newTicket.title.trim()}>
                {creating ? "Creating..." : "Create Ticket"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
