"use client";

import { useState, useEffect } from "react";
import { Award, TrendingUp, TrendingDown, Minus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  KpiCard,
  DataTable,
  DateRangePicker,
  formatCurrency,
  RadarChart,
} from "@/components/analytics";

// Mock data
const mockBenchmarks = {
  revenue: {
    averagePerCampground: 56875,
    medianPerCampground: 42500,
    top10Percentile: 125000,
    bottom10Percentile: 15000,
  },
  occupancy: {
    platformAverage: 67.8,
    top10Percentile: 85.2,
    bySeasonAverage: {
      winter: 42.5,
      spring: 58.4,
      summer: 88.2,
      fall: 62.8,
    },
  },
  los: {
    platformAverage: 3.8,
    byTypeAverage: {
      rv: 4.5,
      tent: 2.8,
      cabin: 3.2,
      glamping: 2.4,
    },
  },
  adr: {
    platformAverage: 58.5,
    byTypeAverage: {
      rv: 68.5,
      tent: 35.2,
      cabin: 95.8,
      glamping: 125.4,
    },
  },
  bookingWindow: {
    platformAverage: 21.5,
  },
};

const mockCampgroundComparison = {
  campground: {
    id: "camp_001",
    name: "Sample Campground",
  },
  metrics: [
    {
      metric: "Total Revenue",
      campgroundValue: 68500,
      platformAverage: 56875,
      percentile: 72,
      status: "above",
    },
    {
      metric: "Occupancy Rate (%)",
      campgroundValue: 75.2,
      platformAverage: 67.8,
      percentile: 68,
      status: "above",
    },
    {
      metric: "Average Length of Stay",
      campgroundValue: 4.2,
      platformAverage: 3.8,
      percentile: 65,
      status: "above",
    },
    {
      metric: "Average Daily Rate ($)",
      campgroundValue: 62.5,
      platformAverage: 58.5,
      percentile: 58,
      status: "average",
    },
    {
      metric: "Average Booking Window (days)",
      campgroundValue: 18.5,
      platformAverage: 21.5,
      percentile: 42,
      status: "below",
    },
  ],
  overallScore: 61,
};

export default function BenchmarksPage() {
  const [dateRange, setDateRange] = useState("last_12_months");
  const [benchmarks, setBenchmarks] = useState(mockBenchmarks);
  const [comparison, setComparison] = useState(mockCampgroundComparison);
  const [loading, setLoading] = useState(false);
  const [isUsingMockData, setIsUsingMockData] = useState(true);
  const [campgroundSearch, setCampgroundSearch] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/platform-analytics/benchmarks?range=${dateRange}`);
        if (response.ok) {
          const result = await response.json();
          if (result.revenue?.averagePerCampground > 0) {
            setBenchmarks(result);
            setIsUsingMockData(false);
          }
        }
      } catch (error) {
        console.error("Failed to fetch benchmarks:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dateRange]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "above":
        return <TrendingUp className="h-4 w-4 text-green-400" />;
      case "below":
        return <TrendingDown className="h-4 w-4 text-red-400" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "above":
        return "text-green-400";
      case "below":
        return "text-red-400";
      default:
        return "text-muted-foreground";
    }
  };

  const getPercentileColor = (percentile: number) => {
    if (percentile >= 75) return "bg-green-500";
    if (percentile >= 50) return "bg-blue-500";
    if (percentile >= 25) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">Industry Benchmarks</h1>
            {isUsingMockData && (
              <Badge className="bg-amber-100 text-amber-700 border border-amber-300">
                Demo Data
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            Platform-wide benchmarks and campground comparisons
          </p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Platform Benchmarks */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Avg Revenue/Campground"
          value={benchmarks.revenue.averagePerCampground}
          format="currency"
          loading={loading}
          icon={<Award className="h-5 w-5 text-amber-400" />}
        />
        <KpiCard
          title="Platform Occupancy"
          value={benchmarks.occupancy.platformAverage}
          format="percent"
          loading={loading}
        />
        <KpiCard
          title="Platform Avg LOS"
          value={benchmarks.los.platformAverage}
          format="days"
          loading={loading}
        />
        <KpiCard
          title="Platform Avg ADR"
          value={benchmarks.adr.platformAverage}
          format="currency"
          loading={loading}
        />
      </div>

      {/* Benchmark Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Benchmarks */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Revenue Benchmarks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span className="text-muted-foreground">Average per Campground</span>
              <span className="text-foreground font-medium">
                {formatCurrency(benchmarks.revenue.averagePerCampground)}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span className="text-muted-foreground">Median per Campground</span>
              <span className="text-foreground font-medium">
                {formatCurrency(benchmarks.revenue.medianPerCampground)}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-green-50 border border-green-200 rounded-lg">
              <span className="text-green-700">Top 10% Threshold</span>
              <span className="text-green-700 font-medium">
                {formatCurrency(benchmarks.revenue.top10Percentile)}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-red-50 border border-red-200 rounded-lg">
              <span className="text-red-700">Bottom 10% Threshold</span>
              <span className="text-red-700 font-medium">
                {formatCurrency(benchmarks.revenue.bottom10Percentile)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Seasonal Occupancy */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Seasonal Occupancy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(benchmarks.occupancy.bySeasonAverage).map(([season, rate]) => (
                <div key={season} className="p-4 bg-muted rounded-lg text-center">
                  <p className="text-sm text-muted-foreground capitalize mb-1">{season}</p>
                  <p className="text-2xl font-bold text-foreground">{rate.toFixed(1)}%</p>
                  <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ADR by Type */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">ADR by Accommodation Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(benchmarks.adr.byTypeAverage).map(([type, rate]) => (
                <div
                  key={type}
                  className="flex justify-between items-center p-3 bg-muted rounded-lg"
                >
                  <span className="text-foreground capitalize">{type}</span>
                  <span className="text-foreground font-medium">{formatCurrency(rate)}/night</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* LOS by Type */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">LOS by Accommodation Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(benchmarks.los.byTypeAverage).map(([type, los]) => (
                <div
                  key={type}
                  className="flex justify-between items-center p-3 bg-muted rounded-lg"
                >
                  <span className="text-foreground capitalize">{type}</span>
                  <span className="text-foreground font-medium">{los.toFixed(1)} nights</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campground Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart Visualization */}
        <RadarChart
          title="Performance Spider Chart"
          description="Visual comparison across all metrics (percentile scores)"
          data={comparison.metrics.map((m) => ({
            metric: m.metric.replace(/\s*\([^)]*\)/g, "").substring(0, 15),
            value: m.percentile,
            benchmark: 50,
            fullMark: 100,
          }))}
          valueLabel="Campground Percentile"
          benchmarkLabel="Median (50th)"
          height={350}
          loading={loading}
        />

        {/* Overall Score and Search */}
        <Card className="border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg text-foreground">Campground vs Platform</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Compare a specific campground against benchmarks
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <Input
                placeholder="Search campground..."
                value={campgroundSearch}
                onChange={(e) => setCampgroundSearch(e.target.value)}
                className="flex-1 bg-muted border-border"
              />
              <Button variant="outline" size="sm" className="border-border">
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Overall Score */}
            <div className="p-6 bg-muted rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-2">Overall Performance Score</p>
              <p className="text-5xl font-bold text-foreground">{comparison.overallScore}</p>
              <p className="text-muted-foreground mt-1">out of 100</p>
              <div className="mt-4 max-w-md mx-auto h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${getPercentileColor(comparison.overallScore)}`}
                  style={{ width: `${comparison.overallScore}%` }}
                />
              </div>
              <div className="mt-4 flex justify-center gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-500" /> 0-25th
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-amber-500" /> 25-50th
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-blue-500" /> 50-75th
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-green-500" /> 75-100th
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Metric Comparison Details */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">Metric Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {comparison.metrics.map((metric, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(metric.status)}
                  <span className="text-foreground">{metric.metric}</span>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Campground</p>
                    <p className={`font-medium ${getStatusColor(metric.status)}`}>
                      {typeof metric.campgroundValue === "number"
                        ? metric.metric.includes("$")
                          ? formatCurrency(metric.campgroundValue)
                          : metric.metric.includes("%")
                            ? `${metric.campgroundValue.toFixed(1)}%`
                            : metric.campgroundValue.toFixed(1)
                        : metric.campgroundValue}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Platform Avg</p>
                    <p className="text-foreground font-medium">
                      {typeof metric.platformAverage === "number"
                        ? metric.metric.includes("$")
                          ? formatCurrency(metric.platformAverage)
                          : metric.metric.includes("%")
                            ? `${metric.platformAverage.toFixed(1)}%`
                            : metric.platformAverage.toFixed(1)
                        : metric.platformAverage}
                    </p>
                  </div>
                  <div className="w-20">
                    <p className="text-sm text-muted-foreground text-right">Percentile</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getPercentileColor(metric.percentile)}`}
                          style={{ width: `${metric.percentile}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{metric.percentile}th</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
