"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Calendar,
  CheckCircle,
  ClipboardList,
  Clock,
  DollarSign,
  LogOut,
  MessageCircle,
  Plus,
  ShoppingBag,
  UserCheck,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { PageHeader } from "@/components/ui/layout/PageHeader";
import { apiClient } from "@/lib/api-client";

type Reservation = {
  id: string;
  arrivalDate: string;
  departureDate: string;
  status?: string;
  totalAmount?: number;
  paidAmount?: number;
  siteId?: string;
  guest?: {
    primaryFirstName?: string;
    primaryLastName?: string;
  };
};

export default function DashboardV2() {
  const { data: campgrounds = [] } = useQuery({
    queryKey: ["campgrounds"],
    queryFn: () => apiClient.getCampgrounds()
  });

  const selectedCampground = campgrounds[0];
  const selectedId = selectedCampground?.id;

  const reservationsQuery = useQuery({
    queryKey: ["reservations", selectedId],
    queryFn: () => apiClient.getReservations(selectedId ?? ""),
    enabled: !!selectedId
  });

  const sitesQuery = useQuery({
    queryKey: ["sites", selectedId],
    queryFn: () => apiClient.getSites(selectedId ?? ""),
    enabled: !!selectedId
  });

  const npsQuery = useQuery({
    queryKey: ["nps-metrics", selectedId],
    queryFn: () => apiClient.getNpsMetrics(selectedId ?? ""),
    enabled: !!selectedId
  });

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const reservations = reservationsQuery.data as Reservation[] | undefined;

  const todayArrivals = useMemo(() => {
    if (!reservations) return [];
    return reservations.filter((r) => {
      const arrival = new Date(r.arrivalDate);
      arrival.setHours(0, 0, 0, 0);
      return arrival.getTime() === today.getTime() && r.status !== "cancelled";
    });
  }, [reservations, today]);

  const todayDepartures = useMemo(() => {
    if (!reservations) return [];
    return reservations.filter((r) => {
      const departure = new Date(r.departureDate);
      departure.setHours(0, 0, 0, 0);
      return departure.getTime() === today.getTime() && r.status !== "cancelled";
    });
  }, [reservations, today]);

  const inHouse = useMemo(() => {
    if (!reservations) return [];
    return reservations.filter((r) => {
      const arrival = new Date(r.arrivalDate);
      const departure = new Date(r.departureDate);
      return arrival <= today && departure > today && r.status !== "cancelled";
    });
  }, [reservations, today]);

  const totalSites = sitesQuery.data?.length ?? 0;
  const occupiedSites = inHouse.length;
  const occupancyRate = totalSites > 0 ? Math.round((occupiedSites / totalSites) * 100) : 0;

  const outstandingBalanceCents =
    reservations?.reduce((sum, r) => {
      const balance = (r.totalAmount ?? 0) - (r.paidAmount ?? 0);
      return sum + (balance > 0 ? balance : 0);
    }, 0) ?? 0;

  const futureReservations =
    reservations?.filter((r) => new Date(r.arrivalDate) > today && r.status !== "cancelled").length ?? 0;

  const formatMoney = (cents?: number) =>
    `$${((cents ?? 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const attentionList = useMemo(() => {
    if (!reservations) return [];
    return reservations
      .map((r) => ({
        ...r,
        balance: (r.totalAmount ?? 0) - (r.paidAmount ?? 0)
      }))
      .filter((r) => (r.balance ?? 0) > 0)
      .sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0))
      .slice(0, 4);
  }, [reservations]);

  return (
    <DashboardShell>
      <div className="space-y-6">
        {!selectedCampground ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Welcome to Keepr</h2>
              <p className="text-muted-foreground">Select a campground from the dropdown to get started.</p>
            </div>
          </div>
        ) : null}

        <PageHeader
          eyebrow={`${today.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })} · ${
            selectedCampground?.name ?? "Loading campground"
          }`}
          title="Today at a glance"
          subtitle="Arrivals, departures, occupancy, and balances for the front desk."
          actions={
            <>
              <Button asChild className="gap-2">
                <Link href="/booking">
                  <Plus className="h-4 w-4" />
                  New booking
                </Link>
              </Button>
              <Button asChild variant="outline" className="gap-2">
                <Link href="/pos">
                  <ShoppingBag className="h-4 w-4" />
                  Open POS
                </Link>
              </Button>
            </>
          }
        />

        {/* Ops strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          <OpsCard label="Arrivals" value={todayArrivals.length} href="/check-in-out" icon={<UserCheck className="h-4 w-4" />} tone="emerald" />
          <OpsCard label="Departures" value={todayDepartures.length} href="/check-in-out" icon={<LogOut className="h-4 w-4" />} tone="amber" />
          <OpsCard label="In-house" value={inHouse.length} href="/reservations" icon={<Users className="h-4 w-4" />} tone="blue" />
          <OpsCard label="Occupancy" value={`${occupancyRate}%`} href="/calendar" icon={<Calendar className="h-4 w-4" />} tone="purple" />
          <OpsCard label="Balance due" value={formatMoney(outstandingBalanceCents)} href="/billing/repeat-charges" icon={<DollarSign className="h-4 w-4" />} tone="rose" />
        </div>

        {/* Quick Actions - Prominently displayed above the fold */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Plus className="h-4 w-4 text-action-primary" />
            Action queue
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            <QuickActionButton
              href="/booking"
              label="New booking"
              icon={<Plus className="h-5 w-5" />}
              tone="emerald"
            />
            <QuickActionButton
              href="/reservations"
              label="Extend / Move"
              icon={<ArrowRight className="h-5 w-5" />}
              tone="blue"
            />
            <QuickActionButton
              href="/pos"
              label="POS order"
              icon={<ShoppingBag className="h-5 w-5" />}
              tone="purple"
            />
            <QuickActionButton
              href="/finance/gift-cards"
              label="Credit / Refund"
              icon={<DollarSign className="h-5 w-5" />}
              tone="amber"
            />
            <QuickActionButton
              href="/messages"
              label="Pre-arrival message"
              icon={<MessageCircle className="h-5 w-5" />}
              tone="slate"
            />
          </div>
        </div>

        {/* Arrivals / Departures board */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BoardCard
            title="Arrivals"
            count={todayArrivals.length}
            ctaLabel="Open arrivals"
            ctaHref="/check-in-out"
            rows={todayArrivals}
          />
          <BoardCard
            title="Departures"
            count={todayDepartures.length}
            ctaLabel="Open departures"
            ctaHref="/check-in-out"
            rows={todayDepartures}
            tone="amber"
          />
        </div>

        {/* Attention rail and Additional Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="card p-5 space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Attention</h3>
                <p className="text-sm text-muted-foreground">Balances and items that need a nudge.</p>
              </div>
              <span className="rounded-full bg-status-warning-bg text-status-warning-text text-xs font-semibold px-3 py-1">
                {attentionList.length} open
              </span>
            </div>
            {attentionList.length === 0 ? (
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-status-success" />
                All clear — no outstanding balances right now.
              </div>
            ) : (
              <div className="space-y-2">
                {attentionList.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-status-warning-bg text-status-warning-text font-semibold flex items-center justify-center text-xs">
                        {r.guest?.primaryFirstName?.[0] ?? "?"}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground">
                          {r.guest?.primaryFirstName ?? "Guest"} {r.guest?.primaryLastName ?? ""}
                        </div>
                        <div className="text-xs text-muted-foreground">Site {r.siteId ?? "—"}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-status-warning-text">{formatMoney(r.balance)}</span>
                      <Link
                        href="/billing/repeat-charges"
                        className="text-xs font-semibold text-action-primary hover:text-action-primary-hover"
                      >
                        Resolve
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-5 space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Additional Metrics</h3>
            <div className="space-y-2">
              <StatCard label="Future bookings" value={futureReservations} hint="Upcoming arrivals" icon={<ClipboardList className="h-4 w-4" />} />
              <StatCard
                label="NPS"
                value={npsQuery.data?.nps ?? "—"}
                hint={`${npsQuery.data?.totalResponses ?? 0} responses · ${npsQuery.data?.responseRate ?? "—"}% rate`}
                icon={<MessageCircle className="h-4 w-4" />}
              />
            </div>
          </div>
        </div>

        {/* Recent activity */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Recent activity</h3>
              <p className="text-sm text-muted-foreground">Latest arrivals, departures, and moves.</p>
            </div>
            <Link href="/reservations" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
              View reservations <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ActivityList title="Arrivals" tone="emerald" rows={todayArrivals.slice(0, 6)} />
            <ActivityList title="Departures" tone="amber" rows={todayDepartures.slice(0, 6)} />
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

function OpsCard({
  label,
  value,
  href,
  icon,
  tone
}: {
  label: string;
  value: string | number;
  href: string;
  icon: React.ReactNode;
  tone: "emerald" | "amber" | "blue" | "purple" | "rose";
}) {
  const toneMap: Record<typeof tone, { bg: string; border: string; icon: string; value: string }> = {
    emerald: {
      bg: "bg-status-success-bg",
      border: "border-status-success-border",
      icon: "text-status-success",
      value: "text-foreground"
    },
    amber: {
      bg: "bg-status-warning-bg",
      border: "border-status-warning-border",
      icon: "text-status-warning",
      value: "text-foreground"
    },
    blue: {
      bg: "bg-status-info-bg",
      border: "border-status-info-border",
      icon: "text-status-info",
      value: "text-foreground"
    },
    purple: {
      bg: "bg-muted/40",
      border: "border-border",
      icon: "text-violet-500",
      value: "text-foreground"
    },
    rose: {
      bg: "bg-status-error-bg",
      border: "border-status-error-border",
      icon: "text-status-error",
      value: "text-foreground"
    }
  };

  const toneStyles = toneMap[tone];

  return (
    <Link
      href={href}
      className={`card flex items-center justify-between gap-3 ${toneStyles.bg} ${toneStyles.border} p-4 hover:shadow-md transition`}
    >
      <div className="flex items-center gap-3">
        <span className={`rounded-lg bg-background/80 p-2 ${toneStyles.icon}`}>{icon}</span>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className={`text-xl font-bold ${toneStyles.value}`}>{value}</div>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground/70" />
    </Link>
  );
}

function BoardCard({
  title,
  count,
  ctaLabel,
  ctaHref,
  rows,
  tone = "emerald"
}: {
  title: string;
  count: number;
  ctaLabel: string;
  ctaHref: string;
  rows: Reservation[];
  tone?: "emerald" | "amber";
}) {
  const color = tone === "emerald" ? "text-status-success-text bg-status-success-bg" : "text-status-warning-text bg-status-warning-bg";
  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{count} scheduled</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${color}`}>{count}</span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
          No {title.toLowerCase()} today.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.slice(0, 6).map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-muted text-foreground font-semibold flex items-center justify-center text-xs">
                  {r.guest?.primaryFirstName?.[0] ?? "?"}
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    {r.guest?.primaryFirstName ?? "Guest"} {r.guest?.primaryLastName ?? ""}
                  </div>
                  <div className="text-xs text-muted-foreground">Site {r.siteId ?? "—"}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">{r.status ?? "Pending"}</div>
                <div className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {new Date(r.arrivalDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Link href={ctaHref} className="inline-flex items-center gap-1 text-sm font-semibold text-action-primary hover:text-action-primary-hover">
        {ctaLabel} <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function QuickActionButton({
  href,
  label,
  icon,
  tone
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  tone: "emerald" | "blue" | "purple" | "amber" | "slate";
}) {
  const toneMap: Record<typeof tone, string> = {
    emerald: "text-status-success",
    blue: "text-status-info",
    purple: "text-violet-500",
    amber: "text-status-warning",
    slate: "text-muted-foreground"
  };

  const iconColor = toneMap[tone];

  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-5 text-center transition-all shadow-sm hover:shadow-md hover:bg-muted/50"
    >
      <span className={`rounded-lg bg-muted/40 p-2 ${iconColor}`}>{icon}</span>
      <span className="text-sm font-semibold text-foreground">{label}</span>
    </Link>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="card p-4 border border-border/60 bg-card shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
        <span className="rounded-md bg-muted/40 p-2 text-muted-foreground">{icon}</span>
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{hint}</div>
    </div>
  );
}

function ActivityList({ title, rows, tone }: { title: string; rows: Reservation[]; tone: "emerald" | "amber" }) {
  const accent = tone === "emerald" ? "text-status-success-text" : "text-status-warning-text";
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className={`text-xs font-semibold ${accent}`}>{rows.length}</div>
      </div>
      {rows.length === 0 ? (
        <div className="px-3 py-4 text-sm text-muted-foreground">No activity yet.</div>
      ) : (
        <div className="divide-y divide-border/60">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted text-foreground font-semibold flex items-center justify-center text-xs">
                  {r.guest?.primaryFirstName?.[0] ?? "?"}
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    {r.guest?.primaryFirstName ?? "Guest"} {r.guest?.primaryLastName ?? ""}
                  </div>
                  <div className="text-xs text-muted-foreground">Site {r.siteId ?? "—"}</div>
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                {new Date(r.arrivalDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
