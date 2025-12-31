"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DivergingBarData {
  label: string;
  positive: number;
  negative: number;
  neutral?: number;
  score?: number;
}

interface DivergingBarProps {
  title: string;
  description?: string;
  data: DivergingBarData[];
  positiveLabel?: string;
  negativeLabel?: string;
  neutralLabel?: string;
  showScore?: boolean;
  maxValue?: number;
  loading?: boolean;
}

export function DivergingBar({
  title,
  description,
  data,
  positiveLabel = "Promoters",
  negativeLabel = "Detractors",
  neutralLabel = "Passives",
  showScore = true,
  maxValue,
  loading = false,
}: DivergingBarProps) {
  // Calculate max for scaling (use largest total or provided max)
  const calculatedMax = maxValue || Math.max(
    ...data.map(d => Math.max(d.positive, d.negative, (d.neutral || 0)))
  );

  if (loading) {
    return (
      <Card className="border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900 dark:text-white">{title}</CardTitle>
          {description && <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>}
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-24 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="flex-1 h-6 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardHeader>
        <CardTitle className="text-lg text-slate-900 dark:text-white">{title}</CardTitle>
        {description && <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      </CardHeader>
      <CardContent>
        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mb-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500" />
            <span className="text-slate-600 dark:text-slate-400">{positiveLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-amber-500" />
            <span className="text-slate-600 dark:text-slate-400">{neutralLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500" />
            <span className="text-slate-600 dark:text-slate-400">{negativeLabel}</span>
          </div>
        </div>

        {/* Diverging bars */}
        <div className="space-y-4">
          {data.map((item, idx) => {
            const positiveWidth = (item.positive / calculatedMax) * 100;
            const negativeWidth = (item.negative / calculatedMax) * 100;
            const neutralWidth = ((item.neutral || 0) / calculatedMax) * 100;

            return (
              <div key={idx} className="flex items-center gap-3">
                {/* Label */}
                <div className="w-28 flex-shrink-0 text-right">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate block">
                    {item.label}
                  </span>
                  {showScore && item.score !== undefined && (
                    <span className={cn(
                      "text-xs font-semibold",
                      item.score >= 50 ? "text-green-600 dark:text-green-400" :
                      item.score >= 0 ? "text-amber-600 dark:text-amber-400" :
                      "text-red-600 dark:text-red-400"
                    )}>
                      NPS: {item.score}
                    </span>
                  )}
                </div>

                {/* Bar container */}
                <div className="flex-1 flex items-center">
                  {/* Negative side (detractors) - right aligned */}
                  <div className="w-1/2 flex justify-end">
                    <div
                      className="h-7 bg-red-500 rounded-l-md transition-all duration-500 flex items-center justify-start pl-2"
                      style={{ width: `${negativeWidth}%`, minWidth: item.negative > 0 ? '24px' : '0' }}
                    >
                      {negativeWidth > 15 && (
                        <span className="text-xs font-medium text-white">{item.negative}%</span>
                      )}
                    </div>
                  </div>

                  {/* Center line */}
                  <div className="w-px h-8 bg-slate-300 dark:bg-slate-600" />

                  {/* Positive side (promoters) - left aligned */}
                  <div className="w-1/2 flex justify-start">
                    <div
                      className="h-7 bg-green-500 rounded-r-md transition-all duration-500 flex items-center justify-end pr-2"
                      style={{ width: `${positiveWidth}%`, minWidth: item.positive > 0 ? '24px' : '0' }}
                    >
                      {positiveWidth > 15 && (
                        <span className="text-xs font-medium text-white">{item.positive}%</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Axis labels */}
        <div className="flex items-center mt-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="w-28 flex-shrink-0" />
          <div className="flex-1 flex justify-between px-2">
            <span>{negativeLabel}</span>
            <span className="font-medium">0</span>
            <span>{positiveLabel}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
