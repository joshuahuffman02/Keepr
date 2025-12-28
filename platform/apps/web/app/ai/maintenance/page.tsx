"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiClient } from "@/lib/api-client";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  Wrench,
  ArrowLeft,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  Calendar,
  MapPin,
  TrendingUp
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

type MaintenanceAlert = {
  id: string;
  siteId?: string | null;
  siteName?: string;
  alertType: string;
  severity: string;
  title: string;
  summary: string;
  category: string;
  incidentCount: number;
  incidentIds?: string[];
  predictedFailure?: string;
  confidence: number;
  suggestedAction: string;
  estimatedCostCents?: number | null;
  status: string;
  maintenanceTicketId?: string;
  createdAt?: string;
};

function getSeverityColor(severity: string) {
  switch (severity) {
    case "critical":
      return "bg-red-500 text-white";
    case "high":
      return "bg-orange-500 text-white";
    case "medium":
      return "bg-amber-500 text-white";
    case "low":
      return "bg-blue-500 text-white";
    default:
      return "bg-slate-500 text-white";
  }
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "electrical":
      return Zap;
    case "plumbing":
      return Wrench;
    case "hvac":
      return TrendingUp;
    default:
      return AlertTriangle;
  }
}

export default function AIMaintenancePage() {
  const [filter, setFilter] = useState<"all" | "new" | "acknowledged" | "scheduled">("new");
  const { toast } = useToast();

  // Get campground
  const { data: campgrounds = [] } = useQuery({
    queryKey: ["campgrounds"],
    queryFn: () => apiClient.getCampgrounds(),
  });
  const campground = campgrounds[0];

  // Get maintenance alerts
  const { data: alerts = [], isLoading, refetch } = useQuery({
    queryKey: ["maintenance-alerts", campground?.id],
    queryFn: () => apiClient.getMaintenanceAlerts(campground!.id),
    enabled: !!campground?.id,
  });

  // Acknowledge alert mutation
  const acknowledgeMutation = useMutation({
    mutationFn: (alertId: string) =>
      apiClient.acknowledgeMaintenanceAlert(alertId),
    onSuccess: () => {
      toast({ title: "Alert acknowledged" });
      refetch();
    },
    onError: (error: any) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  const filteredAlerts = (alerts as MaintenanceAlert[]).filter(a =>
    filter === "all" ? true : a.status === filter
  );

  const newCount = (alerts as MaintenanceAlert[]).filter(a => a.status === "new").length;
  const criticalCount = (alerts as MaintenanceAlert[]).filter(a =>
    a.status === "new" && (a.severity === "critical" || a.severity === "high")
  ).length;

  if (!campground) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Wrench className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h2 className="text-2xl font-bold text-foreground mb-2">No Campground Selected</h2>
            <p className="text-muted-foreground">Select a campground to view maintenance alerts</p>
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
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25">
              <Wrench className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Predictive Maintenance</h1>
              <p className="text-sm text-muted-foreground">
                AI-detected maintenance patterns and predictions
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Analyze Now
          </Button>
        </motion.div>

        {/* Critical Alert Banner */}
        {criticalCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_CONFIG, delay: 0.05 }}
          >
            <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                  <div>
                    <p className="font-semibold text-red-800 dark:text-red-300">
                      {criticalCount} High Priority Alert{criticalCount > 1 ? "s" : ""}
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-400">
                      Immediate attention recommended
                    </p>
                  </div>
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
              <AlertTriangle className="h-5 w-5 text-amber-500 mb-2" />
              <div className="text-2xl font-bold text-foreground">{newCount}</div>
              <p className="text-xs text-muted-foreground">New Alerts</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 mb-2" />
              <div className="text-2xl font-bold text-foreground">
                {(alerts as MaintenanceAlert[]).filter(a => a.status === "scheduled").length}
              </div>
              <p className="text-xs text-muted-foreground">Scheduled</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <Calendar className="h-5 w-5 text-blue-500 mb-2" />
              <div className="text-2xl font-bold text-foreground">
                {(alerts as MaintenanceAlert[]).filter(a => a.status === "resolved").length}
              </div>
              <p className="text-xs text-muted-foreground">Resolved</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <Zap className="h-5 w-5 text-violet-500 mb-2" />
              <div className="text-2xl font-bold text-foreground">{criticalCount}</div>
              <p className="text-xs text-muted-foreground">High Priority</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {(["new", "acknowledged", "scheduled", "all"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f}
              {f === "new" && newCount > 0 && (
                <Badge variant="secondary" className="ml-2 bg-white/20">
                  {newCount}
                </Badge>
              )}
            </Button>
          ))}
        </div>

        {/* Alerts List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredAlerts.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-emerald-500/50" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No Alerts</h3>
                <p className="text-sm text-muted-foreground">
                  All systems operating normally
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {filteredAlerts.map((alert, index) => {
                const Icon = getCategoryIcon(alert.category);
                return (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: index * 0.02, ...SPRING_CONFIG }}
                  >
                    <Card className={cn(
                      "transition-all hover:shadow-md",
                      alert.status === "new" && (alert.severity === "critical" || alert.severity === "high")
                        ? "border-l-4 border-l-red-500"
                        : alert.status === "new" && "border-l-4 border-l-amber-500"
                    )}>
                      <CardContent className="p-5">
                        <div className="flex flex-col lg:flex-row gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30 flex-shrink-0">
                            <Icon className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                          </div>

                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <h3 className="font-semibold text-foreground">{alert.title}</h3>
                              <Badge className={getSeverityColor(alert.severity)}>
                                {alert.severity}
                              </Badge>
                              <Badge variant="outline" className="capitalize">
                                {alert.category}
                              </Badge>
                            </div>

                            {alert.siteName && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                                <MapPin className="h-3 w-3" />
                                {alert.siteName}
                              </div>
                            )}

                            <p className="text-sm text-muted-foreground mb-3">{alert.summary}</p>

                            <div className="p-3 bg-muted rounded-lg">
                              <p className="text-xs font-medium text-muted-foreground mb-1">
                                Suggested Action
                              </p>
                              <p className="text-sm text-foreground">{alert.suggestedAction}</p>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-3 lg:flex-shrink-0">
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">Confidence</p>
                              <div className="flex items-center gap-2">
                                <Progress value={alert.confidence * 100} className="w-16 h-2" />
                                <span className="text-sm font-medium">{Math.round(alert.confidence * 100)}%</span>
                              </div>
                            </div>

                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">Incidents</p>
                              <p className="text-lg font-bold text-foreground">{alert.incidentCount}</p>
                            </div>

                            {alert.status === "new" && (
                              <Button
                                size="sm"
                                onClick={() => acknowledgeMutation.mutate(alert.id)}
                                disabled={acknowledgeMutation.isPending}
                              >
                                Acknowledge
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
                          {alert.createdAt && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                            </div>
                          )}
                          {alert.predictedFailure && (
                            <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                              <AlertTriangle className="h-3 w-3" />
                              Predicted failure: {format(new Date(alert.predictedFailure), "MMM d")}
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
      </div>
    </DashboardShell>
  );
}
