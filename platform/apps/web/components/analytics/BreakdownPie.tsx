"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";

type RechartsModule = typeof import("recharts");
type LoadedRecharts = {
  PieChart: RechartsModule["PieChart"];
  Pie: RechartsModule["Pie"];
  Cell: RechartsModule["Cell"];
  ResponsiveContainer: RechartsModule["ResponsiveContainer"];
  Legend: RechartsModule["Legend"];
  Tooltip: RechartsModule["Tooltip"];
};

// Dynamic import for recharts to reduce initial bundle size
let PieChart: LoadedRecharts["PieChart"] | null = null;
let Pie: LoadedRecharts["Pie"] | null = null;
let Cell: LoadedRecharts["Cell"] | null = null;
let ResponsiveContainer: LoadedRecharts["ResponsiveContainer"] | null = null;
let Legend: LoadedRecharts["Legend"] | null = null;
let Tooltip: LoadedRecharts["Tooltip"] | null = null;

const loadRecharts = async (): Promise<LoadedRecharts> => {
  if (!PieChart) {
    const rechartsModule = await import("recharts");
    PieChart = rechartsModule.PieChart;
    Pie = rechartsModule.Pie;
    Cell = rechartsModule.Cell;
    ResponsiveContainer = rechartsModule.ResponsiveContainer;
    Legend = rechartsModule.Legend;
    Tooltip = rechartsModule.Tooltip;
  }
  if (!PieChart || !Pie || !Cell || !ResponsiveContainer || !Legend || !Tooltip) {
    throw new Error("Failed to load Recharts modules");
  }
  return { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip };
};

type TooltipPayloadEntry = {
  name?: string;
  value?: number;
  payload?: { fill?: string };
};

type TooltipContentProps = {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
};

type LegendEntry = {
  color?: string;
  value?: string;
};

type LegendProps = {
  payload?: LegendEntry[];
};

interface BreakdownPieProps {
  title: string;
  description?: string;
  data: { name: string; value: number; color?: string }[];
  height?: number;
  showLegend?: boolean;
  formatValue?: (value: number) => string;
  loading?: boolean;
}

const COLORS = [
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#06b6d4", // cyan-500
  "#f97316", // orange-500
];

export function BreakdownPie({
  title,
  description,
  data,
  height = 300,
  showLegend = true,
  formatValue = (v) => v.toLocaleString(),
  loading = false,
}: BreakdownPieProps) {
  const [isRechartsLoaded, setIsRechartsLoaded] = useState(false);

  useEffect(() => {
    loadRecharts().then(() => setIsRechartsLoaded(true));
  }, []);

  if (loading || !isRechartsLoaded) {
    return (
      <Card className="bg-muted/50 border-border">
        <CardHeader>
          <CardTitle className="text-lg text-white">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse flex items-center justify-center" style={{ height }}>
            <div className="h-48 w-48 rounded-full bg-muted/50" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!PieChart || !Pie || !Cell || !ResponsiveContainer || !Legend || !Tooltip) {
    return null;
  }

  const PieChartComponent = PieChart;
  const PieComponent = Pie;
  const CellComponent = Cell;
  const ResponsiveContainerComponent = ResponsiveContainer;
  const LegendComponent = Legend;
  const TooltipComponent = Tooltip;

  const total = data.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }: TooltipContentProps) => {
    const entry = payload?.[0];
    if (active && entry?.value !== undefined) {
      const percentage = total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0.0";
      return (
        <div className="bg-muted border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium" style={{ color: entry.payload?.fill }}>
            {entry.name ?? "Unknown"}
          </p>
          <p className="text-white text-sm">
            {formatValue(entry.value)} ({percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const renderLegend = ({ payload }: LegendProps) => {
    const items = payload ?? [];
    // Use vertical layout for 5+ items, horizontal for fewer
    const useVertical = items.length >= 5;
    return (
      <ul
        className={
          useVertical
            ? "flex flex-col gap-1.5 mt-2 text-xs"
            : "flex flex-wrap justify-center gap-4 mt-4"
        }
      >
        {items.map((entry, index) => (
          <li key={`item-${index}`} className="flex items-center gap-2 text-sm">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: entry.color ?? COLORS[index % COLORS.length] }}
            />
            <span className="text-muted-foreground text-xs truncate">
              {entry.value ?? "Unknown"}
            </span>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <Card className="bg-muted/50 border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-white">{title}</CardTitle>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainerComponent width="100%" height={height}>
          <PieChartComponent>
            <PieComponent
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
            >
              {data.map((entry, index) => (
                <CellComponent
                  key={`cell-${index}`}
                  fill={entry.color || COLORS[index % COLORS.length]}
                />
              ))}
            </PieComponent>
            <TooltipComponent content={<CustomTooltip />} />
            {showLegend && <LegendComponent content={renderLegend} />}
          </PieChartComponent>
        </ResponsiveContainerComponent>
      </CardContent>
    </Card>
  );
}
