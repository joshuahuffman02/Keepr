"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "../../components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Checkbox } from "../../components/ui/checkbox";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { useToast } from "../../components/ui/use-toast";
import { HelpAnchor } from "../../components/help/HelpAnchor";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";
import { apiClient } from "../../lib/api-client";
import { saveReport, type SavedReport } from "@/components/reports/savedReports";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FileDown, Calendar, FileSpreadsheet, X, ChevronDown, ChevronUp, TrendingUp, Users, BarChart3, Megaphone, LineChart, Calculator, ClipboardList, ExternalLink, SlidersHorizontal, Filter } from "lucide-react";
import { SaveReportDialog } from "@/components/reports/SaveReportDialog";
import { SavedReportsDropdown } from "@/components/reports/SavedReportsDropdown";
import { ReportsNavBar } from "@/components/reports/ReportsNavBar";

import { BookingSourcesTab } from "../../components/reports/BookingSourcesTab";
import { GuestOriginsTab } from "../../components/reports/GuestOriginsTab";
import { HeatmapCard } from "../../components/reports/HeatmapCard";
import { resolvePoints } from "../../components/reports/heatmap-utils";
import { recordTelemetry } from "../../lib/sync-telemetry";

import { subTabs, type ReportTab } from "@/lib/report-registry";
import { OverviewReport } from "@/components/reports/definitions/OverviewReport";
import { ReportRenderer } from "@/components/reports/ReportRenderer";
import { ExportDialog } from "@/components/reports/ExportDialog";
import { useReportExport } from "@/components/reports/useReportExport";
import type { ExportFormat } from "@/lib/export-utils";
import { buildReportHref } from "@/lib/report-links";

// Type definitions for entities with populated relations
type SiteWithClass = {
  id: string;
  siteType: string;
  siteClass?: { id: string; name: string } | null;
  latitude?: number | null;
  longitude?: number | null;
  [key: string]: unknown;
};

interface CreatePricingRulePayload {
  label: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  ruleType: "flat" | "percent" | "dow";
  flatAdjust?: number;
  percentAdjust?: number;
  dayOfWeek?: number;
  siteClassId?: string;
  siteId?: string;
}

type ReservationWithGuest = {
  id: string;
  status: string;
  siteId: string;
  guestId?: string;
  guest?: { primaryFirstName: string; primaryLastName: string } | null;
  partySize?: number;
  numberOfGuests?: number;
  adults?: number;
  children?: number;
  arrivalDate: string;
  departureDate: string;
  [key: string]: unknown;
};

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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("overview");
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
  const [activePreset, setActivePreset] = useState<string | null>(null);
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

  // Report customization/filter state
  const [showFilters, setShowFilters] = useState(false);
  const [reportFilters, setReportFilters] = useState({
    status: 'all' as 'all' | 'confirmed' | 'checked_in' | 'pending' | 'cancelled',
    siteType: 'all' as string,
    groupBy: 'none' as 'none' | 'site' | 'status' | 'date' | 'siteType'
  });

  // Save report dialog state
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Initialize export hook
  const { exportReport } = useReportExport(campgroundId, dateRange);

  const reportNavHref = (tab: string, subTab?: string | null) =>
    buildReportHref({
      tab,
      subTab,
      dateRange,
      filters: reportFilters
    });

  const reportNavLinks = useMemo(() => ([
    { label: "Saved", href: "/reports/saved", active: pathname === "/reports/saved" },
    { label: "Portfolio", href: "/reports/portfolio", active: pathname?.startsWith("/reports/portfolio") },
    { label: "Devices", href: "/reports/devices", active: pathname?.startsWith("/reports/devices") }
  ]), [pathname]);

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
    const urlStatus = searchParams.get("status");
    const urlSiteType = searchParams.get("siteType");
    const urlGroupBy = searchParams.get("groupBy");
    if (urlStatus || urlSiteType || urlGroupBy) {
      setReportFilters((prev) => ({
        status: (urlStatus || prev.status) as 'all' | 'confirmed' | 'checked_in' | 'pending' | 'cancelled',
        siteType: (urlSiteType || prev.siteType) as string,
        groupBy: (urlGroupBy || prev.groupBy) as 'none' | 'site' | 'status' | 'date' | 'siteType'
      }));
      setShowFilters(true);
    }
  }, [searchParams]);

  const enableAnalyticsMaps = process.env.NEXT_PUBLIC_ENABLE_ANALYTICS_MAPS !== "false";

  // Ensure sub-tab defaults to first available for the active tab
  useEffect(() => {
    if (activeTab === 'overview') {
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
        const guest = `"${(r as ReservationWithGuest).guest?.primaryFirstName || ''} ${(r as ReservationWithGuest).guest?.primaryLastName || ''}".trim()`;
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
      <div className="rounded-lg border border-border bg-card shadow-sm p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-foreground">{meta?.label || "Report"}</div>
            <div className="text-xs text-muted-foreground">{meta?.description || "Summary will appear when data is available."}</div>
          </div>
          <div className="text-xs text-muted-foreground">{dateRange.start} → {dateRange.end}</div>
        </div>
        <div className="rounded-md border border-dashed border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
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
              <div className="text-sm text-muted-foreground">GL net for {drText}</div>
              <div className="space-y-2">
                {ledgerSummaryQuery.data.map((row) => (
                  <div key={row.glCode} className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2 text-sm">
                    <span className="text-foreground">{row.glCode}</span>
                    <span className="font-semibold text-foreground">{formatCurrency(row.netCents / 100)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        if (reservationStats) {
          return (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">Daily summary for {drText}</div>
              {pickupStats && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-status-success/20 bg-status-success/10 p-3 shadow-inner">
                    <div className="text-xs text-status-success mb-1">Bookings (last 7d)</div>
                    <div className="text-2xl font-bold text-status-success">{pickupStats.w7.current.count}</div>
                    <div className="text-sm text-status-success">Rev: {formatCurrency(pickupStats.w7.current.revenue, 0)}</div>
                    <div className="text-xs text-status-success">Occ: {((pickupStats.w7.current.count / pickupStats.activeSitesCount) * 100).toFixed(1)}%</div>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
                    <div className="text-xs text-muted-foreground mb-1">vs prior 7d</div>
                    <div className={`text-xl font-bold ${pickupStats.w7.countDelta >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                      {pickupStats.w7.countDelta >= 0 ? '+' : ''}{pickupStats.w7.countDelta} bookings
                    </div>
                    <div className={`text-sm ${pickupStats.w7.revenueDelta >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                      {pickupStats.w7.revenueDelta >= 0 ? '+' : ''}{formatCurrency(pickupStats.w7.revenueDelta, 0)} revenue
                    </div>
                  </div>
                  <div className="rounded-lg border border-primary/20 bg-primary/10 p-3 shadow-inner">
                    <div className="text-xs text-primary mb-1">Future bookings (count)</div>
                    <div className="text-2xl font-bold text-primary">{futureRevenue?.count ?? 0}</div>
                    <div className="text-sm text-primary">Outstanding: {formatCurrency(futureRevenue?.outstanding ?? 0, 0)}</div>
                  </div>
                </div>
              )}
              {pickupStats && (
                <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Window</th>
                        <th className="px-3 py-2 text-left">Bookings</th>
                        <th className="px-3 py-2 text-left">Revenue</th>
                        <th className="px-3 py-2 text-left">Delta (bookings)</th>
                        <th className="px-3 py-2 text-left">Delta (revenue)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {[
                        { label: 'Last 7d', data: pickupStats.w7 },
                        { label: 'Last 30d', data: pickupStats.w30 },
                        { label: 'Last 90d', data: pickupStats.w90 },
                      ].map((row) => (
                        <tr key={row.label}>
                          <td className="px-3 py-2 font-medium text-foreground">{row.label}</td>
                          <td className="px-3 py-2 text-foreground">{row.data.current.count}</td>
                          <td className="px-3 py-2 text-foreground">{formatCurrency(row.data.current.revenue, 0)}</td>
                          <td className={`px-3 py-2 ${row.data.countDelta >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                            {row.data.countDelta >= 0 ? '+' : ''}{row.data.countDelta}
                          </td>
                          <td className={`px-3 py-2 ${row.data.revenueDelta >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                            {row.data.revenueDelta >= 0 ? '+' : ''}{formatCurrency(row.data.revenueDelta, 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-status-success/20 bg-status-success/10 p-3">
                  <div className="text-xs text-status-success mb-1">Total</div>
                  <div className="text-2xl font-bold text-status-success">{reservationStats.total}</div>
                </div>
                <div className="rounded-lg border border-border bg-muted p-3">
                  <div className="text-xs text-muted-foreground mb-1">Revenue</div>
                  <div className="text-2xl font-bold text-foreground">{formatCurrency(reservationStats.totalRevenue, 0)}</div>
                </div>
                <div className="rounded-lg border border-primary/20 bg-primary/10 p-3">
                  <div className="text-xs text-primary mb-1">Avg Lead Time</div>
                  <div className="text-2xl font-bold text-primary">{reservationStats.avgLeadTime}d</div>
                </div>
                <div className="rounded-lg border border-status-warning/20 bg-status-warning/10 p-3">
                  <div className="text-xs text-status-warning mb-1">Cancelled</div>
                  <div className="text-2xl font-bold text-status-warning">{reservationStats.byStatus['cancelled'] || 0}</div>
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
                  <div className="text-sm font-semibold text-foreground">Revenue by source</div>
                  <div className="text-xs text-muted-foreground">Channel mix and revenue share</div>
                </div>
                <div className="text-xs text-muted-foreground">{drText}</div>
              </div>
              <div className="rounded-xl border border-border bg-card shadow-sm p-3">
                <BookingSourcesTab campgroundId={campgroundId} dateRange={dateRange} />
              </div>
            </div>
          );
        }
        if (summaryQuery.data) {
          return (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">Revenue overview for {drText}</div>
              {pickupStats && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-status-success/20 bg-status-success/10 p-3 shadow-inner">
                    <div className="text-xs text-status-success mb-1">Bookings (last 7d)</div>
                    <div className="text-2xl font-bold text-status-success">{pickupStats.w7.current.count}</div>
                    <div className="text-sm text-status-success">Rev: {formatCurrency(pickupStats.w7.current.revenue, 0)}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
                    <div className="text-xs text-muted-foreground mb-1">vs prior 7d</div>
                    <div className={`text-xl font-bold ${pickupStats.w7.countDelta >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                      {pickupStats.w7.countDelta >= 0 ? '+' : ''}{pickupStats.w7.countDelta} bookings
                    </div>
                    <div className={`text-sm ${pickupStats.w7.revenueDelta >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                      {pickupStats.w7.revenueDelta >= 0 ? '+' : ''}{formatCurrency(pickupStats.w7.revenueDelta, 0)} revenue
                    </div>
                  </div>
                  <div className="rounded-lg border border-primary/20 bg-primary/10 p-3 shadow-inner">
                    <div className="text-xs text-primary mb-1">Future bookings (count)</div>
                    <div className="text-2xl font-bold text-primary">{futureRevenue?.count ?? 0}</div>
                    <div className="text-sm text-primary">Outstanding: {formatCurrency(futureRevenue?.outstanding ?? 0, 0)}</div>
                  </div>
                </div>
              )}
              {pickupStats && (
                <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Window</th>
                        <th className="px-3 py-2 text-left">Bookings</th>
                        <th className="px-3 py-2 text-left">Revenue</th>
                        <th className="px-3 py-2 text-left">Delta (bookings)</th>
                        <th className="px-3 py-2 text-left">Delta (revenue)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {[
                        { label: 'Last 7d', data: pickupStats.w7 },
                        { label: 'Last 30d', data: pickupStats.w30 },
                        { label: 'Last 90d', data: pickupStats.w90 },
                      ].map((row) => (
                        <tr key={row.label}>
                          <td className="px-3 py-2 font-medium text-foreground">{row.label}</td>
                          <td className="px-3 py-2 text-foreground">{row.data.current.count}</td>
                          <td className="px-3 py-2 text-foreground">{formatCurrency(row.data.current.revenue, 0)}</td>
                          <td className={`px-3 py-2 ${row.data.countDelta >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                            {row.data.countDelta >= 0 ? '+' : ''}{row.data.countDelta}
                          </td>
                          <td className={`px-3 py-2 ${row.data.revenueDelta >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                            {row.data.revenueDelta >= 0 ? '+' : ''}{formatCurrency(row.data.revenueDelta, 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-status-success/20 bg-status-success/10 p-3">
                  <div className="text-xs text-status-success mb-1">Revenue (30d)</div>
                  <div className="text-2xl font-bold text-status-success">{formatCurrency(summaryQuery.data.revenue)}</div>
                </div>
                <div className="rounded-lg border border-primary/20 bg-primary/10 p-3">
                  <div className="text-xs text-primary mb-1">ADR</div>
                  <div className="text-2xl font-bold text-primary">{formatCurrency(summaryQuery.data.adr)}</div>
                </div>
                <div className="rounded-lg border border-border bg-muted p-3">
                  <div className="text-xs text-muted-foreground mb-1">RevPAR</div>
                  <div className="text-2xl font-bold text-foreground">{formatCurrency(summaryQuery.data.revpar)}</div>
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
              siteClass: (site as SiteWithClass).siteClass?.name || 'N/A',
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
            setActivePreset(preset);
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
                <span className="text-sm text-muted-foreground">Date range:</span>
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
                      type="button"
                      className="px-2 py-1 text-xs rounded-md border border-border bg-card hover:bg-muted text-foreground"
                      aria-pressed={activePreset === preset.value}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => {
                    setActivePreset(null);
                    setDateRange(prev => ({ ...prev, start: e.target.value }));
                  }}
                  className="px-2 py-1 text-xs rounded-md border border-border"
                  aria-label="Start date"
                />
                <span className="text-muted-foreground">→</span>
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => {
                    setActivePreset(null);
                    setDateRange(prev => ({ ...prev, end: e.target.value }));
                  }}
                  className="px-2 py-1 text-xs rounded-md border border-border"
                  aria-label="End date"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-status-success/20 bg-status-success/10 p-3">
                  <div className="text-xs text-status-success mb-1">Total Revenue</div>
                  <div className="text-2xl font-bold text-status-success">{formatCurrency(totals.revenue)}</div>
                </div>
                <div className="rounded-lg border border-primary/20 bg-primary/10 p-3">
                  <div className="text-xs text-primary mb-1">Bookings</div>
                  <div className="text-2xl font-bold text-primary">{totals.bookings}</div>
                </div>
                <div className="rounded-lg border border-primary/20 bg-primary/10 p-3">
                  <div className="text-xs text-primary mb-1">Nights Booked</div>
                  <div className="text-2xl font-bold text-primary">{totals.nights}</div>
                </div>
                <div className="rounded-lg border border-border bg-muted p-3">
                  <div className="text-xs text-muted-foreground mb-1">Avg Occupancy</div>
                  <div className="text-2xl font-bold text-foreground">
                    {sitesQuery.data.length > 0 ? ((totals.nights / (sitesQuery.data.length * totalDays)) * 100).toFixed(1) : 0}%
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted text-xs uppercase text-muted-foreground">
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
                  <tbody className="divide-y divide-border">
                    {siteMetrics.map((site: any) => (
                      <tr key={site.id} className="hover:bg-muted">
                        <td className="px-3 py-2 font-medium text-foreground">{site.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{site.siteClass}</td>
                        <td className="px-3 py-2 text-right text-foreground">{site.bookings}</td>
                        <td className="px-3 py-2 text-right text-foreground">{site.nights}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{site.available}</td>
                        <td className="px-3 py-2 text-right">
                          <span className={`font-medium ${Number(site.occupancy) >= 70 ? 'text-status-success' : Number(site.occupancy) >= 40 ? 'text-status-warning' : 'text-status-error'}`}>
                            {site.occupancy}%
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-foreground">{formatCurrency(site.revenue)}</td>
                        <td className="px-3 py-2 text-right text-foreground">{formatCurrency(site.adr)}</td>
                        <td className="px-3 py-2 text-right text-foreground">{formatCurrency(site.revpar)}</td>
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
              <div className="text-sm text-muted-foreground">Occupancy & ADR trend (last 12 months)</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-sm">
                {revenueTrends.map((r) => (
                  <div key={r.month} className="rounded-lg border border-border bg-muted px-3 py-2">
                    <div className="text-xs text-muted-foreground">{r.month}</div>
                    <div className="font-semibold text-foreground">{formatCurrency(r.revenue, 0)}</div>
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
              <div className="text-sm text-muted-foreground">Guest behavior</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-status-success/20 bg-status-success/10 p-3">
                  <div className="text-xs text-status-success mb-1">Total</div>
                  <div className="text-2xl font-bold text-status-success">{reservationStats?.total ?? 0}</div>
                </div>
                <div className="rounded-lg border border-status-warning/20 bg-status-warning/10 p-3">
                  <div className="text-xs text-status-warning mb-1">Cancelled</div>
                  <div className="text-2xl font-bold text-status-warning">{cancellationStats.total}</div>
                </div>
                <div className="rounded-lg border border-primary/20 bg-primary/10 p-3">
                  <div className="text-xs text-primary mb-1">Avg Lead Time</div>
                  <div className="text-2xl font-bold text-primary">{reservationStats?.avgLeadTime ?? 0}d</div>
                </div>
                <div className="rounded-lg border border-border bg-muted p-3">
                  <div className="text-xs text-muted-foreground mb-1">Cancel Rate</div>
                  <div className="text-2xl font-bold text-foreground">{Number(cancellationStats.rate).toFixed(1)}%</div>
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
                  <div className="text-sm font-semibold text-foreground">Channel mix</div>
                  <div className="text-xs text-muted-foreground">Online, phone, OTA performance</div>
                </div>
                <div className="text-xs text-muted-foreground">{drText}</div>
              </div>
              <div className="rounded-xl border border-border bg-card shadow-sm p-3">
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
              <div className="text-sm font-semibold text-foreground">Promo performance</div>
              <div className="text-xs text-muted-foreground">
                Live promo codes with usage and validity. Redemptions respect the page date range ({dateRange.start} → {dateRange.end}).
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  id="show-active-promos"
                  checked={showActivePromos}
                  onCheckedChange={(checked) => setShowActivePromos(Boolean(checked))}
                />
                <Label htmlFor="show-active-promos">Show active only</Label>
              </div>

              {promotionsQuery.isLoading ? (
                <div className="text-sm text-muted-foreground">Loading promotions…</div>
              ) : promotionsQuery.isError ? (
                <div className="text-sm text-status-error">Failed to load promotions.</div>
              ) : filteredPromos.length === 0 ? (
                <div className="rounded-lg border border-border bg-card px-3 py-3 text-sm text-foreground">
                  No promotions yet. Create promo codes in Settings → Promotions.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    <div className="rounded-lg border border-border bg-card p-3">
                      <div className="text-xs text-muted-foreground">Active promos</div>
                      <div className="text-xl font-semibold text-foreground">{activePromos} / {promos.length}</div>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <div className="text-xs text-muted-foreground">Total uses</div>
                      <div className="text-xl font-semibold text-foreground">{totalUses}</div>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <div className="text-xs text-muted-foreground">Most recent</div>
                      <div className="text-xs text-foreground">
                        {promos.slice(0, 1).map((p) => (
                          <span key={p.id} className="font-mono">{p.code}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-border bg-card">
                    <table className="min-w-full text-sm">
                      <thead className="bg-muted text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left">Code</th>
                          <th className="px-3 py-2 text-left">Value</th>
                          <th className="px-3 py-2 text-left">Usage</th>
                          <th className="px-3 py-2 text-left">Valid</th>
                          <th className="px-3 py-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
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
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${p.isActive ? "bg-status-success-bg text-status-success-text" : "bg-muted text-muted-foreground"}`}>
                                {p.isActive ? "Active" : "Inactive"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-foreground">Redemptions (bookings)</div>
                    {promotionsQuery.isLoading ? (
                      <div className="text-sm text-muted-foreground">Loading redemptions…</div>
                    ) : !hasRedemptions ? (
                      <div className="rounded-lg border border-border bg-muted px-3 py-3 text-sm text-foreground">
                        No promo redemptions yet. Codes will appear here once used in bookings.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-border bg-card">
                        <table className="min-w-full text-sm">
                          <thead className="bg-muted text-xs uppercase text-muted-foreground">
                            <tr>
                              <th className="px-3 py-2 text-left">Code</th>
                              <th className="px-3 py-2 text-left">Bookings</th>
                              <th className="px-3 py-2 text-left">Revenue</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
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
                  <div className="text-sm font-semibold text-foreground">Demand outlook</div>
                  <div className="text-xs text-muted-foreground">Recent pickup as proxy for future demand</div>
                </div>
                <div className="text-xs text-muted-foreground">{drText}</div>
              </div>
              {pickupStats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-status-success/20 bg-status-success/10 p-3 shadow-inner">
                    <div className="text-xs text-status-success mb-1">Bookings (last 7d)</div>
                    <div className="text-2xl font-bold text-status-success">{pickupStats.w7.current.count}</div>
                    <div className="text-sm text-status-success">Rev: {formatCurrency(pickupStats.w7.current.revenue, 0)}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
                    <div className="text-xs text-muted-foreground mb-1">vs prior 7d</div>
                    <div className={`text-xl font-bold ${pickupStats.w7.countDelta >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                      {pickupStats.w7.countDelta >= 0 ? '+' : ''}{pickupStats.w7.countDelta} bookings
                    </div>
                    <div className={`text-sm ${pickupStats.w7.revenueDelta >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                      {pickupStats.w7.revenueDelta >= 0 ? '+' : ''}{formatCurrency(pickupStats.w7.revenueDelta, 0)} revenue
                    </div>
                  </div>
                </div>
              )}
              {pickupStats && (
                <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Window</th>
                        <th className="px-3 py-2 text-left">Bookings</th>
                        <th className="px-3 py-2 text-left">Revenue</th>
                        <th className="px-3 py-2 text-left">Delta (bookings)</th>
                        <th className="px-3 py-2 text-left">Delta (revenue)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {[
                        { label: 'Last 7d', data: pickupStats.w7 },
                        { label: 'Last 30d', data: pickupStats.w30 },
                        { label: 'Last 90d', data: pickupStats.w90 },
                      ].map((row) => (
                        <tr key={row.label}>
                          <td className="px-3 py-2 font-medium text-foreground">{row.label}</td>
                          <td className="px-3 py-2 text-foreground">{row.data.current.count}</td>
                          <td className="px-3 py-2 text-foreground">{formatCurrency(row.data.current.revenue, 0)}</td>
                          <td className={`px-3 py-2 ${row.data.countDelta >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                            {row.data.countDelta >= 0 ? '+' : ''}{row.data.countDelta}
                          </td>
                          <td className={`px-3 py-2 ${row.data.revenueDelta >= 0 ? 'text-status-success' : 'text-status-error'}`}>
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
                  <div key={r.month} className="rounded-lg border border-border bg-muted px-3 py-2">
                    <div className="text-xs text-muted-foreground">{r.month}</div>
                    <div className="font-semibold text-foreground">{formatCurrency(r.revenue, 0)}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        if (activeSubTab === 'pickup') {
          return (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card shadow-sm p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="pickup-comparison-a" className="text-xs font-medium text-muted-foreground">Comparison Date A</Label>
                    <Input
                      id="pickup-comparison-a"
                      type="date"
                      value={pickupFilters.comparisonA}
                      onChange={(e) => setPickupFilters((prev) => ({ ...prev, comparisonA: e.target.value }))}
                      className="w-full rounded-md border border-border px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="pickup-comparison-b" className="text-xs font-medium text-muted-foreground">Comparison Date B</Label>
                    <Input
                      id="pickup-comparison-b"
                      type="date"
                      value={pickupFilters.comparisonB}
                      onChange={(e) => setPickupFilters((prev) => ({ ...prev, comparisonB: e.target.value }))}
                      className="w-full rounded-md border border-border px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="pickup-occupancy-start" className="text-xs font-medium text-muted-foreground">Show occupancy starting on</Label>
                    <Input
                      id="pickup-occupancy-start"
                      type="date"
                      value={pickupFilters.occupancyStart}
                      onChange={(e) => setPickupFilters((prev) => ({ ...prev, occupancyStart: e.target.value }))}
                      className="w-full rounded-md border border-border px-2 py-1 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="pickup-interval" className="text-xs font-medium text-muted-foreground">Interval</Label>
                    <Select
                      value={pickupFilters.interval}
                      onValueChange={(value) => setPickupFilters((prev) => ({ ...prev, interval: value as 'weekly' | 'daily' }))}
                    >
                      <SelectTrigger id="pickup-interval" className="w-full h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="pickup-include" className="text-xs font-medium text-muted-foreground">Include reservations</Label>
                    <Select
                      value={pickupFilters.include}
                      onValueChange={(value) => setPickupFilters((prev) => ({ ...prev, include: value as 'all' | 'confirmed' | 'paid' }))}
                    >
                      <SelectTrigger id="pickup-include" className="w-full h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All future occupancy</SelectItem>
                        <SelectItem value="confirmed">Confirmed / pending only</SelectItem>
                        <SelectItem value="paid">Paid only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="pickup-site-class" className="text-xs font-medium text-muted-foreground">Site class</Label>
                    <Select
                      value={pickupFilters.siteClassId}
                      onValueChange={(value) => setPickupFilters((prev) => ({ ...prev, siteClassId: value }))}
                    >
                      <SelectTrigger id="pickup-site-class" className="w-full h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All sites</SelectItem>
                        {sitesQuery.data?.map((s) => (s as SiteWithClass)?.siteClass?.id ? (s as SiteWithClass).siteClass : null)
                          ?.filter(Boolean)
                          ?.reduce((acc: any[], sc: any) => {
                            if (!acc.find((x) => x.id === sc.id)) acc.push(sc);
                            return acc;
                          }, [])
                          ?.map((sc: any) => (
                            <SelectItem key={sc.id} value={sc.id}>{sc.name}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="activity-only"
                      checked={pickupFilters.activityOnly}
                      onCheckedChange={(checked) => setPickupFilters((prev) => ({ ...prev, activityOnly: Boolean(checked) }))}
                    />
                    <Label htmlFor="activity-only" className="text-sm text-foreground">Only show dates with activity</Label>
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
                      <div key={row.label} className="rounded-lg border border-border bg-card shadow-sm p-3">
                        <div className="text-xs text-muted-foreground mb-1">{row.label}</div>
                        <div className="text-2xl font-bold text-foreground">{row.data.current.count} bookings</div>
                        <div className="text-sm text-foreground">Rev: {formatCurrency(row.data.current.revenue, 0)}</div>
                        <div className="text-sm text-muted-foreground">Occ: {((row.data.current.count / pickupStats.activeSitesCount) * 100).toFixed(1)}%</div>
                        <div className={`text-sm mt-1 ${row.data.countDelta >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                          Δ bookings: {row.data.countDelta >= 0 ? '+' : ''}{row.data.countDelta}
                        </div>
                        <div className={`text-sm ${row.data.revenueDelta >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                          Δ revenue: {row.data.revenueDelta >= 0 ? '+' : ''}{formatCurrency(row.data.revenueDelta, 0)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
                    <table className="min-w-full text-sm">
                      <thead className="bg-muted text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left">Window</th>
                          <th className="px-3 py-2 text-left">Bookings</th>
                          <th className="px-3 py-2 text-left">Revenue</th>
                          <th className="px-3 py-2 text-left">Occ %</th>
                          <th className="px-3 py-2 text-left">Delta (bookings)</th>
                          <th className="px-3 py-2 text-left">Delta (revenue)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
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
                              <td className="px-3 py-2 font-medium text-foreground">{row.label}</td>
                              <td className="px-3 py-2 text-foreground">{row.data.current.count}</td>
                              <td className="px-3 py-2 text-foreground">{formatCurrency(row.data.current.revenue, 0)}</td>
                              <td className="px-3 py-2 text-foreground">{((row.data.current.count / pickupStats.activeSitesCount) * 100).toFixed(1)}%</td>
                              <td className={`px-3 py-2 ${row.data.countDelta >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                                {row.data.countDelta >= 0 ? '+' : ''}{row.data.countDelta}
                              </td>
                              <td className={`px-3 py-2 ${row.data.revenueDelta >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                                {row.data.revenueDelta >= 0 ? '+' : ''}{formatCurrency(row.data.revenueDelta, 0)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No pickup data available.</div>
              )}
            </div>
          );
        }
        if (revenueTrends) {
          return (
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="font-semibold text-foreground">Forecasting</div>
              <div>Simple projection based on last 12 months revenue.</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-sm">
                {revenueTrends.map((r) => (
                  <div key={r.month} className="rounded-lg border border-border bg-muted px-3 py-2">
                    <div className="text-xs text-muted-foreground">{r.month}</div>
                    <div className="font-semibold text-foreground">{formatCurrency(r.revenue, 0)}</div>
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
                <div className="text-sm text-muted-foreground">Aging buckets</div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => exportTabToCSV('accounting')}>Export buckets</Button>
                  <Button variant="secondary" size="sm" onClick={exportAgingDetailCsv}>Export aging detail</Button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(agingQuery.data).map(([bucket, cents]) => (
                  <div key={bucket} className="rounded-lg border border-border bg-muted px-3 py-2 text-sm shadow-inner">
                    <div className="text-[11px] uppercase text-muted-foreground font-semibold">{bucket.replace("_", "-")}</div>
                    <div className="font-semibold text-foreground">{formatCurrency(cents / 100)}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        if (activeSubTab === 'ledger' && ledgerSummaryQuery.data) {
          return (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">Ledger summary</div>
              <div className="space-y-2">
                {ledgerSummaryQuery.data.map((row) => (
                  <div key={row.glCode} className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2 text-sm">
                    <span className="text-foreground">{row.glCode}</span>
                    <span className="font-semibold text-foreground">{formatCurrency(row.netCents / 100)}</span>
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
        const className = (site as SiteWithClass)?.siteClass?.name ?? site?.siteType ?? "Unknown";
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
        const scId = (site as SiteWithClass)?.siteClass?.id;
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
      if (r.status !== 'cancelled' && (r as ReservationWithGuest).guest) {
        const guestId = (r as ReservationWithGuest).guestId;
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
      const className = (site as SiteWithClass)?.siteClass?.name ?? site.siteType ?? "Unknown";
      if (!classData[className]) {
        classData[className] = { nights: 0, sites: 0 };
      }
      classData[className].sites++;
    });

    // Calculate nights booked
    reservationsQuery.data.forEach(r => {
      if (r.status !== 'cancelled') {
        const site = siteMap.get(r.siteId);
        const className = (site as SiteWithClass)?.siteClass?.name ?? site?.siteType ?? "Unknown";
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
      if (r.status !== 'cancelled' && (r as ReservationWithGuest).guest) {
        const guestId = (r as ReservationWithGuest).guestId;
        const guest = (r as ReservationWithGuest).guest;
        const name = `${guest?.primaryFirstName || ''} ${guest?.primaryLastName || ''}`.trim() || 'Unknown';

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
      const latitude = (s as SiteWithClass)?.latitude !== undefined && (s as SiteWithClass)?.latitude !== null ? Number((s as SiteWithClass).latitude) : null;
      const longitude = (s as SiteWithClass)?.longitude !== undefined && (s as SiteWithClass)?.longitude !== null ? Number((s as SiteWithClass).longitude) : null;
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
    if (!reservationsQuery.data || !sitesQuery.data) return null;

    const siteMap = new Map(sitesQuery.data.map(s => [s.id, s]));

    const filteredData = reservationsQuery.data.filter(r => {
      // Apply customizations
      if (reportFilters.status !== 'all' && r.status !== reportFilters.status) return false;
      if (reportFilters.siteType !== 'all') {
        const site = siteMap.get(r.siteId);
        if (site && (site as SiteWithClass).siteType !== reportFilters.siteType) return false;
      }
      return true;
    });

    const total = filteredData.length;
    const confirmed = filteredData.filter(r => r.status === 'confirmed').length;
    const pending = filteredData.filter(r => r.status === 'pending').length;
    const cancelled = filteredData.filter(r => r.status === 'cancelled').length;

    const conversionRate = total > 0 ? (((confirmed + pending) / total) * 100).toFixed(1) : '0';

    const totalValue = filteredData
      .filter(r => r.status !== 'cancelled')
      .reduce((sum, r) => sum + (r.totalAmount || 0), 0) / 100;

    // Average value
    const avgValue = (confirmed + pending) > 0 ? (totalValue / (confirmed + pending)) : 0;

    return {
      conversionRate,
      totalValue,
      avgBookingValue: avgValue,
      totalBookings: confirmed + pending,
      total,
      confirmed,
      pending,
      cancelled
    };
  }, [reservationsQuery.data, sitesQuery.data, reportFilters]);

  // Year-over-year comparison


  // Pricing analysis by site class
  const pricingAnalysis = useMemo(() => {
    if (!reservationsQuery.data || !sitesQuery.data) return null;

    const siteMap = new Map(sitesQuery.data.map(s => [s.id, s]));
    const classData: Record<string, { revenue: number; nights: number }> = {};

    reservationsQuery.data.forEach(r => {
      if (r.status !== 'cancelled') {
        const site = siteMap.get(r.siteId);
        const className = (site as SiteWithClass)?.siteClass?.name ?? site?.siteType ?? "Unknown";
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
        const partySize = (r as ReservationWithGuest).partySize || (r as ReservationWithGuest).numberOfGuests || 2; // Default to 2 if not available
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
        const dayMatches = arrival >= today && arrival < tomorrow;
        if (!dayMatches) return false;

        // Apply customizations
        if (reportFilters.status !== 'all' && r.status !== reportFilters.status) return false;
        if (reportFilters.siteType !== 'all') {
          const site = siteMap.get(r.siteId);
          // Safely access siteType if it exists
          if (site && (site as SiteWithClass).siteType !== reportFilters.siteType) return false;
        }

        return r.status !== 'cancelled'; // Always exclude cancelled unless specifically asked? Or should filter handle it?
      })
      .map(r => ({
        ...r,
        siteName: siteMap.get(r.siteId)?.name || r.siteId,
        siteType: (siteMap.get(r.siteId) as SiteWithClass | undefined)?.siteType || 'Unknown',
        guestName: `${(r as ReservationWithGuest).guest?.primaryFirstName || ''} ${(r as ReservationWithGuest).guest?.primaryLastName || ''}`.trim() || 'N/A'
      }))
      .sort((a, b) => {
        if (reportFilters.groupBy === 'status') return a.status.localeCompare(b.status);
        if (reportFilters.groupBy === 'siteType') return a.siteType.localeCompare(b.siteType);
        return a.siteName.localeCompare(b.siteName);
      });
  }, [reservationsQuery.data, sitesQuery.data, reportFilters]);

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
        const dayMatches = departure >= today && departure < tomorrow;
        if (!dayMatches) return false;

        // Apply customizations
        if (reportFilters.status !== 'all' && r.status !== reportFilters.status) return false;
        if (reportFilters.siteType !== 'all') {
          const site = siteMap.get(r.siteId);
          if (site && (site as SiteWithClass).siteType !== reportFilters.siteType) return false;
        }

        return r.status !== 'cancelled';
      })
      .map(r => ({
        ...r,
        siteName: siteMap.get(r.siteId)?.name || r.siteId,
        siteType: (siteMap.get(r.siteId) as SiteWithClass | undefined)?.siteType || 'Unknown',
        guestName: `${(r as ReservationWithGuest).guest?.primaryFirstName || ''} ${(r as ReservationWithGuest).guest?.primaryLastName || ''}`.trim() || 'N/A'
      }))
      .sort((a, b) => a.siteName.localeCompare(b.siteName));
  }, [reservationsQuery.data, sitesQuery.data, reportFilters]);

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
        guestName: `${(r as ReservationWithGuest).guest?.primaryFirstName || ''} ${(r as ReservationWithGuest).guest?.primaryLastName || ''}`.trim() || 'N/A',
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
        guestName: `${(r as ReservationWithGuest).guest?.primaryFirstName || ''} ${(r as ReservationWithGuest).guest?.primaryLastName || ''}`.trim() || 'N/A'
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
        guestName: `${(r as ReservationWithGuest).guest?.primaryFirstName || ''} ${(r as ReservationWithGuest).guest?.primaryLastName || ''}`.trim() || 'N/A'
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
        guestName: `${(r as ReservationWithGuest).guest?.primaryFirstName || ''} ${(r as ReservationWithGuest).guest?.primaryLastName || ''}`.trim() || 'N/A',
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
      className: (site as SiteWithClass)?.siteClass?.name || site.siteType || 'N/A',
      status: !site.isActive ? 'Inactive' : occupiedSites.has(site.id) ? 'Occupied' : 'Available',
      isActive: site.isActive
    }));
  }, [reservationsQuery.data, sitesQuery.data]);

  // Transaction log (financial activity)
  const transactionLog = useMemo(() => {
    if (!reservationsQuery.data || !sitesQuery.data) return null;

    const siteMap = new Map(sitesQuery.data.map(s => [s.id, s]));

    return reservationsQuery.data
      .filter(r => {
        // Base filter
        if (r.status === 'cancelled' && (r.paidAmount || 0) === 0 && (r.totalAmount || 0) === 0) return false;
        if (!((r.paidAmount || 0) > 0 || (r.totalAmount || 0) > 0)) return false;

        // Apply customizations
        if (reportFilters.siteType !== 'all') {
          const site = siteMap.get(r.siteId);
          if (site && (site as SiteWithClass).siteType !== reportFilters.siteType) return false;
        }
        // Optional: filter by reservation status if requested, though transactions exist independent of status
        if (reportFilters.status !== 'all' && r.status !== reportFilters.status) return false;

        return true;
      })
      .map(r => ({
        ...r,
        siteName: siteMap.get(r.siteId)?.name || r.siteId,
        siteType: (siteMap.get(r.siteId) as SiteWithClass | undefined)?.siteType || 'Unknown',
        guestName: `${(r as ReservationWithGuest).guest?.primaryFirstName || ''} ${(r as ReservationWithGuest).guest?.primaryLastName || ''}`.trim() || 'N/A',
        total: (r.totalAmount || 0) / 100,
        paid: (r.paidAmount || 0) / 100,
        balance: (r.balanceAmount || 0) / 100,
        transactionDate: r.createdAt || r.arrivalDate
      }))
      .sort((a, b) => {
        // Apply group sorting
        if (reportFilters.groupBy === 'status') return a.status.localeCompare(b.status);
        if (reportFilters.groupBy === 'siteType') return a.siteType.localeCompare(b.siteType);
        // Default sort by date desc
        return new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime();
      });
  }, [reservationsQuery.data, sitesQuery.data, reportFilters]);

  // Monthly revenue report (all 12 months for current year)
  const monthlyRevenue = useMemo(() => {
    if (!reservationsQuery.data || !sitesQuery.data) return null;

    const siteMap = new Map(sitesQuery.data.map(s => [s.id, s]));
    const now = new Date();
    const currentMonth = now.getMonth();
    const months: { month: string; revenue: number; paid: number; bookings: number; isCurrent: boolean }[] = [];

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let m = 0; m < 12; m++) {
      months.push({
        month: monthNames[m],
        revenue: 0,
        paid: 0,
        bookings: 0,
        isCurrent: m === currentMonth
      });
    }

    reservationsQuery.data.forEach(r => {
      const arrived = new Date(r.arrivalDate);
      if (arrived.getFullYear() !== now.getFullYear()) return;
      if (r.status === 'cancelled') return;

      // Apply customizations
      if (reportFilters.status !== 'all' && r.status !== reportFilters.status) return;
      if (reportFilters.siteType !== 'all') {
        const site = siteMap.get(r.siteId);
        if (site && (site as SiteWithClass).siteType !== reportFilters.siteType) return;
      }

      const m = arrived.getMonth();
      months[m].revenue += (r.totalAmount || 0) / 100;
      months[m].paid += (r.paidAmount || 0) / 100;
      months[m].bookings += 1;
    });

    return months;
  }, [reservationsQuery.data, sitesQuery.data, reportFilters]);

  // Annual revenue report (last 3 years)
  const annualRevenue = useMemo(() => {
    if (!reservationsQuery.data) return null;

    const now = new Date();
    const currentYear = now.getFullYear();
    const years: { year: number; bookings: number; revenue: number; paid: number; avgPerBooking: number; isCurrent: boolean }[] = [];

    for (let y = currentYear - 2; y <= currentYear; y++) {
      const yearStart = new Date(y, 0, 1);
      const yearEnd = new Date(y, 11, 31);

      const yearReservations = reservationsQuery.data.filter(r => {
        const arrival = new Date(r.arrivalDate);
        return arrival >= yearStart && arrival <= yearEnd && r.status !== 'cancelled';
      });

      years.push({
        year: y,
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
        guestName: `${(r as ReservationWithGuest).guest?.primaryFirstName || ''} ${(r as ReservationWithGuest).guest?.primaryLastName || ''}`.trim() || 'N/A',
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
        guestName: `${(r as ReservationWithGuest).guest?.primaryFirstName || ''} ${(r as ReservationWithGuest).guest?.primaryLastName || ''}`.trim() || 'N/A',
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
          siteClass: (site as SiteWithClass)?.siteClass?.name || site?.siteType || 'N/A',
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
          siteClass: (site as SiteWithClass)?.siteClass?.name || site?.siteType || 'N/A',
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
        const guestId = (r as ReservationWithGuest).guestId || r.id;
        const guestName = `${(r as ReservationWithGuest).guest?.primaryFirstName || ''} ${(r as ReservationWithGuest).guest?.primaryLastName || ''}`.trim() || 'N/A';

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
        const className = (site as SiteWithClass)?.siteClass?.name ?? site?.siteType ?? "Unknown";
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
        const guestId = (r as ReservationWithGuest).guestId || r.id;
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
        const guestId = (r as ReservationWithGuest).guestId || r.id;
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
          siteClass: (site as SiteWithClass)?.siteClass?.name || site?.siteType || 'N/A',
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
        const guestId = (r as ReservationWithGuest).guestId || r.id;
        const guestName = `${(r as ReservationWithGuest).guest?.primaryFirstName || ''} ${(r as ReservationWithGuest).guest?.primaryLastName || ''}`.trim() || 'N/A';

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
        const partySize = ((r as ReservationWithGuest).adults || 0) + ((r as ReservationWithGuest).children || 0);
        return r.status !== 'cancelled' && partySize >= 5;
      })
      .map(r => {
        const site = siteMap.get(r.siteId);
        const partySize = ((r as ReservationWithGuest).adults || 0) + ((r as ReservationWithGuest).children || 0);
        const revenue = (r.totalAmount || 0) / 100;
        return {
          guest: `${(r as ReservationWithGuest).guest?.primaryFirstName || ''} ${(r as ReservationWithGuest).guest?.primaryLastName || ''}`.trim() || 'N/A',
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
    if (!campgroundId) {
      toast({
        title: "Select a campground",
        description: "Choose a campground before exporting reports.",
        variant: "destructive"
      });
      return;
    }
    if (reservationsQuery.isLoading || sitesQuery.isLoading) {
      toast({
        title: "Reports still loading",
        description: "Wait for report data to finish loading before exporting.",
        variant: "destructive"
      });
      return;
    }
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    if (!dateRange.start || !dateRange.end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      toast({
        title: "Invalid date range",
        description: "Choose a valid start and end date before exporting.",
        variant: "destructive"
      });
      return;
    }
    const rowCount = getExportRowCount(tabName);
    if (!rowCount) {
      toast({
        title: "Nothing to export",
        description: "No rows match the current filters and date range.",
        variant: "destructive"
      });
      return;
    }
    const subMeta = currentSubMeta();
    setExportPreview({
      reportName: getReportDisplayName(tabName),
      subReportName: subMeta?.label || null,
      dateRange,
      rowCount,
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



      case 'revenue':
        if (reservationsQuery.data) {
          csv = 'ID,Site,Guest,Arrival,Departure,Status,Total,Paid,Balance,Nights\n';
          reservationsQuery.data.forEach(r => {
            const arrival = new Date(r.arrivalDate);
            const departure = new Date(r.departureDate);
            const nights = Math.max(1, Math.floor((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24)));
            const guest = `"${(r as ReservationWithGuest).guest?.primaryFirstName || ''} ${(r as ReservationWithGuest).guest?.primaryLastName || ''}".trim()`;
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

          <div className="rounded-xl border border-border bg-card/90 shadow-sm p-5 space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
                  <HelpAnchor topicId="reports-overview" label="Reports help" />
                </div>
                <p className="text-muted-foreground text-sm">Financials, occupancy, marketing, audits—live and exportable.</p>
                <p className="text-xs text-muted-foreground">
                  Read-only views of live data. Edit in{" "}
                  <Link href="/reservations" className="underline font-medium">Reservations</Link>{" "}
                  or{" "}
                  <Link href="/billing" className="underline font-medium">Billing</Link>. Tip: Save report to bookmark this view.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 bg-muted border border-border rounded-lg px-3 py-2">
                <Label htmlFor="report-date-start" className="text-xs font-medium text-muted-foreground">From</Label>
                <Input
                  id="report-date-start"
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="rounded-md border border-border px-2 py-1 text-sm"
                />
                <Label htmlFor="report-date-end" className="text-xs font-medium text-muted-foreground">To</Label>
                <Input
                  id="report-date-end"
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="rounded-md border border-border px-2 py-1 text-sm"
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
                    filters: reportFilters,
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
          </div>

          <ReportsNavBar
            activeTab={activeTab as ReportTab}
            activeSubTab={activeSubTab}
            dateRange={dateRange}
            filters={reportFilters}
            extraLinks={reportNavLinks}
          />

          {/* Report Filters */}
          <div className="border border-border rounded-xl bg-card">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-muted transition-colors rounded-xl"
              aria-expanded={showFilters}
              aria-controls="report-filter-panel"
            >
              <div className="flex items-center gap-3">
                <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
                <div>
                  <span className="font-medium text-foreground">Filters & grouping</span>
                  <span className="text-muted-foreground text-sm ml-2">Date presets, filters, grouping</span>
                </div>
              </div>
              {showFilters ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </button>

            {showFilters && (
              <div id="report-filter-panel" className="px-4 pb-4 pt-2 border-t border-border space-y-4">
                {/* Date Range Presets */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-2">Quick Date Range</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'Today', days: 0 },
                      { label: 'Last 7 days', days: 7 },
                      { label: 'Last 30 days', days: 30 },
                      { label: 'Last 90 days', days: 90 },
                      { label: 'This year', days: 365 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => {
                          const end = new Date();
                          const start = new Date();
                          start.setDate(start.getDate() - preset.days);
                          setDateRange({
                            start: start.toISOString().slice(0, 10),
                            end: end.toISOString().slice(0, 10)
                          });
                          setActivePreset(preset.label);
                        }}
                        type="button"
                        className="px-3 py-1.5 text-xs rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors"
                        aria-pressed={activePreset === preset.label}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filters Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Status Filter */}
                  <div>
                    <Label htmlFor="report-filter-status" className="block text-xs font-medium text-muted-foreground mb-1">Status</Label>
                    <Select
                      value={reportFilters.status}
                      onValueChange={(value) => setReportFilters({ ...reportFilters, status: value as 'all' | 'confirmed' | 'checked_in' | 'pending' | 'cancelled' })}
                    >
                      <SelectTrigger id="report-filter-status" className="w-full h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="checked_in">Checked In</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Site Type Filter */}
                  <div>
                    <Label htmlFor="report-filter-site-type" className="block text-xs font-medium text-muted-foreground mb-1">Site Type</Label>
                    <Select
                      value={reportFilters.siteType}
                      onValueChange={(value) => setReportFilters({ ...reportFilters, siteType: value })}
                    >
                      <SelectTrigger id="report-filter-site-type" className="w-full h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All site types</SelectItem>
                        <SelectItem value="RV">RV Sites</SelectItem>
                        <SelectItem value="Tent">Tent Sites</SelectItem>
                        <SelectItem value="Cabin">Cabins</SelectItem>
                        <SelectItem value="Glamping">Glamping</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Group By */}
                  <div>
                    <Label htmlFor="report-filter-group-by" className="block text-xs font-medium text-muted-foreground mb-1">Group By</Label>
                    <Select
                      value={reportFilters.groupBy}
                      onValueChange={(value) => setReportFilters({ ...reportFilters, groupBy: value as 'none' | 'site' | 'status' | 'date' | 'siteType' })}
                    >
                      <SelectTrigger id="report-filter-group-by" className="w-full h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No grouping</SelectItem>
                        <SelectItem value="site">By Site</SelectItem>
                        <SelectItem value="status">By Status</SelectItem>
                        <SelectItem value="date">By Date</SelectItem>
                        <SelectItem value="siteType">By Site Type</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Active Filters Summary */}
                {(reportFilters.status !== 'all' || reportFilters.siteType !== 'all' || reportFilters.groupBy !== 'none') && (
                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <Filter className="h-4 w-4 text-primary" />
                    <span className="text-xs text-muted-foreground">Active filters:</span>
                    {reportFilters.status !== 'all' && (
                      <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">{reportFilters.status}</span>
                    )}
                    {reportFilters.siteType !== 'all' && (
                      <span className="text-xs px-2 py-0.5 rounded bg-status-success-bg text-status-success-text">{reportFilters.siteType}</span>
                    )}
                    {reportFilters.groupBy !== 'none' && (
                      <span className="text-xs px-2 py-0.5 rounded bg-status-warning-bg text-status-warning-text">Grouped by {reportFilters.groupBy}</span>
                    )}
                    <button
                      onClick={() => setReportFilters({ status: 'all', siteType: 'all', groupBy: 'none' })}
                      className="text-xs text-muted-foreground hover:text-foreground underline ml-auto"
                    >
                      Clear all
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>


          {/* DYNAMIC REPORT CONTENT - renders directly below sub-tabs */}
          {campgroundId && activeTab !== 'overview' && (
            <div className="rounded-xl border border-border bg-card shadow-sm p-4">
              <ReportRenderer
                key={`${activeTab}-${activeSubTab || 'default'}`}
                tab={activeTab as ReportTab}
                subTab={activeSubTab || (subTabs[activeTab as keyof typeof subTabs]?.[0]?.id)}
                campgroundId={campgroundId}
                dateRange={dateRange}
                reportFilters={reportFilters}
              />
            </div>
          )}

          {/* Legacy renderSubReportContent() removed - now using ReportRenderer component */}
        </div>

        {/* Export Confirmation Dialog */}
        <ExportDialog
          open={showExportDialog}
          onOpenChange={setShowExportDialog}
          exportPreview={exportPreview}
          onExport={(format: ExportFormat) => {
            if (exportPreview) {
              exportReport(exportPreview.tabName, activeSubTab, format);
            }
          }}
        />

      </DashboardShell >
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-5">
        <Breadcrumbs items={[{ label: "Reports" }]} />

        <div className="rounded-xl border border-border bg-card/90 shadow-sm p-5 space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
                <HelpAnchor topicId="reports-overview" label="Reports help" />
              </div>
              <p className="text-muted-foreground text-sm">Financials, occupancy, marketing, audits—live and exportable.</p>
              <p className="text-xs text-muted-foreground">
                Read-only views of live data. Edit in{" "}
                <Link href="/reservations" className="underline font-medium">Reservations</Link>{" "}
                or{" "}
                <Link href="/billing" className="underline font-medium">Billing</Link>. Tip: Save report to bookmark this view.
              </p>
            </div>
            {campgroundId ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 bg-muted border border-border rounded-lg px-3 py-2">
                  <Label htmlFor="report-date-start" className="text-xs font-medium text-muted-foreground">From</Label>
                  <Input
                    id="report-date-start"
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="rounded-md border border-border px-2 py-1 text-sm"
                  />
                  <Label htmlFor="report-date-end" className="text-xs font-medium text-muted-foreground">To</Label>
                  <Input
                    id="report-date-end"
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="rounded-md border border-border px-2 py-1 text-sm"
                  />
                </div>
                <SavedReportsDropdown
                  campgroundId={campgroundId}
                  onLoadReport={(report) => {
                    router.push(buildReportHref({
                      tab: report.tab,
                      subTab: report.subTab ?? null,
                      dateRange: report.dateRange,
                      filters: report.filters
                    }));
                  }}
                />
                <Link href="/reports/saved">
                  <Button variant="outline" size="sm">View all saved</Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSaveDialog(true)}
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
              <span className="text-sm text-status-warning">Select a campground to view reports.</span>
            )}
          </div>


          <ReportsNavBar
            activeTab={activeTab as ReportTab}
            activeSubTab={activeSubTab}
            dateRange={dateRange}
            filters={reportFilters}
            extraLinks={reportNavLinks}
          />

          {!campgroundId && (
            <div className="rounded-lg border border-status-warning/30 bg-status-warning/15 px-4 py-3 text-sm text-status-warning">
              Choose a campground from the sidebar to load reports.
            </div>
          )}

          {campgroundId && (
            <>
              {/* Sub-tabs are now rendered earlier, above the Customize Report panel */}

              {(summaryQuery.isLoading || agingQuery.isLoading || ledgerSummaryQuery.isLoading) && (
                <div className="text-sm text-muted-foreground">Loading metrics…</div>
              )}
              {(summaryQuery.error || agingQuery.error || ledgerSummaryQuery.error) && (
                <div className="rounded-lg border border-status-warning/30 bg-status-warning/15 px-4 py-3 text-sm text-status-warning">
                  Some report data failed to load. Try again or refresh.
                </div>
              )}


              <>
                {/* OVERVIEW TAB - Admin Analytics Style */}
                {activeTab === 'overview' && campgroundId && (
                  <div className="rounded-xl bg-muted p-6 -mx-2">
                    <OverviewReport campgroundId={campgroundId} />
                  </div>
                )}

                {/* DYNAMIC REPORT RENDERER for non-overview tabs */}
                {activeTab !== 'overview' && campgroundId && (
                  <ReportRenderer
                    key={`${activeTab}-${activeSubTab || 'default'}`}
                    tab={activeTab as ReportTab}
                    subTab={activeSubTab || (subTabs[activeTab as keyof typeof subTabs]?.[0]?.id)}
                    campgroundId={campgroundId}
                    dateRange={dateRange}
                    reportFilters={reportFilters}
                  />
                )}


                {/* Site Status Report */}
                {
                  (activeTab as string) === 'daily' && siteStatusReport && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Site Status Overview</div>
                        <div className="text-xs text-muted-foreground">Real-time availability status for all sites</div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b border-border">
                            <tr>
                              <th className="text-left py-2 text-muted-foreground font-medium">Site</th>
                              <th className="text-left py-2 text-muted-foreground font-medium">Class</th>
                              <th className="text-center py-2 text-muted-foreground font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {siteStatusReport.map((site, idx) => (
                              <tr key={site.id} className={idx % 2 === 0 ? 'bg-muted' : ''}>
                                <td className="py-2 font-medium">{site.name}</td>
                                <td className="py-2">{site.className}</td>
                                <td className="py-2 text-center">
                                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${site.status === 'Available' ? 'bg-status-success-bg text-status-success-text' :
                                    site.status === 'Occupied' ? 'bg-status-info-bg text-status-info-text' :
                                      'bg-muted text-muted-foreground'
                                    }`}>
                                    {site.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  )
                }

                {/* Transaction Log */}
                {
                  (activeTab as string) === 'daily' && transactionLog && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Transaction Log</div>
                        <div className="text-xs text-muted-foreground">Complete financial activity log, sorted by date</div>
                      </div>
                      {transactionLog.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No transactions found</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="border-b border-border">
                              <tr>
                                <th className="text-left py-2 text-muted-foreground font-medium">Date</th>
                                <th className="text-left py-2 text-muted-foreground font-medium">Site</th>
                                <th className="text-left py-2 text-muted-foreground font-medium">Guest</th>
                                <th className="text-left py-2 text-muted-foreground font-medium">Arrival</th>
                                <th className="text-left py-2 text-muted-foreground font-medium">Departure</th>
                                <th className="text-right py-2 text-muted-foreground font-medium">Total</th>
                                <th className="text-right py-2 text-muted-foreground font-medium">Paid</th>
                                <th className="text-right py-2 text-muted-foreground font-medium">Balance</th>
                                <th className="text-center py-2 text-muted-foreground font-medium w-16"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {transactionLog.map((r, idx) => (
                                <tr key={r.id} className={idx % 2 === 0 ? 'bg-muted' : ''}>
                                  <td className="py-2 font-medium">{r.transactionDate}</td>
                                  <td className="py-2">{r.siteName}</td>
                                  <td className="py-2">{r.guestName}</td>
                                  <td className="py-2 text-xs text-muted-foreground">{r.arrivalDate}</td>
                                  <td className="py-2 text-xs text-muted-foreground">{r.departureDate}</td>
                                  <td className="py-2 text-right">{formatCurrency(r.total)}</td>
                                  <td className="py-2 text-right">
                                    <span className="text-status-success font-medium">${r.paid.toFixed(2)}</span>
                                  </td>
                                  <td className="py-2 text-right">
                                    <span className={r.balance > 0 ? 'text-status-warning font-medium' : 'text-muted-foreground'}>
                                      {formatCurrency(r.balance)}
                                    </span>
                                  </td>
                                  <td className="py-2 text-center">
                                    <Link href={`/reservations/${r.id}`} className="text-primary hover:text-primary inline-flex items-center gap-1 text-xs">
                                      View <ExternalLink className="h-3 w-3" />
                                    </Link>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </Card>
                  )
                }

                {/* Monthly Revenue */}
                {
                  (activeTab as string) === 'daily' && monthlyRevenue && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Monthly Revenue Breakdown</div>
                        <div className="text-xs text-muted-foreground">All 12 months for current year</div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {monthlyRevenue.map(m => (
                          <div
                            key={m.month}
                            className={`rounded-lg border p-3 ${m.isCurrent
                              ? 'border-status-success/20 bg-status-success/10'
                              : 'border-border bg-muted'
                              }`}
                          >
                            <div className={`text-xs mb-1 ${m.isCurrent ? 'text-status-success font-medium' : 'text-muted-foreground'}`}>
                              {m.month}
                            </div>
                            <div className={`text-lg font-bold ${m.isCurrent ? 'text-status-success' : 'text-foreground'}`}>
                              {formatCurrency(m.revenue, 0)}
                            </div>
                            <div className={`text-xs mt-1 ${m.isCurrent ? 'text-status-success' : 'text-muted-foreground'}`}>
                              {m.bookings} bookings
                            </div>
                            <div className={`text-xs ${m.isCurrent ? 'text-status-success' : 'text-muted-foreground'}`}>
                              Paid: {formatCurrency(m.paid, 0)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )
                }

                {/* Annual Revenue */}
                {
                  (activeTab as string) === 'daily' && annualRevenue && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Annual Revenue Comparison</div>
                        <div className="text-xs text-muted-foreground">Year-over-year performance (last 3 years)</div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {annualRevenue.map(y => (
                          <div
                            key={y.year}
                            className={`rounded-lg border p-4 ${y.isCurrent
                              ? 'border-status-success/30 bg-status-success/10'
                              : 'border-border bg-muted'
                              }`}
                          >
                            <div className={`text-sm mb-2 ${y.isCurrent ? 'text-status-success font-semibold' : 'text-muted-foreground font-medium'}`}>
                              {y.year} {y.isCurrent && '(Current)'}
                            </div>
                            <div className={`text-2xl font-bold mb-2 ${y.isCurrent ? 'text-status-success' : 'text-foreground'}`}>
                              {formatCurrency(y.revenue, 0)}
                            </div>
                            <div className="space-y-1">
                              <div className={`text-xs ${y.isCurrent ? 'text-status-success' : 'text-muted-foreground'}`}>
                                {y.bookings} total bookings
                              </div>
                              <div className={`text-xs ${y.isCurrent ? 'text-status-success' : 'text-muted-foreground'}`}>
                                Paid: {formatCurrency(y.paid, 0)}
                              </div>
                              <div className={`text-xs ${y.isCurrent ? 'text-status-success' : 'text-muted-foreground'}`}>
                                Avg: {formatCurrency(y.avgPerBooking)}/booking
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )
                }

                {/* Daily Revenue (Last 30 Days) */}
                {
                  (activeTab as string) === 'daily' && dailyRevenue && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Daily Revenue Trend</div>
                        <div className="text-xs text-muted-foreground">Last 30 days booking activity</div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b border-border">
                            <tr>
                              <th className="text-left py-2 text-muted-foreground font-medium">Date</th>
                              <th className="text-center py-2 text-muted-foreground font-medium">Bookings</th>
                              <th className="text-right py-2 text-muted-foreground font-medium">Revenue</th>
                              <th className="text-right py-2 text-muted-foreground font-medium">Paid</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dailyRevenue.map((d, idx) => (
                              <tr key={d.date} className={idx % 2 === 0 ? 'bg-muted' : ''}>
                                <td className="py-2 font-medium">{d.date}</td>
                                <td className="py-2 text-center">
                                  <span className={`inline-block px-2 py-0.5 rounded text-xs ${d.bookings > 0 ? 'bg-status-info-bg text-status-info-text' : 'bg-muted text-muted-foreground'
                                    }`}>
                                    {d.bookings}
                                  </span>
                                </td>
                                <td className="py-2 text-right">
                                  <span className={d.revenue > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                                    {formatCurrency(d.revenue)}
                                  </span>
                                </td>
                                <td className="py-2 text-right">
                                  <span className={d.paid > 0 ? 'text-status-success font-medium' : 'text-muted-foreground'}>
                                    {formatCurrency(d.paid)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  )
                }

                {/* Cancellation Report */}
                {
                  (activeTab as string) === 'daily' && cancellationReport && (
                    <div className="rounded-xl border border-border bg-card shadow-sm p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Cancellations</div>
                        <div className="text-xs text-muted-foreground">Last 30 days cancelled reservations</div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                        <div className="rounded-lg border border-status-error/20 bg-status-error/10 p-3">
                          <div className="text-xs text-status-error mb-1">Total Cancelled</div>
                          <div className="text-2xl font-bold text-status-error">{cancellationReport.summary.count}</div>
                        </div>
                        <div className="rounded-lg border border-status-warning/20 bg-status-warning/10 p-3">
                          <div className="text-xs text-status-warning mb-1">Lost Revenue</div>
                          <div className="text-2xl font-bold text-status-warning">{formatCurrency(cancellationReport.summary.totalLost, 0)}</div>
                        </div>
                        <div className="rounded-lg border border-primary/20 bg-primary/10 p-3">
                          <div className="text-xs text-primary mb-1">Refunded</div>
                          <div className="text-2xl font-bold text-primary">{formatCurrency(cancellationReport.summary.totalRefunded, 0)}</div>
                        </div>
                        <div className="rounded-lg border border-border bg-muted p-3">
                          <div className="text-xs text-muted-foreground mb-1">Net Loss</div>
                          <div className="text-2xl font-bold text-foreground">{formatCurrency(cancellationReport.summary.netLoss, 0)}</div>
                        </div>
                      </div>
                      {cancellationReport.cancellations.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No cancellations in the last 30 days</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="border-b border-border">
                              <tr>
                                <th className="text-left py-2 text-muted-foreground font-medium">Cancel Date</th>
                                <th className="text-left py-2 text-muted-foreground font-medium">Site</th>
                                <th className="text-left py-2 text-muted-foreground font-medium">Guest</th>
                                <th className="text-left py-2 text-muted-foreground font-medium">Arrival</th>
                                <th className="text-right py-2 text-muted-foreground font-medium">Lost Revenue</th>
                                <th className="text-right py-2 text-muted-foreground font-medium">Refunded</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cancellationReport.cancellations.map((r, idx) => (
                                <tr key={r.id} className={idx % 2 === 0 ? 'bg-status-error/10' : 'bg-card'}>
                                  <td className="py-2 font-medium">{new Date(r.cancelDate).toISOString().split('T')[0]}</td>
                                  <td className="py-2">{r.siteName}</td>
                                  <td className="py-2">{r.guestName}</td>
                                  <td className="py-2 text-xs text-muted-foreground">{r.arrivalDate}</td>
                                  <td className="py-2 text-right">
                                    <span className="text-status-error font-medium">{formatCurrency(r.lostRevenue)}</span>
                                  </td>
                                  <td className="py-2 text-right">
                                    <span className="text-primary">{formatCurrency(r.refunded)}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                }

                {/* No-Show Report */}
                {
                  (activeTab as string) === 'daily' && noShowReport && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">No-Shows</div>
                        <div className="text-xs text-muted-foreground">Guests who didn't arrive for confirmed reservations</div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                        <div className="rounded-lg border border-status-warning/20 bg-status-warning/10 p-3">
                          <div className="text-xs text-status-warning mb-1">Total No-Shows</div>
                          <div className="text-2xl font-bold text-status-warning">{noShowReport.summary.count}</div>
                        </div>
                        <div className="rounded-lg border border-status-error/20 bg-status-error/10 p-3">
                          <div className="text-xs text-status-error mb-1">Lost Revenue</div>
                          <div className="text-2xl font-bold text-status-error">{formatCurrency(noShowReport.summary.totalLost, 0)}</div>
                        </div>
                        <div className="rounded-lg border border-status-success/20 bg-status-success/10 p-3">
                          <div className="text-xs text-status-success mb-1">Paid (Non-Refundable)</div>
                          <div className="text-2xl font-bold text-status-success">{formatCurrency(noShowReport.summary.totalPaid, 0)}</div>
                        </div>
                      </div>
                      {noShowReport.noShows.length === 0 ? (
                        <div className="text-sm text-status-success">No no-shows detected - excellent!</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="border-b border-border">
                              <tr>
                                <th className="text-left py-2 text-muted-foreground font-medium">Days Late</th>
                                <th className="text-left py-2 text-muted-foreground font-medium">Site</th>
                                <th className="text-left py-2 text-muted-foreground font-medium">Guest</th>
                                <th className="text-left py-2 text-muted-foreground font-medium">Expected Arrival</th>
                                <th className="text-left py-2 text-muted-foreground font-medium">Departure</th>
                                <th className="text-right py-2 text-muted-foreground font-medium">Amount Paid</th>
                              </tr>
                            </thead>
                            <tbody>
                              {noShowReport.noShows.map((r, idx) => (
                                <tr key={r.id} className={idx % 2 === 0 ? 'bg-status-warning/10' : 'bg-card'}>
                                  <td className="py-2">
                                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${r.daysLate > 7 ? 'bg-status-error-bg text-status-error-text' :
                                      r.daysLate > 3 ? 'bg-status-warning/15 text-status-warning' :
                                        'bg-status-warning-bg text-status-warning-text'
                                      }`}>
                                      {r.daysLate} days
                                    </span>
                                  </td>
                                  <td className="py-2">{r.siteName}</td>
                                  <td className="py-2">{r.guestName}</td>
                                  <td className="py-2 text-xs text-muted-foreground">{r.arrivalDate}</td>
                                  <td className="py-2 text-xs text-muted-foreground">{r.departureDate}</td>
                                  <td className="py-2 text-right">
                                    <span className="text-status-success font-medium">${r.paid.toFixed(2)}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </Card>
                  )
                }

                {/* REVENUE TAB */}
                {
                  activeTab === 'revenue' && reservationStats && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Reservation Analytics</div>
                        <div className="text-xs text-muted-foreground">For date range: {dateRange.start} to {dateRange.end}</div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="rounded-lg border border-border bg-muted p-3">
                          <div className="text-xs text-muted-foreground mb-1">Total Bookings</div>
                          <div className="text-2xl font-bold text-foreground">{reservationStats.total}</div>
                        </div>
                        <div className="rounded-lg border border-border bg-status-success/10 p-3">
                          <div className="text-xs text-status-success mb-1">Revenue</div>
                          <div className="text-2xl font-bold text-status-success">{formatCurrency(reservationStats.totalRevenue, 0)}</div>
                        </div>
                        <div className="rounded-lg border border-border bg-primary/10 p-3">
                          <div className="text-xs text-primary mb-1">Avg Lead Time</div>
                          <div className="text-2xl font-bold text-primary">{reservationStats.avgLeadTime}d</div>
                        </div>
                        <div className="rounded-lg border border-border bg-primary/10 p-3">
                          <div className="text-xs text-primary mb-1">Avg per Booking</div>
                          <div className="text-2xl font-bold text-primary">
                            {reservationStats.total > 0 ? formatCurrency(reservationStats.totalRevenue / reservationStats.total, 0) : '0'}
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-foreground mb-2">By Status</div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {Object.entries(reservationStats.byStatus).map(([status, count]) => (
                            <div key={status} className="rounded-md border border-border bg-card px-3 py-2 text-sm">
                              <div className="text-xs text-muted-foreground capitalize">{status.replace('_', ' ')}</div>
                              <div className="font-semibold text-foreground">{count}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Card>
                  )
                }

                {/* PERFORMANCE TAB - Site Performance */}
                {
                  activeTab === 'performance' && sitePerformance && sitePerformance.length > 0 && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Top 10 Sites by Revenue</div>
                        <div className="text-xs text-muted-foreground">All-time performance</div>
                      </div>
                      <div className="space-y-2">
                        {sitePerformance.map((site, idx) => (
                          <div key={site.name} className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-6 text-center text-xs font-semibold text-muted-foreground">#{idx + 1}</div>
                            <div className="flex-1 flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
                              <div>
                                <div className="text-sm font-medium text-foreground">{site.name}</div>
                                <div className="text-xs text-muted-foreground">{site.bookings} bookings</div>
                              </div>
                              <div className="text-sm font-bold text-status-success">{formatCurrency(site.revenue, 0)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )
                }

                {/* Revenue Trends */}
                {
                  activeTab === 'revenue' && revenueTrends && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Revenue Trends</div>
                        <div className="text-xs text-muted-foreground">Last 12 months</div>
                      </div>
                      <div className="space-y-1">
                        {revenueTrends.map(({ month, revenue }) => {
                          const maxRevenue = Math.max(...revenueTrends.map(t => t.revenue), 1);
                          const width = (revenue / maxRevenue) * 100;
                          return (
                            <div key={month} className="flex items-center gap-2">
                              <div className="w-20 text-xs text-muted-foreground flex-shrink-0">{month}</div>
                              <div className="flex-1 h-8 bg-muted rounded relative overflow-hidden">
                                <div
                                  className="h-full bg-status-success transition-all duration-500"
                                  style={{ width: `${width}%` }}
                                />
                                <div className="absolute inset-0 flex items-center px-2">
                                  <span className="text-xs font-semibold text-foreground">{formatCurrency(revenue, 0)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  )
                }

                {/* REVENUE TAB - Weekend vs Weekday */}
                {
                  activeTab === 'revenue' && weekendVsWeekdayStats && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Weekend vs Weekday Performance</div>
                        <div className="text-xs text-muted-foreground">Booking patterns by arrival day</div>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="rounded-lg border border-primary/20 bg-primary/10 p-4 space-y-3">
                          <div className="text-sm font-bold text-primary">Weekend (Fri-Sat Arrivals)</div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <div className="text-xs text-primary mb-1">Bookings</div>
                              <div className="text-2xl font-bold text-primary">{weekendVsWeekdayStats.weekend.bookings}</div>
                            </div>
                            <div>
                              <div className="text-xs text-primary mb-1">Revenue</div>
                              <div className="text-2xl font-bold text-primary">{formatCurrency(weekendVsWeekdayStats.weekend.revenue, 0)}</div>
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-primary mb-1">Avg per Booking</div>
                            <div className="text-lg font-bold text-primary">{formatCurrency(weekendVsWeekdayStats.weekend.avgRevenue, 0)}</div>
                          </div>
                        </div>
                        <div className="rounded-lg border border-border bg-muted p-4 space-y-3">
                          <div className="text-sm font-bold text-foreground">Weekday (Sun-Thu Arrivals)</div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Bookings</div>
                              <div className="text-2xl font-bold text-foreground">{weekendVsWeekdayStats.weekday.bookings}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Revenue</div>
                              <div className="text-2xl font-bold text-foreground">{formatCurrency(weekendVsWeekdayStats.weekday.revenue, 0)}</div>
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground mb-1">Avg per Booking</div>
                            <div className="text-lg font-bold text-foreground">{formatCurrency(weekendVsWeekdayStats.weekday.avgRevenue, 0)}</div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  )
                }

                {/* REVENUE TAB - Pricing Analysis by Site Class */}
                {
                  activeTab === 'revenue' && pricingAnalysis && pricingAnalysis.length > 0 && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Pricing Analysis by Site Class</div>
                        <div className="text-xs text-muted-foreground">Average daily rate and performance metrics</div>
                      </div>
                      <div className="space-y-2">
                        {pricingAnalysis.map((cls) => (
                          <div key={cls.className} className="rounded-md border border-border bg-card p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-sm font-medium text-foreground">{cls.className}</div>
                              <div className="text-lg font-bold text-status-success">${cls.adr}/night</div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <div className="text-muted-foreground">Total Nights</div>
                                <div className="font-semibold text-foreground">{cls.totalNights}</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">Total Revenue</div>
                                <div className="font-semibold text-foreground">{formatCurrency(cls.totalRevenue, 0)}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )
                }

                {/* REVENUE TAB - ADR Trends */}
                {
                  activeTab === 'revenue' && adrTrends && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">ADR Trends</div>
                        <div className="text-xs text-muted-foreground">Average daily rate over last 12 months</div>
                      </div>
                      <div className="space-y-1">
                        {adrTrends.map(({ month, adr }) => {
                          const maxADR = Math.max(...adrTrends.map(t => parseFloat(t.adr)), 1);
                          const width = (parseFloat(adr) / maxADR) * 100;
                          return (
                            <div key={month} className="flex items-center gap-2">
                              <div className="w-20 text-xs text-muted-foreground flex-shrink-0">{month}</div>
                              <div className="flex-1 h-8 bg-muted rounded relative overflow-hidden">
                                <div
                                  className="h-full bg-primary transition-all duration-500"
                                  style={{ width: `${width}%` }}
                                />
                                <div className="absolute inset-0 flex items-center px-2">
                                  <span className="text-xs font-semibold text-foreground">${adr}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  )
                }

                {/* PERFORMANCE TAB - Site Class Performance */}
                {
                  activeTab === 'performance' && siteClassStats && siteClassStats.length > 0 && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Site Class Performance</div>
                        <div className="text-xs text-muted-foreground">Revenue by class</div>
                      </div>
                      <div className="space-y-2">
                        {siteClassStats.map((cls) => (
                          <div key={cls.className} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
                            <div>
                              <div className="text-sm font-medium text-foreground">{cls.className}</div>
                              <div className="text-xs text-muted-foreground">{cls.bookings} bookings</div>
                            </div>
                            <div className="text-sm font-bold text-status-success">{formatCurrency(cls.revenue, 0)}</div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )
                }

                {/* PERFORMANCE TAB - Occupancy Trends */}
                {
                  activeTab === 'performance' && occupancyTrends && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Occupancy Trends</div>
                        <div className="text-xs text-muted-foreground">Last 12 months</div>
                      </div>
                      <div className="space-y-1">
                        {occupancyTrends.map(({ month, occupancy }) => {
                          const maxOccupancy = Math.max(...occupancyTrends.map(t => parseFloat(t.occupancy)), 1);
                          const width = (parseFloat(occupancy) / maxOccupancy) * 100;
                          const occupancyNum = parseFloat(occupancy);
                          const colorClass = occupancyNum >= 80 ? 'bg-status-success' :
                            occupancyNum >= 60 ? 'bg-primary' :
                              occupancyNum >= 40 ? 'bg-status-warning' :
                                'bg-muted';
                          return (
                            <div key={month} className="flex items-center gap-2">
                              <div className="w-20 text-xs text-muted-foreground flex-shrink-0">{month}</div>
                              <div className="flex-1 h-8 bg-muted rounded relative overflow-hidden">
                                <div
                                  className={`h-full ${colorClass} transition-all duration-500`}
                                  style={{ width: `${width}%` }}
                                />
                                <div className="absolute inset-0 flex items-center px-2">
                                  <span className="text-xs font-semibold text-foreground">{occupancy}%</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  )
                }

                {/* PERFORMANCE TAB - Revenue Per Site */}
                {
                  activeTab === 'performance' && revenuePerSiteStats && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Revenue Per Site</div>
                        <div className="text-xs text-muted-foreground">Average performance metrics</div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-lg border border-border bg-muted p-3">
                          <div className="text-xs text-muted-foreground mb-1">Total Sites</div>
                          <div className="text-2xl font-bold text-foreground">{revenuePerSiteStats.totalSites}</div>
                        </div>
                        <div className="rounded-lg border border-border bg-status-success/10 p-3">
                          <div className="text-xs text-status-success mb-1">All-Time Avg</div>
                          <div className="text-2xl font-bold text-status-success">{formatCurrency(revenuePerSiteStats.allTime, 0)}</div>
                        </div>
                        <div className="rounded-lg border border-border bg-primary/10 p-3">
                          <div className="text-xs text-primary mb-1">Last 30d Avg</div>
                          <div className="text-2xl font-bold text-primary">{formatCurrency(revenuePerSiteStats.last30Days, 0)}</div>
                        </div>
                      </div>
                    </Card>
                  )
                }

                {/* PERFORMANCE TAB - Site Utilization */}
                {
                  activeTab === 'performance' && siteUtilizationStats && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Site Utilization Rate</div>
                        <div className="text-xs text-muted-foreground">Booking frequency by site (All-time)</div>
                      </div>
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div className="rounded-lg border border-border bg-muted p-3">
                          <div className="text-xs text-muted-foreground mb-1">Total Sites</div>
                          <div className="text-2xl font-bold text-foreground">{siteUtilizationStats.sites.length}</div>
                        </div>
                        <div className="rounded-lg border border-border bg-primary/10 p-3">
                          <div className="text-xs text-primary mb-1">Avg Bookings</div>
                          <div className="text-2xl font-bold text-primary">{siteUtilizationStats.avgBookings}</div>
                        </div>
                        <div className="rounded-lg border border-border bg-status-warning/10 p-3">
                          <div className="text-xs text-status-warning mb-1">Underutilized</div>
                          <div className="text-2xl font-bold text-status-warning">{siteUtilizationStats.underutilized}</div>
                        </div>
                      </div>
                      <div className="max-h-64 overflow-y-auto space-y-1">
                        {siteUtilizationStats.sites.slice(0, 15).map((site, idx) => {
                          const utilizationPercent = (site.bookings / siteUtilizationStats.avgBookings) * 100;
                          const colorClass = utilizationPercent >= 100 ? 'bg-status-success' :
                            utilizationPercent >= 70 ? 'bg-primary' :
                              utilizationPercent >= 40 ? 'bg-status-warning' :
                                'bg-status-error';
                          return (
                            <div key={site.name} className="flex items-center gap-2">
                              <div className="w-32 text-xs text-muted-foreground flex-shrink-0 truncate">{site.name}</div>
                              <div className="flex-1 h-6 bg-muted rounded relative overflow-hidden">
                                <div
                                  className={`h-full ${colorClass} transition-all duration-500`}
                                  style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
                                />
                                <div className="absolute inset-0 flex items-center px-2">
                                  <span className="text-xs font-semibold text-foreground">{site.bookings} bookings</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  )
                }

                {/* PERFORMANCE TAB - Occupancy by Site Class */}
                {
                  activeTab === 'performance' && occupancyBySiteClass && occupancyBySiteClass.length > 0 && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Occupancy by Site Class</div>
                        <div className="text-xs text-muted-foreground">Annual occupancy rate by class</div>
                      </div>
                      <div className="space-y-2">
                        {occupancyBySiteClass.map((cls) => {
                          const occupancyNum = parseFloat(cls.occupancy);
                          const colorClass = occupancyNum >= 80 ? 'bg-status-success' :
                            occupancyNum >= 60 ? 'bg-primary' :
                              occupancyNum >= 40 ? 'bg-status-warning' :
                                'bg-muted';
                          return (
                            <div key={cls.className} className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium text-foreground">{cls.className}</span>
                                <span className="text-muted-foreground">({cls.sites} sites)</span>
                              </div>
                              <div className="h-8 bg-muted rounded relative overflow-hidden">
                                <div
                                  className={`h-full ${colorClass} transition-all duration-500`}
                                  style={{ width: `${occupancyNum}%` }}
                                />
                                <div className="absolute inset-0 flex items-center px-2">
                                  <span className="text-sm font-semibold text-foreground">{cls.occupancy}%</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  )
                }

                {/* PERFORMANCE TAB - Site Utilization Report (90 days) */}
                {
                  activeTab === 'performance' && siteUtilizationReport && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Site Utilization (Last 90 Days)</div>
                        <div className="text-xs text-muted-foreground">Occupancy rates and revenue by site | Avg: {siteUtilizationReport.avgOccupancy.toFixed(1)}%</div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b border-border">
                            <tr>
                              <th className="text-left py-2 text-muted-foreground font-medium">Site</th>
                              <th className="text-left py-2 text-muted-foreground font-medium">Class</th>
                              <th className="text-center py-2 text-muted-foreground font-medium">Occupancy</th>
                              <th className="text-center py-2 text-muted-foreground font-medium">Nights</th>
                              <th className="text-center py-2 text-muted-foreground font-medium">Bookings</th>
                              <th className="text-right py-2 text-muted-foreground font-medium">Revenue</th>
                              <th className="text-right py-2 text-muted-foreground font-medium">$/Night</th>
                            </tr>
                          </thead>
                          <tbody>
                            {siteUtilizationReport.sites.map((site, idx) => (
                              <tr key={site.siteId} className={idx % 2 === 0 ? 'bg-muted' : ''}>
                                <td className="py-2 font-medium">{site.siteName}</td>
                                <td className="py-2 text-muted-foreground">{site.siteClass}</td>
                                <td className="py-2 text-center">
                                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${site.occupancyRate >= 80 ? 'bg-status-success-bg text-status-success-text' :
                                    site.occupancyRate >= 60 ? 'bg-status-info-bg text-status-info-text' :
                                      site.occupancyRate >= 40 ? 'bg-status-warning-bg text-status-warning-text' :
                                        'bg-status-error-bg text-status-error-text'
                                    }`}>
                                    {site.occupancyRate.toFixed(1)}%
                                  </span>
                                </td>
                                <td className="py-2 text-center text-foreground">{site.nights}</td>
                                <td className="py-2 text-center text-foreground">{site.bookings}</td>
                                <td className="py-2 text-right font-medium text-foreground">${site.revenue.toFixed(0)}</td>
                                <td className="py-2 text-right text-muted-foreground">${site.avgRevenuePerNight.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  )
                }

                {/* PERFORMANCE TAB - Revenue Per Site Report */}
                {
                  activeTab === 'performance' && revenuePerSiteReport && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Revenue Per Site (All-Time)</div>
                        <div className="text-xs text-muted-foreground">Total: {formatCurrency(revenuePerSiteReport.totalRevenue, 0)}</div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b border-border">
                            <tr>
                              <th className="text-left py-2 text-muted-foreground font-medium">Site</th>
                              <th className="text-left py-2 text-muted-foreground font-medium">Class</th>
                              <th className="text-right py-2 text-muted-foreground font-medium">Total Revenue</th>
                              <th className="text-center py-2 text-muted-foreground font-medium">Bookings</th>
                              <th className="text-center py-2 text-muted-foreground font-medium">Nights</th>
                              <th className="text-right py-2 text-muted-foreground font-medium">$/Booking</th>
                              <th className="text-right py-2 text-muted-foreground font-medium">$/Night</th>
                            </tr>
                          </thead>
                          <tbody>
                            {revenuePerSiteReport.sites.slice(0, 20).map((site, idx) => (
                              <tr key={site.siteId} className={idx % 2 === 0 ? 'bg-muted' : ''}>
                                <td className="py-2 font-medium">{site.siteName}</td>
                                <td className="py-2 text-muted-foreground">{site.siteClass}</td>
                                <td className="py-2 text-right">
                                  <span className="font-semibold text-status-success">{formatCurrency(site.totalRevenue, 0)}</span>
                                </td>
                                <td className="py-2 text-center text-foreground">{site.bookings}</td>
                                <td className="py-2 text-center text-foreground">{site.nights}</td>
                                <td className="py-2 text-right text-muted-foreground">{formatCurrency(site.avgPerBooking)}</td>
                                <td className="py-2 text-right text-muted-foreground">{formatCurrency(site.avgPerNight)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  )
                }

                {
                  activeTab === 'performance' && enableAnalyticsMaps && (occupancyHeatPoints.length > 0 || revenueHeatPoints.length > 0) && (
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
                  )
                }

                {/* PERFORMANCE TAB - Length of Stay Distribution */}
                {
                  activeTab === 'performance' && lengthOfStayReport && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Length of Stay Distribution</div>
                        <div className="text-xs text-muted-foreground">Avg: {lengthOfStayReport.avgStay.toFixed(1)} nights | Total bookings: {lengthOfStayReport.totalBookings}</div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b border-border">
                            <tr>
                              <th className="text-left py-2 text-muted-foreground font-medium">Nights</th>
                              <th className="text-center py-2 text-muted-foreground font-medium">Bookings</th>
                              <th className="text-left py-2 text-muted-foreground font-medium">Distribution</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lengthOfStayReport.distribution.map((stay, idx) => {
                              const percentage = (stay.count / lengthOfStayReport.totalBookings) * 100;
                              return (
                                <tr key={stay.nights} className={idx % 2 === 0 ? 'bg-muted' : ''}>
                                  <td className="py-2">
                                    <span className="font-medium text-foreground">{stay.nights} {stay.nights === 1 ? 'night' : 'nights'}</span>
                                  </td>
                                  <td className="py-2 text-center">
                                    <span className="inline-block px-2 py-0.5 rounded text-xs bg-status-info-bg text-status-info-text font-medium">
                                      {stay.count}
                                    </span>
                                  </td>
                                  <td className="py-2">
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 h-6 bg-muted rounded relative overflow-hidden">
                                        <div
                                          className="h-full bg-primary transition-all duration-500"
                                          style={{ width: `${percentage}%` }}
                                        />
                                        <div className="absolute inset-0 flex items-center px-2">
                                          <span className="text-xs font-semibold text-foreground">{percentage.toFixed(1)}%</span>
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
                    </Card>
                  )
                }

                {/* PERFORMANCE TAB - Booking Lead Time Analysis */}
                {
                  activeTab === 'performance' && bookingLeadTimeReport && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Booking Lead Time Analysis</div>
                        <div className="text-xs text-muted-foreground">How far in advance guests book | Avg: {bookingLeadTimeReport.avgLeadTime.toFixed(1)} days | Median: {bookingLeadTimeReport.medianLeadTime} days</div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                        <div className="rounded-lg border border-status-error/20 bg-status-error/10 p-3">
                          <div className="text-xs text-status-error mb-1">Same Day</div>
                          <div className="text-xl font-bold text-status-error">{bookingLeadTimeReport.buckets.sameDay}</div>
                          <div className="text-xs text-status-error mt-1">
                            {((bookingLeadTimeReport.buckets.sameDay / bookingLeadTimeReport.total) * 100).toFixed(1)}%
                          </div>
                        </div>
                        <div className="rounded-lg border border-status-warning/20 bg-status-warning/10 p-3">
                          <div className="text-xs text-status-warning mb-1">1-7 Days</div>
                          <div className="text-xl font-bold text-status-warning">{bookingLeadTimeReport.buckets.within7Days}</div>
                          <div className="text-xs text-status-warning mt-1">
                            {((bookingLeadTimeReport.buckets.within7Days / bookingLeadTimeReport.total) * 100).toFixed(1)}%
                          </div>
                        </div>
                        <div className="rounded-lg border border-status-warning/20 bg-status-warning/10 p-3">
                          <div className="text-xs text-status-warning mb-1">8-14 Days</div>
                          <div className="text-xl font-bold text-status-warning">{bookingLeadTimeReport.buckets.within14Days}</div>
                          <div className="text-xs text-status-warning mt-1">
                            {((bookingLeadTimeReport.buckets.within14Days / bookingLeadTimeReport.total) * 100).toFixed(1)}%
                          </div>
                        </div>
                        <div className="rounded-lg border border-status-warning/20 bg-status-warning/10 p-3">
                          <div className="text-xs text-status-warning mb-1">15-30 Days</div>
                          <div className="text-xl font-bold text-status-warning">{bookingLeadTimeReport.buckets.within30Days}</div>
                          <div className="text-xs text-status-warning mt-1">
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
                        <div className="rounded-lg border border-status-success/20 bg-status-success/10 p-3">
                          <div className="text-xs text-status-success mb-1">61-90 Days</div>
                          <div className="text-xl font-bold text-status-success">{bookingLeadTimeReport.buckets.within90Days}</div>
                          <div className="text-xs text-status-success mt-1">
                            {((bookingLeadTimeReport.buckets.within90Days / bookingLeadTimeReport.total) * 100).toFixed(1)}%
                          </div>
                        </div>
                        <div className="rounded-lg border border-primary/20 bg-primary/10 p-3">
                          <div className="text-xs text-primary mb-1">90+ Days</div>
                          <div className="text-xl font-bold text-primary">{bookingLeadTimeReport.buckets.over90Days}</div>
                          <div className="text-xs text-primary mt-1">
                            {((bookingLeadTimeReport.buckets.over90Days / bookingLeadTimeReport.total) * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </Card>
                  )
                }

                {/* REVENUE TAB - Future Revenue Forecast */}
                {
                  activeTab === 'revenue' && futureRevenue && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Future Revenue Forecast</div>
                        <div className="text-xs text-muted-foreground">Confirmed & pending bookings</div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-border bg-primary/10 p-3">
                          <div className="text-xs text-primary mb-1">Bookings</div>
                          <div className="text-2xl font-bold text-primary">{futureRevenue.count}</div>
                        </div>
                        <div className="rounded-lg border border-border bg-status-success/10 p-3">
                          <div className="text-xs text-status-success mb-1">Total Value</div>
                          <div className="text-2xl font-bold text-status-success">${futureRevenue.totalRevenue.toFixed(0)}</div>
                        </div>
                        <div className="rounded-lg border border-border bg-status-success/10 p-3">
                          <div className="text-xs text-status-success mb-1">Paid</div>
                          <div className="text-lg font-bold text-status-success">${futureRevenue.totalPaid.toFixed(0)}</div>
                        </div>
                        <div className="rounded-lg border border-border bg-status-warning/10 p-3">
                          <div className="text-xs text-status-warning mb-1">Outstanding</div>
                          <div className="text-lg font-bold text-status-warning">${futureRevenue.outstanding.toFixed(0)}</div>
                        </div>
                      </div>
                    </Card>
                  )
                }

                {/* REVENUE TAB - Payment Breakdown */}
                {
                  activeTab === 'revenue' && paymentStats && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Payment Breakdown</div>
                        <div className="text-xs text-muted-foreground">All-time collection metrics</div>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="rounded-lg border border-border bg-muted p-3">
                          <div className="text-xs text-muted-foreground mb-1">Total Revenue</div>
                          <div className="text-xl font-bold text-foreground">{formatCurrency(paymentStats.totalRevenue, 0)}</div>
                        </div>
                        <div className="rounded-lg border border-border bg-status-success/10 p-3">
                          <div className="text-xs text-status-success mb-1">Collected</div>
                          <div className="text-xl font-bold text-status-success">{formatCurrency(paymentStats.totalPaid, 0)}</div>
                        </div>
                        <div className="rounded-lg border border-border bg-status-warning/10 p-3">
                          <div className="text-xs text-status-warning mb-1">Outstanding</div>
                          <div className="text-xl font-bold text-status-warning">{formatCurrency(paymentStats.totalBalance, 0)}</div>
                        </div>
                        <div className="rounded-lg border border-border bg-primary/10 p-3">
                          <div className="text-xs text-primary mb-1">Collection Rate</div>
                          <div className="text-xl font-bold text-primary">{paymentStats.paidPercentage}%</div>
                        </div>
                      </div>
                    </Card>
                  )
                }

                {/* REVENUE TAB - Monthly Comparison */}
                {
                  activeTab === 'revenue' && monthlyComparison && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Month-over-Month</div>
                        <div className="text-xs text-muted-foreground">Current vs previous month comparison</div>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-foreground uppercase">Current Month</div>
                          <div className="rounded-lg border border-border bg-primary/10 p-3">
                            <div className="text-xs text-primary mb-1">Bookings</div>
                            <div className="text-2xl font-bold text-primary">{monthlyComparison.current.bookings}</div>
                          </div>
                          <div className="rounded-lg border border-border bg-status-success/10 p-3">
                            <div className="text-xs text-status-success mb-1">Revenue</div>
                            <div className="text-2xl font-bold text-status-success">{formatCurrency(monthlyComparison.current.revenue, 0)}</div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-foreground uppercase">Previous Month</div>
                          <div className="rounded-lg border border-border bg-muted p-3">
                            <div className="text-xs text-muted-foreground mb-1">Bookings</div>
                            <div className="text-2xl font-bold text-foreground">{monthlyComparison.previous.bookings}</div>
                          </div>
                          <div className="rounded-lg border border-border bg-muted p-3">
                            <div className="text-xs text-muted-foreground mb-1">Revenue</div>
                            <div className="text-2xl font-bold text-foreground">{formatCurrency(monthlyComparison.previous.revenue, 0)}</div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-foreground uppercase">Change</div>
                          <div className={`rounded-lg border border-border p-3 ${monthlyComparison.change.bookings >= 0 ? 'bg-status-success/10' : 'bg-status-error/10'}`}>
                            <div className="text-xs mb-1 ${monthlyComparison.change.bookings >= 0 ? 'text-status-success' : 'text-status-error'}">Bookings</div>
                            <div className={`text-2xl font-bold ${monthlyComparison.change.bookings >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                              {monthlyComparison.change.bookings >= 0 ? '+' : ''}{monthlyComparison.change.bookings}
                            </div>
                          </div>
                          <div className={`rounded-lg border border-border p-3 ${parseFloat(monthlyComparison.change.revenuePercent) >= 0 ? 'bg-status-success/10' : 'bg-status-error/10'}`}>
                            <div className="text-xs mb-1 ${parseFloat(monthlyComparison.change.revenuePercent) >= 0 ? 'text-status-success' : 'text-status-error'}">Revenue</div>
                            <div className={`text-2xl font-bold ${parseFloat(monthlyComparison.change.revenuePercent) >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                              {parseFloat(monthlyComparison.change.revenuePercent) >= 0 ? '+' : ''}{monthlyComparison.change.revenuePercent}%
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  )
                }

                {/* GUESTS TAB */}
                {
                  activeTab === 'guests' && activeSubTab === 'legacy-overview' && guestStats && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Guest Analytics</div>
                        <div className="text-xs text-muted-foreground">Loyalty metrics</div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-lg border border-border bg-muted p-3">
                          <div className="text-xs text-muted-foreground mb-1">Total</div>
                          <div className="text-2xl font-bold text-foreground">{guestStats.total}</div>
                        </div>
                        <div className="rounded-lg border border-border bg-primary/10 p-3">
                          <div className="text-xs text-primary mb-1">Repeat</div>
                          <div className="text-2xl font-bold text-primary">{guestStats.repeat}</div>
                        </div>
                        <div className="rounded-lg border border-border bg-primary/10 p-3">
                          <div className="text-xs text-primary mb-1">Rate</div>
                          <div className="text-2xl font-bold text-primary">{guestStats.repeatRate}%</div>
                        </div>
                      </div>
                    </Card>
                  )
                }

                {/* GUESTS TAB - Party Size Distribution */}
                {
                  activeTab === 'guests' && activeSubTab === 'legacy-overview' && partySizeStats && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Party Size Distribution</div>
                        <div className="text-xs text-muted-foreground">Average party size: {partySizeStats.avgPartySize} guests</div>
                      </div>
                      <div className="space-y-2">
                        {Object.entries(partySizeStats.distribution).map(([range, count]) => {
                          const total = Object.values(partySizeStats.distribution).reduce((sum, c) => sum + c, 0);
                          const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
                          return (
                            <div key={range} className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-foreground">{range} guests</span>
                                <span className="font-semibold text-foreground">{count} ({percentage}%)</span>
                              </div>
                              <div className="h-2 bg-muted rounded overflow-hidden">
                                <div
                                  className="h-full bg-primary"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  )
                }

                {/* GUESTS TAB - Top Guests by Revenue */}
                {
                  activeTab === 'guests' && activeSubTab === 'legacy-overview' && topGuestsStats && topGuestsStats.length > 0 && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Top 10 Guests by Revenue</div>
                        <div className="text-xs text-muted-foreground">Most valuable customers (All-time)</div>
                      </div>
                      <div className="space-y-2">
                        {topGuestsStats.map((guest, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-6 text-center text-xs font-semibold text-muted-foreground">#{idx + 1}</div>
                            <div className="flex-1 flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
                              <div>
                                <div className="text-sm font-medium text-foreground">{guest.name}</div>
                                <div className="text-xs text-muted-foreground">{guest.bookings} bookings</div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-bold text-status-success">{formatCurrency(guest.revenue, 0)}</div>
                                <div className="text-xs text-muted-foreground">{formatCurrency(guest.revenue / guest.bookings, 0)}/booking</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )
                }

                {/* GUESTS TAB - Guest Loyalty & Repeat Visitors */}
                {
                  activeTab === 'guests' && activeSubTab === 'legacy-overview' && guestLoyaltyReport && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Guest Loyalty & Repeat Visitors</div>
                        <div className="text-xs text-muted-foreground">
                          Repeat Rate: {guestLoyaltyReport.stats.repeatRate.toFixed(1)}% |
                          Avg Visits per Repeat Guest: {guestLoyaltyReport.stats.avgVisitsPerRepeatGuest.toFixed(1)}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                        <div className="rounded-lg border border-border bg-muted p-3">
                          <div className="text-xs text-muted-foreground mb-1">Total Guests</div>
                          <div className="text-2xl font-bold text-foreground">{guestLoyaltyReport.stats.totalGuests}</div>
                        </div>
                        <div className="rounded-lg border border-status-success/20 bg-status-success/10 p-3">
                          <div className="text-xs text-status-success mb-1">Repeat Guests</div>
                          <div className="text-2xl font-bold text-status-success">{guestLoyaltyReport.stats.repeatGuests}</div>
                        </div>
                        <div className="rounded-lg border border-primary/20 bg-primary/10 p-3">
                          <div className="text-xs text-primary mb-1">Repeat Rate</div>
                          <div className="text-2xl font-bold text-primary">{guestLoyaltyReport.stats.repeatRate.toFixed(1)}%</div>
                        </div>
                      </div>
                      {guestLoyaltyReport.guests.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No repeat guests yet</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="border-b border-border">
                              <tr>
                                <th className="text-left py-2 text-muted-foreground font-medium">Guest Name</th>
                                <th className="text-center py-2 text-muted-foreground font-medium">Visits</th>
                                <th className="text-right py-2 text-muted-foreground font-medium">Total Spent</th>
                                <th className="text-left py-2 text-muted-foreground font-medium">Last Visit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {guestLoyaltyReport.guests.slice(0, 25).map((guest, idx) => (
                                <tr key={guest.guestId} className={idx % 2 === 0 ? 'bg-status-success/10' : 'bg-card'}>
                                  <td className="py-2 font-medium">{guest.name}</td>
                                  <td className="py-2 text-center">
                                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${guest.visits >= 10 ? 'bg-primary/10 text-primary' :
                                      guest.visits >= 5 ? 'bg-status-success-bg text-status-success-text' :
                                        guest.visits >= 3 ? 'bg-status-info-bg text-status-info-text' :
                                          'bg-muted text-muted-foreground'
                                      }`}>
                                      {guest.visits}x
                                    </span>
                                  </td>
                                  <td className="py-2 text-right">
                                    <span className="font-semibold text-status-success">{formatCurrency(guest.totalSpent)}</span>
                                  </td>
                                  <td className="py-2 text-muted-foreground">{guest.lastVisit}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </Card>
                  )
                }

                {/* GUESTS TAB - Guest Segmentation (New vs Returning) */}
                {
                  activeTab === 'guests' && activeSubTab === 'legacy-overview' && guestSegmentationReport && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Guest Segmentation Analysis</div>
                        <div className="text-xs text-muted-foreground">New vs Returning guest revenue breakdown | Returning Rate: {guestSegmentationReport.returningRate.toFixed(1)}%</div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {guestSegmentationReport.segments.map(segment => (
                          <div key={segment.type} className={`rounded-lg border-2 p-4 ${segment.type === 'New Guests' ? 'border-primary/30 bg-primary/10' : 'border-status-success/30 bg-status-success/10'
                            }`}>
                            <div className={`text-sm font-semibold mb-3 ${segment.type === 'New Guests' ? 'text-primary' : 'text-status-success'
                              }`}>
                              {segment.type}
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className={`text-xs ${segment.type === 'New Guests' ? 'text-primary' : 'text-status-success'}`}>
                                  Total Guests
                                </span>
                                <span className={`text-lg font-bold ${segment.type === 'New Guests' ? 'text-primary' : 'text-status-success'}`}>
                                  {segment.count}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className={`text-xs ${segment.type === 'New Guests' ? 'text-primary' : 'text-status-success'}`}>
                                  Bookings
                                </span>
                                <span className={`text-lg font-bold ${segment.type === 'New Guests' ? 'text-primary' : 'text-status-success'}`}>
                                  {segment.bookings}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className={`text-xs ${segment.type === 'New Guests' ? 'text-primary' : 'text-status-success'}`}>
                                  Total Revenue
                                </span>
                                <span className={`text-xl font-bold ${segment.type === 'New Guests' ? 'text-primary' : 'text-status-success'}`}>
                                  {formatCurrency(segment.revenue, 0)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center pt-2 border-t border-current/20">
                                <span className={`text-xs ${segment.type === 'New Guests' ? 'text-primary' : 'text-status-success'}`}>
                                  Avg Per Booking
                                </span>
                                <span className={`text-sm font-semibold ${segment.type === 'New Guests' ? 'text-primary' : 'text-status-success'}`}>
                                  {formatCurrency(segment.avgRevenue)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )
                }

                {/* ANALYTICS TAB */}
                {
                  activeTab === 'analytics' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Cancellation Analytics */}
                      {cancellationStats && (
                        <Card className="p-4 space-y-3">
                          <div>
                            <div className="text-sm font-semibold text-foreground">Cancellation Analytics</div>
                            <div className="text-xs text-muted-foreground">All-time performance</div>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="rounded-lg border border-border bg-muted p-3">
                              <div className="text-xs text-muted-foreground mb-1">Total</div>
                              <div className="text-2xl font-bold text-foreground">{cancellationStats.total}</div>
                            </div>
                            <div className="rounded-lg border border-border bg-status-error/10 p-3">
                              <div className="text-xs text-status-error mb-1">Rate</div>
                              <div className="text-2xl font-bold text-status-error">{cancellationStats.rate}%</div>
                            </div>
                            <div className="rounded-lg border border-border bg-status-warning/10 p-3">
                              <div className="text-xs text-status-warning mb-1">Lost $</div>
                              <div className="text-2xl font-bold text-status-warning">{formatCurrency(cancellationStats.revenueLost, 0)}</div>
                            </div>
                          </div>
                        </Card>
                      )}

                      {/* Length of Stay */}
                      {lengthOfStayStats && (
                        <Card className="p-4 space-y-3">
                          <div>
                            <div className="text-sm font-semibold text-foreground">Length of Stay</div>
                            <div className="text-xs text-muted-foreground">Average: {lengthOfStayStats.avgNights} nights</div>
                          </div>
                          <div className="space-y-2">
                            {Object.entries(lengthOfStayStats.distribution).map(([range, count]) => (
                              <div key={range} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm">
                                <span className="text-foreground">{range}</span>
                                <span className="font-semibold text-foreground">{count}</span>
                              </div>
                            ))}
                          </div>
                        </Card>
                      )}

                      {/* Booking Window Distribution */}
                      {bookingWindowStats && (
                        <Card className="p-4 space-y-3">
                          <div>
                            <div className="text-sm font-semibold text-foreground">Booking Window</div>
                            <div className="text-xs text-muted-foreground">Average: {bookingWindowStats.avgDays} days in advance</div>
                          </div>
                          <div className="space-y-2">
                            {Object.entries(bookingWindowStats.distribution).map(([range, count]) => (
                              <div key={range} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm">
                                <span className="text-foreground">{range}</span>
                                <span className="font-semibold text-foreground">{count}</span>
                              </div>
                            ))}
                          </div>
                        </Card>
                      )}

                      {/* Day of Week Patterns */}
                      {dayOfWeekStats && (
                        <Card className="p-4 space-y-3">
                          <div>
                            <div className="text-sm font-semibold text-foreground">Day of Week Patterns</div>
                            <div className="text-xs text-muted-foreground">Arrival & departure trends</div>
                          </div>
                          <div className="space-y-2">
                            {dayOfWeekStats.map(({ day, arrivals, departures }) => (
                              <div key={day} className="flex items-center gap-2">
                                <div className="w-20 text-xs text-muted-foreground flex-shrink-0">{day.slice(0, 3)}</div>
                                <div className="flex-1 grid grid-cols-2 gap-2">
                                  <div className="rounded-md border border-border bg-primary/10 px-2 py-1 text-xs">
                                    <span className="text-primary">In: </span>
                                    <span className="font-semibold text-primary">{arrivals}</span>
                                  </div>
                                  <div className="rounded-md border border-border bg-status-warning/10 px-2 py-1 text-xs">
                                    <span className="text-status-warning">Out: </span>
                                    <span className="font-semibold text-status-warning">{departures}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </Card>
                      )}

                      {/* Revenue Concentration */}
                      {revenueConcentrationStats && (
                        <Card className="p-4 space-y-3 lg:col-span-2">
                          <div>
                            <div className="text-sm font-semibold text-foreground">Revenue Concentration</div>
                            <div className="text-xs text-muted-foreground">Pareto analysis of site revenue distribution</div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="rounded-lg border border-border bg-card p-4">
                              <div className="text-xs text-muted-foreground mb-2">Total Sites</div>
                              <div className="text-3xl font-bold text-foreground mb-3">{revenueConcentrationStats.totalSites}</div>
                              <div className="text-xs text-muted-foreground">In your campground</div>
                            </div>
                            <div className="rounded-lg border border-status-success/20 bg-status-success/10 p-4">
                              <div className="text-xs text-status-success mb-2">Top 20% of Sites</div>
                              <div className="text-3xl font-bold text-status-success mb-3">{revenueConcentrationStats.top20Percent}%</div>
                              <div className="text-xs text-status-success">of total revenue</div>
                            </div>
                            <div className="rounded-lg border border-primary/20 bg-primary/10 p-4">
                              <div className="text-xs text-primary mb-2">Top 50% of Sites</div>
                              <div className="text-3xl font-bold text-primary mb-3">{revenueConcentrationStats.top50Percent}%</div>
                              <div className="text-xs text-primary">of total revenue</div>
                            </div>
                          </div>
                          <div className="rounded-md bg-muted border border-border px-3 py-2 text-xs text-foreground">
                            <span className="font-semibold">Insight:</span> Understanding revenue concentration helps identify your star performers and opportunities to improve underperforming sites.
                          </div>
                        </Card>
                      )}
                    </div>
                  )
                }

                {/* MARKETING TAB */}
                {
                  activeTab === 'marketing' && marketingStats && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Booking Conversion</div>
                        <div className="text-xs text-muted-foreground">All-time conversion metrics</div>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                        <div className="rounded-lg border border-border bg-muted p-3">
                          <div className="text-xs text-muted-foreground mb-1">Total</div>
                          <div className="text-2xl font-bold text-foreground">{marketingStats.total}</div>
                        </div>
                        <div className="rounded-lg border border-status-success/20 bg-status-success/10 p-3">
                          <div className="text-xs text-status-success mb-1">Confirmed</div>
                          <div className="text-2xl font-bold text-status-success">{marketingStats.confirmed}</div>
                        </div>
                        <div className="rounded-lg border border-primary/20 bg-primary/10 p-3">
                          <div className="text-xs text-primary mb-1">Pending</div>
                          <div className="text-2xl font-bold text-primary">{marketingStats.pending}</div>
                        </div>
                        <div className="rounded-lg border border-status-error/20 bg-status-error/10 p-3">
                          <div className="text-xs text-status-error mb-1">Cancelled</div>
                          <div className="text-2xl font-bold text-status-error">{marketingStats.cancelled}</div>
                        </div>
                        <div className="rounded-lg border border-status-success/20 bg-status-success/10 p-3">
                          <div className="text-xs text-status-success mb-1">Conv. Rate</div>
                          <div className="text-2xl font-bold text-status-success">{marketingStats.conversionRate}%</div>
                        </div>
                      </div>
                      <div className="rounded-lg border border-primary/20 bg-primary/10 p-4">
                        <div className="text-xs text-primary mb-1">Average Booking Value</div>
                        <div className="text-3xl font-bold text-primary">{formatCurrency(marketingStats.avgBookingValue)}</div>
                      </div>
                    </Card>
                  )
                }

                {
                  activeTab === 'marketing' && bookingPaceStats && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Booking Pace</div>
                        <div className="text-xs text-muted-foreground">Future bookings on the books</div>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="rounded-lg border border-primary/20 bg-primary/10 p-3">
                          <div className="text-xs text-primary mb-1">Next 30 Days</div>
                          <div className="text-2xl font-bold text-primary">{bookingPaceStats.next30Days}</div>
                          <div className="text-xs text-primary">bookings</div>
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
                        <div className="rounded-lg border border-status-success/20 bg-status-success/10 p-3">
                          <div className="text-xs text-status-success mb-1">Total Future</div>
                          <div className="text-2xl font-bold text-status-success">{bookingPaceStats.total}</div>
                          <div className="text-xs text-status-success">bookings</div>
                        </div>
                      </div>
                    </Card>
                  )
                }

                {/* FORECASTING TAB */}
                {
                  activeTab === 'forecasting' && revenueForecast && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Revenue Forecast</div>
                        <div className="text-xs text-muted-foreground">Projected revenue for next 3 months (confirmed + pending bookings)</div>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {revenueForecast.map(({ month, revenue, bookings }) => (
                          <div key={month} className="rounded-lg border border-border bg-status-info/10 p-4 space-y-2">
                            <div className="text-sm font-bold text-primary">{month}</div>
                            <div>
                              <div className="text-xs text-muted-foreground">Projected Revenue</div>
                              <div className="text-3xl font-bold text-foreground">{formatCurrency(revenue, 0)}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Bookings</div>
                              <div className="text-lg font-semibold text-foreground">{bookings}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-md bg-status-info/15 border border-status-info/30 px-3 py-2 text-xs text-status-info">
                        <span className="font-semibold">Note:</span> Forecasts are based on current confirmed and pending reservations. Actual results may vary based on new bookings and cancellations.
                      </div>
                    </Card>
                  )
                }

                {
                  activeTab === 'forecasting' && bookingPaceStats && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Demand Outlook</div>
                        <div className="text-xs text-muted-foreground">Booking distribution for next 90 days</div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-24 text-xs text-muted-foreground">0-30 days</div>
                          <div className="flex-1 h-10 bg-muted rounded relative overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${(bookingPaceStats.next30Days / bookingPaceStats.total) * 100}%` }}
                            />
                            <div className="absolute inset-0 flex items-center px-2">
                              <span className="text-sm font-semibold text-foreground">{bookingPaceStats.next30Days} bookings</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-24 text-xs text-muted-foreground">31-60 days</div>
                          <div className="flex-1 h-10 bg-muted rounded relative overflow-hidden">
                            <div
                              className="h-full bg-cyan-500"
                              style={{ width: `${(bookingPaceStats.next60Days / bookingPaceStats.total) * 100}%` }}
                            />
                            <div className="absolute inset-0 flex items-center px-2">
                              <span className="text-sm font-semibold text-foreground">{bookingPaceStats.next60Days} bookings</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-24 text-xs text-muted-foreground">61-90 days</div>
                          <div className="flex-1 h-10 bg-muted rounded relative overflow-hidden">
                            <div
                              className="h-full bg-teal-500"
                              style={{ width: `${(bookingPaceStats.next90Days / bookingPaceStats.total) * 100}%` }}
                            />
                            <div className="absolute inset-0 flex items-center px-2">
                              <span className="text-sm font-semibold text-foreground">{bookingPaceStats.next90Days} bookings</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  )
                }

                {/* FORECASTING TAB - Seasonal Analysis */}
                {
                  activeTab === 'forecasting' && seasonalAnalysisReport && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Peak vs Off-Peak Season Analysis</div>
                        <div className="text-xs text-muted-foreground">Avg Revenue: ${seasonalAnalysisReport.avgRevenue.toFixed(0)}/month | Peak: {seasonalAnalysisReport.peakMonths.map(m => m.month).join(', ')}</div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {seasonalAnalysisReport.months.map(month => {
                          const isPeak = seasonalAnalysisReport.peakMonths.some(m => m.month === month.month);
                          const isOffPeak = seasonalAnalysisReport.offPeakMonths.some(m => m.month === month.month);
                          return (
                            <div
                              key={month.month}
                              className={`rounded-lg border p-3 ${isPeak ? 'border-status-success/30 bg-status-success/10' :
                                isOffPeak ? 'border-status-warning/30 bg-status-warning/10' :
                                  'border-border bg-muted'
                                }`}
                            >
                              <div className={`text-xs mb-1 font-medium ${isPeak ? 'text-status-success' :
                                isOffPeak ? 'text-status-warning' :
                                  'text-muted-foreground'
                                }`}>
                                {month.month}
                              </div>
                              <div className={`text-lg font-bold ${isPeak ? 'text-status-success' :
                                isOffPeak ? 'text-status-warning' :
                                  'text-foreground'
                                }`}>
                                {formatCurrency(month.revenue, 0)}
                              </div>
                              <div className={`text-xs mt-1 ${isPeak ? 'text-status-success' :
                                isOffPeak ? 'text-status-warning' :
                                  'text-muted-foreground'
                                }`}>
                                {month.bookings} bookings
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  )
                }

                {/* FORECASTING TAB - Day of Week Performance */}
                {
                  activeTab === 'forecasting' && dayOfWeekReport && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Day of Week Performance</div>
                        <div className="text-xs text-muted-foreground">Check-in patterns by arrival day | Avg: {dayOfWeekReport.avgBookingsPerDay.toFixed(1)} bookings/day</div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                        {dayOfWeekReport.days.map(day => {
                          const isWeekend = day.day === 'Friday' || day.day === 'Saturday';
                          return (
                            <div
                              key={day.day}
                              className={`rounded-lg border p-3 ${isWeekend ? 'border-primary/30 bg-primary/10' : 'border-border bg-muted'
                                }`}
                            >
                              <div className={`text-xs mb-1 ${isWeekend ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                                {day.day.substring(0, 3)}
                              </div>
                              <div className={`text-xl font-bold ${isWeekend ? 'text-primary' : 'text-foreground'}`}>
                                {day.bookings}
                              </div>
                              <div className={`text-xs mt-1 ${isWeekend ? 'text-primary' : 'text-muted-foreground'}`}>
                                {formatCurrency(day.revenue, 0)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  )
                }

                {/* FORECASTING TAB - Revenue Optimization Opportunities */}
                {
                  activeTab === 'forecasting' && revenueOptimizationReport && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Revenue Optimization Opportunities</div>
                        <div className="text-xs text-muted-foreground">Actionable insights to improve performance</div>
                      </div>
                      {revenueOptimizationReport.length === 0 ? (
                        <div className="rounded-lg border border-status-success/20 bg-status-success/10 p-4 text-center">
                          <div className="text-status-success font-medium">All systems performing well!</div>
                          <div className="text-xs text-status-success mt-1">No optimization opportunities detected</div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {revenueOptimizationReport.map((opp, idx) => (
                            <div
                              key={idx}
                              className={`rounded-lg border p-3 ${opp.severity === 'high' ? 'border-status-error/20 bg-status-error/10' :
                                opp.severity === 'medium' ? 'border-status-warning/20 bg-status-warning/10' :
                                  'border-primary/20 bg-primary/10'
                                }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${opp.severity === 'high' ? 'bg-status-error-bg text-status-error-text' :
                                      opp.severity === 'medium' ? 'bg-status-warning-bg text-status-warning-text' :
                                        'bg-status-info-bg text-status-info-text'
                                      }`}>
                                      {opp.severity.toUpperCase()}
                                    </span>
                                    <span className={`text-xs font-medium ${opp.severity === 'high' ? 'text-status-error' :
                                      opp.severity === 'medium' ? 'text-status-warning' :
                                        'text-primary'
                                      }`}>
                                      {opp.type}
                                    </span>
                                  </div>
                                  <div className={`text-sm ${opp.severity === 'high' ? 'text-status-error' :
                                    opp.severity === 'medium' ? 'text-status-warning' :
                                      'text-primary'
                                    }`}>
                                    {opp.description}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  )
                }

                {/* FORECASTING TAB - Occupancy Forecast (90 days) */}
                {
                  activeTab === 'forecasting' && occupancyForecastReport && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">90-Day Occupancy Forecast</div>
                        <div className="text-xs text-muted-foreground">
                          Avg: {occupancyForecastReport.avgOccupancy.toFixed(1)}% |
                          Peak: {occupancyForecastReport.peakDay.occupancy.toFixed(1)}% on {occupancyForecastReport.peakDay.date} |
                          Low: {occupancyForecastReport.lowDay.occupancy.toFixed(1)}% on {occupancyForecastReport.lowDay.date}
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b border-border">
                            <tr>
                              <th className="text-left py-2 text-muted-foreground font-medium">Date</th>
                              <th className="text-center py-2 text-muted-foreground font-medium">Occupied</th>
                              <th className="text-center py-2 text-muted-foreground font-medium">Total Sites</th>
                              <th className="text-left py-2 text-muted-foreground font-medium">Occupancy</th>
                            </tr>
                          </thead>
                          <tbody>
                            {occupancyForecastReport.forecast.map((day, idx) => {
                              if (idx % 7 !== 0) return null; // Show weekly snapshots
                              return (
                                <tr key={day.date} className={idx % 14 === 0 ? 'bg-muted' : ''}>
                                  <td className="py-2 font-medium">{day.date}</td>
                                  <td className="py-2 text-center text-foreground">{day.occupiedSites}</td>
                                  <td className="py-2 text-center text-muted-foreground">{day.totalSites}</td>
                                  <td className="py-2">
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 h-6 bg-muted rounded relative overflow-hidden max-w-xs">
                                        <div
                                          className={`h-full transition-all duration-500 ${day.occupancy >= 80 ? 'bg-status-success' :
                                            day.occupancy >= 60 ? 'bg-primary' :
                                              day.occupancy >= 40 ? 'bg-status-warning' :
                                                'bg-status-error'
                                            }`}
                                          style={{ width: `${day.occupancy}%` }}
                                        />
                                        <div className="absolute inset-0 flex items-center px-2">
                                          <span className="text-xs font-semibold text-foreground">{day.occupancy.toFixed(1)}%</span>
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
                    </Card>
                  )
                }

                {/* PERFORMANCE TAB - Extended Stay Analysis */}
                {
                  activeTab === 'performance' && extendedStayReport && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Extended Stay Analysis</div>
                        <div className="text-xs text-muted-foreground">Long-term guest tracking (7+ nights)</div>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {extendedStayReport.summary.map(category => (
                          <div key={category.type} className="rounded-lg border-2 border-primary/30 bg-primary/10 p-4">
                            <div className="text-xs font-semibold text-primary mb-3">{category.type}</div>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-primary">Bookings</span>
                                <span className="text-lg font-bold text-primary">{category.count}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-primary">Unique Guests</span>
                                <span className="text-lg font-bold text-primary">{category.uniqueGuests}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-primary">Revenue</span>
                                <span className="text-lg font-bold text-primary">{formatCurrency(category.revenue, 0)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-primary">Avg Stay</span>
                                <span className="text-lg font-bold text-primary">{category.avgStay.toFixed(1)} nights</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {extendedStayReport.extendedStays.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-foreground uppercase">Top Extended Stays</div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="border-b border-border">
                                <tr>
                                  <th className="text-left py-2 text-muted-foreground font-medium">Type</th>
                                  <th className="text-left py-2 text-muted-foreground font-medium">Guest</th>
                                  <th className="text-left py-2 text-muted-foreground font-medium">Site</th>
                                  <th className="text-left py-2 text-muted-foreground font-medium">Arrival</th>
                                  <th className="text-left py-2 text-muted-foreground font-medium">Departure</th>
                                  <th className="text-right py-2 text-muted-foreground font-medium">Nights</th>
                                  <th className="text-right py-2 text-muted-foreground font-medium">Revenue</th>
                                </tr>
                              </thead>
                              <tbody>
                                {extendedStayReport.extendedStays.map((stay, idx) => (
                                  <tr key={idx} className={idx % 2 === 0 ? 'bg-muted' : ''}>
                                    <td className="py-2">
                                      <span className={`inline-block px-2 py-0.5 rounded text-xs ${stay.type === 'Monthly (30+)' ? 'bg-primary/10 text-primary' :
                                        stay.type === 'Bi-Weekly (14-29)' ? 'bg-primary/10 text-primary' :
                                          'bg-status-info-bg text-status-info-text'
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
                    </Card>
                  )
                }

                {/* GUESTS TAB - Group Booking Analysis */}
                {
                  activeTab === 'guests' && activeSubTab === 'legacy-overview' && groupBookingReport && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Group Booking Analysis</div>
                        <div className="text-xs text-muted-foreground">Parties of 5+ guests | Total: {groupBookingReport.totalGroups} groups</div>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="rounded-lg border border-border bg-primary/10 p-3">
                          <div className="text-xs text-primary mb-1">Total Groups</div>
                          <div className="text-2xl font-bold text-primary">{groupBookingReport.totalGroups}</div>
                        </div>
                        <div className="rounded-lg border border-border bg-status-success/10 p-3">
                          <div className="text-xs text-status-success mb-1">Total Revenue</div>
                          <div className="text-2xl font-bold text-status-success">{formatCurrency(groupBookingReport.totalRevenue, 0)}</div>
                        </div>
                        <div className="rounded-lg border border-border bg-primary/10 p-3">
                          <div className="text-xs text-primary mb-1">Avg Party Size</div>
                          <div className="text-2xl font-bold text-primary">{groupBookingReport.avgPartySize.toFixed(1)}</div>
                        </div>
                        <div className="rounded-lg border border-border bg-status-warning/10 p-3">
                          <div className="text-xs text-status-warning mb-1">Avg Revenue/Person</div>
                          <div className="text-2xl font-bold text-status-warning">{formatCurrency(groupBookingReport.avgRevenuePerPerson, 0)}</div>
                        </div>
                      </div>
                      {groupBookingReport.largestGroups.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-foreground uppercase">Largest Groups</div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="border-b border-border">
                                <tr>
                                  <th className="text-left py-2 text-muted-foreground font-medium">Guest Name</th>
                                  <th className="text-left py-2 text-muted-foreground font-medium">Site</th>
                                  <th className="text-left py-2 text-muted-foreground font-medium">Arrival</th>
                                  <th className="text-left py-2 text-muted-foreground font-medium">Departure</th>
                                  <th className="text-right py-2 text-muted-foreground font-medium">Party Size</th>
                                  <th className="text-right py-2 text-muted-foreground font-medium">Revenue</th>
                                  <th className="text-right py-2 text-muted-foreground font-medium">$/Person</th>
                                </tr>
                              </thead>
                              <tbody>
                                {groupBookingReport.largestGroups.map((group, idx) => (
                                  <tr key={idx} className={idx % 2 === 0 ? 'bg-muted' : ''}>
                                    <td className="py-2">{group.guest}</td>
                                    <td className="py-2">{group.site}</td>
                                    <td className="py-2">{group.arrival}</td>
                                    <td className="py-2">{group.departure}</td>
                                    <td className="py-2 text-right">
                                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${group.partySize >= 10 ? 'bg-primary/10 text-primary' :
                                        group.partySize >= 8 ? 'bg-primary/10 text-primary' :
                                          'bg-status-info-bg text-status-info-text'
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
                    </Card>
                  )
                }

                {/* PERFORMANCE TAB - Advance vs Walk-in Booking Analysis */}
                {
                  activeTab === 'performance' && advanceBookingReport && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Advance vs Walk-in Booking Analysis</div>
                        <div className="text-xs text-muted-foreground">Booking lead time distribution | Total: {advanceBookingReport.total} bookings</div>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {advanceBookingReport.categories.map(cat => (
                          <div key={cat.type} className={`rounded-lg border-2 p-4 ${cat.type === 'Same Day / Walk-in' ? 'border-status-error/30 bg-status-error/10' :
                            cat.type === 'Advance (1-30 days)' ? 'border-status-warning/30 bg-status-warning/10' :
                              'border-status-success/30 bg-status-success/10'
                            }`}>
                            <div className={`text-xs font-semibold mb-3 ${cat.type === 'Same Day / Walk-in' ? 'text-status-error' :
                              cat.type === 'Advance (1-30 days)' ? 'text-status-warning' :
                                'text-status-success'
                              }`}>
                              {cat.type}
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className={`text-xs ${cat.type === 'Same Day / Walk-in' ? 'text-status-error' :
                                  cat.type === 'Advance (1-30 days)' ? 'text-status-warning' :
                                    'text-status-success'
                                  }`}>
                                  Bookings
                                </span>
                                <span className={`text-lg font-bold ${cat.type === 'Same Day / Walk-in' ? 'text-status-error' :
                                  cat.type === 'Advance (1-30 days)' ? 'text-status-warning' :
                                    'text-status-success'
                                  }`}>
                                  {cat.count}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className={`text-xs ${cat.type === 'Same Day / Walk-in' ? 'text-status-error' :
                                  cat.type === 'Advance (1-30 days)' ? 'text-status-warning' :
                                    'text-status-success'
                                  }`}>
                                  Percentage
                                </span>
                                <span className={`text-lg font-bold ${cat.type === 'Same Day / Walk-in' ? 'text-status-error' :
                                  cat.type === 'Advance (1-30 days)' ? 'text-status-warning' :
                                    'text-status-success'
                                  }`}>
                                  {cat.percentage.toFixed(1)}%
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className={`text-xs ${cat.type === 'Same Day / Walk-in' ? 'text-status-error' :
                                  cat.type === 'Advance (1-30 days)' ? 'text-status-warning' :
                                    'text-status-success'
                                  }`}>
                                  Revenue
                                </span>
                                <span className={`text-lg font-bold ${cat.type === 'Same Day / Walk-in' ? 'text-status-error' :
                                  cat.type === 'Advance (1-30 days)' ? 'text-status-warning' :
                                    'text-status-success'
                                  }`}>
                                  {formatCurrency(cat.revenue, 0)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className={`text-xs ${cat.type === 'Same Day / Walk-in' ? 'text-status-error' :
                                  cat.type === 'Advance (1-30 days)' ? 'text-status-warning' :
                                    'text-status-success'
                                  }`}>
                                  Avg/Booking
                                </span>
                                <span className={`text-lg font-bold ${cat.type === 'Same Day / Walk-in' ? 'text-status-error' :
                                  cat.type === 'Advance (1-30 days)' ? 'text-status-warning' :
                                    'text-status-success'
                                  }`}>
                                  {formatCurrency(cat.avgRevenue, 0)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )
                }

                {/* FORECASTING TAB - Pricing Strategy Recommendations */}
                {
                  activeTab === 'forecasting' && pricingStrategyReport && pricingStrategyReport.length > 0 && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">AI-Driven Pricing Strategy Recommendations</div>
                        <div className="text-xs text-muted-foreground">Revenue optimization opportunities | {pricingStrategyReport.length} recommendations</div>
                      </div>
                      <div className="space-y-2">
                        {pricingStrategyReport.map((rec, idx) => (
                          <div key={idx} className={`rounded-lg border-2 p-3 ${rec.priority === 'high' ? 'border-status-error/40 bg-status-error/10' :
                            rec.priority === 'medium' ? 'border-status-warning/40 bg-status-warning/10' :
                              'border-status-info/40 bg-status-info/10'
                            }`}>
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${rec.priority === 'high' ? 'bg-status-error/30 text-status-error' :
                                  rec.priority === 'medium' ? 'bg-status-warning/30 text-status-warning' :
                                    'bg-status-info/30 text-status-info'
                                  }`}>
                                  {rec.priority.toUpperCase()}
                                </span>
                                <span className={`text-sm font-semibold ${rec.priority === 'high' ? 'text-status-error' :
                                  rec.priority === 'medium' ? 'text-status-warning' :
                                    'text-status-info'
                                  }`}>
                                  {rec.type}
                                </span>
                              </div>
                              <div className="text-xs font-semibold text-foreground">{rec.site}</div>
                            </div>
                            <div className={`text-xs mb-2 ${rec.priority === 'high' ? 'text-status-error' :
                              rec.priority === 'medium' ? 'text-status-warning' :
                                'text-status-info'
                              }`}>
                              {rec.reason}
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <span className="text-muted-foreground">Current Rate:</span>
                                <span className="ml-1 font-semibold">{formatCurrency(rec.currentRate, 0)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Suggested:</span>
                                <span className="ml-1 font-semibold">{formatCurrency(rec.suggestedRate, 0)}</span>
                              </div>
                              {rec.potentialIncrease > 0 && (
                                <div>
                                  <span className="text-muted-foreground">Potential:</span>
                                  <span className="ml-1 font-semibold text-status-success">+{formatCurrency(rec.potentialIncrease, 0)}</span>
                                </div>
                              )}
                            </div>
                            <div className="mt-3 pt-3 border-t border-border/60 flex justify-end">
                              <Button
                                size="sm"
                                variant={rec.priority === 'high' ? 'default' : 'secondary'}
                                onClick={async () => {
                                  try {
                                    if (!campgroundId) return;

                                    const startDate = new Date();
                                    const endDate = new Date();
                                    endDate.setDate(endDate.getDate() + 30); // 30 day rule by default

                                    const payload = {
                                      campgroundId,
                                      label: `AI: ${rec.suggestion} - ${rec.site}`,
                                      startDate: startDate.toISOString().split('T')[0],
                                      endDate: endDate.toISOString().split('T')[0],
                                      isActive: true,
                                      ruleType: 'flat' as const,
                                      flatAdjust: Math.round(rec.suggestedRate * 100),
                                    };
                                    await apiClient.createPricingRule(campgroundId, payload as Parameters<typeof apiClient.createPricingRule>[1]);

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
                    </Card>
                  )
                }

                {/* FORECASTING TAB - Weekend Premium Analysis */}
                {
                  activeTab === 'forecasting' && weekendPremiumReport && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Weekend Premium Analysis</div>
                        <div className="text-xs text-muted-foreground">Weekday vs Weekend rate comparison (Friday/Saturday arrivals)</div>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                        <div className="rounded-lg border-2 border-primary/30 bg-primary/10 p-4">
                          <div className="text-sm font-semibold text-primary mb-3">Weekday Bookings</div>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-primary">Total Bookings</span>
                              <span className="text-lg font-bold text-primary">{weekendPremiumReport.weekday.bookings}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-primary">Total Revenue</span>
                              <span className="text-lg font-bold text-primary">{formatCurrency(weekendPremiumReport.weekday.revenue, 0)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-primary">Avg Rate</span>
                              <span className="text-xl font-bold text-primary">{formatCurrency(weekendPremiumReport.weekday.avgRate, 0)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="rounded-lg border-2 border-primary/30 bg-primary/10 p-4">
                          <div className="text-sm font-semibold text-primary mb-3">Weekend Bookings</div>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-primary">Total Bookings</span>
                              <span className="text-lg font-bold text-primary">{weekendPremiumReport.weekend.bookings}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-primary">Total Revenue</span>
                              <span className="text-lg font-bold text-primary">{formatCurrency(weekendPremiumReport.weekend.revenue, 0)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-primary">Avg Rate</span>
                              <span className="text-xl font-bold text-primary">{formatCurrency(weekendPremiumReport.weekend.avgRate, 0)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className={`rounded-lg border-2 p-4 ${weekendPremiumReport.premium > 0 ? 'border-status-success/30 bg-status-success/10' : 'border-status-error/30 bg-status-error/10'
                        }`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className={`text-sm font-semibold mb-1 ${weekendPremiumReport.premium > 0 ? 'text-status-success' : 'text-status-error'
                              }`}>
                              Weekend Premium
                            </div>
                            <div className={`text-xs ${weekendPremiumReport.premium > 0 ? 'text-status-success' : 'text-status-error'
                              }`}>
                              {weekendPremiumReport.premium > 0
                                ? 'Weekend rates are higher - good!'
                                : weekendPremiumReport.premium < 0
                                  ? 'Consider implementing weekend premium pricing'
                                  : 'Weekend and weekday rates are equal'}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 text-right">
                            <div className={`text-2xl font-bold ${weekendPremiumReport.premium > 0 ? 'text-status-success' :
                              weekendPremiumReport.premium < -5 ? 'text-status-error' : 'text-foreground'
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
                                    const fridayPayload = {
                                      campgroundId,
                                      label: `AI: Weekend Premium (Fri)`,
                                      startDate: startDate.toISOString().split('T')[0],
                                      endDate: endDate.toISOString().split('T')[0],
                                      dayOfWeek: 5, // Friday
                                      isActive: true,
                                      ruleType: 'dow' as const,
                                      percentAdjust: 0.20, // +20%
                                    };
                                    await apiClient.createPricingRule(campgroundId, fridayPayload as Parameters<typeof apiClient.createPricingRule>[1]);

                                    // Create Saturday Rule
                                    const saturdayPayload = {
                                      campgroundId,
                                      label: `AI: Weekend Premium (Sat)`,
                                      startDate: startDate.toISOString().split('T')[0],
                                      endDate: endDate.toISOString().split('T')[0],
                                      dayOfWeek: 6, // Saturday
                                      isActive: true,
                                      ruleType: 'dow' as const,
                                      percentAdjust: 0.20, // +20%
                                    };
                                    await apiClient.createPricingRule(campgroundId, saturdayPayload as Parameters<typeof apiClient.createPricingRule>[1]);

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
                    </Card>
                  )
                }

                {/* ACCOUNTING TAB */}
                {
                  activeTab === 'accounting' && paymentStats && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Payment Summary</div>
                        <div className="text-xs text-muted-foreground">All-time collection metrics</div>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="rounded-lg border border-border bg-muted p-3">
                          <div className="text-xs text-muted-foreground mb-1">Total Revenue</div>
                          <div className="text-2xl font-bold text-foreground">{formatCurrency(paymentStats.totalRevenue, 0)}</div>
                        </div>
                        <div className="rounded-lg border border-status-success/20 bg-status-success/10 p-3">
                          <div className="text-xs text-status-success mb-1">Collected</div>
                          <div className="text-2xl font-bold text-status-success">{formatCurrency(paymentStats.totalPaid, 0)}</div>
                        </div>
                        <div className="rounded-lg border border-status-warning/20 bg-status-warning/10 p-3">
                          <div className="text-xs text-status-warning mb-1">Outstanding</div>
                          <div className="text-2xl font-bold text-status-warning">{formatCurrency(paymentStats.totalBalance, 0)}</div>
                        </div>
                        <div className="rounded-lg border border-primary/20 bg-primary/10 p-3">
                          <div className="text-xs text-primary mb-1">Collection %</div>
                          <div className="text-2xl font-bold text-primary">{paymentStats.paidPercentage}%</div>
                        </div>
                      </div>
                    </Card>
                  )
                }

                {
                  activeTab === 'accounting' && paymentMethodStats && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Payment Status Distribution</div>
                        <div className="text-xs text-muted-foreground">Breakdown by payment completion</div>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                        <div className="rounded-lg border border-status-success/20 bg-status-success/10 p-4">
                          <div className="text-xs text-status-success mb-2">Fully Paid</div>
                          <div className="text-3xl font-bold text-status-success mb-1">{paymentMethodStats.fullyPaid}</div>
                          <div className="text-xs text-status-success">{((paymentMethodStats.fullyPaid / paymentMethodStats.total) * 100).toFixed(1)}% of total</div>
                        </div>
                        <div className="rounded-lg border border-primary/20 bg-primary/10 p-4">
                          <div className="text-xs text-primary mb-2">Partially Paid</div>
                          <div className="text-3xl font-bold text-primary mb-1">{paymentMethodStats.partiallyPaid}</div>
                          <div className="text-xs text-primary">{((paymentMethodStats.partiallyPaid / paymentMethodStats.total) * 100).toFixed(1)}% of total</div>
                        </div>
                        <div className="rounded-lg border border-status-warning/20 bg-status-warning/10 p-4">
                          <div className="text-xs text-status-warning mb-2">Unpaid</div>
                          <div className="text-3xl font-bold text-status-warning mb-1">{paymentMethodStats.unpaid}</div>
                          <div className="text-xs text-status-warning">{((paymentMethodStats.unpaid / paymentMethodStats.total) * 100).toFixed(1)}% of total</div>
                        </div>
                        <div className="rounded-lg border border-border bg-muted p-4">
                          <div className="text-xs text-muted-foreground mb-2">Total Bookings</div>
                          <div className="text-3xl font-bold text-foreground mb-1">{paymentMethodStats.total}</div>
                          <div className="text-xs text-muted-foreground">Active reservations</div>
                        </div>
                      </div>
                    </Card>
                  )
                }

                {/* ACCOUNTING TAB - Refund Tracking */}
                {
                  activeTab === 'accounting' && refundStats && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Refund & Cancellation Summary</div>
                        <div className="text-xs text-muted-foreground">Cancelled reservations with payment history</div>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        <div className="rounded-lg border border-status-error/20 bg-status-error/10 p-4">
                          <div className="text-xs text-status-error mb-2">Total Cancelled</div>
                          <div className="text-3xl font-bold text-status-error mb-1">{refundStats.totalCancelled}</div>
                          <div className="text-xs text-status-error">Reservations</div>
                        </div>
                        <div className="rounded-lg border border-status-warning/20 bg-status-warning/10 p-4">
                          <div className="text-xs text-status-warning mb-2">Refunded Amount</div>
                          <div className="text-3xl font-bold text-status-warning">{formatCurrency(refundStats.refundedAmount, 0)}</div>
                          <div className="text-xs text-status-warning">Total refunds issued</div>
                        </div>
                        <div className="rounded-lg border border-border bg-muted p-4">
                          <div className="text-xs text-muted-foreground mb-2">Avg Refund</div>
                          <div className="text-3xl font-bold text-foreground">{formatCurrency(refundStats.avgRefund, 0)}</div>
                          <div className="text-xs text-muted-foreground">Per cancellation</div>
                        </div>
                      </div>
                    </Card>
                  )
                }

                {
                  activeTab === 'accounting' && agingQuery.data && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Accounts Receivable Aging</div>
                        <div className="text-xs text-muted-foreground">Outstanding balances by age bucket</div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {Object.entries(agingQuery.data).map(([bucket, cents]) => {
                          const colorMap: Record<string, string> = {
                            'current': 'bg-status-success/15 border-status-success/30 text-status-success',
                            '1_30': 'bg-status-info/15 border-status-info/30 text-status-info',
                            '31_60': 'bg-status-warning/15 border-status-warning/30 text-status-warning',
                            '61_90': 'bg-status-warning/20 border-status-warning/40 text-status-warning',
                            'over_90': 'bg-status-error/15 border-status-error/30 text-status-error'
                          };
                          return (
                            <div key={bucket} className={`rounded-lg border p-3 ${colorMap[bucket] || 'bg-muted border-border'}`}>
                              <div className="text-xs mb-1 font-medium">{bucket.replace('_', '-').replace('over ', '90+ ')}</div>
                              <div className="text-2xl font-bold">{formatCurrency(cents / 100)}</div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  )
                }

                {/* AUDITS TAB */}
                {
                  activeTab === 'audits' && activeSubTab === 'audit-log' && dataQualityStats && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Data Quality Overview</div>
                        <div className="text-xs text-muted-foreground">Issues requiring attention</div>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className={`rounded-lg border p-4 ${dataQualityStats.inactiveSites > 0 ? 'bg-status-warning/10 border-status-warning/20' : 'bg-status-success/10 border-status-success/20'}`}>
                          <div className="text-xs text-foreground mb-2">Inactive Sites</div>
                          <div className={`text-3xl font-bold mb-1 ${dataQualityStats.inactiveSites > 0 ? 'text-status-warning' : 'text-status-success'}`}>
                            {dataQualityStats.inactiveSites}
                          </div>
                          <div className="text-xs text-muted-foreground">No bookings in 1 year</div>
                        </div>
                        <div className={`rounded-lg border p-4 ${dataQualityStats.incompleteReservations > 0 ? 'bg-status-error/10 border-status-error/20' : 'bg-status-success/10 border-status-success/20'}`}>
                          <div className="text-xs text-foreground mb-2">Incomplete Data</div>
                          <div className={`text-3xl font-bold mb-1 ${dataQualityStats.incompleteReservations > 0 ? 'text-status-error' : 'text-status-success'}`}>
                            {dataQualityStats.incompleteReservations}
                          </div>
                          <div className="text-xs text-muted-foreground">Missing critical fields</div>
                        </div>
                        <div className={`rounded-lg border p-4 ${dataQualityStats.futureUnpaid > 0 ? 'bg-status-warning/10 border-status-warning/20' : 'bg-status-success/10 border-status-success/20'}`}>
                          <div className="text-xs text-foreground mb-2">Future Unpaid</div>
                          <div className={`text-3xl font-bold mb-1 ${dataQualityStats.futureUnpaid > 0 ? 'text-status-warning' : 'text-status-success'}`}>
                            {dataQualityStats.futureUnpaid}
                          </div>
                          <div className="text-xs text-muted-foreground">Confirmed, no payment</div>
                        </div>
                        <div className={`rounded-lg border p-4 ${dataQualityStats.negativeBalance > 0 ? 'bg-status-error/10 border-status-error/20' : 'bg-status-success/10 border-status-success/20'}`}>
                          <div className="text-xs text-foreground mb-2">Negative Balance</div>
                          <div className={`text-3xl font-bold mb-1 ${dataQualityStats.negativeBalance > 0 ? 'text-status-error' : 'text-status-success'}`}>
                            {dataQualityStats.negativeBalance}
                          </div>
                          <div className="text-xs text-muted-foreground">Overpayment issues</div>
                        </div>
                      </div>
                      <div className="rounded-md bg-muted border border-border px-3 py-2 text-xs text-foreground">
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
                    </Card>
                  )
                }

                {/* AUDITS TAB - Rate Consistency Audit */}
                {
                  activeTab === 'audits' && activeSubTab === 'audit-log' && rateConsistencyStats && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Rate Consistency Audit</div>
                        <div className="text-xs text-muted-foreground">Pricing variance analysis across reservations</div>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
                        <div className="rounded-lg border border-border bg-card p-3">
                          <div className="text-xs text-muted-foreground mb-1">Sites Checked</div>
                          <div className="text-2xl font-bold text-foreground">{rateConsistencyStats.totalSitesChecked}</div>
                        </div>
                        <div className={`rounded-lg border p-3 ${rateConsistencyStats.inconsistentSites > 0 ? 'bg-status-warning/10 border-status-warning/20' : 'bg-status-success/10 border-status-success/20'}`}>
                          <div className={`text-xs mb-1 ${rateConsistencyStats.inconsistentSites > 0 ? 'text-status-warning' : 'text-status-success'}`}>Inconsistent Rates</div>
                          <div className={`text-2xl font-bold ${rateConsistencyStats.inconsistentSites > 0 ? 'text-status-warning' : 'text-status-success'}`}>
                            {rateConsistencyStats.inconsistentSites}
                          </div>
                        </div>
                        <div className="rounded-lg border border-border bg-muted p-3">
                          <div className="text-xs text-muted-foreground mb-1">Variance Threshold</div>
                          <div className="text-2xl font-bold text-foreground">&gt;20%</div>
                        </div>
                      </div>
                      {rateConsistencyStats.siteVariance.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-foreground mb-2 uppercase">Top Issues</div>
                          <div className="space-y-2">
                            {rateConsistencyStats.siteVariance.map((site) => (
                              <div key={site.siteName} className="rounded-md border border-status-warning/20 bg-status-warning/10 p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="text-sm font-medium text-foreground">{site.siteName}</div>
                                  <div className="text-sm font-bold text-status-warning">{site.variance.toFixed(1)}% variance</div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div>
                                    <div className="text-muted-foreground">Min Rate</div>
                                    <div className="font-semibold text-foreground">${site.minRate.toFixed(2)}/night</div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">Max Rate</div>
                                    <div className="font-semibold text-foreground">${site.maxRate.toFixed(2)}/night</div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {rateConsistencyStats.inconsistentSites === 0 && (
                        <div className="rounded-md bg-status-success/15 border border-status-success/30 px-3 py-2 text-sm text-status-success">
                          <span className="font-semibold">All Clear!</span> No significant rate inconsistencies detected across your sites.
                        </div>
                      )}
                    </Card>
                  )
                }

                {
                  activeTab === 'audits' && activeSubTab === 'audit-log' && sitesQuery.data && (
                    <Card className="p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Inventory Audit</div>
                        <div className="text-xs text-muted-foreground">Site configuration summary</div>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                        <div className="rounded-lg border border-border bg-card p-3">
                          <div className="text-xs text-muted-foreground mb-1">Total Sites</div>
                          <div className="text-2xl font-bold text-foreground">{sitesQuery.data.length}</div>
                        </div>
                        <div className="rounded-lg border border-status-success/20 bg-status-success/10 p-3">
                          <div className="text-xs text-status-success mb-1">Active</div>
                          <div className="text-2xl font-bold text-status-success">
                            {sitesQuery.data.filter(s => s.isActive).length}
                          </div>
                        </div>
                        <div className="rounded-lg border border-border bg-muted p-3">
                          <div className="text-xs text-muted-foreground mb-1">Inactive</div>
                          <div className="text-2xl font-bold text-foreground">
                            {sitesQuery.data.filter(s => !s.isActive).length}
                          </div>
                        </div>
                      </div>
                    </Card>
                  )
                }
              </>
            </>
          )}
        </div >
      </div >

      {/* Export Confirmation Dialog */}
      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        exportPreview={exportPreview}
        onExport={(format: ExportFormat) => {
          if (exportPreview) {
            exportReport(exportPreview.tabName, activeSubTab, format);
          }
        }}
      />

      {/* Save Report Dialog */}
      {campgroundId && (
        <SaveReportDialog
          open={showSaveDialog}
          onOpenChange={setShowSaveDialog}
          reportConfig={{
            tab: activeTab,
            subTab: activeSubTab,
            dateRange,
            filters: reportFilters,
            campgroundId,
          }}
          onSaved={(report) => {
            toast({
              title: "Report saved successfully",
              description: `"${report.name}" has been saved to your collection.`,
            });
          }}
        />
      )}

    </DashboardShell >
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading reports…</div>}>
      <ReportsPageInner />
    </Suspense>
  );
}
