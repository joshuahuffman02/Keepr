"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, type Transition } from "framer-motion";
import { apiClient } from "@/lib/api-client";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Brain,
  Sparkles,
  TrendingUp,
  DollarSign,
  Phone,
  Wrench,
  CloudSun,
  Activity,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Zap,
  MessageSquare,
  Users,
  Calendar,
  Settings,
  ChevronRight,
  Bot,
  RefreshCw,
  Shield,
  Target,
  BarChart3,
  Gauge,
  Send,
  User,
  ExternalLink,
  Play,
  Pause,
  RotateCcw,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

type Campground = Awaited<ReturnType<typeof apiClient.getCampgrounds>>[number];
type DashboardData = Awaited<ReturnType<typeof apiClient.getAiDashboard>>;
type DashboardMetrics = DashboardData["metrics"];
type ActivityItem = Awaited<ReturnType<typeof apiClient.getAiActivityFeed>>[number] & {
  description?: string;
  status?: "success" | "pending" | "warning" | "error";
  metadata?: Record<string, unknown>;
  reversible?: boolean;
};
type AutopilotConfig = Awaited<ReturnType<typeof apiClient.getAutopilotConfig>> & {
  autoReplyAutoSendEnabled?: boolean;
  waitlistAutoOfferEnabled?: boolean;
  anomalyAutoFixEnabled?: boolean;
  noShowAutoReleaseEnabled?: boolean;
  dynamicPricingAiEnabled?: boolean;
  predictiveMaintenanceEnabled?: boolean;
  phoneAgentEnabled?: boolean;
  [key: string]: boolean | string | number | string[] | undefined;
};

const SPRING_CONFIG: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 25,
};

type AutopilotToggleKey =
  | "autoReplyEnabled"
  | "smartWaitlistEnabled"
  | "anomalyDetectionEnabled"
  | "noShowPredictionEnabled"
  | "dynamicPricingAiEnabled"
  | "predictiveMaintenanceEnabled"
  | "weatherAlertsEnabled"
  | "phoneAgentEnabled"
  | "autoReplyAutoSendEnabled"
  | "waitlistAutoOfferEnabled"
  | "anomalyAutoFixEnabled"
  | "noShowAutoReleaseEnabled";

type FeatureStatKey = keyof DashboardMetrics | "featuresEnabled" | "weatherActive";
type FeatureCard = {
  id: string;
  title: string;
  description: string;
  icon: typeof DollarSign;
  href: string;
  color: string;
  configKey?: AutopilotToggleKey;
  stats: { label: string; key: FeatureStatKey; format?: "currency" };
};

const featureCards: FeatureCard[] = [
  {
    id: "pricing",
    title: "Dynamic Pricing",
    description: "AI-powered pricing recommendations",
    icon: DollarSign,
    href: "/ai/pricing",
    color: "bg-status-success-bg text-status-success-text border border-status-success-border",
    configKey: "dynamicPricingAiEnabled",
    stats: { label: "Suggestions", key: "pricingSuggestions" },
  },
  {
    id: "revenue",
    title: "Revenue Manager",
    description: "Find revenue opportunities",
    icon: TrendingUp,
    href: "/ai/revenue",
    color: "bg-status-info-bg text-status-info-text border border-status-info-border",
    stats: { label: "Revenue Saved", key: "estimatedRevenueSavedCents", format: "currency" },
  },
  {
    id: "phone",
    title: "AI Phone Agent",
    description: "24/7 automated call handling",
    icon: Phone,
    href: "/ai/phone",
    color: "bg-primary/10 text-primary border border-primary/20",
    configKey: "phoneAgentEnabled",
    stats: { label: "Calls Handled", key: "phoneCallsHandled" },
  },
  {
    id: "maintenance",
    title: "Predictive Maintenance",
    description: "Prevent equipment failures",
    icon: Wrench,
    href: "/ai/maintenance",
    color: "bg-status-warning-bg text-status-warning-text border border-status-warning-border",
    configKey: "predictiveMaintenanceEnabled",
    stats: { label: "Alerts", key: "risksIdentified" },
  },
  {
    id: "weather",
    title: "Weather Alerts",
    description: "Auto-notify guests of weather",
    icon: CloudSun,
    href: "/ai/weather",
    color: "bg-status-info-bg text-status-info-text border border-status-info-border",
    configKey: "weatherAlertsEnabled",
    stats: { label: "Status", key: "weatherActive" },
  },
  {
    id: "settings",
    title: "AI Settings",
    description: "Configure autonomous features",
    icon: Settings,
    href: "/ai/settings",
    color: "bg-muted text-muted-foreground border border-border",
    stats: { label: "Features", key: "featuresEnabled" },
  },
];

function getActivityIcon(type: string) {
  switch (type) {
    case "auto_reply_sent":
      return MessageSquare;
    case "waitlist_auto_offered":
      return Users;
    case "pricing_recommendation":
      return DollarSign;
    case "maintenance_alert":
      return Wrench;
    case "weather_alert":
      return CloudSun;
    case "phone_call":
      return Phone;
    case "site_released":
      return Calendar;
    case "anomaly_detected":
      return AlertTriangle;
    default:
      return Activity;
  }
}

function getStatusColor(status?: string) {
  switch (status) {
    case "success":
      return "bg-status-success/15 text-status-success border-status-success";
    case "pending":
      return "bg-status-warning/15 text-status-warning border-status-warning";
    case "warning":
      return "bg-status-warning/15 text-status-warning border-status-warning";
    case "error":
      return "bg-status-error/15 text-status-error border-status-error";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export default function AICommandCenterPage() {
  const [activeTab, setActiveTab] = useState("overview");
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

  // Get AI dashboard metrics
  const {
    data: dashboard,
    isLoading: loadingDashboard,
    refetch: refetchDashboard,
  } = useQuery<DashboardData>({
    queryKey: ["ai-dashboard", campgroundId],
    queryFn: () => apiClient.getAiDashboard(requireCampgroundId()),
    enabled: !!campgroundId,
    refetchInterval: 30000,
  });

  // Get AI activity feed
  const {
    data: activityFeed = [],
    isLoading: loadingActivity,
    refetch: refetchActivity,
  } = useQuery<ActivityItem[]>({
    queryKey: ["ai-activity", campgroundId],
    queryFn: () => apiClient.getAiActivityFeed(requireCampgroundId()),
    enabled: !!campgroundId,
    refetchInterval: 10000,
  });

  // Get AI autopilot config
  const { data: autopilotConfig, refetch: refetchConfig } = useQuery<AutopilotConfig>({
    queryKey: ["ai-autopilot-config", campgroundId],
    queryFn: () => apiClient.getAutopilotConfig(requireCampgroundId()),
    enabled: !!campgroundId,
  });

  // Reverse autonomous action mutation
  const reverseActionMutation = useMutation({
    mutationFn: (actionId: string) =>
      apiClient.reverseAutonomousAction(requireCampgroundId(), actionId),
    onSuccess: () => {
      toast({ title: "Action reversed", description: "The autonomous action has been reversed." });
      refetchActivity();
    },
    onError: (error) => {
      toast({
        title: "Failed to reverse action",
        description: error instanceof Error ? error.message : "Unable to reverse action",
        variant: "destructive",
      });
    },
  });

  const metrics = dashboard?.metrics;
  // Calculate ROI from metrics (revenue saved / cost)
  const roiMultiple =
    metrics?.aiCostCents && metrics.aiCostCents > 0
      ? (metrics.estimatedRevenueSavedCents || 0) / metrics.aiCostCents
      : null;

  // Calculate enabled features count
  const config = autopilotConfig;
  const enabledFeatures = config
    ? [
        config.autoReplyEnabled,
        config.smartWaitlistEnabled,
        config.anomalyDetectionEnabled,
        config.noShowPredictionEnabled,
        config.dynamicPricingAiEnabled,
        config.predictiveMaintenanceEnabled,
        config.weatherAlertsEnabled,
        config.phoneAgentEnabled,
      ].filter(Boolean).length
    : 0;

  // Calculate autonomous features count
  const autonomousFeatures = config
    ? [
        config.autoReplyAutoSendEnabled,
        config.waitlistAutoOfferEnabled,
        config.anomalyAutoFixEnabled,
        config.noShowAutoReleaseEnabled,
      ].filter(Boolean).length
    : 0;

  if (!campground) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h2 className="text-2xl font-bold text-foreground mb-2">No Campground Selected</h2>
            <p className="text-muted-foreground">
              Select a campground to access the AI Command Center
            </p>
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
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-sm">
              <Brain className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">AI Command Center</h1>
              <p className="text-sm text-muted-foreground">
                Your AI assistant is handling operations autonomously
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchDashboard();
                refetchActivity();
                refetchConfig();
              }}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Link href="/ai/chat">
              <Button variant="outline" size="sm" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                Chat with AI
              </Button>
            </Link>
            <Link href="/ai/settings">
              <Button variant="default" size="sm" className="gap-2">
                <Settings className="h-4 w-4" />
                Configure AI
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* AI Status Banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_CONFIG, delay: 0.05 }}
        >
          <Card className="relative overflow-hidden border-status-info-border bg-status-info-bg">
            <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,black)]" />
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="h-14 w-14 rounded-full bg-card border border-border flex items-center justify-center">
                      <Bot className="h-7 w-7 text-primary" />
                    </div>
                    <motion.div
                      className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-status-success"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg text-foreground">AI Assistant Active</h3>
                      <Badge
                        variant="outline"
                        className="bg-status-success-bg text-status-success-text border-status-success-border"
                      >
                        <span className="relative flex h-2 w-2 mr-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-success/40 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-status-success"></span>
                        </span>
                        Online
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {enabledFeatures} of 8 AI features enabled • {autonomousFeatures} running
                      autonomously
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/80 border border-border">
                    <Zap className="h-4 w-4 text-status-warning" />
                    <span className="text-sm font-medium">
                      {metrics?.messagesHandled || 0} actions today
                    </span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/80 border border-border">
                    <Shield className="h-4 w-4 text-status-success" />
                    <span className="text-sm font-medium">
                      {metrics?.risksIdentified || 0} risks prevented
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Metrics Grid */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_CONFIG, delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <Card className="group hover:shadow-md transition-all">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <MessageSquare className="h-5 w-5 text-status-info-text" />
                <Badge variant="outline" className="text-xs">
                  Today
                </Badge>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {loadingDashboard ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  metrics?.messagesHandled || 0
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Messages Handled</p>
              {metrics?.messagesAutoSent ? (
                <p className="text-xs text-status-success-text mt-1">
                  {metrics.messagesAutoSent} auto-sent
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="group hover:shadow-md transition-all">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Phone className="h-5 w-5 text-primary" />
                <Badge variant="outline" className="text-xs">
                  Today
                </Badge>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {loadingDashboard ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  metrics?.phoneCallsHandled || 0
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Phone Calls Handled</p>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-md transition-all">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="h-5 w-5 text-status-success-text" />
                <Badge variant="outline" className="text-xs">
                  This Month
                </Badge>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {loadingDashboard ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  `$${((metrics?.estimatedRevenueSavedCents || 0) / 100).toLocaleString()}`
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Revenue Protected</p>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-md transition-all">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Gauge className="h-5 w-5 text-status-warning-text" />
                <Badge variant="outline" className="text-xs">
                  ROI
                </Badge>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {loadingDashboard ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : roiMultiple !== null ? (
                  `${roiMultiple.toFixed(1)}x`
                ) : (
                  "N/A"
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Return on AI Investment</p>
              {metrics?.aiCostCents ? (
                <p className="text-xs text-muted-foreground mt-1">
                  Cost: ${(metrics.aiCostCents / 100).toFixed(2)}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </motion.div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview" className="gap-2">
              <Brain className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2">
              <Activity className="h-4 w-4" />
              Activity Feed
            </TabsTrigger>
            <TabsTrigger value="autonomous" className="gap-2">
              <Zap className="h-4 w-4" />
              Autonomous Actions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Feature Cards Grid */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING_CONFIG, delay: 0.15 }}
            >
              <h2 className="text-lg font-semibold text-foreground mb-4">AI Features</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {featureCards.map((feature, index) => {
                  const Icon = feature.icon;
                  let statValue: string | number = 0;
                  const isEnabled =
                    feature.configKey && config ? Boolean(config[feature.configKey]) : true;

                  if (feature.stats.key === "featuresEnabled") {
                    statValue = enabledFeatures;
                  } else if (feature.stats.key === "weatherActive") {
                    statValue = config?.weatherAlertsEnabled ? "Active" : "Inactive";
                  } else if (metrics) {
                    const val = metrics[feature.stats.key];
                    if (feature.stats.format === "currency" && typeof val === "number") {
                      statValue = `$${(val / 100).toLocaleString()}`;
                    } else {
                      statValue = val;
                    }
                  }

                  return (
                    <motion.div
                      key={feature.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * index, ...SPRING_CONFIG }}
                    >
                      <Link href={feature.href}>
                        <Card
                          className={cn(
                            "group h-full hover:shadow-lg transition-all cursor-pointer border-2",
                            isEnabled ? "hover:border-primary/20" : "opacity-75",
                          )}
                        >
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between mb-4">
                              <div
                                className={cn(
                                  "flex h-12 w-12 items-center justify-center rounded-xl shadow-sm",
                                  feature.color,
                                )}
                              >
                                <Icon className="h-6 w-6" />
                              </div>
                              <div className="flex items-center gap-2">
                                {feature.configKey && (
                                  <Badge
                                    variant={isEnabled ? "default" : "secondary"}
                                    className="text-xs"
                                  >
                                    {isEnabled ? "Enabled" : "Disabled"}
                                  </Badge>
                                )}
                                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                              </div>
                            </div>
                            <h3 className="font-semibold text-foreground mb-1">{feature.title}</h3>
                            <p className="text-sm text-muted-foreground mb-3">
                              {feature.description}
                            </p>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {feature.stats.label}: {statValue}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING_CONFIG, delay: 0.25 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
            >
              <Link href="/ai/pricing">
                <Card className="group cursor-pointer hover:shadow-md transition-all hover:border-status-success-border">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-status-success-bg border border-status-success-border flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Target className="h-5 w-5 text-status-success-text" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm text-foreground">Review Pricing</p>
                      <p className="text-xs text-muted-foreground">
                        {metrics?.pricingSuggestions || 0} pending suggestions
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </CardContent>
                </Card>
              </Link>

              <Link href="/ai/revenue">
                <Card className="group cursor-pointer hover:shadow-md transition-all hover:border-status-info-border">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-status-info-bg border border-status-info-border flex items-center justify-center group-hover:scale-110 transition-transform">
                      <BarChart3 className="h-5 w-5 text-status-info-text" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm text-foreground">Revenue Insights</p>
                      <p className="text-xs text-muted-foreground">Find missed opportunities</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </CardContent>
                </Card>
              </Link>

              <Link href="/ai/phone">
                <Card className="group cursor-pointer hover:shadow-md transition-all hover:border-primary/30">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Phone className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm text-foreground">Phone Agent</p>
                      <p className="text-xs text-muted-foreground">
                        {config?.phoneAgentEnabled ? "Active" : "Configure now"}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </CardContent>
                </Card>
              </Link>

              <Link href="/ai/maintenance">
                <Card className="group cursor-pointer hover:shadow-md transition-all hover:border-status-warning-border">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-status-warning-bg border border-status-warning-border flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Wrench className="h-5 w-5 text-status-warning-text" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm text-foreground">Maintenance Alerts</p>
                      <p className="text-xs text-muted-foreground">
                        {metrics?.risksIdentified || 0} active alerts
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          </TabsContent>

          <TabsContent value="activity">
            {/* Activity Feed */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-primary" />
                      AI Activity Feed
                    </CardTitle>
                    <CardDescription>Real-time autonomous actions</CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    <span className="relative flex h-2 w-2 mr-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                    Live
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {loadingActivity ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : activityFeed.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Sparkles className="h-10 w-10 text-muted-foreground/50 mb-3" />
                    <p className="font-medium text-foreground">No AI activity yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Enable AI features to see autonomous actions here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    <AnimatePresence mode="popLayout">
                      {activityFeed.map((item, index) => {
                        const Icon = getActivityIcon(item.type);
                        return (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            transition={{ delay: index * 0.02 }}
                            className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                          >
                            <div
                              className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-full",
                                item.status === "success" || item.color === "emerald"
                                  ? "bg-status-success/15"
                                  : item.status === "pending" || item.color === "amber"
                                    ? "bg-status-warning/15"
                                    : item.status === "warning" || item.color === "orange"
                                      ? "bg-status-warning/15"
                                      : item.status === "error" || item.color === "red"
                                        ? "bg-status-error/15"
                                        : "bg-muted",
                              )}
                            >
                              <Icon
                                className={cn(
                                  "h-4 w-4",
                                  item.status === "success" || item.color === "emerald"
                                    ? "text-status-success"
                                    : item.status === "pending" || item.color === "amber"
                                      ? "text-status-warning"
                                      : item.status === "warning" || item.color === "orange"
                                        ? "text-status-warning"
                                        : item.status === "error" || item.color === "red"
                                          ? "text-status-error"
                                          : "text-muted-foreground",
                                )}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm text-foreground truncate">
                                  {item.title}
                                </p>
                                {item.status && (
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-[10px] px-1.5 py-0",
                                      getStatusColor(item.status),
                                    )}
                                  >
                                    {item.status}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                {item.description || item.subtitle}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {item.reversible && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => reverseActionMutation.mutate(item.id)}
                                  disabled={reverseActionMutation.isPending}
                                  aria-label="Undo action"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <div className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="autonomous">
            {/* Autonomous Actions Summary */}
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-status-warning" />
                    Autonomous Mode Status
                  </CardTitle>
                  <CardDescription>Features running without human intervention</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Auto Reply */}
                    <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-status-info-bg border border-status-info-border flex items-center justify-center">
                          <MessageSquare className="h-5 w-5 text-status-info-text" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Auto-Send Replies</p>
                          <p className="text-xs text-muted-foreground">
                            Automatically send AI-generated replies
                          </p>
                        </div>
                      </div>
                      <Badge variant={config?.autoReplyAutoSendEnabled ? "default" : "secondary"}>
                        {config?.autoReplyAutoSendEnabled ? "Active" : "Manual"}
                      </Badge>
                    </div>

                    {/* Auto Waitlist Offer */}
                    <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Auto-Offer Waitlist</p>
                          <p className="text-xs text-muted-foreground">
                            Automatically offer spots when available
                          </p>
                        </div>
                      </div>
                      <Badge variant={config?.waitlistAutoOfferEnabled ? "default" : "secondary"}>
                        {config?.waitlistAutoOfferEnabled ? "Active" : "Manual"}
                      </Badge>
                    </div>

                    {/* Auto Fix Anomalies */}
                    <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-status-warning-bg border border-status-warning-border flex items-center justify-center">
                          <AlertTriangle className="h-5 w-5 text-status-warning-text" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Auto-Fix Anomalies</p>
                          <p className="text-xs text-muted-foreground">
                            Automatically resolve detected issues
                          </p>
                        </div>
                      </div>
                      <Badge variant={config?.anomalyAutoFixEnabled ? "default" : "secondary"}>
                        {config?.anomalyAutoFixEnabled ? "Active" : "Manual"}
                      </Badge>
                    </div>

                    {/* Auto Release No-Shows */}
                    <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-status-error-bg border border-status-error-border flex items-center justify-center">
                          <Calendar className="h-5 w-5 text-status-error-text" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Auto-Release No-Shows</p>
                          <p className="text-xs text-muted-foreground">
                            Automatically release unconfirmed sites
                          </p>
                        </div>
                      </div>
                      <Badge variant={config?.noShowAutoReleaseEnabled ? "default" : "secondary"}>
                        {config?.noShowAutoReleaseEnabled ? "Active" : "Manual"}
                      </Badge>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <Link href="/ai/settings">
                      <Button variant="outline" className="gap-2">
                        <Settings className="h-4 w-4" />
                        Configure Autonomous Features
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Autonomous Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    Recent Autonomous Actions
                  </CardTitle>
                  <CardDescription>
                    Actions taken automatically by your AI assistant
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingActivity ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activityFeed
                        .filter((item) =>
                          [
                            "auto_reply_sent",
                            "waitlist_auto_offered",
                            "site_released",
                            "anomaly_fixed",
                          ].includes(item.type),
                        )
                        .slice(0, 10)
                        .map((item) => {
                          const Icon = getActivityIcon(item.type);
                          return (
                            <div
                              key={item.id}
                              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-status-info-bg border border-status-info-border flex items-center justify-center">
                                  <Icon className="h-4 w-4 text-status-info-text" />
                                </div>
                                <div>
                                  <p className="font-medium text-sm text-foreground">
                                    {item.title}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {item.description}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {item.reversible && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="gap-1 text-xs"
                                    onClick={() => reverseActionMutation.mutate(item.id)}
                                    disabled={reverseActionMutation.isPending}
                                  >
                                    <RotateCcw className="h-3 w-3" />
                                    Undo
                                  </Button>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(item.timestamp), {
                                    addSuffix: true,
                                  })}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      {activityFeed.filter((item) =>
                        [
                          "auto_reply_sent",
                          "waitlist_auto_offered",
                          "site_released",
                          "anomaly_fixed",
                        ].includes(item.type),
                      ).length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No autonomous actions yet</p>
                          <p className="text-xs">Enable autonomous features to see actions here</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardShell>
  );
}
