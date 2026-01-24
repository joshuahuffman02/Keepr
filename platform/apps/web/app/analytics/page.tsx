"use client";

import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { apiClient } from "@/lib/api-client";
import Link from "next/link";
import {
  PlaneLanding,
  PlaneTakeoff,
  CalendarDays,
  DollarSign,
  Tent,
  BarChart3,
  ScrollText,
  Landmark,
} from "lucide-react";

type ExportStatus = "idle" | "queued" | "processing" | "ready" | "error";
type ExportFormat = "csv" | "xlsx";

const PERIODS: Array<7 | 30 | 90> = [7, 30, 90];

const isExportStatus = (value: string): value is ExportStatus =>
  value === "idle" ||
  value === "queued" ||
  value === "processing" ||
  value === "ready" ||
  value === "error";

const isExportFormat = (value: string): value is ExportFormat =>
  value === "csv" || value === "xlsx";

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
};

export default function AnalyticsPage() {
  const [selectedCampgroundId, setSelectedCampgroundId] = useState<string | null>(null);
  const [selectedCampgroundName, setSelectedCampgroundName] = useState<string | null>(null);
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<ExportStatus>("idle");
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [exportEmail, setExportEmail] = useState<string>("");

  // Read selected campground from localStorage (set by the dashboard switcher)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const readSelection = () => {
      const cgId = localStorage.getItem("campreserv:selectedCampground");
      const cgName = localStorage.getItem("campreserv:selectedCampgroundName"); // optional, if stored elsewhere
      setSelectedCampgroundId(cgId);
      setSelectedCampgroundName(cgName);
    };
    readSelection();
    window.addEventListener("storage", readSelection);
    return () => window.removeEventListener("storage", readSelection);
  }, []);

  useEffect(() => {
    if (!exportJobId || !selectedCampgroundId) return;
    const interval = setInterval(async () => {
      try {
        const job = await apiClient.getReportExport(selectedCampgroundId, exportJobId);
        if (job.downloadUrl) {
          setExportUrl(job.downloadUrl);
        }
        if (job.status === "success") {
          setExportStatus("ready");
          if (job.downloadUrl) {
            setExportUrl(job.downloadUrl);
          }
          clearInterval(interval);
        } else if (job.status === "failed") {
          setExportStatus("error");
          setExportError(job.lastError ?? "Export failed");
          clearInterval(interval);
        } else {
          if (typeof job.status === "string" && isExportStatus(job.status)) {
            setExportStatus(job.status);
          }
        }
      } catch (err: unknown) {
        setExportStatus("error");
        setExportError(getErrorMessage(err) || "Failed to fetch export");
        clearInterval(interval);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [exportJobId, selectedCampgroundId]);

  const metricsQuery = useQuery({
    queryKey: ["dashboard-metrics", selectedCampgroundId, period],
    queryFn: () => apiClient.getDashboardMetrics(selectedCampgroundId!, period),
    enabled: !!selectedCampgroundId,
    refetchInterval: 60000, // Refresh every minute
  });

  const trendQuery = useQuery({
    queryKey: ["revenue-trend", selectedCampgroundId],
    queryFn: () => apiClient.getRevenueTrend(selectedCampgroundId!, 12),
    enabled: !!selectedCampgroundId,
  });

  const forecastQuery = useQuery({
    queryKey: ["occupancy-forecast", selectedCampgroundId],
    queryFn: () => apiClient.getOccupancyForecast(selectedCampgroundId!, 30),
    enabled: !!selectedCampgroundId,
  });

  const taskMetricsQuery = useQuery({
    queryKey: ["task-metrics", selectedCampgroundId],
    queryFn: () => apiClient.getTaskMetrics(selectedCampgroundId!),
    enabled: !!selectedCampgroundId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const metrics = metricsQuery.data;
  const trend = trendQuery.data;
  const forecast = forecastQuery.data;
  const tasks = taskMetricsQuery.data;

  // Calculate max for chart scaling
  const maxRevenue = useMemo(() => {
    if (!trend) return 0;
    return Math.max(...trend.map((t) => t.revenueCents));
  }, [trend]);

  if (!selectedCampgroundId) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Select a campground to view analytics</p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Analytics Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Real-time performance metrics for{" "}
              {selectedCampgroundName ?? "your selected campground"}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            {PERIODS.map((d) => (
              <button
                key={d}
                onClick={() => setPeriod(d)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  period === d
                    ? "bg-emerald-600 text-white"
                    : "bg-card border border-border text-foreground hover:border-emerald-300"
                }`}
              >
                {d}d
              </button>
            ))}
            <select
              value={exportFormat}
              onChange={(e) => {
                if (isExportFormat(e.target.value)) {
                  setExportFormat(e.target.value);
                }
              }}
              className="px-2 py-1.5 rounded-lg border border-border text-sm text-foreground bg-card hover:border-emerald-300 focus:border-emerald-400 focus:outline-none"
            >
              <option value="csv">CSV</option>
              <option value="xlsx">Excel</option>
            </select>
            <input
              type="email"
              placeholder="Email (optional)"
              value={exportEmail}
              onChange={(e) => setExportEmail(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-border text-sm text-foreground bg-card w-52 focus:border-emerald-400 focus:outline-none"
            />
            <button
              onClick={async () => {
                if (!selectedCampgroundId) return;
                try {
                  setExportStatus("queued");
                  setExportError(null);
                  setExportUrl(null);
                  const payload: {
                    format: "csv" | "xlsx";
                    filters: Record<string, unknown>;
                    emailTo?: string[];
                  } = {
                    format: exportFormat,
                    filters: { range: `last_${period}_days`, days: period },
                  };
                  const trimmedEmail = exportEmail.trim();
                  if (trimmedEmail) {
                    payload.emailTo = [trimmedEmail];
                  }
                  const job = await apiClient.queueReportExport(selectedCampgroundId, payload);
                  setExportJobId(job.id);
                } catch (err: unknown) {
                  setExportStatus("error");
                  setExportError(getErrorMessage(err) || "Failed to start export");
                }
              }}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-60"
              disabled={
                !selectedCampgroundId || exportStatus === "processing" || exportStatus === "queued"
              }
            >
              {exportStatus === "processing" || exportStatus === "queued"
                ? "Exporting..."
                : `Export ${exportFormat === "xlsx" ? "XLSX" : "CSV"}`}
            </button>
          </div>
        </div>

        {exportStatus !== "idle" && (
          <div className="text-sm text-muted-foreground flex items-center gap-3">
            {exportStatus === "ready" && exportUrl && (
              <a href={exportUrl} className="text-emerald-700 underline font-medium">
                Download export
              </a>
            )}
            {exportStatus === "error" && (
              <span className="text-red-600">{exportError ?? "Export failed"}</span>
            )}
            {(exportStatus === "queued" || exportStatus === "processing") && (
              <span>Preparing export…</span>
            )}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Revenue"
            value={metrics ? formatCurrency(metrics.revenue.totalCents) : "—"}
            change={metrics?.revenue.changePct}
            loading={metricsQuery.isLoading}
            color="emerald"
          />
          <KpiCard
            label="ADR"
            value={metrics ? formatCurrency(metrics.revenue.adrCents) : "—"}
            subtitle="Avg Daily Rate"
            loading={metricsQuery.isLoading}
            color="blue"
          />
          <KpiCard
            label="RevPAR"
            value={metrics ? formatCurrency(metrics.revenue.revparCents) : "—"}
            subtitle="Revenue per Available Room"
            loading={metricsQuery.isLoading}
            color="violet"
          />
          <KpiCard
            label="Occupancy"
            value={metrics ? `${metrics.occupancy.pct}%` : "—"}
            subtitle={metrics ? `${metrics.occupancy.totalNights} nights sold` : undefined}
            loading={metricsQuery.isLoading}
            color="amber"
          />
        </div>

        {/* Operations Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <QuickStat
            label="Today's Arrivals"
            value={metrics?.today.arrivals ?? 0}
            icon={<PlaneLanding className="h-6 w-6" />}
            href="/check-in-out"
          />
          <QuickStat
            label="Today's Departures"
            value={metrics?.today.departures ?? 0}
            icon={<PlaneTakeoff className="h-6 w-6" />}
            href="/check-in-out"
          />
          <QuickStat
            label="Future Bookings"
            value={metrics?.futureBookings ?? 0}
            icon={<CalendarDays className="h-6 w-6" />}
            href="/reservations"
          />
          <QuickStat
            label="Outstanding Balance"
            value={metrics ? formatCurrency(metrics.balances.outstandingCents) : "—"}
            icon={<DollarSign className="h-6 w-6" />}
            href="/billing/repeat-charges"
          />
          <QuickStat
            label="Total Sites"
            value={metrics?.totalSites ?? 0}
            icon={<Tent className="h-6 w-6" />}
            href="/campgrounds"
          />
        </div>

        {/* Tasks Widget */}
        {tasks && (
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Operations Tasks</h3>
              <Link href="/operations" className="text-sm text-emerald-600 hover:text-emerald-700">
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-5 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-amber-600">{tasks.pending}</div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{tasks.inProgress}</div>
                <div className="text-xs text-muted-foreground">In Progress</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-600">{tasks.completedToday}</div>
                <div className="text-xs text-muted-foreground">Done Today</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">{tasks.atRisk}</div>
                <div className="text-xs text-muted-foreground">At Risk</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{tasks.breached}</div>
                <div className="text-xs text-muted-foreground">SLA Breached</div>
              </div>
            </div>
          </div>
        )}

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Trend */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-semibold text-foreground mb-4">Revenue Trend (12 months)</h3>
            {trendQuery.isLoading ? (
              <div className="h-48 flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
              </div>
            ) : trend && trend.length > 0 ? (
              <div className="h-48 flex items-end gap-1">
                {trend.map((t, i) => {
                  const height = maxRevenue > 0 ? (t.revenueCents / maxRevenue) * 100 : 0;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center group">
                      <div className="relative w-full flex justify-center">
                        <div
                          className="w-full max-w-8 bg-emerald-500 rounded-t transition-all hover:bg-emerald-600"
                          style={{ height: `${Math.max(height, 2)}%` }}
                        />
                        <div className="absolute bottom-full mb-1 hidden group-hover:block bg-muted text-foreground text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                          {formatCurrency(t.revenueCents)} • {t.bookings} bookings
                        </div>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">{t.month}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                No revenue data available
              </div>
            )}
          </div>

          {/* Occupancy Forecast */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-semibold text-foreground mb-4">Occupancy Forecast (30 days)</h3>
            {forecastQuery.isLoading ? (
              <div className="h-48 flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
              </div>
            ) : forecast && forecast.length > 0 ? (
              <div className="h-48 flex items-end gap-0.5">
                {forecast.map((f, i) => {
                  const dayOfWeek = new Date(f.date).getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center group">
                      <div className="relative w-full flex justify-center">
                        <div
                          className={`w-full rounded-t transition-all ${
                            f.pct >= 90
                              ? "bg-red-500"
                              : f.pct >= 70
                                ? "bg-amber-500"
                                : f.pct >= 50
                                  ? "bg-emerald-500"
                                  : "bg-muted"
                          } ${isWeekend ? "opacity-80" : ""}`}
                          style={{ height: `${Math.max(f.pct, 2)}%` }}
                        />
                        <div className="absolute bottom-full mb-1 hidden group-hover:block bg-muted text-foreground text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                          {new Date(f.date).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                          <br />
                          {f.pct}% ({f.occupiedSites}/{f.totalSites})
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                No forecast data available
              </div>
            )}
            <div className="flex justify-center gap-4 mt-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" /> 90%+
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> 70-89%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> 50-69%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-muted" /> &lt;50%
              </span>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickLink
            href="/reports"
            label="Full Reports"
            icon={<BarChart3 className="h-5 w-5" />}
          />
          <QuickLink
            href="/reports/audit"
            label="Audit Log"
            icon={<ScrollText className="h-5 w-5" />}
          />
          <QuickLink
            href="/settings/pricing-rules"
            label="Pricing Rules"
            icon={<DollarSign className="h-5 w-5" />}
          />
          <QuickLink
            href="/settings/deposit-policies"
            label="Deposit Policies"
            icon={<Landmark className="h-5 w-5" />}
          />
        </div>
      </div>
    </DashboardShell>
  );
}

function KpiCard({
  label,
  value,
  change,
  subtitle,
  loading,
  color,
}: {
  label: string;
  value: string;
  change?: number;
  subtitle?: string;
  loading: boolean;
  color: "emerald" | "blue" | "violet" | "amber";
}) {
  const colorClasses = {
    emerald: "border-emerald-200 bg-emerald-50",
    blue: "border-blue-200 bg-blue-50",
    violet: "border-violet-200 bg-violet-50",
    amber: "border-amber-200 bg-amber-50",
  };

  return (
    <div className={`rounded-xl border ${colorClasses[color]} p-4`}>
      {loading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-3 w-20 bg-muted rounded" />
          <div className="h-8 w-24 bg-muted rounded" />
        </div>
      ) : (
        <>
          <div className="text-xs font-medium text-muted-foreground mb-1">{label}</div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-bold text-foreground">{value}</div>
            {change !== undefined && (
              <span
                className={`text-xs font-medium ${change >= 0 ? "text-emerald-600" : "text-red-600"}`}
              >
                {change >= 0 ? "↑" : "↓"} {Math.abs(change)}%
              </span>
            )}
          </div>
          {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
        </>
      )}
    </div>
  );
}

function QuickStat({
  label,
  value,
  icon,
  href,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="bg-card rounded-xl border border-border p-4 hover:border-emerald-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-3">
        <span className="text-emerald-600">{icon}</span>
        <div>
          <div className="text-lg font-bold text-foreground">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </div>
    </Link>
  );
}

function QuickLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-4 bg-card rounded-xl border border-border hover:border-emerald-300 hover:shadow-sm transition-all"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="font-medium text-foreground">{label}</span>
    </Link>
  );
}
