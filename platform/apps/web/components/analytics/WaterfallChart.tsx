"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "@/components/charts/recharts";

type WaterfallType = "start" | "increase" | "decrease" | "total";

interface WaterfallDataPoint {
  label: string;
  value: number;
  type?: WaterfallType;
}

interface WaterfallChartProps {
  title: string;
  description?: string;
  data: WaterfallDataPoint[];
  height?: number;
  loading?: boolean;
  formatValue?: (value: number) => string;
  yAxisLabel?: string;
}

interface ProcessedWaterfallDataPoint extends WaterfallDataPoint {
  type: WaterfallType;
  start: number;
  end: number;
  displayValue: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toStringValue = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

function processWaterfallData(data: WaterfallDataPoint[]): ProcessedWaterfallDataPoint[] {
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
  yAxisLabel,
}: WaterfallChartProps) {
  const processedData = processWaterfallData(data);

  if (loading) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">{title}</CardTitle>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </CardHeader>
        <CardContent>
          <div className="animate-pulse" style={{ height }}>
            <div className="flex items-end gap-2 h-full">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="flex-1 bg-muted rounded-t"
                  style={{ height: `${30 + Math.random() * 60}%` }}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getBarColor = (type: WaterfallType) => {
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
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-lg text-foreground">{title}</CardTitle>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
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
                label={
                  yAxisLabel
                    ? {
                        value: yAxisLabel,
                        angle: -90,
                        position: "insideLeft",
                        style: { textAnchor: "middle", fill: "#64748b", fontSize: 11 },
                      }
                    : undefined
                }
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(15, 23, 42, 0.95)",
                  border: "1px solid rgba(100, 116, 139, 0.3)",
                  borderRadius: "8px",
                  padding: "12px",
                }}
                labelStyle={{ color: "#f8fafc", fontWeight: "bold", marginBottom: "4px" }}
                formatter={(
                  value: number | string,
                  name: string | number,
                  item: { payload?: unknown },
                ) => {
                  const payload: unknown = item.payload;
                  const payloadRecord = isRecord(payload) ? payload : {};
                  const rawType = toStringValue(payloadRecord.type);
                  const type =
                    rawType === "start" ||
                    rawType === "total" ||
                    rawType === "decrease" ||
                    rawType === "increase"
                      ? rawType
                      : undefined;
                  const displayValue =
                    typeof payloadRecord.displayValue === "number"
                      ? payloadRecord.displayValue
                      : value;
                  const prefix = type === "decrease" ? "-" : type === "increase" ? "+" : "";
                  const label =
                    type === "start" ? "Starting" : type === "total" ? "Total" : "Change";
                  return [`${prefix}${formatValue(Number(displayValue))}`, label ?? name];
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
        <div className="mt-4 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
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
