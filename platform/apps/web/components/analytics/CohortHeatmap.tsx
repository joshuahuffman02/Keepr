"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CohortData {
  cohort: string;
  [key: string]: string | number;
}

interface CohortHeatmapProps {
  title: string;
  description?: string;
  data: CohortData[];
  periodKeys: string[];
  periodLabels?: string[];
  loading?: boolean;
  colorScale?: "retention" | "growth" | "custom";
  thresholds?: { good: number; warning: number };
}

// Color interpolation for smooth gradients
function getRetentionColor(value: number, thresholds = { good: 80, warning: 60 }): string {
  if (value === 0) return "bg-muted dark:bg-muted";
  if (value >= 90) return "bg-emerald-500";
  if (value >= thresholds.good) return "bg-emerald-400";
  if (value >= 70) return "bg-lime-400";
  if (value >= thresholds.warning) return "bg-amber-400";
  if (value >= 50) return "bg-orange-400";
  return "bg-red-400";
}

function getRetentionTextColor(value: number): string {
  if (value === 0) return "text-muted-foreground dark:text-muted-foreground";
  if (value >= 70) return "text-white";
  return "text-foreground dark:text-white";
}

// Calculate cell opacity for gradient effect (higher value = more opaque)
function getCellOpacity(value: number): string {
  if (value === 0) return "opacity-30";
  if (value >= 90) return "opacity-100";
  if (value >= 80) return "opacity-95";
  if (value >= 70) return "opacity-90";
  if (value >= 60) return "opacity-85";
  return "opacity-80";
}

export function CohortHeatmap({
  title,
  description,
  data,
  periodKeys,
  periodLabels,
  loading = false,
  thresholds = { good: 80, warning: 60 },
}: CohortHeatmapProps) {
  const labels = periodLabels || periodKeys;

  if (loading) {
    return (
      <Card className="border-border dark:border-border">
        <CardHeader>
          <CardTitle className="text-lg text-foreground dark:text-white">{title}</CardTitle>
          {description && <p className="text-sm text-muted-foreground dark:text-muted-foreground">{description}</p>}
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-8 bg-muted dark:bg-muted rounded" />
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-2">
                <div className="h-10 w-32 bg-muted dark:bg-muted rounded" />
                {[...Array(5)].map((_, j) => (
                  <div key={j} className="h-10 w-16 bg-muted dark:bg-muted rounded" />
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border dark:border-border">
      <CardHeader>
        <CardTitle className="text-lg text-foreground dark:text-white">{title}</CardTitle>
        {description && <p className="text-sm text-muted-foreground dark:text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left py-3 px-3 text-sm font-medium text-muted-foreground dark:text-muted-foreground min-w-[140px]">
                  Cohort
                </th>
                {labels.map((label, idx) => (
                  <th
                    key={idx}
                    className="text-center py-3 px-2 text-sm font-medium text-muted-foreground dark:text-muted-foreground min-w-[70px]"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  <td className="py-2 px-3 text-sm font-medium text-foreground dark:text-white whitespace-nowrap">
                    {row.cohort}
                  </td>
                  {periodKeys.map((key, colIdx) => {
                    const value = typeof row[key] === "number" ? row[key] as number : 0;
                    return (
                      <td key={colIdx} className="py-2 px-1">
                        <div
                          className={cn(
                            "flex items-center justify-center h-10 rounded-md text-sm font-semibold transition-all",
                            getRetentionColor(value, thresholds),
                            getRetentionTextColor(value),
                            getCellOpacity(value),
                            value > 0 && "hover:scale-105 hover:shadow-lg cursor-default"
                          )}
                          title={value > 0 ? `${value}% retention` : "No data yet"}
                        >
                          {value > 0 ? `${value}%` : "—"}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground dark:text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="font-medium">Retention:</span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-emerald-500" />
              90%+
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-emerald-400" />
              80-89%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-lime-400" />
              70-79%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-amber-400" />
              60-69%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-orange-400" />
              50-59%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-red-400" />
              &lt;50%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
