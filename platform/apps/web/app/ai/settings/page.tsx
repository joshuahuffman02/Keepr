"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { apiClient } from "@/lib/api-client";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2,
  Settings,
  ArrowLeft,
  Save,
  MessageSquare,
  Users,
  AlertTriangle,
  Calendar,
  DollarSign,
  Wrench,
  CloudSun,
  Phone,
  Zap,
  Shield,
  Bot,
  Brain
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

const SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 300,
  damping: 25,
};

type AutopilotConfig = {
  id: string;
  campgroundId: string;
  // Core features
  autoReplyEnabled: boolean;
  smartWaitlistEnabled: boolean;
  anomalyDetectionEnabled: boolean;
  noShowPredictionEnabled: boolean;
  // Autonomous control
  autoReplyAutoSendEnabled: boolean;
  autoReplyMaxDailyAutoSends: number;
  waitlistAutoOfferEnabled: boolean;
  waitlistAutoOfferMinScore: number;
  waitlistAutoOfferHoldMinutes: number;
  anomalyAutoFixEnabled: boolean;
  anomalyAutoFixCategories: string[];
  noShowAutoReleaseEnabled: boolean;
  noShowAutoConfirmHours: number;
  noShowAutoReleaseHours: number;
  // Dynamic pricing
  dynamicPricingAiEnabled: boolean;
  dynamicPricingMode: string;
  dynamicPricingMaxAdjust: number;
  // Predictive maintenance
  predictiveMaintenanceEnabled: boolean;
  maintenanceAlertThreshold: number;
  // Weather
  weatherAlertsEnabled: boolean;
  weatherApiKey?: string;
  // Phone agent
  phoneAgentEnabled: boolean;
  phoneAgentNumber?: string;
  phoneAgentTransferNumber?: string;
  phoneAgentHoursStart?: string;
  phoneAgentHoursEnd?: string;
  phoneAgentVoice: string;
};

export default function AISettingsPage() {
  const [activeTab, setActiveTab] = useState("core");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [localConfig, setLocalConfig] = useState<Partial<AutopilotConfig>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Get campground
  const { data: campgrounds = [] } = useQuery({
    queryKey: ["campgrounds"],
    queryFn: () => apiClient.getCampgrounds(),
  });
  const campground = campgrounds[0];

  // Get autopilot config
  const { data: config, isLoading } = useQuery({
    queryKey: ["ai-autopilot-config", campground?.id],
    queryFn: () => apiClient.getAutopilotConfig(campground!.id),
    enabled: !!campground?.id,
  });

  // Initialize local config when data loads
  useEffect(() => {
    if (config) {
      setLocalConfig(config);
      setHasChanges(false);
    }
  }, [config]);

  // Update config mutation
  const updateMutation = useMutation({
    mutationFn: (updates: Partial<AutopilotConfig>) =>
      apiClient.updateAutopilotConfig(campground!.id, updates),
    onSuccess: () => {
      toast({ title: "Settings saved", description: "Your AI settings have been updated." });
      queryClient.invalidateQueries({ queryKey: ["ai-autopilot-config"] });
      setHasChanges(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    },
  });

  const updateField = <K extends keyof AutopilotConfig>(key: K, value: AutopilotConfig[K]) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateMutation.mutate(localConfig);
  };

  if (!campground) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Settings className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h2 className="text-2xl font-bold text-foreground mb-2">No Campground Selected</h2>
            <p className="text-muted-foreground">Select a campground to configure AI settings</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (isLoading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-slate-500 to-gray-600 text-white shadow-lg">
              <Settings className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">AI Settings</h1>
              <p className="text-sm text-muted-foreground">
                Configure your AI assistant behavior
              </p>
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateMutation.isPending}
            className="gap-2"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </Button>
        </motion.div>

        {/* Settings Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="core" className="gap-2">
              <Brain className="h-4 w-4" />
              Core AI
            </TabsTrigger>
            <TabsTrigger value="autonomous" className="gap-2">
              <Zap className="h-4 w-4" />
              Autonomous
            </TabsTrigger>
            <TabsTrigger value="pricing" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Pricing
            </TabsTrigger>
            <TabsTrigger value="phone" className="gap-2">
              <Phone className="h-4 w-4" />
              Phone Agent
            </TabsTrigger>
          </TabsList>

          {/* Core AI Settings */}
          <TabsContent value="core" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Core AI Features</CardTitle>
                <CardDescription>Enable or disable main AI capabilities</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Auto-Reply Suggestions</p>
                      <p className="text-sm text-muted-foreground">AI drafts replies for guest messages</p>
                    </div>
                  </div>
                  <Switch
                    checked={localConfig.autoReplyEnabled ?? false}
                    onCheckedChange={(checked) => updateField("autoReplyEnabled", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                      <Users className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Smart Waitlist</p>
                      <p className="text-sm text-muted-foreground">AI ranks and manages waitlist entries</p>
                    </div>
                  </div>
                  <Switch
                    checked={localConfig.smartWaitlistEnabled ?? false}
                    onCheckedChange={(checked) => updateField("smartWaitlistEnabled", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Anomaly Detection</p>
                      <p className="text-sm text-muted-foreground">AI identifies booking and pricing anomalies</p>
                    </div>
                  </div>
                  <Switch
                    checked={localConfig.anomalyDetectionEnabled ?? false}
                    onCheckedChange={(checked) => updateField("anomalyDetectionEnabled", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">No-Show Prediction</p>
                      <p className="text-sm text-muted-foreground">AI predicts and flags potential no-shows</p>
                    </div>
                  </div>
                  <Switch
                    checked={localConfig.noShowPredictionEnabled ?? false}
                    onCheckedChange={(checked) => updateField("noShowPredictionEnabled", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <Wrench className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Predictive Maintenance</p>
                      <p className="text-sm text-muted-foreground">AI detects maintenance patterns</p>
                    </div>
                  </div>
                  <Switch
                    checked={localConfig.predictiveMaintenanceEnabled ?? false}
                    onCheckedChange={(checked) => updateField("predictiveMaintenanceEnabled", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                      <CloudSun className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Weather Alerts</p>
                      <p className="text-sm text-muted-foreground">Auto-notify guests of weather events</p>
                    </div>
                  </div>
                  <Switch
                    checked={localConfig.weatherAlertsEnabled ?? false}
                    onCheckedChange={(checked) => updateField("weatherAlertsEnabled", checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Autonomous Settings */}
          <TabsContent value="autonomous" className="space-y-4">
            <Card className="border-amber-200 dark:border-amber-800">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-500" />
                  <CardTitle>Autonomous Mode</CardTitle>
                </div>
                <CardDescription>
                  Let AI take actions automatically without manual approval
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800 dark:text-amber-300">Safety First</p>
                      <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                        All autonomous actions are logged and can be reversed. Start with conservative settings and increase as you build confidence.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">Auto-Send Replies</p>
                      <p className="text-sm text-muted-foreground">Automatically send AI-drafted replies</p>
                    </div>
                    <Switch
                      checked={localConfig.autoReplyAutoSendEnabled ?? false}
                      onCheckedChange={(checked) => updateField("autoReplyAutoSendEnabled", checked)}
                    />
                  </div>

                  {localConfig.autoReplyAutoSendEnabled && (
                    <div className="ml-6 space-y-3">
                      <div>
                        <Label className="text-sm">Max Daily Auto-Sends</Label>
                        <div className="flex items-center gap-4 mt-2">
                          <Slider
                            value={[localConfig.autoReplyMaxDailyAutoSends ?? 50]}
                            onValueChange={([v]) => updateField("autoReplyMaxDailyAutoSends", v)}
                            min={10}
                            max={200}
                            step={10}
                            className="flex-1"
                          />
                          <span className="w-12 text-sm font-medium">{localConfig.autoReplyMaxDailyAutoSends ?? 50}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">Auto-Offer Waitlist Spots</p>
                      <p className="text-sm text-muted-foreground">Automatically offer spots when cancellations occur</p>
                    </div>
                    <Switch
                      checked={localConfig.waitlistAutoOfferEnabled ?? false}
                      onCheckedChange={(checked) => updateField("waitlistAutoOfferEnabled", checked)}
                    />
                  </div>

                  {localConfig.waitlistAutoOfferEnabled && (
                    <div className="ml-6 space-y-3">
                      <div>
                        <Label className="text-sm">Minimum Match Score</Label>
                        <div className="flex items-center gap-4 mt-2">
                          <Slider
                            value={[localConfig.waitlistAutoOfferMinScore ?? 75]}
                            onValueChange={([v]) => updateField("waitlistAutoOfferMinScore", v)}
                            min={50}
                            max={100}
                            step={5}
                            className="flex-1"
                          />
                          <span className="w-12 text-sm font-medium">{localConfig.waitlistAutoOfferMinScore ?? 75}%</span>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm">Hold Time (minutes)</Label>
                        <div className="flex items-center gap-4 mt-2">
                          <Slider
                            value={[localConfig.waitlistAutoOfferHoldMinutes ?? 30]}
                            onValueChange={([v]) => updateField("waitlistAutoOfferHoldMinutes", v)}
                            min={15}
                            max={120}
                            step={15}
                            className="flex-1"
                          />
                          <span className="w-12 text-sm font-medium">{localConfig.waitlistAutoOfferHoldMinutes ?? 30}m</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">Auto-Release No-Shows</p>
                      <p className="text-sm text-muted-foreground">Automatically release sites from unconfirmed guests</p>
                    </div>
                    <Switch
                      checked={localConfig.noShowAutoReleaseEnabled ?? false}
                      onCheckedChange={(checked) => updateField("noShowAutoReleaseEnabled", checked)}
                    />
                  </div>

                  {localConfig.noShowAutoReleaseEnabled && (
                    <div className="ml-6 space-y-3">
                      <div>
                        <Label className="text-sm">Confirmation Window (hours before arrival)</Label>
                        <div className="flex items-center gap-4 mt-2">
                          <Slider
                            value={[localConfig.noShowAutoConfirmHours ?? 24]}
                            onValueChange={([v]) => updateField("noShowAutoConfirmHours", v)}
                            min={12}
                            max={72}
                            step={6}
                            className="flex-1"
                          />
                          <span className="w-12 text-sm font-medium">{localConfig.noShowAutoConfirmHours ?? 24}h</span>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm">Release After (hours past check-in)</Label>
                        <div className="flex items-center gap-4 mt-2">
                          <Slider
                            value={[localConfig.noShowAutoReleaseHours ?? 4]}
                            onValueChange={([v]) => updateField("noShowAutoReleaseHours", v)}
                            min={2}
                            max={12}
                            step={1}
                            className="flex-1"
                          />
                          <span className="w-12 text-sm font-medium">{localConfig.noShowAutoReleaseHours ?? 4}h</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pricing Settings */}
          <TabsContent value="pricing" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Dynamic Pricing AI</CardTitle>
                <CardDescription>Configure AI-powered pricing recommendations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Enable Dynamic Pricing</p>
                    <p className="text-sm text-muted-foreground">AI analyzes demand and suggests pricing</p>
                  </div>
                  <Switch
                    checked={localConfig.dynamicPricingAiEnabled ?? false}
                    onCheckedChange={(checked) => updateField("dynamicPricingAiEnabled", checked)}
                  />
                </div>

                {localConfig.dynamicPricingAiEnabled && (
                  <>
                    <div>
                      <Label className="text-sm">Pricing Mode</Label>
                      <Select
                        value={localConfig.dynamicPricingMode ?? "suggest"}
                        onValueChange={(value) => updateField("dynamicPricingMode", value)}
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="suggest">Suggest Only (Manual approval)</SelectItem>
                          <SelectItem value="auto_minor">Auto-Apply Minor Changes (&lt;10%)</SelectItem>
                          <SelectItem value="auto_all">Auto-Apply All (Full autonomous)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm">Maximum Price Adjustment (%)</Label>
                      <div className="flex items-center gap-4 mt-2">
                        <Slider
                          value={[localConfig.dynamicPricingMaxAdjust ?? 50]}
                          onValueChange={([v]) => updateField("dynamicPricingMaxAdjust", v)}
                          min={10}
                          max={100}
                          step={5}
                          className="flex-1"
                        />
                        <span className="w-16 text-sm font-medium">+/- {localConfig.dynamicPricingMaxAdjust ?? 50}%</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Phone Agent Settings */}
          <TabsContent value="phone" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>AI Phone Agent</CardTitle>
                <CardDescription>Configure 24/7 automated call handling</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Enable Phone Agent</p>
                    <p className="text-sm text-muted-foreground">AI answers calls and handles inquiries</p>
                  </div>
                  <Switch
                    checked={localConfig.phoneAgentEnabled ?? false}
                    onCheckedChange={(checked) => updateField("phoneAgentEnabled", checked)}
                  />
                </div>

                {localConfig.phoneAgentEnabled && (
                  <>
                    <div>
                      <Label className="text-sm">Phone Number</Label>
                      <Input
                        value={localConfig.phoneAgentNumber ?? ""}
                        onChange={(e) => updateField("phoneAgentNumber", e.target.value)}
                        placeholder="+1 (555) 123-4567"
                        className="mt-2"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        This is the number that will be answered by AI
                      </p>
                    </div>

                    <div>
                      <Label className="text-sm">Transfer Number (for complex issues)</Label>
                      <Input
                        value={localConfig.phoneAgentTransferNumber ?? ""}
                        onChange={(e) => updateField("phoneAgentTransferNumber", e.target.value)}
                        placeholder="+1 (555) 123-4567"
                        className="mt-2"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm">Active Hours Start</Label>
                        <Input
                          type="time"
                          value={localConfig.phoneAgentHoursStart ?? "08:00"}
                          onChange={(e) => updateField("phoneAgentHoursStart", e.target.value)}
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Active Hours End</Label>
                        <Input
                          type="time"
                          value={localConfig.phoneAgentHoursEnd ?? "22:00"}
                          onChange={(e) => updateField("phoneAgentHoursEnd", e.target.value)}
                          className="mt-2"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm">AI Voice</Label>
                      <Select
                        value={localConfig.phoneAgentVoice ?? "alloy"}
                        onValueChange={(value) => updateField("phoneAgentVoice", value)}
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="alloy">Alloy (Neutral)</SelectItem>
                          <SelectItem value="echo">Echo (Male)</SelectItem>
                          <SelectItem value="fable">Fable (British)</SelectItem>
                          <SelectItem value="onyx">Onyx (Deep Male)</SelectItem>
                          <SelectItem value="nova">Nova (Female)</SelectItem>
                          <SelectItem value="shimmer">Shimmer (Soft Female)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardShell>
  );
}
