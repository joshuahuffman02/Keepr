"use client";

import { useState, useEffect } from "react";
import {
  DollarSign,
  Users,
  Building2,
  Calendar,
  Clock,
  TrendingUp,
  Download,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  KpiCard,
  TrendChart,
  BreakdownPie,
  DataTable,
  DateRangePicker,
  formatCurrency,
  AiInsightCard,
  AiInsightCardSkeleton,
} from "@/components/analytics";

interface AnalyticsOverview {
  dateRange: { start: string; end: string };
  revenue: {
    totalRevenue: number;
    totalReservations: number;
    averageOrderValue: number;
    revenuePerAvailableNight: number;
    yoyGrowth: number | null;
  };
  guests: {
    totalGuests: number;
    newGuests: number;
    returningGuests: number;
    returnRate: number;
    averageStaysPerGuest: number;
  };
  accommodations: {
    totalSites: number;
    activeReservations: number;
    overallOccupancy: number;
    topPerformingType: string;
  };
  booking: {
    totalBookings: number;
    averageLeadTime: number;
    cancellationRate: number;
    lastMinutePercentage: number;
  };
  los: {
    averageLos: number;
    medianLos: number;
    weeklyStayPercentage: number;
    monthlyStayPercentage: number;
  };
  generatedAt: string;
}

type ChartDatum = Record<string, string | number | null>;

interface RevenueTrend extends ChartDatum {
  month: string;
  revenue: number;
  reservations: number;
}

interface AccommodationMixItem {
  name: string;
  value: number;
  color: string;
}

interface TopCampground extends ChartDatum {
  name: string;
  state: string;
  revenue: number;
  reservations: number;
}

const ACCOMMODATION_COLORS: Record<string, string> = {
  rv: "#3b82f6",
  tent: "#10b981",
  cabin: "#f59e0b",
  glamping: "#8b5cf6",
  default: "#6b7280",
};

interface AiInsights {
  summary: string;
  insights: Array<{
    type: "positive" | "negative" | "neutral" | "warning";
    title: string;
    description: string;
    metric?: { label: string; value: string | number; change?: number };
  }>;
  recommendations: string[];
}

type RevenueTrendApiItem = {
  month?: string;
  period?: string;
  revenue?: number;
  totalRevenue?: number;
  reservations?: number;
  bookings?: number;
};

type TrendsResponse = {
  monthlyTrends?: RevenueTrendApiItem[];
};

type AccommodationMixApiItem = {
  type?: string;
  name?: string;
  percentage?: number;
  value?: number;
};

type AccommodationsResponse = {
  distribution?: AccommodationMixApiItem[];
  byType?: AccommodationMixApiItem[];
};

type BenchmarkTopPerformer = {
  name?: string;
  campgroundName?: string;
  state?: string;
  location?: { state?: string };
  revenue?: number;
  totalRevenue?: number;
  reservations?: number;
  bookings?: number;
};

type BenchmarksResponse = {
  topPerformers?: BenchmarkTopPerformer[];
};

export default function AnalyticsOverviewPage() {
  const [dateRange, setDateRange] = useState("last_12_months");
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [aiInsights, setAiInsights] = useState<AiInsights | null>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [revenueTrends, setRevenueTrends] = useState<RevenueTrend[]>([]);
  const [accommodationMix, setAccommodationMix] = useState<AccommodationMixItem[]>([]);
  const [topCampgrounds, setTopCampgrounds] = useState<TopCampground[]>([]);

  const toNumber = (value: unknown): number | undefined =>
    typeof value === "number" ? value : undefined;
  const formatMoney = (value: unknown): string => {
    const numberValue = toNumber(value);
    return numberValue !== undefined ? formatCurrency(numberValue) : "—";
  };
  const formatCount = (value: unknown): string => {
    const numberValue = toNumber(value);
    return numberValue !== undefined ? numberValue.toLocaleString() : "—";
  };
  const getAccommodationColor = (value: unknown): string => {
    if (typeof value === "string") {
      const key = value.toLowerCase();
      return ACCOMMODATION_COLORS[key] ?? ACCOMMODATION_COLORS.default;
    }
    return ACCOMMODATION_COLORS.default;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all data in parallel
      const [overviewRes, trendsRes, accommodationsRes, benchmarksRes] = await Promise.all([
        fetch(`/api/admin/platform-analytics/overview?range=${dateRange}`),
        fetch(`/api/admin/platform-analytics/revenue/trends?range=${dateRange}`),
        fetch(`/api/admin/platform-analytics/accommodations?range=${dateRange}`),
        fetch(`/api/admin/platform-analytics/benchmarks?range=${dateRange}`),
      ]);

      // Process overview
      if (overviewRes.ok) {
        const result = await overviewRes.json();
        setData(result);
        setHasData(result.revenue?.totalRevenue > 0);
      }

      // Process revenue trends
      if (trendsRes.ok) {
        const trendsData: TrendsResponse = await trendsRes.json();
        const monthlyTrends = trendsData.monthlyTrends;
        if (monthlyTrends && Array.isArray(monthlyTrends)) {
          setRevenueTrends(
            monthlyTrends.map((t) => ({
              month: t.month ?? t.period ?? "",
              revenue: t.revenue || t.totalRevenue || 0,
              reservations: t.reservations || t.bookings || 0,
            })),
          );
        }
      }

      // Process accommodation mix
      if (accommodationsRes.ok) {
        const accData: AccommodationsResponse = await accommodationsRes.json();
        if (accData.distribution && Array.isArray(accData.distribution)) {
          setAccommodationMix(
            accData.distribution.map((item) => ({
              name: item.type || item.name || "Unknown",
              value: Math.round(item.percentage || item.value || 0),
              color: getAccommodationColor(item.type ?? item.name),
            })),
          );
        } else if (accData.byType && Array.isArray(accData.byType)) {
          setAccommodationMix(
            accData.byType.map((item) => ({
              name: item.type || item.name || "Unknown",
              value: Math.round(item.percentage || item.value || 0),
              color: getAccommodationColor(item.type ?? item.name),
            })),
          );
        }
      }

      // Process top campgrounds from benchmarks
      if (benchmarksRes.ok) {
        const benchData: BenchmarksResponse = await benchmarksRes.json();
        if (benchData.topPerformers && Array.isArray(benchData.topPerformers)) {
          setTopCampgrounds(
            benchData.topPerformers.slice(0, 5).map((c) => ({
              name: c.name || c.campgroundName || "Unknown",
              state: c.state || c.location?.state || "—",
              revenue: c.revenue || c.totalRevenue || 0,
              reservations: c.reservations || c.bookings || 0,
            })),
          );
        }
      }
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
      setHasData(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchAiInsights = async () => {
    setAiLoading(true);
    try {
      const [suggestionsRes, anomaliesRes] = await Promise.all([
        fetch(`/api/admin/platform-analytics/ai/suggestions?range=${dateRange}`),
        fetch(`/api/admin/platform-analytics/ai/anomalies?range=${dateRange}`),
      ]);

      const suggestions = suggestionsRes.ok ? await suggestionsRes.json() : [];
      const anomalies = anomaliesRes.ok ? await anomaliesRes.json() : [];

      // Build insights from anomalies and suggestions
      const insights: AiInsights["insights"] = [];

      // Add anomaly-based insights
      for (const anomaly of anomalies.slice(0, 2)) {
        insights.push({
          type: anomaly.severity === "critical" ? "negative" : "warning",
          title: anomaly.campgroundName
            ? `${anomaly.campgroundName}: ${anomaly.type.replace("_", " ")}`
            : anomaly.type.replace("_", " "),
          description: anomaly.message,
          metric: {
            label: "Current",
            value: anomaly.currentValue,
            change: -Math.round(anomaly.deviationPercent),
          },
        });
      }

      // Add suggestion-based insights for struggling parks
      if (suggestions.length > 0) {
        const worstPark = suggestions[0];
        insights.push({
          type: worstPark.npsScore < 0 ? "negative" : "warning",
          title: `${worstPark.campgroundName} needs attention`,
          description: `NPS score of ${worstPark.npsScore} with ${worstPark.detractorCount} detractors. Top issues: ${worstPark.primaryIssues.join(", ")}`,
          metric: { label: "NPS", value: worstPark.npsScore },
        });
      }

      // Generate summary
      const summary =
        anomalies.length > 0 || suggestions.length > 0
          ? `Detected ${anomalies.length} anomalies and ${suggestions.length} campgrounds needing improvement. ${
              anomalies.some((a: { severity: string }) => a.severity === "critical")
                ? "Critical issues require immediate attention."
                : suggestions.length > 0
                  ? "Focus on the lowest-performing properties to improve platform health."
                  : "Platform metrics are within normal ranges."
            }`
          : "Platform performance is healthy. No critical anomalies detected and guest satisfaction metrics are stable.";

      // Gather recommendations
      const recommendations: string[] = [];
      for (const anomaly of anomalies.slice(0, 2)) {
        if (anomaly.recommendations?.[0]) {
          recommendations.push(anomaly.recommendations[0]);
        }
      }
      if (suggestions[0]?.suggestions?.[0]) {
        recommendations.push(
          `${suggestions[0].campgroundName}: ${suggestions[0].suggestions[0].title}`,
        );
      }

      setAiInsights({
        summary,
        insights,
        recommendations: recommendations.slice(0, 3),
      });
    } catch (error) {
      console.error("Failed to fetch AI insights:", error);
      // Set default insights
      setAiInsights({
        summary:
          "Unable to load AI insights at this time. Platform analytics are still available below.",
        insights: [],
        recommendations: [],
      });
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchAiInsights();
  }, [dateRange]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">Analytics Hub</h1>
            {!hasData && !loading && (
              <Badge className="bg-muted/20 text-muted-foreground border border-border/50">
                No Data Yet
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">Platform-wide analytics and insights</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            className="border-border text-muted-foreground hover:bg-muted"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => (window.location.href = "/admin/analytics/export")}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* AI Insights */}
      {aiLoading ? (
        <AiInsightCardSkeleton />
      ) : aiInsights ? (
        <AiInsightCard
          title="Platform Health Summary"
          summary={aiInsights.summary}
          insights={aiInsights.insights}
          recommendations={aiInsights.recommendations}
          onRefresh={fetchAiInsights}
          isLoading={aiLoading}
        />
      ) : null}

      {/* Revenue KPIs */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-400" />
          Revenue Intelligence
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Total Revenue"
            value={data?.revenue.totalRevenue || 0}
            change={data?.revenue.yoyGrowth}
            changeLabel="YoY"
            format="currency"
            loading={loading}
            icon={<DollarSign className="h-5 w-5 text-green-400" />}
          />
          <KpiCard
            title="Total Reservations"
            value={data?.revenue.totalReservations || 0}
            format="number"
            loading={loading}
            icon={<Calendar className="h-5 w-5 text-blue-400" />}
          />
          <KpiCard
            title="Average Order Value"
            value={data?.revenue.averageOrderValue || 0}
            format="currency"
            loading={loading}
            icon={<TrendingUp className="h-5 w-5 text-purple-400" />}
          />
          <KpiCard
            title="RevPAN"
            value={data?.revenue.revenuePerAvailableNight || 0}
            format="currency"
            loading={loading}
            subtitle="Revenue per Available Night"
            icon={<Building2 className="h-5 w-5 text-amber-400" />}
          />
        </div>
      </div>

      {/* Guest & Booking KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-400" />
            Guest Insights
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <KpiCard
              title="Total Guests"
              value={data?.guests.totalGuests || 0}
              format="number"
              loading={loading}
            />
            <KpiCard
              title="Return Rate"
              value={data?.guests.returnRate || 0}
              format="percent"
              loading={loading}
            />
            <KpiCard
              title="New Guests"
              value={data?.guests.newGuests || 0}
              format="number"
              loading={loading}
            />
            <KpiCard
              title="Avg Stays/Guest"
              value={data?.guests.averageStaysPerGuest || 0}
              format="number"
              loading={loading}
            />
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-purple-400" />
            Booking Behavior
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <KpiCard
              title="Avg Lead Time"
              value={data?.booking.averageLeadTime || 0}
              format="days"
              loading={loading}
            />
            <KpiCard
              title="Cancellation Rate"
              value={data?.booking.cancellationRate || 0}
              format="percent"
              loading={loading}
            />
            <KpiCard
              title="Avg Length of Stay"
              value={data?.los.averageLos || 0}
              format="days"
              loading={loading}
            />
            <KpiCard
              title="Occupancy Rate"
              value={data?.accommodations.overallOccupancy || 0}
              format="percent"
              loading={loading}
            />
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {revenueTrends.length > 0 ? (
            <TrendChart
              title="Revenue Trends"
              description="Monthly revenue over time"
              data={revenueTrends}
              dataKeys={[{ key: "revenue", color: "#3b82f6", name: "Revenue" }]}
              xAxisKey="month"
              type="area"
              height={300}
              formatYAxis={(v) => `$${(v / 1000).toFixed(0)}K`}
              formatTooltip={(v) => formatCurrency(v)}
              loading={loading}
            />
          ) : (
            <div className="bg-muted/50 border border-border rounded-lg p-8 h-[300px] flex items-center justify-center">
              <div className="text-center">
                <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No revenue data available yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Revenue trends will appear once you have bookings
                </p>
              </div>
            </div>
          )}
        </div>
        {accommodationMix.length > 0 ? (
          <BreakdownPie
            title="Accommodation Mix"
            description="Revenue distribution by type"
            data={accommodationMix}
            height={300}
            formatValue={(v) => `${v}%`}
            loading={loading}
          />
        ) : (
          <div className="bg-muted/50 border border-border rounded-lg p-8 h-[300px] flex items-center justify-center">
            <div className="text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No accommodation data yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Distribution will appear with bookings
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Top Campgrounds Table */}
      {topCampgrounds.length > 0 ? (
        <DataTable
          title="Top Performing Campgrounds"
          description="Ranked by total revenue"
          columns={[
            { key: "name", label: "Campground" },
            { key: "state", label: "State", align: "center" },
            {
              key: "revenue",
              label: "Revenue",
              align: "right",
              format: (v) => formatMoney(v),
            },
            {
              key: "reservations",
              label: "Reservations",
              align: "right",
              format: (v) => formatCount(v),
            },
          ]}
          data={topCampgrounds}
          loading={loading}
          maxRows={5}
        />
      ) : (
        <div className="bg-muted/50 border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground mb-2">Top Performing Campgrounds</h3>
          <p className="text-muted-foreground">
            No campground performance data available yet. Rankings will appear once you have active
            campgrounds with bookings.
          </p>
        </div>
      )}

      {/* Quick Stats Footer */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border">
        <div className="text-center">
          <p className="text-2xl font-bold text-foreground">
            {data?.accommodations.totalSites?.toLocaleString() || "—"}
          </p>
          <p className="text-sm text-muted-foreground">Total Sites</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-foreground">
            {data?.los.weeklyStayPercentage?.toFixed(1) || "—"}%
          </p>
          <p className="text-sm text-muted-foreground">Weekly Stays</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-foreground">
            {data?.booking.lastMinutePercentage?.toFixed(1) || "—"}%
          </p>
          <p className="text-sm text-muted-foreground">Last-Minute Bookings</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-foreground capitalize">
            {data?.accommodations.topPerformingType || "—"}
          </p>
          <p className="text-sm text-muted-foreground">Top Site Type</p>
        </div>
      </div>
    </div>
  );
}
