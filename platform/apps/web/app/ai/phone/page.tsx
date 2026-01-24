"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiClient } from "@/lib/api-client";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Phone,
  PhoneCall,
  PhoneForwarded,
  PhoneMissed,
  PhoneOff,
  ArrowLeft,
  Sparkles,
  Clock,
  User,
  MessageSquare,
  Settings,
  Play,
  Pause,
  Volume2,
  Mic,
  Bot,
  CheckCircle2,
  XCircle,
  Calendar,
  DollarSign,
} from "lucide-react";
import { format, formatDistanceToNow, formatDuration, intervalToDuration } from "date-fns";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

const SPRING_CONFIG: { type: "spring"; stiffness: number; damping: number } = {
  type: "spring",
  stiffness: 300,
  damping: 25,
};

type PhoneSession = Awaited<ReturnType<typeof apiClient.getPhoneSessions>>[number] & {
  twilioCallSid?: string;
  guestId?: string;
  guestName?: string;
  reservationId?: string;
  transcript?: string;
  actionsPerformed?: Record<string, unknown>;
  transferredAt?: string;
  transferReason?: string;
  tokensUsed?: number;
  costCents?: number;
};

type PhoneSummary = Awaited<ReturnType<typeof apiClient.getPhoneSummary>> & {
  topIntents?: Array<{ name: string; count: number }>;
};

type AutopilotConfig = Awaited<ReturnType<typeof apiClient.getAutopilotConfig>> & {
  phoneAgentEnabled?: boolean;
  phoneAgentNumber?: string;
  phoneAgentHoursStart?: string;
  phoneAgentHoursEnd?: string;
};

function getStatusIcon(status: string) {
  switch (status) {
    case "in_progress":
      return PhoneCall;
    case "completed":
      return CheckCircle2;
    case "transferred":
      return PhoneForwarded;
    default:
      return Phone;
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "in_progress":
      return "text-status-success-text bg-status-success-bg border border-status-success-border";
    case "completed":
      return "text-status-info-text bg-status-info-bg border border-status-info-border";
    case "transferred":
      return "text-status-warning-text bg-status-warning-bg border border-status-warning-border";
    default:
      return "text-muted-foreground bg-muted border border-border";
  }
}

function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

export default function AIPhonePage() {
  const [activeTab, setActiveTab] = useState("calls");
  const [selectedSession, setSelectedSession] = useState<PhoneSession | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get campground
  const { data: campgrounds = [] } = useQuery<Awaited<ReturnType<typeof apiClient.getCampgrounds>>>(
    {
      queryKey: ["campgrounds"],
      queryFn: () => apiClient.getCampgrounds(),
    },
  );
  const campground = campgrounds[0];

  // Get phone sessions
  const {
    data: sessions = [],
    isLoading: loadingSessions,
    refetch,
  } = useQuery<PhoneSession[]>({
    queryKey: ["phone-sessions", campground?.id],
    queryFn: () => apiClient.getPhoneSessions(campground!.id),
    enabled: !!campground?.id,
    refetchInterval: 10000,
  });

  // Get phone summary
  const { data: summary, isLoading: loadingSummary } = useQuery<PhoneSummary>({
    queryKey: ["phone-summary", campground?.id],
    queryFn: () => apiClient.getPhoneSummary(campground!.id),
    enabled: !!campground?.id,
  });

  // Get autopilot config
  const { data: autopilotConfig, refetch: refetchConfig } = useQuery<AutopilotConfig>({
    queryKey: ["ai-autopilot-config", campground?.id],
    queryFn: () => apiClient.getAutopilotConfig(campground!.id),
    enabled: !!campground?.id,
  });

  const activeCalls = sessions.filter((s) => s.status === "in_progress");
  const completedCalls = sessions.filter((s) => s.status !== "in_progress");
  const totalCalls = sessions.length;
  const avgDuration =
    completedCalls.length > 0
      ? Math.round(
          completedCalls.reduce((acc, s) => acc + (s.durationSeconds || 0), 0) /
            completedCalls.length,
        )
      : 0;

  if (!campground) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Phone className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h2 className="text-2xl font-bold text-foreground mb-2">No Campground Selected</h2>
            <p className="text-muted-foreground">Select a campground to view phone agent</p>
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
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-sm">
              <Phone className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">AI Phone Agent</h1>
              <p className="text-sm text-muted-foreground">
                24/7 automated call handling powered by AI
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {autopilotConfig?.phoneAgentEnabled ? (
              <Badge
                variant="default"
                className="gap-1 bg-status-success text-status-success-foreground"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                Active
              </Badge>
            ) : (
              <Badge variant="secondary">Disabled</Badge>
            )}
            <Link href="/ai/settings">
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="h-4 w-4" />
                Configure
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Phone Agent Status Banner */}
        {autopilotConfig?.phoneAgentEnabled && autopilotConfig?.phoneAgentNumber && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_CONFIG, delay: 0.05 }}
          >
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-card border border-border flex items-center justify-center">
                      <Bot className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">AI Phone Agent Active</p>
                      <p className="text-sm text-muted-foreground">
                        Answering calls at{" "}
                        <span className="font-mono font-semibold text-primary">
                          {formatPhoneNumber(autopilotConfig.phoneAgentNumber)}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    {autopilotConfig.phoneAgentHoursStart && autopilotConfig.phoneAgentHoursEnd && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {autopilotConfig.phoneAgentHoursStart} -{" "}
                          {autopilotConfig.phoneAgentHoursEnd}
                        </span>
                      </div>
                    )}
                    {activeCalls.length > 0 && (
                      <Badge
                        variant="default"
                        className="bg-status-success text-status-success-foreground animate-pulse"
                      >
                        {activeCalls.length} Active Call{activeCalls.length > 1 ? "s" : ""}
                      </Badge>
                    )}
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
              <div className="flex items-center justify-between mb-2">
                <PhoneCall className="h-5 w-5 text-primary" />
                <Badge variant="outline" className="text-xs">
                  Today
                </Badge>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {loadingSummary ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  summary?.totalCalls || 0
                )}
              </div>
              <p className="text-xs text-muted-foreground">Total Calls</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle2 className="h-5 w-5 text-status-success-text" />
              </div>
              <div className="text-2xl font-bold text-foreground">
                {loadingSummary ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  summary?.callsHandled || 0
                )}
              </div>
              <p className="text-xs text-muted-foreground">Resolved by AI</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Clock className="h-5 w-5 text-status-info-text" />
              </div>
              <div className="text-2xl font-bold text-foreground">
                {avgDuration > 0
                  ? `${Math.floor(avgDuration / 60)}:${(avgDuration % 60).toString().padStart(2, "0")}`
                  : "0:00"}
              </div>
              <p className="text-xs text-muted-foreground">Avg. Duration</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="h-5 w-5 text-status-warning-text" />
              </div>
              <div className="text-2xl font-bold text-foreground">
                ${((summary?.totalCostCents || 0) / 100).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">AI Cost Today</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="calls" className="gap-2">
              <PhoneCall className="h-4 w-4" />
              Call History
              {activeCalls.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 bg-status-success text-status-success-foreground"
                >
                  {activeCalls.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calls" className="space-y-4">
            {loadingSessions ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : sessions.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <Phone className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">No Calls Yet</h3>
                    <p className="text-sm text-muted-foreground">
                      {autopilotConfig?.phoneAgentEnabled
                        ? "Incoming calls will appear here when your AI agent handles them."
                        : "Enable the AI Phone Agent to start handling calls automatically."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                <AnimatePresence mode="popLayout">
                  {sessions.map((session, index) => {
                    const StatusIcon = getStatusIcon(session.status);
                    const statusColor = getStatusColor(session.status);

                    return (
                      <motion.div
                        key={session.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ delay: index * 0.02, ...SPRING_CONFIG }}
                      >
                        <Card
                          className={cn(
                            "cursor-pointer transition-all hover:shadow-md",
                            selectedSession?.id === session.id && "ring-2 ring-primary",
                            session.status === "in_progress" &&
                              "border-l-4 border-l-status-success",
                          )}
                          onClick={() => setSelectedSession(session)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center gap-4">
                              <div
                                className={cn(
                                  "flex h-10 w-10 items-center justify-center rounded-full",
                                  statusColor,
                                )}
                              >
                                <StatusIcon className="h-5 w-5" />
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold text-foreground">
                                    {formatPhoneNumber(session.callerPhone)}
                                  </span>
                                  {session.guestName && (
                                    <Badge variant="outline" className="text-xs">
                                      {session.guestName}
                                    </Badge>
                                  )}
                                  <Badge variant="secondary" className="text-xs capitalize">
                                    {session.status.replace("_", " ")}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {session.summary || "Call in progress..."}
                                </p>
                                {session.intents.length > 0 && (
                                  <div className="flex gap-1 mt-2">
                                    {session.intents.slice(0, 3).map((intent, i) => (
                                      <Badge key={i} variant="outline" className="text-xs">
                                        {intent}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="text-right flex-shrink-0">
                                <p className="text-sm font-medium text-foreground">
                                  {session.durationSeconds
                                    ? `${Math.floor(session.durationSeconds / 60)}:${(session.durationSeconds % 60).toString().padStart(2, "0")}`
                                    : session.status === "in_progress"
                                      ? "Live"
                                      : "--:--"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(session.startedAt), {
                                    addSuffix: true,
                                  })}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>

          <TabsContent value="analytics">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Common Intents</CardTitle>
                  <CardDescription>What callers are asking about</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {summary?.topIntents && summary.topIntents.length > 0 ? (
                      summary.topIntents.map(
                        (intent: { name: string; count: number }, i: number) => (
                          <div key={i} className="flex items-center justify-between">
                            <span className="text-sm text-foreground">{intent.name}</span>
                            <Badge variant="secondary">{intent.count}</Badge>
                          </div>
                        ),
                      )
                    ) : (
                      <p className="text-sm text-muted-foreground">No data yet</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Resolution Rate</CardTitle>
                  <CardDescription>Calls resolved without transfer</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-foreground">
                        {summary?.resolutionRate
                          ? `${Math.round(summary.resolutionRate * 100)}%`
                          : "N/A"}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        {summary?.callsHandled || 0} of {summary?.totalCalls || 0} calls
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Selected Session Detail */}
        {selectedSession && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SPRING_CONFIG}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    Call Details
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedSession(null)}>
                    Close
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Caller</p>
                    <p className="font-medium">{formatPhoneNumber(selectedSession.callerPhone)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Duration</p>
                    <p className="font-medium">
                      {selectedSession.durationSeconds
                        ? `${Math.floor(selectedSession.durationSeconds / 60)}:${(selectedSession.durationSeconds % 60).toString().padStart(2, "0")}`
                        : "In progress"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge variant="secondary" className="capitalize">
                      {selectedSession.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">AI Cost</p>
                    <p className="font-medium">
                      ${((selectedSession.costCents || 0) / 100).toFixed(2)}
                    </p>
                  </div>
                </div>

                {selectedSession.summary && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Summary</p>
                    <p className="text-sm text-foreground">{selectedSession.summary}</p>
                  </div>
                )}

                {selectedSession.transcript && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Transcript</p>
                    <div className="bg-muted rounded-lg p-4 max-h-60 overflow-y-auto">
                      <pre className="text-sm whitespace-pre-wrap font-mono">
                        {selectedSession.transcript}
                      </pre>
                    </div>
                  </div>
                )}

                {selectedSession.transferReason && (
                  <div className="p-3 bg-status-warning-bg rounded-lg border border-status-warning-border">
                    <p className="text-xs text-status-warning-text font-medium mb-1">
                      Transferred to Staff
                    </p>
                    <p className="text-sm text-status-warning-text">
                      {selectedSession.transferReason}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </DashboardShell>
  );
}
