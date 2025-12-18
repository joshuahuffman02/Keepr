"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

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
  if (loading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg text-white">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse flex items-center justify-center" style={{ height }}>
            <div className="h-48 w-48 rounded-full bg-slate-700/50" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const total = data.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const entry = payload[0];
      const percentage = ((entry.value / total) * 100).toFixed(1);
      return (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium" style={{ color: entry.payload.fill }}>
            {entry.name}
          </p>
          <p className="text-white text-sm">
            {formatValue(entry.value)} ({percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const renderLegend = (props: any) => {
    const { payload } = props;
    // Use vertical layout for 5+ items, horizontal for fewer
    const useVertical = payload.length >= 5;
    return (
      <ul className={useVertical
        ? "flex flex-col gap-1.5 mt-2 text-xs"
        : "flex flex-wrap justify-center gap-4 mt-4"
      }>
        {payload.map((entry: any, index: number) => (
          <li key={`item-${index}`} className="flex items-center gap-2 text-sm">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-slate-400 text-xs truncate">{entry.value}</span>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-white">{title}</CardTitle>
        {description && <p className="text-sm text-slate-400">{description}</p>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
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
                <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            {showLegend && <Legend content={renderLegend} />}
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
