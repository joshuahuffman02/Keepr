"use client";

import { useState, useEffect } from "react";
import { DollarSign, TrendingUp, Building2, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  KpiCard,
  TrendChart,
  BreakdownPie,
  DataTable,
  DateRangePicker,
  formatCurrency,
} from "@/components/analytics";

export default function RevenueIntelligencePage() {
  const [dateRange, setDateRange] = useState("last_12_months");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/platform-analytics/revenue?range=${dateRange}`);
        if (response.ok) {
          const result = await response.json();
          setData(result);
        }
      } catch (error) {
        console.error("Failed to fetch revenue data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dateRange]);

  const pieData = data?.byAccommodationType?.map((item: any, idx: number) => ({
    name: item.type.charAt(0).toUpperCase() + item.type.slice(1),
    value: item.percentage,
  })) || [];

  const hasData = data && data.overview && data.overview.totalRevenue > 0;

  if (!loading && !hasData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Revenue Intelligence</h1>
            <p className="text-slate-400 mt-1">
              Deep dive into platform revenue metrics and trends
            </p>
          </div>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <DollarSign className="h-16 w-16 text-slate-600 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No Revenue Data Available</h3>
          <p className="text-slate-400 max-w-md">
            There is no revenue data for the selected time period. Data will appear here once reservations are made.
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
          <h1 className="text-2xl font-bold text-white">Revenue Intelligence</h1>
          <p className="text-slate-400 mt-1">
            Deep dive into platform revenue metrics and trends
          </p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          title="Total Revenue"
          value={data?.overview?.totalRevenue || 0}
          change={data?.overview?.yoyGrowth}
          changeLabel="YoY"
          format="currency"
          loading={loading}
          icon={<DollarSign className="h-5 w-5 text-green-400" />}
        />
        <KpiCard
          title="Total Reservations"
          value={data?.overview?.totalReservations || 0}
          format="number"
          loading={loading}
        />
        <KpiCard
          title="Avg Order Value"
          value={data?.overview?.averageOrderValue || 0}
          format="currency"
          loading={loading}
          icon={<TrendingUp className="h-5 w-5 text-blue-400" />}
        />
        <KpiCard
          title="RevPAN"
          value={data?.overview?.revenuePerAvailableNight || 0}
          format="currency"
          loading={loading}
          subtitle="Revenue per Available Night"
        />
        <KpiCard
          title="YoY Growth"
          value={data?.overview?.yoyGrowth || 0}
          format="percent"
          loading={loading}
          icon={<Award className="h-5 w-5 text-amber-400" />}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TrendChart
            title="Monthly Revenue Trend"
            description="Revenue and booking volume over time"
            data={data?.monthlyTrends || []}
            dataKeys={[
              { key: "revenue", color: "#3b82f6", name: "Revenue" },
            ]}
            xAxisKey="month"
            type="area"
            height={350}
            formatYAxis={(v) => `$${(v / 1000).toFixed(0)}K`}
            formatTooltip={(v) => formatCurrency(v)}
            loading={loading}
          />
        </div>
        <BreakdownPie
          title="Revenue by Type"
          description="Accommodation type distribution"
          data={pieData}
          height={350}
          formatValue={(v) => `${v.toFixed(1)}%`}
          loading={loading}
        />
      </div>

      {/* ADR Trend */}
      <TrendChart
        title="Average Daily Rate (ADR) Trend"
        description="Track rate changes over time"
        data={data?.monthlyTrends || []}
        dataKeys={[
          { key: "adr", color: "#10b981", name: "ADR" },
        ]}
        xAxisKey="month"
        type="line"
        height={250}
        formatYAxis={(v) => `$${v.toFixed(0)}`}
        formatTooltip={(v) => `$${v.toFixed(2)}`}
        loading={loading}
      />

      {/* Revenue by Type Table */}
      <DataTable
        title="Revenue by Accommodation Type"
        description="Detailed breakdown with ADR metrics"
        columns={[
          {
            key: "type",
            label: "Type",
            format: (v) => v.charAt(0).toUpperCase() + v.slice(1),
          },
          {
            key: "revenue",
            label: "Revenue",
            align: "right",
            format: (v) => formatCurrency(v),
          },
          {
            key: "reservations",
            label: "Reservations",
            align: "right",
            format: (v) => v.toLocaleString(),
          },
          {
            key: "percentage",
            label: "% of Total",
            align: "right",
            format: (v) => `${v.toFixed(1)}%`,
          },
          {
            key: "adr",
            label: "ADR",
            align: "right",
            format: (v) => `$${v.toFixed(2)}`,
          },
        ]}
        data={data?.byAccommodationType || []}
        loading={loading}
      />

      {/* Top Campgrounds */}
      <DataTable
        title="Top Performing Campgrounds"
        description="Ranked by total revenue"
        columns={[
          {
            key: "campground",
            label: "Campground",
            format: (v) => v.name,
          },
          {
            key: "campground",
            label: "Location",
            format: (v) => `${v.city}, ${v.state}`,
          },
          {
            key: "revenue",
            label: "Revenue",
            align: "right",
            format: (v) => formatCurrency(v),
          },
          {
            key: "reservations",
            label: "Reservations",
            align: "right",
            format: (v) => v.toLocaleString(),
          },
        ]}
        data={data?.topCampgrounds || []}
        loading={loading}
      />
    </div>
  );
}
