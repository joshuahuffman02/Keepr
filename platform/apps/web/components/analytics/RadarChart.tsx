"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RechartsRadarChart,
  ResponsiveContainer,
  Tooltip,
} from "@/components/charts/recharts";

interface RadarDataPoint {
  metric: string;
  value: number;
  benchmark?: number;
  fullMark?: number;
}

interface RadarChartProps {
  title: string;
  description?: string;
  data: RadarDataPoint[];
  valueLabel?: string;
  benchmarkLabel?: string;
  showBenchmark?: boolean;
  height?: number;
  loading?: boolean;
}

export function RadarChart({
  title,
  description,
  data,
  valueLabel = "Your Value",
  benchmarkLabel = "Benchmark",
  showBenchmark = true,
  height = 400,
  loading = false,
}: RadarChartProps) {
  if (loading) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">{title}</CardTitle>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </CardHeader>
        <CardContent>
          <div className="animate-pulse flex items-center justify-center" style={{ height }}>
            <div className="w-64 h-64 rounded-full bg-muted" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Normalize data to percentiles for consistent radar display
  const maxValue = Math.max(
    ...data.map((d) => Math.max(d.value, d.benchmark || 0, d.fullMark || 100)),
  );

  const normalizedData = data.map((d) => ({
    ...d,
    fullMark: d.fullMark || maxValue,
  }));

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-lg text-foreground">{title}</CardTitle>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent>
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <RechartsRadarChart cx="50%" cy="50%" outerRadius="80%" data={normalizedData}>
              <PolarGrid stroke="#64748b" strokeOpacity={0.3} />
              <PolarAngleAxis
                dataKey="metric"
                tick={{ fill: "#64748b", fontSize: 12 }}
                tickLine={false}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, "auto"]}
                tick={{ fill: "#64748b", fontSize: 10 }}
                tickCount={5}
              />
              <Radar
                name={valueLabel}
                dataKey="value"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.4}
                strokeWidth={2}
              />
              {showBenchmark && (
                <Radar
                  name={benchmarkLabel}
                  dataKey="benchmark"
                  stroke="#f59e0b"
                  fill="#f59e0b"
                  fillOpacity={0.2}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                />
              )}
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(15, 23, 42, 0.95)",
                  border: "1px solid rgba(100, 116, 139, 0.3)",
                  borderRadius: "8px",
                  padding: "12px",
                }}
                labelStyle={{ color: "#f8fafc", fontWeight: "bold", marginBottom: "4px" }}
                itemStyle={{ color: "#cbd5e1" }}
              />
              <Legend
                wrapperStyle={{ paddingTop: "16px" }}
                formatter={(value: string) => (
                  <span className="text-muted-foreground">{value}</span>
                )}
              />
            </RechartsRadarChart>
          </ResponsiveContainer>
        </div>

        {/* Score interpretation legend */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-blue-500" />
              {valueLabel}
            </span>
            {showBenchmark && (
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 border-t-2 border-dashed border-amber-500" />
                {benchmarkLabel}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
