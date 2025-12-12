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
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
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
              <h2 className="text-2xl font-bold text-slate-900">Welcome to Camp Everyday Host</h2>
              <p className="text-slate-600">Select a campground from the dropdown to get started.</p>
            </div>
          </div>
        ) : null}

        {/* Hero */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {today.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })} ·{" "}
              {selectedCampground?.name ?? "Loading campground"}
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Front Desk Overview</h1>
            <p className="text-sm text-slate-600">
              Stay ahead of today’s arrivals, departures, balances, and quick actions.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/booking"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              New booking
            </Link>
            <Link
              href="/pos"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:border-emerald-200 hover:text-emerald-700 shadow-sm"
            >
              <ShoppingBag className="h-4 w-4" />
              Open POS
            </Link>
          </div>
        </div>

        {/* Ops strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          <OpsCard label="Arrivals" value={todayArrivals.length} href="/check-in-out" icon={<UserCheck className="h-4 w-4" />} tone="emerald" />
          <OpsCard label="Departures" value={todayDepartures.length} href="/check-in-out" icon={<LogOut className="h-4 w-4" />} tone="amber" />
          <OpsCard label="In-house" value={inHouse.length} href="/reservations" icon={<Users className="h-4 w-4" />} tone="blue" />
          <OpsCard label="Occupancy" value={`${occupancyRate}%`} href="/calendar" icon={<Calendar className="h-4 w-4" />} tone="purple" />
          <OpsCard label="Balance due" value={formatMoney(outstandingBalanceCents)} href="/billing/repeat-charges" icon={<DollarSign className="h-4 w-4" />} tone="rose" />
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

        {/* Attention rail & quick actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="card p-5 lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Attention</h3>
                <p className="text-sm text-slate-600">Balances and items that need a nudge.</p>
              </div>
              <span className="rounded-full bg-amber-50 text-amber-700 text-xs font-semibold px-3 py-1">
                {attentionList.length} open
              </span>
            </div>
            {attentionList.length === 0 ? (
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                All clear — no outstanding balances right now.
              </div>
            ) : (
              <div className="space-y-2">
                {attentionList.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-amber-50 text-amber-700 font-semibold flex items-center justify-center text-xs">
                        {r.guest?.primaryFirstName?.[0] ?? "?"}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {r.guest?.primaryFirstName ?? "Guest"} {r.guest?.primaryLastName ?? ""}
                        </div>
                        <div className="text-xs text-slate-500">Site {r.siteId ?? "—"}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-amber-700">{formatMoney(r.balance)}</span>
                      <Link
                        href="/billing/repeat-charges"
                        className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
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
            <h3 className="text-lg font-semibold text-slate-900">Quick actions</h3>
            <div className="space-y-2">
              <QuickLink href="/booking" label="New booking" icon={<Plus className="h-4 w-4" />} />
              <QuickLink href="/reservations" label="Extend stay / Move site" icon={<ArrowRight className="h-4 w-4" />} />
              <QuickLink href="/pos" label="Open POS order" icon={<ShoppingBag className="h-4 w-4" />} />
              <QuickLink href="/finance/gift-cards" label="Issue credit / refund" icon={<DollarSign className="h-4 w-4" />} />
              <QuickLink href="/messages" label="Send pre-arrival" icon={<MessageCircle className="h-4 w-4" />} />
            </div>
          </div>
        </div>

        {/* Snapshot strip */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <StatCard label="Occupancy" value={`${occupancyRate}%`} hint={`${occupiedSites} of ${totalSites} sites`} icon={<Calendar className="h-4 w-4" />} />
          <StatCard label="Future bookings" value={futureReservations} hint="Upcoming arrivals" icon={<ClipboardList className="h-4 w-4" />} />
          <StatCard label="Balance due" value={formatMoney(outstandingBalanceCents)} hint="Outstanding across stays" icon={<DollarSign className="h-4 w-4" />} />
          <StatCard label="On-site now" value={inHouse.length} hint="Currently in-house" icon={<Users className="h-4 w-4" />} />
          <StatCard
            label="NPS"
            value={npsQuery.data?.nps ?? "—"}
            hint={`${npsQuery.data?.totalResponses ?? 0} responses · ${npsQuery.data?.responseRate ?? "—"}% rate`}
            icon={<MessageCircle className="h-4 w-4" />}
          />
        </div>

        {/* Recent activity */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Recent activity</h3>
              <p className="text-sm text-slate-600">Latest arrivals, departures, and moves.</p>
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
  const toneMap: Record<typeof tone, string> = {
    emerald: "from-emerald-50 to-emerald-100 text-emerald-800 border-emerald-100",
    amber: "from-amber-50 to-amber-100 text-amber-800 border-amber-100",
    blue: "from-blue-50 to-blue-100 text-blue-800 border-blue-100",
    purple: "from-purple-50 to-purple-100 text-purple-800 border-purple-100",
    rose: "from-rose-50 to-rose-100 text-rose-800 border-rose-100"
  };

  return (
    <Link
      href={href}
      className={`card flex items-center justify-between gap-3 border ${toneMap[tone]} bg-gradient-to-br p-4 hover:shadow-md transition`}
    >
      <div className="flex items-center gap-3">
        <span className="rounded-lg bg-white/70 p-2 text-slate-700">{icon}</span>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
          <div className="text-xl font-bold text-slate-900">{value}</div>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-slate-400" />
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
  const color = tone === "emerald" ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50";
  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-600">{count} scheduled</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${color}`}>{count}</span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
          No {title.toLowerCase()} today.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.slice(0, 6).map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-slate-100 text-slate-700 font-semibold flex items-center justify-center text-xs">
                  {r.guest?.primaryFirstName?.[0] ?? "?"}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {r.guest?.primaryFirstName ?? "Guest"} {r.guest?.primaryLastName ?? ""}
                  </div>
                  <div className="text-xs text-slate-500">Site {r.siteId ?? "—"}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">{r.status ?? "Pending"}</div>
                <div className="text-xs text-slate-500 flex items-center justify-end gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {new Date(r.arrivalDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Link href={ctaHref} className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 hover:text-emerald-700">
        {ctaLabel} <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function QuickLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 hover:border-emerald-200 hover:text-emerald-700"
    >
      <span className="flex items-center gap-2">
        <span className="text-slate-500">{icon}</span>
        {label}
      </span>
      <ArrowRight className="h-4 w-4 text-slate-300" />
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
    <div className="card p-4 border border-slate-100 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
        <span className="rounded-md bg-slate-50 p-2 text-slate-500">{icon}</span>
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{hint}</div>
    </div>
  );
}

function ActivityList({ title, rows, tone }: { title: string; rows: Reservation[]; tone: "emerald" | "amber" }) {
  const accent = tone === "emerald" ? "text-emerald-700" : "text-amber-700";
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className={`text-xs font-semibold ${accent}`}>{rows.length}</div>
      </div>
      {rows.length === 0 ? (
        <div className="px-3 py-4 text-sm text-slate-500">No activity yet.</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-700 font-semibold flex items-center justify-center text-xs">
                  {r.guest?.primaryFirstName?.[0] ?? "?"}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {r.guest?.primaryFirstName ?? "Guest"} {r.guest?.primaryLastName ?? ""}
                  </div>
                  <div className="text-xs text-slate-500">Site {r.siteId ?? "—"}</div>
                </div>
              </div>
              <div className="text-right text-xs text-slate-500">
                {new Date(r.arrivalDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

