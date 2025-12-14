"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, ClipboardList, HeartPulse, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useSession } from "next-auth/react";
import { useWhoami } from "@/hooks/use-whoami";
import { MobileQuickActionsBar } from "@/components/staff/MobileQuickActionsBar";

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("campreserv:authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type Member = {
  id: string;
  role: string;
  user: { id: string; email: string; firstName: string | null; lastName: string | null };
};

type Staff = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  region?: string | null;
  ownershipRoles?: string[] | null;
  notifyChannels?: string[];
  memberships?: { campgroundId: string; role?: string | null }[];
};

type Report = {
  id: string;
  createdAt: string;
  description: string;
  status: string;
  path?: string;
  campground?: { id: string; name: string };
  author?: { email: string; firstName?: string | null; lastName?: string | null };
  assignee?: { id: string; email: string; firstName?: string | null; lastName?: string | null };
  steps?: string;
  contactEmail?: string;
  timezone?: string;
  userAgent?: string;
  language?: string;
  roleFilter?: string;
  pinnedIds?: string[];
  recentIds?: string[];
};

const statusColor: Record<string, string> = {
  new: "bg-emerald-50 text-emerald-700 border-emerald-200",
  triage: "bg-amber-50 text-amber-700 border-amber-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  resolved: "bg-slate-50 text-slate-600 border-slate-200",
  closed: "bg-slate-100 text-slate-600 border-slate-200"
};

export default function SupportAdminPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [staff, setStaff] = useState<Staff[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const { toast } = useToast();
  const { data: session } = useSession();
  const { data: whoami, isLoading: whoamiLoading, error: whoamiError } = useWhoami();
  const hasMembership = (whoami?.user?.memberships?.length ?? 0) > 0;
  const platformRole = (whoami?.user as any)?.platformRole as string | undefined;
  const supportAllowed =
    whoami?.allowed?.supportRead || whoami?.allowed?.supportAssign || whoami?.allowed?.supportAnalytics;
  const allowSupport = !!supportAllowed && (!!platformRole || hasMembership);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("campreserv:selectedCampground");
      if (stored) setCampgroundId(stored);
    }
  }, []);

  useEffect(() => {
    if (!campgroundId) return;
    const loadMembers = async () => {
      setMembersLoading(true);
      setMembersError(null);
      try {
        const base = process.env.NEXT_PUBLIC_API_BASE || "";
        const res = await fetch(`${base}/campgrounds/${campgroundId}/members`, {
          credentials: "include",
          headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error(`Failed to load members (${res.status})`);
        const data = await res.json();
        setMembers(data as Member[]);
      } catch (err: any) {
        setMembersError(err?.message || "Failed to load members");
      } finally {
        setMembersLoading(false);
      }
    };
    if (!whoamiLoading && allowSupport) {
      void loadMembers();
    } else if (!whoamiLoading) {
      setMembers([]);
      setMembersLoading(false);
    }
  }, [campgroundId, whoamiLoading, allowSupport]);

  useEffect(() => {
    if (whoamiLoading) return;
    const viewerRegion = (whoami?.user as any)?.platformRegion ?? whoami?.user?.region ?? null;
    const regionAllowed = regionFilter === "all" || !viewerRegion || viewerRegion === regionFilter;
    const campgroundAllowed =
      !campgroundId || platformRole || whoami?.user?.memberships?.some((m: any) => m.campgroundId === campgroundId);

    if (!allowSupport || !regionAllowed || !campgroundAllowed) {
      setReports([]);
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const base = process.env.NEXT_PUBLIC_API_BASE || "";
        const parts: string[] = [];
        if (regionFilter !== "all") parts.push(`region=${encodeURIComponent(regionFilter)}`);
        if (campgroundId) parts.push(`campgroundId=${encodeURIComponent(campgroundId)}`);
        const qs = parts.length ? `?${parts.join("&")}` : "";
        const res = await fetch(`${base}/support/reports${qs}`, {
          credentials: "include",
          headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error(`Failed to load reports (${res.status})`);
        const data = await res.json();
        setReports(data);
      } catch (err: any) {
        setError(err?.message || "Failed to load reports");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [regionFilter, campgroundId, whoami, whoamiLoading, allowSupport]);

  useEffect(() => {
    if (whoamiLoading) return;
    const viewerRegion = (whoami?.user as any)?.platformRegion ?? whoami?.user?.region ?? null;
    const regionAllowed = regionFilter === "all" || !viewerRegion || viewerRegion === regionFilter;
    const campgroundAllowed =
      !campgroundId || platformRole || whoami?.user?.memberships?.some((m: any) => m.campgroundId === campgroundId);

    if (!allowSupport || !regionAllowed || !campgroundAllowed) {
      setStaff([]);
      setStaffLoading(false);
      return;
    }

    const loadStaff = async () => {
      setStaffLoading(true);
      try {
        const base = process.env.NEXT_PUBLIC_API_BASE || "";
        const parts: string[] = [];
        if (regionFilter !== "all") parts.push(`region=${encodeURIComponent(regionFilter)}`);
        if (campgroundId) parts.push(`campgroundId=${encodeURIComponent(campgroundId)}`);
        const qs = parts.length ? `?${parts.join("&")}` : "";
        const res = await fetch(`${base}/support/reports/staff/directory${qs}`, {
          credentials: "include",
          headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error(`Failed to load staff (${res.status})`);
        const data = await res.json();
        setStaff(data);
      } catch {
        setStaff([]);
      } finally {
        setStaffLoading(false);
      }
    };
    loadStaff();
  }, [regionFilter, campgroundId, whoami, whoamiLoading, allowSupport]);

  // Calculate stats
  const newCount = reports.filter((r) => r.status === "new").length;
  const triageCount = reports.filter((r) => r.status === "triage").length;
  const inProgressCount = reports.filter((r) => r.status === "in_progress").length;
  const resolvedCount = reports.filter((r) => r.status === "resolved" || r.status === "closed").length;

  const filtered = reports
    .filter((r) => statusFilter === "all" || r.status === statusFilter)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const selected = useMemo(() => reports.find((r) => r.id === selectedId) || null, [reports, selectedId]);

  if (!whoamiLoading && !allowSupport) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-amber-200/20 bg-amber-500/10 text-amber-900 p-4">
          <h2 className="font-semibold">Access Denied</h2>
          <p className="text-sm">You do not have permission to view or assign support reports.</p>
        </div>
      </div>
    );
  }

  const updateStatus = async (id: string, status: string) => {
    if (!canMutate) {
      toast({ title: "Out of scope", description: "You cannot update reports for this scope.", variant: "destructive" });
      return;
    }
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE || "";
      const res = await fetch(`${base}/support/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error(`Failed to update (${res.status})`);
      setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      toast({ title: "Updated", description: `Status set to ${status}` });
    } catch (err: any) {
      toast({ title: "Update failed", description: err?.message || "Try again", variant: "destructive" });
    }
  };

  const updateAssignee = async (id: string, assigneeId: string | null) => {
    if (!canMutate) {
      toast({ title: "Out of scope", description: "You cannot reassign for this scope.", variant: "destructive" });
      return;
    }
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE || "";
      const res = await fetch(`${base}/support/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ assigneeId })
      });
      if (!res.ok) throw new Error(`Failed to update (${res.status})`);
      const member = staff.find((s) => s.id === assigneeId);
      setReports((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
              ...r,
              assignee: assigneeId
                ? {
                  id: assigneeId,
                  email: member?.email || session?.user?.email || r.assignee?.email || "",
                  firstName: member?.firstName ?? r.assignee?.firstName,
                  lastName: member?.lastName ?? r.assignee?.lastName
                }
                : undefined
            }
            : r
        )
      );
      toast({ title: assigneeId ? "Assigned" : "Unassigned", description: assigneeId ? "Assigned to user" : "Cleared" });
    } catch (err: any) {
      toast({ title: "Update failed", description: err?.message || "Try again", variant: "destructive" });
    }
  };

  return (
    <div className="w-full">
      <div className="flex w-full flex-col gap-5 px-4 md:px-8 py-6 pb-24 md:pb-10" id="support-queue">

        {/* Header & Actions */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 border border-indigo-100">
              Support Desk <span className="text-[11px] text-indigo-600">Internal & Public</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Support Reports</h1>
            <p className="text-sm text-slate-600">Manage internal issues and public tickets in one place.</p>
          </div>

          <div className="flex flex-col gap-2 items-end">
            <div className="flex flex-wrap gap-2 justify-end">
              {/* Status Filter Pills */}
              <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
                {(["all", "new", "triage", "in_progress", "resolved", "closed"] as const).map((key) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={statusFilter === key ? "default" : "ghost"}
                    onClick={() => setStatusFilter(key)}
                    className="capitalize px-3 h-7 text-xs"
                  >
                    {key.replace("_", " ")}
                  </Button>
                ))}
              </div>

              {/* Region Filter Pills */}
              <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
                <Button
                  size="sm"
                  variant={regionFilter === "all" ? "default" : "ghost"}
                  onClick={() => setRegionFilter("all")}
                  className="h-7 text-xs"
                >
                  All Regions
                </Button>
                {["north", "south", "east", "west"].map((r) => (
                  <Button
                    key={r}
                    size="sm"
                    variant={regionFilter === r ? "default" : "ghost"}
                    onClick={() => setRegionFilter(r)}
                    className="capitalize h-7 text-xs"
                  >
                    {r}
                  </Button>
                ))}
              </div>

              <Button variant="secondary" size="sm" onClick={() => location.reload()} className="h-9">
                Refresh
              </Button>
            </div>
            <div className="text-xs text-slate-500">
              Scope: {whoamiLoading ? "Loading..." : whoami?.user ? `Region ${whoami.user.region ?? "Any"} • Campgrounds ${whoami.user.memberships?.length || 0}` : "Unavailable"}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-rose-700">
              <div className="h-2 w-2 rounded-full bg-rose-500" /> New
            </div>
            <div className="text-2xl font-bold text-rose-900">{newCount}</div>
            <div className="text-xs text-rose-700/80">Needs attention</div>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-700">
              <div className="h-2 w-2 rounded-full bg-amber-500" /> Triage
            </div>
            <div className="text-2xl font-bold text-amber-900">{triageCount}</div>
            <div className="text-xs text-amber-700/80">Investigating</div>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-700">
              <div className="h-2 w-2 rounded-full bg-blue-500" /> In Progress
            </div>
            <div className="text-2xl font-bold text-blue-900">{inProgressCount}</div>
            <div className="text-xs text-blue-700/80">Being fixed</div>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
              <div className="h-2 w-2 rounded-full bg-emerald-500" /> Resolved
            </div>
            <div className="text-2xl font-bold text-emerald-900">{resolvedCount}</div>
            <div className="text-xs text-emerald-700/80">Completed</div>
          </div>
        </div>

        {/* Permissions / Loading Errors */}
        {whoamiError && <div className="p-4 text-rose-600 bg-rose-50 rounded border border-rose-100">Scope fetch failed: {(whoamiError as Error)?.message}</div>}
        {loading && <div className="p-12 text-center text-slate-500">Loading reports...</div>}
        {error && <div className="p-4 text-rose-600 bg-rose-50 rounded border border-rose-100">{error}</div>}

        {!loading && !error && filtered.length === 0 && (
          <div className="p-12 text-center text-slate-500 bg-white rounded-lg border border-slate-200 border-dashed">
            No reports found for this filter.
          </div>
        )}

        {/* Data Table */}
        {!loading && !error && filtered.length > 0 && (
          <>
            <div className="hidden rounded-lg border border-slate-200 bg-white shadow-sm md:block overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Source</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 w-1/3">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Author</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Assignee</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Created</th>
                    <th className="px-4 py-3 text-end text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filtered.map((r) => (
                    <tr key={r.id} className="bg-white hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 align-top">
                        <Badge className={`${statusColor[r.status] || "bg-slate-100 text-slate-600"} border shadow-none font-medium capitalize`}>
                          {r.status.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-col gap-0.5">
                          {r.campground?.id === "global" ? (
                            <Badge variant="outline" className="w-fit border-indigo-200 bg-indigo-50 text-indigo-700">Ticket</Badge>
                          ) : (
                            <Badge variant="outline" className="w-fit border-slate-200 text-slate-600">Report</Badge>
                          )}
                          <span className="text-[10px] text-slate-500 font-medium truncate max-w-[120px]">
                            {r.campground?.id === "global" ? "Global Feedback" : r.campground?.name || "Unknown"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-slate-900 line-clamp-2" title={r.description}>{r.description}</div>
                          {r.steps && <div className="text-xs text-slate-500 line-clamp-1">Steps: {r.steps}</div>}
                          {r.path && <code className="text-[10px] text-slate-500 bg-slate-100 px-1 py-0.5 rounded">{r.path}</code>}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-col">
                          <span className="text-sm text-slate-700 font-medium">
                            {r.author?.firstName ? `${r.author.firstName} ${r.author.lastName || ""}` : "Guest/Anon"}
                          </span>
                          <span className="text-xs text-slate-500">{r.author?.email || r.contactEmail || "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {r.assignee ? (
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                              {(r.assignee.firstName?.[0] || r.assignee.email?.[0] || "?").toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-slate-900">
                                {r.assignee.firstName || r.assignee.email.split("@")[0]}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-slate-500 whitespace-nowrap">
                        {new Date(r.createdAt).toLocaleDateString()}
                        <div className="text-[10px]">{new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="px-4 py-3 align-top text-end">
                        <Button size="sm" variant="ghost" className="h-8 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50" onClick={() => setSelectedId(r.id)}>
                          Review
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="grid gap-3 md:hidden">
              {filtered.map((r) => (
                <Card key={r.id} className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={`${statusColor[r.status] || "bg-gray-100 text-gray-700"} text-[10px] uppercase`}>
                          {r.status.replace("_", " ")}
                        </Badge>
                        <span className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-900 line-clamp-2">{r.description}</span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 grid grid-cols-2 gap-2 border-t border-b border-slate-100 py-2">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Source</span>
                      {r.campground?.name || "Global"}
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Author</span>
                      {r.author?.email || r.contactEmail || "Anon"}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-slate-500">
                      {r.assignee ? `Assigned to ${r.assignee.firstName || r.assignee.email}` : "Unassigned"}
                    </span>
                    <Button size="sm" variant="outline" className="h-8" onClick={() => setSelectedId(r.id)}>Details</Button>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}

      </div>

      <MobileQuickActionsBar
        active="tasks"
        items={[
          { key: "tasks", label: "Tasks", href: "#support-queue", icon: <ClipboardList className="h-4 w-4" />, badge: openReports },
          { key: "messages", label: "Messages", href: "/messages", icon: <MessageSquare className="h-4 w-4" /> },
          { key: "checklists", label: "Checklists", href: "/operations#checklists", icon: <ClipboardCheck className="h-4 w-4" /> },
          { key: "ops-health", label: "Ops health", href: "/operations#ops-health", icon: <HeartPulse className="h-4 w-4" />, badge: triagePending },
        ]}
      />

      {/* Details Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-end z-50" onClick={() => setSelectedId(null)}>
          <div
            className="w-full max-w-lg bg-white h-full shadow-2xl border-l border-slate-200 overflow-y-auto animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={`${statusColor[selected.status]} shadow-none`}>{selected.status}</Badge>
                  <span className="text-xs text-slate-500">#{selected.id.slice(0, 8)}</span>
                </div>
                <div className="text-base font-bold text-slate-900 line-clamp-2">{selected.description}</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelectedId(null)}>Close</Button>
            </div>

            <div className="p-5 space-y-6">
              {/* Actions */}
              <div className="flex flex-col gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Status</label>
                  <Select value={selected.status} onValueChange={(v) => updateStatus(selected.id, v)} disabled={!canMutate}>
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="triage">Triage</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Assignee</label>
                  <div className="flex gap-2">
                    <Select
                      value={selected.assignee?.id || "unassigned"}
                      onValueChange={(v) => updateAssignee(selected.id, v === "unassigned" ? null : v)}
                      disabled={!canMutate}
                    >
                      <SelectTrigger className="bg-white flex-1">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {staff.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {(s.firstName || s.lastName) ? `${s.firstName ?? ""} ${s.lastName ?? ""}` : s.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {session?.user?.id && (
                      <Button
                        variant="secondary"
                        onClick={() => updateAssignee(selected.id, session.user!.id)}
                        disabled={!canMutate || selected.assignee?.id === session.user.id}
                      >
                        Me
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="space-y-4">
                {selected.steps && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-2">Steps / Details</h3>
                    <div className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded border border-slate-100">
                      {selected.steps}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="block text-xs text-slate-500 font-medium uppercase mb-1">Author</span>
                    <div className="text-slate-900">{selected.author?.email || "Anonymous"}</div>
                    {selected.contactEmail && <div className="text-slate-500 text-xs">{selected.contactEmail}</div>}
                  </div>
                  <div>
                    <span className="block text-xs text-slate-500 font-medium uppercase mb-1">Source</span>
                    <div className="text-slate-900">{selected.campground?.name || "Global"}</div>
                    {selected.path && <div className="text-slate-500 text-xs truncate" title={selected.path}>{selected.path}</div>}
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">Technical Context</h3>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-600">
                    {selected.userAgent && <><dt className="font-medium text-slate-900">Browser:</dt><dd className="truncate" title={selected.userAgent}>{selected.userAgent}</dd></>}
                    {selected.language && <><dt className="font-medium text-slate-900">Language:</dt><dd>{selected.language}</dd></>}
                    {selected.timezone && <><dt className="font-medium text-slate-900">Timezone:</dt><dd>{selected.timezone}</dd></>}
                    {selected.roleFilter && <><dt className="font-medium text-slate-900">Role:</dt><dd>{selected.roleFilter}</dd></>}
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

