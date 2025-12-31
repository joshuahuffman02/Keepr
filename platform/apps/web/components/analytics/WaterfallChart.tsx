"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Dynamic import for Recharts
const ResponsiveContainer = dynamic(
  () => import("recharts").then((mod) => mod.ResponsiveContainer as unknown as ComponentType<any>),
  { ssr: false }
);
const BarChart = dynamic(
  () => import("recharts").then((mod) => mod.BarChart as unknown as ComponentType<any>),
  { ssr: false }
);
const Bar = dynamic(
  () => import("recharts").then((mod) => mod.Bar as unknown as ComponentType<any>),
  { ssr: false }
);
const XAxis = dynamic(
  () => import("recharts").then((mod) => mod.XAxis as unknown as ComponentType<any>),
  { ssr: false }
);
const YAxis = dynamic(
  () => import("recharts").then((mod) => mod.YAxis as unknown as ComponentType<any>),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import("recharts").then((mod) => mod.Tooltip as unknown as ComponentType<any>),
  { ssr: false }
);
const Cell = dynamic(
  () => import("recharts").then((mod) => mod.Cell as unknown as ComponentType<any>),
  { ssr: false }
);
const ReferenceLine = dynamic(
  () => import("recharts").then((mod) => mod.ReferenceLine as unknown as ComponentType<any>),
  { ssr: false }
);

interface WaterfallDataPoint {
  label: string;
  value: number;
  type?: "start" | "increase" | "decrease" | "total";
}

interface WaterfallChartProps {
  title: string;
  description?: string;
  data: WaterfallDataPoint[];
  height?: number;
  loading?: boolean;
  formatValue?: (value: number) => string;
}

function processWaterfallData(data: WaterfallDataPoint[]) {
  let runningTotal = 0;

  return data.map((item, index) => {
    const type = item.type || (item.value >= 0 ? "increase" : "decrease");

    if (type === "start" || type === "total") {
      const result = {
        ...item,
        type,
        start: 0,
        end: item.value,
        displayValue: item.value,
      };
      if (type === "start") {
        runningTotal = item.value;
      }
      return result;
    }

    const start = runningTotal;
    runningTotal += item.value;

    return {
      ...item,
      type,
      start: item.value >= 0 ? start : runningTotal,
      end: item.value >= 0 ? runningTotal : start,
      displayValue: Math.abs(item.value),
    };
  });
}

export function WaterfallChart({
  title,
  description,
  data,
  height = 350,
  loading = false,
  formatValue = (v) => `$${(v / 1000).toFixed(1)}K`,
}: WaterfallChartProps) {
  const processedData = processWaterfallData(data);

  if (loading) {
    return (
      <Card className="border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900 dark:text-white">{title}</CardTitle>
          {description && <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>}
        </CardHeader>
        <CardContent>
          <div className="animate-pulse" style={{ height }}>
            <div className="flex items-end gap-2 h-full">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-t"
                  style={{ height: `${30 + Math.random() * 60}%` }}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getBarColor = (type: string) => {
    switch (type) {
      case "start":
      case "total":
        return "#3b82f6"; // blue
      case "increase":
        return "#22c55e"; // green
      case "decrease":
        return "#ef4444"; // red
      default:
        return "#64748b"; // gray
    }
  };

  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardHeader>
        <CardTitle className="text-lg text-slate-900 dark:text-white">{title}</CardTitle>
        {description && <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      </CardHeader>
      <CardContent>
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={processedData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <XAxis
                dataKey="label"
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#64748b", strokeOpacity: 0.3 }}
                angle={-35}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#64748b", strokeOpacity: 0.3 }}
                tickFormatter={(v: number) => formatValue(v)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(15, 23, 42, 0.95)",
                  border: "1px solid rgba(100, 116, 139, 0.3)",
                  borderRadius: "8px",
                  padding: "12px",
                }}
                labelStyle={{ color: "#f8fafc", fontWeight: "bold", marginBottom: "4px" }}
                formatter={(value: any, name: string, props: any) => {
                  const item = props.payload;
                  const prefix = item.type === "decrease" ? "-" : item.type === "increase" ? "+" : "";
                  return [
                    `${prefix}${formatValue(item.displayValue)}`,
                    item.type === "start" ? "Starting" : item.type === "total" ? "Total" : "Change"
                  ];
                }}
              />
              <ReferenceLine y={0} stroke="#64748b" strokeOpacity={0.5} />

              {/* Invisible bar for positioning */}
              <Bar dataKey="start" stackId="stack" fill="transparent" />

              {/* Visible bar showing the value */}
              <Bar dataKey="displayValue" stackId="stack" radius={[4, 4, 0, 0]}>
                {processedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.type)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-blue-500" /> Start/Total
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-green-500" /> Increase
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-red-500" /> Decrease
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
