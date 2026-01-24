"use client";

import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Brain,
  MessageSquare,
  AlertTriangle,
  Users,
  Calendar,
  Settings,
  FileText,
  Mail,
  RefreshCw,
  Check,
  X,
  Send,
  ChevronRight,
  Sparkles,
  TrendingDown,
  Clock,
  Edit2,
  Trash2,
  Plus,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";

type AutopilotConfig = Awaited<ReturnType<typeof apiClient.getAutopilotConfig>>;
type AutopilotContextItem = Awaited<ReturnType<typeof apiClient.getAutopilotContext>>[number];
type ReplyDraft = Awaited<ReturnType<typeof apiClient.getReplyDrafts>>[number];
type AnomalyAlert = Awaited<ReturnType<typeof apiClient.getAnomalyAlerts>>[number];
type NoShowRisk = Awaited<ReturnType<typeof apiClient.getNoShowRisks>>[number];
type CreateContextPayload = Parameters<typeof apiClient.createAutopilotContext>[1];
type ReviewDraftPayload = {
  id: string;
  action: "approve" | "edit" | "reject";
  content?: string;
  reason?: string;
};
type AnomalyUpdatePayload = {
  id: string;
  status: Parameters<typeof apiClient.updateAnomalyStatus>[1];
};

export default function AiAutopilotPage() {
  const params = useParams<{ campgroundId: string }>();
  const campgroundId = params.campgroundId;
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("settings");
  const [editingContext, setEditingContext] = useState<AutopilotContextItem | null>(null);
  const [showContextForm, setShowContextForm] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState<ReplyDraft | null>(null);

  // Fetch autopilot config
  const { data: config, isLoading: configLoading } = useQuery<AutopilotConfig>({
    queryKey: ["autopilot-config", campgroundId],
    queryFn: () => apiClient.getAutopilotConfig(campgroundId),
    enabled: !!campgroundId,
  });

  // Fetch context items
  const { data: contextItems } = useQuery<AutopilotContextItem[]>({
    queryKey: ["autopilot-context", campgroundId],
    queryFn: () => apiClient.getAutopilotContext(campgroundId),
    enabled: !!campgroundId && activeTab === "context",
  });

  // Fetch reply drafts
  const { data: replyDrafts } = useQuery<ReplyDraft[]>({
    queryKey: ["reply-drafts", campgroundId],
    queryFn: () => apiClient.getReplyDrafts(campgroundId),
    enabled: !!campgroundId && activeTab === "drafts",
  });

  // Fetch anomalies
  const { data: anomalies } = useQuery<AnomalyAlert[]>({
    queryKey: ["anomalies", campgroundId],
    queryFn: () => apiClient.getAnomalyAlerts(campgroundId),
    enabled: !!campgroundId && activeTab === "anomalies",
  });

  // Fetch no-show risks
  const { data: noShowRisks } = useQuery<NoShowRisk[]>({
    queryKey: ["no-show-risks", campgroundId],
    queryFn: () => apiClient.getNoShowRisks(campgroundId, true, 14),
    enabled: !!campgroundId && activeTab === "no-shows",
  });

  // Mutations
  const updateConfig = useMutation({
    mutationFn: (updates: Record<string, unknown>) =>
      apiClient.updateAutopilotConfig(campgroundId, updates),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["autopilot-config", campgroundId] }),
  });

  const autoPopulate = useMutation({
    mutationFn: () => apiClient.autoPopulateContext(campgroundId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["autopilot-context", campgroundId] }),
  });

  const createContext = useMutation({
    mutationFn: (data: CreateContextPayload) =>
      apiClient.createAutopilotContext(campgroundId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["autopilot-context", campgroundId] });
      setShowContextForm(false);
    },
  });

  const deleteContext = useMutation({
    mutationFn: (id: string) => apiClient.deleteAutopilotContext(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["autopilot-context", campgroundId] }),
  });

  const reviewDraft = useMutation({
    mutationFn: ({ id, action, content, reason }: ReviewDraftPayload) =>
      apiClient.reviewReplyDraft(id, action, content, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reply-drafts", campgroundId] });
      setSelectedDraft(null);
    },
  });

  const sendDraft = useMutation({
    mutationFn: (id: string) => apiClient.sendReplyDraft(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reply-drafts", campgroundId] }),
  });

  const updateAnomaly = useMutation({
    mutationFn: ({ id, status }: AnomalyUpdatePayload) => apiClient.updateAnomalyStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["anomalies", campgroundId] }),
  });

  const sendReminder = useMutation({
    mutationFn: (reservationId: string) => apiClient.sendNoShowReminder(reservationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["no-show-risks", campgroundId] }),
  });

  const markConfirmed = useMutation({
    mutationFn: (reservationId: string) =>
      apiClient.markNoShowConfirmed(reservationId, "staff_verification"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["no-show-risks", campgroundId] }),
  });

  const getEditedContent = () => {
    const element = document.getElementById("editedContent");
    return element instanceof HTMLTextAreaElement ? element.value : undefined;
  };

  if (configLoading) {
    return (
      <DashboardShell>
        <div className="p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </div>
      </DashboardShell>
    );
  }

  const severityColors: Record<string, string> = {
    critical: "bg-status-error/15 text-status-error",
    high: "bg-status-warning/15 text-status-warning",
    medium: "bg-status-warning/15 text-status-warning",
    low: "bg-status-info/15 text-status-info",
  };

  return (
    <DashboardShell>
      <div className="p-8 space-y-6">
        <Breadcrumbs
          items={[
            { label: "Campgrounds", href: "/campgrounds" },
            { label: "AI", href: `/campgrounds/${campgroundId}/ai` },
            { label: "Autopilot" },
          ]}
        />

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Brain className="w-7 h-7 text-purple-600" />
              AI Autopilot
            </h1>
            <p className="text-muted-foreground mt-1">
              Automated AI-powered features for your campground
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="context" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Context
            </TabsTrigger>
            <TabsTrigger value="drafts" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Drafts
              {replyDrafts?.filter((d) => d.status === "pending").length ? (
                <Badge variant="secondary" className="ml-1">
                  {replyDrafts.filter((d) => d.status === "pending").length}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="anomalies" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Anomalies
              {anomalies?.filter((a) => a.status === "new").length ? (
                <Badge variant="destructive" className="ml-1">
                  {anomalies.filter((a) => a.status === "new").length}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="no-shows" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              No-Shows
              {noShowRisks?.filter((r) => r.flagged && !r.guestConfirmed).length ? (
                <Badge variant="outline" className="ml-1 border-orange-300 text-orange-700">
                  {noShowRisks.filter((r) => r.flagged && !r.guestConfirmed).length}
                </Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Auto-Reply Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-blue-600" />
                      <CardTitle className="text-lg">Auto-Reply</CardTitle>
                    </div>
                    <Switch
                      checked={config?.autoReplyEnabled}
                      onCheckedChange={(checked) =>
                        updateConfig.mutate({ autoReplyEnabled: checked })
                      }
                    />
                  </div>
                  <CardDescription>AI drafts responses to guest messages</CardDescription>
                </CardHeader>
                {config?.autoReplyEnabled && (
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Mode</Label>
                      <Select
                        value={config?.autoReplyMode}
                        onValueChange={(v) => updateConfig.mutate({ autoReplyMode: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft Only</SelectItem>
                          <SelectItem value="auto">Auto-Send</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {config?.autoReplyMode === "auto" && (
                      <>
                        <div className="space-y-2">
                          <Label>
                            Confidence Threshold:{" "}
                            {Math.round((config?.autoReplyConfidenceThreshold || 0.8) * 100)}%
                          </Label>
                          <Slider
                            value={[config?.autoReplyConfidenceThreshold || 0.8]}
                            min={0.5}
                            max={1}
                            step={0.05}
                            onValueChange={([v]) =>
                              updateConfig.mutate({ autoReplyConfidenceThreshold: v })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Delay Before Sending (minutes)</Label>
                          <Input
                            type="number"
                            min={0}
                            max={60}
                            value={config?.autoReplyDelayMinutes}
                            onChange={(e) =>
                              updateConfig.mutate({
                                autoReplyDelayMinutes: parseInt(e.target.value),
                              })
                            }
                          />
                        </div>
                      </>
                    )}
                  </CardContent>
                )}
              </Card>

              {/* Smart Waitlist Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-green-600" />
                      <CardTitle className="text-lg">Smart Waitlist</CardTitle>
                    </div>
                    <Switch
                      checked={config?.smartWaitlistEnabled}
                      onCheckedChange={(checked) =>
                        updateConfig.mutate({ smartWaitlistEnabled: checked })
                      }
                    />
                  </div>
                  <CardDescription>AI scores waitlist entries for optimal matching</CardDescription>
                </CardHeader>
                {config?.smartWaitlistEnabled && (
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Mode</Label>
                      <Select
                        value={config?.smartWaitlistMode}
                        onValueChange={(v) => updateConfig.mutate({ smartWaitlistMode: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="suggest">Suggest Only</SelectItem>
                          <SelectItem value="auto">Auto-Offer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>Scoring Weights:</p>
                      <p>
                        Guest Value: {Math.round((config?.waitlistGuestValueWeight || 0.3) * 100)}%
                      </p>
                      <p>
                        Booking Likelihood:{" "}
                        {Math.round((config?.waitlistLikelihoodWeight || 0.3) * 100)}%
                      </p>
                      <p>
                        Seasonal Fit: {Math.round((config?.waitlistSeasonalWeight || 0.2) * 100)}%
                      </p>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Anomaly Detection Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-orange-600" />
                      <CardTitle className="text-lg">Anomaly Detection</CardTitle>
                    </div>
                    <Switch
                      checked={config?.anomalyDetectionEnabled}
                      onCheckedChange={(checked) =>
                        updateConfig.mutate({ anomalyDetectionEnabled: checked })
                      }
                    />
                  </div>
                  <CardDescription>AI alerts when metrics deviate from patterns</CardDescription>
                </CardHeader>
                {config?.anomalyDetectionEnabled && (
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Alert Mode</Label>
                      <Select
                        value={config?.anomalyAlertMode}
                        onValueChange={(v) => updateConfig.mutate({ anomalyAlertMode: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="realtime">Real-time</SelectItem>
                          <SelectItem value="digest">Daily Digest</SelectItem>
                          <SelectItem value="both">Both</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Sensitivity</Label>
                      <Select
                        value={config?.anomalySensitivity}
                        onValueChange={(v) => updateConfig.mutate({ anomalySensitivity: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low (Critical & High only)</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High (All alerts)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* No-Show Prediction Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-purple-600" />
                      <CardTitle className="text-lg">No-Show Prediction</CardTitle>
                    </div>
                    <Switch
                      checked={config?.noShowPredictionEnabled}
                      onCheckedChange={(checked) =>
                        updateConfig.mutate({ noShowPredictionEnabled: checked })
                      }
                    />
                  </div>
                  <CardDescription>AI flags high-risk reservations</CardDescription>
                </CardHeader>
                {config?.noShowPredictionEnabled && (
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>
                        Risk Threshold: {Math.round((config?.noShowThreshold || 0.7) * 100)}%
                      </Label>
                      <Slider
                        value={[config?.noShowThreshold || 0.7]}
                        min={0.3}
                        max={0.9}
                        step={0.05}
                        onValueChange={([v]) => updateConfig.mutate({ noShowThreshold: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Auto-Send Reminders</Label>
                      <Switch
                        checked={config?.noShowAutoReminder}
                        onCheckedChange={(checked) =>
                          updateConfig.mutate({ noShowAutoReminder: checked })
                        }
                      />
                    </div>
                    {config?.noShowAutoReminder && (
                      <div className="space-y-2">
                        <Label>Days Before Arrival</Label>
                        <Input
                          type="number"
                          min={1}
                          max={14}
                          value={config?.noShowReminderDaysBefore}
                          onChange={(e) =>
                            updateConfig.mutate({
                              noShowReminderDaysBefore: parseInt(e.target.value),
                            })
                          }
                        />
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            </div>
          </TabsContent>

          {/* Context Tab */}
          <TabsContent value="context" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground">
                Train AI with your campground&apos;s FAQs, policies, and example responses
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => autoPopulate.mutate()}
                  disabled={autoPopulate.isPending}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Auto-Populate from Settings
                </Button>
                <Button onClick={() => setShowContextForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Context
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {contextItems?.map((item) => (
                <Card key={item.id} className="group">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">{item.type}</Badge>
                          {item.category && <Badge variant="secondary">{item.category}</Badge>}
                          {!item.isActive && <Badge variant="destructive">Inactive</Badge>}
                        </div>
                        {item.question && (
                          <p className="font-medium text-sm mb-1">Q: {item.question}</p>
                        )}
                        <p className="text-sm text-muted-foreground line-clamp-2">{item.answer}</p>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setEditingContext(item)}
                          aria-label="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-red-600"
                          onClick={() => deleteContext.mutate(item.id)}
                          aria-label="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {contextItems?.length === 0 && (
                <Card className="border-dashed">
                  <CardContent className="py-12 text-center">
                    <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No context items yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Add FAQs and policies to help AI respond accurately
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Drafts Tab */}
          <TabsContent value="drafts" className="space-y-4">
            <div className="space-y-3">
              {replyDrafts?.map((draft) => (
                <Card
                  key={draft.id}
                  className={cn(draft.status === "pending" && "bg-status-info/15")}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge
                            variant={
                              draft.status === "pending"
                                ? "default"
                                : draft.status === "approved" || draft.status === "sent"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {draft.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(draft.createdAt), { addSuffix: true })}
                          </span>
                          {draft.autoSendScheduledAt && draft.status === "pending" && (
                            <span className="text-xs text-orange-600 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Auto-send{" "}
                              {formatDistanceToNow(new Date(draft.autoSendScheduledAt), {
                                addSuffix: true,
                              })}
                            </span>
                          )}
                        </div>
                        <p className="font-medium text-sm mb-1">
                          {draft.inboundSubject || "No subject"}
                        </p>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {draft.draftContent}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>Confidence: {Math.round(draft.confidence * 100)}%</span>
                          {draft.detectedIntent && <span>Intent: {draft.detectedIntent}</span>}
                        </div>
                      </div>
                      {draft.status === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedDraft(draft)}
                          >
                            <Edit2 className="w-4 h-4 mr-1" />
                            Review
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => sendDraft.mutate(draft.id)}
                            disabled={sendDraft.isPending}
                          >
                            <Send className="w-4 h-4 mr-1" />
                            Send
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {replyDrafts?.length === 0 && (
                <Card className="border-dashed">
                  <CardContent className="py-12 text-center">
                    <Mail className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No reply drafts</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      AI will generate drafts when guests send messages
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Anomalies Tab */}
          <TabsContent value="anomalies" className="space-y-4">
            <div className="space-y-3">
              {anomalies?.map((anomaly) => (
                <Card
                  key={anomaly.id}
                  className={cn(
                    "border-l-4",
                    anomaly.severity === "critical" && "border-l-red-500",
                    anomaly.severity === "high" && "border-l-orange-500",
                    anomaly.severity === "medium" && "border-l-yellow-500",
                    anomaly.severity === "low" && "border-l-blue-500",
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={severityColors[anomaly.severity]}>
                            {anomaly.severity}
                          </Badge>
                          <Badge variant="outline">{anomaly.status}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(anomaly.detectedAt), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="font-medium mb-1">{anomaly.title}</p>
                        <p className="text-sm text-muted-foreground mb-2">{anomaly.summary}</p>
                        {anomaly.aiAnalysis && (
                          <p className="text-sm bg-purple-50 p-2 rounded border border-purple-100">
                            <Sparkles className="w-3 h-3 inline mr-1 text-purple-600" />
                            {anomaly.aiAnalysis}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>Metric: {anomaly.metric}</span>
                          <span>Current: {anomaly.currentValue}</span>
                          <span>Expected: {anomaly.expectedValue}</span>
                          <span
                            className={anomaly.deviation < 0 ? "text-red-600" : "text-green-600"}
                          >
                            {anomaly.deviation > 0 ? "+" : ""}
                            {anomaly.deviation.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      {anomaly.status === "new" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updateAnomaly.mutate({ id: anomaly.id, status: "acknowledged" })
                            }
                          >
                            Acknowledge
                          </Button>
                          <Button
                            size="sm"
                            onClick={() =>
                              updateAnomaly.mutate({ id: anomaly.id, status: "resolved" })
                            }
                          >
                            Resolve
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {anomalies?.length === 0 && (
                <Card className="border-dashed">
                  <CardContent className="py-12 text-center">
                    <Check className="w-12 h-12 mx-auto text-green-500 mb-4" />
                    <p className="text-muted-foreground">No anomalies detected</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your metrics are within normal ranges
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* No-Shows Tab */}
          <TabsContent value="no-shows" className="space-y-4">
            <div className="space-y-3">
              {noShowRisks?.map((risk) => (
                <Card
                  key={risk.id}
                  className={cn(risk.flagged && !risk.guestConfirmed && "bg-status-warning/15")}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge
                            variant={
                              risk.guestConfirmed
                                ? "secondary"
                                : risk.flagged
                                  ? "destructive"
                                  : "outline"
                            }
                          >
                            {risk.guestConfirmed
                              ? "Confirmed"
                              : risk.flagged
                                ? "High Risk"
                                : "Normal"}
                          </Badge>
                          <span className="text-lg font-semibold">
                            {Math.round(risk.riskScore * 100)}%
                          </span>
                          {risk.reminderSentAt && (
                            <span className="text-xs text-muted-foreground">
                              Reminder sent{" "}
                              {formatDistanceToNow(new Date(risk.reminderSentAt), {
                                addSuffix: true,
                              })}
                            </span>
                          )}
                        </div>
                        <p className="font-medium">
                          {risk.reservation.guest.primaryFirstName}{" "}
                          {risk.reservation.guest.primaryLastName}
                          <span className="text-muted-foreground font-normal ml-2">
                            #{risk.reservation.confirmationNumber}
                          </span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(risk.reservation.arrivalDate), "MMM d, yyyy")} -
                          {format(new Date(risk.reservation.departureDate), "MMM d, yyyy")}
                          {risk.reservation.site && ` • Site ${risk.reservation.site.name}`}
                        </p>
                        {risk.riskReason && (
                          <p className="text-sm text-orange-700 mt-1">{risk.riskReason}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>Payment: {risk.paymentStatusScore}%</span>
                          <span>Lead Time: {risk.leadTimeScore}%</span>
                          <span>History: {risk.guestHistoryScore}%</span>
                          <span>Communication: {risk.communicationScore}%</span>
                        </div>
                      </div>
                      {!risk.guestConfirmed && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => sendReminder.mutate(risk.reservationId)}
                            disabled={sendReminder.isPending || !!risk.reminderSentAt}
                          >
                            <Mail className="w-4 h-4 mr-1" />
                            {risk.reminderSentAt ? "Sent" : "Remind"}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => markConfirmed.mutate(risk.reservationId)}
                            disabled={markConfirmed.isPending}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Confirm
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {noShowRisks?.length === 0 && (
                <Card className="border-dashed">
                  <CardContent className="py-12 text-center">
                    <Calendar className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No high-risk reservations</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      All upcoming arrivals look good
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Context Form Dialog */}
      <Dialog open={showContextForm} onOpenChange={setShowContextForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Context Item</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const typeValue = formData.get("type");
              const answerValue = formData.get("answer");
              if (typeof typeValue !== "string" || typeof answerValue !== "string") return;
              const questionValue = formData.get("question");
              const categoryValue = formData.get("category");
              createContext.mutate({
                type: typeValue,
                question:
                  typeof questionValue === "string" && questionValue ? questionValue : undefined,
                answer: answerValue,
                category:
                  typeof categoryValue === "string" && categoryValue ? categoryValue : undefined,
              });
            }}
          >
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select name="type" defaultValue="faq">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="faq">FAQ</SelectItem>
                    <SelectItem value="policy">Policy</SelectItem>
                    <SelectItem value="training_example">Training Example</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="question">Question (optional)</Label>
                <Input name="question" placeholder="What time is check-in?" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="answer">Answer</Label>
                <Textarea name="answer" required placeholder="Check-in is at 3:00 PM..." rows={4} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category (optional)</Label>
                <Input name="category" placeholder="check_in, amenities, pets, etc." />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowContextForm(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createContext.isPending}>
                Add Context
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Draft Review Dialog */}
      <Dialog open={!!selectedDraft} onOpenChange={() => setSelectedDraft(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review AI Reply</DialogTitle>
          </DialogHeader>
          {selectedDraft && (
            <div className="space-y-4 py-4">
              <div className="bg-muted p-3 rounded">
                <p className="text-xs text-muted-foreground mb-1">Original Message</p>
                <p className="font-medium text-sm">{selectedDraft.inboundSubject}</p>
                <p className="text-sm mt-1">{selectedDraft.inboundPreview}</p>
              </div>
              <div className="space-y-2">
                <Label>AI Response</Label>
                <Textarea defaultValue={selectedDraft.draftContent} id="editedContent" rows={6} />
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Confidence: {Math.round(selectedDraft.confidence * 100)}%</span>
                {selectedDraft.detectedIntent && (
                  <span>Intent: {selectedDraft.detectedIntent}</span>
                )}
                {selectedDraft.detectedTone && <span>Tone: {selectedDraft.detectedTone}</span>}
              </div>
            </div>
          )}
          <DialogFooter className="flex justify-between">
            <Button
              variant="destructive"
              onClick={() => {
                if (!selectedDraft) return;
                reviewDraft.mutate({ id: selectedDraft.id, action: "reject" });
              }}
            >
              <X className="w-4 h-4 mr-1" />
              Reject
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (!selectedDraft) return;
                  const content = getEditedContent();
                  reviewDraft.mutate({ id: selectedDraft.id, action: "edit", content });
                }}
              >
                <Edit2 className="w-4 h-4 mr-1" />
                Save Edit
              </Button>
              <Button
                onClick={() => {
                  if (!selectedDraft) return;
                  const content = getEditedContent();
                  reviewDraft.mutate({ id: selectedDraft.id, action: "approve", content });
                }}
              >
                <Check className="w-4 h-4 mr-1" />
                Approve & Send
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
