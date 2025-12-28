"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiClient } from "@/lib/api-client";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  TrendingUp,
  DollarSign,
  ArrowLeft,
  Sparkles,
  Target,
  BarChart3,
  AlertCircle,
  ChevronRight,
  Lightbulb,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  XCircle,
  Play
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

const SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 300,
  damping: 25,
};

type RevenueInsight = {
  id: string;
  insightType: "revenue_gap" | "underutilized_site" | "missed_upsell" | "pricing_opportunity";
  title: string;
  summary: string;
  impactCents: number;
  difficulty: "easy" | "medium" | "hard";
  recommendations: Array<{
    action: string;
    detail: string;
  }>;
  status: "new" | "in_progress" | "completed" | "dismissed";
  createdAt: string;
};

function getInsightIcon(type: string) {
  switch (type) {
    case "revenue_gap":
      return TrendingUp;
    case "underutilized_site":
      return BarChart3;
    case "missed_upsell":
      return Lightbulb;
    case "pricing_opportunity":
      return DollarSign;
    default:
      return Target;
  }
}

function getInsightColor(type: string) {
  switch (type) {
    case "revenue_gap":
      return "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30";
    case "underutilized_site":
      return "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30";
    case "missed_upsell":
      return "text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/30";
    case "pricing_opportunity":
      return "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30";
    default:
      return "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30";
  }
}

function getDifficultyBadge(difficulty: string) {
  switch (difficulty) {
    case "easy":
      return <Badge className="bg-emerald-500">Easy Win</Badge>;
    case "medium":
      return <Badge className="bg-amber-500">Medium Effort</Badge>;
    case "hard":
      return <Badge className="bg-red-500">Significant Effort</Badge>;
    default:
      return <Badge variant="secondary">{difficulty}</Badge>;
  }
}

export default function AIRevenuePage() {
  const [filter, setFilter] = useState<"all" | "new" | "in_progress" | "completed">("new");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get campground
  const { data: campgrounds = [] } = useQuery({
    queryKey: ["campgrounds"],
    queryFn: () => apiClient.getCampgrounds(),
  });
  const campground = campgrounds[0];

  // Get revenue insights
  const { data: insights = [], isLoading, refetch } = useQuery({
    queryKey: ["revenue-insights", campground?.id],
    queryFn: () => apiClient.getRevenueInsights(campground!.id),
    enabled: !!campground?.id,
  });

  // Start working on insight
  const startMutation = useMutation({
    mutationFn: (insightId: string) =>
      apiClient.startRevenueInsight(campground!.id, insightId),
    onSuccess: () => {
      toast({ title: "Started", description: "Insight marked as in progress." });
      refetch();
    },
    onError: (error: any) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  // Complete insight
  const completeMutation = useMutation({
    mutationFn: (insightId: string) =>
      apiClient.completeRevenueInsight(campground!.id, insightId),
    onSuccess: () => {
      toast({ title: "Completed", description: "Insight marked as completed." });
      refetch();
    },
    onError: (error: any) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  const filteredInsights = (insights as RevenueInsight[]).filter(i =>
    filter === "all" ? true : i.status === filter
  );

  const totalOpportunity = (insights as RevenueInsight[])
    .filter(i => i.status !== "completed" && i.status !== "dismissed")
    .reduce((acc, i) => acc + i.impactCents, 0);

  const newCount = (insights as RevenueInsight[]).filter(i => i.status === "new").length;
  const easyWins = (insights as RevenueInsight[]).filter(i => i.difficulty === "easy" && i.status === "new");

  if (!campground) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h2 className="text-2xl font-bold text-foreground mb-2">No Campground Selected</h2>
            <p className="text-muted-foreground">Select a campground to view revenue insights</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6 pb-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_CONFIG}
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <Link href="/ai">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">AI Revenue Manager</h1>
              <p className="text-sm text-muted-foreground">
                Find and capture revenue opportunities
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Analyze Now
          </Button>
        </motion.div>

        {/* Revenue Opportunity Banner */}
        {totalOpportunity > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_CONFIG, delay: 0.05 }}
          >
            <Card className="border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Estimated Revenue Opportunity</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                        ${(totalOpportunity / 100).toLocaleString()}
                      </span>
                      <span className="text-sm text-muted-foreground">/month</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Based on {newCount} actionable insights
                    </p>
                  </div>
                  {easyWins.length > 0 && (
                    <div className="p-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Lightbulb className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="font-medium text-emerald-800 dark:text-emerald-300">
                          {easyWins.length} Easy Wins Available
                        </span>
                      </div>
                      <p className="text-sm text-emerald-700 dark:text-emerald-400">
                        Quick actions worth ${(easyWins.reduce((a, i) => a + i.impactCents, 0) / 100).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_CONFIG, delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Target className="h-5 w-5 text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-foreground">{newCount}</div>
              <p className="text-xs text-muted-foreground">New Insights</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Play className="h-5 w-5 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-foreground">
                {(insights as RevenueInsight[]).filter(i => i.status === "in_progress").length}
              </div>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-foreground">
                {(insights as RevenueInsight[]).filter(i => i.status === "completed").length}
              </div>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Lightbulb className="h-5 w-5 text-violet-500" />
              </div>
              <div className="text-2xl font-bold text-foreground">{easyWins.length}</div>
              <p className="text-xs text-muted-foreground">Easy Wins</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {(["new", "in_progress", "completed", "all"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f.replace("_", " ")}
              {f === "new" && newCount > 0 && (
                <Badge variant="secondary" className="ml-2 bg-white/20">
                  {newCount}
                </Badge>
              )}
            </Button>
          ))}
        </div>

        {/* Insights List */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_CONFIG, delay: 0.15 }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredInsights.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No Insights Found</h3>
                  <p className="text-sm text-muted-foreground">
                    {filter === "new"
                      ? "Great job! All insights have been addressed."
                      : `No ${filter.replace("_", " ")} insights.`}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {filteredInsights.map((insight, index) => {
                  const Icon = getInsightIcon(insight.insightType);
                  const colorClass = getInsightColor(insight.insightType);

                  return (
                    <motion.div
                      key={insight.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ delay: index * 0.02, ...SPRING_CONFIG }}
                    >
                      <Card className={cn(
                        "transition-all hover:shadow-md",
                        insight.status === "new" && "border-l-4 border-l-blue-500"
                      )}>
                        <CardContent className="p-5">
                          <div className="flex flex-col lg:flex-row gap-4">
                            <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl flex-shrink-0", colorClass)}>
                              <Icon className="h-6 w-6" />
                            </div>

                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <h3 className="font-semibold text-foreground">{insight.title}</h3>
                                {getDifficultyBadge(insight.difficulty)}
                                {insight.status !== "new" && (
                                  <Badge variant="secondary" className="capitalize">
                                    {insight.status.replace("_", " ")}
                                  </Badge>
                                )}
                              </div>

                              <p className="text-sm text-muted-foreground mb-4">{insight.summary}</p>

                              {insight.recommendations.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Recommended Actions
                                  </p>
                                  {insight.recommendations.slice(0, 3).map((rec, i) => (
                                    <div key={i} className="flex items-start gap-2 text-sm">
                                      <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                      <div>
                                        <span className="font-medium text-foreground">{rec.action}</span>
                                        {rec.detail && (
                                          <span className="text-muted-foreground"> - {rec.detail}</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col items-end gap-3 lg:flex-shrink-0">
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">Potential Impact</p>
                                <div className="flex items-center gap-1">
                                  <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                                  <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                                    ${(insight.impactCents / 100).toLocaleString()}
                                  </span>
                                  <span className="text-xs text-muted-foreground">/mo</span>
                                </div>
                              </div>

                              {insight.status === "new" && (
                                <Button
                                  size="sm"
                                  onClick={() => startMutation.mutate(insight.id)}
                                  disabled={startMutation.isPending}
                                  className="gap-1"
                                >
                                  <Play className="h-4 w-4" />
                                  Start
                                </Button>
                              )}

                              {insight.status === "in_progress" && (
                                <Button
                                  size="sm"
                                  onClick={() => completeMutation.mutate(insight.id)}
                                  disabled={completeMutation.isPending}
                                  className="gap-1 bg-emerald-600 hover:bg-emerald-700"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                  Complete
                                </Button>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(insight.createdAt), { addSuffix: true })}
                            </div>
                            <Badge variant="outline" className="text-xs capitalize">
                              {insight.insightType.replace("_", " ")}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </div>
    </DashboardShell>
  );
}
