"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { apiClient } from "@/lib/api-client";
import { useCampground } from "@/contexts/CampgroundContext";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowLeft,
  Sparkles,
  Target,
  BarChart3,
  AlertCircle,
  ChevronRight,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  BedDouble,
  Gauge,
  Lightbulb,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  useYieldUpdates,
  useRealtime,
  YieldMetricsUpdatedData,
  YieldRecommendationData,
  YieldForecastUpdatedData,
} from "@/hooks/use-realtime";
import { useToast } from "@/hooks/use-toast";

const SPRING_CONFIG: { type: "spring"; stiffness: number; damping: number } = {
  type: "spring",
  stiffness: 300,
  damping: 25,
};

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function getChangeIcon(value: number) {
  if (value > 0) return <ArrowUpRight className="h-4 w-4 text-emerald-500" />;
  if (value < 0) return <ArrowDownRight className="h-4 w-4 text-red-500" />;
  return null;
}

function getChangeColor(value: number): string {
  if (value > 0) return "text-emerald-600";
  if (value < 0) return "text-red-600";
  return "text-slate-500";
}

export default function YieldDashboardPage() {
  const [selectedPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isConnected } = useRealtime();
  const { selectedCampground, isHydrated } = useCampground();
  const campgroundId = selectedCampground?.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ["yield-dashboard", campgroundId],
    queryFn: () => apiClient.getYieldDashboard(campgroundId!),
    enabled: isHydrated && !!campgroundId,
    refetchInterval: 60000, // Refresh every minute (fallback for when WebSocket is disconnected)
  });

  // Price elasticity query
  const { data: elasticityData } = useQuery({
    queryKey: ["price-sensitivity", campgroundId],
    queryFn: () => apiClient.getPriceSensitivity(campgroundId!),
    enabled: isHydrated && !!campgroundId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Handle real-time yield metrics updates
  const handleMetricsUpdated = useCallback(
    (eventData: YieldMetricsUpdatedData) => {
      // Optimistically update the cache with new metrics
      queryClient.setQueryData(["yield-dashboard"], (oldData: typeof data) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          metrics: {
            ...oldData.metrics,
            todayOccupancy: eventData.todayOccupancy,
            todayRevenue: eventData.todayRevenue,
            todayADR: eventData.todayADR,
            todayRevPAN: eventData.todayRevPAN,
            periodOccupancy: eventData.periodOccupancy,
            periodRevenue: eventData.periodRevenue,
            next7DaysOccupancy: eventData.next7DaysOccupancy,
            next30DaysOccupancy: eventData.next30DaysOccupancy,
            gapNights: eventData.gapNights,
            pendingRecommendations: eventData.pendingRecommendations,
            potentialRevenue: eventData.potentialRevenue,
          },
        };
      });

      // Show a subtle notification for significant changes
      if (eventData.triggeredBy === "reservation") {
        toast({
          title: "Metrics Updated",
          description: "Yield metrics refreshed after booking change",
        });
      }
    },
    [queryClient, toast],
  );

  // Handle new pricing recommendations
  const handleRecommendationGenerated = useCallback(
    (eventData: YieldRecommendationData) => {
      // Invalidate to refetch recommendations
      queryClient.invalidateQueries({ queryKey: ["yield-dashboard"] });

      toast({
        title: "New Pricing Recommendation",
        description: `${eventData.reason} - potential +${formatCurrency(eventData.estimatedRevenueDelta)}`,
      });
    },
    [queryClient, toast],
  );

  // Handle forecast updates
  const handleForecastUpdated = useCallback(
    (eventData: YieldForecastUpdatedData) => {
      // Update forecast data in cache
      queryClient.setQueryData(["yield-dashboard"], (oldData: typeof data) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          forecasts: eventData.forecasts,
          metrics: {
            ...oldData.metrics,
            next7DaysOccupancy: eventData.avgOccupancy7Days,
            next30DaysOccupancy: eventData.avgOccupancy30Days,
            forecastRevenue30Days: eventData.totalProjectedRevenue,
          },
        };
      });
    },
    [queryClient],
  );

  // Subscribe to yield real-time events
  useYieldUpdates({
    onMetricsUpdated: handleMetricsUpdated,
    onRecommendationGenerated: handleRecommendationGenerated,
    onForecastUpdated: handleForecastUpdated,
  });

  if (!isHydrated || !campgroundId) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-500" />
            <p className="text-slate-500">
              {!isHydrated ? "Loading..." : "Please select a campground"}
            </p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (isLoading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-500" />
            <p className="text-slate-500">Loading yield metrics...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (error || !data) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-amber-500" />
            <h2 className="text-xl font-semibold text-slate-900">Unable to load yield data</h2>
            <p className="text-slate-500">Please try again later or contact support.</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </div>
      </DashboardShell>
    );
  }

  const { metrics, occupancyTrend, forecasts, topRecommendations, revenueInsights } = data;

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/ai">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                AI Hub
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Gauge className="h-6 w-6 text-emerald-600" />
                Yield Command Center
              </h1>
              <p className="text-slate-500">Revenue optimization dashboard</p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              isConnected
                ? "text-emerald-600 border-emerald-200 bg-emerald-50"
                : "text-amber-600 border-amber-200 bg-amber-50",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full mr-2",
                isConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500",
              )}
            />
            {isConnected ? "Live" : "Polling"}
          </Badge>
        </div>

        {/* Today's KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_CONFIG, delay: 0 }}
          >
            <Card className="border-l-4 border-l-emerald-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Today's Occupancy</p>
                    <p className="text-3xl font-bold text-slate-900">
                      {formatPercent(metrics.todayOccupancy)}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Percent className="h-6 w-6 text-emerald-600" />
                  </div>
                </div>
                <div className="mt-4">
                  <Progress value={metrics.todayOccupancy} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_CONFIG, delay: 0.1 }}
          >
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Today's Revenue</p>
                    <p className="text-3xl font-bold text-slate-900">
                      {formatCurrency(metrics.todayRevenue)}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                {metrics.yoyChange && (
                  <div className="mt-4 flex items-center gap-1">
                    {getChangeIcon(metrics.yoyChange.revenue)}
                    <span
                      className={cn(
                        "text-sm font-medium",
                        getChangeColor(metrics.yoyChange.revenue),
                      )}
                    >
                      {metrics.yoyChange.revenue > 0 ? "+" : ""}
                      {formatPercent(metrics.yoyChange.revenue)} YoY
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_CONFIG, delay: 0.2 }}
          >
            <Card className="border-l-4 border-l-violet-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">ADR (Avg Daily Rate)</p>
                    <p className="text-3xl font-bold text-slate-900">
                      {formatCurrency(metrics.todayADR)}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-violet-100 flex items-center justify-center">
                    <BedDouble className="h-6 w-6 text-violet-600" />
                  </div>
                </div>
                {metrics.yoyChange && (
                  <div className="mt-4 flex items-center gap-1">
                    {getChangeIcon(metrics.yoyChange.adr)}
                    <span
                      className={cn("text-sm font-medium", getChangeColor(metrics.yoyChange.adr))}
                    >
                      {metrics.yoyChange.adr > 0 ? "+" : ""}
                      {formatPercent(metrics.yoyChange.adr)} YoY
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_CONFIG, delay: 0.3 }}
          >
            <Card className="border-l-4 border-l-amber-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">RevPAN</p>
                    <p className="text-3xl font-bold text-slate-900">
                      {formatCurrency(metrics.todayRevPAN)}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                    <Target className="h-6 w-6 text-amber-600" />
                  </div>
                </div>
                <p className="mt-4 text-xs text-slate-500">Revenue Per Available Night</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Forecast Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_CONFIG, delay: 0.4 }}
          >
            <Card className="bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <Calendar className="h-5 w-5 text-emerald-600" />
                  <span className="font-semibold text-slate-900">Next 7 Days</span>
                </div>
                <div className="text-center">
                  <p className="text-4xl font-bold text-emerald-600">
                    {formatPercent(metrics.next7DaysOccupancy)}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">Projected Occupancy</p>
                </div>
                <Progress value={metrics.next7DaysOccupancy} className="mt-4 h-2" />
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_CONFIG, delay: 0.5 }}
          >
            <Card className="bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold text-slate-900">Next 30 Days</span>
                </div>
                <div className="text-center">
                  <p className="text-4xl font-bold text-blue-600">
                    {formatPercent(metrics.next30DaysOccupancy)}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">Projected Occupancy</p>
                </div>
                <Progress value={metrics.next30DaysOccupancy} className="mt-4 h-2" />
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_CONFIG, delay: 0.6 }}
          >
            <Card className="bg-card">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <DollarSign className="h-5 w-5 text-violet-600" />
                  <span className="font-semibold text-slate-900">30-Day Revenue</span>
                </div>
                <div className="text-center">
                  <p className="text-4xl font-bold text-violet-600">
                    {formatCurrency(metrics.forecastRevenue30Days)}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">Projected Revenue</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Opportunities & Recommendations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Money on the Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_CONFIG, delay: 0.7 }}
          >
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-amber-500" />
                    Money on the Table
                  </CardTitle>
                  <Badge variant="outline" className="text-amber-600">
                    {metrics.gapNights} gap nights
                  </Badge>
                </div>
                <CardDescription>Revenue opportunities waiting to be captured</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg">
                    <div>
                      <p className="font-semibold text-slate-900">Potential Revenue</p>
                      <p className="text-sm text-slate-500">From identified opportunities</p>
                    </div>
                    <p className="text-2xl font-bold text-amber-600">
                      {formatCurrency(metrics.potentialRevenue)}
                    </p>
                  </div>

                  {revenueInsights.length > 0 ? (
                    <div className="space-y-3">
                      {revenueInsights.slice(0, 3).map((insight) => (
                        <div
                          key={insight.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                              <Target className="h-4 w-4 text-amber-600" />
                            </div>
                            <div>
                              <p className="font-medium text-slate-900 text-sm">{insight.title}</p>
                              <p className="text-xs text-slate-500">Priority: {insight.priority}</p>
                            </div>
                          </div>
                          {insight.estimatedValueCents && (
                            <span className="text-sm font-semibold text-emerald-600">
                              +{formatCurrency(insight.estimatedValueCents)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No revenue insights at this time</p>
                    </div>
                  )}

                  <Link href="/ai/revenue">
                    <Button variant="outline" className="w-full">
                      View All Opportunities
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Pricing Recommendations */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_CONFIG, delay: 0.8 }}
          >
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-emerald-500" />
                    Pricing Recommendations
                  </CardTitle>
                  <Badge variant="outline" className="text-emerald-600">
                    {metrics.pendingRecommendations} pending
                  </Badge>
                </div>
                <CardDescription>
                  AI-suggested price adjustments to optimize revenue
                </CardDescription>
              </CardHeader>
              <CardContent>
                {topRecommendations.length > 0 ? (
                  <div className="space-y-3">
                    {topRecommendations.slice(0, 4).map((rec) => (
                      <div
                        key={rec.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-slate-900 text-sm">
                              {format(new Date(rec.dateStart), "MMM d")} -{" "}
                              {format(new Date(rec.dateEnd), "MMM d")}
                            </p>
                            <Badge
                              variant="outline"
                              className={cn(
                                rec.adjustmentPercent > 0
                                  ? "text-emerald-600 border-emerald-200"
                                  : "text-red-600 border-red-200",
                              )}
                            >
                              {rec.adjustmentPercent > 0 ? "+" : ""}
                              {formatPercent(rec.adjustmentPercent)}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {formatCurrency(rec.currentPrice)} &rarr;{" "}
                            {formatCurrency(rec.suggestedPrice)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-emerald-600">
                            +{formatCurrency(rec.estimatedRevenueDelta)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatPercent(rec.confidence * 100)} conf.
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No pricing recommendations at this time</p>
                  </div>
                )}

                <Link href="/ai/pricing">
                  <Button variant="outline" className="w-full mt-4">
                    View All Recommendations
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Occupancy Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_CONFIG, delay: 0.9 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                    30-Day Occupancy Trend
                  </CardTitle>
                  <CardDescription>Historical occupancy performance</CardDescription>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Clock className="h-4 w-4" />
                  Last 30 days
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {occupancyTrend.length > 0 ? (
                <div className="space-y-4">
                  {/* Simple bar chart representation */}
                  <div className="flex items-end gap-1 h-32">
                    {occupancyTrend.map((day, i) => (
                      <div
                        key={day.date}
                        className="flex-1 bg-emerald-500 rounded-t transition-all hover:bg-emerald-600"
                        style={{ height: `${Math.max(day.occupancy, 5)}%` }}
                        title={`${format(new Date(day.date), "MMM d")}: ${formatPercent(day.occupancy)}`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>
                      {occupancyTrend.length > 0 &&
                        format(new Date(occupancyTrend[0].date), "MMM d")}
                    </span>
                    <span>
                      {occupancyTrend.length > 0 &&
                        format(new Date(occupancyTrend[occupancyTrend.length - 1].date), "MMM d")}
                    </span>
                  </div>

                  {/* Period Summary */}
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-slate-900">
                        {formatPercent(metrics.periodOccupancy)}
                      </p>
                      <p className="text-xs text-slate-500">Avg Occupancy</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-slate-900">
                        {formatCurrency(metrics.periodRevenue)}
                      </p>
                      <p className="text-xs text-slate-500">Total Revenue</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-slate-900">{metrics.periodNights}</p>
                      <p className="text-xs text-slate-500">Days Tracked</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No historical data available</p>
                  <p className="text-sm mt-1">Occupancy snapshots will be recorded daily</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Price Elasticity Section */}
        {elasticityData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_CONFIG, delay: 0.95 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingDown className="h-5 w-5 text-violet-500" />
                      Price Elasticity Analysis
                    </CardTitle>
                    <CardDescription>How demand responds to price changes</CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      elasticityData.elasticity < -1.5
                        ? "text-red-600 border-red-200 bg-red-50"
                        : elasticityData.elasticity < -0.5
                          ? "text-amber-600 border-amber-200 bg-amber-50"
                          : "text-emerald-600 border-emerald-200 bg-emerald-50",
                    )}
                  >
                    {elasticityData.elasticity < -1.5
                      ? "Highly Elastic"
                      : elasticityData.elasticity < -0.5
                        ? "Moderately Elastic"
                        : "Inelastic"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Elasticity Gauge */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Elasticity Score</span>
                      <span className="text-2xl font-bold text-slate-900">
                        {elasticityData.elasticity.toFixed(2)}
                      </span>
                    </div>
                    <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "absolute h-full rounded-full transition-all",
                          elasticityData.elasticity < -1.5
                            ? "bg-red-500"
                            : elasticityData.elasticity < -0.5
                              ? "bg-amber-500"
                              : "bg-emerald-500",
                        )}
                        style={{
                          width: `${Math.min(Math.abs(elasticityData.elasticity) * 30, 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>More Price Sensitive</span>
                      <span>Less Price Sensitive</span>
                    </div>

                    {/* Optimal Price Range */}
                    {elasticityData.optimalPriceRange.min > 0 && (
                      <div className="mt-4 p-4 bg-violet-50 rounded-lg border border-violet-100">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="h-4 w-4 text-violet-600" />
                          <span className="text-sm font-medium text-violet-900">
                            Optimal Price Range
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-bold text-violet-700">
                            {formatCurrency(elasticityData.optimalPriceRange.min)}
                          </span>
                          <span className="text-slate-400">-</span>
                          <span className="text-xl font-bold text-violet-700">
                            {formatCurrency(elasticityData.optimalPriceRange.max)}
                          </span>
                          <span className="text-sm text-slate-500">/night</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Price Points Distribution */}
                  <div className="space-y-4">
                    <span className="text-sm font-medium text-slate-700">
                      Booking Distribution by Price
                    </span>
                    {elasticityData.pricePoints.length > 0 ? (
                      <div className="space-y-2">
                        {elasticityData.pricePoints.slice(0, 6).map((point, i) => {
                          const maxBookings = Math.max(
                            ...elasticityData.pricePoints.map((p) => p.bookings),
                          );
                          const width = (point.bookings / maxBookings) * 100;
                          return (
                            <div key={i} className="flex items-center gap-3">
                              <div className="w-20 text-sm text-slate-600 font-medium">
                                {formatCurrency(point.price)}
                              </div>
                              <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full transition-all"
                                  style={{ width: `${width}%` }}
                                />
                              </div>
                              <div className="w-16 text-right text-sm text-slate-600">
                                {point.bookings} bookings
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-500">
                        <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Not enough booking data</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Insight */}
                {elasticityData.insight && (
                  <div className="mt-6 p-4 bg-slate-50 rounded-lg border flex items-start gap-3">
                    <Lightbulb className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-700">{elasticityData.insight}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Forecast Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_CONFIG, delay: 1.0 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-500" />
                Occupancy Forecast
              </CardTitle>
              <CardDescription>Projected occupancy for the next 14 days</CardDescription>
            </CardHeader>
            <CardContent>
              {forecasts.length > 0 ? (
                <div className="overflow-x-auto">
                  <div className="grid grid-cols-7 gap-2 min-w-[600px]">
                    {forecasts.slice(0, 14).map((day) => {
                      const date = new Date(day.date);
                      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                      const occupancyLevel =
                        day.occupancyPct >= 80
                          ? "bg-emerald-500"
                          : day.occupancyPct >= 50
                            ? "bg-amber-500"
                            : "bg-red-400";

                      return (
                        <div
                          key={day.date}
                          className={cn(
                            "p-3 rounded-lg text-center border",
                            isWeekend ? "bg-slate-50" : "bg-white",
                          )}
                        >
                          <p className="text-xs font-medium text-slate-500">
                            {format(date, "EEE")}
                          </p>
                          <p className="text-sm font-semibold text-slate-900">
                            {format(date, "MMM d")}
                          </p>
                          <div className="mt-2">
                            <div
                              className={cn(
                                "inline-block px-2 py-1 rounded text-white text-xs font-bold",
                                occupancyLevel,
                              )}
                            >
                              {formatPercent(day.occupancyPct)}
                            </div>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {day.occupiedSites}/{day.totalSites}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No forecast data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardShell>
  );
}
