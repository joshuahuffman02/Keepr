"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Target,
  AlertTriangle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Flame,
  Snowflake,
  Info,
  DollarSign,
  BarChart3,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ==================== TYPES ====================

type DemandLevel = "very_low" | "low" | "moderate" | "high" | "very_high";

interface HeatmapDay {
  date: string;
  demandScore: number;
  demandLevel: DemandLevel;
  predictedOccupancy: number;
  existingOccupancy: number;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
}

interface DemandForecast {
  date: string;
  predictedOccupancy: number;
  predictedRevenue: number;
  confidenceLow: number;
  confidenceHigh: number;
  demandLevel: DemandLevel;
  factors: Array<{ name: string; impact: number; description: string }>;
  existingBookings: number;
}

// ==================== HELPER FUNCTIONS ====================

const demandLevelColors: Record<DemandLevel, { bg: string; text: string; border: string }> = {
  very_low: { bg: "bg-status-info/15", text: "text-status-info", border: "border-status-info" },
  low: { bg: "bg-status-info/15", text: "text-status-info", border: "border-status-info" },
  moderate: { bg: "bg-status-warning/15", text: "text-status-warning", border: "border-status-warning" },
  high: { bg: "bg-status-warning/15", text: "text-status-warning", border: "border-status-warning" },
  very_high: { bg: "bg-status-error/15", text: "text-status-error", border: "border-status-error" },
};

const demandLevelLabels: Record<DemandLevel, string> = {
  very_low: "Very Low",
  low: "Low",
  moderate: "Moderate",
  high: "High",
  very_high: "Very High",
};

function getDemandIcon(level: DemandLevel) {
  switch (level) {
    case "very_low":
      return <Snowflake className="h-3 w-3" />;
    case "low":
      return <Moon className="h-3 w-3" />;
    case "moderate":
      return <Sun className="h-3 w-3" />;
    case "high":
      return <Flame className="h-3 w-3" />;
    case "very_high":
      return <Flame className="h-3 w-3 text-red-600" />;
  }
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

// ==================== COMPONENTS ====================

function DemandLegend() {
  return (
    <div className="flex items-center gap-4 text-xs">
      <span className="text-slate-500">Demand:</span>
      {(Object.keys(demandLevelColors) as DemandLevel[]).map((level) => (
        <div key={level} className="flex items-center gap-1">
          <div
            className={cn(
              "h-3 w-3 rounded-sm",
              demandLevelColors[level].bg,
              demandLevelColors[level].border,
              "border"
            )}
          />
          <span className="text-slate-600">{demandLevelLabels[level]}</span>
        </div>
      ))}
    </div>
  );
}

function CalendarDay({
  day,
  isToday,
  isSelected,
  onClick,
}: {
  day: HeatmapDay;
  isToday: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const date = new Date(day.date);
  const dayNum = date.getDate();
  const colors = demandLevelColors[day.demandLevel];

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center justify-center p-1 rounded-md transition-all",
        "h-14 sm:h-16 border",
        colors.bg,
        colors.border,
        isSelected && "ring-2 ring-emerald-500 ring-offset-1",
        isToday && "ring-2 ring-slate-900 ring-offset-1",
        "hover:opacity-90 cursor-pointer"
      )}
    >
      <span
        className={cn("text-sm font-medium", colors.text, isToday && "font-bold")}
      >
        {dayNum}
      </span>
      <span className={cn("text-xs", colors.text)}>
        {Math.round(day.predictedOccupancy)}%
      </span>
      {day.isHoliday && (
        <div className="absolute top-0.5 right-0.5">
          <Sparkles className="h-2.5 w-2.5 text-amber-500" />
        </div>
      )}
      {day.isWeekend && !day.isHoliday && (
        <div className="absolute top-0.5 right-0.5">
          <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        </div>
      )}
    </button>
  );
}

function HeatmapCalendar({
  heatmap,
  selectedDate,
  onSelectDate,
}: {
  heatmap: HeatmapDay[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}) {
  const [monthOffset, setMonthOffset] = useState(0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  // Get current month view
  const viewDate = new Date();
  viewDate.setMonth(viewDate.getMonth() + monthOffset);
  const currentMonth = viewDate.getMonth();
  const currentYear = viewDate.getFullYear();

  // Get first day of month and days in month
  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  // Create heatmap lookup
  const heatmapByDate = useMemo(() => {
    const map = new Map<string, HeatmapDay>();
    for (const day of heatmap) {
      map.set(day.date, day);
    }
    return map;
  }, [heatmap]);

  // Generate calendar grid
  const calendarDays: (HeatmapDay | null)[] = [];

  // Add empty cells for days before first of month
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarDays.push(null);
  }

  // Add days of month
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const heatmapDay = heatmapByDate.get(dateStr);
    if (heatmapDay) {
      calendarDays.push(heatmapDay);
    } else {
      // Create placeholder for days outside forecast range
      calendarDays.push({
        date: dateStr,
        demandScore: 0,
        demandLevel: "moderate",
        predictedOccupancy: 0,
        existingOccupancy: 0,
        isWeekend: new Date(dateStr).getDay() === 0 || new Date(dateStr).getDay() === 6,
        isHoliday: false,
      });
    }
  }

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMonthOffset((m) => m - 1)}
          disabled={monthOffset <= 0}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-lg font-semibold">
          {viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMonthOffset((m) => m + 1)}
          disabled={monthOffset >= 2}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Week day headers */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {weekDays.map((day) => (
          <div key={day} className="text-xs font-medium text-slate-500 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, idx) =>
          day ? (
            <CalendarDay
              key={day.date}
              day={day}
              isToday={day.date === todayStr}
              isSelected={day.date === selectedDate}
              onClick={() => onSelectDate(day.date)}
            />
          ) : (
            <div key={`empty-${idx}`} className="h-14 sm:h-16" />
          )
        )}
      </div>

      {/* Legend */}
      <DemandLegend />
    </div>
  );
}

function DayDetailPanel({
  forecast,
  onClose,
}: {
  forecast: DemandForecast | null;
  onClose: () => void;
}) {
  if (!forecast) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-48 text-slate-400">
          <div className="text-center">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Select a day to view details</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const colors = demandLevelColors[forecast.demandLevel];
  const date = new Date(forecast.date);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">
              {date.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </CardTitle>
            <div
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-1",
                colors.bg,
                colors.text
              )}
            >
              {getDemandIcon(forecast.demandLevel)}
              {demandLevelLabels[forecast.demandLevel]} Demand
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Occupancy Prediction */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-slate-500">Predicted Occupancy</p>
            <p className="text-2xl font-bold text-slate-900">
              {Math.round(forecast.predictedOccupancy)}%
            </p>
            <p className="text-xs text-slate-400">
              Range: {Math.round(forecast.confidenceLow)}% - {Math.round(forecast.confidenceHigh)}%
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-slate-500">Projected Revenue</p>
            <p className="text-2xl font-bold text-emerald-600">
              {formatCurrency(forecast.predictedRevenue)}
            </p>
            <p className="text-xs text-slate-400">
              Currently booked: {forecast.existingBookings}%
            </p>
          </div>
        </div>

        {/* Booking Gap */}
        {forecast.predictedOccupancy > forecast.existingBookings && (
          <div className="bg-status-warning/15 border border-status-warning rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-status-warning mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-status-warning">Booking Gap</p>
                <p className="text-xs text-status-warning">
                  {Math.round(forecast.predictedOccupancy - forecast.existingBookings)}% gap between
                  predicted demand and current bookings
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Contributing Factors */}
        {forecast.factors.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500">Contributing Factors</p>
            <div className="space-y-1">
              {forecast.factors.map((factor, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-sm py-1 border-b border-slate-100 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    {factor.impact > 0 ? (
                      <TrendingUp className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-500" />
                    )}
                    <span className="text-slate-700">{factor.name}</span>
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      factor.impact > 0 ? "text-emerald-600" : "text-red-600"
                    )}
                  >
                    {factor.impact > 0 ? "+" : ""}
                    {Math.round(factor.impact * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InsightsPanel({
  insights,
  isLoading,
}: {
  insights: {
    peakDemandPeriods: Array<{ startDate: string; endDate: string; avgDemand: number; reason: string }>;
    lowDemandPeriods: Array<{ startDate: string; endDate: string; avgDemand: number; suggestion: string }>;
    upcomingOpportunities: Array<{ date: string; type: string; description: string }>;
  } | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4 space-y-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!insights) return null;

  return (
    <div className="space-y-4">
      {/* Peak Demand Periods */}
      {insights.peakDemandPeriods.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              Peak Demand Periods
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {insights.peakDemandPeriods.slice(0, 3).map((period, idx) => (
              <div key={idx} className="bg-status-warning/15 rounded-lg p-3 border border-status-warning/20">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-status-warning">
                    {formatDateRange(period.startDate, period.endDate)}
                  </span>
                  <span className="text-xs bg-status-warning/15 text-status-warning px-2 py-0.5 rounded-full">
                    {Math.round(period.avgDemand)}% demand
                  </span>
                </div>
                <p className="text-xs text-status-warning mt-1">{period.reason}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Low Demand Periods */}
      {insights.lowDemandPeriods.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Snowflake className="h-4 w-4 text-blue-500" />
              Low Demand Periods
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {insights.lowDemandPeriods.slice(0, 3).map((period, idx) => (
              <div key={idx} className="bg-status-info/15 rounded-lg p-3 border border-status-info/20">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-status-info">
                    {formatDateRange(period.startDate, period.endDate)}
                  </span>
                  <span className="text-xs bg-status-info/15 text-status-info px-2 py-0.5 rounded-full">
                    {Math.round(period.avgDemand)}% demand
                  </span>
                </div>
                <p className="text-xs text-status-info mt-1">{period.suggestion}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Upcoming Opportunities */}
      {insights.upcomingOpportunities.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {insights.upcomingOpportunities.slice(0, 5).map((opp, idx) => (
              <div key={idx} className="flex items-start gap-2 py-2 border-b border-slate-100 last:border-0">
                <div
                  className={cn(
                    "shrink-0 w-6 h-6 rounded-full flex items-center justify-center",
                    opp.type === "pricing"
                      ? "bg-status-success/15 text-status-success"
                      : "bg-purple-100 text-purple-600"
                  )}
                >
                  {opp.type === "pricing" ? (
                    <DollarSign className="h-3 w-3" />
                  ) : (
                    <Target className="h-3 w-3" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-700">{formatDate(opp.date)}</p>
                  <p className="text-xs text-slate-500">{opp.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryCards({
  summary,
  isLoading,
}: {
  summary: {
    avgPredictedOccupancy: number;
    totalPredictedRevenue: number;
    highDemandDays: number;
    lowDemandDays: number;
    confidenceScore: number;
  } | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!summary) return null;

  const cards = [
    {
      label: "90-Day Avg Occupancy",
      value: `${Math.round(summary.avgPredictedOccupancy)}%`,
      icon: <BarChart3 className="h-4 w-4 text-slate-400" />,
      color: "text-slate-900",
    },
    {
      label: "Projected Revenue",
      value: formatCurrency(summary.totalPredictedRevenue),
      icon: <DollarSign className="h-4 w-4 text-emerald-500" />,
      color: "text-emerald-600",
    },
    {
      label: "High Demand Days",
      value: summary.highDemandDays.toString(),
      icon: <Flame className="h-4 w-4 text-orange-500" />,
      color: "text-orange-600",
    },
    {
      label: "Forecast Confidence",
      value: `${summary.confidenceScore}%`,
      icon: <Target className="h-4 w-4 text-blue-500" />,
      color: "text-blue-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card, idx) => (
        <Card key={idx}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              {card.icon}
              <span className="text-xs text-slate-500">{card.label}</span>
            </div>
            <p className={cn("text-2xl font-bold", card.color)}>{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ==================== MAIN PAGE ====================

export default function DemandForecastPage() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Fetch demand forecast
  const { data: forecastData, isLoading: forecastLoading } = useQuery({
    queryKey: ["demand-forecast"],
    queryFn: () => apiClient.getDemandForecast("current", 90),
    enabled: typeof window !== "undefined",
    staleTime: 5 * 60 * 1000,
  });

  // Fetch heatmap
  const { data: heatmap, isLoading: heatmapLoading } = useQuery({
    queryKey: ["demand-heatmap"],
    queryFn: () => apiClient.getDemandHeatmap("current"),
    enabled: typeof window !== "undefined",
    staleTime: 5 * 60 * 1000,
  });

  // Fetch insights
  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ["demand-insights"],
    queryFn: () => apiClient.getDemandInsights("current"),
    enabled: typeof window !== "undefined",
    staleTime: 5 * 60 * 1000,
  });

  // Find selected forecast
  const selectedForecast = useMemo(() => {
    if (!selectedDate || !forecastData?.forecasts) return null;
    return forecastData.forecasts.find((f) => f.date === selectedDate) || null;
  }, [selectedDate, forecastData]);

  return (
    <DashboardShell>
      <div className="space-y-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Demand Forecast</h1>
            <p className="text-sm text-slate-500 mt-1">
              AI-powered 90-day demand predictions with confidence intervals
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Info className="h-3 w-3" />
            Based on historical patterns, seasonality, and booking trends
          </div>
        </div>

        {/* Summary Cards */}
        <SummaryCards summary={forecastData?.summary || null} isLoading={forecastLoading} />

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-slate-400" />
                  Demand Heatmap
                </CardTitle>
                <CardDescription>
                  Click any day to see detailed predictions and contributing factors
                </CardDescription>
              </CardHeader>
              <CardContent>
                {heatmapLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-8 w-full" />
                    <div className="grid grid-cols-7 gap-1">
                      {Array(35)
                        .fill(0)
                        .map((_, i) => (
                          <Skeleton key={i} className="h-14" />
                        ))}
                    </div>
                  </div>
                ) : heatmap ? (
                  <HeatmapCalendar
                    heatmap={heatmap}
                    selectedDate={selectedDate}
                    onSelectDate={setSelectedDate}
                  />
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    No forecast data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Day Detail */}
            <DayDetailPanel
              forecast={selectedForecast}
              onClose={() => setSelectedDate(null)}
            />

            {/* Insights */}
            <InsightsPanel insights={insights || null} isLoading={insightsLoading} />
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
