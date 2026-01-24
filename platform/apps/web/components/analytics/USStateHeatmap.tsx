"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StateData {
  state: string;
  value: number;
  label?: string;
}

interface USStateHeatmapProps {
  title: string;
  description?: string;
  data: StateData[];
  loading?: boolean;
  formatValue?: (value: number) => string;
  colorScale?: "blue" | "green" | "purple" | "amber";
}

// US States arranged roughly geographically for a grid display
const US_GRID = [
  ["", "", "", "", "", "", "", "", "", "", "", "ME"],
  ["WA", "MT", "ND", "MN", "", "", "", "", "VT", "NH", "", ""],
  ["OR", "ID", "SD", "WI", "MI", "", "", "NY", "MA", "RI", "", ""],
  ["NV", "WY", "NE", "IA", "IL", "IN", "OH", "PA", "NJ", "CT", "", ""],
  ["CA", "UT", "CO", "KS", "MO", "KY", "WV", "VA", "MD", "DE", "", ""],
  ["", "AZ", "NM", "OK", "AR", "TN", "NC", "SC", "DC", "", "", ""],
  ["", "", "", "TX", "LA", "MS", "AL", "GA", "", "", "", ""],
  ["AK", "", "", "", "", "", "", "", "FL", "", "HI", ""],
];

const COLOR_SCALES = {
  blue: {
    bg: [
      "bg-blue-50",
      "bg-blue-100",
      "bg-blue-200",
      "bg-blue-300",
      "bg-blue-400",
      "bg-blue-500",
      "bg-blue-600",
    ],
    text: [
      "text-blue-700",
      "text-blue-700",
      "text-blue-700",
      "text-blue-900",
      "text-white",
      "text-white",
      "text-white",
    ],
  },
  green: {
    bg: [
      "bg-green-50",
      "bg-green-100",
      "bg-green-200",
      "bg-green-300",
      "bg-green-400",
      "bg-green-500",
      "bg-green-600",
    ],
    text: [
      "text-green-700",
      "text-green-700",
      "text-green-700",
      "text-green-900",
      "text-white",
      "text-white",
      "text-white",
    ],
  },
  purple: {
    bg: [
      "bg-purple-50",
      "bg-purple-100",
      "bg-purple-200",
      "bg-purple-300",
      "bg-purple-400",
      "bg-purple-500",
      "bg-purple-600",
    ],
    text: [
      "text-purple-700",
      "text-purple-700",
      "text-purple-700",
      "text-purple-900",
      "text-white",
      "text-white",
      "text-white",
    ],
  },
  amber: {
    bg: [
      "bg-amber-50",
      "bg-amber-100",
      "bg-amber-200",
      "bg-amber-300",
      "bg-amber-400",
      "bg-amber-500",
      "bg-amber-600",
    ],
    text: [
      "text-amber-700",
      "text-amber-700",
      "text-amber-700",
      "text-amber-900",
      "text-white",
      "text-white",
      "text-white",
    ],
  },
};

export function USStateHeatmap({
  title,
  description,
  data,
  loading = false,
  formatValue = (v) => v.toLocaleString(),
  colorScale = "blue",
}: USStateHeatmapProps) {
  // Create a map of state -> data
  const stateMap = new Map(data.map((d) => [d.state, d]));

  // Calculate min/max for color scaling
  const values = data.map((d) => d.value);
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);

  const getColorIndex = (value: number): number => {
    if (value === 0) return 0;
    const normalized = (value - minValue) / (maxValue - minValue);
    return Math.min(6, Math.floor(normalized * 6));
  };

  const colors = COLOR_SCALES[colorScale];

  if (loading) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">{title}</CardTitle>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="grid grid-cols-12 gap-1">
              {[...Array(8)].map((_, row) => (
                <div key={row} className="contents">
                  {[...Array(12)].map((_, col) => (
                    <div key={col} className="aspect-square bg-muted rounded" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-lg text-foreground">{title}</CardTitle>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-12 gap-1">
          {US_GRID.map((row, rowIdx) => (
            <div key={rowIdx} className="contents">
              {row.map((state, colIdx) => {
                if (!state) {
                  return <div key={colIdx} className="aspect-square" />;
                }

                const stateData = stateMap.get(state);
                const value = stateData?.value || 0;
                const colorIdx = getColorIndex(value);

                return (
                  <div
                    key={colIdx}
                    className={cn(
                      "aspect-square rounded flex items-center justify-center text-xs font-semibold cursor-default transition-transform hover:scale-110 hover:z-10",
                      value > 0 ? colors.bg[colorIdx] : "bg-muted",
                      value > 0 ? colors.text[colorIdx] : "text-muted-foreground",
                    )}
                    title={stateData ? `${state}: ${formatValue(value)}` : state}
                  >
                    {state}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-col items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground mr-2">Low</span>
            {colors.bg.map((bg, idx) => (
              <div key={idx} className={cn("w-6 h-4 rounded", bg)} />
            ))}
            <span className="text-xs text-muted-foreground ml-2">High</span>
          </div>
          <p className="text-xs text-muted-foreground">Hover over states for details</p>
        </div>

        {/* Top 5 States Summary */}
        <div className="mt-6 grid grid-cols-5 gap-2">
          {data.slice(0, 5).map((state, idx) => (
            <div key={idx} className="text-center p-2 bg-muted rounded">
              <span className="text-lg font-bold text-foreground">{state.state}</span>
              <p className="text-xs text-muted-foreground">{formatValue(state.value)}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
