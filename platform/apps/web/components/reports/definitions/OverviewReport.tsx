import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { KpiCard, TrendChart, BreakdownPie, formatCurrency } from "@/components/analytics";
import {
  DollarSign,
  TrendingUp,
  Percent,
  Calendar,
  Home,
  AlertTriangle,
  Wrench,
  Users,
  Star,
} from "lucide-react";
import {
  addDays,
  differenceInCalendarDays,
  eachMonthOfInterval,
  endOfDay,
  format,
  isSameDay,
  startOfDay,
  subYears,
} from "date-fns";

interface OverviewReportProps {
  campgroundId: string;
  dateRange?: { start: string; end: string };
}

type Reservation = Awaited<ReturnType<typeof apiClient.getReservations>>[number];

const formatCurrencyLocal = (value: number, decimals: number = 0) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

const formatRangeLabel = (range: { start: string; end: string }) => {
  const start = new Date(range.start);
  const end = new Date(range.end);
  if (isSameDay(start, end)) {
    return format(start, "MMM d, yyyy");
  }
  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = format(start, sameYear ? "MMM d" : "MMM d, yyyy");
  const endLabel = format(end, "MMM d, yyyy");
  return `${startLabel} – ${endLabel}`;
};

export function OverviewReport({ campgroundId, dateRange }: OverviewReportProps) {
  const summaryQuery = useQuery({
    queryKey: ["reports-summary", campgroundId],
    queryFn: () => apiClient.getDashboardSummary(campgroundId),
    enabled: !!campgroundId,
  });

  const npsMetricsQuery = useQuery({
    queryKey: ["nps-metrics", campgroundId],
    queryFn: () => apiClient.getNpsMetrics(campgroundId),
    enabled: !!campgroundId,
  });

  const reservationsQuery = useQuery({
    queryKey: ["reservations-all", campgroundId],
    queryFn: () => apiClient.getReservations(campgroundId),
    enabled: !!campgroundId,
  });

  const sitesQuery = useQuery({
    queryKey: ["sites", campgroundId],
    queryFn: () => apiClient.getSites(campgroundId),
    enabled: !!campgroundId,
  });

  const rangeContext = useMemo(() => {
    if (!dateRange || !reservationsQuery.data || !sitesQuery.data) return null;

    const start = startOfDay(new Date(dateRange.start));
    const end = startOfDay(new Date(dateRange.end));
    const endExclusive = addDays(end, 1);
    const rangeNights = Math.max(1, differenceInCalendarDays(endExclusive, start));
    const rangeLabel = formatRangeLabel(dateRange);

    const reservationsInRange = reservationsQuery.data.filter((r: Reservation) => {
      if (r.status === "cancelled") return false;
      const arrival = startOfDay(new Date(r.arrivalDate));
      return arrival >= start && arrival <= end;
    });

    let occupiedNights = 0;
    let revenue = 0;

    reservationsQuery.data.forEach((r: Reservation) => {
      if (r.status === "cancelled") return;
      const arrival = startOfDay(new Date(r.arrivalDate));
      const departure = startOfDay(new Date(r.departureDate));
      const reservationNights = Math.max(1, differenceInCalendarDays(departure, arrival));

      const overlapStart = arrival > start ? arrival : start;
      const overlapEnd = departure < endExclusive ? departure : endExclusive;
      const overlapNights = Math.max(0, differenceInCalendarDays(overlapEnd, overlapStart));

      if (overlapNights <= 0) return;
      occupiedNights += overlapNights;

      const totalAmount = (r.totalAmount || 0) / 100;
      revenue += totalAmount * (overlapNights / reservationNights);
    });

    const availableNights = sitesQuery.data.length * rangeNights;
    const occupancy = availableNights > 0 ? (occupiedNights / availableNights) * 100 : 0;
    const adr = occupiedNights > 0 ? revenue / occupiedNights : 0;
    const revpar = availableNights > 0 ? revenue / availableNights : 0;

    return {
      start,
      end,
      rangeLabel,
      reservationsInRange,
      revenue,
      adr,
      revpar,
      occupancy,
      bookings: reservationsInRange.length,
    };
  }, [dateRange, reservationsQuery.data, sitesQuery.data]);

  const cards = useMemo(() => {
    if (!summaryQuery.data) return [];
    const s = summaryQuery.data;
    return [
      { label: "Revenue (30d)", value: formatCurrencyLocal(s.revenue) },
      { label: "ADR", value: formatCurrencyLocal(s.adr) },
      { label: "RevPAR", value: formatCurrencyLocal(s.revpar) },
      { label: "Occupancy", value: `${s.occupancy}%` },
      { label: "Future reservations", value: s.futureReservations },
      { label: "Sites", value: s.sites },
      { label: "Overdue balance", value: formatCurrencyLocal(s.overdueBalance) },
      { label: "Maintenance open", value: s.maintenanceOpen },
      { label: "Maintenance overdue", value: s.maintenanceOverdue },
    ];
  }, [summaryQuery.data]);

  // Year-over-year comparison
  const yearOverYearStats = useMemo(() => {
    if (!reservationsQuery.data) return null;

    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), 0, 1);
    const defaultEnd = new Date(now.getFullYear(), 11, 31);
    const rangeStart = dateRange ? startOfDay(new Date(dateRange.start)) : defaultStart;
    const rangeEnd = dateRange ? endOfDay(new Date(dateRange.end)) : defaultEnd;
    const prevStart = subYears(rangeStart, 1);
    const prevEnd = subYears(rangeEnd, 1);

    const thisPeriod = reservationsQuery.data.filter((r: Reservation) => {
      if (r.status === "cancelled") return false;
      const arrival = new Date(r.arrivalDate);
      return arrival >= rangeStart && arrival <= rangeEnd;
    });

    const lastPeriod = reservationsQuery.data.filter((r: Reservation) => {
      if (r.status === "cancelled") return false;
      const arrival = new Date(r.arrivalDate);
      return arrival >= prevStart && arrival <= prevEnd;
    });

    const thisRevenue =
      thisPeriod.reduce((sum: number, r: Reservation) => sum + (r.totalAmount || 0), 0) / 100;
    const lastRevenue =
      lastPeriod.reduce((sum: number, r: Reservation) => sum + (r.totalAmount || 0), 0) / 100;

    const revenueChange =
      lastRevenue > 0 ? (((thisRevenue - lastRevenue) / lastRevenue) * 100).toFixed(1) : "0";

    return {
      thisYear: { bookings: thisPeriod.length, revenue: thisRevenue },
      lastYear: { bookings: lastPeriod.length, revenue: lastRevenue },
      change: {
        bookings: thisPeriod.length - lastPeriod.length,
        revenuePercent: revenueChange,
      },
    };
  }, [dateRange, reservationsQuery.data]);

  // Seasonal stats (Derived)
  const seasonalStats = useMemo(() => {
    const reservations = rangeContext?.reservationsInRange ?? reservationsQuery.data;
    if (!reservations) return null;

    const stats: Record<string, { revenue: number; bookings: number; nights: number }> = {
      Spring: { revenue: 0, bookings: 0, nights: 0 },
      Summer: { revenue: 0, bookings: 0, nights: 0 },
      Fall: { revenue: 0, bookings: 0, nights: 0 },
      Winter: { revenue: 0, bookings: 0, nights: 0 },
    };

    const getSeason = (date: Date) => {
      const month = date.getMonth();
      if (month >= 2 && month <= 4) return "Spring";
      if (month >= 5 && month <= 7) return "Summer";
      if (month >= 8 && month <= 10) return "Fall";
      return "Winter";
    };

    reservations.forEach((r: Reservation) => {
      if (r.status === "cancelled") return;
      const arrival = new Date(r.arrivalDate);
      const departure = new Date(r.departureDate);
      const season = getSeason(arrival);

      const rev = (r.totalAmount || 0) / 100;
      const nights = Math.max(
        1,
        Math.ceil((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24)),
      );

      stats[season].revenue += rev;
      stats[season].bookings += 1;
      stats[season].nights += nights;
    });

    return Object.entries(stats).map(([season, data]) => ({
      season,
      revenue: data.revenue,
      bookings: data.bookings,
      avgNights: data.bookings > 0 ? (data.nights / data.bookings).toFixed(1) : "0",
    }));
  }, [rangeContext, reservationsQuery.data]);

  // Monthly revenue trend data for charts
  const monthlyRevenueTrend = useMemo(() => {
    if (!reservationsQuery.data) return [];

    if (rangeContext) {
      const labelFormat =
        rangeContext.start.getFullYear() === rangeContext.end.getFullYear() ? "MMM" : "MMM yyyy";
      const months = eachMonthOfInterval({ start: rangeContext.start, end: rangeContext.end });
      const totals = new Map<string, number>();
      months.forEach((month) => totals.set(format(month, labelFormat), 0));

      rangeContext.reservationsInRange.forEach((r: Reservation) => {
        if (r.status === "cancelled") return;
        const arrival = new Date(r.arrivalDate);
        if (arrival < rangeContext.start || arrival > rangeContext.end) return;
        const key = format(new Date(arrival.getFullYear(), arrival.getMonth(), 1), labelFormat);
        totals.set(key, (totals.get(key) ?? 0) + (r.totalAmount || 0) / 100);
      });

      return months.map((month) => {
        const key = format(month, labelFormat);
        return { month: key, revenue: totals.get(key) ?? 0 };
      });
    }

    const now = new Date();
    const months: Record<string, number> = {};

    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = date.toLocaleDateString("en-US", { month: "short" });
      months[key] = 0;
    }

    reservationsQuery.data.forEach((r: Reservation) => {
      if (r.status === "cancelled") return;
      const arrival = new Date(r.arrivalDate);
      const key = arrival.toLocaleDateString("en-US", { month: "short" });
      if (key in months) {
        months[key] += (r.totalAmount || 0) / 100;
      }
    });

    return Object.entries(months).map(([month, revenue]) => ({ month, revenue }));
  }, [rangeContext, reservationsQuery.data]);

  // Status breakdown for pie chart
  const statusBreakdown = useMemo(() => {
    const reservations = rangeContext?.reservationsInRange ?? reservationsQuery.data;
    if (!reservations) return [];

    const statusCounts: Record<string, number> = {};
    reservations.forEach((r: Reservation) => {
      const status = r.status || "unknown";
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    const colors: Record<string, string> = {
      confirmed: "#10b981",
      checked_in: "#3b82f6",
      checked_out: "#8b5cf6",
      pending: "#f59e0b",
      cancelled: "#ef4444",
      unknown: "#6b7280",
    };

    return Object.entries(statusCounts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1).replace("_", " "),
      value,
      color: colors[name] || "#6b7280",
    }));
  }, [rangeContext, reservationsQuery.data]);

  const isLoading = dateRange
    ? reservationsQuery.isLoading || sitesQuery.isLoading
    : summaryQuery.isLoading;

  if (summaryQuery.error && !dateRange) {
    return (
      <div className="rounded-lg border border-amber-600/50 bg-amber-900/20 px-4 py-3 text-sm text-amber-400">
        Some report data failed to load. Try again or refresh.
      </div>
    );
  }

  const primaryStats = rangeContext ?? null;
  const totalSites = sitesQuery.data?.length ?? summaryQuery.data?.sites ?? 0;
  const revenueTitle = dateRange ? "Revenue" : "Revenue (30d)";
  const bookingsTitle = dateRange ? "Bookings" : "Future Reservations";

  return (
    <div className="space-y-6">
      {/* Overview KPI Cards - Admin Analytics Style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard
          title={revenueTitle}
          value={primaryStats?.revenue ?? summaryQuery.data?.revenue ?? 0}
          format="currency"
          loading={isLoading}
          icon={<DollarSign className="h-5 w-5 text-green-400" />}
          subtitle={primaryStats?.rangeLabel}
        />
        <KpiCard
          title="ADR"
          value={primaryStats?.adr ?? summaryQuery.data?.adr ?? 0}
          format="currency"
          loading={isLoading}
          icon={<TrendingUp className="h-5 w-5 text-blue-400" />}
          subtitle={primaryStats?.rangeLabel ?? "Average Daily Rate"}
        />
        <KpiCard
          title="RevPAR"
          value={primaryStats?.revpar ?? summaryQuery.data?.revpar ?? 0}
          format="currency"
          loading={isLoading}
          subtitle={primaryStats?.rangeLabel ?? "Revenue per Available"}
        />
        <KpiCard
          title="Occupancy"
          value={primaryStats?.occupancy ?? summaryQuery.data?.occupancy ?? 0}
          format="percent"
          loading={isLoading}
          icon={<Percent className="h-5 w-5 text-amber-400" />}
          subtitle={primaryStats?.rangeLabel}
        />
        <KpiCard
          title={bookingsTitle}
          value={primaryStats?.bookings ?? summaryQuery.data?.futureReservations ?? 0}
          format="number"
          loading={isLoading}
          icon={<Calendar className="h-5 w-5 text-purple-400" />}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Sites"
          value={totalSites}
          format="number"
          loading={sitesQuery.isLoading}
          icon={<Home className="h-5 w-5 text-muted-foreground" />}
        />
        <KpiCard
          title="Overdue Balance"
          value={summaryQuery.data?.overdueBalance ?? 0}
          format="currency"
          loading={isLoading}
          icon={<AlertTriangle className="h-5 w-5 text-red-400" />}
          subtitle={dateRange ? "Current" : undefined}
        />
        <KpiCard
          title="Maintenance Open"
          value={summaryQuery.data?.maintenanceOpen ?? 0}
          format="number"
          loading={isLoading}
          icon={<Wrench className="h-5 w-5 text-amber-400" />}
          subtitle={dateRange ? "Current" : undefined}
        />
        <KpiCard
          title="Maintenance Overdue"
          value={summaryQuery.data?.maintenanceOverdue ?? 0}
          format="number"
          loading={isLoading}
          icon={<Wrench className="h-5 w-5 text-red-400" />}
          subtitle={dateRange ? "Current" : undefined}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TrendChart
            title="Revenue Trend"
            description={
              rangeContext
                ? "Monthly revenue for the selected range"
                : "Monthly revenue over the last 6 months"
            }
            data={monthlyRevenueTrend}
            dataKeys={[{ key: "revenue", color: "#10b981", name: "Revenue" }]}
            xAxisKey="month"
            type="area"
            height={300}
            formatYAxis={(v) => `$${(v / 1000).toFixed(0)}K`}
            formatTooltip={(v) => formatCurrency(v)}
            loading={reservationsQuery.isLoading}
          />
        </div>
        <BreakdownPie
          title="Reservations by Status"
          description="Current status distribution"
          data={statusBreakdown}
          height={300}
          formatValue={(v) => `${v} reservations`}
          loading={reservationsQuery.isLoading}
        />
      </div>

      {/* NPS Metrics - Updated to dark theme */}
      {npsMetricsQuery.data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            title="NPS Score"
            value={npsMetricsQuery.data.nps ?? 0}
            format="number"
            loading={npsMetricsQuery.isLoading}
            icon={<Star className="h-5 w-5 text-yellow-400" />}
            subtitle={`Promoters ${npsMetricsQuery.data.promoters} · Detractors ${npsMetricsQuery.data.detractors}`}
          />
          <KpiCard
            title="Survey Responses"
            value={npsMetricsQuery.data.totalResponses ?? 0}
            format="number"
            loading={npsMetricsQuery.isLoading}
            icon={<Users className="h-5 w-5 text-blue-400" />}
            subtitle={`${npsMetricsQuery.data.responseRate ?? 0}% response rate`}
          />
          <KpiCard
            title="Passives"
            value={npsMetricsQuery.data.passives ?? 0}
            format="number"
            loading={npsMetricsQuery.isLoading}
            subtitle="Balanced feedback"
          />
        </div>
      )}

      {/* Year-over-Year Comparison */}
      {yearOverYearStats && (
        <div className="rounded-xl border border-border bg-card shadow-sm p-4 space-y-3">
          <div>
            <div className="text-lg font-semibold text-foreground">Year-over-Year Comparison</div>
            <div className="text-sm text-muted-foreground">
              {new Date().getFullYear()} vs {new Date().getFullYear() - 1}
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase">This Year</div>
              <div className="rounded-lg border border-primary/20 bg-primary/10 p-3">
                <div className="text-xs text-primary mb-1">Bookings</div>
                <div className="text-2xl font-bold text-foreground">
                  {yearOverYearStats.thisYear.bookings}
                </div>
              </div>
              <div className="rounded-lg border border-status-success/30 bg-status-success/10 p-3">
                <div className="text-xs text-status-success mb-1">Revenue</div>
                <div className="text-2xl font-bold text-foreground">
                  {formatCurrencyLocal(yearOverYearStats.thisYear.revenue, 0)}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase">Last Year</div>
              <div className="rounded-lg border border-border bg-muted p-3">
                <div className="text-xs text-muted-foreground mb-1">Bookings</div>
                <div className="text-2xl font-bold text-foreground">
                  {yearOverYearStats.lastYear.bookings}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted p-3">
                <div className="text-xs text-muted-foreground mb-1">Revenue</div>
                <div className="text-2xl font-bold text-foreground">
                  {formatCurrencyLocal(yearOverYearStats.lastYear.revenue, 0)}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase">Growth</div>
              <div
                className={`rounded-lg border p-3 ${yearOverYearStats.change.bookings >= 0 ? "bg-status-success/10 border-status-success/30" : "bg-status-error/10 border-status-error/30"}`}
              >
                <div
                  className={`text-xs mb-1 ${yearOverYearStats.change.bookings >= 0 ? "text-status-success" : "text-status-error"}`}
                >
                  Bookings
                </div>
                <div
                  className={`text-2xl font-bold ${yearOverYearStats.change.bookings >= 0 ? "text-status-success" : "text-status-error"}`}
                >
                  {yearOverYearStats.change.bookings >= 0 ? "+" : ""}
                  {yearOverYearStats.change.bookings}
                </div>
              </div>
              <div
                className={`rounded-lg border p-3 ${parseFloat(yearOverYearStats.change.revenuePercent) >= 0 ? "bg-status-success/10 border-status-success/30" : "bg-status-error/10 border-status-error/30"}`}
              >
                <div
                  className={`text-xs mb-1 ${parseFloat(yearOverYearStats.change.revenuePercent) >= 0 ? "text-status-success" : "text-status-error"}`}
                >
                  Revenue
                </div>
                <div
                  className={`text-2xl font-bold ${parseFloat(yearOverYearStats.change.revenuePercent) >= 0 ? "text-status-success" : "text-status-error"}`}
                >
                  {parseFloat(yearOverYearStats.change.revenuePercent) >= 0 ? "+" : ""}
                  {yearOverYearStats.change.revenuePercent}%
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Seasonal Performance */}
      {seasonalStats && (
        <div className="rounded-xl border border-border bg-card shadow-sm p-4 space-y-3">
          <div>
            <div className="text-lg font-semibold text-foreground">Seasonal Performance</div>
            <div className="text-sm text-muted-foreground">Revenue and bookings by season</div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {seasonalStats.map(({ season, revenue, bookings, avgNights }) => {
              const colorMap: Record<string, string> = {
                Spring: "bg-status-success/10 border-status-success/30",
                Summer: "bg-status-warning/10 border-status-warning/30",
                Fall: "bg-status-info/10 border-status-info/30",
                Winter: "bg-primary/10 border-primary/20",
              };
              const textColorMap: Record<string, string> = {
                Spring: "text-status-success",
                Summer: "text-status-warning",
                Fall: "text-status-info",
                Winter: "text-primary",
              };
              return (
                <div
                  key={season}
                  className={`rounded-xl border shadow-sm ${colorMap[season]} p-3 space-y-2`}
                >
                  <div className={`text-sm font-bold ${textColorMap[season]}`}>{season}</div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Revenue</div>
                    <div className="text-lg font-bold text-foreground">
                      {formatCurrencyLocal(revenue, 0)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Bookings</div>
                      <div className="font-semibold text-muted-foreground">{bookings}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Avg Nights</div>
                      <div className="font-semibold text-muted-foreground">{avgNights}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
