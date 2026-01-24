"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { z } from "zod";
import {
  Activity,
  Users,
  MousePointerClick,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  BarChart3,
  Target,
  Eye,
  Zap,
  ArrowRight,
} from "lucide-react";

interface SessionStats {
  windowDays: number;
  totalSessions: number;
  avgDurationSecs: number;
  avgPageViews: number;
  avgActions: number;
  byActorType: Record<string, number>;
  byDevice: Record<string, number>;
}

const SessionStatsSchema = z.object({
  windowDays: z.number(),
  totalSessions: z.number(),
  avgDurationSecs: z.number(),
  avgPageViews: z.number(),
  avgActions: z.number(),
  byActorType: z.record(z.number()),
  byDevice: z.record(z.number()),
});

interface FeatureUsage {
  feature: string;
  totalUsage: number;
  uniqueUsers: number;
  avgDuration: number;
  successRate: number;
  errorCount: number;
}

const FeatureUsageSchema = z.object({
  feature: z.string(),
  totalUsage: z.number(),
  uniqueUsers: z.number(),
  avgDuration: z.number(),
  successRate: z.number(),
  errorCount: z.number(),
});
const FeatureUsageArraySchema = z.array(FeatureUsageSchema);

interface FunnelAnalysis {
  funnelName: string;
  windowDays: number;
  total: number;
  completed: number;
  abandoned: number;
  inProgress: number;
  completionRate: number;
  abandonmentRate: number;
  avgDurationSecs: number;
  stepCompletionRates: number[];
  abandonByStep: Record<string, number>;
}

const FunnelAnalysisSchema = z.object({
  funnelName: z.string(),
  windowDays: z.number(),
  total: z.number(),
  completed: z.number(),
  abandoned: z.number(),
  inProgress: z.number(),
  completionRate: z.number(),
  abandonmentRate: z.number(),
  avgDurationSecs: z.number(),
  stepCompletionRates: z.array(z.number()),
  abandonByStep: z.record(z.number()),
});

interface AnomalySummary {
  unacknowledged: number;
  last24h: number;
  last7d: number;
  bySeverity: Record<string, number>;
}

const AnomalySummarySchema = z.object({
  unacknowledged: z.number(),
  last24h: z.number(),
  last7d: z.number(),
  bySeverity: z.record(z.number()),
});

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default function AnalyticsOverviewPage() {
  const { campgroundId } = useAuth();

  // Fetch session stats
  const { data: sessionStats, isLoading: loadingSessions } = useQuery<SessionStats>({
    queryKey: ["analytics-sessions", campgroundId],
    queryFn: async () => {
      const response = await apiClient.get<SessionStats>(`/analytics/enhanced/reports/sessions`, {
        params: { campgroundId, days: 30 },
        schema: SessionStatsSchema,
      });
      return response.data;
    },
    enabled: !!campgroundId,
  });

  // Fetch feature usage
  const { data: featureUsage, isLoading: loadingFeatures } = useQuery<FeatureUsage[]>({
    queryKey: ["analytics-features", campgroundId],
    queryFn: async () => {
      const response = await apiClient.get<FeatureUsage[]>(`/analytics/enhanced/reports/features`, {
        params: { campgroundId, days: 30 },
        schema: FeatureUsageArraySchema,
      });
      return response.data;
    },
    enabled: !!campgroundId,
  });

  // Fetch booking funnel
  const { data: bookingFunnel, isLoading: loadingFunnel } = useQuery<FunnelAnalysis>({
    queryKey: ["analytics-funnel-booking", campgroundId],
    queryFn: async () => {
      const response = await apiClient.get<FunnelAnalysis>(`/analytics/enhanced/reports/funnel`, {
        params: { campgroundId, funnelName: "booking", days: 30 },
        schema: FunnelAnalysisSchema,
      });
      return response.data;
    },
    enabled: !!campgroundId,
  });

  // Fetch anomaly summary
  const { data: anomalySummary, isLoading: loadingAnomalies } = useQuery<AnomalySummary>({
    queryKey: ["analytics-anomalies", campgroundId],
    queryFn: async () => {
      const response = await apiClient.get<AnomalySummary>(`/analytics/anomalies/summary`, {
        params: { campgroundId },
        schema: AnomalySummarySchema,
      });
      return response.data;
    },
    enabled: !!campgroundId,
  });

  const isLoading = loadingSessions || loadingFeatures || loadingFunnel || loadingAnomalies;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Track staff usage, guest behavior, and system performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/analytics/live">
            <Button variant="outline" className="gap-2">
              <Activity className="h-4 w-4" />
              Live Activity
            </Button>
          </Link>
        </div>
      </div>

      {/* Anomaly Alerts */}
      {anomalySummary && anomalySummary.unacknowledged > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-100 p-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-amber-900">
                  {anomalySummary.unacknowledged} unacknowledged anomalies detected
                </p>
                <p className="text-sm text-amber-700">
                  {anomalySummary.bySeverity.critical || 0} critical,{" "}
                  {anomalySummary.bySeverity.warning || 0} warnings
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="border-amber-300 text-amber-700">
              Review Anomalies
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingSessions ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {sessionStats?.totalSessions.toLocaleString() || 0}
                </div>
                <p className="text-xs text-muted-foreground">Last 30 days</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Session Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingSessions ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatDuration(sessionStats?.avgDurationSecs || 0)}
                </div>
                <p className="text-xs text-muted-foreground">Per session</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Page Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingSessions ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {(sessionStats?.avgPageViews || 0).toFixed(1)}
                </div>
                <p className="text-xs text-muted-foreground">Per session</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Booking Conversion</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingFunnel ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatPercent(bookingFunnel?.completionRate || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {bookingFunnel?.completed || 0} of {bookingFunnel?.total || 0} completed
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Feature Usage */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Feature Usage</CardTitle>
              <CardDescription>Most used features in the last 30 days</CardDescription>
            </div>
            <Link href="/dashboard/analytics/features">
              <Button variant="ghost" size="sm" className="gap-1">
                View All <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loadingFeatures ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {(featureUsage || []).slice(0, 5).map((feature, index) => (
                  <div
                    key={feature.feature}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium capitalize">
                          {feature.feature.replace(/_/g, " ")}
                        </p>
                        <p className="text-sm text-muted-foreground">{feature.uniqueUsers} users</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{feature.totalUsage.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">uses</p>
                    </div>
                  </div>
                ))}
                {(!featureUsage || featureUsage.length === 0) && (
                  <p className="text-center text-muted-foreground py-8">
                    No feature usage data yet
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Booking Funnel */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Booking Funnel</CardTitle>
              <CardDescription>Guest journey from browse to booking</CardDescription>
            </div>
            <Link href="/dashboard/analytics/funnels">
              <Button variant="ghost" size="sm" className="gap-1">
                All Funnels <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loadingFunnel ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : bookingFunnel ? (
              <div className="space-y-4">
                {/* Funnel visualization */}
                <div className="space-y-2">
                  {[
                    "Page View",
                    "Availability Check",
                    "Add to Cart",
                    "Start Checkout",
                    "Complete",
                  ].map((step, index) => {
                    const rate = bookingFunnel.stepCompletionRates[index] || 0;
                    return (
                      <div key={step} className="flex items-center gap-3">
                        <div className="w-32 text-sm">{step}</div>
                        <div className="flex-1">
                          <div className="h-8 rounded bg-muted">
                            <div
                              className="h-full rounded bg-primary transition-all"
                              style={{ width: `${rate * 100}%` }}
                            />
                          </div>
                        </div>
                        <div className="w-16 text-right text-sm font-medium">
                          {formatPercent(rate)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Summary stats */}
                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{bookingFunnel.completed}</p>
                    <p className="text-sm text-muted-foreground">Completed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">{bookingFunnel.abandoned}</p>
                    <p className="text-sm text-muted-foreground">Abandoned</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-amber-600">{bookingFunnel.inProgress}</p>
                    <p className="text-sm text-muted-foreground">In Progress</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No funnel data available</p>
            )}
          </CardContent>
        </Card>

        {/* Device Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Device Breakdown</CardTitle>
            <CardDescription>Sessions by device type</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingSessions ? (
              <Skeleton className="h-40 w-full" />
            ) : sessionStats?.byDevice ? (
              <div className="space-y-3">
                {Object.entries(sessionStats.byDevice).map(([device, count]) => {
                  const total = Object.values(sessionStats.byDevice).reduce((a, b) => a + b, 0);
                  const percent = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <div key={device} className="flex items-center gap-3">
                      <div className="w-20 text-sm capitalize">{device}</div>
                      <div className="flex-1">
                        <div className="h-6 rounded bg-muted">
                          <div
                            className="h-full rounded bg-primary transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                      <div className="w-20 text-right text-sm">
                        {count} ({percent.toFixed(0)}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No device data available</p>
            )}
          </CardContent>
        </Card>

        {/* Actor Type Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>User Types</CardTitle>
            <CardDescription>Sessions by user type</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingSessions ? (
              <Skeleton className="h-40 w-full" />
            ) : sessionStats?.byActorType ? (
              <div className="space-y-3">
                {Object.entries(sessionStats.byActorType).map(([actor, count]) => {
                  const total = Object.values(sessionStats.byActorType).reduce((a, b) => a + b, 0);
                  const percent = total > 0 ? (count / total) * 100 : 0;
                  const colors: Record<string, string> = {
                    staff: "bg-blue-500",
                    guest: "bg-green-500",
                    anonymous: "bg-gray-400",
                  };
                  return (
                    <div key={actor} className="flex items-center gap-3">
                      <div className="w-20 text-sm capitalize">{actor}</div>
                      <div className="flex-1">
                        <div className="h-6 rounded bg-muted">
                          <div
                            className={`h-full rounded ${colors[actor] || "bg-primary"} transition-all`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                      <div className="w-20 text-right text-sm">
                        {count} ({percent.toFixed(0)}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No user data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-4">
        <Link href="/dashboard/analytics/pages">
          <Card className="cursor-pointer transition-colors hover:bg-muted/50">
            <CardContent className="flex items-center gap-3 py-4">
              <Eye className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Page Usage</p>
                <p className="text-sm text-muted-foreground">View page analytics</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/analytics/features">
          <Card className="cursor-pointer transition-colors hover:bg-muted/50">
            <CardContent className="flex items-center gap-3 py-4">
              <Zap className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Feature Adoption</p>
                <p className="text-sm text-muted-foreground">Track feature usage</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/analytics/staff">
          <Card className="cursor-pointer transition-colors hover:bg-muted/50">
            <CardContent className="flex items-center gap-3 py-4">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Staff Metrics</p>
                <p className="text-sm text-muted-foreground">Staff efficiency</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/analytics/live">
          <Card className="cursor-pointer transition-colors hover:bg-muted/50">
            <CardContent className="flex items-center gap-3 py-4">
              <Activity className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Live Activity</p>
                <p className="text-sm text-muted-foreground">Real-time events</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
