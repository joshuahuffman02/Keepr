"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

type RechartsComponentName =
  | "PieChart"
  | "Pie"
  | "Cell"
  | "ResponsiveContainer"
  | "Tooltip"
  | "Legend"
  | "BarChart"
  | "Bar"
  | "XAxis"
  | "YAxis"
  | "CartesianGrid"
  | "LineChart"
  | "Line"
  | "AreaChart"
  | "Area"
  | "ReferenceLine"
  | "RadarChart"
  | "Radar"
  | "PolarGrid"
  | "PolarAngleAxis"
  | "PolarRadiusAxis";

type RechartsProps = Record<string, unknown>;
type NamedComponent = ComponentType<RechartsProps> & { displayName?: string };

const isComponentType = (value: unknown): value is ComponentType<RechartsProps> =>
  typeof value === "function";

const withRecharts = (exportName: RechartsComponentName) =>
  dynamic<RechartsProps>(
    async () => {
      const mod: Record<string, unknown> = await import("recharts");
      const Component = mod[exportName];
      if (!isComponentType(Component)) {
        const Empty: NamedComponent = () => null;
        Empty.displayName = `Recharts${exportName}Fallback`;
        return Empty;
      }
      const Wrapped: NamedComponent = (props: RechartsProps) => <Component {...props} />;
      Wrapped.displayName = `Recharts${exportName}`;
      return Wrapped;
    },
    { ssr: false },
  );

export const PieChart = withRecharts("PieChart");
export const Pie = withRecharts("Pie");
export const Cell = withRecharts("Cell");
export const ResponsiveContainer = withRecharts("ResponsiveContainer");
export const Tooltip = withRecharts("Tooltip");
export const Legend = withRecharts("Legend");
export const BarChart = withRecharts("BarChart");
export const Bar = withRecharts("Bar");
export const XAxis = withRecharts("XAxis");
export const YAxis = withRecharts("YAxis");
export const CartesianGrid = withRecharts("CartesianGrid");
export const LineChart = withRecharts("LineChart");
export const Line = withRecharts("Line");
export const AreaChart = withRecharts("AreaChart");
export const Area = withRecharts("Area");
export const ReferenceLine = withRecharts("ReferenceLine");
export const RadarChart = withRecharts("RadarChart");
export const Radar = withRecharts("Radar");
export const PolarGrid = withRecharts("PolarGrid");
export const PolarAngleAxis = withRecharts("PolarAngleAxis");
export const PolarRadiusAxis = withRecharts("PolarRadiusAxis");
