"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Users,
  Clock,
  Activity,
  Target,
  TrendingUp,
  TrendingDown,
  Calendar,
  CheckSquare,
  AlertTriangle,
  Award,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { z } from "zod";

interface StaffMetrics {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  date: string;
  sessionsCount: number;
  totalSessionMinutes: number;
  pageViews: number;
  actionsCount: number;
  errorsEncountered: number;
  reservationsCreated: number;
  reservationsModified: number;
  checkInsCompleted: number;
  checkOutsCompleted: number;
  paymentsProcessed: number;
  guestsCreated: number;
}

const StaffMetricsSchema = z.object({
  id: z.string(),
  userId: z.string(),
  userName: z.string().nullable(),
  userEmail: z.string().nullable(),
  date: z.string(),
  sessionsCount: z.number(),
  totalSessionMinutes: z.number(),
  pageViews: z.number(),
  actionsCount: z.number(),
  errorsEncountered: z.number(),
  reservationsCreated: z.number(),
  reservationsModified: z.number(),
  checkInsCompleted: z.number(),
  checkOutsCompleted: z.number(),
  paymentsProcessed: z.number(),
  guestsCreated: z.number(),
});
const StaffMetricsArraySchema = z.array(StaffMetricsSchema);

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
}

function getInitials(name: string | null, email: string | null): string {
  if (name) {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return "??";
}

type SortField = "totalSessionMinutes" | "actionsCount" | "reservationsCreated" | "errorsEncountered";
type SortOrder = "asc" | "desc";

export default function StaffEfficiencyDashboard() {
  const { campgroundId } = useAuth();
  const [days, setDays] = useState("30");
  const [sortField, setSortField] = useState<SortField>("actionsCount");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const { data: staffMetrics, isLoading } = useQuery<StaffMetrics[]>({
    queryKey: ["analytics-staff-metrics", campgroundId, days],
    queryFn: async () => {
      const response = await apiClient.get<StaffMetrics[]>(`/analytics/enhanced/reports/staff`, {
        params: { campgroundId, days: parseInt(days) },
        schema: StaffMetricsArraySchema,
      });
      return response.data;
    },
    enabled: !!campgroundId,
  });

  // Aggregate stats by user (combine multiple days)
  const aggregatedStats = staffMetrics?.reduce((acc, stat) => {
    const existing = acc.get(stat.userId);
    if (existing) {
      existing.sessionsCount += stat.sessionsCount;
      existing.totalSessionMinutes += stat.totalSessionMinutes;
      existing.pageViews += stat.pageViews;
      existing.actionsCount += stat.actionsCount;
      existing.errorsEncountered += stat.errorsEncountered;
      existing.reservationsCreated += stat.reservationsCreated;
      existing.reservationsModified += stat.reservationsModified;
      existing.checkInsCompleted += stat.checkInsCompleted;
      existing.checkOutsCompleted += stat.checkOutsCompleted;
      existing.paymentsProcessed += stat.paymentsProcessed;
      existing.guestsCreated += stat.guestsCreated;
    } else {
      acc.set(stat.userId, { ...stat });
    }
    return acc;
  }, new Map<string, StaffMetrics>());

  const aggregatedList = aggregatedStats ? Array.from(aggregatedStats.values()) : [];

  // Sort
  const sortedStats = [...aggregatedList].sort((a, b) => {
    const aVal = a[sortField] ?? 0;
    const bVal = b[sortField] ?? 0;
    return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
  });

  // Summary stats
  const totalStaff = aggregatedList.length;
  const totalActions = aggregatedList.reduce((sum, s) => sum + s.actionsCount, 0);
  const totalTime = aggregatedList.reduce((sum, s) => sum + s.totalSessionMinutes, 0);
  const totalReservations = aggregatedList.reduce((sum, s) => sum + s.reservationsCreated, 0);
  const totalErrors = aggregatedList.reduce((sum, s) => sum + s.errorsEncountered, 0);
  const avgActionsPerStaff = totalStaff > 0 ? totalActions / totalStaff : 0;

  // Calculate efficiency score (actions per error)
  const avgEfficiency = totalErrors > 0 ? totalActions / totalErrors : totalActions;

  // Find top performer
  const topPerformer = aggregatedList.length > 0
    ? aggregatedList.reduce((top, s) => (s.actionsCount > (top?.actionsCount || 0) ? s : top), aggregatedList[0])
    : null;

  // Find staff needing support (high error rate)
  const needsSupport = aggregatedList.filter((s) => {
    if (s.actionsCount < 10) return false;
    const errorRate = s.errorsEncountered / s.actionsCount;
    return errorRate > 0.1; // More than 10% error rate
  });

  // Calculate productivity scores
  const maxActions = Math.max(...aggregatedList.map((s) => s.actionsCount), 1);

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
          <h1 className="text-2xl font-bold tracking-tight">Staff Efficiency</h1>
          <p className="text-muted-foreground">
            Monitor staff productivity and identify training opportunities
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Staff</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStaff}</div>
            <p className="text-xs text-muted-foreground">Last {days} days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(totalTime)}</div>
            <p className="text-xs text-muted-foreground">Combined active time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Actions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalActions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {avgActionsPerStaff.toFixed(0)} avg per staff
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Reservations</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReservations}</div>
            <p className="text-xs text-muted-foreground">Created by staff</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${totalErrors > totalActions * 0.05 ? "text-red-500" : "text-green-500"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalActions > 0 ? ((totalErrors / totalActions) * 100).toFixed(1) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">{totalErrors} total errors</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Performer Card */}
      {topPerformer && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-yellow-800 flex items-center gap-2">
              <Award className="h-5 w-5" />
              Top Performer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-yellow-200 text-yellow-800">
                  {getInitials(topPerformer.userName, topPerformer.userEmail)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-semibold text-yellow-900">
                  {topPerformer.userName || topPerformer.userEmail || "Unknown"}
                </p>
                <div className="flex gap-4 mt-1 text-sm text-yellow-700">
                  <span>{topPerformer.actionsCount.toLocaleString()} actions</span>
                  <span>{topPerformer.reservationsCreated} reservations</span>
                  <span>{topPerformer.checkInsCompleted} check-ins</span>
                  <span>{formatDuration(topPerformer.totalSessionMinutes)} active</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-4">
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

      {/* Staff Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Staff Member</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => toggleSort("totalSessionMinutes")}
                  >
                    <div className="flex items-center gap-1">
                      Time Active
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => toggleSort("actionsCount")}
                  >
                    <div className="flex items-center gap-1">
                      Actions
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => toggleSort("reservationsCreated")}
                  >
                    <div className="flex items-center gap-1">
                      Reservations
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead>Check-ins</TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => toggleSort("errorsEncountered")}
                  >
                    <div className="flex items-center gap-1">
                      Errors
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead>Productivity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedStats.map((stat) => {
                  const productivity = maxActions > 0 ? (stat.actionsCount / maxActions) * 100 : 0;
                  const errorRate = stat.actionsCount > 0 ? stat.errorsEncountered / stat.actionsCount : 0;

                  return (
                    <TableRow key={stat.userId}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {getInitials(stat.userName, stat.userEmail)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium truncate max-w-[150px]">
                              {stat.userName || "Unknown"}
                            </p>
                            {stat.userEmail && (
                              <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                                {stat.userEmail}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{stat.sessionsCount}</TableCell>
                      <TableCell>{formatDuration(stat.totalSessionMinutes)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {stat.actionsCount.toLocaleString()}
                          {stat.actionsCount > avgActionsPerStaff * 1.5 && (
                            <TrendingUp className="h-3 w-3 text-green-500" />
                          )}
                          {stat.actionsCount < avgActionsPerStaff * 0.5 && (
                            <TrendingDown className="h-3 w-3 text-red-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{stat.reservationsCreated}</span>
                          {stat.reservationsModified > 0 && (
                            <Badge variant="outline" className="text-xs">
                              +{stat.reservationsModified} mod
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CheckSquare className="h-4 w-4 text-green-500" />
                          {stat.checkInsCompleted}
                          <span className="text-muted-foreground">/</span>
                          {stat.checkOutsCompleted}
                        </div>
                      </TableCell>
                      <TableCell>
                        {stat.errorsEncountered > 0 ? (
                          <Badge variant={errorRate > 0.1 ? "destructive" : "secondary"}>
                            {stat.errorsEncountered}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <Progress value={productivity} className="h-2 flex-1" />
                          <span className="text-xs text-muted-foreground w-8">
                            {productivity.toFixed(0)}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {sortedStats.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      No staff metrics found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Staff Needing Support */}
      {needsSupport.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Staff Needing Support
            </CardTitle>
            <CardDescription className="text-red-700">
              These staff members have error rates above 10% - consider additional training
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {needsSupport.map((stat) => {
                const errorRate = stat.actionsCount > 0 ? (stat.errorsEncountered / stat.actionsCount) * 100 : 0;
                return (
                  <div key={stat.userId} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-red-200 text-red-800">
                          {getInitials(stat.userName, stat.userEmail)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-red-800">
                        {stat.userName || stat.userEmail || "Unknown"}
                      </span>
                    </div>
                    <Badge variant="destructive">
                      {errorRate.toFixed(1)}% error rate ({stat.errorsEncountered} errors)
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Reservations Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="font-medium">{totalReservations}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Modified</span>
                <span className="font-medium">
                  {aggregatedList.reduce((sum, s) => sum + s.reservationsModified, 0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Front Desk Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Check-ins</span>
                <span className="font-medium">
                  {aggregatedList.reduce((sum, s) => sum + s.checkInsCompleted, 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Check-outs</span>
                <span className="font-medium">
                  {aggregatedList.reduce((sum, s) => sum + s.checkOutsCompleted, 0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Other Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payments</span>
                <span className="font-medium">
                  {aggregatedList.reduce((sum, s) => sum + s.paymentsProcessed, 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Guests Created</span>
                <span className="font-medium">
                  {aggregatedList.reduce((sum, s) => sum + s.guestsCreated, 0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
