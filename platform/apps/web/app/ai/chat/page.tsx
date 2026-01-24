"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  Bot,
  Send,
  User,
  Sparkles,
  TrendingUp,
  DollarSign,
  Calendar,
  ArrowLeft,
  Brain,
  CloudRain,
  Wrench,
  BarChart3,
  Phone,
  AlertTriangle,
  Activity,
} from "lucide-react";
import Link from "next/link";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const SPRING_CONFIG: { type: "spring"; stiffness: number; damping: number } = {
  type: "spring",
  stiffness: 300,
  damping: 25,
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

type QuickAction = {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompt: string;
  description: string;
};

type CopilotMetrics = {
  messagesHandled?: number;
  noShowsPrevented?: number;
  estimatedRevenueSavedCents?: number;
  roiPercent?: number;
};

type CopilotQuickStats = {
  pendingReplies?: number;
  activeAnomalies?: number;
  pendingPricing?: number;
  activeMaintenanceAlerts?: number;
  activeWeatherAlerts?: number;
};

type CopilotRecommendation = {
  adjustmentPercent: number;
  siteClassName?: string;
  recommendationType?: string;
};

type CopilotInsight = {
  title: string;
  impactCents?: number;
};

type CopilotWeather = {
  temp: number;
  feelsLike: number;
  description: string;
  windSpeed: number;
  humidity: number;
};

type CopilotAlert = {
  title: string;
  severity: string;
};

type CopilotAction = {
  action: string;
  description: string;
};

type CopilotSummary = {
  activeAlerts?: number;
};

type CopilotResponse = {
  error?: string;
  message?: string;
  preview?: string;
  metrics?: CopilotMetrics;
  quickStats?: CopilotQuickStats;
  recommendations?: CopilotRecommendation[];
  insights?: CopilotInsight[];
  weather?: CopilotWeather;
  alerts?: CopilotAlert[];
  summary?: CopilotSummary;
  availableActions?: CopilotAction[];
};

export default function AiChatPage() {
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  // Get campground from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("campreserv:selectedCampground");
    setCampgroundId(stored);
  }, []);

  // Fetch campground details
  const { data: campground } = useQuery({
    queryKey: ["campground", campgroundId],
    queryFn: async () => {
      if (!campgroundId) return null;
      const campgrounds = await apiClient.getCampgrounds();
      return campgrounds.find((c) => c.id === campgroundId) || null;
    },
    enabled: !!campgroundId,
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize with welcome message
  useEffect(() => {
    if (messages.length === 0 && campground) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: `Hi! I'm your AI assistant for ${campground.name}. I can help you with:

**AI Features**
- \`get_ai_dashboard\` - Full AI status, metrics & activity
- \`get_pricing_recommendations\` - Dynamic pricing suggestions
- \`get_revenue_insights\` - Revenue opportunities you might be missing
- \`get_weather\` - Current weather & alerts
- \`get_maintenance_alerts\` - Predictive maintenance issues

**Actions**
- Draft replies to guest messages
- Apply or dismiss pricing recommendations
- Analyze trends and patterns

Type \`help\` to see all available commands, or just ask me anything!`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [messages.length, campground]);

  const history = useMemo(
    () => messages.map((msg) => ({ role: msg.role, content: msg.content })),
    [messages],
  );

  // Detect if message is a copilot action command
  const isActionCommand = (message: string): boolean => {
    const actionPatterns = [
      /^get_/,
      /^analyze_/,
      /^apply_/,
      /^dismiss_/,
      /^check_/,
      /^help$/,
      /^list_actions$/,
    ];
    const cleanMessage = message.trim().toLowerCase();
    return actionPatterns.some((pattern) => pattern.test(cleanMessage));
  };

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;
  const getString = (value: unknown): string | undefined =>
    typeof value === "string" ? value : undefined;
  const getNumber = (value: unknown): number | undefined =>
    typeof value === "number" ? value : undefined;

  const parseMetrics = (value: unknown): CopilotMetrics | undefined => {
    if (!isRecord(value)) return undefined;
    return {
      messagesHandled: getNumber(value.messagesHandled),
      noShowsPrevented: getNumber(value.noShowsPrevented),
      estimatedRevenueSavedCents: getNumber(value.estimatedRevenueSavedCents),
      roiPercent: getNumber(value.roiPercent),
    };
  };

  const parseQuickStats = (value: unknown): CopilotQuickStats | undefined => {
    if (!isRecord(value)) return undefined;
    return {
      pendingReplies: getNumber(value.pendingReplies),
      activeAnomalies: getNumber(value.activeAnomalies),
      pendingPricing: getNumber(value.pendingPricing),
      activeMaintenanceAlerts: getNumber(value.activeMaintenanceAlerts),
      activeWeatherAlerts: getNumber(value.activeWeatherAlerts),
    };
  };

  const parseRecommendations = (value: unknown): CopilotRecommendation[] => {
    if (!Array.isArray(value)) return [];
    return value.reduce<CopilotRecommendation[]>((acc, item) => {
      if (!isRecord(item)) return acc;
      const adjustmentPercent = getNumber(item.adjustmentPercent);
      if (adjustmentPercent === undefined) return acc;
      acc.push({
        adjustmentPercent,
        siteClassName: getString(item.siteClassName),
        recommendationType: getString(item.recommendationType),
      });
      return acc;
    }, []);
  };

  const parseInsights = (value: unknown): CopilotInsight[] => {
    if (!Array.isArray(value)) return [];
    return value.reduce<CopilotInsight[]>((acc, item) => {
      if (!isRecord(item)) return acc;
      const title = getString(item.title);
      if (!title) return acc;
      acc.push({
        title,
        impactCents: getNumber(item.impactCents),
      });
      return acc;
    }, []);
  };

  const parseWeather = (value: unknown): CopilotWeather | undefined => {
    if (!isRecord(value)) return undefined;
    const temp = getNumber(value.temp);
    const feelsLike = getNumber(value.feelsLike);
    const description = getString(value.description);
    const windSpeed = getNumber(value.windSpeed);
    const humidity = getNumber(value.humidity);
    if (
      temp === undefined ||
      feelsLike === undefined ||
      !description ||
      windSpeed === undefined ||
      humidity === undefined
    ) {
      return undefined;
    }
    return { temp, feelsLike, description, windSpeed, humidity };
  };

  const parseAlerts = (value: unknown): CopilotAlert[] => {
    if (!Array.isArray(value)) return [];
    return value.reduce<CopilotAlert[]>((acc, item) => {
      if (!isRecord(item)) return acc;
      const title = getString(item.title);
      const severity = getString(item.severity);
      if (!title || !severity) return acc;
      acc.push({ title, severity });
      return acc;
    }, []);
  };

  const parseSummary = (value: unknown): CopilotSummary | undefined => {
    if (!isRecord(value)) return undefined;
    return {
      activeAlerts: getNumber(value.activeAlerts),
    };
  };

  const parseActions = (value: unknown): CopilotAction[] => {
    if (!Array.isArray(value)) return [];
    return value.reduce<CopilotAction[]>((acc, item) => {
      if (!isRecord(item)) return acc;
      const action = getString(item.action);
      const description = getString(item.description);
      if (!action || !description) return acc;
      acc.push({ action, description });
      return acc;
    }, []);
  };

  const parseCopilotResponse = (value: unknown): CopilotResponse => {
    if (!isRecord(value)) return {};
    return {
      error: getString(value.error),
      message: getString(value.message),
      preview: getString(value.preview),
      metrics: parseMetrics(value.metrics),
      quickStats: parseQuickStats(value.quickStats),
      recommendations: parseRecommendations(value.recommendations),
      insights: parseInsights(value.insights),
      weather: parseWeather(value.weather),
      alerts: parseAlerts(value.alerts),
      summary: parseSummary(value.summary),
      availableActions: parseActions(value.availableActions),
    };
  };

  // Format copilot response for display
  const formatCopilotResponse = (data: unknown): string => {
    const parsed = parseCopilotResponse(data);
    if (parsed.error) {
      return `Error: ${parsed.error}`;
    }

    let response = parsed.message || parsed.preview || "";

    // Add metrics summary if present
    if (parsed.metrics) {
      const m = parsed.metrics;
      response += `\n\n**AI Performance (Last 30 Days)**\n`;
      response += `- Messages Handled: ${m.messagesHandled || 0}\n`;
      response += `- No-Shows Prevented: ${m.noShowsPrevented || 0}\n`;
      response += `- Revenue Saved: $${((m.estimatedRevenueSavedCents || 0) / 100).toLocaleString()}\n`;
      response += `- ROI: ${m.roiPercent || 0}%`;
    }

    // Add quick stats if present
    if (parsed.quickStats) {
      const q = parsed.quickStats;
      const pendingReplies = q.pendingReplies ?? 0;
      const activeAnomalies = q.activeAnomalies ?? 0;
      const pendingPricing = q.pendingPricing ?? 0;
      const activeMaintenanceAlerts = q.activeMaintenanceAlerts ?? 0;
      const activeWeatherAlerts = q.activeWeatherAlerts ?? 0;
      if (
        pendingReplies > 0 ||
        activeAnomalies > 0 ||
        pendingPricing > 0 ||
        activeMaintenanceAlerts > 0 ||
        activeWeatherAlerts > 0
      ) {
        response += `\n\n**Needs Attention**\n`;
        if (pendingReplies > 0) response += `- ${pendingReplies} pending replies\n`;
        if (activeAnomalies > 0) response += `- ${activeAnomalies} anomalies\n`;
        if (pendingPricing > 0) response += `- ${pendingPricing} pricing recommendations\n`;
        if (activeMaintenanceAlerts > 0)
          response += `- ${activeMaintenanceAlerts} maintenance alerts\n`;
        if (activeWeatherAlerts > 0) response += `- ${activeWeatherAlerts} weather alerts`;
      }
    }

    // Add recommendations summary if present
    if (parsed.recommendations && parsed.recommendations.length > 0) {
      response += `\n\n**Recommendations (${parsed.recommendations.length})**\n`;
      parsed.recommendations.slice(0, 3).forEach((r, i) => {
        const change =
          r.adjustmentPercent > 0 ? `+${r.adjustmentPercent}%` : `${r.adjustmentPercent}%`;
        response += `${i + 1}. ${r.siteClassName || "Sites"}: ${change} (${r.recommendationType})\n`;
      });
    }

    // Add insights summary if present
    if (parsed.insights && parsed.insights.length > 0) {
      response += `\n\n**Revenue Insights (${parsed.insights.length})**\n`;
      parsed.insights.slice(0, 3).forEach((insight, idx) => {
        const impact = insight.impactCents
          ? `$${(insight.impactCents / 100).toLocaleString()}`
          : "TBD";
        response += `${idx + 1}. ${insight.title} (${impact})\n`;
      });
    }

    // Add weather if present
    if (parsed.weather) {
      const w = parsed.weather;
      response += `\n\n**Current Weather**\n`;
      response += `- Temperature: ${w.temp}°F (feels like ${w.feelsLike}°F)\n`;
      response += `- Conditions: ${w.description}\n`;
      response += `- Wind: ${w.windSpeed} mph\n`;
      response += `- Humidity: ${w.humidity}%`;
    }

    // Add maintenance alerts if present
    if (parsed.alerts && parsed.alerts.length > 0 && parsed.summary?.activeAlerts !== undefined) {
      response += `\n\n**Maintenance Alerts (${parsed.alerts.length})**\n`;
      parsed.alerts.slice(0, 3).forEach((alert, i) => {
        response += `${i + 1}. ${alert.title} (${alert.severity})\n`;
      });
    }

    // Add available actions if help
    if (parsed.availableActions && parsed.availableActions.length > 0) {
      response += `\n\n**Available Actions**\n`;
      parsed.availableActions.forEach((action) => {
        response += `- \`${action.action}\`: ${action.description}\n`;
      });
    }

    return response || "I processed your request. What else can I help with?";
  };

  // Chat mutation using the copilot endpoint
  const chatMutation = useMutation({
    mutationFn: (payload: {
      message: string;
      history: { role: "user" | "assistant"; content: string }[];
    }) => {
      const cleanMessage = payload.message.trim();

      // If it looks like a copilot action, send as action
      if (isActionCommand(cleanMessage)) {
        return apiClient.runCopilot({
          campgroundId: campgroundId!,
          action: cleanMessage.toLowerCase(),
          payload: {},
        });
      }

      // Otherwise, send as chat
      return apiClient.runCopilot({
        campgroundId: campgroundId!,
        action: "chat",
        prompt: cleanMessage,
        payload: { history: payload.history },
      });
    },
    onSuccess: (data) => {
      const responseContent = formatCopilotResponse(data);
      const assistantMessage: Message = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: responseContent,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    },
    onError: (error) => {
      console.error("AI chat failed:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}`,
          role: "assistant",
          content: "I'm having trouble connecting right now. Please try again in a moment.",
          timestamp: new Date(),
        },
      ]);
    },
  });

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || chatMutation.isPending || !campgroundId) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    chatMutation.mutate({ message: trimmed, history });
    setInput("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (prompt: string) => {
    setInput(prompt);
  };

  const quickActions: QuickAction[] = [
    {
      id: "dashboard",
      label: "AI Dashboard",
      icon: <Activity className="h-4 w-4" />,
      prompt: "get_ai_dashboard",
      description: "Get full AI status & metrics",
    },
    {
      id: "pricing-recommendations",
      label: "Pricing AI",
      icon: <DollarSign className="h-4 w-4" />,
      prompt: "get_pricing_recommendations",
      description: "View pricing recommendations",
    },
    {
      id: "revenue",
      label: "Revenue Insights",
      icon: <TrendingUp className="h-4 w-4" />,
      prompt: "get_revenue_insights",
      description: "Find missed revenue opportunities",
    },
    {
      id: "weather",
      label: "Weather",
      icon: <CloudRain className="h-4 w-4" />,
      prompt: "get_weather",
      description: "Check current conditions & alerts",
    },
    {
      id: "maintenance",
      label: "Maintenance",
      icon: <Wrench className="h-4 w-4" />,
      prompt: "get_maintenance_alerts",
      description: "View predictive maintenance alerts",
    },
    {
      id: "draft-reply",
      label: "Draft Reply",
      icon: <Send className="h-4 w-4" />,
      prompt: "Draft a friendly reply to a guest asking about late checkout options",
      description: "Generate professional guest responses",
    },
  ];

  if (!campgroundId) {
    return (
      <DashboardShell>
        <motion.div
          className="flex min-h-[60vh] items-center justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_CONFIG}
        >
          <Card className="max-w-lg border-slate-200 bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-600" />
                AI Assistant
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Select a campground to start using your AI assistant.</p>
              <p className="text-xs text-muted-foreground">
                The AI can help with guest replies, pricing suggestions, occupancy insights, and
                more.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <motion.div
        className="space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={SPRING_CONFIG}
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_CONFIG}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/ai">
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Back">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-status-success-bg text-status-success-text border border-status-success-border shadow-sm">
                <Brain className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">AI Chat</h1>
                <p className="text-sm text-muted-foreground">
                  Your intelligent assistant for {campground?.name}
                </p>
              </div>
            </div>
            {campground && (
              <Badge variant="outline" className="text-sm">
                {campground.name}
              </Badge>
            )}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_CONFIG, delay: 0.05 }}
        >
          <Card className="border-border bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Quick Actions</CardTitle>
              <CardDescription>Get started with common tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {quickActions.map((action) => (
                  <motion.button
                    key={action.id}
                    type="button"
                    onClick={() => handleQuickAction(action.prompt)}
                    className={cn(
                      "flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-4 text-left transition-all",
                      "hover:border-status-success-border hover:bg-status-success-bg hover:shadow-md",
                      "focus:outline-none focus:ring-2 focus:ring-action-primary/20 focus:border-action-primary",
                    )}
                    whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-status-success/15 text-status-success">
                        {action.icon}
                      </div>
                      <span className="font-semibold text-foreground">{action.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{action.description}</p>
                  </motion.button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Chat Interface */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_CONFIG, delay: 0.1 }}
        >
          <Card className="border-border bg-card/80 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Conversation</CardTitle>
              <CardDescription>Chat with your AI assistant</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Messages */}
              <div className="h-[500px] overflow-y-auto rounded-xl border border-border bg-background p-4">
                <div className="space-y-4">
                  {messages.length === 0 && (
                    <div className="rounded-lg border border-dashed border-border bg-muted px-4 py-8 text-center text-sm text-muted-foreground">
                      <Sparkles className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                      <p>Start a conversation with your AI assistant</p>
                      <p className="text-xs mt-1">
                        Try asking about pricing, occupancy, or drafting a guest reply
                      </p>
                    </div>
                  )}

                  {messages.map((msg, index) => (
                    <motion.div
                      key={msg.id}
                      className={cn(
                        "flex gap-3",
                        msg.role === "user" ? "justify-end" : "justify-start",
                      )}
                      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 10 }}
                      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                      transition={
                        prefersReducedMotion ? undefined : { delay: index * 0.05, ...SPRING_CONFIG }
                      }
                    >
                      {msg.role === "assistant" && (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-status-success-bg border border-status-success-border flex-shrink-0">
                          <Bot className="h-4 w-4 text-status-success-text" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                          msg.role === "user"
                            ? "bg-action-primary text-action-primary-foreground"
                            : "bg-muted text-foreground border border-border",
                        )}
                      >
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        <div
                          className={cn(
                            "mt-2 text-[10px]",
                            msg.role === "user" ? "text-emerald-100" : "text-muted-foreground",
                          )}
                        >
                          {msg.timestamp.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                      {msg.role === "user" && (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted flex-shrink-0">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </motion.div>
                  ))}

                  {chatMutation.isPending && (
                    <motion.div
                      className="flex gap-3 justify-start"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-status-success-bg border border-status-success-border">
                        <Bot className="h-4 w-4 text-status-success-text" />
                      </div>
                      <div className="rounded-2xl bg-muted border border-border px-4 py-3 shadow-sm">
                        <div className="flex gap-1">
                          <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" />
                          <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.1s]" />
                          <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.2s]" />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="rounded-xl border border-border bg-muted p-3 shadow-sm">
                <Textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything about your campground, guests, pricing, or operations..."
                  className="min-h-[100px] bg-background border-border focus:border-action-primary focus:ring-action-primary/20"
                  disabled={chatMutation.isPending}
                />
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Press Enter to send, Shift+Enter for new line
                  </span>
                  <Button
                    size="sm"
                    className="gap-2 bg-action-primary text-action-primary-foreground hover:bg-action-primary-hover shadow-sm"
                    onClick={handleSend}
                    disabled={!input.trim() || chatMutation.isPending}
                  >
                    Send
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </DashboardShell>
  );
}
