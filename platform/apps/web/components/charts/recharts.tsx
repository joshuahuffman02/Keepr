"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

const withRecharts = <TProps,>(exportName: string) =>
  dynamic(
    () =>
      import("recharts").then(
        (mod) => mod[exportName as keyof typeof mod] as unknown as ComponentType<TProps>
      ),
    { ssr: false }
  );

export const PieChart = withRecharts<any>("PieChart");
export const Pie = withRecharts<any>("Pie");
export const Cell = withRecharts<any>("Cell");
export const ResponsiveContainer = withRecharts<any>("ResponsiveContainer");
export const Tooltip = withRecharts<any>("Tooltip");
export const Legend = withRecharts<any>("Legend");
export const BarChart = withRecharts<any>("BarChart");
export const Bar = withRecharts<any>("Bar");
export const XAxis = withRecharts<any>("XAxis");
export const YAxis = withRecharts<any>("YAxis");
export const CartesianGrid = withRecharts<any>("CartesianGrid");
export const LineChart = withRecharts<any>("LineChart");
export const Line = withRecharts<any>("Line");
export const AreaChart = withRecharts<any>("AreaChart");
export const Area = withRecharts<any>("Area");
export const ReferenceLine = withRecharts<any>("ReferenceLine");
