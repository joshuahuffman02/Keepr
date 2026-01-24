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
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Target,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Filter,
  Clock,
  Users,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { z } from "zod";

interface FunnelStats {
  funnelName: string;
  totalStarted: number;
  step1: number;
  step2: number;
  step3: number;
  step4: number;
  step5: number;
  step6: number;
  completed: number;
  abandoned: number;
  avgCompletionTimeSecs: number | null;
  conversionRate: number;
  dropOffStep: string | null;
  dropOffRate: number | null;
}

const FunnelStatsSchema = z.object({
  funnelName: z.string(),
  totalStarted: z.number(),
  step1: z.number(),
  step2: z.number(),
  step3: z.number(),
  step4: z.number(),
  step5: z.number(),
  step6: z.number(),
  completed: z.number(),
  abandoned: z.number(),
  avgCompletionTimeSecs: z.number().nullable(),
  conversionRate: z.number(),
  dropOffStep: z.string().nullable(),
  dropOffRate: z.number().nullable(),
});
const FunnelStatsArraySchema = z.array(FunnelStatsSchema);

interface FunnelDetail {
  id: string;
  funnelName: string;
  sessionId: string;
  step1At: string | null;
  step2At: string | null;
  step3At: string | null;
  step4At: string | null;
  step5At: string | null;
  step6At: string | null;
  completedAt: string | null;
  abandonedAt: string | null;
  abandonedStep: number | null;
  totalTimeSecs: number | null;
  metadata: Record<string, unknown>;
}

const FUNNEL_CONFIGS: Record<string, { name: string; steps: string[]; description: string }> = {
  booking: {
    name: "Booking Funnel",
    steps: ["Search", "Select Site", "Choose Dates", "Guest Info", "Payment", "Confirmation"],
    description: "Guest journey from search to completed booking",
  },
  check_in: {
    name: "Check-In Flow",
    steps: ["Find Reservation", "Verify Guest", "Collect Payment", "Assign Site", "Complete"],
    description: "Staff check-in process",
  },
  reservation_create: {
    name: "Staff Reservation",
    steps: ["Start", "Select Site", "Enter Guest", "Add Services", "Payment", "Confirm"],
    description: "Staff creating a new reservation",
  },
  pos_sale: {
    name: "POS Sale",
    steps: ["Add Items", "Apply Discounts", "Select Payment", "Process", "Complete"],
    description: "Point of sale transaction flow",
  },
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "-";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default function FunnelAnalysisDashboard() {
  const { campgroundId } = useAuth();
  const [days, setDays] = useState("30");
  const [selectedFunnel, setSelectedFunnel] = useState("booking");

  const { data: funnelStats, isLoading } = useQuery<FunnelStats[]>({
    queryKey: ["analytics-funnel-stats", campgroundId, days],
    queryFn: async () => {
      const response = await apiClient.get<FunnelStats[]>(`/analytics/enhanced/reports/funnel`, {
        params: { campgroundId, days: parseInt(days) },
        schema: FunnelStatsArraySchema,
      });
      return response.data;
    },
    enabled: !!campgroundId,
  });

  // Get the selected funnel data
  const currentFunnel = funnelStats?.find((f) => f.funnelName === selectedFunnel);
  const funnelConfig = FUNNEL_CONFIGS[selectedFunnel] || {
    name: selectedFunnel,
    steps: ["Step 1", "Step 2", "Step 3", "Step 4", "Step 5", "Step 6"],
    description: "",
  };

  // Calculate step data for visualization
  const stepData = currentFunnel
    ? [
        { name: funnelConfig.steps[0] || "Step 1", count: currentFunnel.step1, dropOff: 0 },
        {
          name: funnelConfig.steps[1] || "Step 2",
          count: currentFunnel.step2,
          dropOff: currentFunnel.step1 - currentFunnel.step2,
        },
        {
          name: funnelConfig.steps[2] || "Step 3",
          count: currentFunnel.step3,
          dropOff: currentFunnel.step2 - currentFunnel.step3,
        },
        {
          name: funnelConfig.steps[3] || "Step 4",
          count: currentFunnel.step4,
          dropOff: currentFunnel.step3 - currentFunnel.step4,
        },
        {
          name: funnelConfig.steps[4] || "Step 5",
          count: currentFunnel.step5,
          dropOff: currentFunnel.step4 - currentFunnel.step5,
        },
        {
          name: funnelConfig.steps[5] || "Step 6",
          count: currentFunnel.step6,
          dropOff: currentFunnel.step5 - currentFunnel.step6,
        },
      ].filter((step) => step.count > 0 || step.dropOff > 0)
    : [];

  // Find biggest drop-off
  const biggestDropOff =
    stepData.length > 0
      ? stepData.reduce(
          (max, step, idx) => {
            if (idx === 0) return max;
            const dropOffRate =
              stepData[idx - 1].count > 0 ? step.dropOff / stepData[idx - 1].count : 0;
            return dropOffRate > (max.rate || 0)
              ? { step: step.name, rate: dropOffRate, count: step.dropOff }
              : max;
          },
          { step: "", rate: 0, count: 0 },
        )
      : null;

  // Summary stats
  const totalFunnels = funnelStats?.reduce((sum, f) => sum + f.totalStarted, 0) || 0;
  const totalCompleted = funnelStats?.reduce((sum, f) => sum + f.completed, 0) || 0;
  const overallConversion = totalFunnels > 0 ? totalCompleted / totalFunnels : 0;
  const avgCompletionTime =
    funnelStats?.filter((f) => f.avgCompletionTimeSecs).length || 0 > 0
      ? funnelStats!.reduce((sum, f) => sum + (f.avgCompletionTimeSecs || 0), 0) /
        funnelStats!.filter((f) => f.avgCompletionTimeSecs).length
      : null;

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
          <h1 className="text-2xl font-bold tracking-tight">Funnel Analysis</h1>
          <p className="text-muted-foreground">
            Track conversion funnels and identify drop-off points
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Funnels</CardTitle>
            <Filter className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalFunnels.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Started in {days} days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCompleted.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {totalFunnels > 0
                ? `${((totalCompleted / totalFunnels) * 100).toFixed(1)}% completion`
                : "-"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercent(overallConversion)}</div>
            <p className="text-xs text-muted-foreground">Overall average</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Completion Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(avgCompletionTime)}</div>
            <p className="text-xs text-muted-foreground">Time to complete</p>
          </CardContent>
        </Card>
      </div>

      {/* Funnel Selector and Time Range */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-4">
              <Select value={selectedFunnel} onValueChange={setSelectedFunnel}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Select funnel" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FUNNEL_CONFIGS).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.name}
                    </SelectItem>
                  ))}
                  {funnelStats
                    ?.filter((f) => !FUNNEL_CONFIGS[f.funnelName])
                    .map((f) => (
                      <SelectItem key={f.funnelName} value={f.funnelName}>
                        {f.funnelName}
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
          </div>
        </CardContent>
      </Card>

      {/* Funnel Visualization */}
      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : currentFunnel ? (
        <Card>
          <CardHeader>
            <CardTitle>{funnelConfig.name}</CardTitle>
            <CardDescription>{funnelConfig.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Starting count */}
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Started</span>
                    <span className="text-lg font-bold">{currentFunnel.totalStarted}</span>
                  </div>
                  <Progress value={100} className="h-3" />
                </div>
              </div>

              {/* Funnel Steps */}
              {stepData.map((step, idx) => {
                const previousCount =
                  idx === 0 ? currentFunnel.totalStarted : stepData[idx - 1].count;
                const percentage = previousCount > 0 ? (step.count / previousCount) * 100 : 0;
                const overallPercentage =
                  currentFunnel.totalStarted > 0
                    ? (step.count / currentFunnel.totalStarted) * 100
                    : 0;
                const dropOffPercentage =
                  previousCount > 0 ? (step.dropOff / previousCount) * 100 : 0;

                return (
                  <div key={step.name} className="relative">
                    {/* Drop-off indicator */}
                    {idx > 0 && step.dropOff > 0 && (
                      <div className="absolute -top-2 right-4 flex items-center gap-1 text-xs text-red-500">
                        <ChevronDown className="h-3 w-3" />
                        <span>
                          {step.dropOff} ({dropOffPercentage.toFixed(1)}% drop)
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-4 p-4 border rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{step.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold">{step.count}</span>
                            <Badge
                              variant={
                                percentage >= 80
                                  ? "default"
                                  : percentage >= 50
                                    ? "secondary"
                                    : "destructive"
                              }
                            >
                              {percentage.toFixed(0)}%
                            </Badge>
                          </div>
                        </div>
                        <Progress value={overallPercentage} className="h-2" />
                        <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                          <span>{overallPercentage.toFixed(1)}% of total</span>
                          <span>Step conversion: {percentage.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Completion */}
              <div className="flex items-center gap-4 p-4 bg-green-50 border-green-200 border rounded-lg">
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-green-800">Completed</span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-green-800">
                        {currentFunnel.completed}
                      </span>
                      <Badge className="bg-green-500">
                        {currentFunnel.conversionRate
                          ? `${(currentFunnel.conversionRate * 100).toFixed(1)}%`
                          : "0%"}
                      </Badge>
                    </div>
                  </div>
                  <Progress
                    value={currentFunnel.conversionRate ? currentFunnel.conversionRate * 100 : 0}
                    className="h-2 bg-green-200"
                  />
                </div>
              </div>

              {/* Abandoned */}
              {currentFunnel.abandoned > 0 && (
                <div className="flex items-center gap-4 p-4 bg-red-50 border-red-200 border rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
                    <XCircle className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-red-800">Abandoned</span>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-red-800">
                          {currentFunnel.abandoned}
                        </span>
                        <Badge variant="destructive">
                          {currentFunnel.totalStarted > 0
                            ? `${((currentFunnel.abandoned / currentFunnel.totalStarted) * 100).toFixed(1)}%`
                            : "0%"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No data for this funnel in the selected time period
          </CardContent>
        </Card>
      )}

      {/* Biggest Drop-off Alert */}
      {biggestDropOff && biggestDropOff.rate > 0.3 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-800 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              High Drop-off Detected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-amber-700">
              <strong>{formatPercent(biggestDropOff.rate)}</strong> of users ({biggestDropOff.count}
              ) are dropping off at the <strong>{biggestDropOff.step}</strong> step. Consider:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-amber-700 list-disc list-inside">
              <li>Simplifying this step</li>
              <li>Adding clearer instructions</li>
              <li>Reducing required fields</li>
              <li>Improving error messages</li>
            </ul>
          </CardContent>
        </Card>
      )}

      {/* All Funnels Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Funnels Summary</CardTitle>
          <CardDescription>Compare performance across different funnels</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funnel</TableHead>
                  <TableHead className="text-right">Started</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  <TableHead className="text-right">Conversion</TableHead>
                  <TableHead className="text-right">Avg Time</TableHead>
                  <TableHead>Drop-off Point</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {funnelStats?.map((funnel) => {
                  const config = FUNNEL_CONFIGS[funnel.funnelName];
                  return (
                    <TableRow
                      key={funnel.funnelName}
                      className={
                        selectedFunnel === funnel.funnelName
                          ? "bg-muted/50"
                          : "cursor-pointer hover:bg-muted/30"
                      }
                      onClick={() => setSelectedFunnel(funnel.funnelName)}
                    >
                      <TableCell className="font-medium">
                        {config?.name || funnel.funnelName}
                      </TableCell>
                      <TableCell className="text-right">{funnel.totalStarted}</TableCell>
                      <TableCell className="text-right">{funnel.completed}</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={
                            funnel.conversionRate >= 0.5
                              ? "default"
                              : funnel.conversionRate >= 0.25
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {formatPercent(funnel.conversionRate)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatDuration(funnel.avgCompletionTimeSecs)}
                      </TableCell>
                      <TableCell>
                        {funnel.dropOffStep && funnel.dropOffRate && funnel.dropOffRate > 0.2 ? (
                          <div className="flex items-center gap-1 text-red-600">
                            <AlertTriangle className="h-3 w-3" />
                            <span className="text-xs">
                              {funnel.dropOffStep} ({formatPercent(funnel.dropOffRate)})
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(!funnelStats || funnelStats.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No funnel data found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
