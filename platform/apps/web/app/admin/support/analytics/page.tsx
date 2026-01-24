"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useWhoami } from "@/hooks/use-whoami";
import { useToast } from "@/components/ui/use-toast";

// Avoid pre-render/SSR mismatch; render this page fully on the client.
export const dynamic = "force-dynamic";

type SlaRow = {
  region: string;
  campgroundId?: string | null;
  campgroundName?: string | null;
  onTime: number;
  overdue: number;
  slaTargetHours: number;
};

type VolumeRow = { category: string; count: number };

type AttentionRow = {
  id: string;
  title: string;
  region: string;
  campgroundId?: string | null;
  campgroundName?: string | null;
  status: "overdue" | "at-risk";
  category?: string | null;
  reportedAt: string;
  slaBreachedMinutes?: number;
  assignee?: string | null;
};

type AnalyticsResponse = {
  generatedAt: string;
  source?: string;
  region?: string;
  campgroundId?: string | null;
  slaSummary: SlaRow[];
  volumesByCategory: VolumeRow[];
  needsAttention: AttentionRow[];
};

const percent = (value: number) => Math.round((value || 0) * 100);

export default function SupportAnalyticsPage() {
  const { toast } = useToast();
  const { data: whoami, isLoading: whoamiLoading } = useWhoami();
  const [hydrated, setHydrated] = useState(false);
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [campgroundId, setCampgroundId] = useState<string>("");
  const [payload, setPayload] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const user = whoami?.user;
  const hasMembership = (user?.memberships?.length ?? 0) > 0;
  const platformRole = user?.platformRole;
  const supportAllowed =
    whoami?.allowed?.supportRead ||
    whoami?.allowed?.supportAssign ||
    whoami?.allowed?.supportAnalytics;
  const allowSupport = !!supportAllowed && (!!platformRole || hasMembership);
  const viewerRegion = user?.platformRegion ?? user?.region ?? null;
  const regionAllowed = regionFilter === "all" || !viewerRegion || viewerRegion === regionFilter;
  const campgroundAllowed =
    !campgroundId ||
    platformRole ||
    user?.memberships?.some((m) => m.campgroundId === campgroundId);
  const inScope = allowSupport && regionAllowed && campgroundAllowed;

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("campreserv:selectedCampground");
    if (stored) setCampgroundId(stored);
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (regionFilter !== "all") qs.set("region", regionFilter);
      if (campgroundId) qs.set("campgroundId", campgroundId);
      const res = await fetch(`/api/support/analytics${qs.toString() ? `?${qs.toString()}` : ""}`);
      if (!res.ok) throw new Error(`Failed to load analytics (${res.status})`);
      const data: AnalyticsResponse = await res.json();
      setPayload(data);
    } catch (err: unknown) {
      setPayload(null);
      const message = err instanceof Error ? err.message : "Failed to load analytics";
      setError(message);
      toast({
        title: "Support analytics unavailable",
        description: message || "Try again later",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (whoamiLoading) return;
    if (!inScope) {
      setPayload(null);
      setLoading(false);
      return;
    }
    void loadAnalytics();
  }, [regionFilter, campgroundId, whoamiLoading, inScope]);

  const totals = useMemo(() => {
    if (!payload?.slaSummary?.length) return { onTime: 0, overdue: 0, compliance: 1 };
    const agg = payload.slaSummary.reduce(
      (acc, row) => ({ onTime: acc.onTime + row.onTime, overdue: acc.overdue + row.overdue }),
      { onTime: 0, overdue: 0 },
    );
    const total = agg.onTime + agg.overdue;
    return { ...agg, compliance: total === 0 ? 1 : agg.onTime / total };
  }, [payload]);

  const needsAttention = useMemo(
    () =>
      (payload?.needsAttention || [])
        .slice()
        .sort((a, b) => new Date(a.reportedAt).getTime() - new Date(b.reportedAt).getTime()),
    [payload],
  );

  const regionOptions = useMemo(
    () => [
      { value: "all", label: "All regions" },
      { value: "north", label: "North" },
      { value: "south", label: "South" },
      { value: "east", label: "East" },
      { value: "west", label: "West" },
    ],
    [],
  );

  const ready = hydrated && !whoamiLoading;

  // Avoid hydration mismatches by deferring render until mounted
  if (!hydrated) return null;

  if (!ready) {
    return (
      <div>
        <div className="p-4 text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!allowSupport) {
    return (
      <div>
        <div className="space-y-3">
          <div className="text-xs uppercase font-semibold text-muted-foreground">Support</div>
          <h1 className="text-2xl font-bold text-foreground">Support analytics</h1>
          <div className="rounded-lg border border-status-warning/30 bg-status-warning/15 text-status-warning p-4">
            You do not have permission to view support analytics.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs uppercase font-semibold text-muted-foreground">Support</div>
            <h1 className="text-2xl font-bold text-foreground">Support analytics</h1>
            <p className="text-sm text-muted-foreground">
              SLA compliance by region/campground, category volume, and a list of tickets that need
              attention.
            </p>
            <div className="text-xs text-muted-foreground mt-1">
              Scope: {regionAllowed ? regionFilter : "out-of-scope region"} •{" "}
              {campgroundAllowed ? campgroundId || "all campgrounds" : "out-of-scope campground"}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
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
              placeholder="Campground ID (optional)"
              className="h-8 w-48"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => void loadAnalytics()}
              disabled={loading || whoamiLoading || !inScope}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </Button>
            {payload?.source && (
              <Badge variant="outline">
                {payload.source === "stub" ? "Stub data" : payload.source}
              </Badge>
            )}
          </div>
        </div>

        {!regionAllowed || !campgroundAllowed ? (
          <div className="rounded-lg border border-status-warning/30 bg-status-warning/15 text-status-warning p-4">
            You are out of scope for this region/campground selection. Adjust filters to view
            analytics.
          </div>
        ) : null}

        {loading && <div className="p-4 text-sm text-muted-foreground">Loading analytics…</div>}
        {error && <div className="p-4 text-sm text-rose-600">{error}</div>}

        {inScope && payload && !loading && (
          <div className="grid gap-4">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>SLA compliance</CardTitle>
                <div className="text-xs text-muted-foreground">
                  Updated {new Date(payload.generatedAt).toLocaleString()}
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                <div className="rounded border border-border p-3">
                  <div className="text-xs uppercase text-muted-foreground">Compliance</div>
                  <div className="text-2xl font-bold text-foreground">
                    {percent(totals.compliance)}%
                  </div>
                  <Progress value={totals.compliance * 100} className="mt-2" />
                </div>
                <div className="rounded border border-border p-3">
                  <div className="text-xs uppercase text-muted-foreground">On-time</div>
                  <div className="text-2xl font-bold text-status-success">{totals.onTime}</div>
                  <div className="text-xs text-muted-foreground">Resolved within SLA</div>
                </div>
                <div className="rounded border border-border p-3">
                  <div className="text-xs uppercase text-muted-foreground">Overdue</div>
                  <div className="text-2xl font-bold text-status-error">{totals.overdue}</div>
                  <div className="text-xs text-muted-foreground">Past SLA target</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Per-region / campground SLA</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Region</TableHead>
                      <TableHead>Campground</TableHead>
                      <TableHead className="text-right">On-time</TableHead>
                      <TableHead className="text-right">Overdue</TableHead>
                      <TableHead className="text-right">Compliance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(payload.slaSummary || []).map((row) => {
                      const total = row.onTime + row.overdue;
                      const compliance = total === 0 ? 1 : row.onTime / total;
                      return (
                        <TableRow key={`${row.region}-${row.campgroundId || "all"}`}>
                          <TableCell className="font-medium capitalize">{row.region}</TableCell>
                          <TableCell>{row.campgroundName || row.campgroundId || "—"}</TableCell>
                          <TableCell className="text-right text-status-success">
                            {row.onTime}
                          </TableCell>
                          <TableCell className="text-right text-status-error">
                            {row.overdue}
                          </TableCell>
                          <TableCell className="text-right w-48">
                            <div className="flex items-center gap-2 justify-end">
                              <Progress value={compliance * 100} className="w-28" />
                              <span className="text-xs text-muted-foreground">
                                {percent(compliance)}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {payload.slaSummary.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-sm text-muted-foreground">
                          No SLA data for this scope.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Volume by category</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Volume</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(payload.volumesByCategory || []).map((row) => (
                      <TableRow key={row.category}>
                        <TableCell>{row.category}</TableCell>
                        <TableCell className="text-right">{row.count}</TableCell>
                      </TableRow>
                    ))}
                    {payload.volumesByCategory.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2} className="text-sm text-muted-foreground">
                          No category volume yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Needs attention</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {needsAttention.length === 0 && (
                  <div className="text-sm text-muted-foreground">Nothing flagged right now.</div>
                )}
                {needsAttention.map((item) => (
                  <div key={item.id} className="rounded border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-foreground">{item.title}</div>
                      <Badge variant={item.status === "overdue" ? "destructive" : "secondary"}>
                        {item.status === "overdue" ? "Overdue" : "At risk"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>Region: {item.region}</span>
                      {item.campgroundName || item.campgroundId ? (
                        <span>Campground: {item.campgroundName || item.campgroundId}</span>
                      ) : null}
                      {item.category && <span>Category: {item.category}</span>}
                      <span>Reported: {new Date(item.reportedAt).toLocaleString()}</span>
                      {item.slaBreachedMinutes ? (
                        <span>SLA breach: {item.slaBreachedMinutes}m</span>
                      ) : null}
                      {item.assignee ? (
                        <span>Owner: {item.assignee}</span>
                      ) : (
                        <span>Owner: Unassigned</span>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
