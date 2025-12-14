"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useWhoami } from "@/hooks/use-whoami";

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("campreserv:authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type Staff = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  region?: string | null;
  platformRole?: string | null;
  platformRegion?: string | null;
  platformActive?: boolean | null;
  ownershipRoles?: string[] | null;
  notifyChannels?: string[];
  memberships?: { campgroundId: string; role?: string | null }[];
};

export default function SupportStaffDirectoryPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(false);
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [campgroundId, setCampgroundId] = useState<string>("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { region: string; ownershipRoles: string }>>({});
  const { toast } = useToast();
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

  const loadStaff = async () => {
    setLoading(true);
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
      const data = (await res.json()) as Staff[];
      setStaff(data);
    } catch (err: any) {
      toast({ title: "Load failed", description: err?.message || "Could not fetch staff", variant: "destructive" });
      setStaff([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (whoamiLoading) return;
    if (!allowSupport) {
      setStaff([]);
      setLoading(false);
      return;
    }
    void loadStaff();
  }, [regionFilter, campgroundId, whoamiLoading, allowSupport]);

  const getDraft = (s: Staff) => {
    const existing = drafts[s.id];
    if (existing) return existing;
    return {
      region: s.region ?? "",
      ownershipRoles: (s.ownershipRoles ?? []).join(", ")
    };
  };

  const saveScope = async (staffId: string) => {
    const target = staff.find((s) => s.id === staffId);
    if (!target) return;
    const draft = getDraft(target);
    const roles = draft.ownershipRoles
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);
    setSavingId(staffId);
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE || "";
      const res = await fetch(`${base}/support/reports/staff/${staffId}/scope`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ region: draft.region || null, ownershipRoles: roles })
      });
      if (!res.ok) throw new Error(`Failed to update (${res.status})`);
      const updated = (await res.json()) as Staff;
      setStaff((prev) => prev.map((s) => (s.id === staffId ? updated : s)));
      toast({ title: "Updated", description: "Staff scope saved" });
    } catch (err: any) {
      toast({ title: "Save failed", description: err?.message || "Unable to save", variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const regionOptions = useMemo(
    () => [
      { value: "all", label: "All regions" },
      { value: "north", label: "North" },
      { value: "south", label: "South" },
      { value: "east", label: "East" },
      { value: "west", label: "West" }
    ],
    []
  );

  if (!whoamiLoading && !allowSupport) {
    return (
      <div>
        <div className="space-y-3">
          <div className="text-xl font-semibold text-white">Support staff</div>
          <div className="rounded-lg border border-amber-200/20 bg-amber-500/10 text-amber-400 p-4">
            You do not have permission to view or edit support staff scope.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase font-semibold text-slate-500">Support</div>
            <h1 className="text-2xl font-bold text-slate-900">Staff directory</h1>
            <p className="text-sm text-slate-600">Scoped by campground and region for assignments/notifications.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="w-36 h-8">
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent>
                {regionOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={campgroundId}
              onChange={(e) => setCampgroundId(e.target.value)}
              placeholder="Campground ID"
              className="h-8 w-48"
            />
            <Button variant="outline" size="sm" onClick={() => void loadStaff()} disabled={loading || whoamiLoading}>
              Refresh
            </Button>
          </div>
        </div>

        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase font-semibold text-slate-500">Directory</div>
              <p className="text-sm text-slate-600">Only staff permitted for the selected region/campground are shown.</p>
            </div>
            {loading && <div className="text-xs text-slate-500">Loading…</div>}
            {whoamiError && <div className="text-xs text-rose-600">Scope fetch failed: {(whoamiError as Error)?.message}</div>}
          </div>

          <div className="grid gap-3">
            {staff.map((s) => {
              const draft = getDraft(s);
              return (
                <div key={s.id} className="rounded border border-slate-200 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{s.email}</div>
                      <div className="text-xs text-slate-600">
                        {(s.firstName || s.lastName) ? `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() : "—"}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Region: {s.region ?? "n/a"} • Ownership: {(s.ownershipRoles ?? []).join(", ") || "none"}
                      </div>
                      {s.memberships?.length ? (
                        <div className="text-[11px] text-slate-500">
                          Campgrounds: {s.memberships.map((m) => m.campgroundId).join(", ")}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => toast({ title: "Notify (stub)", description: `Sent to ${s.email}` })}
                        disabled={whoamiLoading}
                      >
                        Notify
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span>Region scope:</span>
                    <Select
                      value={draft.region || "unassigned"}
                      onValueChange={(v) =>
                        setDrafts((prev) => ({ ...prev, [s.id]: { ...draft, region: v === "unassigned" ? "" : v } }))
                      }
                      disabled={whoamiLoading}
                    >
                      <SelectTrigger className="h-8 w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {regionOptions
                          .filter((r) => r.value !== "all")
                          .map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>

                    <span className="ml-2">Ownership roles:</span>
                    <Input
                      value={draft.ownershipRoles}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [s.id]: { ...draft, ownershipRoles: e.target.value } }))
                      }
                      placeholder="owner, manager"
                      className="h-8 w-44"
                      disabled={whoamiLoading}
                    />
                    <Button
                      size="sm"
                      onClick={() => void saveScope(s.id)}
                      disabled={savingId === s.id || whoamiLoading}
                    >
                      {savingId === s.id ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              );
            })}
            {staff.length === 0 && !loading && <div className="text-sm text-slate-500">No staff match this scope.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}

