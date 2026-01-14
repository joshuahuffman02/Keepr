"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
  Eye,
  Clock,
  Users,
  TrendingUp,
  TrendingDown,
  Search,
  Download,
} from "lucide-react";
import Link from "next/link";
import { z } from "zod";

interface PageStats {
  id: string;
  path: string;
  pageTitle: string | null;
  featureArea: string | null;
  views: number;
  uniqueUsers: number;
  uniqueSessions: number;
  avgTimeOnPage: number | null;
  avgScrollDepth: number | null;
  bounceRate: number | null;
  actions: number;
  searches: number;
  errors: number;
  formSubmits: number;
  date: string;
}

const PageStatsSchema = z.object({
  id: z.string(),
  path: z.string(),
  pageTitle: z.string().nullable(),
  featureArea: z.string().nullable(),
  views: z.number(),
  uniqueUsers: z.number(),
  uniqueSessions: z.number(),
  avgTimeOnPage: z.number().nullable(),
  avgScrollDepth: z.number().nullable(),
  bounceRate: z.number().nullable(),
  actions: z.number(),
  searches: z.number(),
  errors: z.number(),
  formSubmits: z.number(),
  date: z.string(),
});
const PageStatsArraySchema = z.array(PageStatsSchema);

function formatDuration(seconds: number | null): string {
  if (!seconds) return "-";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

function formatPercent(value: number | null): string {
  if (value === null) return "-";
  return `${(value * 100).toFixed(0)}%`;
}

type SortField = "views" | "uniqueUsers" | "avgTimeOnPage" | "actions" | "errors";
type SortOrder = "asc" | "desc";

export default function PageUsageReport() {
  const { campgroundId } = useAuth();
  const [days, setDays] = useState("30");
  const [searchQuery, setSearchQuery] = useState("");
  const [featureFilter, setFeatureFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("views");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const { data: pageStats, isLoading } = useQuery<PageStats[]>({
    queryKey: ["analytics-page-stats", campgroundId, days],
    queryFn: async () => {
      const response = await apiClient.get<PageStats[]>(`/analytics/enhanced/reports/pages`, {
        params: { campgroundId, days: parseInt(days) },
        schema: PageStatsArraySchema,
      });
      return response.data;
    },
    enabled: !!campgroundId,
  });

  // Aggregate stats by path (combine multiple days)
  const aggregatedStats = pageStats?.reduce((acc, stat) => {
    const existing = acc.get(stat.path);
    if (existing) {
      existing.views += stat.views;
      existing.uniqueUsers = Math.max(existing.uniqueUsers, stat.uniqueUsers);
      existing.uniqueSessions = Math.max(existing.uniqueSessions, stat.uniqueSessions);
      if (stat.avgTimeOnPage) {
        existing.avgTimeOnPage = existing.avgTimeOnPage
          ? (existing.avgTimeOnPage + stat.avgTimeOnPage) / 2
          : stat.avgTimeOnPage;
      }
      if (stat.avgScrollDepth) {
        existing.avgScrollDepth = existing.avgScrollDepth
          ? (existing.avgScrollDepth + stat.avgScrollDepth) / 2
          : stat.avgScrollDepth;
      }
      existing.actions += stat.actions;
      existing.searches += stat.searches;
      existing.errors += stat.errors;
      existing.formSubmits += stat.formSubmits;
    } else {
      acc.set(stat.path, { ...stat });
    }
    return acc;
  }, new Map<string, PageStats>());

  const aggregatedList = aggregatedStats ? Array.from(aggregatedStats.values()) : [];

  // Get unique feature areas for filter
  const featureAreas = [...new Set(aggregatedList.map((s) => s.featureArea).filter(Boolean))];

  // Filter and sort
  const filteredStats = aggregatedList
    .filter((stat) => {
      if (searchQuery && !stat.path.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (featureFilter !== "all" && stat.featureArea !== featureFilter) {
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
  const totalViews = aggregatedList.reduce((sum, s) => sum + s.views, 0);
  const totalUsers = Math.max(...aggregatedList.map((s) => s.uniqueUsers), 0);
  const avgTimeAll = aggregatedList.filter((s) => s.avgTimeOnPage).length > 0
    ? aggregatedList.reduce((sum, s) => sum + (s.avgTimeOnPage || 0), 0) /
      aggregatedList.filter((s) => s.avgTimeOnPage).length
    : 0;
  const totalErrors = aggregatedList.reduce((sum, s) => sum + s.errors, 0);

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
          <h1 className="text-2xl font-bold tracking-tight">Page Usage Report</h1>
          <p className="text-muted-foreground">
            Detailed analytics for every admin page
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Page Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalViews.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Last {days} days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
            <p className="text-xs text-muted-foreground">Active staff</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Time on Page</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(avgTimeAll)}</div>
            <p className="text-xs text-muted-foreground">Across all pages</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
            <Badge variant={totalErrors > 0 ? "destructive" : "secondary"}>
              {totalErrors}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalErrors}</div>
            <p className="text-xs text-muted-foreground">Error events</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search pages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={featureFilter} onValueChange={setFeatureFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Feature area" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Areas</SelectItem>
                  {featureAreas.map((area) => (
                    <SelectItem key={area} value={area || ""}>
                      {area?.replace(/_/g, " ") || "Unknown"}
                    </SelectItem>
                  ))}
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
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
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
                  <TableHead className="w-[300px]">Page</TableHead>
                  <TableHead>Feature</TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => toggleSort("views")}
                  >
                    <div className="flex items-center gap-1">
                      Views
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
                    onClick={() => toggleSort("avgTimeOnPage")}
                  >
                    <div className="flex items-center gap-1">
                      Avg Time
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => toggleSort("actions")}
                  >
                    <div className="flex items-center gap-1">
                      Actions
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => toggleSort("errors")}
                  >
                    <div className="flex items-center gap-1">
                      Errors
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStats.map((stat) => (
                  <TableRow key={stat.path}>
                    <TableCell>
                      <div>
                        <p className="font-medium truncate max-w-[280px]">{stat.path}</p>
                        {stat.pageTitle && (
                          <p className="text-sm text-muted-foreground truncate max-w-[280px]">
                            {stat.pageTitle}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {stat.featureArea && (
                        <Badge variant="outline" className="capitalize">
                          {stat.featureArea.replace(/_/g, " ")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {stat.views.toLocaleString()}
                        {stat.views > totalViews / aggregatedList.length * 1.5 && (
                          <TrendingUp className="h-3 w-3 text-green-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{stat.uniqueUsers}</TableCell>
                    <TableCell>{formatDuration(stat.avgTimeOnPage)}</TableCell>
                    <TableCell>{stat.actions}</TableCell>
                    <TableCell>
                      {stat.errors > 0 ? (
                        <Badge variant="destructive">{stat.errors}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredStats.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      No page data found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dead Pages Warning */}
      {filteredStats.filter((s) => s.views < 5).length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-800">Low-Traffic Pages</CardTitle>
            <CardDescription className="text-amber-700">
              These pages have fewer than 5 views in the selected period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {filteredStats
                .filter((s) => s.views < 5)
                .slice(0, 10)
                .map((stat) => (
                  <Badge key={stat.path} variant="outline" className="text-amber-700">
                    {stat.path}
                  </Badge>
                ))}
              {filteredStats.filter((s) => s.views < 5).length > 10 && (
                <Badge variant="outline" className="text-amber-700">
                  +{filteredStats.filter((s) => s.views < 5).length - 10} more
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
