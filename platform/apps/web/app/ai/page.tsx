"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
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
  RotateCcw
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

type ActivityItem = {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  description?: string;
  timestamp: string;
  icon?: string;
  color?: string;
  status?: "success" | "pending" | "warning" | "error";
  metadata?: Record<string, any>;
  reversible?: boolean;
};

type DashboardMetrics = {
  messagesHandled: number;
  messagesAutoSent: number;
  risksIdentified: number;
  pricingSuggestions: number;
  phoneCallsHandled: number;
  estimatedRevenueSaved: number;
  aiCostCents: number;
  periodStart: string;
  periodEnd: string;
};

type AutopilotConfig = {
  autoReplyEnabled?: boolean;
  autoReplyAutoSendEnabled?: boolean;
  smartWaitlistEnabled?: boolean;
  waitlistAutoOfferEnabled?: boolean;
  anomalyDetectionEnabled?: boolean;
  anomalyAutoFixEnabled?: boolean;
  noShowPredictionEnabled?: boolean;
  noShowAutoReleaseEnabled?: boolean;
  dynamicPricingAiEnabled?: boolean;
  predictiveMaintenanceEnabled?: boolean;
  weatherAlertsEnabled?: boolean;
  phoneAgentEnabled?: boolean;
  [key: string]: boolean | string | number | undefined;
};

const featureCards = [
  {
    id: "pricing",
    title: "Dynamic Pricing",
    description: "AI-powered pricing recommendations",
    icon: DollarSign,
    href: "/ai/pricing",
    color: "from-emerald-500 to-green-600",
    configKey: "dynamicPricingAiEnabled",
    stats: { label: "Suggestions", key: "pricingSuggestions" },
  },
  {
    id: "revenue",
    title: "Revenue Manager",
    description: "Find revenue opportunities",
    icon: TrendingUp,
    href: "/ai/revenue",
    color: "from-blue-500 to-indigo-600",
    stats: { label: "Revenue Saved", key: "estimatedRevenueSaved", format: "currency" },
  },
  {
    id: "phone",
    title: "AI Phone Agent",
    description: "24/7 automated call handling",
    icon: Phone,
    href: "/ai/phone",
    color: "from-violet-500 to-purple-600",
    configKey: "phoneAgentEnabled",
    stats: { label: "Calls Handled", key: "phoneCallsHandled" },
  },
  {
    id: "maintenance",
    title: "Predictive Maintenance",
    description: "Prevent equipment failures",
    icon: Wrench,
    href: "/ai/maintenance",
    color: "from-amber-500 to-orange-600",
    configKey: "predictiveMaintenanceEnabled",
    stats: { label: "Alerts", key: "risksIdentified" },
  },
  {
    id: "weather",
    title: "Weather Alerts",
    description: "Auto-notify guests of weather",
    icon: CloudSun,
    href: "/ai/weather",
    color: "from-cyan-500 to-teal-600",
    configKey: "weatherAlertsEnabled",
    stats: { label: "Status", key: "weatherActive" },
  },
  {
    id: "settings",
    title: "AI Settings",
    description: "Configure autonomous features",
    icon: Settings,
    href: "/ai/settings",
    color: "from-slate-500 to-gray-600",
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
      return "bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-800";
  }
}

export default function AICommandCenterPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get campground
  const { data: campgrounds = [] } = useQuery({
    queryKey: ["campgrounds"],
    queryFn: () => apiClient.getCampgrounds(),
  });
  const campground = campgrounds[0];

  // Get AI dashboard metrics
  const { data: dashboard, isLoading: loadingDashboard, refetch: refetchDashboard } = useQuery({
    queryKey: ["ai-dashboard", campground?.id],
    queryFn: () => apiClient.getAiDashboard(campground!.id),
    enabled: !!campground?.id,
    refetchInterval: 30000,
  });

  // Get AI activity feed
  const { data: activityFeed = [], isLoading: loadingActivity, refetch: refetchActivity } = useQuery({
    queryKey: ["ai-activity", campground?.id],
    queryFn: () => apiClient.getAiActivityFeed(campground!.id),
    enabled: !!campground?.id,
    refetchInterval: 10000,
  });

  // Get AI autopilot config
  const { data: autopilotConfig, refetch: refetchConfig } = useQuery({
    queryKey: ["ai-autopilot-config", campground?.id],
    queryFn: () => apiClient.getAutopilotConfig(campground!.id),
    enabled: !!campground?.id,
  });

  // Reverse autonomous action mutation
  const reverseActionMutation = useMutation({
    mutationFn: (actionId: string) => apiClient.reverseAutonomousAction(campground!.id, actionId),
    onSuccess: () => {
      toast({ title: "Action reversed", description: "The autonomous action has been reversed." });
      refetchActivity();
    },
    onError: (error: any) => {
      toast({ title: "Failed to reverse action", description: error.message, variant: "destructive" });
    },
  });

  const metrics = dashboard?.metrics as DashboardMetrics | undefined;
  // Calculate ROI from metrics (revenue saved / cost)
  const roiMultiple = metrics?.aiCostCents && metrics.aiCostCents > 0
    ? (metrics.estimatedRevenueSaved || 0) / metrics.aiCostCents
    : null;

  // Calculate enabled features count
  const config = autopilotConfig as AutopilotConfig | undefined;
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
            <p className="text-muted-foreground">Select a campground to access the AI Command Center</p>
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
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25">
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
          <Card className="relative overflow-hidden border-violet-200 dark:border-violet-800 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30">
            <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,black)]" />
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="h-14 w-14 rounded-full bg-violet-500/20 flex items-center justify-center">
                      <Bot className="h-7 w-7 text-violet-600 dark:text-violet-400" />
                    </div>
                    <motion.div
                      className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-500"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg text-foreground">AI Assistant Active</h3>
                      <Badge
                        variant="outline"
                        className="bg-status-success/15 text-status-success border-status-success/30"
                      >
                        <span className="relative flex h-2 w-2 mr-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        Online
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {enabledFeatures} of 8 AI features enabled • {autonomousFeatures} running autonomously
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/50 dark:bg-white/10 border border-violet-200 dark:border-violet-700">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium">
                      {metrics?.messagesHandled || 0} actions today
                    </span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/50 dark:bg-white/10 border border-violet-200 dark:border-violet-700">
                    <Shield className="h-4 w-4 text-emerald-500" />
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
                <MessageSquare className="h-5 w-5 text-blue-500" />
                <Badge variant="outline" className="text-xs">Today</Badge>
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
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                  {metrics.messagesAutoSent} auto-sent
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="group hover:shadow-md transition-all">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Phone className="h-5 w-5 text-violet-500" />
                <Badge variant="outline" className="text-xs">Today</Badge>
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
                <DollarSign className="h-5 w-5 text-emerald-500" />
                <Badge variant="outline" className="text-xs">This Month</Badge>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {loadingDashboard ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  `$${((metrics?.estimatedRevenueSaved || 0) / 100).toLocaleString()}`
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Revenue Protected</p>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-md transition-all">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Gauge className="h-5 w-5 text-amber-500" />
                <Badge variant="outline" className="text-xs">ROI</Badge>
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
                  const isEnabled = feature.configKey && config
                    ? Boolean(config[feature.configKey])
                    : true;

                  if (feature.stats.key === "featuresEnabled") {
                    statValue = enabledFeatures;
                  } else if (feature.stats.key === "weatherActive") {
                    statValue = config?.weatherAlertsEnabled ? "Active" : "Inactive";
                  } else if (metrics && feature.stats.key in metrics) {
                    const val = metrics[feature.stats.key as keyof DashboardMetrics];
                    if (feature.stats.format === "currency" && typeof val === "number") {
                      statValue = `$${(val / 100).toLocaleString()}`;
                    } else {
                      statValue = val as string | number;
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
                        <Card className={cn(
                          "group h-full hover:shadow-lg transition-all cursor-pointer border-2",
                          isEnabled ? "hover:border-primary/20" : "opacity-75"
                        )}>
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between mb-4">
                              <div className={cn(
                                "flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-lg",
                                `bg-gradient-to-br ${feature.color}`
                              )}>
                                <Icon className="h-6 w-6" />
                              </div>
                              <div className="flex items-center gap-2">
                                {feature.configKey && (
                                  <Badge variant={isEnabled ? "default" : "secondary"} className="text-xs">
                                    {isEnabled ? "Enabled" : "Disabled"}
                                  </Badge>
                                )}
                                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                              </div>
                            </div>
                            <h3 className="font-semibold text-foreground mb-1">{feature.title}</h3>
                            <p className="text-sm text-muted-foreground mb-3">{feature.description}</p>
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
                <Card className="group cursor-pointer hover:shadow-md transition-all hover:border-emerald-300 dark:hover:border-emerald-700">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Target className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
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
                <Card className="group cursor-pointer hover:shadow-md transition-all hover:border-blue-300 dark:hover:border-blue-700">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
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
                <Card className="group cursor-pointer hover:shadow-md transition-all hover:border-violet-300 dark:hover:border-violet-700">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Phone className="h-5 w-5 text-violet-600 dark:text-violet-400" />
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
                <Card className="group cursor-pointer hover:shadow-md transition-all hover:border-amber-300 dark:hover:border-amber-700">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Wrench className="h-5 w-5 text-amber-600 dark:text-amber-400" />
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
                      <Activity className="h-5 w-5 text-violet-500" />
                      AI Activity Feed
                    </CardTitle>
                    <CardDescription>Real-time autonomous actions</CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    <span className="relative flex h-2 w-2 mr-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
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
                ) : (activityFeed as ActivityItem[]).length === 0 ? (
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
                      {(activityFeed as ActivityItem[]).map((item, index) => {
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
                            <div className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-full",
                              item.status === "success" || item.color === "emerald" ? "bg-status-success/15" :
                              item.status === "pending" || item.color === "amber" ? "bg-status-warning/15" :
                              item.status === "warning" || item.color === "orange" ? "bg-status-warning/15" :
                              item.status === "error" || item.color === "red" ? "bg-status-error/15" :
                              "bg-slate-100 dark:bg-slate-900/30"
                            )}>
                              <Icon className={cn(
                                "h-4 w-4",
                                item.status === "success" || item.color === "emerald" ? "text-status-success" :
                                item.status === "pending" || item.color === "amber" ? "text-status-warning" :
                                item.status === "warning" || item.color === "orange" ? "text-status-warning" :
                                item.status === "error" || item.color === "red" ? "text-status-error" :
                                "text-slate-600 dark:text-slate-400"
                              )} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm text-foreground truncate">
                                  {item.title}
                                </p>
                                {item.status && (
                                  <Badge
                                    variant="outline"
                                    className={cn("text-[10px] px-1.5 py-0", getStatusColor(item.status))}
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
                    <Zap className="h-5 w-5 text-amber-500" />
                    Autonomous Mode Status
                  </CardTitle>
                  <CardDescription>
                    Features running without human intervention
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Auto Reply */}
                    <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
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
                        <div className="h-10 w-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                          <Users className="h-5 w-5 text-violet-600 dark:text-violet-400" />
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
                        <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                          <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
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
                        <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                          <Calendar className="h-5 w-5 text-red-600 dark:text-red-400" />
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
                      {(activityFeed as ActivityItem[])
                        .filter(item => ["auto_reply_sent", "waitlist_auto_offered", "site_released", "anomaly_fixed"].includes(item.type))
                        .slice(0, 10)
                        .map((item) => {
                          const Icon = getActivityIcon(item.type);
                          return (
                            <div
                              key={item.id}
                              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                                  <Icon className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                                </div>
                                <div>
                                  <p className="font-medium text-sm text-foreground">{item.title}</p>
                                  <p className="text-xs text-muted-foreground">{item.description}</p>
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
                                  {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      {(activityFeed as ActivityItem[]).filter(item =>
                        ["auto_reply_sent", "waitlist_auto_offered", "site_released", "anomaly_fixed"].includes(item.type)
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
