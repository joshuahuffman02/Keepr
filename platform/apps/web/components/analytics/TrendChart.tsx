"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import type { TooltipProps } from "recharts";

// Dynamic import for recharts to reduce initial bundle size
type RechartsModule = typeof import("recharts");

let LineChart: RechartsModule["LineChart"] | null = null;
let Line: RechartsModule["Line"] | null = null;
let AreaChart: RechartsModule["AreaChart"] | null = null;
let Area: RechartsModule["Area"] | null = null;
let BarChart: RechartsModule["BarChart"] | null = null;
let Bar: RechartsModule["Bar"] | null = null;
let XAxis: RechartsModule["XAxis"] | null = null;
let YAxis: RechartsModule["YAxis"] | null = null;
let CartesianGrid: RechartsModule["CartesianGrid"] | null = null;
let Tooltip: RechartsModule["Tooltip"] | null = null;
let ResponsiveContainer: RechartsModule["ResponsiveContainer"] | null = null;
let Legend: RechartsModule["Legend"] | null = null;

const loadRecharts = async () => {
  if (!LineChart) {
    const rechartsModule = await import("recharts");
    LineChart = rechartsModule.LineChart;
    Line = rechartsModule.Line;
    AreaChart = rechartsModule.AreaChart;
    Area = rechartsModule.Area;
    BarChart = rechartsModule.BarChart;
    Bar = rechartsModule.Bar;
    XAxis = rechartsModule.XAxis;
    YAxis = rechartsModule.YAxis;
    CartesianGrid = rechartsModule.CartesianGrid;
    Tooltip = rechartsModule.Tooltip;
    ResponsiveContainer = rechartsModule.ResponsiveContainer;
    Legend = rechartsModule.Legend;
  }
  return {
    LineChart,
    Line,
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
  };
};

interface TrendChartProps {
  title: string;
  description?: string;
  data: Array<Record<string, number | string | null>>;
  dataKeys: {
    key: string;
    color: string;
    name?: string;
  }[];
  xAxisKey: string;
  type?: "line" | "area" | "bar";
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  formatYAxis?: (value: number) => string;
  formatTooltip?: (value: number) => string;
  loading?: boolean;
  yAxisLabel?: string;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);

export function TrendChart({
  title,
  description,
  data,
  dataKeys,
  xAxisKey,
  type = "line",
  height = 300,
  showGrid = true,
  showLegend = true,
  formatYAxis = formatNumber,
  formatTooltip = formatNumber,
  loading = false,
  yAxisLabel,
}: TrendChartProps) {
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
            <div className="h-full w-full bg-muted/50 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (
    !LineChart ||
    !Line ||
    !AreaChart ||
    !Area ||
    !BarChart ||
    !Bar ||
    !XAxis ||
    !YAxis ||
    !CartesianGrid ||
    !Tooltip ||
    !ResponsiveContainer ||
    !Legend
  ) {
    return null;
  }

  const LineChartComponent = LineChart;
  const LineComponent = Line;
  const AreaChartComponent = AreaChart;
  const AreaComponent = Area;
  const BarChartComponent = BarChart;
  const BarComponent = Bar;
  const XAxisComponent = XAxis;
  const YAxisComponent = YAxis;
  const CartesianGridComponent = CartesianGrid;
  const TooltipComponent = Tooltip;
  const ResponsiveContainerComponent = ResponsiveContainer;
  const LegendComponent = Legend;

  const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-muted border border-border rounded-lg p-3 shadow-lg">
          <p className="text-muted-foreground text-sm mb-2">{label}</p>
          {payload.map((entry, index) => {
            const rawValue = typeof entry.value === "number" ? entry.value : Number(entry.value);
            const safeValue = Number.isFinite(rawValue) ? rawValue : 0;
            const color = typeof entry.color === "string" ? entry.color : "#94a3b8";
            const name = entry.name ?? entry.dataKey ?? "Value";
            return (
              <p key={index} className="text-sm" style={{ color }}>
                {name}: {formatTooltip(safeValue)}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  const renderChart = () => {
    const commonProps = {
      data,
      margin: { top: 5, right: 20, left: 10, bottom: 5 },
    };

    switch (type) {
      case "area":
        return (
          <AreaChartComponent {...commonProps}>
            {showGrid && <CartesianGridComponent strokeDasharray="3 3" stroke="#334155" />}
            <XAxisComponent
              dataKey={xAxisKey}
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              stroke="#475569"
            />
            <YAxisComponent
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              stroke="#475569"
              tickFormatter={formatYAxis}
              label={
                yAxisLabel
                  ? {
                      value: yAxisLabel,
                      angle: -90,
                      position: "insideLeft",
                      style: { textAnchor: "middle", fill: "#94a3b8", fontSize: 12 },
                    }
                  : undefined
              }
            />
            <TooltipComponent content={<CustomTooltip />} />
            {showLegend && <LegendComponent wrapperStyle={{ paddingTop: 10 }} />}
            {dataKeys.map((dk) => (
              <AreaComponent
                key={dk.key}
                type="monotone"
                dataKey={dk.key}
                name={dk.name || dk.key}
                stroke={dk.color}
                fill={dk.color}
                fillOpacity={0.2}
                strokeWidth={2}
              />
            ))}
          </AreaChartComponent>
        );

      case "bar":
        return (
          <BarChartComponent {...commonProps}>
            {showGrid && <CartesianGridComponent strokeDasharray="3 3" stroke="#334155" />}
            <XAxisComponent
              dataKey={xAxisKey}
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              stroke="#475569"
            />
            <YAxisComponent
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              stroke="#475569"
              tickFormatter={formatYAxis}
              label={
                yAxisLabel
                  ? {
                      value: yAxisLabel,
                      angle: -90,
                      position: "insideLeft",
                      style: { textAnchor: "middle", fill: "#94a3b8", fontSize: 12 },
                    }
                  : undefined
              }
            />
            <TooltipComponent content={<CustomTooltip />} />
            {showLegend && <LegendComponent wrapperStyle={{ paddingTop: 10 }} />}
            {dataKeys.map((dk) => (
              <BarComponent
                key={dk.key}
                dataKey={dk.key}
                name={dk.name || dk.key}
                fill={dk.color}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChartComponent>
        );

      default:
        return (
          <LineChartComponent {...commonProps}>
            {showGrid && <CartesianGridComponent strokeDasharray="3 3" stroke="#334155" />}
            <XAxisComponent
              dataKey={xAxisKey}
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              stroke="#475569"
            />
            <YAxisComponent
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              stroke="#475569"
              tickFormatter={formatYAxis}
              label={
                yAxisLabel
                  ? {
                      value: yAxisLabel,
                      angle: -90,
                      position: "insideLeft",
                      style: { textAnchor: "middle", fill: "#94a3b8", fontSize: 12 },
                    }
                  : undefined
              }
            />
            <TooltipComponent content={<CustomTooltip />} />
            {showLegend && <LegendComponent wrapperStyle={{ paddingTop: 10 }} />}
            {dataKeys.map((dk) => (
              <LineComponent
                key={dk.key}
                type="monotone"
                dataKey={dk.key}
                name={dk.name || dk.key}
                stroke={dk.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChartComponent>
        );
    }
  };

  return (
    <Card className="bg-muted/50 border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-white">{title}</CardTitle>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainerComponent width="100%" height={height}>
          {renderChart()}
        </ResponsiveContainerComponent>
      </CardContent>
    </Card>
  );
}

export { formatCurrency, formatNumber };
