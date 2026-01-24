"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SlopeDataPoint {
  label: string;
  leftValue: number;
  rightValue: number;
  format?: "currency" | "number" | "percentage" | "score" | "days";
  isNegativeGood?: boolean; // For metrics like cancellation rate where decrease is good
}

interface SlopeGraphProps {
  title: string;
  description?: string;
  leftLabel: string;
  rightLabel: string;
  data: SlopeDataPoint[];
  loading?: boolean;
  height?: number;
}

function formatValue(value: number, format?: string): string {
  switch (format) {
    case "currency":
      if (value >= 1000000) {
        return `$${(value / 1000000).toFixed(1)}M`;
      } else if (value >= 1000) {
        return `$${(value / 1000).toFixed(0)}K`;
      }
      return `$${value.toFixed(0)}`;
    case "percentage":
      return `${value.toFixed(1)}%`;
    case "score":
      return value.toString();
    case "days":
      return `${value.toFixed(1)}d`;
    default:
      if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}K`;
      }
      return value.toLocaleString();
  }
}

export function SlopeGraph({
  title,
  description,
  leftLabel,
  rightLabel,
  data,
  loading = false,
  height = 400,
}: SlopeGraphProps) {
  const width = 500;
  const padding = { top: 60, right: 120, bottom: 40, left: 120 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  if (loading) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">{title}</CardTitle>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </CardHeader>
        <CardContent>
          <div className="animate-pulse" style={{ height }}>
            <div className="flex justify-between items-center h-full px-12">
              <div className="space-y-6 w-16">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-3 bg-muted rounded" />
                ))}
              </div>
              <div className="flex-1 mx-8">
                <div className="h-full border-l border-r border-border" />
              </div>
              <div className="space-y-6 w-16">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-3 bg-muted rounded" />
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Normalize values to positions
  // Each metric has its own scale based on its own min/max range
  const normalizedData = data.map((d) => {
    const min = Math.min(d.leftValue, d.rightValue) * 0.9;
    const max = Math.max(d.leftValue, d.rightValue) * 1.1;
    const range = max - min || 1;

    return {
      ...d,
      leftY: 1 - (d.leftValue - min) / range, // Inverted for SVG coordinate system
      rightY: 1 - (d.rightValue - min) / range,
    };
  });

  // Calculate vertical positions for each metric
  const lineSpacing = graphHeight / (data.length + 1);

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-lg text-foreground">{title}</CardTitle>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full"
            style={{ minWidth: 400, maxHeight: height }}
          >
            {/* Period Labels */}
            <text
              x={padding.left}
              y={30}
              textAnchor="middle"
              className="text-sm font-semibold fill-muted-foreground"
            >
              {leftLabel}
            </text>
            <text
              x={width - padding.right}
              y={30}
              textAnchor="middle"
              className="text-sm font-semibold fill-muted-foreground"
            >
              {rightLabel}
            </text>

            {/* Vertical axis lines */}
            <line
              x1={padding.left}
              y1={padding.top}
              x2={padding.left}
              y2={height - padding.bottom}
              stroke="currentColor"
              className="text-muted-foreground"
              strokeWidth={2}
            />
            <line
              x1={width - padding.right}
              y1={padding.top}
              x2={width - padding.right}
              y2={height - padding.bottom}
              stroke="currentColor"
              className="text-muted-foreground"
              strokeWidth={2}
            />

            {/* Slope lines and labels */}
            {normalizedData.map((d, idx) => {
              const baseY = padding.top + lineSpacing * (idx + 1);
              const leftY = baseY - 20 + d.leftY * 40; // Small variation around base
              const rightY = baseY - 20 + d.rightY * 40;

              const change = d.rightValue - d.leftValue;
              const percentChange =
                d.leftValue !== 0 ? ((change / d.leftValue) * 100).toFixed(1) : "0";
              const isPositive = d.isNegativeGood ? change < 0 : change > 0;
              const isNegative = d.isNegativeGood ? change > 0 : change < 0;

              const lineColor = isPositive
                ? "hsl(var(--status-success))"
                : isNegative
                  ? "hsl(var(--status-error))"
                  : "hsl(var(--muted-foreground))";

              return (
                <g key={d.label}>
                  {/* Metric label on left */}
                  <text
                    x={padding.left - 8}
                    y={baseY}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="text-xs fill-muted-foreground"
                  >
                    {d.label}
                  </text>

                  {/* Left value */}
                  <text
                    x={padding.left + 8}
                    y={leftY}
                    textAnchor="start"
                    dominantBaseline="middle"
                    className="text-xs font-medium fill-foreground"
                  >
                    {formatValue(d.leftValue, d.format)}
                  </text>

                  {/* Slope line */}
                  <line
                    x1={padding.left + 50}
                    y1={leftY}
                    x2={width - padding.right - 50}
                    y2={rightY}
                    stroke={lineColor}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />

                  {/* Dots at endpoints */}
                  <circle cx={padding.left + 50} cy={leftY} r={4} fill={lineColor} />
                  <circle cx={width - padding.right - 50} cy={rightY} r={4} fill={lineColor} />

                  {/* Right value */}
                  <text
                    x={width - padding.right - 8}
                    y={rightY}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="text-xs font-medium fill-foreground"
                  >
                    {formatValue(d.rightValue, d.format)}
                  </text>

                  {/* Change indicator on right */}
                  <text
                    x={width - padding.right + 8}
                    y={rightY}
                    textAnchor="start"
                    dominantBaseline="middle"
                    className={cn(
                      "text-xs font-medium",
                      isPositive
                        ? "fill-status-success"
                        : isNegative
                          ? "fill-status-error"
                          : "fill-muted-foreground",
                    )}
                  >
                    {change >= 0 ? "+" : ""}
                    {percentChange}%
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-status-success rounded" /> Improved
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-status-error rounded" /> Declined
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-muted rounded" /> Unchanged
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
