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
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  Check,
  X,
  Sparkles,
  Calendar,
  AlertCircle,
  ChevronRight,
  Target,
  BarChart3,
  Clock
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

type Campground = Awaited<ReturnType<typeof apiClient.getCampgrounds>>[number];
type PricingRecommendation = Awaited<ReturnType<typeof apiClient.getPricingRecommendations>>[number] & {
  siteClassName?: string | null;
  createdAt?: string | null;
  expiresAt?: string | null;
};
type RecommendationStatusFilter = "all" | "pending" | "applied" | "dismissed";

const FILTER_OPTIONS: RecommendationStatusFilter[] = ["pending", "all", "applied", "dismissed"];

const SPRING_CONFIG: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 25,
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error && error.message ? error.message : "Something went wrong";

function getRecommendationIcon(type: string) {
  switch (type) {
    case "underpriced":
      return TrendingUp;
    case "overpriced":
      return TrendingDown;
    case "event_opportunity":
      return Calendar;
    default:
      return DollarSign;
  }
}

function getRecommendationColor(type: string) {
  switch (type) {
    case "underpriced":
      return "text-status-success-text bg-status-success-bg border border-status-success-border";
    case "overpriced":
      return "text-status-warning-text bg-status-warning-bg border border-status-warning-border";
    case "event_opportunity":
      return "text-status-info-text bg-status-info-bg border border-status-info-border";
    default:
      return "text-status-info-text bg-status-info-bg border border-status-info-border";
  }
}

export default function AIPricingPage() {
  const [filter, setFilter] = useState<RecommendationStatusFilter>("pending");
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

  // Get pricing recommendations
  const { data: recommendations = [], isLoading, refetch } = useQuery<PricingRecommendation[]>({
    queryKey: ["pricing-recommendations", campgroundId, filter],
    queryFn: () => apiClient.getPricingRecommendations(requireCampgroundId(), filter === "all" ? undefined : filter),
    enabled: !!campgroundId,
  });

  // Apply recommendation mutation
  const applyMutation = useMutation({
    mutationFn: (recommendationId: string) =>
      apiClient.applyPricingRecommendation(recommendationId),
    onSuccess: () => {
      toast({ title: "Pricing applied", description: "The pricing recommendation has been applied." });
      refetch();
      queryClient.invalidateQueries({ queryKey: ["pricing-recommendations"] });
    },
    onError: (error) => {
      toast({ title: "Failed to apply", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  // Dismiss recommendation mutation
  const dismissMutation = useMutation({
    mutationFn: (recommendationId: string) =>
      apiClient.dismissPricingRecommendation(recommendationId),
    onSuccess: () => {
      toast({ title: "Recommendation dismissed" });
      refetch();
      queryClient.invalidateQueries({ queryKey: ["pricing-recommendations"] });
    },
    onError: (error) => {
      toast({ title: "Failed to dismiss", description: getErrorMessage(error), variant: "destructive" });
    },
  });

  const pendingCount = recommendations.filter(r => r.status === "pending").length;
  const totalPotentialRevenue = recommendations
    .filter(r => r.status === "pending")
    .reduce((acc, r) => acc + (r.estimatedRevenueDelta || 0), 0);

  if (!campground) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <DollarSign className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h2 className="text-2xl font-bold text-foreground mb-2">No Campground Selected</h2>
            <p className="text-muted-foreground">Select a campground to view pricing recommendations</p>
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
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-status-success-bg text-status-success-text border border-status-success-border shadow-sm">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Dynamic Pricing AI</h1>
              <p className="text-sm text-muted-foreground">
                AI-powered pricing recommendations based on demand
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Refresh
          </Button>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_CONFIG, delay: 0.05 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Target className="h-5 w-5 text-status-warning-text" />
              </div>
              <div className="text-2xl font-bold text-foreground">{pendingCount}</div>
              <p className="text-xs text-muted-foreground">Pending Recommendations</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="h-5 w-5 text-status-success-text" />
              </div>
              <div className="text-2xl font-bold text-foreground">
                ${(totalPotentialRevenue / 100).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Potential Revenue Increase</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Check className="h-5 w-5 text-status-info-text" />
              </div>
              <div className="text-2xl font-bold text-foreground">
                {recommendations.filter(r => r.status === "applied").length}
              </div>
              <p className="text-xs text-muted-foreground">Applied This Month</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div className="text-2xl font-bold text-foreground">
                {recommendations.length > 0
                  ? Math.round(
                      recommendations.reduce((acc, r) => acc + r.confidence, 0) /
                        recommendations.length * 100
                    )
                  : 0}%
              </div>
              <p className="text-xs text-muted-foreground">Avg. Confidence Score</p>
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
              {f}
              {f === "pending" && pendingCount > 0 && (
                <Badge variant="secondary" className="ml-2 bg-white/20">
                  {pendingCount}
                </Badge>
              )}
            </Button>
          ))}
        </div>

        {/* Recommendations List */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_CONFIG, delay: 0.1 }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : recommendations.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No Recommendations</h3>
                  <p className="text-sm text-muted-foreground">
                    {filter === "pending"
                      ? "All pricing recommendations have been reviewed."
                      : `No ${filter} recommendations found.`}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {recommendations.map((rec, index) => {
                  const Icon = getRecommendationIcon(rec.recommendationType);
                  const colorClass = getRecommendationColor(rec.recommendationType);
                  const priceChange = rec.suggestedPriceCents - rec.currentPriceCents;
                  const isPositive = priceChange > 0;

                  return (
                    <motion.div
                      key={rec.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ delay: index * 0.02, ...SPRING_CONFIG }}
                    >
                      <Card
                        className={cn(
                          "transition-all hover:shadow-md",
                          rec.status === "pending" && "border-l-4 border-l-status-warning"
                        )}
                      >
                        <CardContent className="p-5">
                          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                            <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl flex-shrink-0", colorClass)}>
                              <Icon className="h-6 w-6" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-foreground">
                                  {rec.siteClassName || "All Sites"}
                                </h3>
                                <Badge variant="outline" className="text-xs capitalize">
                                  {rec.recommendationType.replace("_", " ")}
                                </Badge>
                                {rec.status !== "pending" && (
                                  <Badge variant={rec.status === "applied" ? "default" : "secondary"} className="text-xs capitalize">
                                    {rec.status}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {format(new Date(rec.dateStart), "MMM d")} - {format(new Date(rec.dateEnd), "MMM d, yyyy")}
                              </p>
                              <p className="text-sm text-muted-foreground line-clamp-2">{rec.reasoning}</p>
                            </div>

                            <div className="flex items-center gap-6 lg:flex-shrink-0">
                              <div className="text-center">
                                <p className="text-xs text-muted-foreground mb-1">Current</p>
                                <p className="text-lg font-semibold text-foreground">
                                  ${(rec.currentPriceCents / 100).toFixed(0)}
                                </p>
                              </div>

                              <ChevronRight className="h-5 w-5 text-muted-foreground" />

                              <div className="text-center">
                                <p className="text-xs text-muted-foreground mb-1">Suggested</p>
                                <p
                                  className={cn(
                                    "text-lg font-bold",
                                    isPositive ? "text-status-success-text" : "text-status-warning-text"
                                  )}
                                >
                                  ${(rec.suggestedPriceCents / 100).toFixed(0)}
                                </p>
                              </div>

                              <div className="text-center">
                                <p className="text-xs text-muted-foreground mb-1">Change</p>
                                <Badge
                                  variant={isPositive ? "default" : "secondary"}
                                  className={cn(
                                    isPositive
                                      ? "bg-status-success text-status-success-foreground"
                                      : "bg-status-warning text-status-warning-foreground"
                                  )}
                                >
                                  {isPositive ? "+" : ""}{rec.adjustmentPercent.toFixed(0)}%
                                </Badge>
                              </div>
                            </div>

                            <div className="lg:w-24 flex-shrink-0">
                              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                <span>Confidence</span>
                                <span>{Math.round(rec.confidence * 100)}%</span>
                              </div>
                              <Progress value={rec.confidence * 100} className="h-2" />
                            </div>

                            {rec.status === "pending" && (
                              <div className="flex items-center gap-2 lg:flex-shrink-0">
                                <Button
                                  size="sm"
                                  onClick={() => applyMutation.mutate(rec.id)}
                                  disabled={applyMutation.isPending}
                                  className="gap-1 bg-action-primary text-action-primary-foreground hover:bg-action-primary-hover"
                                >
                                  <Check className="h-4 w-4" />
                                  Apply
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => dismissMutation.mutate(rec.id)}
                                  disabled={dismissMutation.isPending}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
                            {rec.createdAt && (
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Created {formatDistanceToNow(new Date(rec.createdAt), { addSuffix: true })}
                              </div>
                            )}
                            {rec.status === "pending" && rec.expiresAt && (
                              <div className="flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Expires {formatDistanceToNow(new Date(rec.expiresAt), { addSuffix: true })}
                              </div>
                            )}
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
