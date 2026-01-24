"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, type Transition } from "framer-motion";
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
  Play,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

type Campground = Awaited<ReturnType<typeof apiClient.getCampgrounds>>[number];
type RevenueInsight = Awaited<ReturnType<typeof apiClient.getRevenueInsights>>[number] & {
  createdAt?: string | null;
};
type InsightStatusFilter = "all" | "new" | "in_progress" | "completed";

const FILTER_OPTIONS: InsightStatusFilter[] = ["new", "in_progress", "completed", "all"];

const SPRING_CONFIG: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 25,
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error && error.message ? error.message : "Something went wrong";

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
      return "text-status-error-text bg-status-error-bg border border-status-error-border";
    case "underutilized_site":
      return "text-status-warning-text bg-status-warning-bg border border-status-warning-border";
    case "missed_upsell":
      return "text-status-info-text bg-status-info-bg border border-status-info-border";
    case "pricing_opportunity":
      return "text-status-success-text bg-status-success-bg border border-status-success-border";
    default:
      return "text-status-info-text bg-status-info-bg border border-status-info-border";
  }
}

function getDifficultyBadge(difficulty: string) {
  switch (difficulty) {
    case "easy":
      return <Badge className="bg-status-success text-status-success-foreground">Easy Win</Badge>;
    case "medium":
      return (
        <Badge className="bg-status-warning text-status-warning-foreground">Medium Effort</Badge>
      );
    case "hard":
      return (
        <Badge className="bg-status-error text-status-error-foreground">Significant Effort</Badge>
      );
    default:
      return <Badge variant="secondary">{difficulty}</Badge>;
  }
}

export default function AIRevenuePage() {
  const [filter, setFilter] = useState<InsightStatusFilter>("new");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get campground
  const { data: campgrounds = [] } = useQuery<Campground[]>({
    queryKey: ["campgrounds"],
    queryFn: () => apiClient.getCampgrounds(),
  });
  const campground = campgrounds[0];
  const campgroundId = campground?.id;
  const requireCampgroundId = () => {
    if (!campgroundId) {
      throw new Error("Campground is required");
    }
    return campgroundId;
  };

  // Get revenue insights
  const {
    data: insights = [],
    isLoading,
    refetch,
  } = useQuery<RevenueInsight[]>({
    queryKey: ["revenue-insights", campgroundId],
    queryFn: () => apiClient.getRevenueInsights(requireCampgroundId()),
    enabled: !!campgroundId,
  });

  // Start working on insight
  const startMutation = useMutation({
    mutationFn: (insightId: string) => apiClient.startRevenueInsight(insightId),
    onSuccess: () => {
      toast({ title: "Started", description: "Insight marked as in progress." });
      refetch();
    },
    onError: (error) => {
      toast({ title: "Failed", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  // Complete insight
  const completeMutation = useMutation({
    mutationFn: (insightId: string) => apiClient.completeRevenueInsight(insightId),
    onSuccess: () => {
      toast({ title: "Completed", description: "Insight marked as completed." });
      refetch();
    },
    onError: (error) => {
      toast({ title: "Failed", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const filteredInsights = insights.filter((i) => (filter === "all" ? true : i.status === filter));

  const totalOpportunity = insights
    .filter((i) => i.status !== "completed" && i.status !== "dismissed")
    .reduce((acc, i) => acc + i.impactCents, 0);

  const newCount = insights.filter((i) => i.status === "new").length;
  const easyWins = insights.filter((i) => i.difficulty === "easy" && i.status === "new");

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
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-status-info-bg text-status-info-text border border-status-info-border shadow-sm">
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
            <Card className="border-status-info-border bg-status-info-bg">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Estimated Revenue Opportunity
                    </p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-status-info-text">
                        ${(totalOpportunity / 100).toLocaleString()}
                      </span>
                      <span className="text-sm text-muted-foreground">/month</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Based on {newCount} actionable insights
                    </p>
                  </div>
                  {easyWins.length > 0 && (
                    <div className="p-4 bg-status-success-bg border border-status-success-border rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Lightbulb className="h-4 w-4 text-status-success-text" />
                        <span className="font-medium text-status-success-text">
                          {easyWins.length} Easy Wins Available
                        </span>
                      </div>
                      <p className="text-sm text-status-success-text">
                        Quick actions worth $
                        {(easyWins.reduce((a, i) => a + i.impactCents, 0) / 100).toLocaleString()}
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
                <Target className="h-5 w-5 text-status-warning-text" />
              </div>
              <div className="text-2xl font-bold text-foreground">{newCount}</div>
              <p className="text-xs text-muted-foreground">New Insights</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Play className="h-5 w-5 text-status-info-text" />
              </div>
              <div className="text-2xl font-bold text-foreground">
                {insights.filter((i) => i.status === "in_progress").length}
              </div>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle2 className="h-5 w-5 text-status-success-text" />
              </div>
              <div className="text-2xl font-bold text-foreground">
                {insights.filter((i) => i.status === "completed").length}
              </div>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Lightbulb className="h-5 w-5 text-primary" />
              </div>
              <div className="text-2xl font-bold text-foreground">{easyWins.length}</div>
              <p className="text-xs text-muted-foreground">Easy Wins</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {FILTER_OPTIONS.map((f) => (
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
                      <Card
                        className={cn(
                          "transition-all hover:shadow-md",
                          insight.status === "new" && "border-l-4 border-l-blue-500",
                        )}
                      >
                        <CardContent className="p-5">
                          <div className="flex flex-col lg:flex-row gap-4">
                            <div
                              className={cn(
                                "flex h-12 w-12 items-center justify-center rounded-xl flex-shrink-0",
                                colorClass,
                              )}
                            >
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

                              <p className="text-sm text-muted-foreground mb-4">
                                {insight.summary}
                              </p>

                              {insight.recommendations.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Recommended Actions
                                  </p>
                                  {insight.recommendations.slice(0, 3).map((rec, i) => (
                                    <div key={i} className="flex items-start gap-2 text-sm">
                                      <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                      <div>
                                        <span className="font-medium text-foreground">
                                          {rec.action}
                                        </span>
                                        {rec.details && (
                                          <span className="text-muted-foreground">
                                            {" "}
                                            - {rec.details}
                                          </span>
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
                                  <ArrowUpRight className="h-4 w-4 text-status-success" />
                                  <span className="text-xl font-bold text-status-success-text">
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
                                  className="gap-1 bg-action-primary text-action-primary-foreground hover:bg-action-primary-hover"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                  Complete
                                </Button>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
                            {insight.createdAt && (
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(insight.createdAt), {
                                  addSuffix: true,
                                })}
                              </div>
                            )}
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
