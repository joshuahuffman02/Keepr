"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "../../components/ui/layout/DashboardShell";
import { Breadcrumbs } from "../../components/breadcrumbs";
import { Button } from "../../components/ui/button";
import { useToast } from "../../components/ui/use-toast";
import { HelpAnchor } from "../../components/help/HelpAnchor";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";
import { apiClient } from "../../lib/api-client";
import { saveReport } from "@/components/reports/savedReports";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FileDown, Calendar, FileSpreadsheet, X, Info, ChevronDown, ChevronUp, LayoutList, TrendingUp, Users, BarChart3, Megaphone, LineChart, Calculator, ClipboardList, ExternalLink } from "lucide-react";

import { BookingSourcesTab } from "../../components/reports/BookingSourcesTab";
import { GuestOriginsTab } from "../../components/reports/GuestOriginsTab";
import { HeatmapCard } from "../../components/reports/HeatmapCard";
import { resolvePoints } from "../../components/reports/heatmap-utils";
import { recordTelemetry } from "../../lib/sync-telemetry";

type ReportTab = 'overview' | 'daily' | 'revenue' | 'performance' | 'guests' | 'marketing' | 'forecasting' | 'accounting' | 'audits' | 'booking-sources' | 'guest-origins';

type SubTab = {
  id: string;
  label: string;
  description?: string;
};

const subTabs: Record<Exclude<ReportTab, 'overview' | 'audits'>, SubTab[]> = {
  daily: [
    { id: 'daily-summary', label: 'Daily summary', description: 'Today’s pickup, arrivals, departures' },
    { id: 'transaction-log', label: 'Transaction log', description: 'Payments, refunds, charges' }
  ],
  revenue: [
    { id: 'revenue-overview', label: 'Revenue overview', description: 'Gross/Net, ADR, RevPAR' },
    { id: 'revenue-by-source', label: 'By source/channel', description: 'Online vs admin vs kiosk' }
  ],
  performance: [
    { id: 'pace', label: 'Pace vs target', description: 'On-the-books vs goals' },
    { id: 'occupancy', label: 'Occupancy & ADR', description: 'Blend by date/site type' },
    { id: 'site-breakdown', label: 'Site breakdown', description: 'RevPAR, ADR, occupancy by site' }
  ],
  guests: [
    { id: 'guest-origins', label: 'Guest origins', description: 'State/ZIP mix' },
    { id: 'guest-behavior', label: 'Behavior', description: 'Lead time, LOS, cancellations' }
  ],
  marketing: [
    { id: 'booking-sources', label: 'Booking sources', description: 'Channel mix and revenue' },
    { id: 'campaigns', label: 'Campaigns', description: 'Promo usage and lift' }
  ],
  forecasting: [
    { id: 'revenue-forecast', label: 'Revenue forecast', description: 'Projected revenue vs last year' },
    { id: 'demand-outlook', label: 'Demand outlook', description: 'Pickup by week and seasonality' },
    { id: 'pickup', label: 'Pickup', description: 'Bookings/revenue vs prior window' },
    { id: 'peak-nonpeak', label: 'Peak vs non-peak', description: 'Performance by season' }
  ],
  accounting: [
    { id: 'ledger', label: 'Ledger summary', description: 'GL net and exports' },
    { id: 'aging', label: 'Aging', description: 'AR buckets and overdue' }
  ],
  'booking-sources': [],
  'guest-origins': []
};

// Full report catalog for discoverability
const reportCatalog = [
  {
    id: 'overview',
    label: 'Overview',
    icon: LayoutList,
    description: 'High-level KPIs and trends at a glance',
    subReports: [{ label: 'Dashboard summary', description: 'Revenue, occupancy, ADR, RevPAR' }]
  },
  {
    id: 'daily',
    label: 'Daily Operations',
    icon: Calendar,
    description: 'Day-to-day arrivals, departures, and transactions',
    subReports: subTabs.daily
  },
  {
    id: 'revenue',
    label: 'Revenue',
    icon: TrendingUp,
    description: 'Detailed revenue analysis and breakdowns',
    subReports: subTabs.revenue
  },
  {
    id: 'performance',
    label: 'Performance',
    icon: BarChart3,
    description: 'Site and property performance metrics',
    subReports: subTabs.performance
  },
  {
    id: 'guests',
    label: 'Guests',
    icon: Users,
    description: 'Guest demographics and behavior patterns',
    subReports: subTabs.guests
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    description: 'Booking sources and campaign effectiveness',
    subReports: subTabs.marketing
  },
  {
    id: 'forecasting',
    label: 'Forecasting',
    icon: LineChart,
    description: 'Projections and demand predictions',
    subReports: subTabs.forecasting
  },
  {
    id: 'accounting',
    label: 'Accounting',
    icon: Calculator,
    description: 'Financial ledgers and aging reports',
    subReports: subTabs.accounting
  },
  {
    id: 'audits',
    label: 'Audits',
    icon: ClipboardList,
    description: 'Activity logs and compliance tracking',
    subReports: [{ label: 'Audit log', description: 'All system activity' }]
  }
];

const formatCurrency = (value: number, decimals: number = 0) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

function ReportsPageInner() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [activeSubTab, setActiveSubTab] = useState<string | null>(null);
  const [pickupFilters, setPickupFilters] = useState({
    comparisonA: new Date().toISOString().slice(0, 10),
    comparisonB: (() => {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return d.toISOString().slice(0, 10);
    })(),
    occupancyStart: new Date().toISOString().slice(0, 10),
    interval: 'weekly' as 'weekly' | 'daily',
    include: 'all' as 'all' | 'confirmed' | 'paid',
    activityOnly: true,
    siteClassId: 'all'
  });
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10)
    };
  });
  const [showActivePromos, setShowActivePromos] = useState(false);

  // Export confirmation dialog state
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportPreview, setExportPreview] = useState<{
    reportName: string;
    subReportName: string | null;
    dateRange: { start: string; end: string };
    rowCount: number;
    tabName: string;
  } | null>(null);

  // Report catalog panel state
  const [showCatalog, setShowCatalog] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("campreserv:selectedCampground");
    if (stored) setCampgroundId(stored);

    const urlTab = searchParams.get("tab") as ReportTab | null;
    const urlSub = searchParams.get("sub");
    const urlStart = searchParams.get("start");
    const urlEnd = searchParams.get("end");
    if (urlTab) setActiveTab(urlTab);
    if (urlSub) setActiveSubTab(urlSub);
    if (urlStart || urlEnd) {
      setDateRange((prev) => ({
        start: urlStart || prev.start,
        end: urlEnd || prev.end
      }));
    }
  }, [searchParams]);

  const enableAnalyticsMaps = process.env.NEXT_PUBLIC_ENABLE_ANALYTICS_MAPS !== "false";

  // Ensure sub-tab defaults to first available for the active tab
  useEffect(() => {
    if (activeTab === 'overview' || activeTab === 'audits') {
      setActiveSubTab(null);
      return;
    }
    const subs = subTabs[activeTab as keyof typeof subTabs] || [];
    if (subs.length === 0) {
      setActiveSubTab(null);
      return;
    }
    const exists = subs.some((s) => s.id === activeSubTab);
    if (!exists) {
      setActiveSubTab(subs[0].id);
    }
  }, [activeTab, activeSubTab]);

  const campgroundQuery = useQuery({
    queryKey: ["campground", campgroundId],
    queryFn: () => apiClient.getCampground(campgroundId!),
    enabled: !!campgroundId
  });

  const summaryQuery = useQuery({
    queryKey: ["reports-summary", campgroundId],
    queryFn: () => apiClient.getDashboardSummary(campgroundId!),
    enabled: !!campgroundId
  });

  const agingQuery = useQuery({
    queryKey: ["reports-aging", campgroundId],
    queryFn: () => apiClient.getAging(campgroundId!),
    enabled: !!campgroundId
  });

  const ledgerSummaryQuery = useQuery({
    queryKey: ["reports-ledger-summary", campgroundId],
    queryFn: () => apiClient.getLedgerSummary(campgroundId!, {}),
    enabled: !!campgroundId
  });

  const npsMetricsQuery = useQuery({
    queryKey: ["nps-metrics", campgroundId],
    queryFn: () => apiClient.getNpsMetrics(campgroundId!),
    enabled: !!campgroundId
  });

  const reservationsQuery = useQuery({
    queryKey: ["reservations", campgroundId],
    queryFn: () => apiClient.getReservations(campgroundId!),
    enabled: !!campgroundId
  });

  const sitesQuery = useQuery({
    queryKey: ["sites", campgroundId],
    queryFn: () => apiClient.getSites(campgroundId!),
    enabled: !!campgroundId
  });

  const promotionsQuery = useQuery({
    queryKey: ["reports-promotions", campgroundId],
    queryFn: () => apiClient.getPromotions(campgroundId!),
    enabled: !!campgroundId && activeTab === "marketing"
  });

  const promoRedemptions = useMemo(() => {
    if (!reservationsQuery.data) return [];
    const start = dateRange.start ? new Date(dateRange.start) : null;
    const end = dateRange.end ? new Date(dateRange.end) : null;

    const map = new Map<string, { uses: number; revenue: number }>();
    reservationsQuery.data.forEach((res: any) => {
      const code = res.promoCode ? String(res.promoCode).toUpperCase() : null;
      if (!code) return;

      const arrival = res.arrivalDate ? new Date(res.arrivalDate) : null;
      const created = res.createdAt ? new Date(res.createdAt) : null;
      const cmpDate = arrival || created;
      if (start && cmpDate && cmpDate < start) return;
      if (end) {
        const endOfDay = new Date(end);
        endOfDay.setHours(23, 59, 59, 999);
        if (cmpDate && cmpDate > endOfDay) return;
      }

      const rev = (res.totalAmount ?? res.total ?? 0) / 100;
      const entry = map.get(code) || { uses: 0, revenue: 0 };
      entry.uses += 1;
      entry.revenue += rev;
      map.set(code, entry);
    });
    return Array.from(map.entries())
      .map(([code, stats]) => ({ code, ...stats }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [reservationsQuery.data]);

  const cards = useMemo(() => {
    if (!summaryQuery.data) return [];
    const s = summaryQuery.data;
    return [
      { label: "Revenue (30d)", value: formatCurrency(s.revenue) },
      { label: "ADR", value: formatCurrency(s.adr) },
      { label: "RevPAR", value: formatCurrency(s.revpar) },
      { label: "Occupancy", value: `${s.occupancy}%` },
      { label: "Future reservations", value: s.futureReservations },
      { label: "Sites", value: s.sites },
      { label: "Overdue balance", value: formatCurrency(s.overdueBalance) },
      { label: "Maintenance open", value: s.maintenanceOpen },
      { label: "Maintenance overdue", value: s.maintenanceOverdue }
    ];
  }, [summaryQuery.data]);

  // Reservation analytics filtered by date range
  const reservationStats = useMemo(() => {
    if (!reservationsQuery.data) return null;
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);

    const filtered = reservationsQuery.data.filter(r => {
      const arrival = new Date(r.arrivalDate);
      return arrival >= startDate && arrival <= endDate;
    });

    const byStatus = filtered.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalRevenue = filtered.reduce((sum, r) => sum + (r.totalAmount || 0), 0) / 100;
    const reservationsWithCreatedAt = filtered.filter(r => r.createdAt);
    const avgLeadTime = reservationsWithCreatedAt.length > 0
      ? reservationsWithCreatedAt.reduce((sum, r) => {
        const created = new Date(r.createdAt!);
        const arrival = new Date(r.arrivalDate);
        const days = Math.floor((arrival.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        return sum + days;
      }, 0) / reservationsWithCreatedAt.length
      : 0;

    return {
      total: filtered.length,
      byStatus,
      totalRevenue,
      avgLeadTime: Math.round(avgLeadTime)
    };
  }, [reservationsQuery.data, dateRange]);

  // Site performance analytics
  const sitePerformance = useMemo(() => {
    if (!reservationsQuery.data || !sitesQuery.data) return null;

    const siteRevenue = reservationsQuery.data.reduce((acc, r) => {
      if (r.status !== 'cancelled') {
        acc[r.siteId] = (acc[r.siteId] || 0) + (r.totalAmount || 0);
      }
      return acc;
    }, {} as Record<string, number>);

    const siteBookings = reservationsQuery.data.reduce((acc, r) => {
      if (r.status !== 'cancelled') {
        acc[r.siteId] = (acc[r.siteId] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return sitesQuery.data
      .map(site => ({
        name: site.name,
        revenue: (siteRevenue[site.id] || 0) / 100,
        bookings: siteBookings[site.id] || 0
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [reservationsQuery.data, sitesQuery.data]);

  // Revenue trends by month (last 12 months)
  const revenueTrends = useMemo(() => {
    if (!reservationsQuery.data) return null;

    const monthlyRevenue: Record<string, number> = {};
    const now = new Date();

    // Initialize last 12 months
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      monthlyRevenue[key] = 0;
    }

    reservationsQuery.data.forEach(r => {
      if (r.status !== 'cancelled') {
        const arrival = new Date(r.arrivalDate);
        const key = arrival.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        if (key in monthlyRevenue) {
          monthlyRevenue[key] += (r.totalAmount || 0) / 100;
        }
      }
    });

    return Object.entries(monthlyRevenue).map(([month, revenue]) => ({ month, revenue }));
  }, [reservationsQuery.data]);

  // Cancellation analytics
  const cancellationStats = useMemo(() => {
    if (!reservationsQuery.data) return null;

    const total = reservationsQuery.data.length;
    const cancelled = reservationsQuery.data.filter(r => r.status === 'cancelled').length;
    const rate = total > 0 ? (cancelled / total) * 100 : 0;

    const cancelledRevenueLost = reservationsQuery.data
      .filter(r => r.status === 'cancelled')
      .reduce((sum, r) => sum + (r.totalAmount || 0), 0) / 100;

    return {
      total: cancelled,
      rate: rate.toFixed(1),
      revenueLost: cancelledRevenueLost
    };
  }, [reservationsQuery.data]);

  const currentSubMeta = () => {
    const list = subTabs[activeTab as keyof typeof subTabs];
    if (!list || list.length === 0) return null;
    if (activeSubTab) {
      const match = list.find((s) => s.id === activeSubTab);
      if (match) return match;
    }
    return list[0];
  };

  const exportAgingDetailCsv = () => {
    if (!reservationsQuery.data) return;
    const rows = reservationsQuery.data
      .filter((r) => r.status !== 'cancelled')
      .map((r) => {
        const departure = new Date(r.departureDate || r.arrivalDate);
        const ageDays = Math.max(0, Math.floor((Date.now() - departure.getTime()) / (1000 * 60 * 60 * 24)));
        const bucket =
          ageDays <= 0 ? 'current' :
            ageDays <= 30 ? '1_30' :
              ageDays <= 60 ? '31_60' :
                ageDays <= 90 ? '61_90' : 'over_90';
        const balanceCents = Math.max(0, (r.balanceAmount ?? (r.totalAmount || 0) - (r.paidAmount || 0)));
        const guest = `"${(r as any).guest?.primaryFirstName || ''} ${(r as any).guest?.primaryLastName || ''}".trim()`;
        return {
          id: r.id,
          siteId: r.siteId,
          guest,
          arrival: r.arrivalDate,
          departure: r.departureDate,
          status: r.status,
          bucket,
          ageDays,
          balance: balanceCents / 100,
          total: (r.totalAmount || 0) / 100,
          paid: (r.paidAmount || 0) / 100
        };
      })
      .filter((r) => r.balance > 0);

    let csv = 'Reservation ID,Site,Guest,Arrival,Departure,Status,Bucket,Age Days,Balance,Total,Paid\n';
    rows.forEach((r) => {
      csv += `${r.id},${r.siteId},${r.guest},${r.arrival},${r.departure},${r.status},${r.bucket},${r.ageDays},${r.balance.toFixed(2)},${r.total.toFixed(2)},${r.paid.toFixed(2)}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aging-detail-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderDefaultSubSummary = () => {
    const meta = currentSubMeta();
    return (
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">{meta?.label || "Report"}</div>
            <div className="text-xs text-slate-500">{meta?.description || "Summary will appear when data is available."}</div>
          </div>
          <div className="text-xs text-slate-500">{dateRange.start} → {dateRange.end}</div>
        </div>
        <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Data not available yet for this sub-report. Run or refresh the report once data is ready.
        </div>
      </div>
    );
  };

  const renderSubReportContent = () => {
    const drText = `${dateRange.start} → ${dateRange.end}`;
    switch (activeTab) {
      case 'daily':
        if (activeSubTab === 'transaction-log' && ledgerSummaryQuery.data) {
          return (
            <div className="space-y-3">
              <div className="text-sm text-slate-600">GL net for {drText}</div>
              <div className="space-y-2">
                {ledgerSummaryQuery.data.map((row) => (
                  <div key={row.glCode} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <span className="text-slate-700">{row.glCode}</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(row.netCents / 100)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        if (reservationStats) {
          return (
            <div className="space-y-3">
              <div className="text-sm text-slate-600">Daily summary for {drText}</div>
              {pickupStats && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 shadow-inner">
                    <div className="text-xs text-emerald-700 mb-1">Bookings (last 7d)</div>
                    <div className="text-2xl font-bold text-emerald-900">{pickupStats.w7.current.count}</div>
                    <div className="text-sm text-emerald-800">Rev: {formatCurrency(pickupStats.w7.current.revenue, 0)}</div>
                    <div className="text-xs text-emerald-700">Occ: {((pickupStats.w7.current.count / pickupStats.activeSitesCount) * 100).toFixed(1)}%</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="text-xs text-slate-600 mb-1">vs prior 7d</div>
                    <div className={`text-xl font-bold ${pickupStats.w7.countDelta >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                      {pickupStats.w7.countDelta >= 0 ? '+' : ''}{pickupStats.w7.countDelta} bookings
                    </div>
                    <div className={`text-sm ${pickupStats.w7.revenueDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {pickupStats.w7.revenueDelta >= 0 ? '+' : ''}{formatCurrency(pickupStats.w7.revenueDelta, 0)} revenue
                    </div>
                  </div>
                  <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 shadow-inner">
                    <div className="text-xs text-indigo-700 mb-1">Future bookings (count)</div>
                    <div className="text-2xl font-bold text-indigo-900">{futureRevenue?.count ?? 0}</div>
                    <div className="text-sm text-indigo-800">Outstanding: {formatCurrency(futureRevenue?.outstanding ?? 0, 0)}</div>
                  </div>
                </div>
              )}
              {pickupStats && (
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Window</th>
                        <th className="px-3 py-2 text-left">Bookings</th>
                        <th className="px-3 py-2 text-left">Revenue</th>
                        <th className="px-3 py-2 text-left">Delta (bookings)</th>
                        <th className="px-3 py-2 text-left">Delta (revenue)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[
                        { label: 'Last 7d', data: pickupStats.w7 },
                        { label: 'Last 30d', data: pickupStats.w30 },
                        { label: 'Last 90d', data: pickupStats.w90 },
                      ].map((row) => (
                        <tr key={row.label}>
                          <td className="px-3 py-2 font-medium text-slate-800">{row.label}</td>
                          <td className="px-3 py-2 text-slate-800">{row.data.current.count}</td>
                          <td className="px-3 py-2 text-slate-800">{formatCurrency(row.data.current.revenue, 0)}</td>
                          <td className={`px-3 py-2 ${row.data.countDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {row.data.countDelta >= 0 ? '+' : ''}{row.data.countDelta}
                          </td>
                          <td className={`px-3 py-2 ${row.data.revenueDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {row.data.revenueDelta >= 0 ? '+' : ''}{formatCurrency(row.data.revenueDelta, 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <div className="text-xs text-emerald-700 mb-1">Total</div>
                  <div className="text-2xl font-bold text-emerald-900">{reservationStats.total}</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs text-slate-600 mb-1">Revenue</div>
                  <div className="text-2xl font-bold text-slate-900">{formatCurrency(reservationStats.totalRevenue, 0)}</div>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <div className="text-xs text-blue-700 mb-1">Avg Lead Time</div>
                  <div className="text-2xl font-bold text-blue-900">{reservationStats.avgLeadTime}d</div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="text-xs text-amber-700 mb-1">Cancelled</div>
                  <div className="text-2xl font-bold text-amber-900">{reservationStats.byStatus['cancelled'] || 0}</div>
                </div>
              </div>
            </div>
          );
        }
        break;
      case 'revenue':
        if (activeSubTab === 'revenue-by-source' && campgroundId) {
          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Revenue by source</div>
                  <div className="text-xs text-slate-500">Channel mix and revenue share</div>
                </div>
                <div className="text-xs text-slate-500">{drText}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-3">
                <BookingSourcesTab campgroundId={campgroundId} dateRange={dateRange} />
              </div>
            </div>
          );
        }
        if (summaryQuery.data) {
          return (
            <div className="space-y-3">
              <div className="text-sm text-slate-600">Revenue overview for {drText}</div>
              {pickupStats && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 shadow-inner">
                    <div className="text-xs text-emerald-700 mb-1">Bookings (last 7d)</div>
                    <div className="text-2xl font-bold text-emerald-900">{pickupStats.w7.current.count}</div>
                    <div className="text-sm text-emerald-800">Rev: {formatCurrency(pickupStats.w7.current.revenue, 0)}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="text-xs text-slate-600 mb-1">vs prior 7d</div>
                    <div className={`text-xl font-bold ${pickupStats.w7.countDelta >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                      {pickupStats.w7.countDelta >= 0 ? '+' : ''}{pickupStats.w7.countDelta} bookings
                    </div>
                    <div className={`text-sm ${pickupStats.w7.revenueDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {pickupStats.w7.revenueDelta >= 0 ? '+' : ''}{formatCurrency(pickupStats.w7.revenueDelta, 0)} revenue
                    </div>
                  </div>
                  <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 shadow-inner">
                    <div className="text-xs text-indigo-700 mb-1">Future bookings (count)</div>
                    <div className="text-2xl font-bold text-indigo-900">{futureRevenue?.count ?? 0}</div>
                    <div className="text-sm text-indigo-800">Outstanding: {formatCurrency(futureRevenue?.outstanding ?? 0, 0)}</div>
                  </div>
                </div>
              )}
              {pickupStats && (
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Window</th>
                        <th className="px-3 py-2 text-left">Bookings</th>
                        <th className="px-3 py-2 text-left">Revenue</th>
                        <th className="px-3 py-2 text-left">Delta (bookings)</th>
                        <th className="px-3 py-2 text-left">Delta (revenue)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[
                        { label: 'Last 7d', data: pickupStats.w7 },
                        { label: 'Last 30d', data: pickupStats.w30 },
                        { label: 'Last 90d', data: pickupStats.w90 },
                      ].map((row) => (
                        <tr key={row.label}>
                          <td className="px-3 py-2 font-medium text-slate-800">{row.label}</td>
                          <td className="px-3 py-2 text-slate-800">{row.data.current.count}</td>
                          <td className="px-3 py-2 text-slate-800">{formatCurrency(row.data.current.revenue, 0)}</td>
                          <td className={`px-3 py-2 ${row.data.countDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {row.data.countDelta >= 0 ? '+' : ''}{row.data.countDelta}
                          </td>
                          <td className={`px-3 py-2 ${row.data.revenueDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {row.data.revenueDelta >= 0 ? '+' : ''}{formatCurrency(row.data.revenueDelta, 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <div className="text-xs text-emerald-700 mb-1">Revenue (30d)</div>
                  <div className="text-2xl font-bold text-emerald-900">{formatCurrency(summaryQuery.data.revenue)}</div>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <div className="text-xs text-blue-700 mb-1">ADR</div>
                  <div className="text-2xl font-bold text-blue-900">{formatCurrency(summaryQuery.data.adr)}</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs text-slate-600 mb-1">RevPAR</div>
                  <div className="text-2xl font-bold text-slate-900">{formatCurrency(summaryQuery.data.revpar)}</div>
                </div>
              </div>
            </div>
          );
        }
        break;
      case 'performance':
        if (activeSubTab === 'site-breakdown' && sitesQuery.data && reservationsQuery.data) {
          const startDate = new Date(dateRange.start);
          const endDate = new Date(dateRange.end);
          const totalDays = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

          const siteMetrics = sitesQuery.data.map((site: any) => {
            const siteReservations = reservationsQuery.data.filter((r: any) =>
              r.siteId === site.id &&
              r.status !== 'cancelled' &&
              new Date(r.arrivalDate) >= startDate &&
              new Date(r.arrivalDate) <= endDate
            );

            let totalNights = 0;
            let totalRevenue = 0;

            siteReservations.forEach((r: any) => {
              const arrival = new Date(r.arrivalDate);
              const departure = new Date(r.departureDate);
              const nights = Math.max(1, Math.floor((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24)));
              totalNights += nights;
              totalRevenue += (r.totalAmount || 0) / 100;
            });

            const occupancy = totalDays > 0 ? (totalNights / totalDays) * 100 : 0;
            const adr = totalNights > 0 ? totalRevenue / totalNights : 0;
            const revpar = totalDays > 0 ? totalRevenue / totalDays : 0;
            const availableDays = totalDays - totalNights;

            return {
              id: site.id,
              name: site.name,
              siteClass: (site as any).siteClass?.name || 'N/A',
              bookings: siteReservations.length,
              nights: totalNights,
              available: availableDays,
              revenue: totalRevenue,
              occupancy: occupancy.toFixed(1),
              adr: adr,
              revpar: revpar
            };
          }).sort((a: any, b: any) => b.revenue - a.revenue);

          const totals = siteMetrics.reduce((acc: any, s: any) => ({
            bookings: acc.bookings + s.bookings,
            nights: acc.nights + s.nights,
            revenue: acc.revenue + s.revenue
          }), { bookings: 0, nights: 0, revenue: 0 });

          const setPresetRange = (preset: string) => {
            const end = new Date();
            const start = new Date();
            switch (preset) {
              case '7d': start.setDate(end.getDate() - 7); break;
              case '30d': start.setDate(end.getDate() - 30); break;
              case '90d': start.setDate(end.getDate() - 90); break;
              case 'ytd': start.setMonth(0, 1); break;
              case '1y': start.setFullYear(end.getFullYear() - 1); break;
            }
            setDateRange({ start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) });
          };

          return (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-slate-600">Date range:</span>
                <div className="flex gap-1">
                  {[
                    { label: '7 Days', value: '7d' },
                    { label: '30 Days', value: '30d' },
                    { label: '90 Days', value: '90d' },
                    { label: 'YTD', value: 'ytd' },
                    { label: '1 Year', value: '1y' },
                  ].map(preset => (
                    <button
                      key={preset.value}
                      onClick={() => setPresetRange(preset.value)}
                      className="px-2 py-1 text-xs rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="px-2 py-1 text-xs rounded-md border border-slate-200"
                />
                <span className="text-slate-400">→</span>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="px-2 py-1 text-xs rounded-md border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <div className="text-xs text-emerald-700 mb-1">Total Revenue</div>
                  <div className="text-2xl font-bold text-emerald-900">{formatCurrency(totals.revenue)}</div>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <div className="text-xs text-blue-700 mb-1">Bookings</div>
                  <div className="text-2xl font-bold text-blue-900">{totals.bookings}</div>
                </div>
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                  <div className="text-xs text-indigo-700 mb-1">Nights Booked</div>
                  <div className="text-2xl font-bold text-indigo-900">{totals.nights}</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs text-slate-600 mb-1">Avg Occupancy</div>
                  <div className="text-2xl font-bold text-slate-900">
                    {sitesQuery.data.length > 0 ? ((totals.nights / (sitesQuery.data.length * totalDays)) * 100).toFixed(1) : 0}%
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Site</th>
                      <th className="px-3 py-2 text-left">Class</th>
                      <th className="px-3 py-2 text-right">Bookings</th>
                      <th className="px-3 py-2 text-right">Nights</th>
                      <th className="px-3 py-2 text-right">Available</th>
                      <th className="px-3 py-2 text-right">Occupancy</th>
                      <th className="px-3 py-2 text-right">Revenue</th>
                      <th className="px-3 py-2 text-right">ADR</th>
                      <th className="px-3 py-2 text-right">RevPAR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {siteMetrics.map((site: any) => (
                      <tr key={site.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-900">{site.name}</td>
                        <td className="px-3 py-2 text-slate-600">{site.siteClass}</td>
                        <td className="px-3 py-2 text-right text-slate-800">{site.bookings}</td>
                        <td className="px-3 py-2 text-right text-slate-800">{site.nights}</td>
                        <td className="px-3 py-2 text-right text-slate-500">{site.available}</td>
                        <td className="px-3 py-2 text-right">
                          <span className={`font-medium ${Number(site.occupancy) >= 70 ? 'text-emerald-700' : Number(site.occupancy) >= 40 ? 'text-amber-700' : 'text-rose-700'}`}>
                            {site.occupancy}%
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-slate-900">{formatCurrency(site.revenue)}</td>
                        <td className="px-3 py-2 text-right text-slate-800">{formatCurrency(site.adr)}</td>
                        <td className="px-3 py-2 text-right text-slate-800">{formatCurrency(site.revpar)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        }
        if (revenueTrends) {
          return (
            <div className="space-y-3">
              <div className="text-sm text-slate-600">Occupancy & ADR trend (last 12 months)</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-sm">
                {revenueTrends.map((r) => (
                  <div key={r.month} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-xs text-slate-500">{r.month}</div>
                    <div className="font-semibold text-slate-900">{formatCurrency(r.revenue, 0)}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        break;
      case 'guests':
        if (cancellationStats) {
          return (
            <div className="space-y-3">
              <div className="text-sm text-slate-600">Guest behavior</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <div className="text-xs text-emerald-700 mb-1">Total</div>
                  <div className="text-2xl font-bold text-emerald-900">{reservationStats?.total ?? 0}</div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="text-xs text-amber-700 mb-1">Cancelled</div>
                  <div className="text-2xl font-bold text-amber-900">{cancellationStats.total}</div>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <div className="text-xs text-blue-700 mb-1">Avg Lead Time</div>
                  <div className="text-2xl font-bold text-blue-900">{reservationStats?.avgLeadTime ?? 0}d</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs text-slate-600 mb-1">Cancel Rate</div>
                  <div className="text-2xl font-bold text-slate-900">{Number(cancellationStats.rate).toFixed(1)}%</div>
                </div>
              </div>
            </div>
          );
        }
        break;
      case 'marketing':
        if (activeSubTab === 'booking-sources' && campgroundId) {
          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Channel mix</div>
                  <div className="text-xs text-slate-500">Online, phone, OTA performance</div>
                </div>
                <div className="text-xs text-slate-500">{drText}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-3">
                <BookingSourcesTab campgroundId={campgroundId} dateRange={dateRange} />
              </div>
            </div>
          );
        }
        if (activeSubTab === 'campaigns') {
          const promos = promotionsQuery.data || [];
          const filteredPromos = showActivePromos ? promos.filter((p) => p.isActive) : promos;
          const activePromos = promos.filter((p) => p.isActive).length;
          const totalUses = promos.reduce((sum, p) => sum + (p.usageCount || 0), 0);
          const hasRedemptions = promoRedemptions.length > 0;

          const formatPromoValue = (p: (typeof promos)[number]) =>
            p.type === "percentage" ? `${p.value}%` : `$${(p.value / 100).toFixed(2)}`;

          return (
            <div className="space-y-3">
              <div className="text-sm font-semibold text-slate-900">Promo performance</div>
              <div className="text-xs text-slate-500">
                Live promo codes with usage and validity. Redemptions respect the page date range ({dateRange.start} → {dateRange.end}).
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  id="show-active-promos"
                  type="checkbox"
                  className="h-3 w-3 rounded border-slate-300"
                  checked={showActivePromos}
                  onChange={(e) => setShowActivePromos(e.target.checked)}
                />
                <label htmlFor="show-active-promos">Show active only</label>
              </div>

              {promotionsQuery.isLoading ? (
                <div className="text-sm text-slate-500">Loading promotions…</div>
              ) : promotionsQuery.isError ? (
                <div className="text-sm text-red-600">Failed to load promotions.</div>
              ) : filteredPromos.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
                  No promotions yet. Create promo codes in Settings → Promotions.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="text-xs text-slate-500">Active promos</div>
                      <div className="text-xl font-semibold text-slate-900">{activePromos} / {promos.length}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="text-xs text-slate-500">Total uses</div>
                      <div className="text-xl font-semibold text-slate-900">{totalUses}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="text-xs text-slate-500">Most recent</div>
                      <div className="text-xs text-slate-700">
                        {promos.slice(0, 1).map((p) => (
                          <span key={p.id} className="font-mono">{p.code}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2 text-left">Code</th>
                          <th className="px-3 py-2 text-left">Value</th>
                          <th className="px-3 py-2 text-left">Usage</th>
                          <th className="px-3 py-2 text-left">Valid</th>
                          <th className="px-3 py-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPromos.map((p) => (
                          <tr key={p.id}>
                            <td className="px-3 py-2 font-mono font-semibold">{p.code}</td>
                            <td className="px-3 py-2">{formatPromoValue(p)}</td>
                            <td className="px-3 py-2">
                              {p.usageLimit ? `${p.usageCount} / ${p.usageLimit}` : p.usageCount}
                            </td>
                            <td className="px-3 py-2">
                              {p.validFrom ? new Date(p.validFrom).toLocaleDateString() : "Anytime"}
                              {p.validTo ? ` → ${new Date(p.validTo).toLocaleDateString()}` : ""}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${p.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                                {p.isActive ? "Active" : "Inactive"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-slate-900">Redemptions (bookings)</div>
                    {promotionsQuery.isLoading ? (
                      <div className="text-sm text-slate-500">Loading redemptions…</div>
                    ) : !hasRedemptions ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                        No promo redemptions yet. Codes will appear here once used in bookings.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                            <tr>
                              <th className="px-3 py-2 text-left">Code</th>
                              <th className="px-3 py-2 text-left">Bookings</th>
                              <th className="px-3 py-2 text-left">Revenue</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {promoRedemptions.map((p) => (
                              <tr key={p.code}>
                                <td className="px-3 py-2 font-mono font-semibold">{p.code}</td>
                                <td className="px-3 py-2">{p.uses}</td>
                                <td className="px-3 py-2">${p.revenue.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        }
        return renderDefaultSubSummary();
      case 'forecasting':
        if (activeSubTab === 'demand-outlook' && revenueTrends) {
          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Demand outlook</div>
                  <div className="text-xs text-slate-500">Recent pickup as proxy for future demand</div>
                </div>
                <div className="text-xs text-slate-500">{drText}</div>
              </div>
              {pickupStats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 shadow-inner">
                    <div className="text-xs text-emerald-700 mb-1">Bookings (last 7d)</div>
                    <div className="text-2xl font-bold text-emerald-900">{pickupStats.w7.current.count}</div>
                    <div className="text-sm text-emerald-800">Rev: {formatCurrency(pickupStats.w7.current.revenue, 0)}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="text-xs text-slate-600 mb-1">vs prior 7d</div>
                    <div className={`text-xl font-bold ${pickupStats.w7.countDelta >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                      {pickupStats.w7.countDelta >= 0 ? '+' : ''}{pickupStats.w7.countDelta} bookings
                    </div>
                    <div className={`text-sm ${pickupStats.w7.revenueDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {pickupStats.w7.revenueDelta >= 0 ? '+' : ''}{formatCurrency(pickupStats.w7.revenueDelta, 0)} revenue
                    </div>
                  </div>
                </div>
              )}
              {pickupStats && (
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Window</th>
                        <th className="px-3 py-2 text-left">Bookings</th>
                        <th className="px-3 py-2 text-left">Revenue</th>
                        <th className="px-3 py-2 text-left">Delta (bookings)</th>
                        <th className="px-3 py-2 text-left">Delta (revenue)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[
                        { label: 'Last 7d', data: pickupStats.w7 },
                        { label: 'Last 30d', data: pickupStats.w30 },
                        { label: 'Last 90d', data: pickupStats.w90 },
                      ].map((row) => (
                        <tr key={row.label}>
                          <td className="px-3 py-2 font-medium text-slate-800">{row.label}</td>
                          <td className="px-3 py-2 text-slate-800">{row.data.current.count}</td>
                          <td className="px-3 py-2 text-slate-800">{formatCurrency(row.data.current.revenue, 0)}</td>
                          <td className={`px-3 py-2 ${row.data.countDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {row.data.countDelta >= 0 ? '+' : ''}{row.data.countDelta}
                          </td>
                          <td className={`px-3 py-2 ${row.data.revenueDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {row.data.revenueDelta >= 0 ? '+' : ''}{formatCurrency(row.data.revenueDelta, 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-sm">
                {revenueTrends.map((r) => (
                  <div key={r.month} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-xs text-slate-500">{r.month}</div>
                    <div className="font-semibold text-slate-900">{formatCurrency(r.revenue, 0)}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        if (activeSubTab === 'pickup') {
          return (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">Comparison Date A</label>
                    <input
                      type="date"
                      value={pickupFilters.comparisonA}
                      onChange={(e) => setPickupFilters((prev) => ({ ...prev, comparisonA: e.target.value }))}
                      className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">Comparison Date B</label>
                    <input
                      type="date"
                      value={pickupFilters.comparisonB}
                      onChange={(e) => setPickupFilters((prev) => ({ ...prev, comparisonB: e.target.value }))}
                      className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">Show occupancy starting on</label>
                    <input
                      type="date"
                      value={pickupFilters.occupancyStart}
                      onChange={(e) => setPickupFilters((prev) => ({ ...prev, occupancyStart: e.target.value }))}
                      className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">Interval</label>
                    <select
                      value={pickupFilters.interval}
                      onChange={(e) => setPickupFilters((prev) => ({ ...prev, interval: e.target.value as 'weekly' | 'daily' }))}
                      className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm bg-white"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">Include reservations</label>
                    <select
                      value={pickupFilters.include}
                      onChange={(e) => setPickupFilters((prev) => ({ ...prev, include: e.target.value as 'all' | 'confirmed' | 'paid' }))}
                      className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm bg-white"
                    >
                      <option value="all">All future occupancy</option>
                      <option value="confirmed">Confirmed / pending only</option>
                      <option value="paid">Paid only</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">Site class</label>
                    <select
                      value={pickupFilters.siteClassId}
                      onChange={(e) => setPickupFilters((prev) => ({ ...prev, siteClassId: e.target.value }))}
                      className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm bg-white"
                    >
                      <option value="all">All sites</option>
                      {sitesQuery.data?.map((s) => (s as any)?.siteClass?.id ? (s as any).siteClass : null)
                        ?.filter(Boolean)
                        ?.reduce((acc: any[], sc: any) => {
                          if (!acc.find((x) => x.id === sc.id)) acc.push(sc);
                          return acc;
                        }, [])
                        ?.map((sc: any) => (
                          <option key={sc.id} value={sc.id}>{sc.name}</option>
                        ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="activity-only"
                      type="checkbox"
                      checked={pickupFilters.activityOnly}
                      onChange={(e) => setPickupFilters((prev) => ({ ...prev, activityOnly: e.target.checked }))}
                      className="h-4 w-4"
                    />
                    <label htmlFor="activity-only" className="text-sm text-slate-700">Only show dates with activity</label>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!pickupStats) return;
                      let csv = 'Window,Bookings,Revenue,Delta Bookings,Delta Revenue\n';
                      const rows = [
                        { label: `A (${pickupFilters.comparisonA})`, data: pickupStats.windowA },
                        { label: `B (${pickupFilters.comparisonB})`, data: pickupStats.windowB },
                        { label: 'Last 7d', data: pickupStats.w7 },
                        { label: 'Last 30d', data: pickupStats.w30 },
                        { label: 'Last 90d', data: pickupStats.w90 },
                        { label: 'Sum last 4 weeks', data: { current: pickupStats.weeklyTotal, prior: { count: 0, revenue: 0 }, countDelta: 0, revenueDelta: 0 } },
                        { label: 'Sum last 3 months', data: { current: pickupStats.monthlyTotal, prior: { count: 0, revenue: 0 }, countDelta: 0, revenueDelta: 0 } },
                      ];
                      rows.forEach((row) => {
                        csv += `${row.label},${row.data.current.count},${row.data.current.revenue.toFixed(2)},${row.data.countDelta},${row.data.revenueDelta.toFixed(2)}\n`;
                      });
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `pickup-${new Date().toISOString().slice(0, 10)}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Export pickup CSV
                  </Button>
                </div>
              </div>

              {pickupStats ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      { label: `Window A (${pickupFilters.comparisonA})`, data: pickupStats.windowA },
                      { label: `Window B (${pickupFilters.comparisonB})`, data: pickupStats.windowB },
                    ].map((row) => (
                      <div key={row.label} className="rounded-lg border border-slate-200 bg-white shadow-sm p-3">
                        <div className="text-xs text-slate-600 mb-1">{row.label}</div>
                        <div className="text-2xl font-bold text-slate-900">{row.data.current.count} bookings</div>
                        <div className="text-sm text-slate-700">Rev: {formatCurrency(row.data.current.revenue, 0)}</div>
                        <div className="text-sm text-slate-600">Occ: {((row.data.current.count / pickupStats.activeSitesCount) * 100).toFixed(1)}%</div>
                        <div className={`text-sm mt-1 ${row.data.countDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          Δ bookings: {row.data.countDelta >= 0 ? '+' : ''}{row.data.countDelta}
                        </div>
                        <div className={`text-sm ${row.data.revenueDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          Δ revenue: {row.data.revenueDelta >= 0 ? '+' : ''}{formatCurrency(row.data.revenueDelta, 0)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2 text-left">Window</th>
                          <th className="px-3 py-2 text-left">Bookings</th>
                          <th className="px-3 py-2 text-left">Revenue</th>
                          <th className="px-3 py-2 text-left">Occ %</th>
                          <th className="px-3 py-2 text-left">Delta (bookings)</th>
                          <th className="px-3 py-2 text-left">Delta (revenue)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[
                          { label: `A (${pickupFilters.comparisonA})`, data: pickupStats.windowA },
                          { label: `B (${pickupFilters.comparisonB})`, data: pickupStats.windowB },
                          { label: 'Last 7d', data: pickupStats.w7 },
                          { label: 'Last 30d', data: pickupStats.w30 },
                          { label: 'Last 90d', data: pickupStats.w90 },
                          { label: 'Sum last 4 weeks', data: { current: pickupStats.weeklyTotal, prior: { count: 0, revenue: 0 }, countDelta: 0, revenueDelta: 0 } },
                          { label: 'Sum last 3 months', data: { current: pickupStats.monthlyTotal, prior: { count: 0, revenue: 0 }, countDelta: 0, revenueDelta: 0 } },
                        ]
                          .filter((row) => !pickupFilters.activityOnly || row.data.current.count > 0)
                          .map((row) => (
                            <tr key={row.label}>
                              <td className="px-3 py-2 font-medium text-slate-800">{row.label}</td>
                              <td className="px-3 py-2 text-slate-800">{row.data.current.count}</td>
                              <td className="px-3 py-2 text-slate-800">{formatCurrency(row.data.current.revenue, 0)}</td>
                              <td className="px-3 py-2 text-slate-800">{((row.data.current.count / pickupStats.activeSitesCount) * 100).toFixed(1)}%</td>
                              <td className={`px-3 py-2 ${row.data.countDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                {row.data.countDelta >= 0 ? '+' : ''}{row.data.countDelta}
                              </td>
                              <td className={`px-3 py-2 ${row.data.revenueDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                {row.data.revenueDelta >= 0 ? '+' : ''}{formatCurrency(row.data.revenueDelta, 0)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500">No pickup data available.</div>
              )}
            </div>
          );
        }
        if (revenueTrends) {
          return (
            <div className="space-y-2 text-sm text-slate-600">
              <div className="font-semibold text-slate-900">Forecasting</div>
              <div>Simple projection based on last 12 months revenue.</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-sm">
                {revenueTrends.map((r) => (
                  <div key={r.month} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-xs text-slate-500">{r.month}</div>
                    <div className="font-semibold text-slate-900">{formatCurrency(r.revenue, 0)}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        break;
      case 'accounting':
        if (activeSubTab === 'aging' && agingQuery.data) {
          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-600">Aging buckets</div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => exportTabToCSV('accounting')}>Export buckets</Button>
                  <Button variant="secondary" size="sm" onClick={exportAgingDetailCsv}>Export aging detail</Button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(agingQuery.data).map(([bucket, cents]) => (
                  <div key={bucket} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm shadow-inner">
                    <div className="text-[11px] uppercase text-slate-500 font-semibold">{bucket.replace("_", "-")}</div>
                    <div className="font-semibold text-slate-900">{formatCurrency(cents / 100)}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        if (activeSubTab === 'ledger' && ledgerSummaryQuery.data) {
          return (
            <div className="space-y-3">
              <div className="text-sm text-slate-600">Ledger summary</div>
              <div className="space-y-2">
                {ledgerSummaryQuery.data.map((row) => (
                  <div key={row.glCode} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <span className="text-slate-700">{row.glCode}</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(row.netCents / 100)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        break;
      default:
        return renderDefaultSubSummary();
    }
    return renderDefaultSubSummary();
  };

  // Length of stay distribution
  const lengthOfStayStats = useMemo(() => {
    if (!reservationsQuery.data) return null;

    const distribution: Record<string, number> = {
      '1-2 nights': 0,
      '3-4 nights': 0,
      '5-7 nights': 0,
      '8-14 nights': 0,
      '15+ nights': 0
    };

    let totalNights = 0;
    let count = 0;

    reservationsQuery.data.forEach(r => {
      if (r.status !== 'cancelled') {
        const arrival = new Date(r.arrivalDate);
        const departure = new Date(r.departureDate);
        const nights = Math.max(1, Math.floor((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24)));

        totalNights += nights;
        count++;

        if (nights <= 2) distribution['1-2 nights']++;
        else if (nights <= 4) distribution['3-4 nights']++;
        else if (nights <= 7) distribution['5-7 nights']++;
        else if (nights <= 14) distribution['8-14 nights']++;
        else distribution['15+ nights']++;
      }
    });

    return {
      distribution,
      avgNights: count > 0 ? (totalNights / count).toFixed(1) : '0'
    };
  }, [reservationsQuery.data]);

  // Site class performance
  const siteClassStats = useMemo(() => {
    if (!reservationsQuery.data || !sitesQuery.data) return null;

    const siteMap = new Map(sitesQuery.data.map(s => [s.id, s]));
    const classRevenue: Record<string, { revenue: number; bookings: number; className: string }> = {};

    reservationsQuery.data.forEach(r => {
      if (r.status !== 'cancelled') {
        const site = siteMap.get(r.siteId);
        const className = (site as any)?.siteClass?.name ?? site?.siteType ?? "Unknown";
        if (className) {
          if (!classRevenue[className]) {
            classRevenue[className] = { revenue: 0, bookings: 0, className };
          }
          classRevenue[className].revenue += (r.totalAmount || 0) / 100;
          classRevenue[className].bookings++;
        }
      }
    });

    return Object.values(classRevenue).sort((a, b) => b.revenue - a.revenue);
  }, [reservationsQuery.data, sitesQuery.data]);

  // Future revenue forecast (confirmed future bookings)
  const futureRevenue = useMemo(() => {
    if (!reservationsQuery.data) return null;

    const now = new Date();
    const futureReservations = reservationsQuery.data.filter(r => {
      const arrival = new Date(r.arrivalDate);
      return arrival > now && (r.status === 'confirmed' || r.status === 'pending');
    });

    const totalRevenue = futureReservations.reduce((sum, r) => sum + (r.totalAmount || 0), 0) / 100;
    const totalPaid = futureReservations.reduce((sum, r) => sum + (r.paidAmount || 0), 0) / 100;

    return {
      count: futureReservations.length,
      totalRevenue,
      totalPaid,
      outstanding: totalRevenue - totalPaid
    };
  }, [reservationsQuery.data]);

  // Pickup: last 7/30/90 days vs prior window (based on createdAt)
  const pickupStats = useMemo(() => {
    if (!reservationsQuery.data) return null;
    const occupancyStartDate = new Date(pickupFilters.occupancyStart);
    const siteClassFilter = pickupFilters.siteClassId;
    const intervalDays = pickupFilters.interval === 'weekly' ? 7 : 1;
    const activeSitesCount = sitesQuery.data?.filter((s) => s.isActive).length || sitesQuery.data?.length || 1;

    const filteredReservations = reservationsQuery.data.filter((r) => {
      const arrival = new Date(r.arrivalDate);
      if (arrival < occupancyStartDate) return false;
      if (siteClassFilter !== 'all') {
        const site = sitesQuery.data?.find((s) => s.id === r.siteId);
        const scId = (site as any)?.siteClass?.id;
        if (scId !== siteClassFilter) return false;
      }
      if (pickupFilters.include === 'confirmed') {
        return r.status === 'confirmed' || r.status === 'pending';
      }
      if (pickupFilters.include === 'paid') {
        return (r.paidAmount || 0) > 0;
      }
      return true;
    });
    const now = new Date();
    const isLive = (r: any) => r.status !== 'cancelled';

    const sumWindow = (start: Date, end: Date) => {
      const rows = filteredReservations.filter((r) => {
        if (!isLive(r) || !r.createdAt) return false;
        const created = new Date(r.createdAt);
        return created >= start && created < end;
      });
      const revenue = rows.reduce((sum, r) => sum + ((r.totalAmount || 0) / 100), 0);
      return { count: rows.length, revenue };
    };

    const build = (days: number, anchor?: string) => {
      const anchorDate = anchor ? new Date(anchor) : new Date(now);
      const startCurrent = new Date(anchorDate);
      startCurrent.setDate(anchorDate.getDate() - days);
      const endPrior = new Date(anchorDate);
      endPrior.setDate(anchorDate.getDate() - days);
      const startPrior = new Date(anchorDate);
      startPrior.setDate(anchorDate.getDate() - days * 2);

      const current = sumWindow(startCurrent, now);
      const prior = sumWindow(startPrior, endPrior);
      return {
        current,
        prior,
        countDelta: current.count - prior.count,
        revenueDelta: current.revenue - prior.revenue,
      };
    };

    const sumRange = (days: number) => {
      const start = new Date(now);
      start.setDate(now.getDate() - days);
      return sumWindow(start, now);
    };

    return {
      activeSitesCount,
      windowA: build(intervalDays, pickupFilters.comparisonA),
      windowB: build(intervalDays, pickupFilters.comparisonB),
      w7: build(7),
      w30: build(30),
      w90: build(90),
      weeklyTotal: sumRange(28),
      monthlyTotal: sumRange(90),
    };
  }, [reservationsQuery.data, sitesQuery.data, pickupFilters]);

  // Guest analytics
  const guestStats = useMemo(() => {
    if (!reservationsQuery.data) return null;

    const guestBookings: Record<string, number> = {};

    reservationsQuery.data.forEach(r => {
      if (r.status !== 'cancelled' && (r as any).guest) {
        const guestId = (r as any).guestId;
        if (guestId) {
          guestBookings[guestId] = (guestBookings[guestId] || 0) + 1;
        }
      }
    });

    const repeatGuests = Object.values(guestBookings).filter(count => count > 1).length;
    const totalGuests = Object.keys(guestBookings).length;
    const repeatRate = totalGuests > 0 ? (repeatGuests / totalGuests) * 100 : 0;

    return {
      total: totalGuests,
      repeat: repeatGuests,
      repeatRate: repeatRate.toFixed(1)
    };
  }, [reservationsQuery.data]);

  // Occupancy trends by month (last 12 months)
  const occupancyTrends = useMemo(() => {
    if (!reservationsQuery.data || !sitesQuery.data) return null;

    const monthlyOccupancy: Record<string, { nights: number; available: number }> = {};
    const now = new Date();
    const totalSites = sitesQuery.data.length;

    // Initialize last 12 months
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      monthlyOccupancy[key] = { nights: 0, available: totalSites * daysInMonth };
    }

    reservationsQuery.data.forEach(r => {
      if (r.status !== 'cancelled') {
        const arrival = new Date(r.arrivalDate);
        const departure = new Date(r.departureDate);
        const nights = Math.max(1, Math.floor((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24)));
        const key = arrival.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        if (key in monthlyOccupancy) {
          monthlyOccupancy[key].nights += nights;
        }
      }
    });

    return Object.entries(monthlyOccupancy).map(([month, data]) => ({
      month,
      occupancy: data.available > 0 ? ((data.nights / data.available) * 100).toFixed(1) : '0'
    }));
  }, [reservationsQuery.data, sitesQuery.data]);

  // Booking window distribution (how far in advance guests book)
  const bookingWindowStats = useMemo(() => {
    if (!reservationsQuery.data) return null;

    const distribution: Record<string, number> = {
      'Same day': 0,
      '1-7 days': 0,
      '8-14 days': 0,
      '15-30 days': 0,
      '31-60 days': 0,
      '61+ days': 0
    };

    let totalDays = 0;
    let count = 0;

    reservationsQuery.data.forEach(r => {
      if (r.status !== 'cancelled' && r.createdAt) {
        const created = new Date(r.createdAt);
        const arrival = new Date(r.arrivalDate);
        const days = Math.floor((arrival.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));

        totalDays += days;
        count++;

        if (days === 0) distribution['Same day']++;
        else if (days <= 7) distribution['1-7 days']++;
        else if (days <= 14) distribution['8-14 days']++;
        else if (days <= 30) distribution['15-30 days']++;
        else if (days <= 60) distribution['31-60 days']++;
        else distribution['61+ days']++;
      }
    });

    return {
      distribution,
      avgDays: count > 0 ? Math.round(totalDays / count) : 0
    };
  }, [reservationsQuery.data]);

  // Day of week patterns (arrivals and departures)
  const dayOfWeekStats = useMemo(() => {
    if (!reservationsQuery.data) return null;

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const arrivals: Record<string, number> = {};
    const departures: Record<string, number> = {};

    days.forEach(day => {
      arrivals[day] = 0;
      departures[day] = 0;
    });

    reservationsQuery.data.forEach(r => {
      if (r.status !== 'cancelled') {
        const arrivalDay = days[new Date(r.arrivalDate).getDay()];
        const departureDay = days[new Date(r.departureDate).getDay()];
        arrivals[arrivalDay]++;
        departures[departureDay]++;
      }
    });

    return days.map(day => ({
      day,
      arrivals: arrivals[day],
      departures: departures[day]
    }));
  }, [reservationsQuery.data]);

  // Payment breakdown
  const paymentStats = useMemo(() => {
    if (!reservationsQuery.data) return null;

    const totalRevenue = reservationsQuery.data
      .filter(r => r.status !== 'cancelled')
      .reduce((sum, r) => sum + (r.totalAmount || 0), 0) / 100;

    const totalPaid = reservationsQuery.data
      .filter(r => r.status !== 'cancelled')
      .reduce((sum, r) => sum + (r.paidAmount || 0), 0) / 100;

    const totalBalance = reservationsQuery.data
      .filter(r => r.status !== 'cancelled')
      .reduce((sum, r) => sum + (r.balanceAmount || 0), 0) / 100;

    const paidPercentage = totalRevenue > 0 ? ((totalPaid / totalRevenue) * 100).toFixed(1) : '0';

    return {
      totalRevenue,
      totalPaid,
      totalBalance,
      paidPercentage
    };
  }, [reservationsQuery.data]);

  // Monthly comparison (current vs previous month)
  const monthlyComparison = useMemo(() => {
    if (!reservationsQuery.data) return null;

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const currentMonth = reservationsQuery.data.filter(r => {
      const arrival = new Date(r.arrivalDate);
      return arrival >= currentMonthStart && r.status !== 'cancelled';
    });

    const previousMonth = reservationsQuery.data.filter(r => {
      const arrival = new Date(r.arrivalDate);
      return arrival >= previousMonthStart && arrival <= previousMonthEnd && r.status !== 'cancelled';
    });

    const currentRevenue = currentMonth.reduce((sum, r) => sum + (r.totalAmount || 0), 0) / 100;
    const previousRevenue = previousMonth.reduce((sum, r) => sum + (r.totalAmount || 0), 0) / 100;
    const revenueChange = previousRevenue > 0 ? (((currentRevenue - previousRevenue) / previousRevenue) * 100).toFixed(1) : '0';

    return {
      current: {
        bookings: currentMonth.length,
        revenue: currentRevenue
      },
      previous: {
        bookings: previousMonth.length,
        revenue: previousRevenue
      },
      change: {
        bookings: currentMonth.length - previousMonth.length,
        revenuePercent: revenueChange
      }
    };
  }, [reservationsQuery.data]);

  // Revenue per site metrics
  const revenuePerSiteStats = useMemo(() => {
    if (!reservationsQuery.data || !sitesQuery.data) return null;

    const totalRevenue = reservationsQuery.data
      .filter(r => r.status !== 'cancelled')
      .reduce((sum, r) => sum + (r.totalAmount || 0), 0) / 100;

    const totalSites = sitesQuery.data.length;
    const revenuePerSite = totalSites > 0 ? totalRevenue / totalSites : 0;

    // Calculate revenue per site for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recent30DayRevenue = reservationsQuery.data
      .filter(r => {
        const arrival = new Date(r.arrivalDate);
        return arrival >= thirtyDaysAgo && r.status !== 'cancelled';
      })
      .reduce((sum, r) => sum + (r.totalAmount || 0), 0) / 100;

    const revenuePerSite30d = totalSites > 0 ? recent30DayRevenue / totalSites : 0;

    return {
      allTime: revenuePerSite,
      last30Days: revenuePerSite30d,
      totalSites
    };
  }, [reservationsQuery.data, sitesQuery.data]);

  // Seasonal performance analysis
  const seasonalStats = useMemo(() => {
    if (!reservationsQuery.data) return null;

    const seasons: Record<string, { revenue: number; bookings: number; nights: number }> = {
      'Winter': { revenue: 0, bookings: 0, nights: 0 },
      'Spring': { revenue: 0, bookings: 0, nights: 0 },
      'Summer': { revenue: 0, bookings: 0, nights: 0 },
      'Fall': { revenue: 0, bookings: 0, nights: 0 }
    };

    const getSeason = (date: Date) => {
      const month = date.getMonth();
      if (month >= 2 && month <= 4) return 'Spring';
      if (month >= 5 && month <= 7) return 'Summer';
      if (month >= 8 && month <= 10) return 'Fall';
      return 'Winter';
    };

    reservationsQuery.data.forEach(r => {
      if (r.status !== 'cancelled') {
        const arrival = new Date(r.arrivalDate);
        const departure = new Date(r.departureDate);
        const season = getSeason(arrival);
        const nights = Math.max(1, Math.floor((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24)));

        seasons[season].revenue += (r.totalAmount || 0) / 100;
        seasons[season].bookings++;
        seasons[season].nights += nights;
      }
    });

    return Object.entries(seasons).map(([season, data]) => ({
      season,
      revenue: data.revenue,
      bookings: data.bookings,
      avgNights: data.bookings > 0 ? (data.nights / data.bookings).toFixed(1) : '0'
    }));
  }, [reservationsQuery.data]);

  // Weekend vs weekday performance
  const weekendVsWeekdayStats = useMemo(() => {
    if (!reservationsQuery.data) return null;

    let weekendRevenue = 0;
    let weekdayRevenue = 0;
    let weekendBookings = 0;
    let weekdayBookings = 0;

    reservationsQuery.data.forEach(r => {
      if (r.status !== 'cancelled') {
        const arrival = new Date(r.arrivalDate);
        const dayOfWeek = arrival.getDay();
        const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Friday or Saturday

        if (isWeekend) {
          weekendRevenue += (r.totalAmount || 0) / 100;
          weekendBookings++;
        } else {
          weekdayRevenue += (r.totalAmount || 0) / 100;
          weekdayBookings++;
        }
      }
    });

    return {
      weekend: {
        revenue: weekendRevenue,
        bookings: weekendBookings,
        avgRevenue: weekendBookings > 0 ? weekendRevenue / weekendBookings : 0
      },
      weekday: {
        revenue: weekdayRevenue,
        bookings: weekdayBookings,
        avgRevenue: weekdayBookings > 0 ? weekdayRevenue / weekdayBookings : 0
      }
    };
  }, [reservationsQuery.data]);

  // ADR trends over time (last 12 months)
  const adrTrends = useMemo(() => {
    if (!reservationsQuery.data) return null;

    const monthlyData: Record<string, { revenue: number; nights: number }> = {};
    const now = new Date();

    // Initialize last 12 months
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      monthlyData[key] = { revenue: 0, nights: 0 };
    }

    reservationsQuery.data.forEach(r => {
      if (r.status !== 'cancelled') {
        const arrival = new Date(r.arrivalDate);
        const departure = new Date(r.departureDate);
        const key = arrival.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        if (key in monthlyData) {
          const nights = Math.max(1, Math.floor((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24)));
          monthlyData[key].revenue += (r.totalAmount || 0) / 100;
          monthlyData[key].nights += nights;
        }
      }
    });

    return Object.entries(monthlyData).map(([month, data]) => ({
      month,
      adr: data.nights > 0 ? (data.revenue / data.nights).toFixed(0) : '0'
    }));
  }, [reservationsQuery.data]);

  // Site utilization rate
  const siteUtilizationStats = useMemo(() => {
    if (!reservationsQuery.data || !sitesQuery.data) return null;

    const siteBookings = reservationsQuery.data.reduce((acc, r) => {
      if (r.status !== 'cancelled') {
        acc[r.siteId] = (acc[r.siteId] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const utilization = sitesQuery.data.map(site => ({
      name: site.name,
      bookings: siteBookings[site.id] || 0
    })).sort((a, b) => b.bookings - a.bookings);

    const avgBookings = utilization.reduce((sum, s) => sum + s.bookings, 0) / utilization.length;
    const underutilized = utilization.filter(s => s.bookings < avgBookings * 0.7).length;

    return {
      sites: utilization,
      avgBookings: Math.round(avgBookings),
      underutilized
    };
  }, [reservationsQuery.data, sitesQuery.data]);

  // Occupancy by site class
  const occupancyBySiteClass = useMemo(() => {
    if (!reservationsQuery.data || !sitesQuery.data) return null;

    const siteMap = new Map(sitesQuery.data.map(s => [s.id, s]));
    const classData: Record<string, { nights: number; sites: number }> = {};

    // Initialize with site counts
    sitesQuery.data.forEach(site => {
      const className = (site as any)?.siteClass?.name ?? site.siteType ?? "Unknown";
      if (!classData[className]) {
        classData[className] = { nights: 0, sites: 0 };
      }
      classData[className].sites++;
    });

    // Calculate nights booked
    reservationsQuery.data.forEach(r => {
      if (r.status !== 'cancelled') {
        const site = siteMap.get(r.siteId);
        const className = (site as any)?.siteClass?.name ?? site?.siteType ?? "Unknown";
        if (className) {
          const arrival = new Date(r.arrivalDate);
          const departure = new Date(r.departureDate);
          const nights = Math.max(1, Math.floor((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24)));
          classData[className].nights += nights;
        }
      }
    });

    // Assume 365 days for calculation
    return Object.entries(classData).map(([className, data]) => ({
      className,
      occupancy: data.sites > 0 ? ((data.nights / (data.sites * 365)) * 100).toFixed(1) : '0',
      sites: data.sites
    })).sort((a, b) => parseFloat(b.occupancy) - parseFloat(a.occupancy));
  }, [reservationsQuery.data, sitesQuery.data]);

  // Top guests by revenue
  const topGuestsStats = useMemo(() => {
    if (!reservationsQuery.data) return null;

    const guestRevenue: Record<string, { name: string; revenue: number; bookings: number }> = {};

    reservationsQuery.data.forEach(r => {
      if (r.status !== 'cancelled' && (r as any).guest) {
        const guestId = (r as any).guestId;
        const guest = (r as any).guest;
        const name = `${guest.primaryFirstName || ''} ${guest.primaryLastName || ''}`.trim() || 'Unknown';

        if (guestId) {
          if (!guestRevenue[guestId]) {
            guestRevenue[guestId] = { name, revenue: 0, bookings: 0 };
          }
          guestRevenue[guestId].revenue += (r.totalAmount || 0) / 100;
          guestRevenue[guestId].bookings++;
        }
      }
    });

    return Object.values(guestRevenue)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [reservationsQuery.data]);

  // Revenue concentration analysis
  const revenueConcentrationStats = useMemo(() => {
    if (!reservationsQuery.data || !sitesQuery.data) return null;

    const siteRevenue = reservationsQuery.data.reduce((acc, r) => {
      if (r.status !== 'cancelled') {
        acc[r.siteId] = (acc[r.siteId] || 0) + (r.totalAmount || 0);
      }
      return acc;
    }, {} as Record<string, number>);

    const revenues = Object.values(siteRevenue).sort((a, b) => b - a);
    const totalRevenue = revenues.reduce((sum, r) => sum + r, 0);

    if (totalRevenue === 0) return null;

    const top20Percent = Math.ceil(sitesQuery.data.length * 0.2);
    const top20Revenue = revenues.slice(0, top20Percent).reduce((sum, r) => sum + r, 0);

    const top50Percent = Math.ceil(sitesQuery.data.length * 0.5);
    const top50Revenue = revenues.slice(0, top50Percent).reduce((sum, r) => sum + r, 0);

    return {
      top20Percent: ((top20Revenue / totalRevenue) * 100).toFixed(1),
      top50Percent: ((top50Revenue / totalRevenue) * 100).toFixed(1),
      totalSites: sitesQuery.data.length
    };
  }, [reservationsQuery.data, sitesQuery.data]);

  const siteCoords = useMemo(() => {
    if (!sitesQuery.data) return { map: new Map<string, { latitude: number | null; longitude: number | null }>(), center: { latitude: 39.8283, longitude: -98.5795 } };
    const map = new Map<string, { latitude: number | null; longitude: number | null }>();
    const coords: { lat: number; lng: number }[] = [];
    sitesQuery.data.forEach((s) => {
      const latitude = (s as any)?.latitude !== undefined && (s as any)?.latitude !== null ? Number((s as any).latitude) : null;
      const longitude = (s as any)?.longitude !== undefined && (s as any)?.longitude !== null ? Number((s as any).longitude) : null;
      map.set(s.id, { latitude, longitude });
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        coords.push({ lat: latitude as number, lng: longitude as number });
      }
    });
    const center = coords.length
      ? {
        latitude: coords.reduce((sum, c) => sum + c.lat, 0) / coords.length,
        longitude: coords.reduce((sum, c) => sum + c.lng, 0) / coords.length
      }
      : { latitude: 39.8283, longitude: -98.5795 };
    return { map, center };
  }, [sitesQuery.data]);

  // Marketing: Booking pace analysis (comparing to historical average)
  const bookingPaceStats = useMemo(() => {
    if (!reservationsQuery.data) return null;

    const now = new Date();
    const futureBookings = reservationsQuery.data.filter(r => {
      const arrival = new Date(r.arrivalDate);
      return arrival > now && r.status !== 'cancelled' && r.createdAt;
    });

    // Group by how far in advance
    const next30Days = futureBookings.filter(r => {
      const arrival = new Date(r.arrivalDate);
      const daysOut = Math.floor((arrival.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysOut <= 30;
    }).length;

    const next60Days = futureBookings.filter(r => {
      const arrival = new Date(r.arrivalDate);
      const daysOut = Math.floor((arrival.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysOut > 30 && daysOut <= 60;
    }).length;

    const next90Days = futureBookings.filter(r => {
      const arrival = new Date(r.arrivalDate);
      const daysOut = Math.floor((arrival.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysOut > 60 && daysOut <= 90;
    }).length;

    return {
      next30Days,
      next60Days,
      next90Days,
      total: futureBookings.length
    };
  }, [reservationsQuery.data]);

  // Forecasting: Revenue projections for next 3 months
  const revenueForecast = useMemo(() => {
    if (!reservationsQuery.data) return null;

    const now = new Date();
    const months = [];

    for (let i = 0; i < 3; i++) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + i + 1, 0);
      const monthName = monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      const confirmedRevenue = reservationsQuery.data
        .filter(r => {
          const arrival = new Date(r.arrivalDate);
          return arrival >= monthStart && arrival <= monthEnd &&
            (r.status === 'confirmed' || r.status === 'pending');
        })
        .reduce((sum, r) => sum + (r.totalAmount || 0), 0) / 100;

      const bookings = reservationsQuery.data.filter(r => {
        const arrival = new Date(r.arrivalDate);
        return arrival >= monthStart && arrival <= monthEnd &&
          (r.status === 'confirmed' || r.status === 'pending');
      }).length;

      months.push({ month: monthName, revenue: confirmedRevenue, bookings });
    }

    return months;
  }, [reservationsQuery.data]);

  // Accounting: Payment method breakdown (if available in data)
  const paymentMethodStats = useMemo(() => {
    if (!reservationsQuery.data) return null;

    // Since we don't have payment method data, we'll show payment status
    const fullyPaid = reservationsQuery.data.filter(r =>
      r.status !== 'cancelled' && r.balanceAmount === 0
    ).length;

    const partiallyPaid = reservationsQuery.data.filter(r =>
      r.status !== 'cancelled' && (r.paidAmount || 0) > 0 && (r.balanceAmount || 0) > 0
    ).length;

    const unpaid = reservationsQuery.data.filter(r =>
      r.status !== 'cancelled' && (r.paidAmount || 0) === 0
    ).length;

    return {
      fullyPaid,
      partiallyPaid,
      unpaid,
      total: fullyPaid + partiallyPaid + unpaid
    };
  }, [reservationsQuery.data]);

  // Audits: Data quality checks
  const dataQualityStats = useMemo(() => {
    if (!reservationsQuery.data || !sitesQuery.data) return null;

    const now = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    // Sites with no bookings in last year
    const recentBookings = new Set(
      reservationsQuery.data
        .filter(r => new Date(r.createdAt || r.arrivalDate) >= oneYearAgo)
        .map(r => r.siteId)
    );

    const inactiveSites = sitesQuery.data.filter(s => !recentBookings.has(s.id));

    // Reservations with missing data
    const incompleteReservations = reservationsQuery.data.filter(r =>
      !r.totalAmount || r.totalAmount === 0 || !r.arrivalDate || !r.departureDate
    );

    // Future reservations with no payment
    const futureUnpaid = reservationsQuery.data.filter(r => {
      const arrival = new Date(r.arrivalDate);
      return arrival > now && r.status === 'confirmed' && (r.paidAmount || 0) === 0;
    });

    // Reservations with negative balance
    const negativeBalance = reservationsQuery.data.filter(r =>
      (r.balanceAmount || 0) < 0
    );

    return {
      inactiveSites: inactiveSites.length,
      incompleteReservations: incompleteReservations.length,
      futureUnpaid: futureUnpaid.length,
      negativeBalance: negativeBalance.length,
      totalSites: sitesQuery.data.length,
      totalReservations: reservationsQuery.data.length
    };
  }, [reservationsQuery.data, sitesQuery.data]);

  // Marketing: Conversion and booking value
  const marketingStats = useMemo(() => {
    if (!reservationsQuery.data) return null;

    const total = reservationsQuery.data.length;
    const confirmed = reservationsQuery.data.filter(r => r.status === 'confirmed').length;
    const pending = reservationsQuery.data.filter(r => r.status === 'pending').length;
    const cancelled = reservationsQuery.data.filter(r => r.status === 'cancelled').length;

    const conversionRate = total > 0 ? (((confirmed + pending) / total) * 100).toFixed(1) : '0';

    const totalValue = reservationsQuery.data
      .filter(r => r.status !== 'cancelled')
      .reduce((sum, r) => sum + (r.totalAmount || 0), 0) / 100;

    const avgBookingValue = (confirmed + pending) > 0 ? totalValue / (confirmed + pending) : 0;

    return {
      total,
      confirmed,
      pending,
      cancelled,
      conversionRate,
      avgBookingValue
    };
  }, [reservationsQuery.data]);

  // Year-over-year comparison
  const yearOverYearStats = useMemo(() => {
    if (!reservationsQuery.data) return null;

    const now = new Date();
    const thisYearStart = new Date(now.getFullYear(), 0, 1);
    const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
    const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31);

    const thisYear = reservationsQuery.data.filter(r => {
      const arrival = new Date(r.arrivalDate);
      return arrival >= thisYearStart && r.status !== 'cancelled';
    });

    const lastYear = reservationsQuery.data.filter(r => {
      const arrival = new Date(r.arrivalDate);
      return arrival >= lastYearStart && arrival <= lastYearEnd && r.status !== 'cancelled';
    });

    const thisYearRevenue = thisYear.reduce((sum, r) => sum + (r.totalAmount || 0), 0) / 100;
    const lastYearRevenue = lastYear.reduce((sum, r) => sum + (r.totalAmount || 0), 0) / 100;

    const revenueChange = lastYearRevenue > 0 ? (((thisYearRevenue - lastYearRevenue) / lastYearRevenue) * 100).toFixed(1) : '0';

    return {
      thisYear: { bookings: thisYear.length, revenue: thisYearRevenue },
      lastYear: { bookings: lastYear.length, revenue: lastYearRevenue },
      change: {
        bookings: thisYear.length - lastYear.length,
        revenuePercent: revenueChange
      }
    };
  }, [reservationsQuery.data]);

  // Pricing analysis by site class
  const pricingAnalysis = useMemo(() => {
    if (!reservationsQuery.data || !sitesQuery.data) return null;

    const siteMap = new Map(sitesQuery.data.map(s => [s.id, s]));
    const classData: Record<string, { revenue: number; nights: number }> = {};

    reservationsQuery.data.forEach(r => {
      if (r.status !== 'cancelled') {
        const site = siteMap.get(r.siteId);
        const className = (site as any)?.siteClass?.name ?? site?.siteType ?? "Unknown";
        if (!classData[className]) {
          classData[className] = { revenue: 0, nights: 0 };
        }
        const arrival = new Date(r.arrivalDate);
        const departure = new Date(r.departureDate);
        const nights = Math.max(1, Math.floor((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24)));
        classData[className].revenue += (r.totalAmount || 0) / 100;
        classData[className].nights += nights;
      }
    });

    return Object.entries(classData).map(([className, data]) => ({
      className,
      adr: data.nights > 0 ? (data.revenue / data.nights).toFixed(2) : '0',
      totalNights: data.nights,
      totalRevenue: data.revenue
    })).sort((a, b) => parseFloat(b.adr) - parseFloat(a.adr));
  }, [reservationsQuery.data, sitesQuery.data]);

  // Party size distribution
  const partySizeStats = useMemo(() => {
    if (!reservationsQuery.data) return null;

    const distribution: Record<string, number> = {
      '1-2': 0,
      '3-4': 0,
      '5-6': 0,
      '7-8': 0,
      '9+': 0
    };

    let totalGuests = 0;
    let count = 0;

    reservationsQuery.data.forEach(r => {
      if (r.status !== 'cancelled') {
        const partySize = (r as any).partySize || (r as any).numberOfGuests || 2; // Default to 2 if not available
        totalGuests += partySize;
        count++;

        if (partySize <= 2) distribution['1-2']++;
        else if (partySize <= 4) distribution['3-4']++;
        else if (partySize <= 6) distribution['5-6']++;
        else if (partySize <= 8) distribution['7-8']++;
        else distribution['9+']++;
      }
    });

    return {
      distribution,
      avgPartySize: count > 0 ? (totalGuests / count).toFixed(1) : '0'
    };
  }, [reservationsQuery.data]);

  // Refund and modification tracking
  const refundStats = useMemo(() => {
    if (!reservationsQuery.data) return null;

    // Look for cancelled reservations with payments (indicating refunds)
    const cancelled = reservationsQuery.data.filter(r => r.status === 'cancelled');
    const refundedAmount = cancelled.reduce((sum, r) => sum + (r.paidAmount || 0), 0) / 100;

    return {
      totalCancelled: cancelled.length,
      refundedAmount,
      avgRefund: cancelled.length > 0 ? refundedAmount / cancelled.length : 0
    };
  }, [reservationsQuery.data]);

  // Rate consistency audit
  const rateConsistencyStats = useMemo(() => {
    if (!reservationsQuery.data || !sitesQuery.data) return null;

    const siteMap = new Map(sitesQuery.data.map(s => [s.id, s]));
    const siteRates: Record<string, number[]> = {};

    reservationsQuery.data.forEach(r => {
      if (r.status !== 'cancelled' && r.totalAmount && r.totalAmount > 0) {
        const arrival = new Date(r.arrivalDate);
        const departure = new Date(r.departureDate);
        const nights = Math.max(1, Math.floor((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24)));
        const perNight = (r.totalAmount / 100) / nights;

        if (!siteRates[r.siteId]) {
          siteRates[r.siteId] = [];
        }
        siteRates[r.siteId].push(perNight);
      }
    });

    let inconsistentSites = 0;
    const siteVariance: Array<{ siteName: string; minRate: number; maxRate: number; variance: number }> = [];

    Object.entries(siteRates).forEach(([siteId, rates]) => {
      if (rates.length > 1) {
        const min = Math.min(...rates);
        const max = Math.max(...rates);
        const variance = ((max - min) / min) * 100;

        if (variance > 20) { // More than 20% variance
          inconsistentSites++;
          const site = siteMap.get(siteId);
          if (site) {
            siteVariance.push({
              siteName: site.name,
              minRate: min,
              maxRate: max,
              variance
            });
          }
        }
      }
    });

    return {
      totalSitesChecked: Object.keys(siteRates).length,
      inconsistentSites,
      siteVariance: siteVariance.sort((a, b) => b.variance - a.variance).slice(0, 10)
    };
  }, [reservationsQuery.data, sitesQuery.data]);

  // PHASE 1 REPORTS - Daily Operations

  // Daily arrivals
  const dailyArrivals = useMemo(() => {
    if (!reservationsQuery.data || !sitesQuery.data) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const siteMap = new Map(sitesQuery.data.map(s => [s.id, s]));

    return reservationsQuery.data
      .filter(r => {
        const arrival = new Date(r.arrivalDate);
        return arrival >= today && arrival < tomorrow && r.status !== 'cancelled';
      })
      .map(r => ({
        ...r,
        siteName: siteMap.get(r.siteId)?.name || r.siteId,
        guestName: `${(r as any).guest?.primaryFirstName || ''} ${(r as any).guest?.primaryLastName || ''}`.trim() || 'N/A'
      }))
      .sort((a, b) => a.siteName.localeCompare(b.siteName));
  }, [reservationsQuery.data, sitesQuery.data]);

  // Daily departures
  const dailyDepartures = useMemo(() => {
    if (!reservationsQuery.data || !sitesQuery.data) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const siteMap = new Map(sitesQuery.data.map(s => [s.id, s]));

    return reservationsQuery.data
      .filter(r => {
        const departure = new Date(r.departureDate);
        return departure >= today && departure < tomorrow && r.status !== 'cancelled';
      })
      .map(r => ({
        ...r,
        siteName: siteMap.get(r.siteId)?.name || r.siteId,
        guestName: `${(r as any).guest?.primaryFirstName || ''} ${(r as any).guest?.primaryLastName || ''}`.trim() || 'N/A'
      }))
      .sort((a, b) => a.siteName.localeCompare(b.siteName));
  }, [reservationsQuery.data, sitesQuery.data]);

  // In-house guests (currently occupied)
  const inHouseGuests = useMemo(() => {
    if (!reservationsQuery.data || !sitesQuery.data) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const siteMap = new Map(sitesQuery.data.map(s => [s.id, s]));

    return reservationsQuery.data
      .filter(r => {
        const arrival = new Date(r.arrivalDate);
        const departure = new Date(r.departureDate);
        return arrival <= today && departure > today && r.status !== 'cancelled';
      })
      .map(r => ({
        ...r,
        siteName: siteMap.get(r.siteId)?.name || r.siteId,
        guestName: `${(r as any).guest?.primaryFirstName || ''} ${(r as any).guest?.primaryLastName || ''}`.trim() || 'N/A',
        nightsRemaining: Math.ceil((new Date(r.departureDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      }))
      .sort((a, b) => a.siteName.localeCompare(b.siteName));
  }, [reservationsQuery.data, sitesQuery.data]);

  // Check-in schedule (next 7 days)
  const upcomingCheckIns = useMemo(() => {
    if (!reservationsQuery.data || !sitesQuery.data) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysOut = new Date(today);
    sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);

    const siteMap = new Map(sitesQuery.data.map(s => [s.id, s]));

    return reservationsQuery.data
      .filter(r => {
        const arrival = new Date(r.arrivalDate);
        return arrival >= today && arrival < sevenDaysOut && r.status !== 'cancelled';
      })
      .map(r => ({
        ...r,
        siteName: siteMap.get(r.siteId)?.name || r.siteId,
        guestName: `${(r as any).guest?.primaryFirstName || ''} ${(r as any).guest?.primaryLastName || ''}`.trim() || 'N/A'
      }))
      .sort((a, b) => new Date(a.arrivalDate).getTime() - new Date(b.arrivalDate).getTime());
  }, [reservationsQuery.data, sitesQuery.data]);

  // Check-out schedule (next 7 days)
  const upcomingCheckOuts = useMemo(() => {
    if (!reservationsQuery.data || !sitesQuery.data) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysOut = new Date(today);
    sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);

    const siteMap = new Map(sitesQuery.data.map(s => [s.id, s]));

    return reservationsQuery.data
      .filter(r => {
        const departure = new Date(r.departureDate);
        return departure >= today && departure < sevenDaysOut && r.status !== 'cancelled';
      })
      .map(r => ({
        ...r,
        siteName: siteMap.get(r.siteId)?.name || r.siteId,
        guestName: `${(r as any).guest?.primaryFirstName || ''} ${(r as any).guest?.primaryLastName || ''}`.trim() || 'N/A'
      }))
      .sort((a, b) => new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime());
  }, [reservationsQuery.data, sitesQuery.data]);

  // Weekly revenue summary
  const weeklyRevenue = useMemo(() => {
    if (!reservationsQuery.data) return null;

    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    const weekReservations = reservationsQuery.data.filter(r => {
      const arrival = new Date(r.arrivalDate);
      return arrival >= startOfWeek && arrival < endOfWeek && r.status !== 'cancelled';
    });

    const revenue = weekReservations.reduce((sum, r) => sum + (r.totalAmount || 0), 0) / 100;
    const paid = weekReservations.reduce((sum, r) => sum + (r.paidAmount || 0), 0) / 100;

    return {
      bookings: weekReservations.length,
      revenue,
      paid,
      outstanding: revenue - paid
    };
  }, [reservationsQuery.data]);

  // Quarterly revenue summary
  const quarterlyRevenue = useMemo(() => {
    if (!reservationsQuery.data) return null;

    const now = new Date();
    const currentQuarter = Math.floor(now.getMonth() / 3);
    const quarters = [];

    for (let q = 0; q < 4; q++) {
      const qStart = new Date(now.getFullYear(), q * 3, 1);
      const qEnd = new Date(now.getFullYear(), (q + 1) * 3, 0);

      const qReservations = reservationsQuery.data.filter(r => {
        const arrival = new Date(r.arrivalDate);
        return arrival >= qStart && arrival <= qEnd && r.status !== 'cancelled';
      });

      quarters.push({
        quarter: `Q${q + 1} ${now.getFullYear()}`,
        bookings: qReservations.length,
        revenue: qReservations.reduce((sum, r) => sum + (r.totalAmount || 0), 0) / 100,
        isCurrent: q === currentQuarter
      });
    }

    return quarters;
  }, [reservationsQuery.data]);

  // Payment due report (outstanding balances)
  const paymentDueReport = useMemo(() => {
    if (!reservationsQuery.data || !sitesQuery.data) return null;

    const siteMap = new Map(sitesQuery.data.map(s => [s.id, s]));

    return reservationsQuery.data
      .filter(r => r.status !== 'cancelled' && (r.balanceAmount || 0) > 0)
      .map(r => ({
        ...r,
        siteName: siteMap.get(r.siteId)?.name || r.siteId,
        guestName: `${(r as any).guest?.primaryFirstName || ''} ${(r as any).guest?.primaryLastName || ''}`.trim() || 'N/A',
        balance: (r.balanceAmount || 0) / 100
      }))
      .sort((a, b) => b.balance - a.balance);
  }, [reservationsQuery.data, sitesQuery.data]);

  // Site status report
  const siteStatusReport = useMemo(() => {
    if (!reservationsQuery.data || !sitesQuery.data) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const occupiedSites = new Set(
      reservationsQuery.data
        .filter(r => {
          const arrival = new Date(r.arrivalDate);
          const departure = new Date(r.departureDate);
          return arrival <= today && departure > today && r.status !== 'cancelled';
        })
        .map(r => r.siteId)
    );

    return sitesQuery.data.map(site => ({
      id: site.id,
      name: site.name,
      className: (site as any)?.siteClass?.name || site.siteType || 'N/A',
      status: !site.isActive ? 'Inactive' : occupiedSites.has(site.id) ? 'Occupied' : 'Available',
      isActive: site.isActive
    }));
  }, [reservationsQuery.data, sitesQuery.data]);

  // Transaction log (financial activity)
  const transactionLog = useMemo(() => {
    if (!reservationsQuery.data || !sitesQuery.data) return null;

    const siteMap = new Map(sitesQuery.data.map(s => [s.id, s]));

    return reservationsQuery.data
      .filter(r => r.status !== 'cancelled' && ((r.paidAmount || 0) > 0 || (r.totalAmount || 0) > 0))
      .map(r => ({
        ...r,
        siteName: siteMap.get(r.siteId)?.name || r.siteId,
        guestName: `${(r as any).guest?.primaryFirstName || ''} ${(r as any).guest?.primaryLastName || ''}`.trim() || 'N/A',
        total: (r.totalAmount || 0) / 100,
        paid: (r.paidAmount || 0) / 100,
        balance: (r.balanceAmount || 0) / 100,
        transactionDate: r.createdAt || r.arrivalDate
      }))
      .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());
  }, [reservationsQuery.data, sitesQuery.data]);

  // Monthly revenue report (all 12 months for current year)
  const monthlyRevenue = useMemo(() => {
    if (!reservationsQuery.data) return null;

    const now = new Date();
    const currentMonth = now.getMonth();
    const months = [];

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let m = 0; m < 12; m++) {
      const monthStart = new Date(now.getFullYear(), m, 1);
      const monthEnd = new Date(now.getFullYear(), m + 1, 0);

      const monthReservations = reservationsQuery.data.filter(r => {
        const arrival = new Date(r.arrivalDate);
        return arrival >= monthStart && arrival <= monthEnd && r.status !== 'cancelled';
      });

      months.push({
        month: `${monthNames[m]} ${now.getFullYear()}`,
        bookings: monthReservations.length,
        revenue: monthReservations.reduce((sum, r) => sum + (r.totalAmount || 0), 0) / 100,
        paid: monthReservations.reduce((sum, r) => sum + (r.paidAmount || 0), 0) / 100,
        isCurrent: m === currentMonth
      });
    }

    return months;
  }, [reservationsQuery.data]);

  // Annual revenue report (last 3 years)
  const annualRevenue = useMemo(() => {
    if (!reservationsQuery.data) return null;

    const now = new Date();
    const currentYear = now.getFullYear();
    const years = [];

    for (let y = currentYear - 2; y <= currentYear; y++) {
      const yearStart = new Date(y, 0, 1);
      const yearEnd = new Date(y, 11, 31);

      const yearReservations = reservationsQuery.data.filter(r => {
        const arrival = new Date(r.arrivalDate);
        return arrival >= yearStart && arrival <= yearEnd && r.status !== 'cancelled';
      });

      years.push({
        year: y.toString(),
        bookings: yearReservations.length,
        revenue: yearReservations.reduce((sum, r) => sum + (r.totalAmount || 0), 0) / 100,
        paid: yearReservations.reduce((sum, r) => sum + (r.paidAmount || 0), 0) / 100,
        avgPerBooking: yearReservations.length > 0
          ? (yearReservations.reduce((sum, r) => sum + (r.totalAmount || 0), 0) / 100) / yearReservations.length
          : 0,
        isCurrent: y === currentYear
      });
    }

    return years;
  }, [reservationsQuery.data]);

  // Daily revenue report (last 30 days)
  const dailyRevenue = useMemo(() => {
    if (!reservationsQuery.data) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = [];

    for (let d = 29; d >= 0; d--) {
      const dayStart = new Date(today);
      dayStart.setDate(today.getDate() - d);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayReservations = reservationsQuery.data.filter(r => {
        const arrival = new Date(r.arrivalDate);
        return arrival >= dayStart && arrival < dayEnd && r.status !== 'cancelled';
      });

      days.push({
        date: dayStart.toISOString().split('T')[0],
        bookings: dayReservations.length,
        revenue: dayReservations.reduce((sum, r) => sum + (r.totalAmount || 0), 0) / 100,
        paid: dayReservations.reduce((sum, r) => sum + (r.paidAmount || 0), 0) / 100
      });
    }

    return days;
  }, [reservationsQuery.data]);

  // Cancellation report (last 30 days)
  const cancellationReport = useMemo(() => {
    if (!reservationsQuery.data || !sitesQuery.data) return null;

    const siteMap = new Map(sitesQuery.data.map(s => [s.id, s]));
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const cancelled = reservationsQuery.data
      .filter(r => {
        if (r.status !== 'cancelled') return false;
        const cancelDate = new Date(r.updatedAt ?? r.createdAt ?? Date.now());
        return cancelDate >= thirtyDaysAgo;
      })
      .map(r => ({
        ...r,
        siteName: siteMap.get(r.siteId)?.name || r.siteId,
        guestName: `${(r as any).guest?.primaryFirstName || ''} ${(r as any).guest?.primaryLastName || ''}`.trim() || 'N/A',
        lostRevenue: (r.totalAmount || 0) / 100,
        refunded: (r.paidAmount || 0) / 100,
        cancelDate: new Date(r.updatedAt ?? r.createdAt ?? Date.now()).toISOString()
      }))
      .sort((a, b) => new Date(b.cancelDate).getTime() - new Date(a.cancelDate).getTime());

    const totalLost = cancelled.reduce((sum, r) => sum + r.lostRevenue, 0);
    const totalRefunded = cancelled.reduce((sum, r) => sum + r.refunded, 0);

    return {
      cancellations: cancelled,
      summary: {
        count: cancelled.length,
        totalLost,
        totalRefunded,
        netLoss: totalLost - totalRefunded
      }
    };
  }, [reservationsQuery.data, sitesQuery.data]);

  // No-show report (guests who didn't arrive for confirmed reservations)
  const noShowReport = useMemo(() => {
    if (!reservationsQuery.data || !sitesQuery.data) return null;

    const siteMap = new Map(sitesQuery.data.map(s => [s.id, s]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // No-shows are reservations where arrival date has passed but status is still confirmed
    // In a real system, you'd have a separate "no-show" status
    const noShows = reservationsQuery.data
      .filter(r => {
        const arrival = new Date(r.arrivalDate);
        return arrival < today && r.status === 'confirmed' && (r.paidAmount || 0) > 0;
      })
      .map(r => ({
        ...r,
        siteName: siteMap.get(r.siteId)?.name || r.siteId,
        guestName: `${(r as any).guest?.primaryFirstName || ''} ${(r as any).guest?.primaryLastName || ''}`.trim() || 'N/A',
        lostRevenue: (r.totalAmount || 0) / 100,
        paid: (r.paidAmount || 0) / 100,
        daysLate: Math.floor((today.getTime() - new Date(r.arrivalDate).getTime()) / (1000 * 60 * 60 * 24))
      }))
      .sort((a, b) => b.daysLate - a.daysLate);

    return {
      noShows,
      summary: {
        count: noShows.length,
        totalLost: noShows.reduce((sum, r) => sum + r.lostRevenue, 0),
        totalPaid: noShows.reduce((sum, r) => sum + r.paid, 0)
      }
    };
  }, [reservationsQuery.data, sitesQuery.data]);

  // PHASE 2 REPORTS

  // Site utilization report (occupancy rates per site)
  const siteUtilizationReport = useMemo(() => {
    if (!reservationsQuery.data || !sitesQuery.data) return null;

    const today = new Date();
    const last90Days = new Date(today);
    last90Days.setDate(today.getDate() - 90);

    const siteMap = new Map(sitesQuery.data.map(s => [s.id, s]));
    const siteStats = new Map<string, { nights: number; revenue: number; bookings: number }>();

    // Initialize all sites
    sitesQuery.data.forEach(site => {
      siteStats.set(site.id, { nights: 0, revenue: 0, bookings: 0 });
    });

    // Calculate nights occupied and revenue per site
    reservationsQuery.data
      .filter(r => r.status !== 'cancelled')
      .forEach(r => {
        const arrival = new Date(r.arrivalDate);
        const departure = new Date(r.departureDate);

        if (arrival <= today && departure >= last90Days) {
          const nights = Math.ceil((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24));
          const stats = siteStats.get(r.siteId);
          if (stats) {
            stats.nights += nights;
            stats.revenue += (r.totalAmount || 0) / 100;
            stats.bookings += 1;
          }
        }
      });

    const utilization = Array.from(siteStats.entries())
      .map(([siteId, stats]) => {
        const site = siteMap.get(siteId);
        const occupancyRate = (stats.nights / 90) * 100;
        return {
          siteId,
          siteName: site?.name || siteId,
          siteClass: (site as any)?.siteClass?.name || site?.siteType || 'N/A',
          nights: stats.nights,
          occupancyRate,
          revenue: stats.revenue,
          bookings: stats.bookings,
          avgRevenuePerNight: stats.nights > 0 ? stats.revenue / stats.nights : 0
        };
      })
      .sort((a, b) => b.occupancyRate - a.occupancyRate);

    const avgOccupancy = utilization.reduce((sum, s) => sum + s.occupancyRate, 0) / utilization.length;

    return { sites: utilization, avgOccupancy };
  }, [reservationsQuery.data, sitesQuery.data]);

  // Revenue per site analysis
  const revenuePerSiteReport = useMemo(() => {
    if (!reservationsQuery.data || !sitesQuery.data) return null;

    const siteMap = new Map(sitesQuery.data.map(s => [s.id, s]));
    const siteRevenue = new Map<string, { revenue: number; bookings: number; nights: number }>();

    sitesQuery.data.forEach(site => {
      siteRevenue.set(site.id, { revenue: 0, bookings: 0, nights: 0 });
    });

    reservationsQuery.data
      .filter(r => r.status !== 'cancelled')
      .forEach(r => {
        const stats = siteRevenue.get(r.siteId);
        if (stats) {
          stats.revenue += (r.totalAmount || 0) / 100;
          stats.bookings += 1;
          const nights = Math.ceil((new Date(r.departureDate).getTime() - new Date(r.arrivalDate).getTime()) / (1000 * 60 * 60 * 24));
          stats.nights += nights;
        }
      });

    const sites = Array.from(siteRevenue.entries())
      .map(([siteId, stats]) => {
        const site = siteMap.get(siteId);
        return {
          siteId,
          siteName: site?.name || siteId,
          siteClass: (site as any)?.siteClass?.name || site?.siteType || 'N/A',
          totalRevenue: stats.revenue,
          bookings: stats.bookings,
          nights: stats.nights,
          avgPerBooking: stats.bookings > 0 ? stats.revenue / stats.bookings : 0,
          avgPerNight: stats.nights > 0 ? stats.revenue / stats.nights : 0
        };
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    const totalRevenue = sites.reduce((sum, s) => sum + s.totalRevenue, 0);

    return { sites, totalRevenue };
  }, [reservationsQuery.data, sitesQuery.data]);

  const occupancyHeatPoints = useMemo(() => {
    if (!siteUtilizationReport?.sites) return [];
    return siteUtilizationReport.sites.map((site, idx) => {
      const coords = siteCoords.map.get(site.siteId) || { latitude: null, longitude: null };
      return {
        id: site.siteId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        value: Number(site.occupancyRate ?? 0),
        label: `${site.siteName} (${site.siteClass})`,
        _idx: idx
      };
    });
  }, [siteUtilizationReport?.sites, siteCoords.map]);

  const revenueHeatPoints = useMemo(() => {
    if (!revenuePerSiteReport?.sites) return [];
    return revenuePerSiteReport.sites.map((site, idx) => {
      const coords = siteCoords.map.get(site.siteId) || { latitude: null, longitude: null };
      return {
        id: site.siteId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        value: Number(site.totalRevenue ?? 0),
        label: `${site.siteName} (${site.siteClass})`,
        _idx: idx
      };
    });
  }, [revenuePerSiteReport?.sites, siteCoords.map]);

  useEffect(() => {
    if (!enableAnalyticsMaps) return;
    if (occupancyHeatPoints.length > 0) {
      recordTelemetry({ source: "reports", type: "sync", status: "info", message: "Heatmap occupancy ready", meta: { points: occupancyHeatPoints.length } });
    }
    if (revenueHeatPoints.length > 0) {
      recordTelemetry({ source: "reports", type: "sync", status: "info", message: "Heatmap revenue ready", meta: { points: revenueHeatPoints.length } });
    }
  }, [enableAnalyticsMaps, occupancyHeatPoints.length, revenueHeatPoints.length]);

  // Guest loyalty report (repeat visitors)
  const guestLoyaltyReport = useMemo(() => {
    if (!reservationsQuery.data) return null;

    const guestVisits = new Map<string, { name: string; visits: number; totalSpent: number; lastVisit: string }>();

    reservationsQuery.data
      .filter(r => r.status !== 'cancelled')
      .forEach(r => {
        const guestId = (r as any).guestId || r.id;
        const guestName = `${(r as any).guest?.primaryFirstName || ''} ${(r as any).guest?.primaryLastName || ''}`.trim() || 'N/A';

        if (!guestVisits.has(guestId)) {
          guestVisits.set(guestId, { name: guestName, visits: 0, totalSpent: 0, lastVisit: r.arrivalDate });
        }

        const stats = guestVisits.get(guestId)!;
        stats.visits += 1;
        stats.totalSpent += (r.totalAmount || 0) / 100;
        if (new Date(r.arrivalDate) > new Date(stats.lastVisit)) {
          stats.lastVisit = r.arrivalDate;
        }
      });

    const repeatGuests = Array.from(guestVisits.entries())
      .filter(([_, stats]) => stats.visits > 1)
      .map(([id, stats]) => ({ guestId: id, ...stats }))
      .sort((a, b) => b.visits - a.visits);

    const loyaltyStats = {
      totalGuests: guestVisits.size,
      repeatGuests: repeatGuests.length,
      repeatRate: (repeatGuests.length / guestVisits.size) * 100,
      avgVisitsPerRepeatGuest: repeatGuests.length > 0
        ? repeatGuests.reduce((sum, g) => sum + g.visits, 0) / repeatGuests.length
        : 0
    };

    return { guests: repeatGuests, stats: loyaltyStats };
  }, [reservationsQuery.data]);

  // Length of stay distribution
  const lengthOfStayReport = useMemo(() => {
    if (!reservationsQuery.data) return null;

    const distribution = new Map<number, number>();

    reservationsQuery.data
      .filter(r => r.status !== 'cancelled')
      .forEach(r => {
        const nights = Math.ceil((new Date(r.departureDate).getTime() - new Date(r.arrivalDate).getTime()) / (1000 * 60 * 60 * 24));
        distribution.set(nights, (distribution.get(nights) || 0) + 1);
      });

    const stays = Array.from(distribution.entries())
      .map(([nights, count]) => ({ nights, count }))
      .sort((a, b) => a.nights - b.nights);

    const totalBookings = stays.reduce((sum, s) => sum + s.count, 0);
    const avgStay = stays.reduce((sum, s) => sum + (s.nights * s.count), 0) / totalBookings;

    return { distribution: stays, avgStay, totalBookings };
  }, [reservationsQuery.data]);

  // Booking lead time analysis (how far in advance people book)
  const bookingLeadTimeReport = useMemo(() => {
    if (!reservationsQuery.data) return null;

    const leadTimes: number[] = [];

    reservationsQuery.data
      .filter(r => r.status !== 'cancelled' && r.createdAt)
      .forEach(r => {
        const created = new Date(r.createdAt ?? Date.now());
        const arrival = new Date(r.arrivalDate);
        const leadDays = Math.floor((arrival.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        if (leadDays >= 0) leadTimes.push(leadDays);
      });

    if (leadTimes.length === 0) return null;

    leadTimes.sort((a, b) => a - b);
    const avgLeadTime = leadTimes.reduce((sum, d) => sum + d, 0) / leadTimes.length;
    const medianLeadTime = leadTimes[Math.floor(leadTimes.length / 2)];

    // Distribution buckets
    const buckets = {
      sameDay: leadTimes.filter(d => d === 0).length,
      within7Days: leadTimes.filter(d => d > 0 && d <= 7).length,
      within14Days: leadTimes.filter(d => d > 7 && d <= 14).length,
      within30Days: leadTimes.filter(d => d > 14 && d <= 30).length,
      within60Days: leadTimes.filter(d => d > 30 && d <= 60).length,
      within90Days: leadTimes.filter(d => d > 60 && d <= 90).length,
      over90Days: leadTimes.filter(d => d > 90).length
    };

    return { avgLeadTime, medianLeadTime, buckets, total: leadTimes.length };
  }, [reservationsQuery.data]);

  // PHASE 3 REPORTS

  // Peak vs Off-Peak Season Analysis
  const seasonalAnalysisReport = useMemo(() => {
    if (!reservationsQuery.data) return null;

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthStats = new Array(12).fill(0).map(() => ({ bookings: 0, revenue: 0, nights: 0 }));

    reservationsQuery.data
      .filter(r => r.status !== 'cancelled')
      .forEach(r => {
        const arrival = new Date(r.arrivalDate);
        const month = arrival.getMonth();
        const nights = Math.ceil((new Date(r.departureDate).getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24));

        monthStats[month].bookings += 1;
        monthStats[month].revenue += (r.totalAmount || 0) / 100;
        monthStats[month].nights += nights;
      });

    const months = monthStats.map((stats, idx) => ({
      month: monthNames[idx],
      bookings: stats.bookings,
      revenue: stats.revenue,
      nights: stats.nights,
      avgRevenuePerBooking: stats.bookings > 0 ? stats.revenue / stats.bookings : 0
    }));

    const avgRevenue = months.reduce((sum, m) => sum + m.revenue, 0) / 12;
    const peakMonths = months.filter(m => m.revenue > avgRevenue * 1.2);
    const offPeakMonths = months.filter(m => m.revenue < avgRevenue * 0.8);

    return { months, avgRevenue, peakMonths, offPeakMonths };
  }, [reservationsQuery.data]);

  // Day of Week Performance
  const dayOfWeekReport = useMemo(() => {
    if (!reservationsQuery.data) return null;

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayStats = new Array(7).fill(0).map(() => ({ bookings: 0, revenue: 0 }));

    reservationsQuery.data
      .filter(r => r.status !== 'cancelled')
      .forEach(r => {
        const arrival = new Date(r.arrivalDate);
        const day = arrival.getDay();

        dayStats[day].bookings += 1;
        dayStats[day].revenue += (r.totalAmount || 0) / 100;
      });

    const days = dayStats.map((stats, idx) => ({
      day: dayNames[idx],
      bookings: stats.bookings,
      revenue: stats.revenue,
      avgRevenuePerBooking: stats.bookings > 0 ? stats.revenue / stats.bookings : 0
    }));

    const totalBookings = days.reduce((sum, d) => sum + d.bookings, 0);
    const avgBookingsPerDay = totalBookings / 7;

    return { days, avgBookingsPerDay };
  }, [reservationsQuery.data]);

  // Revenue Optimization Opportunities
  const revenueOptimizationReport = useMemo(() => {
    if (!reservationsQuery.data || !sitesQuery.data) return null;

    const opportunities = [];

    // Low utilization sites
    const siteMap = new Map(sitesQuery.data.map(s => [s.id, s]));
    const siteBookings = new Map<string, number>();

    sitesQuery.data.forEach(site => siteBookings.set(site.id, 0));

    reservationsQuery.data
      .filter(r => r.status !== 'cancelled')
      .forEach(r => {
        siteBookings.set(r.siteId, (siteBookings.get(r.siteId) || 0) + 1);
      });

    const avgBookings = Array.from(siteBookings.values()).reduce((sum, b) => sum + b, 0) / siteBookings.size;

    siteBookings.forEach((bookings, siteId) => {
      if (bookings < avgBookings * 0.5) {
        const site = siteMap.get(siteId);
        opportunities.push({
          type: 'Low Utilization',
          description: `${site?.name || siteId} has ${bookings} bookings (${((bookings / avgBookings) * 100).toFixed(0)}% of average)`,
          site: site?.name || siteId,
          severity: bookings === 0 ? 'high' : 'medium',
          metric: bookings
        });
      }
    });

    // Add more opportunities based on data patterns
    const lastMonthRevenue = reservationsQuery.data
      .filter(r => {
        const arrival = new Date(r.arrivalDate);
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        return arrival >= lastMonth && r.status !== 'cancelled';
      })
      .reduce((sum, r) => sum + (r.totalAmount || 0), 0) / 100;

    const twoMonthsAgoRevenue = reservationsQuery.data
      .filter(r => {
        const arrival = new Date(r.arrivalDate);
        const twoMonthsAgo = new Date();
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        return arrival >= twoMonthsAgo && arrival < oneMonthAgo && r.status !== 'cancelled';
      })
      .reduce((sum, r) => sum + (r.totalAmount || 0), 0) / 100;

    if (lastMonthRevenue < twoMonthsAgoRevenue * 0.9) {
      opportunities.push({
        type: 'Revenue Decline',
        description: `Revenue declined ${(((twoMonthsAgoRevenue - lastMonthRevenue) / twoMonthsAgoRevenue) * 100).toFixed(1)}% last month`,
        site: 'All Sites',
        severity: 'high',
        metric: lastMonthRevenue - twoMonthsAgoRevenue
      });
    }

    return opportunities.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity as keyof typeof severityOrder] - severityOrder[b.severity as keyof typeof severityOrder];
    });
  }, [reservationsQuery.data, sitesQuery.data]);

  // Future Occupancy Forecast (next 90 days)
  const occupancyForecastReport = useMemo(() => {
    if (!reservationsQuery.data || !sitesQuery.data) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const totalSites = sitesQuery.data.filter(s => s.isActive).length;

    const next90Days = [];
    for (let i = 0; i < 90; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      const occupiedSites = new Set(
        reservationsQuery.data
          .filter(r => {
            const arrival = new Date(r.arrivalDate);
            const departure = new Date(r.departureDate);
            return arrival <= date && departure > date && r.status !== 'cancelled';
          })
          .map(r => r.siteId)
      );

      const occupancy = (occupiedSites.size / totalSites) * 100;

      next90Days.push({
        date: date.toISOString().split('T')[0],
        occupiedSites: occupiedSites.size,
        totalSites,
        occupancy
      });
    }

    const avgOccupancy = next90Days.reduce((sum, d) => sum + d.occupancy, 0) / 90;
    const peakDay = next90Days.reduce((max, d) => d.occupancy > max.occupancy ? d : max, next90Days[0]);
    const lowDay = next90Days.reduce((min, d) => d.occupancy < min.occupancy ? d : min, next90Days[0]);

    return { forecast: next90Days, avgOccupancy, peakDay, lowDay };
  }, [reservationsQuery.data, sitesQuery.data]);

  // PHASE 4 REPORTS - Detailed Breakdowns & Variations

  // Site Class Revenue Breakdown (by time period)
  const siteClassRevenueBreakdown = useMemo(() => {
    if (!reservationsQuery.data || !sitesQuery.data) return null;

    const siteMap = new Map(sitesQuery.data.map(s => [s.id, s]));
    const classStats = new Map<string, {
      daily: number; weekly: number; monthly: number; quarterly: number; annual: number;
      bookings: number; nights: number
    }>();

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    reservationsQuery.data
      .filter(r => r.status !== 'cancelled')
      .forEach(r => {
        const site = siteMap.get(r.siteId);
        const className = (site as any)?.siteClass?.name ?? site?.siteType ?? "Unknown";
        if (!classStats.has(className)) {
          classStats.set(className, { daily: 0, weekly: 0, monthly: 0, quarterly: 0, annual: 0, bookings: 0, nights: 0 });
        }

        const stats = classStats.get(className)!;
        const revenue = (r.totalAmount || 0) / 100;
        const arrival = new Date(r.arrivalDate);
        const nights = Math.ceil((new Date(r.departureDate).getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24));

        stats.bookings += 1;
        stats.nights += nights;
        stats.annual += revenue;

        // Daily
        if (arrival.toDateString() === today.toDateString()) {
          stats.daily += revenue;
        }

        // Weekly (last 7 days)
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);
        if (arrival >= weekAgo) {
          stats.weekly += revenue;
        }

        // Monthly (last 30 days)
        const monthAgo = new Date(today);
        monthAgo.setDate(today.getDate() - 30);
        if (arrival >= monthAgo) {
          stats.monthly += revenue;
        }

        // Quarterly (last 90 days)
        const quarterAgo = new Date(today);
        quarterAgo.setDate(today.getDate() - 90);
        if (arrival >= quarterAgo) {
          stats.quarterly += revenue;
        }
      });

    return Array.from(classStats.entries()).map(([className, stats]) => ({
      className,
      ...stats,
      avgRevenuePerNight: stats.nights > 0 ? stats.annual / stats.nights : 0
    })).sort((a, b) => b.annual - a.annual);
  }, [reservationsQuery.data, sitesQuery.data]);

  // Guest Segmentation Report (New vs Returning)
  const guestSegmentationReport = useMemo(() => {
    if (!reservationsQuery.data) return null;

    const guestFirstVisit = new Map<string, Date>();
    const segments = {
      newGuests: { count: 0, revenue: 0, bookings: 0 },
      returningGuests: { count: 0, revenue: 0, bookings: 0 }
    };

    // First pass: identify first visit dates
    reservationsQuery.data
      .filter(r => r.status !== 'cancelled')
      .forEach(r => {
        const guestId = (r as any).guestId || r.id;
        const arrival = new Date(r.arrivalDate);

        if (!guestFirstVisit.has(guestId) || arrival < guestFirstVisit.get(guestId)!) {
          guestFirstVisit.set(guestId, arrival);
        }
      });

    // Second pass: categorize
    const guestBookingCount = new Map<string, number>();
    reservationsQuery.data
      .filter(r => r.status !== 'cancelled')
      .forEach(r => {
        const guestId = (r as any).guestId || r.id;
        const count = (guestBookingCount.get(guestId) || 0) + 1;
        guestBookingCount.set(guestId, count);

        const revenue = (r.totalAmount || 0) / 100;
        const isNewGuest = count === 1;

        if (isNewGuest) {
          segments.newGuests.bookings += 1;
          segments.newGuests.revenue += revenue;
        } else {
          segments.returningGuests.bookings += 1;
          segments.returningGuests.revenue += revenue;
        }
      });

    segments.newGuests.count = Array.from(guestBookingCount.values()).filter(c => c === 1).length;
    segments.returningGuests.count = Array.from(guestBookingCount.values()).filter(c => c > 1).length;

    const total = segments.newGuests.count + segments.returningGuests.count;
    const returningRate = total > 0 ? (segments.returningGuests.count / total) * 100 : 0;

    return {
      segments: [
        { type: 'New Guests', ...segments.newGuests, avgRevenue: segments.newGuests.bookings > 0 ? segments.newGuests.revenue / segments.newGuests.bookings : 0 },
        { type: 'Returning Guests', ...segments.returningGuests, avgRevenue: segments.returningGuests.bookings > 0 ? segments.returningGuests.revenue / segments.returningGuests.bookings : 0 }
      ],
      returningRate
    };
  }, [reservationsQuery.data]);

  // Year-over-Year Comparison
  const yearOverYearComparison = useMemo(() => {
    if (!reservationsQuery.data) return null;

    const currentYear = new Date().getFullYear();
    const years = [currentYear - 2, currentYear - 1, currentYear];

    return years.map(year => {
      const yearReservations = reservationsQuery.data.filter(r => {
        const arrival = new Date(r.arrivalDate);
        return arrival.getFullYear() === year && r.status !== 'cancelled';
      });

      const revenue = yearReservations.reduce((sum, r) => sum + (r.totalAmount || 0), 0) / 100;
      const bookings = yearReservations.length;

      return {
        year,
        revenue,
        bookings,
        avgRevenuePerBooking: bookings > 0 ? revenue / bookings : 0
      };
    });
  }, [reservationsQuery.data]);

  // Advanced Audit Report - Rate Changes Over Time
  const rateChangeAuditReport = useMemo(() => {
    if (!reservationsQuery.data || !sitesQuery.data) return null;

    const siteMap = new Map(sitesQuery.data.map(s => [s.id, s]));
    const changes: any[] = [];

    // Group bookings by site and calculate avg rates over time
    const siteRatesByMonth = new Map<string, Map<string, number[]>>();

    reservationsQuery.data
      .filter(r => r.status !== 'cancelled' && r.totalAmount && r.totalAmount > 0)
      .forEach(r => {
        const arrival = new Date(r.arrivalDate);
        const departure = new Date(r.departureDate);
        const nights = Math.ceil((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24));
        const ratePerNight = nights > 0 ? (r.totalAmount / 100) / nights : 0;

        const monthKey = `${arrival.getFullYear()}-${String(arrival.getMonth() + 1).padStart(2, '0')}`;

        if (!siteRatesByMonth.has(r.siteId)) {
          siteRatesByMonth.set(r.siteId, new Map());
        }

        const siteMonths = siteRatesByMonth.get(r.siteId)!;
        if (!siteMonths.has(monthKey)) {
          siteMonths.set(monthKey, []);
        }

        siteMonths.get(monthKey)!.push(ratePerNight);
      });

    // Detect significant rate changes
    siteRatesByMonth.forEach((months, siteId) => {
      const site = siteMap.get(siteId);
      const monthKeys = Array.from(months.keys()).sort();

      for (let i = 1; i < monthKeys.length; i++) {
        const prevMonth = monthKeys[i - 1];
        const currMonth = monthKeys[i];

        const prevRates = months.get(prevMonth)!;
        const currRates = months.get(currMonth)!;

        const prevAvg = prevRates.reduce((sum, r) => sum + r, 0) / prevRates.length;
        const currAvg = currRates.reduce((sum, r) => sum + r, 0) / currRates.length;

        const changePercent = ((currAvg - prevAvg) / prevAvg) * 100;

        if (Math.abs(changePercent) > 10) {
          changes.push({
            site: site?.name || siteId,
            fromMonth: prevMonth,
            toMonth: currMonth,
            previousRate: prevAvg,
            newRate: currAvg,
            changePercent,
            severity: Math.abs(changePercent) > 25 ? 'high' : 'medium'
          });
        }
      }
    });

    return changes.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent)).slice(0, 20);
  }, [reservationsQuery.data, sitesQuery.data]);

  // Operational Efficiency - Turnover Analysis
  const turnoverEfficiencyReport = useMemo(() => {
    if (!reservationsQuery.data || !sitesQuery.data) return null;

    const siteMap = new Map(sitesQuery.data.map(s => [s.id, s]));
    const siteTurnovers = new Map<string, { turnovers: number; avgGapDays: number; totalGapDays: number }>();

    // Sort reservations by site and date
    const reservationsBySite = new Map<string, any[]>();
    reservationsQuery.data
      .filter(r => r.status !== 'cancelled')
      .forEach(r => {
        if (!reservationsBySite.has(r.siteId)) {
          reservationsBySite.set(r.siteId, []);
        }
        reservationsBySite.get(r.siteId)!.push(r);
      });

    reservationsBySite.forEach((reservations, siteId) => {
      const sorted = reservations.sort((a, b) =>
        new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime()
      );

      let turnovers = 0;
      let totalGapDays = 0;

      for (let i = 1; i < sorted.length; i++) {
        const prevDeparture = new Date(sorted[i - 1].departureDate);
        const currArrival = new Date(sorted[i].arrivalDate);
        const gapDays = Math.floor((currArrival.getTime() - prevDeparture.getTime()) / (1000 * 60 * 60 * 24));

        if (gapDays >= 0) {
          turnovers += 1;
          totalGapDays += gapDays;
        }
      }

      if (turnovers > 0) {
        siteTurnovers.set(siteId, {
          turnovers,
          avgGapDays: totalGapDays / turnovers,
          totalGapDays
        });
      }
    });

    const efficiency = Array.from(siteTurnovers.entries())
      .map(([siteId, stats]) => {
        const site = siteMap.get(siteId);
        return {
          site: site?.name || siteId,
          siteClass: (site as any)?.siteClass?.name || site?.siteType || 'N/A',
          ...stats,
          efficiency: stats.avgGapDays <= 1 ? 'Excellent' : stats.avgGapDays <= 2 ? 'Good' : stats.avgGapDays <= 3 ? 'Fair' : 'Poor'
        };
      })
      .sort((a, b) => b.turnovers - a.turnovers);

    const avgTurnoverTime = efficiency.reduce((sum, e) => sum + e.avgGapDays, 0) / efficiency.length;

    return { sites: efficiency, avgTurnoverTime };
  }, [reservationsQuery.data, sitesQuery.data]);

  // PHASE 5 REPORTS - Ultra-Advanced Specialized Analytics

  // Extended Stay Analysis (7+ nights, 14+ nights, 30+ nights)
  const extendedStayReport = useMemo(() => {
    if (!reservationsQuery.data || !sitesQuery.data) return null;

    const siteMap = new Map(sitesQuery.data.map(s => [s.id, s]));
    const categories = {
      weekly: { count: 0, revenue: 0, guests: new Set(), avgStay: 0, totalNights: 0 },
      biweekly: { count: 0, revenue: 0, guests: new Set(), avgStay: 0, totalNights: 0 },
      monthly: { count: 0, revenue: 0, guests: new Set(), avgStay: 0, totalNights: 0 }
    };

    const extendedStays: any[] = [];

    reservationsQuery.data
      .filter(r => r.status !== 'cancelled')
      .forEach(r => {
        const arrival = new Date(r.arrivalDate);
        const departure = new Date(r.departureDate);
        const nights = Math.ceil((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24));
        const revenue = (r.totalAmount || 0) / 100;
        const site = siteMap.get(r.siteId);
        const guestId = (r as any).guestId || r.id;
        const guestName = `${(r as any).guest?.primaryFirstName || ''} ${(r as any).guest?.primaryLastName || ''}`.trim() || 'N/A';

        if (nights >= 30) {
          categories.monthly.count += 1;
          categories.monthly.revenue += revenue;
          categories.monthly.guests.add(guestId);
          categories.monthly.totalNights += nights;
          extendedStays.push({ type: 'Monthly (30+)', nights, revenue, site: site?.name || r.siteId, guest: guestName, arrival: r.arrivalDate, departure: r.departureDate });
        } else if (nights >= 14) {
          categories.biweekly.count += 1;
          categories.biweekly.revenue += revenue;
          categories.biweekly.guests.add(guestId);
          categories.biweekly.totalNights += nights;
          extendedStays.push({ type: 'Bi-Weekly (14-29)', nights, revenue, site: site?.name || r.siteId, guest: guestName, arrival: r.arrivalDate, departure: r.departureDate });
        } else if (nights >= 7) {
          categories.weekly.count += 1;
          categories.weekly.revenue += revenue;
          categories.weekly.guests.add(guestId);
          categories.weekly.totalNights += nights;
        }
      });

    categories.weekly.avgStay = categories.weekly.count > 0 ? categories.weekly.totalNights / categories.weekly.count : 0;
    categories.biweekly.avgStay = categories.biweekly.count > 0 ? categories.biweekly.totalNights / categories.biweekly.count : 0;
    categories.monthly.avgStay = categories.monthly.count > 0 ? categories.monthly.totalNights / categories.monthly.count : 0;

    return {
      summary: [
        { type: 'Weekly Stays (7-13 nights)', ...categories.weekly, uniqueGuests: categories.weekly.guests.size },
        { type: 'Bi-Weekly Stays (14-29 nights)', ...categories.biweekly, uniqueGuests: categories.biweekly.guests.size },
        { type: 'Monthly Stays (30+ nights)', ...categories.monthly, uniqueGuests: categories.monthly.guests.size }
      ],
      extendedStays: extendedStays.sort((a, b) => b.nights - a.nights).slice(0, 20)
    };
  }, [reservationsQuery.data, sitesQuery.data]);

  // Group Booking Analysis (5+ in party)
  const groupBookingReport = useMemo(() => {
    if (!reservationsQuery.data || !sitesQuery.data) return null;

    const siteMap = new Map(sitesQuery.data.map(s => [s.id, s]));
    const groupBookings = reservationsQuery.data
      .filter(r => {
        const partySize = ((r as any).adults || 0) + ((r as any).children || 0);
        return r.status !== 'cancelled' && partySize >= 5;
      })
      .map(r => {
        const site = siteMap.get(r.siteId);
        const partySize = ((r as any).adults || 0) + ((r as any).children || 0);
        const revenue = (r.totalAmount || 0) / 100;
        return {
          guest: `${(r as any).guest?.primaryFirstName || ''} ${(r as any).guest?.primaryLastName || ''}`.trim() || 'N/A',
          site: site?.name || r.siteId,
          arrival: r.arrivalDate,
          departure: r.departureDate,
          partySize,
          revenue,
          revenuePerPerson: partySize > 0 ? revenue / partySize : 0
        };
      })
      .sort((a, b) => b.partySize - a.partySize);

    const totalRevenue = groupBookings.reduce((sum, g) => sum + g.revenue, 0);
    const totalPeople = groupBookings.reduce((sum, g) => sum + g.partySize, 0);
    const avgPartySize = groupBookings.length > 0
      ? totalPeople / groupBookings.length
      : 0;

    return {
      totalGroups: groupBookings.length,
      totalRevenue,
      avgPartySize,
      avgRevenuePerPerson: totalPeople > 0 ? totalRevenue / totalPeople : 0,
      largestGroups: groupBookings.slice(0, 20)
    };
  }, [reservationsQuery.data, sitesQuery.data]);

  // Advance vs Walk-in Booking Analysis
  const advanceBookingReport = useMemo(() => {
    if (!reservationsQuery.data) return null;

    const categoryData = {
      sameDay: { count: 0, revenue: 0 },
      advance: { count: 0, revenue: 0 },
      farAdvance: { count: 0, revenue: 0 }
    };

    reservationsQuery.data
      .filter(r => r.status !== 'cancelled' && r.createdAt)
      .forEach(r => {
        const created = new Date(r.createdAt ?? Date.now());
        const arrival = new Date(r.arrivalDate);
        const leadDays = Math.floor((arrival.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        const revenue = (r.totalAmount || 0) / 100;

        if (leadDays === 0) {
          categoryData.sameDay.count += 1;
          categoryData.sameDay.revenue += revenue;
        } else if (leadDays > 0 && leadDays <= 30) {
          categoryData.advance.count += 1;
          categoryData.advance.revenue += revenue;
        } else if (leadDays > 30) {
          categoryData.farAdvance.count += 1;
          categoryData.farAdvance.revenue += revenue;
        }
      });

    const total = categoryData.sameDay.count + categoryData.advance.count + categoryData.farAdvance.count;

    return {
      total,
      categories: [
        { type: 'Same Day / Walk-in', ...categoryData.sameDay, percentage: total > 0 ? (categoryData.sameDay.count / total) * 100 : 0, avgRevenue: categoryData.sameDay.count > 0 ? categoryData.sameDay.revenue / categoryData.sameDay.count : 0 },
        { type: 'Advance (1-30 days)', ...categoryData.advance, percentage: total > 0 ? (categoryData.advance.count / total) * 100 : 0, avgRevenue: categoryData.advance.count > 0 ? categoryData.advance.revenue / categoryData.advance.count : 0 },
        { type: 'Far Advance (30+ days)', ...categoryData.farAdvance, percentage: total > 0 ? (categoryData.farAdvance.count / total) * 100 : 0, avgRevenue: categoryData.farAdvance.count > 0 ? categoryData.farAdvance.revenue / categoryData.farAdvance.count : 0 }
      ]
    };
  }, [reservationsQuery.data]);

  // Pricing Strategy Recommendations
  const pricingStrategyReport = useMemo(() => {
    if (!reservationsQuery.data || !sitesQuery.data) return null;

    const recommendations: any[] = [];
    const siteMap = new Map(sitesQuery.data.map(s => [s.id, s]));

    // Analyze occupancy vs pricing
    const siteStats = new Map<string, { bookings: number; totalRevenue: number; avgRate: number }>();

    sitesQuery.data.forEach(site => {
      siteStats.set(site.id, { bookings: 0, totalRevenue: 0, avgRate: 0 });
    });

    reservationsQuery.data
      .filter(r => r.status !== 'cancelled')
      .forEach(r => {
        const stats = siteStats.get(r.siteId);
        if (stats) {
          stats.bookings += 1;
          stats.totalRevenue += (r.totalAmount || 0) / 100;
        }
      });

    const avgBookings = Array.from(siteStats.values()).reduce((sum, s) => sum + s.bookings, 0) / siteStats.size;

    siteStats.forEach((stats, siteId) => {
      const site = siteMap.get(siteId);
      stats.avgRate = stats.bookings > 0 ? stats.totalRevenue / stats.bookings : 0;

      // High demand, potentially underpriced
      if (stats.bookings > avgBookings * 1.5 && stats.avgRate < 100) {
        recommendations.push({
          suggestion: 'Increase Rates',
          priority: 'high',
          siteId: siteId,
          site: site?.name || siteId,
          reason: `High demand (${stats.bookings} bookings vs avg ${avgBookings.toFixed(0)}) - Consider raising rates`,
          currentRate: stats.avgRate,
          suggestedRate: stats.avgRate * 1.15,
          potentialIncrease: (stats.avgRate * 0.15 * stats.bookings)
        });
      }

      // Low demand, potentially overpriced
      if (stats.bookings < avgBookings * 0.5 && stats.avgRate > 50) {
        recommendations.push({
          type: 'Lower Rates / Promote',
          suggestion: 'Lower Rates / Promote',
          priority: 'medium',
          siteId: siteId,
          site: site?.name || siteId,
          reason: `Low demand (${stats.bookings} bookings vs avg ${avgBookings.toFixed(0)}) - Consider promotional pricing`,
          currentRate: stats.avgRate,
          suggestedRate: stats.avgRate * 0.90,
          potentialIncrease: 0
        });
      }

      // Mid-week low occupancy
      if (stats.bookings > 0 && stats.bookings < avgBookings && stats.avgRate > 0) {
        recommendations.push({
          suggestion: 'Mid-week Promo',
          priority: 'low',
          siteId: siteId,
          site: site?.name || siteId,
          reason: `Standard performance - consider a small mid-week discount to boost occupancy`,
          currentRate: stats.avgRate,
          suggestedRate: stats.avgRate * 0.95,
          potentialIncrease: (stats.avgRate * 0.05 * (stats.bookings * 0.2)) // Est 20% boost
        });
      }
    });

    // General "Gap Filler" recommendation if we have short stays
    recommendations.push({
      suggestion: 'Gap Filler Promo',
      priority: 'medium',
      siteId: null, // Global
      site: 'All Sites',
      reason: 'Encourage booking of 1-night gaps between reservations',
      currentRate: 0,
      suggestedRate: 0, // Dynamic
      potentialIncrease: 500 // Arbitrary est
    });

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder];
    }).slice(0, 25);
  }, [reservationsQuery.data, sitesQuery.data]);

  // Weekend Premium Analysis
  const weekendPremiumReport = useMemo(() => {
    if (!reservationsQuery.data) return null;

    const weekday = { bookings: 0, revenue: 0, nights: 0 };
    const weekend = { bookings: 0, revenue: 0, nights: 0 };

    reservationsQuery.data
      .filter(r => r.status !== 'cancelled')
      .forEach(r => {
        const arrival = new Date(r.arrivalDate);
        const departure = new Date(r.departureDate);
        const nights = Math.ceil((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24));
        const revenue = (r.totalAmount || 0) / 100;
        const dayOfWeek = arrival.getDay();

        if (dayOfWeek === 5 || dayOfWeek === 6) { // Friday or Saturday
          weekend.bookings += 1;
          weekend.revenue += revenue;
          weekend.nights += nights;
        } else {
          weekday.bookings += 1;
          weekday.revenue += revenue;
          weekday.nights += nights;
        }
      });

    const weekdayAvgRate = weekday.nights > 0 ? weekday.revenue / weekday.nights : 0;
    const weekendAvgRate = weekend.nights > 0 ? weekend.revenue / weekend.nights : 0;
    const premium = weekdayAvgRate > 0 ? ((weekendAvgRate - weekdayAvgRate) / weekdayAvgRate) * 100 : 0;

    return {
      weekday: { ...weekday, avgRate: weekdayAvgRate },
      weekend: { ...weekend, avgRate: weekendAvgRate },
      premium,
      recommendation: premium < 10 ? 'Consider implementing weekend premium pricing' :
        premium > 50 ? 'Weekend premium may be too high' :
          'Weekend pricing is optimized'
    };
  }, [reservationsQuery.data]);

  // Get human-readable report names
  const getReportDisplayName = (tabName: string): string => {
    const names: Record<string, string> = {
      overview: 'Overview',
      daily: 'Daily Operations',
      revenue: 'Revenue',
      performance: 'Performance',
      guests: 'Guests',
      marketing: 'Marketing',
      forecasting: 'Forecasting',
      accounting: 'Accounting',
      audits: 'Audits'
    };
    return names[tabName] || tabName;
  };

  // Calculate row count for export preview
  const getExportRowCount = (tabName: string): number => {
    switch (tabName) {
      case 'daily':
        return (dailyArrivals?.length || 0) + (dailyDepartures?.length || 0) + (inHouseGuests?.length || 0) + (transactionLog?.length || 0);
      case 'revenue':
        return reservationsQuery.data?.length || 0;
      case 'overview':
        return 10; // Summary metrics
      case 'performance':
        return (sitePerformance?.length || 0) + (revenueTrends?.length || 0);
      case 'guests':
        return reservationsQuery.data?.filter(r => r.status !== 'cancelled').length || 0;
      case 'accounting':
        return reservationsQuery.data?.length || 0;
      default:
        return reservationsQuery.data?.length || 0;
    }
  };

  // Prepare export preview and show confirmation dialog
  const prepareExportPreview = (tabName: string) => {
    const subMeta = currentSubMeta();
    setExportPreview({
      reportName: getReportDisplayName(tabName),
      subReportName: subMeta?.label || null,
      dateRange,
      rowCount: getExportRowCount(tabName),
      tabName
    });
    setShowExportDialog(true);
  };

  // Tab-specific export functions
  const exportTabToCSV = (tabName: string) => {
    const timestamp = new Date().toISOString().slice(0, 10);
    let csv = '';
    let filename = `${tabName.toLowerCase()}-report-${timestamp}.csv`;

    switch (tabName) {
      case 'daily':
        if (dailyArrivals && dailyDepartures && inHouseGuests && transactionLog && monthlyRevenue && annualRevenue && dailyRevenue) {
          csv = 'Daily Arrivals\n';
          csv += 'Site,Guest Name,Arrival Date,Departure Date,Status,Total\n';
          dailyArrivals.forEach(r => {
            csv += `${r.siteName},"${r.guestName}",${r.arrivalDate},${r.departureDate},${r.status},${((r.totalAmount || 0) / 100).toFixed(2)}\n`;
          });
          csv += '\nDaily Departures\n';
          csv += 'Site,Guest Name,Arrival Date,Departure Date,Status,Total\n';
          dailyDepartures.forEach(r => {
            csv += `${r.siteName},"${r.guestName}",${r.arrivalDate},${r.departureDate},${r.status},${((r.totalAmount || 0) / 100).toFixed(2)}\n`;
          });
          csv += '\nIn-House Guests\n';
          csv += 'Site,Guest Name,Arrival Date,Departure Date,Nights Remaining,Balance\n';
          inHouseGuests.forEach(r => {
            csv += `${r.siteName},"${r.guestName}",${r.arrivalDate},${r.departureDate},${r.nightsRemaining},${((r.balanceAmount || 0) / 100).toFixed(2)}\n`;
          });
          csv += '\nTransaction Log\n';
          csv += 'Date,Site,Guest Name,Arrival,Departure,Total Amount,Paid,Balance\n';
          transactionLog.forEach(r => {
            csv += `${r.transactionDate},${r.siteName},"${r.guestName}",${r.arrivalDate},${r.departureDate},${r.total.toFixed(2)},${r.paid.toFixed(2)},${r.balance.toFixed(2)}\n`;
          });
          csv += '\nMonthly Revenue\n';
          csv += 'Month,Bookings,Revenue,Paid\n';
          monthlyRevenue.forEach(m => {
            csv += `${m.month},${m.bookings},${m.revenue.toFixed(2)},${m.paid.toFixed(2)}\n`;
          });
          csv += '\nAnnual Revenue\n';
          csv += 'Year,Bookings,Revenue,Paid,Avg Per Booking\n';
          annualRevenue.forEach(y => {
            csv += `${y.year},${y.bookings},${y.revenue.toFixed(2)},${y.paid.toFixed(2)},${y.avgPerBooking.toFixed(2)}\n`;
          });
          csv += '\nDaily Revenue (Last 30 Days)\n';
          csv += 'Date,Bookings,Revenue,Paid\n';
          dailyRevenue.forEach(d => {
            csv += `${d.date},${d.bookings},${d.revenue.toFixed(2)},${d.paid.toFixed(2)}\n`;
          });
          if (cancellationReport) {
            csv += '\nCancellations\n';
            csv += 'Summary: Total=' + cancellationReport.summary.count + ', Lost Revenue=$' + cancellationReport.summary.totalLost.toFixed(2) + ', Refunded=$' + cancellationReport.summary.totalRefunded.toFixed(2) + '\n';
            csv += 'Cancel Date,Site,Guest Name,Arrival,Lost Revenue,Refunded\n';
            cancellationReport.cancellations.forEach(r => {
              csv += `${new Date(r.cancelDate).toISOString().split('T')[0]},${r.siteName},"${r.guestName}",${r.arrivalDate},${r.lostRevenue.toFixed(2)},${r.refunded.toFixed(2)}\n`;
            });
          }
          if (noShowReport) {
            csv += '\nNo-Shows\n';
            csv += 'Summary: Total=' + noShowReport.summary.count + ', Lost Revenue=$' + noShowReport.summary.totalLost.toFixed(2) + ', Paid=$' + noShowReport.summary.totalPaid.toFixed(2) + '\n';
            csv += 'Days Late,Site,Guest Name,Expected Arrival,Departure,Amount Paid\n';
            noShowReport.noShows.forEach(r => {
              csv += `${r.daysLate},${r.siteName},"${r.guestName}",${r.arrivalDate},${r.departureDate},${r.paid.toFixed(2)}\n`;
            });
          }
        }
        break;

      case 'overview':
        if (summaryQuery.data && seasonalStats) {
          csv = 'Metric,Value\n';
          csv += `Revenue (30d),${summaryQuery.data.revenue.toFixed(2)}\n`;
          csv += `ADR,${summaryQuery.data.adr.toFixed(2)}\n`;
          csv += `RevPAR,${summaryQuery.data.revpar.toFixed(2)}\n`;
          csv += `Occupancy,${summaryQuery.data.occupancy}%\n`;
          csv += `Future Reservations,${summaryQuery.data.futureReservations}\n`;
          csv += `Sites,${summaryQuery.data.sites}\n\n`;
          csv += 'Season,Revenue,Bookings,Avg Nights\n';
          seasonalStats.forEach(s => {
            csv += `${s.season},${s.revenue.toFixed(2)},${s.bookings},${s.avgNights}\n`;
          });
        }
        break;

      case 'revenue':
        if (reservationsQuery.data) {
          csv = 'ID,Site,Guest,Arrival,Departure,Status,Total,Paid,Balance,Nights\n';
          reservationsQuery.data.forEach(r => {
            const arrival = new Date(r.arrivalDate);
            const departure = new Date(r.departureDate);
            const nights = Math.max(1, Math.floor((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24)));
            const guest = `"${(r as any).guest?.primaryFirstName || ''} ${(r as any).guest?.primaryLastName || ''}".trim()`;
            csv += `${r.id},${r.siteId},${guest},${r.arrivalDate},${r.departureDate},${r.status},${(r.totalAmount / 100).toFixed(2)},${((r.paidAmount || 0) / 100).toFixed(2)},${((r.balanceAmount || 0) / 100).toFixed(2)},${nights}\n`;
          });
        }
        break;

      case 'performance':
        if (sitePerformance && occupancyBySiteClass) {
          csv = 'Site Performance\n';
          csv += 'Site,Revenue,Bookings\n';
          sitePerformance.forEach(s => {
            csv += `${s.name},${s.revenue.toFixed(2)},${s.bookings}\n`;
          });
          csv += '\nOccupancy by Site Class\n';
          csv += 'Class,Occupancy %,Sites\n';
          occupancyBySiteClass.forEach(c => {
            csv += `${c.className},${c.occupancy},${c.sites}\n`;
          });
        }
        // Extended Stay Analysis
        if (extendedStayReport) {
          csv += '\n\nExtended Stay Analysis\n';
          csv += 'Type,Bookings,Unique Guests,Revenue,Avg Stay (Nights)\n';
          extendedStayReport.summary.forEach(cat => {
            csv += `"${cat.type}",${cat.count},${cat.uniqueGuests},${cat.revenue.toFixed(2)},${cat.avgStay.toFixed(1)}\n`;
          });
          if (extendedStayReport.extendedStays.length > 0) {
            csv += '\nTop Extended Stays\n';
            csv += 'Type,Guest,Site,Arrival,Departure,Nights,Revenue\n';
            extendedStayReport.extendedStays.forEach(stay => {
              csv += `"${stay.type}","${stay.guest}",${stay.site},${stay.arrival},${stay.departure},${stay.nights},${stay.revenue.toFixed(2)}\n`;
            });
          }
        }
        // Advance vs Walk-in Booking Analysis
        if (advanceBookingReport) {
          csv += '\n\nAdvance vs Walk-in Booking Analysis\n';
          csv += 'Type,Bookings,Percentage,Revenue,Avg Revenue per Booking\n';
          advanceBookingReport.categories.forEach(cat => {
            csv += `"${cat.type}",${cat.count},${cat.percentage.toFixed(1)}%,${cat.revenue.toFixed(2)},${cat.avgRevenue.toFixed(2)}\n`;
          });
        }
        break;

      case 'guests':
        if (topGuestsStats && guestStats) {
          csv = 'Guest Analytics\n';
          csv += `Total Guests,${guestStats.total}\n`;
          csv += `Repeat Guests,${guestStats.repeat}\n`;
          csv += `Repeat Rate,${guestStats.repeatRate}%\n\n`;
          csv += 'Top Guests by Revenue\n';
          csv += 'Rank,Name,Revenue,Bookings,Avg per Booking\n';
          topGuestsStats.forEach((g, idx) => {
            csv += `${idx + 1},"${g.name}",${g.revenue.toFixed(2)},${g.bookings},${(g.revenue / g.bookings).toFixed(2)}\n`;
          });
        }
        // Group Booking Analysis
        if (groupBookingReport) {
          csv += '\n\nGroup Booking Analysis (5+ Guests)\n';
          csv += `Total Groups,${groupBookingReport.totalGroups}\n`;
          csv += `Total Revenue,${groupBookingReport.totalRevenue.toFixed(2)}\n`;
          csv += `Avg Party Size,${groupBookingReport.avgPartySize.toFixed(1)}\n`;
          csv += `Avg Revenue Per Person,${groupBookingReport.avgRevenuePerPerson.toFixed(2)}\n\n`;
          if (groupBookingReport.largestGroups.length > 0) {
            csv += 'Largest Groups\n';
            csv += 'Guest Name,Site,Arrival,Departure,Party Size,Revenue,$/Person\n';
            groupBookingReport.largestGroups.forEach(group => {
              csv += `"${group.guest}",${group.site},${group.arrival},${group.departure},${group.partySize},${group.revenue.toFixed(2)},${group.revenuePerPerson.toFixed(2)}\n`;
            });
          }
        }
        break;

      case 'marketing':
        if (marketingStats && bookingPaceStats) {
          csv = 'Marketing Performance\n';
          csv += `Total Bookings,${marketingStats.total}\n`;
          csv += `Confirmed,${marketingStats.confirmed}\n`;
          csv += `Pending,${marketingStats.pending}\n`;
          csv += `Cancelled,${marketingStats.cancelled}\n`;
          csv += `Conversion Rate,${marketingStats.conversionRate}%\n`;
          csv += `Avg Booking Value,${marketingStats.avgBookingValue.toFixed(2)}\n\n`;
          csv += 'Booking Pace\n';
          csv += `Next 30 Days,${bookingPaceStats.next30Days}\n`;
          csv += `31-60 Days,${bookingPaceStats.next60Days}\n`;
          csv += `61-90 Days,${bookingPaceStats.next90Days}\n`;
        }
        break;

      case 'forecasting':
        if (revenueForecast) {
          csv = 'Revenue Forecast\n';
          csv += 'Month,Revenue,Bookings\n';
          revenueForecast.forEach(f => {
            csv += `${f.month},${f.revenue.toFixed(2)},${f.bookings}\n`;
          });
        }
        // Pricing Strategy Recommendations
        if (pricingStrategyReport && pricingStrategyReport.length > 0) {
          csv += '\n\nAI-Driven Pricing Strategy Recommendations\n';
          csv += 'Priority,Type,Site,Reason,Current Rate,Suggested Rate,Potential Increase\n';
          pricingStrategyReport.forEach(rec => {
            csv += `${rec.priority},"${rec.type}",${rec.site},"${rec.reason}",${rec.currentRate.toFixed(0)},${rec.suggestedRate.toFixed(0)},${rec.potentialIncrease.toFixed(0)}\n`;
          });
        }
        // Weekend Premium Analysis
        if (weekendPremiumReport) {
          csv += '\n\nWeekend Premium Analysis\n';
          csv += 'Type,Bookings,Revenue,Avg Rate\n';
          csv += `Weekday,${weekendPremiumReport.weekday.bookings},${weekendPremiumReport.weekday.revenue.toFixed(2)},${weekendPremiumReport.weekday.avgRate.toFixed(2)}\n`;
          csv += `Weekend,${weekendPremiumReport.weekend.bookings},${weekendPremiumReport.weekend.revenue.toFixed(2)},${weekendPremiumReport.weekend.avgRate.toFixed(2)}\n`;
          csv += `\nWeekend Premium Percentage,${weekendPremiumReport.premium.toFixed(1)}%\n`;
          if (weekendPremiumReport.recommendation) {
            csv += '\nRecommendation\n';
            csv += `"${weekendPremiumReport.recommendation}"\n`;
          }
        }
        break;

      case 'accounting':
        if (paymentStats && agingQuery.data) {
          csv = 'Accounting Summary\n';
          csv += `Total Revenue,${paymentStats.totalRevenue.toFixed(2)}\n`;
          csv += `Collected,${paymentStats.totalPaid.toFixed(2)}\n`;
          csv += `Outstanding,${paymentStats.totalBalance.toFixed(2)}\n`;
          csv += `Collection Rate,${paymentStats.paidPercentage}%\n\n`;
          csv += 'Aging Report\n';
          csv += 'Bucket,Amount\n';
          Object.entries(agingQuery.data).forEach(([bucket, cents]) => {
            csv += `${bucket.replace('_', '-')},${(cents / 100).toFixed(2)}\n`;
          });
        }
        break;

      case 'audits':
        if (dataQualityStats) {
          csv = 'Data Quality Audit\n';
          csv += `Total Sites,${dataQualityStats.totalSites}\n`;
          csv += `Total Reservations,${dataQualityStats.totalReservations}\n`;
          csv += `Inactive Sites,${dataQualityStats.inactiveSites}\n`;
          csv += `Incomplete Reservations,${dataQualityStats.incompleteReservations}\n`;
          csv += `Future Unpaid,${dataQualityStats.futureUnpaid}\n`;
          csv += `Negative Balance,${dataQualityStats.negativeBalance}\n`;
        }
        break;
    }

    if (csv) {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // For non-overview/audits tabs, render a single active sub-report view.
  if (campgroundId && activeTab !== 'overview' && activeTab !== 'audits') {
    return (
      <DashboardShell>
        <div className="space-y-5">
          <Breadcrumbs items={[{ label: "Reports" }]} />

          <div className="rounded-xl border border-slate-200 bg-white/90 shadow-sm p-5 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
                <HelpAnchor topicId="reports-overview" label="Reports help" />
              </div>
              <p className="text-slate-600 text-sm">Financials, occupancy, marketing, audits—live and exportable.</p>
              <div className="mt-2 text-xs bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-blue-800 space-y-1">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <div>
                    <strong>Reports are read-only views</strong> of your live data. To edit reservations or billing,
                    use <a href="/reservations" className="underline font-medium">Reservations</a> or <a href="/billing" className="underline font-medium">Billing</a>.
                  </div>
                </div>
                <div className="pl-6 text-blue-700">
                  <strong>Tip:</strong> Click <em>Save report</em> to bookmark your current view for quick access later.
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <label className="text-xs font-medium text-slate-600">From</label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="rounded-md border border-slate-200 px-2 py-1 text-sm"
                />
                <label className="text-xs font-medium text-slate-600">To</label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="rounded-md border border-slate-200 px-2 py-1 text-sm"
                />
              </div>
              <Link href="/reports/saved">
                <Button variant="outline" size="sm">Saved reports</Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const saved = saveReport({
                    name: `${activeTab} ${activeSubTab || ""}`.trim() || "Report",
                    description: `Saved from ${activeTab}${activeSubTab ? ` / ${activeSubTab}` : ""}`,
                    tab: activeTab,
                    subTab: activeSubTab,
                    dateRange,
                    campgroundId
                  });
                  toast({ title: "Report saved", description: saved.name });
                }}
              >
                Save report
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => prepareExportPreview(activeTab)}
                className="flex items-center gap-2"
              >
                <FileDown className="h-4 w-4" />
                Export {getReportDisplayName(activeTab)}
              </Button>
            </div>
          </div>

          {/* Report Catalog - Collapsible Browse All */}
          <div className="border border-slate-200 rounded-xl bg-gradient-to-r from-slate-50 to-white">
            <button
              onClick={() => setShowCatalog(!showCatalog)}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50/50 transition-colors rounded-xl"
            >
              <div className="flex items-center gap-3">
                <LayoutList className="h-5 w-5 text-indigo-600" />
                <div>
                  <span className="font-medium text-slate-900">Browse All Reports</span>
                  <span className="text-slate-500 text-sm ml-2">({reportCatalog.reduce((acc, cat) => acc + cat.subReports.length, 0)} available)</span>
                </div>
              </div>
              {showCatalog ? (
                <ChevronUp className="h-5 w-5 text-slate-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-slate-400" />
              )}
            </button>

            {showCatalog && (
              <div className="px-4 pb-4 pt-2 border-t border-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {reportCatalog.map((category) => {
                    const IconComponent = category.icon;
                    const isActive = activeTab === category.id;
                    return (
                      <div
                        key={category.id}
                        className={`rounded-lg border p-3 transition-all cursor-pointer hover:shadow-sm ${isActive
                          ? 'border-indigo-200 bg-indigo-50 ring-1 ring-indigo-100'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        onClick={() => {
                          setActiveTab(category.id as ReportTab);
                          if (category.id !== 'overview' && category.id !== 'audits') {
                            const subs = subTabs[category.id as keyof typeof subTabs] || [];
                            setActiveSubTab(subs[0]?.id ?? null);
                          } else {
                            setActiveSubTab(null);
                          }
                          setShowCatalog(false);
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${isActive ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                            <IconComponent className={`h-4 w-4 ${isActive ? 'text-indigo-600' : 'text-slate-600'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-900 text-sm">{category.label}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{category.description}</div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {category.subReports.slice(0, 3).map((sub, idx) => (
                                <span
                                  key={idx}
                                  className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600"
                                >
                                  {sub.label}
                                </span>
                              ))}
                              {category.subReports.length > 3 && (
                                <span className="text-xs text-slate-400">+{category.subReports.length - 3}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Tab Navigation */}
          <div className="flex flex-wrap gap-2 -mx-1">
            {[
              { id: 'overview' as ReportTab, label: 'Overview' },
              { id: 'daily' as ReportTab, label: 'Daily' },
              { id: 'revenue' as ReportTab, label: 'Revenue' },
              { id: 'performance' as ReportTab, label: 'Performance' },
              { id: 'guests' as ReportTab, label: 'Guests' },
              { id: 'marketing' as ReportTab, label: 'Marketing' },
              { id: 'forecasting' as ReportTab, label: 'Forecasting' },
              { id: 'accounting' as ReportTab, label: 'Accounting' },
              { id: 'audits' as ReportTab, label: 'Audits' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id !== 'overview' && tab.id !== 'audits') {
                    const subs = subTabs[tab.id as keyof typeof subTabs] || [];
                    setActiveSubTab(subs[0]?.id ?? null);
                  } else {
                    setActiveSubTab(null);
                  }
                }}
                className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab.id
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sub-tabs */}
          {(activeTab as string) !== 'overview' && (activeTab as string) !== 'audits' && subTabs[activeTab as keyof typeof subTabs] && (
            <div className="flex flex-wrap gap-2 -mx-1">
              {subTabs[activeTab as keyof typeof subTabs].map((sub: SubTab, idx: number) => (
                <button
                  key={sub.id}
                  onClick={() => setActiveSubTab(sub.id)}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap ${activeSubTab === sub.id || (!activeSubTab && idx === 0)
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}

          {(summaryQuery.isLoading || agingQuery.isLoading || ledgerSummaryQuery.isLoading) && (
            <div className="text-sm text-slate-500">Loading metrics…</div>
          )}
          {(summaryQuery.error || agingQuery.error || ledgerSummaryQuery.error) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Some report data failed to load. Try again or refresh.
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
            {renderSubReportContent()}
          </div>
        </div>

        {/* Export Confirmation Dialog */}
        <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                Export Report
              </DialogTitle>
              <DialogDescription>
                Review what you're about to export
              </DialogDescription>
            </DialogHeader>

            {exportPreview && (
              <div className="space-y-4 py-4">
                {/* Report Details */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Report</span>
                    <span className="font-medium text-slate-900">{exportPreview.reportName}</span>
                  </div>
                  {exportPreview.subReportName && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">View</span>
                      <span className="font-medium text-slate-900">{exportPreview.subReportName}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" /> Date Range
                    </span>
                    <span className="font-medium text-slate-900">
                      {new Date(exportPreview.dateRange.start).toLocaleDateString()} — {new Date(exportPreview.dateRange.end).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Rows</span>
                    <span className="font-medium text-slate-900">~{exportPreview.rowCount.toLocaleString()}</span>
                  </div>
                </div>

                {/* Info Note */}
                <div className="flex items-start gap-2 text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <span>
                    Reports are read-only views of your live data. To edit reservation or billing data,
                    use the <a href="/reservations" className="text-blue-600 underline">Reservations</a> or <a href="/billing" className="text-blue-600 underline">Billing</a> pages.
                  </span>
                </div>
              </div>
            )}

            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setShowExportDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (exportPreview) {
                    exportTabToCSV(exportPreview.tabName);
                    setShowExportDialog(false);
                    toast({
                      title: "Export started",
                      description: `Downloading ${exportPreview.reportName} report...`
                    });
                  }
                }}
                className="flex items-center gap-2"
              >
                <FileDown className="h-4 w-4" />
                Download CSV
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-5">
        <Breadcrumbs items={[{ label: "Reports" }]} />

        <div className="rounded-xl border border-slate-200 bg-white/90 shadow-sm p-5 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
                <HelpAnchor topicId="reports-overview" label="Reports help" />
              </div>
              <p className="text-slate-600 text-sm">Financials, occupancy, marketing, audits—live and exportable.</p>
            </div>
            {campgroundId ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <label className="text-xs font-medium text-slate-600">From</label>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="rounded-md border border-slate-200 px-2 py-1 text-sm"
                  />
                  <label className="text-xs font-medium text-slate-600">To</label>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="rounded-md border border-slate-200 px-2 py-1 text-sm"
                  />
                </div>
                <Link href="/reports/saved">
                  <Button variant="outline" size="sm">Saved reports</Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!campgroundId) return;
                    const saved = saveReport({
                      name: `${activeTab} ${activeSubTab || ""}`.trim() || "Report",
                      description: `Saved from ${activeTab}${activeSubTab ? ` / ${activeSubTab}` : ""}`,
                      tab: activeTab,
                      subTab: activeSubTab,
                      dateRange,
                      campgroundId
                    });
                    toast({ title: "Report saved", description: saved.name });
                  }}
                >
                  Save report
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => prepareExportPreview(activeTab)}
                  className="flex items-center gap-2"
                >
                  <FileDown className="h-4 w-4" />
                  Export {getReportDisplayName(activeTab)}
                </Button>
              </div>
            ) : (
              <span className="text-sm text-amber-700">Select a campground to view reports.</span>
            )}
          </div>

          {!campgroundId && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Choose a campground from the sidebar to load reports.
            </div>
          )}

          {/* Report Catalog - Collapsible Browse All */}
          {campgroundId && (
            <div className="border border-slate-200 rounded-xl bg-gradient-to-r from-slate-50 to-white">
              <button
                onClick={() => setShowCatalog(!showCatalog)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50/50 transition-colors rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <LayoutList className="h-5 w-5 text-indigo-600" />
                  <div>
                    <span className="font-medium text-slate-900">Browse All Reports</span>
                    <span className="text-slate-500 text-sm ml-2">({reportCatalog.reduce((acc, cat) => acc + cat.subReports.length, 0)} available)</span>
                  </div>
                </div>
                {showCatalog ? (
                  <ChevronUp className="h-5 w-5 text-slate-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-slate-400" />
                )}
              </button>

              {showCatalog && (
                <div className="px-4 pb-4 pt-2 border-t border-slate-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {reportCatalog.map((category) => {
                      const IconComponent = category.icon;
                      const isActive = activeTab === category.id;
                      return (
                        <div
                          key={category.id}
                          className={`rounded-lg border p-3 transition-all cursor-pointer hover:shadow-sm ${isActive
                            ? 'border-indigo-200 bg-indigo-50 ring-1 ring-indigo-100'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          onClick={() => {
                            setActiveTab(category.id as ReportTab);
                            if (category.id !== 'overview' && category.id !== 'audits') {
                              const subs = subTabs[category.id as keyof typeof subTabs] || [];
                              setActiveSubTab(subs[0]?.id ?? null);
                            } else {
                              setActiveSubTab(null);
                            }
                            setShowCatalog(false);
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${isActive ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                              <IconComponent className={`h-4 w-4 ${isActive ? 'text-indigo-600' : 'text-slate-600'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-slate-900 text-sm">{category.label}</div>
                              <div className="text-xs text-slate-500 mt-0.5">{category.description}</div>
                              <div className="mt-2 flex flex-wrap gap-1">
                                {category.subReports.slice(0, 3).map((sub, idx) => (
                                  <span
                                    key={idx}
                                    className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600"
                                  >
                                    {sub.label}
                                  </span>
                                ))}
                                {category.subReports.length > 3 && (
                                  <span className="text-xs text-slate-400">+{category.subReports.length - 3}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab Navigation */}
          {campgroundId && (
            <div className="flex flex-wrap gap-2 -mx-1">
              {[
                { id: 'overview' as ReportTab, label: 'Overview' },
                { id: 'daily' as ReportTab, label: 'Daily' },
                { id: 'revenue' as ReportTab, label: 'Revenue' },
                { id: 'performance' as ReportTab, label: 'Performance' },
                { id: 'guests' as ReportTab, label: 'Guests' },
                { id: 'marketing' as ReportTab, label: 'Marketing' },
                { id: 'forecasting' as ReportTab, label: 'Forecasting' },
                { id: 'accounting' as ReportTab, label: 'Accounting' },
                { id: 'audits' as ReportTab, label: 'Audits' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    // reset sub-tab when switching
                    if (tab.id !== 'overview' && tab.id !== 'audits') {
                      const subs = subTabs[tab.id as keyof typeof subTabs] || [];
                      setActiveSubTab(subs[0]?.id ?? null);
                    } else {
                      setActiveSubTab(null);
                    }
                  }}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab.id
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {campgroundId && (
            <>
              {/* Sub-tabs per section (except overview/audits) */}
              {activeTab !== 'overview' && activeTab !== 'audits' && subTabs[activeTab as keyof typeof subTabs] && (
                <div className="flex flex-wrap gap-2 -mx-1">
                  {subTabs[activeTab as keyof typeof subTabs].map((sub: SubTab, idx: number) => (
                    <button
                      key={sub.id}
                      onClick={() => setActiveSubTab(sub.id)}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap ${activeSubTab === sub.id || (!activeSubTab && idx === 0)
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}

              {(summaryQuery.isLoading || agingQuery.isLoading || ledgerSummaryQuery.isLoading) && (
                <div className="text-sm text-slate-500">Loading metrics…</div>
              )}
              {(summaryQuery.error || agingQuery.error || ledgerSummaryQuery.error) && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Some report data failed to load. Try again or refresh.
                </div>
              )}

              <>
                {/* OVERVIEW TAB */}
                {activeTab === 'overview' && summaryQuery.data && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {cards.map((card) => (
                      <div
                        key={card.label}
                        className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 space-y-2"
                      >
                        <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
                          {card.label}
                        </div>
                        <div className="text-xl font-semibold text-slate-900">{card.value}</div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'overview' && npsMetricsQuery.data && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <div className="text-[11px] uppercase tracking-wide text-emerald-700 font-semibold">NPS</div>
                      <div className="text-3xl font-bold text-emerald-900 mt-1">{npsMetricsQuery.data.nps ?? "—"}</div>
                      <div className="text-xs text-emerald-700">Promoters {npsMetricsQuery.data.promoters} · Detractors {npsMetricsQuery.data.detractors}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Responses</div>
                      <div className="text-3xl font-bold text-slate-900 mt-1">{npsMetricsQuery.data.totalResponses}</div>
                      <div className="text-xs text-slate-500">Response rate {npsMetricsQuery.data.responseRate ?? "—"}%</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">Passives</div>
                      <div className="text-3xl font-bold text-slate-900 mt-1">{npsMetricsQuery.data.passives}</div>
                      <div className="text-xs text-slate-500">Balanced feedback</div>
                    </div>
                  </div>
                )}

                {activeTab === 'overview' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">Aging</div>
                          <div className="text-xs text-slate-500">Outstanding balances by bucket</div>
                        </div>
                        {agingQuery.isFetching && <div className="text-xs text-slate-500">Updating…</div>}
                      </div>
                      {agingQuery.data ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {Object.entries(agingQuery.data).map(([bucket, cents]) => (
                            <div key={bucket} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm shadow-inner">
                              <div className="text-[11px] uppercase text-slate-500 font-semibold">{bucket.replace("_", "-")}</div>
                              <div className="font-semibold text-slate-900">{formatCurrency(cents / 100)}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500">No aging data.</div>
                      )}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">Ledger summary</div>
                          <div className="text-xs text-slate-500">Net by GL code</div>
                        </div>
                        {ledgerSummaryQuery.isFetching && <div className="text-xs text-slate-500">Updating…</div>}
                      </div>
                      {ledgerSummaryQuery.data && ledgerSummaryQuery.data.length > 0 ? (
                        <div className="space-y-2">
                          {ledgerSummaryQuery.data.map((row) => (
                            <div key={row.glCode} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                              <span className="text-slate-700">{row.glCode}</span>
                              <span className="font-semibold text-slate-900">{formatCurrency(row.netCents / 100)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500">No ledger summary yet.</div>
                      )}
                    </div>
                  </div>
                )}

                {/* OVERVIEW TAB - Year-over-Year Comparison */}
                {activeTab === 'overview' && yearOverYearStats && (
                  <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Year-over-Year Comparison</div>
                      <div className="text-xs text-slate-500">{new Date().getFullYear()} vs {new Date().getFullYear() - 1}</div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-slate-700 uppercase">This Year</div>
                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 shadow-inner">
                          <div className="text-xs text-blue-700 mb-1">Bookings</div>
                          <div className="text-2xl font-bold text-blue-900">{yearOverYearStats.thisYear.bookings}</div>
                        </div>
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 shadow-inner">
                          <div className="text-xs text-emerald-700 mb-1">Revenue</div>
                          <div className="text-2xl font-bold text-emerald-900">{formatCurrency(yearOverYearStats.thisYear.revenue, 0)}</div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-slate-700 uppercase">Last Year</div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-inner">
                          <div className="text-xs text-slate-600 mb-1">Bookings</div>
                          <div className="text-2xl font-bold text-slate-900">{yearOverYearStats.lastYear.bookings}</div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-inner">
                          <div className="text-xs text-slate-600 mb-1">Revenue</div>
                          <div className="text-2xl font-bold text-slate-900">{formatCurrency(yearOverYearStats.lastYear.revenue, 0)}</div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-slate-700 uppercase">Growth</div>
                        <div className={`rounded-lg border p-3 ${yearOverYearStats.change.bookings >= 0 ? 'bg-green-50 border-green-200' : 'bg-rose-50 border-rose-200'}`}>
                          <div className="text-xs mb-1 ${yearOverYearStats.change.bookings >= 0 ? 'text-green-700' : 'text-rose-700'}">Bookings</div>
                          <div className={`text-2xl font-bold ${yearOverYearStats.change.bookings >= 0 ? 'text-green-900' : 'text-rose-900'}`}>
                            {yearOverYearStats.change.bookings >= 0 ? '+' : ''}{yearOverYearStats.change.bookings}
                          </div>
                        </div>
                        <div className={`rounded-lg border p-3 ${parseFloat(yearOverYearStats.change.revenuePercent) >= 0 ? 'bg-green-50 border-green-200' : 'bg-rose-50 border-rose-200'}`}>
                          <div className="text-xs mb-1 ${parseFloat(yearOverYearStats.change.revenuePercent) >= 0 ? 'text-green-700' : 'text-rose-700'}">Revenue</div>
                          <div className={`text-2xl font-bold ${parseFloat(yearOverYearStats.change.revenuePercent) >= 0 ? 'text-green-900' : 'text-rose-900'}`}>
                            {parseFloat(yearOverYearStats.change.revenuePercent) >= 0 ? '+' : ''}{yearOverYearStats.change.revenuePercent}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* OVERVIEW TAB - Seasonal Performance */}
                {activeTab === 'overview' && seasonalStats && (
                  <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Seasonal Performance</div>
                      <div className="text-xs text-slate-500">Revenue and bookings by season</div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {seasonalStats.map(({ season, revenue, bookings, avgNights }) => {
                        const colorMap: Record<string, string> = {
                          'Spring': 'bg-green-50 border-green-200',
                          'Summer': 'bg-orange-50 border-orange-200',
                          'Fall': 'bg-amber-50 border-amber-200',
                          'Winter': 'bg-blue-50 border-blue-200'
                        };
                        const textColorMap: Record<string, string> = {
                          'Spring': 'text-green-900',
                          'Summer': 'text-orange-900',
                          'Fall': 'text-amber-900',
                          'Winter': 'text-blue-900'
                        };
                        return (
                          <div key={season} className={`rounded-xl border shadow-sm ${colorMap[season]} p-3 space-y-2`}>
                            <div className={`text-sm font-bold ${textColorMap[season]}`}>{season}</div>
                            <div className="space-y-1">
                              <div className="text-xs text-slate-600">Revenue</div>
                              <div className="text-lg font-bold text-slate-900">{formatCurrency(revenue, 0)}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <div className="text-slate-500">Bookings</div>
                                <div className="font-semibold text-slate-900">{bookings}</div>
                              </div>
                              <div>
                                <div className="text-slate-500">Avg Nights</div>
                                <div className="font-semibold text-slate-900">{avgNights}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* DAILY TAB */}
                {/* Daily Arrivals */}
                {(activeTab as string) === 'daily' && dailyArrivals && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Today's Arrivals</div>
                      <div className="text-xs text-slate-500">Guests checking in today</div>
                    </div>
                    {dailyArrivals.length === 0 ? (
                      <div className="text-sm text-slate-500">No arrivals today</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b border-slate-200">
                            <tr>
                              <th className="text-left py-2 text-slate-600 font-medium">Site</th>
                              <th className="text-left py-2 text-slate-600 font-medium">Guest Name</th>
                              <th className="text-left py-2 text-slate-600 font-medium">Arrival</th>
                              <th className="text-left py-2 text-slate-600 font-medium">Departure</th>
                              <th className="text-left py-2 text-slate-600 font-medium">Status</th>
                              <th className="text-right py-2 text-slate-600 font-medium">Total</th>
                              <th className="text-center py-2 text-slate-600 font-medium w-16"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {dailyArrivals.map((r, idx) => (
                              <tr key={r.id} className={idx % 2 === 0 ? 'bg-slate-50' : ''}>
                                <td className="py-2">{r.siteName}</td>
                                <td className="py-2">{r.guestName}</td>
                                <td className="py-2">{r.arrivalDate}</td>
                                <td className="py-2">{r.departureDate}</td>
                                <td className="py-2">
                                  <span className={`inline-block px-2 py-0.5 rounded text-xs ${r.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' :
                                    r.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                                      'bg-slate-100 text-slate-800'
                                    }`}>
                                    {r.status}
                                  </span>
                                </td>
                                <td className="py-2 text-right">{formatCurrency((r.totalAmount || 0) / 100)}</td>
                                <td className="py-2 text-center">
                                  <Link href={`/reservations/${r.id}`} className="text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 text-xs">
                                    View <ExternalLink className="h-3 w-3" />
                                  </Link>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Daily Departures */}
                {(activeTab as string) === 'daily' && dailyDepartures && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Today's Departures</div>
                      <div className="text-xs text-slate-500">Guests checking out today</div>
                    </div>
                    {dailyDepartures.length === 0 ? (
                      <div className="text-sm text-slate-500">No departures today</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b border-slate-200">
                            <tr>
                              <th className="text-left py-2 text-slate-600 font-medium">Site</th>
                              <th className="text-left py-2 text-slate-600 font-medium">Guest Name</th>
                              <th className="text-left py-2 text-slate-600 font-medium">Arrival</th>
                              <th className="text-left py-2 text-slate-600 font-medium">Departure</th>
                              <th className="text-left py-2 text-slate-600 font-medium">Status</th>
                              <th className="text-right py-2 text-slate-600 font-medium">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dailyDepartures.map((r, idx) => (
                              <tr key={r.id} className={idx % 2 === 0 ? 'bg-slate-50' : ''}>
                                <td className="py-2">{r.siteName}</td>
                                <td className="py-2">{r.guestName}</td>
                                <td className="py-2">{r.arrivalDate}</td>
                                <td className="py-2">{r.departureDate}</td>
                                <td className="py-2">
                                  <span className={`inline-block px-2 py-0.5 rounded text-xs ${r.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' :
                                    r.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                                      'bg-slate-100 text-slate-800'
                                    }`}>
                                    {r.status}
                                  </span>
                                </td>
                                <td className="py-2 text-right">{formatCurrency((r.totalAmount || 0) / 100)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* In-House Guests */}
                {(activeTab as string) === 'daily' && inHouseGuests && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">In-House Guests</div>
                      <div className="text-xs text-slate-500">Currently occupied sites</div>
                    </div>
                    {inHouseGuests.length === 0 ? (
                      <div className="text-sm text-slate-500">No guests in-house</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b border-slate-200">
                            <tr>
                              <th className="text-left py-2 text-slate-600 font-medium">Site</th>
                              <th className="text-left py-2 text-slate-600 font-medium">Guest Name</th>
                              <th className="text-left py-2 text-slate-600 font-medium">Arrival</th>
                              <th className="text-left py-2 text-slate-600 font-medium">Departure</th>
                              <th className="text-center py-2 text-slate-600 font-medium">Nights Left</th>
                              <th className="text-right py-2 text-slate-600 font-medium">Balance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {inHouseGuests.map((r, idx) => (
                              <tr key={r.id} className={idx % 2 === 0 ? 'bg-slate-50' : ''}>
                                <td className="py-2">{r.siteName}</td>
                                <td className="py-2">{r.guestName}</td>
                                <td className="py-2">{r.arrivalDate}</td>
                                <td className="py-2">{r.departureDate}</td>
                                <td className="py-2 text-center">
                                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${r.nightsRemaining === 1 ? 'bg-amber-100 text-amber-800' :
                                    r.nightsRemaining <= 3 ? 'bg-blue-100 text-blue-800' :
                                      'bg-slate-100 text-slate-800'
                                    }`}>
                                    {r.nightsRemaining}
                                  </span>
                                </td>
                                <td className="py-2 text-right">
                                  <span className={((r.balanceAmount || 0) > 0) ? 'text-amber-700 font-medium' : ''}>
                                    {formatCurrency((r.balanceAmount || 0) / 100)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Upcoming Check-Ins (7 Days) */}
                {(activeTab as string) === 'daily' && upcomingCheckIns && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Upcoming Check-Ins</div>
                      <div className="text-xs text-slate-500">Next 7 days arrival schedule</div>
                    </div>
                    {upcomingCheckIns.length === 0 ? (
                      <div className="text-sm text-slate-500">No upcoming check-ins in the next 7 days</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b border-slate-200">
                            <tr>
                              <th className="text-left py-2 text-slate-600 font-medium">Date</th>
                              <th className="text-left py-2 text-slate-600 font-medium">Site</th>
                              <th className="text-left py-2 text-slate-600 font-medium">Guest Name</th>
                              <th className="text-left py-2 text-slate-600 font-medium">Departure</th>
                              <th className="text-left py-2 text-slate-600 font-medium">Status</th>
                              <th className="text-right py-2 text-slate-600 font-medium">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {upcomingCheckIns.map((r, idx) => (
                              <tr key={r.id} className={idx % 2 === 0 ? 'bg-slate-50' : ''}>
                                <td className="py-2 font-medium">{r.arrivalDate}</td>
                                <td className="py-2">{r.siteName}</td>
                                <td className="py-2">{r.guestName}</td>
                                <td className="py-2">{r.departureDate}</td>
                                <td className="py-2">
                                  <span className={`inline-block px-2 py-0.5 rounded text-xs ${r.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' :
                                    r.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                                      'bg-slate-100 text-slate-800'
                                    }`}>
                                    {r.status}
                                  </span>
                                </td>
                                <td className="py-2 text-right">{formatCurrency((r.totalAmount || 0) / 100)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Upcoming Check-Outs (7 Days) */}
                {(activeTab as string) === 'daily' && upcomingCheckOuts && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Upcoming Check-Outs</div>
                      <div className="text-xs text-slate-500">Next 7 days departure schedule</div>
                    </div>
                    {upcomingCheckOuts.length === 0 ? (
                      <div className="text-sm text-slate-500">No upcoming check-outs in the next 7 days</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b border-slate-200">
                            <tr>
                              <th className="text-left py-2 text-slate-600 font-medium">Date</th>
                              <th className="text-left py-2 text-slate-600 font-medium">Site</th>
                              <th className="text-left py-2 text-slate-600 font-medium">Guest Name</th>
                              <th className="text-left py-2 text-slate-600 font-medium">Arrival</th>
                              <th className="text-left py-2 text-slate-600 font-medium">Status</th>
                              <th className="text-right py-2 text-slate-600 font-medium">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {upcomingCheckOuts.map((r, idx) => (
                              <tr key={r.id} className={idx % 2 === 0 ? 'bg-slate-50' : ''}>
                                <td className="py-2 font-medium">{r.departureDate}</td>
                                <td className="py-2">{r.siteName}</td>
                                <td className="py-2">{r.guestName}</td>
                                <td className="py-2">{r.arrivalDate}</td>
                                <td className="py-2">
                                  <span className={`inline-block px-2 py-0.5 rounded text-xs ${r.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' :
                                    r.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                                      'bg-slate-100 text-slate-800'
                                    }`}>
                                    {r.status}
                                  </span>
                                </td>
                                <td className="py-2 text-right">{formatCurrency((r.totalAmount || 0) / 100)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Weekly Revenue Summary */}
                {(activeTab as string) === 'daily' && weeklyRevenue && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Current Week Summary</div>
                      <div className="text-xs text-slate-500">Sunday - Saturday revenue snapshot</div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs text-slate-600 mb-1">Bookings</div>
                        <div className="text-2xl font-bold text-slate-900">{weeklyRevenue.bookings}</div>
                      </div>
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                        <div className="text-xs text-emerald-700 mb-1">Revenue</div>
                        <div className="text-2xl font-bold text-emerald-900">{formatCurrency(weeklyRevenue.revenue, 0)}</div>
                      </div>
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                        <div className="text-xs text-blue-700 mb-1">Paid</div>
                        <div className="text-2xl font-bold text-blue-900">{formatCurrency(weeklyRevenue.paid, 0)}</div>
                      </div>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <div className="text-xs text-amber-700 mb-1">Outstanding</div>
                        <div className="text-2xl font-bold text-amber-900">{formatCurrency(weeklyRevenue.outstanding, 0)}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Quarterly Revenue */}
                {(activeTab as string) === 'daily' && quarterlyRevenue && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Quarterly Performance</div>
                      <div className="text-xs text-slate-500">Year-to-date quarterly breakdown</div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {quarterlyRevenue.map(q => (
                        <div
                          key={q.quarter}
                          className={`rounded-lg border p-3 ${q.isCurrent
                            ? 'border-emerald-200 bg-emerald-50'
                            : 'border-slate-200 bg-slate-50'
                            }`}
                        >
                          <div className={`text-xs mb-1 ${q.isCurrent ? 'text-emerald-700' : 'text-slate-600'}`}>
                            {q.quarter} {q.isCurrent && '(Current)'}
                          </div>
                          <div className={`text-xl font-bold ${q.isCurrent ? 'text-emerald-900' : 'text-slate-900'}`}>
                            {formatCurrency(q.revenue, 0)}
                          </div>
                          <div className={`text-xs mt-1 ${q.isCurrent ? 'text-emerald-700' : 'text-slate-600'}`}>
                            {q.bookings} bookings
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Payment Due Report */}
                {(activeTab as string) === 'daily' && paymentDueReport && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Outstanding Payments</div>
                      <div className="text-xs text-slate-500">Reservations with balance due, sorted by amount</div>
                    </div>
                    {paymentDueReport.length === 0 ? (
                      <div className="text-sm text-slate-500">No outstanding payments</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b border-slate-200">
                            <tr>
                              <th className="text-left py-2 text-slate-600 font-medium">Site</th>
                              <th className="text-left py-2 text-slate-600 font-medium">Guest Name</th>
                              <th className="text-left py-2 text-slate-600 font-medium">Arrival</th>
                              <th className="text-left py-2 text-slate-600 font-medium">Departure</th>
                              <th className="text-right py-2 text-slate-600 font-medium">Balance Due</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paymentDueReport.map((r, idx) => (
                              <tr key={r.id} className={idx % 2 === 0 ? 'bg-amber-50' : 'bg-white'}>
                                <td className="py-2">{r.siteName}</td>
                                <td className="py-2">{r.guestName}</td>
                                <td className="py-2">{r.arrivalDate}</td>
                                <td className="py-2">{r.departureDate}</td>
                                <td className="py-2 text-right">
                                  <span className="text-amber-700 font-semibold">{formatCurrency(r.balance)}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Site Status Report */}
                {(activeTab as string) === 'daily' && siteStatusReport && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Site Status Overview</div>
                      <div className="text-xs text-slate-500">Real-time availability status for all sites</div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-slate-200">
                          <tr>
                            <th className="text-left py-2 text-slate-600 font-medium">Site</th>
                            <th className="text-left py-2 text-slate-600 font-medium">Class</th>
                            <th className="text-center py-2 text-slate-600 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {siteStatusReport.map((site, idx) => (
                            <tr key={site.id} className={idx % 2 === 0 ? 'bg-slate-50' : ''}>
                              <td className="py-2 font-medium">{site.name}</td>
                              <td className="py-2">{site.className}</td>
                              <td className="py-2 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${site.status === 'Available' ? 'bg-emerald-100 text-emerald-800' :
                                  site.status === 'Occupied' ? 'bg-blue-100 text-blue-800' :
                                    'bg-slate-300 text-slate-700'
                                  }`}>
                                  {site.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Transaction Log */}
                {(activeTab as string) === 'daily' && transactionLog && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Transaction Log</div>
                      <div className="text-xs text-slate-500">Complete financial activity log, sorted by date</div>
                    </div>
                    {transactionLog.length === 0 ? (
                      <div className="text-sm text-slate-500">No transactions found</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b border-slate-200">
                            <tr>
                              <th className="text-left py-2 text-slate-600 font-medium">Date</th>
                              <th className="text-left py-2 text-slate-600 font-medium">Site</th>
                              <th className="text-left py-2 text-slate-600 font-medium">Guest</th>
                              <th className="text-left py-2 text-slate-600 font-medium">Arrival</th>
                              <th className="text-left py-2 text-slate-600 font-medium">Departure</th>
                              <th className="text-right py-2 text-slate-600 font-medium">Total</th>
                              <th className="text-right py-2 text-slate-600 font-medium">Paid</th>
                              <th className="text-right py-2 text-slate-600 font-medium">Balance</th>
                              <th className="text-center py-2 text-slate-600 font-medium w-16"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {transactionLog.map((r, idx) => (
                              <tr key={r.id} className={idx % 2 === 0 ? 'bg-slate-50' : ''}>
                                <td className="py-2 font-medium">{r.transactionDate}</td>
                                <td className="py-2">{r.siteName}</td>
                                <td className="py-2">{r.guestName}</td>
                                <td className="py-2 text-xs text-slate-600">{r.arrivalDate}</td>
                                <td className="py-2 text-xs text-slate-600">{r.departureDate}</td>
                                <td className="py-2 text-right">{formatCurrency(r.total)}</td>
                                <td className="py-2 text-right">
                                  <span className="text-emerald-700 font-medium">${r.paid.toFixed(2)}</span>
                                </td>
                                <td className="py-2 text-right">
                                  <span className={r.balance > 0 ? 'text-amber-700 font-medium' : 'text-slate-600'}>
                                    {formatCurrency(r.balance)}
                                  </span>
                                </td>
                                <td className="py-2 text-center">
                                  <Link href={`/reservations/${r.id}`} className="text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 text-xs">
                                    View <ExternalLink className="h-3 w-3" />
                                  </Link>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Monthly Revenue */}
                {(activeTab as string) === 'daily' && monthlyRevenue && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Monthly Revenue Breakdown</div>
                      <div className="text-xs text-slate-500">All 12 months for current year</div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {monthlyRevenue.map(m => (
                        <div
                          key={m.month}
                          className={`rounded-lg border p-3 ${m.isCurrent
                            ? 'border-emerald-200 bg-emerald-50'
                            : 'border-slate-200 bg-slate-50'
                            }`}
                        >
                          <div className={`text-xs mb-1 ${m.isCurrent ? 'text-emerald-700 font-medium' : 'text-slate-600'}`}>
                            {m.month}
                          </div>
                          <div className={`text-lg font-bold ${m.isCurrent ? 'text-emerald-900' : 'text-slate-900'}`}>
                            {formatCurrency(m.revenue, 0)}
                          </div>
                          <div className={`text-xs mt-1 ${m.isCurrent ? 'text-emerald-700' : 'text-slate-600'}`}>
                            {m.bookings} bookings
                          </div>
                          <div className={`text-xs ${m.isCurrent ? 'text-emerald-600' : 'text-slate-500'}`}>
                            Paid: {formatCurrency(m.paid, 0)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Annual Revenue */}
                {(activeTab as string) === 'daily' && annualRevenue && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Annual Revenue Comparison</div>
                      <div className="text-xs text-slate-500">Year-over-year performance (last 3 years)</div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {annualRevenue.map(y => (
                        <div
                          key={y.year}
                          className={`rounded-lg border p-4 ${y.isCurrent
                            ? 'border-emerald-300 bg-emerald-50'
                            : 'border-slate-200 bg-slate-50'
                            }`}
                        >
                          <div className={`text-sm mb-2 ${y.isCurrent ? 'text-emerald-700 font-semibold' : 'text-slate-600 font-medium'}`}>
                            {y.year} {y.isCurrent && '(Current)'}
                          </div>
                          <div className={`text-2xl font-bold mb-2 ${y.isCurrent ? 'text-emerald-900' : 'text-slate-900'}`}>
                            {formatCurrency(y.revenue, 0)}
                          </div>
                          <div className="space-y-1">
                            <div className={`text-xs ${y.isCurrent ? 'text-emerald-700' : 'text-slate-600'}`}>
                              {y.bookings} total bookings
                            </div>
                            <div className={`text-xs ${y.isCurrent ? 'text-emerald-700' : 'text-slate-600'}`}>
                              Paid: {formatCurrency(y.paid, 0)}
                            </div>
                            <div className={`text-xs ${y.isCurrent ? 'text-emerald-600' : 'text-slate-500'}`}>
                              Avg: {formatCurrency(y.avgPerBooking)}/booking
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Daily Revenue (Last 30 Days) */}
                {(activeTab as string) === 'daily' && dailyRevenue && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Daily Revenue Trend</div>
                      <div className="text-xs text-slate-500">Last 30 days booking activity</div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-slate-200">
                          <tr>
                            <th className="text-left py-2 text-slate-600 font-medium">Date</th>
                            <th className="text-center py-2 text-slate-600 font-medium">Bookings</th>
                            <th className="text-right py-2 text-slate-600 font-medium">Revenue</th>
                            <th className="text-right py-2 text-slate-600 font-medium">Paid</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dailyRevenue.map((d, idx) => (
                            <tr key={d.date} className={idx % 2 === 0 ? 'bg-slate-50' : ''}>
                              <td className="py-2 font-medium">{d.date}</td>
                              <td className="py-2 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded text-xs ${d.bookings > 0 ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
                                  }`}>
                                  {d.bookings}
                                </span>
                              </td>
                              <td className="py-2 text-right">
                                <span className={d.revenue > 0 ? 'text-slate-900 font-medium' : 'text-slate-400'}>
                                  {formatCurrency(d.revenue)}
                                </span>
                              </td>
                              <td className="py-2 text-right">
                                <span className={d.paid > 0 ? 'text-emerald-700 font-medium' : 'text-slate-400'}>
                                  {formatCurrency(d.paid)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Cancellation Report */}
                {(activeTab as string) === 'daily' && cancellationReport && (
                  <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Cancellations</div>
                      <div className="text-xs text-slate-500">Last 30 days cancelled reservations</div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                        <div className="text-xs text-red-700 mb-1">Total Cancelled</div>
                        <div className="text-2xl font-bold text-red-900">{cancellationReport.summary.count}</div>
                      </div>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <div className="text-xs text-amber-700 mb-1">Lost Revenue</div>
                        <div className="text-2xl font-bold text-amber-900">{formatCurrency(cancellationReport.summary.totalLost, 0)}</div>
                      </div>
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                        <div className="text-xs text-blue-700 mb-1">Refunded</div>
                        <div className="text-2xl font-bold text-blue-900">{formatCurrency(cancellationReport.summary.totalRefunded, 0)}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs text-slate-600 mb-1">Net Loss</div>
                        <div className="text-2xl font-bold text-slate-900">{formatCurrency(cancellationReport.summary.netLoss, 0)}</div>
                      </div>
                    </div>
                    {cancellationReport.cancellations.length === 0 ? (
                      <div className="text-sm text-slate-500">No cancellations in the last 30 days</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b border-slate-200">
                            <tr>
                              <th className="text-left py-2 text-slate-600 font-medium">Cancel Date</th>
                              <th className="text-left py-2 text-slate-600 font-medium">Site</th>
                              <th className="text-left py-2 text-slate-600 font-medium">Guest</th>
                              <th className="text-left py-2 text-slate-600 font-medium">Arrival</th>
                              <th className="text-right py-2 text-slate-600 font-medium">Lost Revenue</th>
                              <th className="text-right py-2 text-slate-600 font-medium">Refunded</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cancellationReport.cancellations.map((r, idx) => (
                              <tr key={r.id} className={idx % 2 === 0 ? 'bg-red-50' : 'bg-white'}>
                                <td className="py-2 font-medium">{new Date(r.cancelDate).toISOString().split('T')[0]}</td>
                                <td className="py-2">{r.siteName}</td>
                                <td className="py-2">{r.guestName}</td>
                                <td className="py-2 text-xs text-slate-600">{r.arrivalDate}</td>
                                <td className="py-2 text-right">
                                  <span className="text-red-700 font-medium">{formatCurrency(r.lostRevenue)}</span>
                                </td>
                                <td className="py-2 text-right">
                                  <span className="text-blue-700">{formatCurrency(r.refunded)}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* No-Show Report */}
                {(activeTab as string) === 'daily' && noShowReport && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">No-Shows</div>
                      <div className="text-xs text-slate-500">Guests who didn't arrive for confirmed reservations</div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                      <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                        <div className="text-xs text-orange-700 mb-1">Total No-Shows</div>
                        <div className="text-2xl font-bold text-orange-900">{noShowReport.summary.count}</div>
                      </div>
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                        <div className="text-xs text-red-700 mb-1">Lost Revenue</div>
                        <div className="text-2xl font-bold text-red-900">{formatCurrency(noShowReport.summary.totalLost, 0)}</div>
                      </div>
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                        <div className="text-xs text-emerald-700 mb-1">Paid (Non-Refundable)</div>
                        <div className="text-2xl font-bold text-emerald-900">{formatCurrency(noShowReport.summary.totalPaid, 0)}</div>
                      </div>
                    </div>
                    {noShowReport.noShows.length === 0 ? (
                      <div className="text-sm text-emerald-600">No no-shows detected - excellent!</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b border-slate-200">
                            <tr>
                              <th className="text-left py-2 text-slate-600 font-medium">Days Late</th>
                              <th className="text-left py-2 text-slate-600 font-medium">Site</th>
                              <th className="text-left py-2 text-slate-600 font-medium">Guest</th>
                              <th className="text-left py-2 text-slate-600 font-medium">Expected Arrival</th>
                              <th className="text-left py-2 text-slate-600 font-medium">Departure</th>
                              <th className="text-right py-2 text-slate-600 font-medium">Amount Paid</th>
                            </tr>
                          </thead>
                          <tbody>
                            {noShowReport.noShows.map((r, idx) => (
                              <tr key={r.id} className={idx % 2 === 0 ? 'bg-orange-50' : 'bg-white'}>
                                <td className="py-2">
                                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${r.daysLate > 7 ? 'bg-red-100 text-red-800' :
                                    r.daysLate > 3 ? 'bg-orange-100 text-orange-800' :
                                      'bg-amber-100 text-amber-800'
                                    }`}>
                                    {r.daysLate} days
                                  </span>
                                </td>
                                <td className="py-2">{r.siteName}</td>
                                <td className="py-2">{r.guestName}</td>
                                <td className="py-2 text-xs text-slate-600">{r.arrivalDate}</td>
                                <td className="py-2 text-xs text-slate-600">{r.departureDate}</td>
                                <td className="py-2 text-right">
                                  <span className="text-emerald-700 font-medium">${r.paid.toFixed(2)}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* REVENUE TAB */}
                {activeTab === 'revenue' && reservationStats && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Reservation Analytics</div>
                      <div className="text-xs text-slate-500">For date range: {dateRange.start} to {dateRange.end}</div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs text-slate-600 mb-1">Total Bookings</div>
                        <div className="text-2xl font-bold text-slate-900">{reservationStats.total}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-emerald-50 p-3">
                        <div className="text-xs text-emerald-700 mb-1">Revenue</div>
                        <div className="text-2xl font-bold text-emerald-900">{formatCurrency(reservationStats.totalRevenue, 0)}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-blue-50 p-3">
                        <div className="text-xs text-blue-700 mb-1">Avg Lead Time</div>
                        <div className="text-2xl font-bold text-blue-900">{reservationStats.avgLeadTime}d</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-purple-50 p-3">
                        <div className="text-xs text-purple-700 mb-1">Avg per Booking</div>
                        <div className="text-2xl font-bold text-purple-900">
                          {reservationStats.total > 0 ? formatCurrency(reservationStats.totalRevenue / reservationStats.total, 0) : '0'}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-700 mb-2">By Status</div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {Object.entries(reservationStats.byStatus).map(([status, count]) => (
                          <div key={status} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                            <div className="text-xs text-slate-500 capitalize">{status.replace('_', ' ')}</div>
                            <div className="font-semibold text-slate-900">{count}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* PERFORMANCE TAB - Site Performance */}
                {activeTab === 'performance' && sitePerformance && sitePerformance.length > 0 && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Top 10 Sites by Revenue</div>
                      <div className="text-xs text-slate-500">All-time performance</div>
                    </div>
                    <div className="space-y-2">
                      {sitePerformance.map((site, idx) => (
                        <div key={site.name} className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-6 text-center text-xs font-semibold text-slate-500">#{idx + 1}</div>
                          <div className="flex-1 flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2">
                            <div>
                              <div className="text-sm font-medium text-slate-900">{site.name}</div>
                              <div className="text-xs text-slate-500">{site.bookings} bookings</div>
                            </div>
                            <div className="text-sm font-bold text-emerald-600">{formatCurrency(site.revenue, 0)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Revenue Trends */}
                {activeTab === 'revenue' && revenueTrends && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Revenue Trends</div>
                      <div className="text-xs text-slate-500">Last 12 months</div>
                    </div>
                    <div className="space-y-1">
                      {revenueTrends.map(({ month, revenue }) => {
                        const maxRevenue = Math.max(...revenueTrends.map(t => t.revenue), 1);
                        const width = (revenue / maxRevenue) * 100;
                        return (
                          <div key={month} className="flex items-center gap-2">
                            <div className="w-20 text-xs text-slate-600 flex-shrink-0">{month}</div>
                            <div className="flex-1 h-8 bg-slate-100 rounded relative overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-500"
                                style={{ width: `${width}%` }}
                              />
                              <div className="absolute inset-0 flex items-center px-2">
                                <span className="text-xs font-semibold text-slate-900">{formatCurrency(revenue, 0)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* REVENUE TAB - Weekend vs Weekday */}
                {activeTab === 'revenue' && weekendVsWeekdayStats && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Weekend vs Weekday Performance</div>
                      <div className="text-xs text-slate-500">Booking patterns by arrival day</div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
                        <div className="text-sm font-bold text-blue-900">Weekend (Fri-Sat Arrivals)</div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-xs text-blue-700 mb-1">Bookings</div>
                            <div className="text-2xl font-bold text-blue-900">{weekendVsWeekdayStats.weekend.bookings}</div>
                          </div>
                          <div>
                            <div className="text-xs text-blue-700 mb-1">Revenue</div>
                            <div className="text-2xl font-bold text-blue-900">{formatCurrency(weekendVsWeekdayStats.weekend.revenue, 0)}</div>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-blue-700 mb-1">Avg per Booking</div>
                          <div className="text-lg font-bold text-blue-900">{formatCurrency(weekendVsWeekdayStats.weekend.avgRevenue, 0)}</div>
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                        <div className="text-sm font-bold text-slate-900">Weekday (Sun-Thu Arrivals)</div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-xs text-slate-600 mb-1">Bookings</div>
                            <div className="text-2xl font-bold text-slate-900">{weekendVsWeekdayStats.weekday.bookings}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-600 mb-1">Revenue</div>
                            <div className="text-2xl font-bold text-slate-900">{formatCurrency(weekendVsWeekdayStats.weekday.revenue, 0)}</div>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-600 mb-1">Avg per Booking</div>
                          <div className="text-lg font-bold text-slate-900">{formatCurrency(weekendVsWeekdayStats.weekday.avgRevenue, 0)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* REVENUE TAB - Pricing Analysis by Site Class */}
                {activeTab === 'revenue' && pricingAnalysis && pricingAnalysis.length > 0 && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Pricing Analysis by Site Class</div>
                      <div className="text-xs text-slate-500">Average daily rate and performance metrics</div>
                    </div>
                    <div className="space-y-2">
                      {pricingAnalysis.map((cls) => (
                        <div key={cls.className} className="rounded-md border border-slate-200 bg-white p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-medium text-slate-900">{cls.className}</div>
                            <div className="text-lg font-bold text-emerald-600">${cls.adr}/night</div>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <div className="text-slate-500">Total Nights</div>
                              <div className="font-semibold text-slate-900">{cls.totalNights}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Total Revenue</div>
                              <div className="font-semibold text-slate-900">{formatCurrency(cls.totalRevenue, 0)}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* REVENUE TAB - ADR Trends */}
                {activeTab === 'revenue' && adrTrends && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">ADR Trends</div>
                      <div className="text-xs text-slate-500">Average daily rate over last 12 months</div>
                    </div>
                    <div className="space-y-1">
                      {adrTrends.map(({ month, adr }) => {
                        const maxADR = Math.max(...adrTrends.map(t => parseFloat(t.adr)), 1);
                        const width = (parseFloat(adr) / maxADR) * 100;
                        return (
                          <div key={month} className="flex items-center gap-2">
                            <div className="w-20 text-xs text-slate-600 flex-shrink-0">{month}</div>
                            <div className="flex-1 h-8 bg-slate-100 rounded relative overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-500"
                                style={{ width: `${width}%` }}
                              />
                              <div className="absolute inset-0 flex items-center px-2">
                                <span className="text-xs font-semibold text-slate-900">${adr}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* PERFORMANCE TAB - Site Class Performance */}
                {activeTab === 'performance' && siteClassStats && siteClassStats.length > 0 && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Site Class Performance</div>
                      <div className="text-xs text-slate-500">Revenue by class</div>
                    </div>
                    <div className="space-y-2">
                      {siteClassStats.map((cls) => (
                        <div key={cls.className} className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2">
                          <div>
                            <div className="text-sm font-medium text-slate-900">{cls.className}</div>
                            <div className="text-xs text-slate-500">{cls.bookings} bookings</div>
                          </div>
                          <div className="text-sm font-bold text-emerald-600">{formatCurrency(cls.revenue, 0)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* PERFORMANCE TAB - Occupancy Trends */}
                {activeTab === 'performance' && occupancyTrends && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Occupancy Trends</div>
                      <div className="text-xs text-slate-500">Last 12 months</div>
                    </div>
                    <div className="space-y-1">
                      {occupancyTrends.map(({ month, occupancy }) => {
                        const maxOccupancy = Math.max(...occupancyTrends.map(t => parseFloat(t.occupancy)), 1);
                        const width = (parseFloat(occupancy) / maxOccupancy) * 100;
                        const occupancyNum = parseFloat(occupancy);
                        const colorClass = occupancyNum >= 80 ? 'from-emerald-500 to-emerald-600' :
                          occupancyNum >= 60 ? 'from-blue-500 to-blue-600' :
                            occupancyNum >= 40 ? 'from-amber-500 to-amber-600' :
                              'from-slate-400 to-slate-500';
                        return (
                          <div key={month} className="flex items-center gap-2">
                            <div className="w-20 text-xs text-slate-600 flex-shrink-0">{month}</div>
                            <div className="flex-1 h-8 bg-slate-100 rounded relative overflow-hidden">
                              <div
                                className={`h-full bg-gradient-to-r ${colorClass} transition-all duration-500`}
                                style={{ width: `${width}%` }}
                              />
                              <div className="absolute inset-0 flex items-center px-2">
                                <span className="text-xs font-semibold text-slate-900">{occupancy}%</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* PERFORMANCE TAB - Revenue Per Site */}
                {activeTab === 'performance' && revenuePerSiteStats && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Revenue Per Site</div>
                      <div className="text-xs text-slate-500">Average performance metrics</div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs text-slate-600 mb-1">Total Sites</div>
                        <div className="text-2xl font-bold text-slate-900">{revenuePerSiteStats.totalSites}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-emerald-50 p-3">
                        <div className="text-xs text-emerald-700 mb-1">All-Time Avg</div>
                        <div className="text-2xl font-bold text-emerald-900">{formatCurrency(revenuePerSiteStats.allTime, 0)}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-blue-50 p-3">
                        <div className="text-xs text-blue-700 mb-1">Last 30d Avg</div>
                        <div className="text-2xl font-bold text-blue-900">{formatCurrency(revenuePerSiteStats.last30Days, 0)}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* PERFORMANCE TAB - Site Utilization */}
                {activeTab === 'performance' && siteUtilizationStats && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Site Utilization Rate</div>
                      <div className="text-xs text-slate-500">Booking frequency by site (All-time)</div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs text-slate-600 mb-1">Total Sites</div>
                        <div className="text-2xl font-bold text-slate-900">{siteUtilizationStats.sites.length}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-blue-50 p-3">
                        <div className="text-xs text-blue-700 mb-1">Avg Bookings</div>
                        <div className="text-2xl font-bold text-blue-900">{siteUtilizationStats.avgBookings}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-amber-50 p-3">
                        <div className="text-xs text-amber-700 mb-1">Underutilized</div>
                        <div className="text-2xl font-bold text-amber-900">{siteUtilizationStats.underutilized}</div>
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-1">
                      {siteUtilizationStats.sites.slice(0, 15).map((site, idx) => {
                        const utilizationPercent = (site.bookings / siteUtilizationStats.avgBookings) * 100;
                        const colorClass = utilizationPercent >= 100 ? 'bg-emerald-500' :
                          utilizationPercent >= 70 ? 'bg-blue-500' :
                            utilizationPercent >= 40 ? 'bg-amber-500' :
                              'bg-rose-500';
                        return (
                          <div key={site.name} className="flex items-center gap-2">
                            <div className="w-32 text-xs text-slate-600 flex-shrink-0 truncate">{site.name}</div>
                            <div className="flex-1 h-6 bg-slate-100 rounded relative overflow-hidden">
                              <div
                                className={`h-full ${colorClass} transition-all duration-500`}
                                style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
                              />
                              <div className="absolute inset-0 flex items-center px-2">
                                <span className="text-xs font-semibold text-slate-900">{site.bookings} bookings</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* PERFORMANCE TAB - Occupancy by Site Class */}
                {activeTab === 'performance' && occupancyBySiteClass && occupancyBySiteClass.length > 0 && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Occupancy by Site Class</div>
                      <div className="text-xs text-slate-500">Annual occupancy rate by class</div>
                    </div>
                    <div className="space-y-2">
                      {occupancyBySiteClass.map((cls) => {
                        const occupancyNum = parseFloat(cls.occupancy);
                        const colorClass = occupancyNum >= 80 ? 'from-emerald-500 to-emerald-600' :
                          occupancyNum >= 60 ? 'from-blue-500 to-blue-600' :
                            occupancyNum >= 40 ? 'from-amber-500 to-amber-600' :
                              'from-slate-400 to-slate-500';
                        return (
                          <div key={cls.className} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium text-slate-900">{cls.className}</span>
                              <span className="text-slate-600">({cls.sites} sites)</span>
                            </div>
                            <div className="h-8 bg-slate-100 rounded relative overflow-hidden">
                              <div
                                className={`h-full bg-gradient-to-r ${colorClass} transition-all duration-500`}
                                style={{ width: `${occupancyNum}%` }}
                              />
                              <div className="absolute inset-0 flex items-center px-2">
                                <span className="text-sm font-semibold text-slate-900">{cls.occupancy}%</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* PERFORMANCE TAB - Site Utilization Report (90 days) */}
                {activeTab === 'performance' && siteUtilizationReport && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Site Utilization (Last 90 Days)</div>
                      <div className="text-xs text-slate-500">Occupancy rates and revenue by site | Avg: {siteUtilizationReport.avgOccupancy.toFixed(1)}%</div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-slate-200">
                          <tr>
                            <th className="text-left py-2 text-slate-600 font-medium">Site</th>
                            <th className="text-left py-2 text-slate-600 font-medium">Class</th>
                            <th className="text-center py-2 text-slate-600 font-medium">Occupancy</th>
                            <th className="text-center py-2 text-slate-600 font-medium">Nights</th>
                            <th className="text-center py-2 text-slate-600 font-medium">Bookings</th>
                            <th className="text-right py-2 text-slate-600 font-medium">Revenue</th>
                            <th className="text-right py-2 text-slate-600 font-medium">$/Night</th>
                          </tr>
                        </thead>
                        <tbody>
                          {siteUtilizationReport.sites.map((site, idx) => (
                            <tr key={site.siteId} className={idx % 2 === 0 ? 'bg-slate-50' : ''}>
                              <td className="py-2 font-medium">{site.siteName}</td>
                              <td className="py-2 text-slate-600">{site.siteClass}</td>
                              <td className="py-2 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${site.occupancyRate >= 80 ? 'bg-emerald-100 text-emerald-800' :
                                  site.occupancyRate >= 60 ? 'bg-blue-100 text-blue-800' :
                                    site.occupancyRate >= 40 ? 'bg-amber-100 text-amber-800' :
                                      'bg-red-100 text-red-800'
                                  }`}>
                                  {site.occupancyRate.toFixed(1)}%
                                </span>
                              </td>
                              <td className="py-2 text-center text-slate-700">{site.nights}</td>
                              <td className="py-2 text-center text-slate-700">{site.bookings}</td>
                              <td className="py-2 text-right font-medium text-slate-900">${site.revenue.toFixed(0)}</td>
                              <td className="py-2 text-right text-slate-600">${site.avgRevenuePerNight.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* PERFORMANCE TAB - Revenue Per Site Report */}
                {activeTab === 'performance' && revenuePerSiteReport && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Revenue Per Site (All-Time)</div>
                      <div className="text-xs text-slate-500">Total: {formatCurrency(revenuePerSiteReport.totalRevenue, 0)}</div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-slate-200">
                          <tr>
                            <th className="text-left py-2 text-slate-600 font-medium">Site</th>
                            <th className="text-left py-2 text-slate-600 font-medium">Class</th>
                            <th className="text-right py-2 text-slate-600 font-medium">Total Revenue</th>
                            <th className="text-center py-2 text-slate-600 font-medium">Bookings</th>
                            <th className="text-center py-2 text-slate-600 font-medium">Nights</th>
                            <th className="text-right py-2 text-slate-600 font-medium">$/Booking</th>
                            <th className="text-right py-2 text-slate-600 font-medium">$/Night</th>
                          </tr>
                        </thead>
                        <tbody>
                          {revenuePerSiteReport.sites.slice(0, 20).map((site, idx) => (
                            <tr key={site.siteId} className={idx % 2 === 0 ? 'bg-slate-50' : ''}>
                              <td className="py-2 font-medium">{site.siteName}</td>
                              <td className="py-2 text-slate-600">{site.siteClass}</td>
                              <td className="py-2 text-right">
                                <span className="font-semibold text-emerald-700">{formatCurrency(site.totalRevenue, 0)}</span>
                              </td>
                              <td className="py-2 text-center text-slate-700">{site.bookings}</td>
                              <td className="py-2 text-center text-slate-700">{site.nights}</td>
                              <td className="py-2 text-right text-slate-600">{formatCurrency(site.avgPerBooking)}</td>
                              <td className="py-2 text-right text-slate-600">{formatCurrency(site.avgPerNight)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeTab === 'performance' && enableAnalyticsMaps && (occupancyHeatPoints.length > 0 || revenueHeatPoints.length > 0) && (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {occupancyHeatPoints.length > 0 && (
                      <HeatmapCard
                        title="Utilization Heatmap (90 days)"
                        subtitle="Occupancy hotspots by site"
                        points={occupancyHeatPoints}
                        center={siteCoords.center}
                        maxValue={100}
                        isLoading={sitesQuery.isLoading || reservationsQuery.isLoading}
                      />
                    )}
                    {revenueHeatPoints.length > 0 && (
                      <HeatmapCard
                        title="Revenue Heatmap (lifetime)"
                        subtitle="Revenue hotspots by site"
                        points={revenueHeatPoints}
                        center={siteCoords.center}
                        isLoading={sitesQuery.isLoading || reservationsQuery.isLoading}
                      />
                    )}
                  </div>
                )}

                {/* PERFORMANCE TAB - Length of Stay Distribution */}
                {activeTab === 'performance' && lengthOfStayReport && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Length of Stay Distribution</div>
                      <div className="text-xs text-slate-500">Avg: {lengthOfStayReport.avgStay.toFixed(1)} nights | Total bookings: {lengthOfStayReport.totalBookings}</div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-slate-200">
                          <tr>
                            <th className="text-left py-2 text-slate-600 font-medium">Nights</th>
                            <th className="text-center py-2 text-slate-600 font-medium">Bookings</th>
                            <th className="text-left py-2 text-slate-600 font-medium">Distribution</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lengthOfStayReport.distribution.map((stay, idx) => {
                            const percentage = (stay.count / lengthOfStayReport.totalBookings) * 100;
                            return (
                              <tr key={stay.nights} className={idx % 2 === 0 ? 'bg-slate-50' : ''}>
                                <td className="py-2">
                                  <span className="font-medium text-slate-900">{stay.nights} {stay.nights === 1 ? 'night' : 'nights'}</span>
                                </td>
                                <td className="py-2 text-center">
                                  <span className="inline-block px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800 font-medium">
                                    {stay.count}
                                  </span>
                                </td>
                                <td className="py-2">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-6 bg-slate-100 rounded relative overflow-hidden">
                                      <div
                                        className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-500"
                                        style={{ width: `${percentage}%` }}
                                      />
                                      <div className="absolute inset-0 flex items-center px-2">
                                        <span className="text-xs font-semibold text-slate-900">{percentage.toFixed(1)}%</span>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* PERFORMANCE TAB - Booking Lead Time Analysis */}
                {activeTab === 'performance' && bookingLeadTimeReport && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Booking Lead Time Analysis</div>
                      <div className="text-xs text-slate-500">How far in advance guests book | Avg: {bookingLeadTimeReport.avgLeadTime.toFixed(1)} days | Median: {bookingLeadTimeReport.medianLeadTime} days</div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                        <div className="text-xs text-red-700 mb-1">Same Day</div>
                        <div className="text-xl font-bold text-red-900">{bookingLeadTimeReport.buckets.sameDay}</div>
                        <div className="text-xs text-red-600 mt-1">
                          {((bookingLeadTimeReport.buckets.sameDay / bookingLeadTimeReport.total) * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                        <div className="text-xs text-orange-700 mb-1">1-7 Days</div>
                        <div className="text-xl font-bold text-orange-900">{bookingLeadTimeReport.buckets.within7Days}</div>
                        <div className="text-xs text-orange-600 mt-1">
                          {((bookingLeadTimeReport.buckets.within7Days / bookingLeadTimeReport.total) * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <div className="text-xs text-amber-700 mb-1">8-14 Days</div>
                        <div className="text-xl font-bold text-amber-900">{bookingLeadTimeReport.buckets.within14Days}</div>
                        <div className="text-xs text-amber-600 mt-1">
                          {((bookingLeadTimeReport.buckets.within14Days / bookingLeadTimeReport.total) * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                        <div className="text-xs text-yellow-700 mb-1">15-30 Days</div>
                        <div className="text-xl font-bold text-yellow-900">{bookingLeadTimeReport.buckets.within30Days}</div>
                        <div className="text-xs text-yellow-600 mt-1">
                          {((bookingLeadTimeReport.buckets.within30Days / bookingLeadTimeReport.total) * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="rounded-lg border border-lime-200 bg-lime-50 p-3">
                        <div className="text-xs text-lime-700 mb-1">31-60 Days</div>
                        <div className="text-xl font-bold text-lime-900">{bookingLeadTimeReport.buckets.within60Days}</div>
                        <div className="text-xs text-lime-600 mt-1">
                          {((bookingLeadTimeReport.buckets.within60Days / bookingLeadTimeReport.total) * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                        <div className="text-xs text-emerald-700 mb-1">61-90 Days</div>
                        <div className="text-xl font-bold text-emerald-900">{bookingLeadTimeReport.buckets.within90Days}</div>
                        <div className="text-xs text-emerald-600 mt-1">
                          {((bookingLeadTimeReport.buckets.within90Days / bookingLeadTimeReport.total) * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                        <div className="text-xs text-blue-700 mb-1">90+ Days</div>
                        <div className="text-xl font-bold text-blue-900">{bookingLeadTimeReport.buckets.over90Days}</div>
                        <div className="text-xs text-blue-600 mt-1">
                          {((bookingLeadTimeReport.buckets.over90Days / bookingLeadTimeReport.total) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* REVENUE TAB - Future Revenue Forecast */}
                {activeTab === 'revenue' && futureRevenue && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Future Revenue Forecast</div>
                      <div className="text-xs text-slate-500">Confirmed & pending bookings</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-slate-200 bg-blue-50 p-3">
                        <div className="text-xs text-blue-700 mb-1">Bookings</div>
                        <div className="text-2xl font-bold text-blue-900">{futureRevenue.count}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-emerald-50 p-3">
                        <div className="text-xs text-emerald-700 mb-1">Total Value</div>
                        <div className="text-2xl font-bold text-emerald-900">${futureRevenue.totalRevenue.toFixed(0)}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-green-50 p-3">
                        <div className="text-xs text-green-700 mb-1">Paid</div>
                        <div className="text-lg font-bold text-green-900">${futureRevenue.totalPaid.toFixed(0)}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-amber-50 p-3">
                        <div className="text-xs text-amber-700 mb-1">Outstanding</div>
                        <div className="text-lg font-bold text-amber-900">${futureRevenue.outstanding.toFixed(0)}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* REVENUE TAB - Payment Breakdown */}
                {activeTab === 'revenue' && paymentStats && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Payment Breakdown</div>
                      <div className="text-xs text-slate-500">All-time collection metrics</div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs text-slate-600 mb-1">Total Revenue</div>
                        <div className="text-xl font-bold text-slate-900">{formatCurrency(paymentStats.totalRevenue, 0)}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-green-50 p-3">
                        <div className="text-xs text-green-700 mb-1">Collected</div>
                        <div className="text-xl font-bold text-green-900">{formatCurrency(paymentStats.totalPaid, 0)}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-amber-50 p-3">
                        <div className="text-xs text-amber-700 mb-1">Outstanding</div>
                        <div className="text-xl font-bold text-amber-900">{formatCurrency(paymentStats.totalBalance, 0)}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-blue-50 p-3">
                        <div className="text-xs text-blue-700 mb-1">Collection Rate</div>
                        <div className="text-xl font-bold text-blue-900">{paymentStats.paidPercentage}%</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* REVENUE TAB - Monthly Comparison */}
                {activeTab === 'revenue' && monthlyComparison && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Month-over-Month</div>
                      <div className="text-xs text-slate-500">Current vs previous month comparison</div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-slate-700 uppercase">Current Month</div>
                        <div className="rounded-lg border border-slate-200 bg-blue-50 p-3">
                          <div className="text-xs text-blue-700 mb-1">Bookings</div>
                          <div className="text-2xl font-bold text-blue-900">{monthlyComparison.current.bookings}</div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-emerald-50 p-3">
                          <div className="text-xs text-emerald-700 mb-1">Revenue</div>
                          <div className="text-2xl font-bold text-emerald-900">{formatCurrency(monthlyComparison.current.revenue, 0)}</div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-slate-700 uppercase">Previous Month</div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <div className="text-xs text-slate-600 mb-1">Bookings</div>
                          <div className="text-2xl font-bold text-slate-900">{monthlyComparison.previous.bookings}</div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <div className="text-xs text-slate-600 mb-1">Revenue</div>
                          <div className="text-2xl font-bold text-slate-900">{formatCurrency(monthlyComparison.previous.revenue, 0)}</div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-slate-700 uppercase">Change</div>
                        <div className={`rounded-lg border border-slate-200 p-3 ${monthlyComparison.change.bookings >= 0 ? 'bg-green-50' : 'bg-rose-50'}`}>
                          <div className="text-xs mb-1 ${monthlyComparison.change.bookings >= 0 ? 'text-green-700' : 'text-rose-700'}">Bookings</div>
                          <div className={`text-2xl font-bold ${monthlyComparison.change.bookings >= 0 ? 'text-green-900' : 'text-rose-900'}`}>
                            {monthlyComparison.change.bookings >= 0 ? '+' : ''}{monthlyComparison.change.bookings}
                          </div>
                        </div>
                        <div className={`rounded-lg border border-slate-200 p-3 ${parseFloat(monthlyComparison.change.revenuePercent) >= 0 ? 'bg-green-50' : 'bg-rose-50'}`}>
                          <div className="text-xs mb-1 ${parseFloat(monthlyComparison.change.revenuePercent) >= 0 ? 'text-green-700' : 'text-rose-700'}">Revenue</div>
                          <div className={`text-2xl font-bold ${parseFloat(monthlyComparison.change.revenuePercent) >= 0 ? 'text-green-900' : 'text-rose-900'}`}>
                            {parseFloat(monthlyComparison.change.revenuePercent) >= 0 ? '+' : ''}{monthlyComparison.change.revenuePercent}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* GUESTS TAB */}
                {activeTab === 'guests' && guestStats && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Guest Analytics</div>
                      <div className="text-xs text-slate-500">Loyalty metrics</div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs text-slate-600 mb-1">Total</div>
                        <div className="text-2xl font-bold text-slate-900">{guestStats.total}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-purple-50 p-3">
                        <div className="text-xs text-purple-700 mb-1">Repeat</div>
                        <div className="text-2xl font-bold text-purple-900">{guestStats.repeat}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-blue-50 p-3">
                        <div className="text-xs text-blue-700 mb-1">Rate</div>
                        <div className="text-2xl font-bold text-blue-900">{guestStats.repeatRate}%</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* GUESTS TAB - Party Size Distribution */}
                {activeTab === 'guests' && partySizeStats && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Party Size Distribution</div>
                      <div className="text-xs text-slate-500">Average party size: {partySizeStats.avgPartySize} guests</div>
                    </div>
                    <div className="space-y-2">
                      {Object.entries(partySizeStats.distribution).map(([range, count]) => {
                        const total = Object.values(partySizeStats.distribution).reduce((sum, c) => sum + c, 0);
                        const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
                        return (
                          <div key={range} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-700">{range} guests</span>
                              <span className="font-semibold text-slate-900">{count} ({percentage}%)</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-purple-500 to-purple-600"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* GUESTS TAB - Top Guests by Revenue */}
                {activeTab === 'guests' && topGuestsStats && topGuestsStats.length > 0 && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Top 10 Guests by Revenue</div>
                      <div className="text-xs text-slate-500">Most valuable customers (All-time)</div>
                    </div>
                    <div className="space-y-2">
                      {topGuestsStats.map((guest, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-6 text-center text-xs font-semibold text-slate-500">#{idx + 1}</div>
                          <div className="flex-1 flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2">
                            <div>
                              <div className="text-sm font-medium text-slate-900">{guest.name}</div>
                              <div className="text-xs text-slate-500">{guest.bookings} bookings</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold text-emerald-600">{formatCurrency(guest.revenue, 0)}</div>
                              <div className="text-xs text-slate-500">{formatCurrency(guest.revenue / guest.bookings, 0)}/booking</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* GUESTS TAB - Guest Loyalty & Repeat Visitors */}
                {activeTab === 'guests' && guestLoyaltyReport && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Guest Loyalty & Repeat Visitors</div>
                      <div className="text-xs text-slate-500">
                        Repeat Rate: {guestLoyaltyReport.stats.repeatRate.toFixed(1)}% |
                        Avg Visits per Repeat Guest: {guestLoyaltyReport.stats.avgVisitsPerRepeatGuest.toFixed(1)}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs text-slate-600 mb-1">Total Guests</div>
                        <div className="text-2xl font-bold text-slate-900">{guestLoyaltyReport.stats.totalGuests}</div>
                      </div>
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                        <div className="text-xs text-emerald-700 mb-1">Repeat Guests</div>
                        <div className="text-2xl font-bold text-emerald-900">{guestLoyaltyReport.stats.repeatGuests}</div>
                      </div>
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                        <div className="text-xs text-blue-700 mb-1">Repeat Rate</div>
                        <div className="text-2xl font-bold text-blue-900">{guestLoyaltyReport.stats.repeatRate.toFixed(1)}%</div>
                      </div>
                    </div>
                    {guestLoyaltyReport.guests.length === 0 ? (
                      <div className="text-sm text-slate-500">No repeat guests yet</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b border-slate-200">
                            <tr>
                              <th className="text-left py-2 text-slate-600 font-medium">Guest Name</th>
                              <th className="text-center py-2 text-slate-600 font-medium">Visits</th>
                              <th className="text-right py-2 text-slate-600 font-medium">Total Spent</th>
                              <th className="text-left py-2 text-slate-600 font-medium">Last Visit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {guestLoyaltyReport.guests.slice(0, 25).map((guest, idx) => (
                              <tr key={guest.guestId} className={idx % 2 === 0 ? 'bg-emerald-50' : 'bg-white'}>
                                <td className="py-2 font-medium">{guest.name}</td>
                                <td className="py-2 text-center">
                                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${guest.visits >= 10 ? 'bg-purple-100 text-purple-800' :
                                    guest.visits >= 5 ? 'bg-emerald-100 text-emerald-800' :
                                      guest.visits >= 3 ? 'bg-blue-100 text-blue-800' :
                                        'bg-slate-100 text-slate-800'
                                    }`}>
                                    {guest.visits}x
                                  </span>
                                </td>
                                <td className="py-2 text-right">
                                  <span className="font-semibold text-emerald-700">{formatCurrency(guest.totalSpent)}</span>
                                </td>
                                <td className="py-2 text-slate-600">{guest.lastVisit}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* GUESTS TAB - Guest Segmentation (New vs Returning) */}
                {activeTab === 'guests' && guestSegmentationReport && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Guest Segmentation Analysis</div>
                      <div className="text-xs text-slate-500">New vs Returning guest revenue breakdown | Returning Rate: {guestSegmentationReport.returningRate.toFixed(1)}%</div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {guestSegmentationReport.segments.map(segment => (
                        <div key={segment.type} className={`rounded-lg border-2 p-4 ${segment.type === 'New Guests' ? 'border-blue-300 bg-blue-50' : 'border-emerald-300 bg-emerald-50'
                          }`}>
                          <div className={`text-sm font-semibold mb-3 ${segment.type === 'New Guests' ? 'text-blue-900' : 'text-emerald-900'
                            }`}>
                            {segment.type}
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className={`text-xs ${segment.type === 'New Guests' ? 'text-blue-700' : 'text-emerald-700'}`}>
                                Total Guests
                              </span>
                              <span className={`text-lg font-bold ${segment.type === 'New Guests' ? 'text-blue-900' : 'text-emerald-900'}`}>
                                {segment.count}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className={`text-xs ${segment.type === 'New Guests' ? 'text-blue-700' : 'text-emerald-700'}`}>
                                Bookings
                              </span>
                              <span className={`text-lg font-bold ${segment.type === 'New Guests' ? 'text-blue-900' : 'text-emerald-900'}`}>
                                {segment.bookings}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className={`text-xs ${segment.type === 'New Guests' ? 'text-blue-700' : 'text-emerald-700'}`}>
                                Total Revenue
                              </span>
                              <span className={`text-xl font-bold ${segment.type === 'New Guests' ? 'text-blue-900' : 'text-emerald-900'}`}>
                                {formatCurrency(segment.revenue, 0)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-current/20">
                              <span className={`text-xs ${segment.type === 'New Guests' ? 'text-blue-600' : 'text-emerald-600'}`}>
                                Avg Per Booking
                              </span>
                              <span className={`text-sm font-semibold ${segment.type === 'New Guests' ? 'text-blue-800' : 'text-emerald-800'}`}>
                                {formatCurrency(segment.avgRevenue)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ANALYTICS TAB */}
                {activeTab === 'analytics' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Cancellation Analytics */}
                    {cancellationStats && (
                      <div className="card p-4 space-y-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">Cancellation Analytics</div>
                          <div className="text-xs text-slate-500">All-time performance</div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="text-xs text-slate-600 mb-1">Total</div>
                            <div className="text-2xl font-bold text-slate-900">{cancellationStats.total}</div>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-rose-50 p-3">
                            <div className="text-xs text-rose-700 mb-1">Rate</div>
                            <div className="text-2xl font-bold text-rose-900">{cancellationStats.rate}%</div>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-amber-50 p-3">
                            <div className="text-xs text-amber-700 mb-1">Lost $</div>
                            <div className="text-2xl font-bold text-amber-900">{formatCurrency(cancellationStats.revenueLost, 0)}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Length of Stay */}
                    {lengthOfStayStats && (
                      <div className="card p-4 space-y-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">Length of Stay</div>
                          <div className="text-xs text-slate-500">Average: {lengthOfStayStats.avgNights} nights</div>
                        </div>
                        <div className="space-y-2">
                          {Object.entries(lengthOfStayStats.distribution).map(([range, count]) => (
                            <div key={range} className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                              <span className="text-slate-700">{range}</span>
                              <span className="font-semibold text-slate-900">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Booking Window Distribution */}
                    {bookingWindowStats && (
                      <div className="card p-4 space-y-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">Booking Window</div>
                          <div className="text-xs text-slate-500">Average: {bookingWindowStats.avgDays} days in advance</div>
                        </div>
                        <div className="space-y-2">
                          {Object.entries(bookingWindowStats.distribution).map(([range, count]) => (
                            <div key={range} className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                              <span className="text-slate-700">{range}</span>
                              <span className="font-semibold text-slate-900">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Day of Week Patterns */}
                    {dayOfWeekStats && (
                      <div className="card p-4 space-y-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">Day of Week Patterns</div>
                          <div className="text-xs text-slate-500">Arrival & departure trends</div>
                        </div>
                        <div className="space-y-2">
                          {dayOfWeekStats.map(({ day, arrivals, departures }) => (
                            <div key={day} className="flex items-center gap-2">
                              <div className="w-20 text-xs text-slate-600 flex-shrink-0">{day.slice(0, 3)}</div>
                              <div className="flex-1 grid grid-cols-2 gap-2">
                                <div className="rounded-md border border-slate-200 bg-blue-50 px-2 py-1 text-xs">
                                  <span className="text-blue-700">In: </span>
                                  <span className="font-semibold text-blue-900">{arrivals}</span>
                                </div>
                                <div className="rounded-md border border-slate-200 bg-amber-50 px-2 py-1 text-xs">
                                  <span className="text-amber-700">Out: </span>
                                  <span className="font-semibold text-amber-900">{departures}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Revenue Concentration */}
                    {revenueConcentrationStats && (
                      <div className="card p-4 space-y-3 lg:col-span-2">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">Revenue Concentration</div>
                          <div className="text-xs text-slate-500">Pareto analysis of site revenue distribution</div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="rounded-lg border border-slate-200 bg-white p-4">
                            <div className="text-xs text-slate-600 mb-2">Total Sites</div>
                            <div className="text-3xl font-bold text-slate-900 mb-3">{revenueConcentrationStats.totalSites}</div>
                            <div className="text-xs text-slate-500">In your campground</div>
                          </div>
                          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                            <div className="text-xs text-emerald-700 mb-2">Top 20% of Sites</div>
                            <div className="text-3xl font-bold text-emerald-900 mb-3">{revenueConcentrationStats.top20Percent}%</div>
                            <div className="text-xs text-emerald-700">of total revenue</div>
                          </div>
                          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                            <div className="text-xs text-blue-700 mb-2">Top 50% of Sites</div>
                            <div className="text-3xl font-bold text-blue-900 mb-3">{revenueConcentrationStats.top50Percent}%</div>
                            <div className="text-xs text-blue-700">of total revenue</div>
                          </div>
                        </div>
                        <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700">
                          <span className="font-semibold">Insight:</span> Understanding revenue concentration helps identify your star performers and opportunities to improve underperforming sites.
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* MARKETING TAB */}
                {activeTab === 'marketing' && marketingStats && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Booking Conversion</div>
                      <div className="text-xs text-slate-500">All-time conversion metrics</div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs text-slate-600 mb-1">Total</div>
                        <div className="text-2xl font-bold text-slate-900">{marketingStats.total}</div>
                      </div>
                      <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                        <div className="text-xs text-green-700 mb-1">Confirmed</div>
                        <div className="text-2xl font-bold text-green-900">{marketingStats.confirmed}</div>
                      </div>
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                        <div className="text-xs text-blue-700 mb-1">Pending</div>
                        <div className="text-2xl font-bold text-blue-900">{marketingStats.pending}</div>
                      </div>
                      <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                        <div className="text-xs text-rose-700 mb-1">Cancelled</div>
                        <div className="text-2xl font-bold text-rose-900">{marketingStats.cancelled}</div>
                      </div>
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                        <div className="text-xs text-emerald-700 mb-1">Conv. Rate</div>
                        <div className="text-2xl font-bold text-emerald-900">{marketingStats.conversionRate}%</div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                      <div className="text-xs text-purple-700 mb-1">Average Booking Value</div>
                      <div className="text-3xl font-bold text-purple-900">{formatCurrency(marketingStats.avgBookingValue)}</div>
                    </div>
                  </div>
                )}

                {activeTab === 'marketing' && bookingPaceStats && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Booking Pace</div>
                      <div className="text-xs text-slate-500">Future bookings on the books</div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                        <div className="text-xs text-blue-700 mb-1">Next 30 Days</div>
                        <div className="text-2xl font-bold text-blue-900">{bookingPaceStats.next30Days}</div>
                        <div className="text-xs text-blue-700">bookings</div>
                      </div>
                      <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3">
                        <div className="text-xs text-cyan-700 mb-1">31-60 Days</div>
                        <div className="text-2xl font-bold text-cyan-900">{bookingPaceStats.next60Days}</div>
                        <div className="text-xs text-cyan-700">bookings</div>
                      </div>
                      <div className="rounded-lg border border-teal-200 bg-teal-50 p-3">
                        <div className="text-xs text-teal-700 mb-1">61-90 Days</div>
                        <div className="text-2xl font-bold text-teal-900">{bookingPaceStats.next90Days}</div>
                        <div className="text-xs text-teal-700">bookings</div>
                      </div>
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                        <div className="text-xs text-emerald-700 mb-1">Total Future</div>
                        <div className="text-2xl font-bold text-emerald-900">{bookingPaceStats.total}</div>
                        <div className="text-xs text-emerald-700">bookings</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* FORECASTING TAB */}
                {activeTab === 'forecasting' && revenueForecast && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Revenue Forecast</div>
                      <div className="text-xs text-slate-500">Projected revenue for next 3 months (confirmed + pending bookings)</div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {revenueForecast.map(({ month, revenue, bookings }) => (
                        <div key={month} className="rounded-lg border border-slate-200 bg-gradient-to-br from-blue-50 to-cyan-50 p-4 space-y-2">
                          <div className="text-sm font-bold text-blue-900">{month}</div>
                          <div>
                            <div className="text-xs text-slate-600">Projected Revenue</div>
                            <div className="text-3xl font-bold text-slate-900">{formatCurrency(revenue, 0)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-600">Bookings</div>
                            <div className="text-lg font-semibold text-slate-900">{bookings}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800">
                      <span className="font-semibold">Note:</span> Forecasts are based on current confirmed and pending reservations. Actual results may vary based on new bookings and cancellations.
                    </div>
                  </div>
                )}

                {activeTab === 'forecasting' && bookingPaceStats && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Demand Outlook</div>
                      <div className="text-xs text-slate-500">Booking distribution for next 90 days</div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-24 text-xs text-slate-600">0-30 days</div>
                        <div className="flex-1 h-10 bg-slate-100 rounded relative overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
                            style={{ width: `${(bookingPaceStats.next30Days / bookingPaceStats.total) * 100}%` }}
                          />
                          <div className="absolute inset-0 flex items-center px-2">
                            <span className="text-sm font-semibold text-slate-900">{bookingPaceStats.next30Days} bookings</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-24 text-xs text-slate-600">31-60 days</div>
                        <div className="flex-1 h-10 bg-slate-100 rounded relative overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-500 to-cyan-600"
                            style={{ width: `${(bookingPaceStats.next60Days / bookingPaceStats.total) * 100}%` }}
                          />
                          <div className="absolute inset-0 flex items-center px-2">
                            <span className="text-sm font-semibold text-slate-900">{bookingPaceStats.next60Days} bookings</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-24 text-xs text-slate-600">61-90 days</div>
                        <div className="flex-1 h-10 bg-slate-100 rounded relative overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-teal-500 to-teal-600"
                            style={{ width: `${(bookingPaceStats.next90Days / bookingPaceStats.total) * 100}%` }}
                          />
                          <div className="absolute inset-0 flex items-center px-2">
                            <span className="text-sm font-semibold text-slate-900">{bookingPaceStats.next90Days} bookings</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* FORECASTING TAB - Seasonal Analysis */}
                {activeTab === 'forecasting' && seasonalAnalysisReport && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Peak vs Off-Peak Season Analysis</div>
                      <div className="text-xs text-slate-500">Avg Revenue: ${seasonalAnalysisReport.avgRevenue.toFixed(0)}/month | Peak: {seasonalAnalysisReport.peakMonths.map(m => m.month).join(', ')}</div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {seasonalAnalysisReport.months.map(month => {
                        const isPeak = seasonalAnalysisReport.peakMonths.some(m => m.month === month.month);
                        const isOffPeak = seasonalAnalysisReport.offPeakMonths.some(m => m.month === month.month);
                        return (
                          <div
                            key={month.month}
                            className={`rounded-lg border p-3 ${isPeak ? 'border-emerald-300 bg-emerald-50' :
                              isOffPeak ? 'border-amber-300 bg-amber-50' :
                                'border-slate-200 bg-slate-50'
                              }`}
                          >
                            <div className={`text-xs mb-1 font-medium ${isPeak ? 'text-emerald-700' :
                              isOffPeak ? 'text-amber-700' :
                                'text-slate-600'
                              }`}>
                              {month.month}
                            </div>
                            <div className={`text-lg font-bold ${isPeak ? 'text-emerald-900' :
                              isOffPeak ? 'text-amber-900' :
                                'text-slate-900'
                              }`}>
                              {formatCurrency(month.revenue, 0)}
                            </div>
                            <div className={`text-xs mt-1 ${isPeak ? 'text-emerald-600' :
                              isOffPeak ? 'text-amber-600' :
                                'text-slate-500'
                              }`}>
                              {month.bookings} bookings
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* FORECASTING TAB - Day of Week Performance */}
                {activeTab === 'forecasting' && dayOfWeekReport && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Day of Week Performance</div>
                      <div className="text-xs text-slate-500">Check-in patterns by arrival day | Avg: {dayOfWeekReport.avgBookingsPerDay.toFixed(1)} bookings/day</div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                      {dayOfWeekReport.days.map(day => {
                        const isWeekend = day.day === 'Friday' || day.day === 'Saturday';
                        return (
                          <div
                            key={day.day}
                            className={`rounded-lg border p-3 ${isWeekend ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-slate-50'
                              }`}
                          >
                            <div className={`text-xs mb-1 ${isWeekend ? 'text-blue-700 font-medium' : 'text-slate-600'}`}>
                              {day.day.substring(0, 3)}
                            </div>
                            <div className={`text-xl font-bold ${isWeekend ? 'text-blue-900' : 'text-slate-900'}`}>
                              {day.bookings}
                            </div>
                            <div className={`text-xs mt-1 ${isWeekend ? 'text-blue-600' : 'text-slate-500'}`}>
                              {formatCurrency(day.revenue, 0)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* FORECASTING TAB - Revenue Optimization Opportunities */}
                {activeTab === 'forecasting' && revenueOptimizationReport && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Revenue Optimization Opportunities</div>
                      <div className="text-xs text-slate-500">Actionable insights to improve performance</div>
                    </div>
                    {revenueOptimizationReport.length === 0 ? (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center">
                        <div className="text-emerald-800 font-medium">All systems performing well!</div>
                        <div className="text-xs text-emerald-600 mt-1">No optimization opportunities detected</div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {revenueOptimizationReport.map((opp, idx) => (
                          <div
                            key={idx}
                            className={`rounded-lg border p-3 ${opp.severity === 'high' ? 'border-red-200 bg-red-50' :
                              opp.severity === 'medium' ? 'border-amber-200 bg-amber-50' :
                                'border-blue-200 bg-blue-50'
                              }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${opp.severity === 'high' ? 'bg-red-100 text-red-800' :
                                    opp.severity === 'medium' ? 'bg-amber-100 text-amber-800' :
                                      'bg-blue-100 text-blue-800'
                                    }`}>
                                    {opp.severity.toUpperCase()}
                                  </span>
                                  <span className={`text-xs font-medium ${opp.severity === 'high' ? 'text-red-700' :
                                    opp.severity === 'medium' ? 'text-amber-700' :
                                      'text-blue-700'
                                    }`}>
                                    {opp.type}
                                  </span>
                                </div>
                                <div className={`text-sm ${opp.severity === 'high' ? 'text-red-900' :
                                  opp.severity === 'medium' ? 'text-amber-900' :
                                    'text-blue-900'
                                  }`}>
                                  {opp.description}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* FORECASTING TAB - Occupancy Forecast (90 days) */}
                {activeTab === 'forecasting' && occupancyForecastReport && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">90-Day Occupancy Forecast</div>
                      <div className="text-xs text-slate-500">
                        Avg: {occupancyForecastReport.avgOccupancy.toFixed(1)}% |
                        Peak: {occupancyForecastReport.peakDay.occupancy.toFixed(1)}% on {occupancyForecastReport.peakDay.date} |
                        Low: {occupancyForecastReport.lowDay.occupancy.toFixed(1)}% on {occupancyForecastReport.lowDay.date}
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-slate-200">
                          <tr>
                            <th className="text-left py-2 text-slate-600 font-medium">Date</th>
                            <th className="text-center py-2 text-slate-600 font-medium">Occupied</th>
                            <th className="text-center py-2 text-slate-600 font-medium">Total Sites</th>
                            <th className="text-left py-2 text-slate-600 font-medium">Occupancy</th>
                          </tr>
                        </thead>
                        <tbody>
                          {occupancyForecastReport.forecast.map((day, idx) => {
                            if (idx % 7 !== 0) return null; // Show weekly snapshots
                            return (
                              <tr key={day.date} className={idx % 14 === 0 ? 'bg-slate-50' : ''}>
                                <td className="py-2 font-medium">{day.date}</td>
                                <td className="py-2 text-center text-slate-700">{day.occupiedSites}</td>
                                <td className="py-2 text-center text-slate-600">{day.totalSites}</td>
                                <td className="py-2">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-6 bg-slate-100 rounded relative overflow-hidden max-w-xs">
                                      <div
                                        className={`h-full transition-all duration-500 ${day.occupancy >= 80 ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' :
                                          day.occupancy >= 60 ? 'bg-gradient-to-r from-blue-500 to-blue-600' :
                                            day.occupancy >= 40 ? 'bg-gradient-to-r from-amber-500 to-amber-600' :
                                              'bg-gradient-to-r from-red-500 to-red-600'
                                          }`}
                                        style={{ width: `${day.occupancy}%` }}
                                      />
                                      <div className="absolute inset-0 flex items-center px-2">
                                        <span className="text-xs font-semibold text-slate-900">{day.occupancy.toFixed(1)}%</span>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* PERFORMANCE TAB - Extended Stay Analysis */}
                {activeTab === 'performance' && extendedStayReport && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Extended Stay Analysis</div>
                      <div className="text-xs text-slate-500">Long-term guest tracking (7+ nights)</div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {extendedStayReport.summary.map(category => (
                        <div key={category.type} className="rounded-lg border-2 border-purple-300 bg-purple-50 p-4">
                          <div className="text-xs font-semibold text-purple-900 mb-3">{category.type}</div>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-purple-700">Bookings</span>
                              <span className="text-lg font-bold text-purple-900">{category.count}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-purple-700">Unique Guests</span>
                              <span className="text-lg font-bold text-purple-900">{category.uniqueGuests}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-purple-700">Revenue</span>
                              <span className="text-lg font-bold text-purple-900">{formatCurrency(category.revenue, 0)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-purple-700">Avg Stay</span>
                              <span className="text-lg font-bold text-purple-900">{category.avgStay.toFixed(1)} nights</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {extendedStayReport.extendedStays.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-slate-700 uppercase">Top Extended Stays</div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="border-b border-slate-200">
                              <tr>
                                <th className="text-left py-2 text-slate-600 font-medium">Type</th>
                                <th className="text-left py-2 text-slate-600 font-medium">Guest</th>
                                <th className="text-left py-2 text-slate-600 font-medium">Site</th>
                                <th className="text-left py-2 text-slate-600 font-medium">Arrival</th>
                                <th className="text-left py-2 text-slate-600 font-medium">Departure</th>
                                <th className="text-right py-2 text-slate-600 font-medium">Nights</th>
                                <th className="text-right py-2 text-slate-600 font-medium">Revenue</th>
                              </tr>
                            </thead>
                            <tbody>
                              {extendedStayReport.extendedStays.map((stay, idx) => (
                                <tr key={idx} className={idx % 2 === 0 ? 'bg-slate-50' : ''}>
                                  <td className="py-2">
                                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${stay.type === 'Monthly (30+)' ? 'bg-purple-100 text-purple-800' :
                                      stay.type === 'Bi-Weekly (14-29)' ? 'bg-indigo-100 text-indigo-800' :
                                        'bg-blue-100 text-blue-800'
                                      }`}>
                                      {stay.type}
                                    </span>
                                  </td>
                                  <td className="py-2">{stay.guest}</td>
                                  <td className="py-2">{stay.site}</td>
                                  <td className="py-2">{stay.arrival}</td>
                                  <td className="py-2">{stay.departure}</td>
                                  <td className="py-2 text-right font-semibold">{stay.nights}</td>
                                  <td className="py-2 text-right">{formatCurrency(stay.revenue)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* GUESTS TAB - Group Booking Analysis */}
                {activeTab === 'guests' && groupBookingReport && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Group Booking Analysis</div>
                      <div className="text-xs text-slate-500">Parties of 5+ guests | Total: {groupBookingReport.totalGroups} groups</div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="rounded-lg border border-slate-200 bg-blue-50 p-3">
                        <div className="text-xs text-blue-700 mb-1">Total Groups</div>
                        <div className="text-2xl font-bold text-blue-900">{groupBookingReport.totalGroups}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-emerald-50 p-3">
                        <div className="text-xs text-emerald-700 mb-1">Total Revenue</div>
                        <div className="text-2xl font-bold text-emerald-900">{formatCurrency(groupBookingReport.totalRevenue, 0)}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-purple-50 p-3">
                        <div className="text-xs text-purple-700 mb-1">Avg Party Size</div>
                        <div className="text-2xl font-bold text-purple-900">{groupBookingReport.avgPartySize.toFixed(1)}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-amber-50 p-3">
                        <div className="text-xs text-amber-700 mb-1">Avg Revenue/Person</div>
                        <div className="text-2xl font-bold text-amber-900">{formatCurrency(groupBookingReport.avgRevenuePerPerson, 0)}</div>
                      </div>
                    </div>
                    {groupBookingReport.largestGroups.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-slate-700 uppercase">Largest Groups</div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="border-b border-slate-200">
                              <tr>
                                <th className="text-left py-2 text-slate-600 font-medium">Guest Name</th>
                                <th className="text-left py-2 text-slate-600 font-medium">Site</th>
                                <th className="text-left py-2 text-slate-600 font-medium">Arrival</th>
                                <th className="text-left py-2 text-slate-600 font-medium">Departure</th>
                                <th className="text-right py-2 text-slate-600 font-medium">Party Size</th>
                                <th className="text-right py-2 text-slate-600 font-medium">Revenue</th>
                                <th className="text-right py-2 text-slate-600 font-medium">$/Person</th>
                              </tr>
                            </thead>
                            <tbody>
                              {groupBookingReport.largestGroups.map((group, idx) => (
                                <tr key={idx} className={idx % 2 === 0 ? 'bg-slate-50' : ''}>
                                  <td className="py-2">{group.guest}</td>
                                  <td className="py-2">{group.site}</td>
                                  <td className="py-2">{group.arrival}</td>
                                  <td className="py-2">{group.departure}</td>
                                  <td className="py-2 text-right">
                                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${group.partySize >= 10 ? 'bg-purple-100 text-purple-800' :
                                      group.partySize >= 8 ? 'bg-indigo-100 text-indigo-800' :
                                        'bg-blue-100 text-blue-800'
                                      }`}>
                                      {group.partySize}
                                    </span>
                                  </td>
                                  <td className="py-2 text-right">{formatCurrency(group.revenue)}</td>
                                  <td className="py-2 text-right">{formatCurrency(group.revenuePerPerson)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* PERFORMANCE TAB - Advance vs Walk-in Booking Analysis */}
                {activeTab === 'performance' && advanceBookingReport && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Advance vs Walk-in Booking Analysis</div>
                      <div className="text-xs text-slate-500">Booking lead time distribution | Total: {advanceBookingReport.total} bookings</div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {advanceBookingReport.categories.map(cat => (
                        <div key={cat.type} className={`rounded-lg border-2 p-4 ${cat.type === 'Same Day / Walk-in' ? 'border-red-300 bg-red-50' :
                          cat.type === 'Advance (1-30 days)' ? 'border-amber-300 bg-amber-50' :
                            'border-emerald-300 bg-emerald-50'
                          }`}>
                          <div className={`text-xs font-semibold mb-3 ${cat.type === 'Same Day / Walk-in' ? 'text-red-900' :
                            cat.type === 'Advance (1-30 days)' ? 'text-amber-900' :
                              'text-emerald-900'
                            }`}>
                            {cat.type}
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className={`text-xs ${cat.type === 'Same Day / Walk-in' ? 'text-red-700' :
                                cat.type === 'Advance (1-30 days)' ? 'text-amber-700' :
                                  'text-emerald-700'
                                }`}>
                                Bookings
                              </span>
                              <span className={`text-lg font-bold ${cat.type === 'Same Day / Walk-in' ? 'text-red-900' :
                                cat.type === 'Advance (1-30 days)' ? 'text-amber-900' :
                                  'text-emerald-900'
                                }`}>
                                {cat.count}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className={`text-xs ${cat.type === 'Same Day / Walk-in' ? 'text-red-700' :
                                cat.type === 'Advance (1-30 days)' ? 'text-amber-700' :
                                  'text-emerald-700'
                                }`}>
                                Percentage
                              </span>
                              <span className={`text-lg font-bold ${cat.type === 'Same Day / Walk-in' ? 'text-red-900' :
                                cat.type === 'Advance (1-30 days)' ? 'text-amber-900' :
                                  'text-emerald-900'
                                }`}>
                                {cat.percentage.toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className={`text-xs ${cat.type === 'Same Day / Walk-in' ? 'text-red-700' :
                                cat.type === 'Advance (1-30 days)' ? 'text-amber-700' :
                                  'text-emerald-700'
                                }`}>
                                Revenue
                              </span>
                              <span className={`text-lg font-bold ${cat.type === 'Same Day / Walk-in' ? 'text-red-900' :
                                cat.type === 'Advance (1-30 days)' ? 'text-amber-900' :
                                  'text-emerald-900'
                                }`}>
                                {formatCurrency(cat.revenue, 0)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className={`text-xs ${cat.type === 'Same Day / Walk-in' ? 'text-red-700' :
                                cat.type === 'Advance (1-30 days)' ? 'text-amber-700' :
                                  'text-emerald-700'
                                }`}>
                                Avg/Booking
                              </span>
                              <span className={`text-lg font-bold ${cat.type === 'Same Day / Walk-in' ? 'text-red-900' :
                                cat.type === 'Advance (1-30 days)' ? 'text-amber-900' :
                                  'text-emerald-900'
                                }`}>
                                {formatCurrency(cat.avgRevenue, 0)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* FORECASTING TAB - Pricing Strategy Recommendations */}
                {activeTab === 'forecasting' && pricingStrategyReport && pricingStrategyReport.length > 0 && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">AI-Driven Pricing Strategy Recommendations</div>
                      <div className="text-xs text-slate-500">Revenue optimization opportunities | {pricingStrategyReport.length} recommendations</div>
                    </div>
                    <div className="space-y-2">
                      {pricingStrategyReport.map((rec, idx) => (
                        <div key={idx} className={`rounded-lg border-2 p-3 ${rec.priority === 'high' ? 'border-rose-300 bg-rose-50' :
                          rec.priority === 'medium' ? 'border-amber-300 bg-amber-50' :
                            'border-blue-300 bg-blue-50'
                          }`}>
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${rec.priority === 'high' ? 'bg-rose-200 text-rose-900' :
                                rec.priority === 'medium' ? 'bg-amber-200 text-amber-900' :
                                  'bg-blue-200 text-blue-900'
                                }`}>
                                {rec.priority.toUpperCase()}
                              </span>
                              <span className={`text-sm font-semibold ${rec.priority === 'high' ? 'text-rose-900' :
                                rec.priority === 'medium' ? 'text-amber-900' :
                                  'text-blue-900'
                                }`}>
                                {rec.type}
                              </span>
                            </div>
                            <div className="text-xs font-semibold text-slate-700">{rec.site}</div>
                          </div>
                          <div className={`text-xs mb-2 ${rec.priority === 'high' ? 'text-rose-700' :
                            rec.priority === 'medium' ? 'text-amber-700' :
                              'text-blue-700'
                            }`}>
                            {rec.reason}
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <span className="text-slate-600">Current Rate:</span>
                              <span className="ml-1 font-semibold">{formatCurrency(rec.currentRate, 0)}</span>
                            </div>
                            <div>
                              <span className="text-slate-600">Suggested:</span>
                              <span className="ml-1 font-semibold">{formatCurrency(rec.suggestedRate, 0)}</span>
                            </div>
                            {rec.potentialIncrease > 0 && (
                              <div>
                                <span className="text-slate-600">Potential:</span>
                                <span className="ml-1 font-semibold text-emerald-700">+{formatCurrency(rec.potentialIncrease, 0)}</span>
                              </div>
                            )}
                          </div>
                          <div className="mt-3 pt-3 border-t border-slate-200/60 flex justify-end">
                            <Button
                              size="sm"
                              variant={rec.priority === 'high' ? 'default' : 'secondary'}
                              onClick={async () => {
                                try {
                                  if (!campgroundId) return;

                                  const startDate = new Date();
                                  const endDate = new Date();
                                  endDate.setDate(endDate.getDate() + 30); // 30 day rule by default

                                  await apiClient.createPricingRule(campgroundId, {
                                    label: `AI: ${rec.suggestion} - ${rec.site}`,
                                    startDate: startDate.toISOString().split('T')[0],
                                    endDate: endDate.toISOString().split('T')[0],
                                    isActive: true,
                                    ruleType: 'flat',
                                    flatAdjust: Math.round(rec.suggestedRate * 100),
                                  } as any);

                                  toast({
                                    title: "Pricing Rule Applied",
                                    description: `Applied ${formatCurrency(rec.suggestedRate)} rate for ${rec.site} (30 days).`,
                                  });
                                } catch (err: any) {
                                  toast({
                                    title: "Failed to apply",
                                    description: err.message || "Unknown error",
                                    variant: "destructive"
                                  });
                                }
                              }}
                            >
                              Apply Recommendation
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* FORECASTING TAB - Weekend Premium Analysis */}
                {activeTab === 'forecasting' && weekendPremiumReport && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Weekend Premium Analysis</div>
                      <div className="text-xs text-slate-500">Weekday vs Weekend rate comparison (Friday/Saturday arrivals)</div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                      <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-4">
                        <div className="text-sm font-semibold text-blue-900 mb-3">Weekday Bookings</div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-blue-700">Total Bookings</span>
                            <span className="text-lg font-bold text-blue-900">{weekendPremiumReport.weekday.bookings}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-blue-700">Total Revenue</span>
                            <span className="text-lg font-bold text-blue-900">{formatCurrency(weekendPremiumReport.weekday.revenue, 0)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-blue-700">Avg Rate</span>
                            <span className="text-xl font-bold text-blue-900">{formatCurrency(weekendPremiumReport.weekday.avgRate, 0)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-lg border-2 border-purple-300 bg-purple-50 p-4">
                        <div className="text-sm font-semibold text-purple-900 mb-3">Weekend Bookings</div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-purple-700">Total Bookings</span>
                            <span className="text-lg font-bold text-purple-900">{weekendPremiumReport.weekend.bookings}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-purple-700">Total Revenue</span>
                            <span className="text-lg font-bold text-purple-900">{formatCurrency(weekendPremiumReport.weekend.revenue, 0)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-purple-700">Avg Rate</span>
                            <span className="text-xl font-bold text-purple-900">{formatCurrency(weekendPremiumReport.weekend.avgRate, 0)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className={`rounded-lg border-2 p-4 ${weekendPremiumReport.premium > 0 ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50'
                      }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className={`text-sm font-semibold mb-1 ${weekendPremiumReport.premium > 0 ? 'text-emerald-900' : 'text-rose-900'
                            }`}>
                            Weekend Premium
                          </div>
                          <div className={`text-xs ${weekendPremiumReport.premium > 0 ? 'text-emerald-700' : 'text-rose-700'
                            }`}>
                            {weekendPremiumReport.premium > 0
                              ? 'Weekend rates are higher - good!'
                              : weekendPremiumReport.premium < 0
                                ? 'Consider implementing weekend premium pricing'
                                : 'Weekend and weekday rates are equal'}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 text-right">
                          <div className={`text-2xl font-bold ${weekendPremiumReport.premium > 0 ? 'text-emerald-900' :
                            weekendPremiumReport.premium < -5 ? 'text-rose-900' : 'text-slate-900'
                            }`}>
                            {weekendPremiumReport.premium > 0 ? '+' : ''}{weekendPremiumReport.premium.toFixed(1)}%
                          </div>
                          {weekendPremiumReport.premium <= 0 && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={async () => {
                                try {
                                  if (!campgroundId) return;
                                  const startDate = new Date();
                                  const endDate = new Date();
                                  endDate.setDate(endDate.getDate() + 90); // 90 days

                                  // Create Friday Rule
                                  await apiClient.createPricingRule(campgroundId, {
                                    label: `AI: Weekend Premium (Fri)`,
                                    startDate: startDate.toISOString().split('T')[0],
                                    endDate: endDate.toISOString().split('T')[0],
                                    dayOfWeek: 5, // Friday
                                    isActive: true,
                                    ruleType: 'dow',
                                    percentAdjust: 0.20, // +20%
                                  } as any);

                                  // Create Saturday Rule
                                  await apiClient.createPricingRule(campgroundId, {
                                    label: `AI: Weekend Premium (Sat)`,
                                    startDate: startDate.toISOString().split('T')[0],
                                    endDate: endDate.toISOString().split('T')[0],
                                    dayOfWeek: 6, // Saturday
                                    isActive: true,
                                    ruleType: 'dow',
                                    percentAdjust: 0.20, // +20%
                                  } as any);

                                  toast({
                                    title: "Weekend Premium Applied",
                                    description: "Created +20% pricing rules for Fridays and Saturdays (90 days).",
                                  });
                                } catch (err: any) {
                                  toast({
                                    title: "Failed to apply",
                                    description: err.message || "Unknown error",
                                    variant: "destructive"
                                  });
                                }
                              }}
                            >
                              Apply +20% Premium
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ACCOUNTING TAB */}
                {activeTab === 'accounting' && paymentStats && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Payment Summary</div>
                      <div className="text-xs text-slate-500">All-time collection metrics</div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs text-slate-600 mb-1">Total Revenue</div>
                        <div className="text-2xl font-bold text-slate-900">{formatCurrency(paymentStats.totalRevenue, 0)}</div>
                      </div>
                      <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                        <div className="text-xs text-green-700 mb-1">Collected</div>
                        <div className="text-2xl font-bold text-green-900">{formatCurrency(paymentStats.totalPaid, 0)}</div>
                      </div>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <div className="text-xs text-amber-700 mb-1">Outstanding</div>
                        <div className="text-2xl font-bold text-amber-900">{formatCurrency(paymentStats.totalBalance, 0)}</div>
                      </div>
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                        <div className="text-xs text-blue-700 mb-1">Collection %</div>
                        <div className="text-2xl font-bold text-blue-900">{paymentStats.paidPercentage}%</div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'accounting' && paymentMethodStats && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Payment Status Distribution</div>
                      <div className="text-xs text-slate-500">Breakdown by payment completion</div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                        <div className="text-xs text-emerald-700 mb-2">Fully Paid</div>
                        <div className="text-3xl font-bold text-emerald-900 mb-1">{paymentMethodStats.fullyPaid}</div>
                        <div className="text-xs text-emerald-700">{((paymentMethodStats.fullyPaid / paymentMethodStats.total) * 100).toFixed(1)}% of total</div>
                      </div>
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                        <div className="text-xs text-blue-700 mb-2">Partially Paid</div>
                        <div className="text-3xl font-bold text-blue-900 mb-1">{paymentMethodStats.partiallyPaid}</div>
                        <div className="text-xs text-blue-700">{((paymentMethodStats.partiallyPaid / paymentMethodStats.total) * 100).toFixed(1)}% of total</div>
                      </div>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                        <div className="text-xs text-amber-700 mb-2">Unpaid</div>
                        <div className="text-3xl font-bold text-amber-900 mb-1">{paymentMethodStats.unpaid}</div>
                        <div className="text-xs text-amber-700">{((paymentMethodStats.unpaid / paymentMethodStats.total) * 100).toFixed(1)}% of total</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs text-slate-600 mb-2">Total Bookings</div>
                        <div className="text-3xl font-bold text-slate-900 mb-1">{paymentMethodStats.total}</div>
                        <div className="text-xs text-slate-600">Active reservations</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ACCOUNTING TAB - Refund Tracking */}
                {activeTab === 'accounting' && refundStats && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Refund & Cancellation Summary</div>
                      <div className="text-xs text-slate-500">Cancelled reservations with payment history</div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
                        <div className="text-xs text-rose-700 mb-2">Total Cancelled</div>
                        <div className="text-3xl font-bold text-rose-900 mb-1">{refundStats.totalCancelled}</div>
                        <div className="text-xs text-rose-700">Reservations</div>
                      </div>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                        <div className="text-xs text-amber-700 mb-2">Refunded Amount</div>
                        <div className="text-3xl font-bold text-amber-900">{formatCurrency(refundStats.refundedAmount, 0)}</div>
                        <div className="text-xs text-amber-700">Total refunds issued</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs text-slate-600 mb-2">Avg Refund</div>
                        <div className="text-3xl font-bold text-slate-900">{formatCurrency(refundStats.avgRefund, 0)}</div>
                        <div className="text-xs text-slate-600">Per cancellation</div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'accounting' && agingQuery.data && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Accounts Receivable Aging</div>
                      <div className="text-xs text-slate-500">Outstanding balances by age bucket</div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {Object.entries(agingQuery.data).map(([bucket, cents]) => {
                        const colorMap: Record<string, string> = {
                          'current': 'bg-green-50 border-green-200 text-green-900',
                          '1_30': 'bg-blue-50 border-blue-200 text-blue-900',
                          '31_60': 'bg-amber-50 border-amber-200 text-amber-900',
                          '61_90': 'bg-orange-50 border-orange-200 text-orange-900',
                          'over_90': 'bg-rose-50 border-rose-200 text-rose-900'
                        };
                        return (
                          <div key={bucket} className={`rounded-lg border p-3 ${colorMap[bucket] || 'bg-slate-50 border-slate-200'}`}>
                            <div className="text-xs mb-1 font-medium">{bucket.replace('_', '-').replace('over ', '90+ ')}</div>
                            <div className="text-2xl font-bold">{formatCurrency(cents / 100)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* AUDITS TAB */}
                {activeTab === 'audits' && dataQualityStats && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Data Quality Overview</div>
                      <div className="text-xs text-slate-500">Issues requiring attention</div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className={`rounded-lg border p-4 ${dataQualityStats.inactiveSites > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                        <div className="text-xs text-slate-700 mb-2">Inactive Sites</div>
                        <div className={`text-3xl font-bold mb-1 ${dataQualityStats.inactiveSites > 0 ? 'text-amber-900' : 'text-green-900'}`}>
                          {dataQualityStats.inactiveSites}
                        </div>
                        <div className="text-xs text-slate-600">No bookings in 1 year</div>
                      </div>
                      <div className={`rounded-lg border p-4 ${dataQualityStats.incompleteReservations > 0 ? 'bg-rose-50 border-rose-200' : 'bg-green-50 border-green-200'}`}>
                        <div className="text-xs text-slate-700 mb-2">Incomplete Data</div>
                        <div className={`text-3xl font-bold mb-1 ${dataQualityStats.incompleteReservations > 0 ? 'text-rose-900' : 'text-green-900'}`}>
                          {dataQualityStats.incompleteReservations}
                        </div>
                        <div className="text-xs text-slate-600">Missing critical fields</div>
                      </div>
                      <div className={`rounded-lg border p-4 ${dataQualityStats.futureUnpaid > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                        <div className="text-xs text-slate-700 mb-2">Future Unpaid</div>
                        <div className={`text-3xl font-bold mb-1 ${dataQualityStats.futureUnpaid > 0 ? 'text-amber-900' : 'text-green-900'}`}>
                          {dataQualityStats.futureUnpaid}
                        </div>
                        <div className="text-xs text-slate-600">Confirmed, no payment</div>
                      </div>
                      <div className={`rounded-lg border p-4 ${dataQualityStats.negativeBalance > 0 ? 'bg-rose-50 border-rose-200' : 'bg-green-50 border-green-200'}`}>
                        <div className="text-xs text-slate-700 mb-2">Negative Balance</div>
                        <div className={`text-3xl font-bold mb-1 ${dataQualityStats.negativeBalance > 0 ? 'text-rose-900' : 'text-green-900'}`}>
                          {dataQualityStats.negativeBalance}
                        </div>
                        <div className="text-xs text-slate-600">Overpayment issues</div>
                      </div>
                    </div>
                    <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700">
                      <span className="font-semibold">Health Score:</span> {
                        ((1 - ((dataQualityStats.inactiveSites + dataQualityStats.incompleteReservations + dataQualityStats.negativeBalance) /
                          (dataQualityStats.totalSites + dataQualityStats.totalReservations))) * 100).toFixed(1)
                      }% - {
                        ((1 - ((dataQualityStats.inactiveSites + dataQualityStats.incompleteReservations + dataQualityStats.negativeBalance) /
                          (dataQualityStats.totalSites + dataQualityStats.totalReservations))) * 100) >= 95 ? 'Excellent' :
                          ((1 - ((dataQualityStats.inactiveSites + dataQualityStats.incompleteReservations + dataQualityStats.negativeBalance) /
                            (dataQualityStats.totalSites + dataQualityStats.totalReservations))) * 100) >= 85 ? 'Good' :
                            ((1 - ((dataQualityStats.inactiveSites + dataQualityStats.incompleteReservations + dataQualityStats.negativeBalance) /
                              (dataQualityStats.totalSites + dataQualityStats.totalReservations))) * 100) >= 70 ? 'Fair' : 'Needs Attention'
                      }
                    </div>
                  </div>
                )}

                {/* AUDITS TAB - Rate Consistency Audit */}
                {activeTab === 'audits' && rateConsistencyStats && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Rate Consistency Audit</div>
                      <div className="text-xs text-slate-500">Pricing variance analysis across reservations</div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="text-xs text-slate-600 mb-1">Sites Checked</div>
                        <div className="text-2xl font-bold text-slate-900">{rateConsistencyStats.totalSitesChecked}</div>
                      </div>
                      <div className={`rounded-lg border p-3 ${rateConsistencyStats.inconsistentSites > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                        <div className={`text-xs mb-1 ${rateConsistencyStats.inconsistentSites > 0 ? 'text-amber-700' : 'text-green-700'}`}>Inconsistent Rates</div>
                        <div className={`text-2xl font-bold ${rateConsistencyStats.inconsistentSites > 0 ? 'text-amber-900' : 'text-green-900'}`}>
                          {rateConsistencyStats.inconsistentSites}
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs text-slate-600 mb-1">Variance Threshold</div>
                        <div className="text-2xl font-bold text-slate-900">&gt;20%</div>
                      </div>
                    </div>
                    {rateConsistencyStats.siteVariance.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-slate-700 mb-2 uppercase">Top Issues</div>
                        <div className="space-y-2">
                          {rateConsistencyStats.siteVariance.map((site) => (
                            <div key={site.siteName} className="rounded-md border border-amber-200 bg-amber-50 p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-sm font-medium text-slate-900">{site.siteName}</div>
                                <div className="text-sm font-bold text-amber-700">{site.variance.toFixed(1)}% variance</div>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <div className="text-slate-600">Min Rate</div>
                                  <div className="font-semibold text-slate-900">${site.minRate.toFixed(2)}/night</div>
                                </div>
                                <div>
                                  <div className="text-slate-600">Max Rate</div>
                                  <div className="font-semibold text-slate-900">${site.maxRate.toFixed(2)}/night</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {rateConsistencyStats.inconsistentSites === 0 && (
                      <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
                        <span className="font-semibold">All Clear!</span> No significant rate inconsistencies detected across your sites.
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'audits' && sitesQuery.data && (
                  <div className="card p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Inventory Audit</div>
                      <div className="text-xs text-slate-500">Site configuration summary</div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="text-xs text-slate-600 mb-1">Total Sites</div>
                        <div className="text-2xl font-bold text-slate-900">{sitesQuery.data.length}</div>
                      </div>
                      <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                        <div className="text-xs text-green-700 mb-1">Active</div>
                        <div className="text-2xl font-bold text-green-900">
                          {sitesQuery.data.filter(s => s.isActive).length}
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs text-slate-600 mb-1">Inactive</div>
                        <div className="text-2xl font-bold text-slate-900">
                          {sitesQuery.data.filter(s => !s.isActive).length}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            </>
          )}
        </div>
      </div>

      {/* Export Confirmation Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              Export Report
            </DialogTitle>
            <DialogDescription>
              Review what you're about to export
            </DialogDescription>
          </DialogHeader>

          {exportPreview && (
            <div className="space-y-4 py-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Report</span>
                  <span className="font-medium text-slate-900">{exportPreview.reportName}</span>
                </div>
                {exportPreview.subReportName && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">View</span>
                    <span className="font-medium text-slate-900">{exportPreview.subReportName}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" /> Date Range
                  </span>
                  <span className="font-medium text-slate-900">
                    {new Date(exportPreview.dateRange.start).toLocaleDateString()} — {new Date(exportPreview.dateRange.end).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Rows</span>
                  <span className="font-medium text-slate-900">~{exportPreview.rowCount.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-start gap-2 text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded-lg p-3">
                <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <span>
                  Reports are read-only views of your live data. To edit reservation or billing data,
                  use the <a href="/reservations" className="text-blue-600 underline">Reservations</a> or <a href="/billing" className="text-blue-600 underline">Billing</a> pages.
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (exportPreview) {
                  exportTabToCSV(exportPreview.tabName);
                  setShowExportDialog(false);
                  toast({
                    title: "Export started",
                    description: `Downloading ${exportPreview.reportName} report...`
                  });
                }
              }}
              className="flex items-center gap-2"
            >
              <FileDown className="h-4 w-4" />
              Download CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </DashboardShell>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-600">Loading reports…</div>}>
      <ReportsPageInner />
    </Suspense>
  );
}
