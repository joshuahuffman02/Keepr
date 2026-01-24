"use client";

import { useEffect, useState } from "react";

type RechartsModule = typeof import("recharts");
type LoadedRecharts = {
  ResponsiveContainer: RechartsModule["ResponsiveContainer"];
  LineChart: RechartsModule["LineChart"];
  Line: RechartsModule["Line"];
  BarChart: RechartsModule["BarChart"];
  Bar: RechartsModule["Bar"];
  XAxis: RechartsModule["XAxis"];
  YAxis: RechartsModule["YAxis"];
  Tooltip: RechartsModule["Tooltip"];
  Legend: RechartsModule["Legend"];
  PieChart: RechartsModule["PieChart"];
  Pie: RechartsModule["Pie"];
  Cell: RechartsModule["Cell"];
};

// Dynamic import for recharts to reduce initial bundle size
let ResponsiveContainer: LoadedRecharts["ResponsiveContainer"] | null = null;
let LineChart: LoadedRecharts["LineChart"] | null = null;
let Line: LoadedRecharts["Line"] | null = null;
let BarChart: LoadedRecharts["BarChart"] | null = null;
let Bar: LoadedRecharts["Bar"] | null = null;
let XAxis: LoadedRecharts["XAxis"] | null = null;
let YAxis: LoadedRecharts["YAxis"] | null = null;
let Tooltip: LoadedRecharts["Tooltip"] | null = null;
let Legend: LoadedRecharts["Legend"] | null = null;
let PieChart: LoadedRecharts["PieChart"] | null = null;
let Pie: LoadedRecharts["Pie"] | null = null;
let Cell: LoadedRecharts["Cell"] | null = null;

const loadRecharts = async (): Promise<LoadedRecharts> => {
  if (!ResponsiveContainer) {
    const rechartsModule = await import("recharts");
    ResponsiveContainer = rechartsModule.ResponsiveContainer;
    LineChart = rechartsModule.LineChart;
    Line = rechartsModule.Line;
    BarChart = rechartsModule.BarChart;
    Bar = rechartsModule.Bar;
    XAxis = rechartsModule.XAxis;
    YAxis = rechartsModule.YAxis;
    Tooltip = rechartsModule.Tooltip;
    Legend = rechartsModule.Legend;
    PieChart = rechartsModule.PieChart;
    Pie = rechartsModule.Pie;
    Cell = rechartsModule.Cell;
  }
  if (
    !ResponsiveContainer ||
    !LineChart ||
    !Line ||
    !BarChart ||
    !Bar ||
    !XAxis ||
    !YAxis ||
    !Tooltip ||
    !Legend ||
    !PieChart ||
    !Pie ||
    !Cell
  ) {
    throw new Error("Failed to load Recharts modules");
  }
  return {
    ResponsiveContainer,
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    PieChart,
    Pie,
    Cell,
  };
};

type Point = { x: string; y: number };
type Series = { label: string; chart: string; points: Point[] };

const palette = ["#2563eb", "#16a34a", "#f59e0b", "#ec4899", "#0ea5e9", "#8b5cf6"];

export function ReportChart({
  series,
  chart,
}: {
  series: Series[];
  chart: "line" | "bar" | "pie";
}) {
  const [recharts, setRecharts] = useState<LoadedRecharts | null>(null);

  useEffect(() => {
    loadRecharts().then(setRecharts);
  }, []);

  if (!series?.length) return null;

  if (!recharts) {
    return (
      <div className="w-full h-[320px] flex items-center justify-center bg-muted rounded-lg">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          Loading chart…
        </div>
      </div>
    );
  }
  const {
    ResponsiveContainer: RechartsContainer,
    LineChart: RechartsLineChart,
    Line: RechartsLine,
    BarChart: RechartsBarChart,
    Bar: RechartsBar,
    XAxis: RechartsXAxis,
    YAxis: RechartsYAxis,
    Tooltip: RechartsTooltip,
    Legend: RechartsLegend,
    PieChart: RechartsPieChart,
    Pie: RechartsPie,
    Cell: RechartsCell,
  } = recharts;

  const sharedData = series[0].points;
  if (chart === "pie") {
    return (
      <RechartsContainer width="100%" height={320}>
        <RechartsPieChart>
          <RechartsPie
            data={sharedData}
            dataKey="y"
            nameKey="x"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
          >
            {sharedData.map((_entry, idx) => (
              <RechartsCell key={idx} fill={palette[idx % palette.length]} />
            ))}
          </RechartsPie>
          <RechartsTooltip />
          <RechartsLegend />
        </RechartsPieChart>
      </RechartsContainer>
    );
  }

  if (chart === "bar") {
    return (
      <RechartsContainer width="100%" height={320}>
        <RechartsBarChart data={sharedData}>
          <RechartsXAxis dataKey="x" tick={{ fontSize: 12 }} />
          <RechartsYAxis tick={{ fontSize: 12 }} />
          <RechartsTooltip />
          <RechartsLegend />
          <RechartsBar dataKey="y" name={series[0].label} fill={palette[0]} />
        </RechartsBarChart>
      </RechartsContainer>
    );
  }

  return (
    <RechartsContainer width="100%" height={320}>
      <RechartsLineChart data={sharedData}>
        <RechartsXAxis dataKey="x" tick={{ fontSize: 12 }} />
        <RechartsYAxis tick={{ fontSize: 12 }} />
        <RechartsTooltip />
        <RechartsLegend />
        {series.map((s, idx) => (
          <RechartsLine
            key={s.label}
            dataKey="y"
            name={s.label}
            data={s.points}
            stroke={palette[idx % palette.length]}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </RechartsLineChart>
    </RechartsContainer>
  );
}
