"use client";

import { useState, useEffect } from "react";
import { Moon, Calendar, TrendingUp, Tent, Truck, Home } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  KpiCard,
  TrendChart,
  BreakdownPie,
  DataTable,
  DateRangePicker,
  formatCurrency,
} from "@/components/analytics";

// Mock data
const mockLosData = {
  overview: {
    averageLos: 3.8,
    medianLos: 3,
    weeklyStayPercentage: 22.5,
    monthlyStayPercentage: 4.2,
  },
  distribution: [
    { range: "1 night", count: 1870, percentage: 15.0, revenue: 280500, revenuePerNight: 150 },
    { range: "2-3 nights", count: 4365, percentage: 35.0, revenue: 1091250, revenuePerNight: 165 },
    { range: "4-6 nights", count: 2490, percentage: 20.0, revenue: 747000, revenuePerNight: 180 },
    { range: "1 week", count: 1494, percentage: 12.0, revenue: 523800, revenuePerNight: 195 },
    { range: "8-13 nights", count: 996, percentage: 8.0, revenue: 398400, revenuePerNight: 200 },
    { range: "2 weeks", count: 623, percentage: 5.0, revenue: 280350, revenuePerNight: 205 },
    { range: "15-27 nights", count: 374, percentage: 3.0, revenue: 186250, revenuePerNight: 210 },
    { range: "Monthly (28+)", count: 238, percentage: 2.0, revenue: 128520, revenuePerNight: 215 },
  ],
  byAccommodationType: [
    { type: "rv", averageLos: 4.5, medianLos: 4, reservations: 6475 },
    { type: "tent", averageLos: 2.8, medianLos: 2, reservations: 3486 },
    { type: "cabin", averageLos: 3.2, medianLos: 3, reservations: 1868 },
    { type: "glamping", averageLos: 2.4, medianLos: 2, reservations: 621 },
  ],
  monthlyTrends: [
    { month: "Jan", averageLos: 3.2, reservations: 820 },
    { month: "Feb", averageLos: 3.4, reservations: 890 },
    { month: "Mar", averageLos: 3.5, reservations: 1050 },
    { month: "Apr", averageLos: 3.8, reservations: 1340 },
    { month: "May", averageLos: 4.2, reservations: 1650 },
    { month: "Jun", averageLos: 4.8, reservations: 1780 },
    { month: "Jul", averageLos: 5.2, reservations: 1890 },
    { month: "Aug", averageLos: 4.9, reservations: 1820 },
    { month: "Sep", averageLos: 4.0, reservations: 1280 },
    { month: "Oct", averageLos: 3.6, reservations: 1050 },
    { month: "Nov", averageLos: 3.2, reservations: 780 },
    { month: "Dec", averageLos: 3.0, reservations: 720 },
  ],
  seasonality: [
    { month: "January", averageLos: 3.2, reservations: 820 },
    { month: "February", averageLos: 3.4, reservations: 890 },
    { month: "March", averageLos: 3.5, reservations: 1050 },
    { month: "April", averageLos: 3.8, reservations: 1340 },
    { month: "May", averageLos: 4.2, reservations: 1650 },
    { month: "June", averageLos: 4.8, reservations: 1780 },
    { month: "July", averageLos: 5.2, reservations: 1890 },
    { month: "August", averageLos: 4.9, reservations: 1820 },
    { month: "September", averageLos: 4.0, reservations: 1280 },
    { month: "October", averageLos: 3.6, reservations: 1050 },
    { month: "November", averageLos: 3.2, reservations: 780 },
    { month: "December", averageLos: 3.0, reservations: 720 },
  ],
};

export default function LengthOfStayPage() {
  const [dateRange, setDateRange] = useState("last_12_months");
  const [data, setData] = useState(mockLosData);
  const [loading, setLoading] = useState(false);
  const [isUsingMockData, setIsUsingMockData] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/platform-analytics/los?range=${dateRange}`);
        if (response.ok) {
          const result = await response.json();
          if (result.overview?.averageLos > 0) {
            setData(result);
            setIsUsingMockData(false);
          }
        }
      } catch (error) {
        console.error("Failed to fetch LOS data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dateRange]);

  const distributionPieData = data.distribution.map((d) => ({
    name: d.range,
    value: d.percentage,
  }));

  const typeIcons: Record<string, React.ReactNode> = {
    rv: <Truck className="h-4 w-4 text-blue-400" />,
    tent: <Tent className="h-4 w-4 text-green-400" />,
    cabin: <Home className="h-4 w-4 text-amber-400" />,
    glamping: <Moon className="h-4 w-4 text-purple-400" />,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">Length of Stay Analysis</h1>
            {isUsingMockData && (
              <Badge className="bg-amber-600/20 text-amber-400 border border-amber-600/50">
                Demo Data
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            Understand how long guests stay at campgrounds
          </p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Average LOS"
          value={`${data.overview.averageLos.toFixed(1)} nights`}
          loading={loading}
          icon={<Moon className="h-5 w-5 text-blue-400" />}
        />
        <KpiCard
          title="Median LOS"
          value={`${data.overview.medianLos} nights`}
          loading={loading}
          icon={<Calendar className="h-5 w-5 text-green-400" />}
        />
        <KpiCard
          title="Weekly Stays"
          value={data.overview.weeklyStayPercentage}
          format="percent"
          loading={loading}
          subtitle="7+ nights"
        />
        <KpiCard
          title="Monthly Stays"
          value={data.overview.monthlyStayPercentage}
          format="percent"
          loading={loading}
          subtitle="28+ nights"
        />
      </div>

      {/* Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TrendChart
            title="LOS Distribution"
            description="Number of reservations by stay length"
            data={data.distribution}
            dataKeys={[
              { key: "count", color: "#3b82f6", name: "Reservations" },
            ]}
            xAxisKey="range"
            type="bar"
            height={300}
            formatTooltip={(v) => v.toLocaleString()}
            loading={loading}
            yAxisLabel="Reservations"
          />
        </div>
        <BreakdownPie
          title="Stay Length Mix"
          data={distributionPieData}
          height={300}
          formatValue={(v) => `${v.toFixed(1)}%`}
          loading={loading}
        />
      </div>

      {/* LOS Trends Over Time */}
      <TrendChart
        title="Average LOS Over Time"
        description="Monthly trends in stay length"
        data={data.monthlyTrends}
        dataKeys={[
          { key: "averageLos", color: "#10b981", name: "Avg LOS (nights)" },
        ]}
        xAxisKey="month"
        type="area"
        height={250}
        formatYAxis={(v) => `${v}`}
        formatTooltip={(v) => `${v.toFixed(1)} nights`}
        loading={loading}
        yAxisLabel="Nights"
      />

      {/* LOS by Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DataTable
          title="LOS by Accommodation Type"
          description="How stay length varies by type"
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
            { key: "averageLos", label: "Avg LOS", align: "right", format: (v) => `${v.toFixed(1)} nights` },
            { key: "medianLos", label: "Median", align: "right", format: (v) => `${v} nights` },
            { key: "reservations", label: "Reservations", align: "right", format: (v) => v.toLocaleString() },
          ]}
          data={data.byAccommodationType}
          loading={loading}
        />

        <DataTable
          title="Revenue by Stay Length"
          description="Revenue and rate by LOS bucket"
          columns={[
            { key: "range", label: "Stay Length" },
            { key: "count", label: "Reservations", align: "right", format: (v) => v.toLocaleString() },
            { key: "revenue", label: "Revenue", align: "right", format: (v) => formatCurrency(v) },
            { key: "revenuePerNight", label: "Rate/Night", align: "right", format: (v) => formatCurrency(v) },
          ]}
          data={data.distribution}
          loading={loading}
        />
      </div>

      {/* Seasonality */}
      <TrendChart
        title="LOS Seasonality"
        description="How stay length varies throughout the year"
        data={data.seasonality}
        dataKeys={[
          { key: "averageLos", color: "#8b5cf6", name: "Avg LOS" },
        ]}
        xAxisKey="month"
        type="line"
        height={250}
        formatYAxis={(v) => `${v}`}
        formatTooltip={(v) => `${v.toFixed(1)} nights`}
        loading={loading}
        yAxisLabel="Nights"
      />
    </div>
  );
}
