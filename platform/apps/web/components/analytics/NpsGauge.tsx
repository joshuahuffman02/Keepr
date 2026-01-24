"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface NpsGaugeProps {
  score: number;
  previousScore?: number;
  scoreTrend?: number | null;
  yoyScore?: number | null;
  yoyChange?: number | null;
  loading?: boolean;
  size?: "sm" | "md" | "lg";
  title?: string;
}

function getNpsColor(score: number): string {
  if (score >= 30) return "hsl(var(--status-success))";
  if (score >= -30) return "hsl(var(--status-warning))";
  return "hsl(var(--status-error))";
}

function getNpsTextColor(score: number): string {
  if (score >= 30) return "text-status-success";
  if (score >= -30) return "text-status-warning";
  return "text-status-error";
}

function getNpsLabel(score: number): string {
  if (score >= 70) return "Excellent";
  if (score >= 50) return "Great";
  if (score >= 30) return "Good";
  if (score >= 0) return "Needs Work";
  return "Critical";
}

function getNpsBackground(score: number): string {
  if (score >= 30) return "bg-status-success-bg";
  if (score >= -30) return "bg-status-warning-bg";
  return "bg-status-error-bg";
}

export function NpsGauge({
  score,
  previousScore,
  scoreTrend,
  yoyScore,
  yoyChange,
  loading = false,
  size = "lg",
  title = "Platform NPS Score",
}: NpsGaugeProps) {
  const sizeConfig = {
    sm: { width: 160, height: 100, strokeWidth: 12, fontSize: "text-3xl", labelSize: "text-sm" },
    md: { width: 200, height: 120, strokeWidth: 14, fontSize: "text-4xl", labelSize: "text-base" },
    lg: { width: 280, height: 160, strokeWidth: 18, fontSize: "text-6xl", labelSize: "text-lg" },
  };

  const { width, height, strokeWidth, fontSize, labelSize } = sizeConfig[size];

  // NPS ranges from -100 to +100, map to 0-180 degrees
  const normalizedScore = ((score + 100) / 200) * 180;
  const radius = width / 2 - strokeWidth;
  const centerX = width / 2;
  const centerY = height - 10;

  // Create arc path
  const startAngle = -180;
  const endAngle = 0;
  const currentAngle = startAngle + normalizedScore;

  const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
    const rad = (angle * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  };

  const describeArc = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
  };

  const needlePoint = polarToCartesian(centerX, centerY, radius - 10, currentAngle);

  if (loading) {
    return (
      <Card className="border-border">
        <CardContent className="p-6">
          <div className="animate-pulse flex flex-col items-center">
            <div className="h-32 w-56 bg-muted rounded-t-full" />
            <div className="h-8 w-16 bg-muted rounded mt-2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-border", getNpsBackground(score))}>
      <CardHeader className="pb-0">
        <CardTitle className="text-center text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="flex flex-col items-center">
          {/* Gauge SVG */}
          <svg width={width} height={height} className="overflow-visible">
            {/* Background arc (grey) */}
            <path
              d={describeArc(centerX, centerY, radius, startAngle, endAngle)}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              className="text-muted-foreground"
            />

            {/* Color segments */}
            {/* Critical: -100 to -30 (red) */}
            <path
              d={describeArc(centerX, centerY, radius, -180, -180 + 35)}
              fill="none"
              stroke="hsl(var(--status-error))"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              opacity={0.3}
            />
            {/* Needs Work: -30 to 0 (orange) */}
            <path
              d={describeArc(centerX, centerY, radius, -180 + 35, -180 + 50)}
              fill="none"
              stroke="hsl(var(--status-warning))"
              strokeWidth={strokeWidth}
              opacity={0.3}
            />
            {/* OK: 0 to 30 (amber) */}
            <path
              d={describeArc(centerX, centerY, radius, -180 + 50, -180 + 65)}
              fill="none"
              stroke="hsl(var(--status-warning))"
              strokeWidth={strokeWidth}
              opacity={0.3}
            />
            {/* Good: 30 to 50 (lime) */}
            <path
              d={describeArc(centerX, centerY, radius, -180 + 65, -180 + 75)}
              fill="none"
              stroke="hsl(var(--status-success))"
              strokeWidth={strokeWidth}
              opacity={0.3}
            />
            {/* Excellent: 50 to 100 (green) */}
            <path
              d={describeArc(centerX, centerY, radius, -180 + 75, 0)}
              fill="none"
              stroke="hsl(var(--status-success))"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              opacity={0.3}
            />

            {/* Active progress arc */}
            <path
              d={describeArc(centerX, centerY, radius, startAngle, currentAngle)}
              fill="none"
              stroke={getNpsColor(score)}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />

            {/* Needle */}
            <line
              x1={centerX}
              y1={centerY}
              x2={needlePoint.x}
              y2={needlePoint.y}
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              className="text-foreground transition-all duration-1000 ease-out"
            />
            <circle cx={centerX} cy={centerY} r={6} className="fill-foreground" />

            {/* Scale labels */}
            <text
              x={centerX - radius - 10}
              y={centerY + 5}
              textAnchor="end"
              className="fill-muted-foreground text-xs"
            >
              -100
            </text>
            <text
              x={centerX + radius + 10}
              y={centerY + 5}
              textAnchor="start"
              className="fill-muted-foreground text-xs"
            >
              100
            </text>
            <text
              x={centerX}
              y={centerY - radius - 10}
              textAnchor="middle"
              className="fill-muted-foreground text-xs"
            >
              0
            </text>
          </svg>

          {/* Score Display */}
          <div className="text-center -mt-2">
            <p className={cn(fontSize, "font-bold", getNpsTextColor(score))}>{score}</p>
            <p className={cn(labelSize, "font-medium", getNpsTextColor(score))}>
              {getNpsLabel(score)}
            </p>
          </div>

          {/* Trend indicator */}
          {scoreTrend !== undefined && scoreTrend !== null && (
            <div className="flex items-center justify-center gap-1 mt-3">
              {scoreTrend > 0 ? (
                <TrendingUp className="h-4 w-4 text-status-success" />
              ) : scoreTrend < 0 ? (
                <TrendingDown className="h-4 w-4 text-status-error" />
              ) : (
                <Minus className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={scoreTrend >= 0 ? "text-status-success" : "text-status-error"}>
                {scoreTrend > 0 ? "+" : ""}
                {scoreTrend} pts
              </span>
              <span className="text-muted-foreground text-sm">vs previous period</span>
            </div>
          )}

          {/* YoY Comparison */}
          {yoyScore !== undefined && yoyScore !== null && (
            <div className="mt-3 pt-3 border-t border-border w-full text-center">
              <p className="text-xs text-muted-foreground mb-1">Year-over-Year</p>
              <div className="flex items-center justify-center gap-2">
                {yoyChange !== null && yoyChange !== undefined && yoyChange > 0 ? (
                  <TrendingUp className="h-4 w-4 text-status-success" />
                ) : yoyChange !== null && yoyChange !== undefined && yoyChange < 0 ? (
                  <TrendingDown className="h-4 w-4 text-status-error" />
                ) : (
                  <Minus className="h-4 w-4 text-muted-foreground" />
                )}
                <span
                  className={cn(
                    "font-semibold",
                    yoyChange !== null && yoyChange !== undefined && yoyChange >= 0
                      ? "text-status-success"
                      : "text-status-error",
                  )}
                >
                  {yoyChange !== null && yoyChange !== undefined && yoyChange > 0 ? "+" : ""}
                  {yoyChange} pts
                </span>
                <span className="text-muted-foreground text-sm">(was {yoyScore})</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
