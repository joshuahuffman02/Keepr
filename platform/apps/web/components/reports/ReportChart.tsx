"use client";

import { useEffect, useState } from "react";

// Dynamic import for recharts to reduce initial bundle size
let ResponsiveContainer: any = null;
let LineChart: any = null;
let Line: any = null;
let BarChart: any = null;
let Bar: any = null;
let XAxis: any = null;
let YAxis: any = null;
let Tooltip: any = null;
let Legend: any = null;
let PieChart: any = null;
let Pie: any = null;
let Cell: any = null;

const loadRecharts = async () => {
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
  return { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell };
};

type Point = { x: string; y: number };
type Series = { label: string; chart: string; points: Point[] };

const palette = ["#2563eb", "#16a34a", "#f59e0b", "#ec4899", "#0ea5e9", "#8b5cf6"];

export function ReportChart({ series, chart }: { series: Series[]; chart: "line" | "bar" | "pie" }) {
  const [isRechartsLoaded, setIsRechartsLoaded] = useState(false);

  useEffect(() => {
    loadRecharts().then(() => setIsRechartsLoaded(true));
  }, []);

  if (!series?.length) return null;

  if (!isRechartsLoaded) {
    return (
      <div className="w-full h-[320px] flex items-center justify-center bg-muted rounded-lg">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          Loading chart…
        </div>
      </div>
    );
  }

  const sharedData = series[0].points;
  if (chart === "pie") {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie data={sharedData} dataKey="y" nameKey="x" innerRadius={60} outerRadius={100} paddingAngle={2}>
            {sharedData.map((_entry, idx) => (
              <Cell key={idx} fill={palette[idx % palette.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (chart === "bar") {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={sharedData}>
          <XAxis dataKey="x" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="y" name={series[0].label} fill={palette[0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={sharedData}>
        <XAxis dataKey="x" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        {series.map((s, idx) => (
          <Line key={s.label} dataKey="y" name={s.label} data={s.points} stroke={palette[idx % palette.length]} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
