"use client";

import { useState, useEffect } from "react";
import { Building2, Truck, Tent, Home, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  KpiCard,
  TrendChart,
  BreakdownPie,
  DataTable,
  DateRangePicker,
  formatCurrency,
} from "@/components/analytics";

export default function AccommodationsPage() {
  const [dateRange, setDateRange] = useState("last_12_months");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/platform-analytics/accommodations?range=${dateRange}`);
        if (response.ok) {
          const result = await response.json();
          setData(result);
        }
      } catch (error) {
        console.error("Failed to fetch accommodation data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dateRange]);

  const typeIcons: Record<string, React.ReactNode> = {
    rv: <Truck className="h-5 w-5 text-blue-400" />,
    tent: <Tent className="h-5 w-5 text-green-400" />,
    cabin: <Home className="h-5 w-5 text-amber-400" />,
    glamping: <Sparkles className="h-5 w-5 text-purple-400" />,
  };

  const pieData = (data?.typeDistribution || []).map((item: any) => ({
    name: item.type.charAt(0).toUpperCase() + item.type.slice(1),
    value: item.revenueShare,
  }));

  const utilizationData = (data?.utilizationByType?.months || []).map((month: string, idx: number) => ({
    month,
    rv: data?.utilizationByType?.byType?.rv?.[idx] || 0,
    tent: data?.utilizationByType?.byType?.tent?.[idx] || 0,
    cabin: data?.utilizationByType?.byType?.cabin?.[idx] || 0,
    glamping: data?.utilizationByType?.byType?.glamping?.[idx] || 0,
  }));

  const hasData = data && data.overview && data.overview.totalSites > 0;

  if (!loading && !hasData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Accommodation Mix</h1>
            <p className="text-muted-foreground mt-1">
              Site types, RV breakdown, and utilization analysis
            </p>
          </div>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No Accommodation Data Available</h3>
          <p className="text-muted-foreground max-w-md">
            There is no accommodation data for the selected time period. Data will appear here once sites are configured.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Accommodation Mix</h1>
          <p className="text-muted-foreground mt-1">
            Site types, RV breakdown, and utilization analysis
          </p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Sites"
          value={data?.overview?.totalSites || 0}
          format="number"
          loading={loading}
          icon={<Building2 className="h-5 w-5 text-blue-400" />}
        />
        <KpiCard
          title="Active Reservations"
          value={data?.overview?.activeReservations || 0}
          format="number"
          loading={loading}
        />
        <KpiCard
          title="Overall Occupancy"
          value={data?.overview?.overallOccupancy || 0}
          format="percent"
          loading={loading}
        />
        <KpiCard
          title="Top Performer"
          value={data?.overview?.topPerformingType?.toUpperCase() || "N/A"}
          loading={loading}
          subtitle="Highest revenue type"
        />
      </div>

      {/* Type Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DataTable
            title="Site Type Performance"
            description="Revenue and occupancy by accommodation type"
            columns={[
              {
                key: "type",
                label: "Type",
                format: (v) => (
                  <div className="flex items-center gap-2">
                    {typeIcons[v]}
                    <span className="capitalize">{v}</span>
                  </div>
                ),
              },
              { key: "siteCount", label: "Sites", align: "right", format: (v) => v.toLocaleString() },
              { key: "reservations", label: "Reservations", align: "right", format: (v) => v.toLocaleString() },
              { key: "revenue", label: "Revenue", align: "right", format: (v) => formatCurrency(v) },
              { key: "occupancyRate", label: "Occupancy", align: "right", format: (v) => `${v.toFixed(1)}%` },
            ]}
            data={data?.typeDistribution || []}
            loading={loading}
          />
        </div>
        <BreakdownPie
          title="Revenue Share"
          description="By accommodation type"
          data={pieData}
          height={300}
          formatValue={(v) => `${v.toFixed(1)}%`}
          loading={loading}
        />
      </div>

      {/* Utilization Over Time */}
      <TrendChart
        title="Occupancy by Type Over Time"
        description="Monthly utilization rates by accommodation type"
        data={utilizationData}
        dataKeys={[
          { key: "rv", color: "#3b82f6", name: "RV" },
          { key: "tent", color: "#10b981", name: "Tent" },
          { key: "cabin", color: "#f59e0b", name: "Cabin" },
          { key: "glamping", color: "#8b5cf6", name: "Glamping" },
        ]}
        xAxisKey="month"
        type="line"
        height={300}
        formatYAxis={(v) => `${v}%`}
        formatTooltip={(v) => `${v.toFixed(1)}%`}
        loading={loading}
      />

      {/* RV Type Breakdown */}
      <DataTable
        title="RV Type Breakdown"
        description="Detailed analysis of RV types used by guests"
        columns={[
          { key: "rigType", label: "RV Type" },
          { key: "count", label: "Reservations", align: "right", format: (v) => v.toLocaleString() },
          { key: "percentage", label: "% of Total", align: "right", format: (v) => `${v.toFixed(1)}%` },
          { key: "averageLength", label: "Avg Length (ft)", align: "right", format: (v) => v.toString() },
          { key: "averageSpend", label: "Avg Spend", align: "right", format: (v) => formatCurrency(v) },
        ]}
        data={data?.rigTypes || []}
        loading={loading}
      />
    </div>
  );
}
