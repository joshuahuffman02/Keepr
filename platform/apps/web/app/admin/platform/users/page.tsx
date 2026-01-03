"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useWhoami } from "@/hooks/use-whoami";
import { useToast } from "@/components/ui/use-toast";

type Staff = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  region?: string | null;
  platformRole?: string | null;
  platformRegion?: string | null;
  platformActive?: boolean | null;
};

interface UserWithPlatformRole {
  platformRole?: string | null;
}

const PLATFORM_ROLE_OPTIONS = [
  { value: "support_agent", label: "Support Agent" },
  { value: "support_lead", label: "Support Lead" },
  { value: "regional_support", label: "Regional Support" },
  { value: "ops_engineer", label: "Ops Engineer" },
  { value: "platform_admin", label: "Platform Admin" }
];

export default function PlatformUsersPage() {
  const { data: whoami, isLoading: whoamiLoading, error: whoamiError } = useWhoami();
  const { toast } = useToast();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const platformRole = (whoami?.user as UserWithPlatformRole | undefined)?.platformRole;
  const canManage = !!platformRole;

  const filteredStaff = useMemo(() => {
    const byRegion = regionFilter === "all" ? staff : staff.filter((s) => (s.platformRegion || s.region) === regionFilter);
    if (!search.trim()) return byRegion;
    const q = search.toLowerCase();
    return byRegion.filter(
      (s) => s.email.toLowerCase().includes(q) || `${s.firstName ?? ""} ${s.lastName ?? ""}`.toLowerCase().includes(q)
    );
  }, [regionFilter, search, staff]);

  const loadStaff = async () => {
    setLoading(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE || "";
      const params = regionFilter !== "all" ? `?region=${encodeURIComponent(regionFilter)}` : "";
      const res = await fetch(`${base}/support/reports/staff/directory${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to load staff (${res.status})`);
      const data = (await res.json()) as Staff[];
      setStaff(data.filter((s) => s.platformRole || s.platformActive));
    } catch (err: any) {
      toast({ title: "Load failed", description: err?.message || "Could not load staff", variant: "destructive" });
      setStaff([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (whoamiLoading || !canManage) return;
    void loadStaff();
  }, [regionFilter, whoamiLoading, canManage]);

  const saveStaff = async (target: Staff) => {
    setSavingId(target.id);
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE || "";
      const res = await fetch(`${base}/support/reports/staff/${target.id}/scope`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          region: target.region ?? null,
          platformRole: target.platformRole ?? null,
          platformRegion: target.platformRegion ?? null,
          platformActive: String(target.platformActive !== false)
        })
      });
      if (!res.ok) throw new Error(`Update failed (${res.status})`);
      const updated = (await res.json()) as Staff;
      setStaff((prev) => prev.map((s) => (s.id === target.id ? { ...s, ...updated } : s)));
      toast({ title: "Saved", description: "Platform staff updated" });
    } catch (err: any) {
      toast({ title: "Save failed", description: err?.message || "Unable to save", variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  if (!whoamiLoading && !canManage) {
    return (
      <div>
        <div className="space-y-3">
          <div className="text-xl font-semibold text-foreground">Platform users</div>
          <div className="rounded-lg border border-status-warning/30 bg-status-warning/15 text-status-warning p-4">
            You do not have access to platform staff administration.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase font-semibold text-muted-foreground">Platform</div>
            <h1 className="text-2xl font-bold text-foreground">Platform users</h1>
            <p className="text-sm text-muted-foreground">Internal staff for support and operations. Hidden from campground staff.</p>
            {whoamiError && <p className="text-xs text-rose-600 mt-1">Failed to load identity: {(whoamiError as Error)?.message}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="h-8 w-36">
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All regions</SelectItem>
                <SelectItem value="north">North</SelectItem>
                <SelectItem value="south">South</SelectItem>
                <SelectItem value="east">East</SelectItem>
                <SelectItem value="west">West</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email"
              className="h-8 w-56"
            />
            <Button size="sm" variant="outline" onClick={() => void loadStaff()} disabled={loading || whoamiLoading}>
              Refresh
            </Button>
          </div>
        </div>

        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase font-semibold text-muted-foreground">Directory</div>
              <p className="text-sm text-muted-foreground">Assign platform role, region, and active status.</p>
            </div>
            {loading && <div className="text-xs text-muted-foreground">Loading…</div>}
          </div>

          <div className="grid gap-3">
            {filteredStaff.map((s) => (
              <div key={s.id} className="rounded border border-border p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-foreground">{s.email}</div>
                    <div className="text-xs text-muted-foreground">
                      {(s.firstName || s.lastName) ? `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim() : "—"}
                    </div>
                    <div className="text-[11px] text-muted-foreground space-x-2">
                      <span>Region: {s.platformRegion ?? s.region ?? "n/a"}</span>
                      <span>Role: {s.platformRole ?? "unassigned"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={s.platformRole ?? "unassigned"}
                      onValueChange={(value) =>
                        setStaff((prev) => prev.map((p) => (p.id === s.id ? { ...p, platformRole: value === "unassigned" ? null : value } : p)))
                      }
                    >
                      <SelectTrigger className="w-44 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {PLATFORM_ROLE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      className="h-8 w-28"
                      placeholder="Region"
                      value={s.platformRegion ?? ""}
                      onChange={(e) =>
                        setStaff((prev) => prev.map((p) => (p.id === s.id ? { ...p, platformRegion: e.target.value || null } : p)))
                      }
                    />
                    <Badge
                      variant={s.platformActive === false ? "destructive" : "secondary"}
                      className="cursor-pointer"
                      onClick={() =>
                        setStaff((prev) => prev.map((p) => (p.id === s.id ? { ...p, platformActive: p.platformActive === false ? true : false } : p)))
                      }
                    >
                      {s.platformActive === false ? "Inactive" : "Active"}
                    </Badge>
                    <Button size="sm" onClick={() => void saveStaff(s)} disabled={savingId === s.id || !canManage}>
                      {savingId === s.id ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {!loading && filteredStaff.length === 0 && (
              <div className="rounded border border-border bg-muted p-3 text-sm text-muted-foreground">
                No platform staff found{regionFilter !== "all" ? " for this region" : ""}.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}


