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
}

function getNpsColor(score: number): string {
  if (score >= 50) return "#22c55e"; // green
  if (score >= 30) return "#84cc16"; // lime
  if (score >= 0) return "#f59e0b"; // amber
  if (score >= -30) return "#f97316"; // orange
  return "#ef4444"; // red
}

function getNpsTextColor(score: number): string {
  if (score >= 50) return "text-green-500 dark:text-green-400";
  if (score >= 30) return "text-lime-500 dark:text-lime-400";
  if (score >= 0) return "text-amber-500 dark:text-amber-400";
  if (score >= -30) return "text-orange-500 dark:text-orange-400";
  return "text-red-500 dark:text-red-400";
}

function getNpsLabel(score: number): string {
  if (score >= 70) return "Excellent";
  if (score >= 50) return "Great";
  if (score >= 30) return "Good";
  if (score >= 0) return "Needs Work";
  return "Critical";
}

function getNpsBgGradient(score: number): string {
  if (score >= 50) return "from-green-500/10 to-green-500/5";
  if (score >= 30) return "from-lime-500/10 to-lime-500/5";
  if (score >= 0) return "from-amber-500/10 to-amber-500/5";
  if (score >= -30) return "from-orange-500/10 to-orange-500/5";
  return "from-red-500/10 to-red-500/5";
}

export function NpsGauge({
  score,
  previousScore,
  scoreTrend,
  yoyScore,
  yoyChange,
  loading = false,
  size = "lg",
}: NpsGaugeProps) {
  const sizeConfig = {
    sm: { width: 160, height: 100, strokeWidth: 12, fontSize: "text-3xl", labelSize: "text-sm" },
    md: { width: 200, height: 120, strokeWidth: 14, fontSize: "text-4xl", labelSize: "text-base" },
    lg: { width: 280, height: 160, strokeWidth: 18, fontSize: "text-6xl", labelSize: "text-lg" },
  };

  const { width, height, strokeWidth, fontSize, labelSize } = sizeConfig[size];

  // NPS ranges from -100 to +100, map to 0-180 degrees
  const normalizedScore = ((score + 100) / 200) * 180;
  const radius = (width / 2) - strokeWidth;
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
      <Card className="border-slate-200 dark:border-slate-700">
        <CardContent className="p-6">
          <div className="animate-pulse flex flex-col items-center">
            <div className="h-32 w-56 bg-slate-200 dark:bg-slate-700 rounded-t-full" />
            <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded mt-2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-slate-200 dark:border-slate-700 bg-gradient-to-b", getNpsBgGradient(score))}>
      <CardHeader className="pb-0">
        <CardTitle className="text-center text-sm font-medium text-slate-500 dark:text-slate-400">
          Platform NPS Score
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
              className="text-slate-200 dark:text-slate-700"
            />

            {/* Color segments */}
            {/* Critical: -100 to -30 (red) */}
            <path
              d={describeArc(centerX, centerY, radius, -180, -180 + 35)}
              fill="none"
              stroke="#ef4444"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              opacity={0.3}
            />
            {/* Needs Work: -30 to 0 (orange) */}
            <path
              d={describeArc(centerX, centerY, radius, -180 + 35, -180 + 50)}
              fill="none"
              stroke="#f97316"
              strokeWidth={strokeWidth}
              opacity={0.3}
            />
            {/* OK: 0 to 30 (amber) */}
            <path
              d={describeArc(centerX, centerY, radius, -180 + 50, -180 + 65)}
              fill="none"
              stroke="#f59e0b"
              strokeWidth={strokeWidth}
              opacity={0.3}
            />
            {/* Good: 30 to 50 (lime) */}
            <path
              d={describeArc(centerX, centerY, radius, -180 + 65, -180 + 75)}
              fill="none"
              stroke="#84cc16"
              strokeWidth={strokeWidth}
              opacity={0.3}
            />
            {/* Excellent: 50 to 100 (green) */}
            <path
              d={describeArc(centerX, centerY, radius, -180 + 75, 0)}
              fill="none"
              stroke="#22c55e"
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
              className="text-slate-800 dark:text-slate-200 transition-all duration-1000 ease-out"
            />
            <circle cx={centerX} cy={centerY} r={6} className="fill-slate-800 dark:fill-slate-200" />

            {/* Scale labels */}
            <text
              x={centerX - radius - 10}
              y={centerY + 5}
              textAnchor="end"
              className="fill-slate-400 text-xs"
            >
              -100
            </text>
            <text
              x={centerX + radius + 10}
              y={centerY + 5}
              textAnchor="start"
              className="fill-slate-400 text-xs"
            >
              100
            </text>
            <text
              x={centerX}
              y={centerY - radius - 10}
              textAnchor="middle"
              className="fill-slate-400 text-xs"
            >
              0
            </text>
          </svg>

          {/* Score Display */}
          <div className="text-center -mt-2">
            <p className={cn(fontSize, "font-bold", getNpsTextColor(score))}>
              {score}
            </p>
            <p className={cn(labelSize, "font-medium", getNpsTextColor(score))}>
              {getNpsLabel(score)}
            </p>
          </div>

          {/* Trend indicator */}
          {scoreTrend !== undefined && scoreTrend !== null && (
            <div className="flex items-center justify-center gap-1 mt-3">
              {scoreTrend > 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500 dark:text-green-400" />
              ) : scoreTrend < 0 ? (
                <TrendingDown className="h-4 w-4 text-red-500 dark:text-red-400" />
              ) : (
                <Minus className="h-4 w-4 text-slate-400" />
              )}
              <span className={scoreTrend >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                {scoreTrend > 0 ? "+" : ""}{scoreTrend} pts
              </span>
              <span className="text-slate-500 dark:text-slate-400 text-sm">vs previous period</span>
            </div>
          )}

          {/* YoY Comparison */}
          {yoyScore !== undefined && yoyScore !== null && (
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 w-full text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Year-over-Year</p>
              <div className="flex items-center justify-center gap-2">
                {yoyChange !== null && yoyChange !== undefined && yoyChange > 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500 dark:text-green-400" />
                ) : yoyChange !== null && yoyChange !== undefined && yoyChange < 0 ? (
                  <TrendingDown className="h-4 w-4 text-red-500 dark:text-red-400" />
                ) : (
                  <Minus className="h-4 w-4 text-slate-400" />
                )}
                <span className={cn(
                  "font-semibold",
                  yoyChange !== null && yoyChange !== undefined && yoyChange >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                )}>
                  {yoyChange !== null && yoyChange !== undefined && yoyChange > 0 ? "+" : ""}{yoyChange} pts
                </span>
                <span className="text-slate-500 dark:text-slate-400 text-sm">
                  (was {yoyScore})
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
