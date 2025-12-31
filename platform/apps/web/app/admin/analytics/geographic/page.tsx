"use client";

import { useState, useEffect } from "react";
import { MapPin, Navigation, Globe, Map } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  KpiCard,
  TrendChart,
  BreakdownPie,
  DataTable,
  DateRangePicker,
  formatCurrency,
  USStateHeatmap,
} from "@/components/analytics";

// Mock data
const mockGeographicData = {
  overview: {
    topOriginState: "TX",
    averageTravelDistance: 285,
    uniqueStates: 48,
    internationalPercentage: 4.2,
  },
  originHeatmap: [
    { state: "TX", country: "US", guestCount: 1245, reservations: 2890, revenue: 685000, averageDistance: 125 },
    { state: "CA", country: "US", guestCount: 1120, reservations: 2450, revenue: 612000, averageDistance: 320 },
    { state: "FL", country: "US", guestCount: 980, reservations: 2180, revenue: 545000, averageDistance: 450 },
    { state: "CO", country: "US", guestCount: 745, reservations: 1680, revenue: 420000, averageDistance: 180 },
    { state: "AZ", country: "US", guestCount: 680, reservations: 1520, revenue: 380000, averageDistance: 220 },
    { state: "NY", country: "US", guestCount: 520, reservations: 1150, revenue: 287500, averageDistance: 890 },
    { state: "WA", country: "US", guestCount: 485, reservations: 1080, revenue: 270000, averageDistance: 650 },
    { state: "OR", country: "US", guestCount: 420, reservations: 940, revenue: 235000, averageDistance: 580 },
    { state: "NV", country: "US", guestCount: 380, reservations: 850, revenue: 212500, averageDistance: 280 },
    { state: "UT", country: "US", guestCount: 340, reservations: 760, revenue: 190000, averageDistance: 240 },
  ],
  travelDistance: {
    averageDistance: 285,
    medianDistance: 215,
    buckets: [
      { range: "0-50 miles", count: 1850, percentage: 15.2, averageSpend: 185 },
      { range: "50-100 miles", count: 2450, percentage: 20.1, averageSpend: 205 },
      { range: "100-250 miles", count: 3280, percentage: 26.9, averageSpend: 235 },
      { range: "250-500 miles", count: 2890, percentage: 23.7, averageSpend: 265 },
      { range: "500+ miles", count: 1720, percentage: 14.1, averageSpend: 312 },
    ],
  },
  regionalTrends: {
    Southwest: { totalGuests: 3250, totalRevenue: 812500, growthRate: 24.5 },
    West: { totalGuests: 2480, totalRevenue: 620000, growthRate: 18.2 },
    Southeast: { totalGuests: 1850, totalRevenue: 462500, growthRate: 15.8 },
    Midwest: { totalGuests: 1420, totalRevenue: 355000, growthRate: 12.4 },
    Northeast: { totalGuests: 980, totalRevenue: 245000, growthRate: 8.6 },
  },
};

export default function GeographicPage() {
  const [dateRange, setDateRange] = useState("last_12_months");
  const [data, setData] = useState(mockGeographicData);
  const [loading, setLoading] = useState(false);
  const [isUsingMockData, setIsUsingMockData] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/platform-analytics/geographic?range=${dateRange}`);
        if (response.ok) {
          const result = await response.json();
          if (result.overview?.uniqueStates > 0) {
            setData(result);
            setIsUsingMockData(false);
          }
        }
      } catch (error) {
        console.error("Failed to fetch geographic data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dateRange]);

  const distancePieData = data.travelDistance.buckets.map((b) => ({
    name: b.range,
    value: b.percentage,
  }));

  const regionData = Object.entries(data.regionalTrends).map(([region, stats]) => ({
    region,
    ...stats,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Geographic Intelligence</h1>
            {isUsingMockData && (
              <Badge className="bg-amber-100 dark:bg-amber-600/20 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-600/50">
                Demo Data
              </Badge>
            )}
          </div>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Where your guests come from and how far they travel
          </p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Top Origin State"
          value={data.overview.topOriginState}
          loading={loading}
          icon={<MapPin className="h-5 w-5 text-blue-400" />}
        />
        <KpiCard
          title="Avg Travel Distance"
          value={`${data.overview.averageTravelDistance} mi`}
          loading={loading}
          icon={<Navigation className="h-5 w-5 text-green-400" />}
        />
        <KpiCard
          title="Unique States"
          value={data.overview.uniqueStates}
          format="number"
          loading={loading}
          icon={<Map className="h-5 w-5 text-purple-400" />}
        />
        <KpiCard
          title="International"
          value={data.overview.internationalPercentage}
          format="percent"
          loading={loading}
          icon={<Globe className="h-5 w-5 text-amber-400" />}
        />
      </div>

      {/* US State Heatmap */}
      <USStateHeatmap
        title="Guest Origins by State"
        description="Visualize where your guests are coming from across the United States"
        data={data.originHeatmap.map(s => ({
          state: s.state,
          value: s.guestCount,
        }))}
        formatValue={(v) => `${v.toLocaleString()} guests`}
        colorScale="blue"
        loading={loading}
      />

      {/* Travel Distance Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TrendChart
            title="Travel Distance Distribution"
            description="How far guests travel to reach campgrounds"
            data={data.travelDistance.buckets}
            dataKeys={[
              { key: "count", color: "#3b82f6", name: "Guest Count" },
            ]}
            xAxisKey="range"
            type="bar"
            height={300}
            formatTooltip={(v) => v?.toLocaleString() ?? "0"}
            loading={loading}
          />
        </div>
        <div className="space-y-4">
          <BreakdownPie
            title="Distance Breakdown"
            data={distancePieData}
            height={280}
            formatValue={(v) => `${(v ?? 0).toFixed(1)}%`}
            loading={loading}
          />
          <Card className="border-slate-200 dark:border-slate-700">
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Average Distance</span>
                <span className="text-slate-900 dark:text-white font-medium">{Math.round(data.travelDistance.averageDistance ?? 0)} mi</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Median Distance</span>
                <span className="text-slate-900 dark:text-white font-medium">{Math.round(data.travelDistance.medianDistance ?? 0)} mi</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Top Origin States */}
      <DataTable
        title="Top Origin States"
        description="Where your guests are coming from"
        columns={[
          { key: "state", label: "State" },
          { key: "guestCount", label: "Guests", align: "right", format: (v) => v?.toLocaleString() ?? "0" },
          { key: "reservations", label: "Reservations", align: "right", format: (v) => v?.toLocaleString() ?? "0" },
          { key: "revenue", label: "Revenue", align: "right", format: (v) => formatCurrency(v ?? 0) },
          { key: "averageDistance", label: "Avg Distance", align: "right", format: (v) => `${Math.round(v ?? 0)} mi` },
        ]}
        data={data.originHeatmap}
        loading={loading}
        maxRows={10}
      />

      {/* Regional Trends */}
      <DataTable
        title="Regional Performance"
        description="Guest and revenue by US region"
        columns={[
          { key: "region", label: "Region" },
          { key: "totalGuests", label: "Guests", align: "right", format: (v) => v?.toLocaleString() ?? "0" },
          { key: "totalRevenue", label: "Revenue", align: "right", format: (v) => formatCurrency(v ?? 0) },
          { key: "growthRate", label: "Growth Rate", align: "right", format: (v) => `+${(v ?? 0).toFixed(1)}%` },
        ]}
        data={regionData}
        loading={loading}
      />

      {/* Distance vs Spend Correlation */}
      <Card className="border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900 dark:text-white">Distance vs Spend Insight</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {data.travelDistance.buckets.map((bucket, idx) => (
              <div key={idx} className="text-center p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">{bucket.range}</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(bucket.averageSpend)}</p>
                <p className="text-xs text-slate-500">avg spend</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-4 text-center">
            Guests traveling longer distances tend to spend more per reservation
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
