"use client";

import { useState, useEffect } from "react";
import {
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Users,
  Calendar,
  Star,
  Home,
  MapPin,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SlopeGraph } from "@/components/analytics";

interface ComparisonMetric {
  label: string;
  period1Value: number;
  period2Value: number;
  change: number;
  changePercent: number;
  format: "currency" | "number" | "percentage" | "score" | "days";
  category: "revenue" | "bookings" | "guests" | "satisfaction";
}

const periodOptions = [
  { value: "last_30_days", label: "Last 30 Days" },
  { value: "last_90_days", label: "Last 90 Days" },
  { value: "last_12_months", label: "Last 12 Months" },
  { value: "ytd", label: "Year to Date" },
  { value: "q1_2024", label: "Q1 2024" },
  { value: "q2_2024", label: "Q2 2024" },
  { value: "q3_2024", label: "Q3 2024" },
  { value: "q4_2024", label: "Q4 2024" },
  { value: "summer_2024", label: "Summer 2024" },
  { value: "summer_2023", label: "Summer 2023" },
];

// Mock comparison data
const getMockComparisonData = (period1: string, period2: string): ComparisonMetric[] => [
  {
    label: "Total Revenue",
    period1Value: 2847500,
    period2Value: 2456000,
    change: 391500,
    changePercent: 15.9,
    format: "currency",
    category: "revenue",
  },
  {
    label: "Average Daily Rate",
    period1Value: 85.50,
    period2Value: 78.25,
    change: 7.25,
    changePercent: 9.3,
    format: "currency",
    category: "revenue",
  },
  {
    label: "RevPAN",
    period1Value: 62.30,
    period2Value: 55.80,
    change: 6.50,
    changePercent: 11.6,
    format: "currency",
    category: "revenue",
  },
  {
    label: "Total Reservations",
    period1Value: 8742,
    period2Value: 7890,
    change: 852,
    changePercent: 10.8,
    format: "number",
    category: "bookings",
  },
  {
    label: "Avg Lead Time",
    period1Value: 14.2,
    period2Value: 12.8,
    change: 1.4,
    changePercent: 10.9,
    format: "days",
    category: "bookings",
  },
  {
    label: "Cancellation Rate",
    period1Value: 6.2,
    period2Value: 7.8,
    change: -1.6,
    changePercent: -20.5,
    format: "percentage",
    category: "bookings",
  },
  {
    label: "Unique Guests",
    period1Value: 6234,
    period2Value: 5890,
    change: 344,
    changePercent: 5.8,
    format: "number",
    category: "guests",
  },
  {
    label: "Repeat Guest Rate",
    period1Value: 34.5,
    period2Value: 31.2,
    change: 3.3,
    changePercent: 10.6,
    format: "percentage",
    category: "guests",
  },
  {
    label: "Avg Party Size",
    period1Value: 3.2,
    period2Value: 3.0,
    change: 0.2,
    changePercent: 6.7,
    format: "number",
    category: "guests",
  },
  {
    label: "NPS Score",
    period1Value: 42,
    period2Value: 38,
    change: 4,
    changePercent: 10.5,
    format: "score",
    category: "satisfaction",
  },
  {
    label: "Response Rate",
    period1Value: 28.5,
    period2Value: 25.2,
    change: 3.3,
    changePercent: 13.1,
    format: "percentage",
    category: "satisfaction",
  },
  {
    label: "Avg Length of Stay",
    period1Value: 3.8,
    period2Value: 3.5,
    change: 0.3,
    changePercent: 8.6,
    format: "days",
    category: "bookings",
  },
];

function formatValue(value: number, format: string): string {
  switch (format) {
    case "currency":
      if (value >= 1000000) {
        return `$${(value / 1000000).toFixed(2)}M`;
      } else if (value >= 1000) {
        return `$${(value / 1000).toFixed(1)}K`;
      }
      return `$${value.toFixed(2)}`;
    case "percentage":
      return `${value.toFixed(1)}%`;
    case "number":
      return value.toLocaleString();
    case "score":
      return value.toString();
    case "days":
      return `${value.toFixed(1)} days`;
    default:
      return value.toString();
  }
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "revenue":
      return <DollarSign className="h-4 w-4" />;
    case "bookings":
      return <Calendar className="h-4 w-4" />;
    case "guests":
      return <Users className="h-4 w-4" />;
    case "satisfaction":
      return <Star className="h-4 w-4" />;
    default:
      return <Home className="h-4 w-4" />;
  }
}

function getCategoryColor(category: string): string {
  switch (category) {
    case "revenue":
      return "text-green-400";
    case "bookings":
      return "text-blue-400";
    case "guests":
      return "text-purple-400";
    case "satisfaction":
      return "text-amber-400";
    default:
      return "text-slate-400";
  }
}

export default function ComparisonPage() {
  const [period1, setPeriod1] = useState("last_30_days");
  const [period2, setPeriod2] = useState("q3_2024");
  const [data, setData] = useState<ComparisonMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const [isUsingMockData, setIsUsingMockData] = useState(true);

  useEffect(() => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setData(getMockComparisonData(period1, period2));
      setLoading(false);
    }, 500);
  }, [period1, period2]);

  const groupedData = data.reduce((acc, metric) => {
    if (!acc[metric.category]) {
      acc[metric.category] = [];
    }
    acc[metric.category].push(metric);
    return acc;
  }, {} as Record<string, ComparisonMetric[]>);

  const period1Label = periodOptions.find((p) => p.value === period1)?.label || period1;
  const period2Label = periodOptions.find((p) => p.value === period2)?.label || period2;

  const improvements = data.filter((m) => {
    // For cancellation rate, negative change is good
    if (m.label === "Cancellation Rate") return m.changePercent < 0;
    return m.changePercent > 0;
  }).length;

  const declines = data.filter((m) => {
    if (m.label === "Cancellation Rate") return m.changePercent > 0;
    return m.changePercent < 0;
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Period Comparison</h1>
            {isUsingMockData && (
              <Badge className="bg-amber-100 dark:bg-amber-600/20 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-600/50">
                Demo Data
              </Badge>
            )}
          </div>
          <p className="text-slate-600 dark:text-slate-400 mt-1">Compare performance across different time periods</p>
        </div>
      </div>

      {/* Period Selectors */}
      <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Period 1 (Baseline)</label>
              <select
                value={period1}
                onChange={(e) => setPeriod1(e.target.value)}
                className="w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {periodOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="pt-6">
              <ArrowRight className="h-6 w-6 text-slate-400 dark:text-slate-500" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Period 2 (Compare To)</label>
              <select
                value={period2}
                onChange={(e) => setPeriod2(e.target.value)}
                className="w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {periodOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-green-500 dark:text-green-400" />
              <div>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{improvements}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Metrics Improved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingDown className="h-8 w-8 text-red-500 dark:text-red-400" />
              <div>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{declines}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Metrics Declined</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-100 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Minus className="h-8 w-8 text-slate-400" />
              <div>
                <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">{data.length - improvements - declines}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Unchanged</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Slope Graphs by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.entries(groupedData).map(([category, metrics]) => (
          <SlopeGraph
            key={category}
            title={category.charAt(0).toUpperCase() + category.slice(1) + " Metrics"}
            leftLabel={period1Label}
            rightLabel={period2Label}
            data={metrics.map((m: ComparisonMetric) => ({
              label: m.label,
              leftValue: m.period1Value,
              rightValue: m.period2Value,
              format: m.format,
              isNegativeGood: m.label === "Cancellation Rate",
            }))}
            height={Math.max(250, metrics.length * 60 + 100)}
          />
        ))}
      </div>

      {/* Comparison Tables by Category */}
      {Object.entries(groupedData).map(([category, metrics]) => (
        <Card key={category} className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <span className={getCategoryColor(category)}>{getCategoryIcon(category)}</span>
              <span className="capitalize">{category}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">Metric</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">{period1Label}</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">{period2Label}</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">Change</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">% Change</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((metric, idx) => {
                    const isPositiveGood = metric.label !== "Cancellation Rate";
                    const isPositive = isPositiveGood ? metric.changePercent > 0 : metric.changePercent < 0;
                    const isNegative = isPositiveGood ? metric.changePercent < 0 : metric.changePercent > 0;

                    return (
                      <tr key={metric.label} className={idx % 2 === 0 ? "bg-slate-50 dark:bg-slate-800/30" : ""}>
                        <td className="py-3 px-4 text-sm text-slate-900 dark:text-white">{metric.label}</td>
                        <td className="py-3 px-4 text-sm text-right text-slate-700 dark:text-slate-300">
                          {formatValue(metric.period1Value, metric.format)}
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-slate-700 dark:text-slate-300">
                          {formatValue(metric.period2Value, metric.format)}
                        </td>
                        <td className={`py-3 px-4 text-sm text-right font-medium ${isPositive ? "text-green-600 dark:text-green-400" : isNegative ? "text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-400"}`}>
                          {metric.change > 0 ? "+" : ""}
                          {metric.format === "currency"
                            ? `$${Math.abs(metric.change).toLocaleString()}`
                            : metric.format === "percentage"
                            ? `${metric.change.toFixed(1)}%`
                            : metric.change.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-sm text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isPositive ? (
                              <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                            ) : isNegative ? (
                              <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                            ) : (
                              <Minus className="h-4 w-4 text-slate-400" />
                            )}
                            <span className={isPositive ? "text-green-600 dark:text-green-400" : isNegative ? "text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-400"}>
                              {metric.changePercent > 0 ? "+" : ""}{metric.changePercent.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Insights */}
      <Card className="bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900 dark:text-white">Key Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-transparent">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>Revenue Growth:</strong> Total revenue increased by{" "}
                {data.find((m) => m.label === "Total Revenue")?.changePercent.toFixed(1)}%, driven by both
                higher ADR (+{data.find((m) => m.label === "Average Daily Rate")?.changePercent.toFixed(1)}%) and
                more bookings (+{data.find((m) => m.label === "Total Reservations")?.changePercent.toFixed(1)}%).
              </p>
            </div>
            <div className="p-4 bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-transparent">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>Guest Loyalty:</strong> Repeat guest rate improved by{" "}
                {data.find((m) => m.label === "Repeat Guest Rate")?.changePercent.toFixed(1)}% while NPS
                increased by {data.find((m) => m.label === "NPS Score")?.change} points, indicating stronger
                guest satisfaction.
              </p>
            </div>
            <div className="p-4 bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-transparent">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>Operational Efficiency:</strong> Cancellation rate dropped by{" "}
                {Math.abs(data.find((m) => m.label === "Cancellation Rate")?.changePercent || 0).toFixed(1)}%,
                reducing lost revenue and improving planning.
              </p>
            </div>
            <div className="p-4 bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-transparent">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>Booking Behavior:</strong> Average lead time increased to{" "}
                {data.find((m) => m.label === "Avg Lead Time")?.period1Value.toFixed(1)} days, allowing for
                better resource planning.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
