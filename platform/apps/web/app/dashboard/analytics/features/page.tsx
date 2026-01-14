"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  ArrowUpDown,
  Zap,
  Users,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  Star,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { z } from "zod";

interface FeatureStats {
  id: string;
  feature: string;
  subFeature: string | null;
  usageCount: number;
  uniqueUsers: number;
  totalSessions: number;
  avgDuration: number | null;
  successRate: number | null;
  lastUsedAt: string | null;
  date: string;
}

const FeatureStatsSchema = z.object({
  id: z.string(),
  feature: z.string(),
  subFeature: z.string().nullable(),
  usageCount: z.number(),
  uniqueUsers: z.number(),
  totalSessions: z.number(),
  avgDuration: z.number().nullable(),
  successRate: z.number().nullable(),
  lastUsedAt: z.string().nullable(),
  date: z.string(),
});
const FeatureStatsArraySchema = z.array(FeatureStatsSchema);

function formatDuration(seconds: number | null): string {
  if (!seconds) return "-";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

function formatPercent(value: number | null): string {
  if (value === null) return "-";
  return `${(value * 100).toFixed(0)}%`;
}

type SortField = "usageCount" | "uniqueUsers" | "avgDuration" | "successRate";
type SortOrder = "asc" | "desc";

// Feature categories for grouping
const FEATURE_CATEGORIES: Record<string, { label: string; color: string }> = {
  reservations: { label: "Reservations", color: "bg-blue-500" },
  pos: { label: "Point of Sale", color: "bg-green-500" },
  guests: { label: "Guests", color: "bg-purple-500" },
  housekeeping: { label: "Housekeeping", color: "bg-yellow-500" },
  maintenance: { label: "Maintenance", color: "bg-orange-500" },
  reports: { label: "Reports", color: "bg-indigo-500" },
  settings: { label: "Settings", color: "bg-gray-500" },
  communications: { label: "Communications", color: "bg-pink-500" },
  staff: { label: "Staff", color: "bg-teal-500" },
  payments: { label: "Payments", color: "bg-emerald-500" },
  ai: { label: "AI Assistant", color: "bg-violet-500" },
};

function getFeatureCategory(feature: string): string {
  const lower = feature.toLowerCase();
  for (const [key] of Object.entries(FEATURE_CATEGORIES)) {
    if (lower.includes(key)) return key;
  }
  return "other";
}

export default function FeatureAdoptionDashboard() {
  const { campgroundId } = useAuth();
  const [days, setDays] = useState("30");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("usageCount");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const { data: featureStats, isLoading } = useQuery<FeatureStats[]>({
    queryKey: ["analytics-feature-stats", campgroundId, days],
    queryFn: async () => {
      const response = await apiClient.get<FeatureStats[]>(`/analytics/enhanced/reports/features`, {
        params: { campgroundId, days: parseInt(days) },
        schema: FeatureStatsArraySchema,
      });
      return response.data;
    },
    enabled: !!campgroundId,
  });

  // Aggregate stats by feature (combine multiple days)
  const aggregatedStats = featureStats?.reduce((acc, stat) => {
    const key = stat.subFeature ? `${stat.feature}:${stat.subFeature}` : stat.feature;
    const existing = acc.get(key);
    if (existing) {
      existing.usageCount += stat.usageCount;
      existing.uniqueUsers = Math.max(existing.uniqueUsers, stat.uniqueUsers);
      existing.totalSessions = Math.max(existing.totalSessions, stat.totalSessions);
      if (stat.avgDuration) {
        existing.avgDuration = existing.avgDuration
          ? (existing.avgDuration + stat.avgDuration) / 2
          : stat.avgDuration;
      }
      if (stat.successRate !== null) {
        existing.successRate = existing.successRate !== null
          ? (existing.successRate + stat.successRate) / 2
          : stat.successRate;
      }
      if (stat.lastUsedAt && (!existing.lastUsedAt || stat.lastUsedAt > existing.lastUsedAt)) {
        existing.lastUsedAt = stat.lastUsedAt;
      }
    } else {
      acc.set(key, { ...stat });
    }
    return acc;
  }, new Map<string, FeatureStats>());

  const aggregatedList = aggregatedStats ? Array.from(aggregatedStats.values()) : [];

  // Get unique categories
  const categories = [...new Set(aggregatedList.map((s) => getFeatureCategory(s.feature)))];

  // Filter and sort
  const filteredStats = aggregatedList
    .filter((stat) => {
      if (categoryFilter !== "all" && getFeatureCategory(stat.feature) !== categoryFilter) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
    });

  // Summary stats
  const totalUsage = aggregatedList.reduce((sum, s) => sum + s.usageCount, 0);
  const totalUniqueUsers = Math.max(...aggregatedList.map((s) => s.uniqueUsers), 0);
  const avgSuccessRate = aggregatedList.filter((s) => s.successRate !== null).length > 0
    ? aggregatedList.reduce((sum, s) => sum + (s.successRate || 0), 0) /
      aggregatedList.filter((s) => s.successRate !== null).length
    : null;
  const topFeature = aggregatedList.length > 0
    ? aggregatedList.reduce((top, s) => (s.usageCount > (top?.usageCount || 0) ? s : top), aggregatedList[0])
    : null;

  // Find underutilized features (less than 10% of max usage)
  const maxUsage = Math.max(...aggregatedList.map((s) => s.usageCount), 1);
  const underutilized = aggregatedList.filter((s) => s.usageCount < maxUsage * 0.1);

  // Calculate adoption by category
  const categoryStats = categories.map((cat) => {
    const catFeatures = aggregatedList.filter((s) => getFeatureCategory(s.feature) === cat);
    return {
      category: cat,
      totalUsage: catFeatures.reduce((sum, s) => sum + s.usageCount, 0),
      featureCount: catFeatures.length,
      avgSuccessRate: catFeatures.filter((s) => s.successRate !== null).length > 0
        ? catFeatures.reduce((sum, s) => sum + (s.successRate || 0), 0) /
          catFeatures.filter((s) => s.successRate !== null).length
        : null,
    };
  }).sort((a, b) => b.totalUsage - a.totalUsage);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/analytics">
          <Button variant="ghost" size="icon" aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Feature Adoption</h1>
          <p className="text-muted-foreground">
            Track which features are being used and how effectively
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Feature Usage</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsage.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Feature interactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUniqueUsers}</div>
            <p className="text-xs text-muted-foreground">Using features</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            {avgSuccessRate !== null && avgSuccessRate >= 0.9 ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : avgSuccessRate !== null && avgSuccessRate < 0.7 ? (
              <XCircle className="h-4 w-4 text-red-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercent(avgSuccessRate)}</div>
            <p className="text-xs text-muted-foreground">Avg completion rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Top Feature</CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate">
              {topFeature?.feature || "-"}
            </div>
            <p className="text-xs text-muted-foreground">
              {topFeature ? `${topFeature.usageCount.toLocaleString()} uses` : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Usage by Category</CardTitle>
          <CardDescription>Feature adoption across different areas</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {categoryStats.map((cat) => {
                const config = FEATURE_CATEGORIES[cat.category] || { label: cat.category, color: "bg-gray-500" };
                const percentage = totalUsage > 0 ? (cat.totalUsage / totalUsage) * 100 : 0;
                return (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${config.color}`} />
                        <span className="font-medium">{config.label}</span>
                        <Badge variant="outline" className="text-xs">
                          {cat.featureCount} features
                        </Badge>
                      </div>
                      <span className="text-muted-foreground">
                        {cat.totalUsage.toLocaleString()} ({percentage.toFixed(0)}%)
                      </span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-4">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => {
                    const config = FEATURE_CATEGORIES[cat] || { label: cat };
                    return (
                      <SelectItem key={cat} value={cat}>
                        {config.label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Select value={days} onValueChange={setDays}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Feature</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => toggleSort("usageCount")}
                  >
                    <div className="flex items-center gap-1">
                      Usage
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => toggleSort("uniqueUsers")}
                  >
                    <div className="flex items-center gap-1">
                      Users
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => toggleSort("avgDuration")}
                  >
                    <div className="flex items-center gap-1">
                      Avg Time
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => toggleSort("successRate")}
                  >
                    <div className="flex items-center gap-1">
                      Success
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead>Trend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStats.map((stat) => {
                  const category = getFeatureCategory(stat.feature);
                  const config = FEATURE_CATEGORIES[category] || { label: category, color: "bg-gray-500" };
                  const usagePercentOfMax = maxUsage > 0 ? (stat.usageCount / maxUsage) * 100 : 0;

                  return (
                    <TableRow key={stat.feature + (stat.subFeature || "")}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{stat.feature}</p>
                          {stat.subFeature && (
                            <p className="text-sm text-muted-foreground">{stat.subFeature}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          <div className={`w-2 h-2 rounded-full ${config.color} mr-1.5`} />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-secondary rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{ width: `${Math.min(usagePercentOfMax, 100)}%` }}
                            />
                          </div>
                          <span>{stat.usageCount.toLocaleString()}</span>
                        </div>
                      </TableCell>
                      <TableCell>{stat.uniqueUsers}</TableCell>
                      <TableCell>{formatDuration(stat.avgDuration)}</TableCell>
                      <TableCell>
                        {stat.successRate !== null ? (
                          <Badge
                            variant={
                              stat.successRate >= 0.9
                                ? "default"
                                : stat.successRate >= 0.7
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {formatPercent(stat.successRate)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {stat.usageCount > totalUsage / aggregatedList.length * 1.2 ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : stat.usageCount < totalUsage / aggregatedList.length * 0.8 ? (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredStats.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      No feature data found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Underutilized Features Warning */}
      {underutilized.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-800 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Underutilized Features
            </CardTitle>
            <CardDescription className="text-amber-700">
              These features have less than 10% of peak usage - consider training or removal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {underutilized.slice(0, 10).map((stat) => (
                <Badge key={stat.feature} variant="outline" className="text-amber-700">
                  {stat.feature}
                  {stat.subFeature && ` (${stat.subFeature})`}
                  <span className="ml-1 text-amber-500">{stat.usageCount}</span>
                </Badge>
              ))}
              {underutilized.length > 10 && (
                <Badge variant="outline" className="text-amber-700">
                  +{underutilized.length - 10} more
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* High Success Features */}
      {aggregatedList.filter((s) => s.successRate !== null && s.successRate >= 0.95).length > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-800 flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              High-Performing Features
            </CardTitle>
            <CardDescription className="text-green-700">
              These features have 95%+ success rate
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {aggregatedList
                .filter((s) => s.successRate !== null && s.successRate >= 0.95)
                .sort((a, b) => (b.successRate || 0) - (a.successRate || 0))
                .slice(0, 10)
                .map((stat) => (
                  <Badge key={stat.feature} variant="outline" className="text-green-700">
                    {stat.feature}
                    <span className="ml-1 text-green-500">{formatPercent(stat.successRate)}</span>
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
