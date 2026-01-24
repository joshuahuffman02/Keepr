"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useCampground } from "@/contexts/CampgroundContext";
import { apiClient } from "@/lib/api-client";
import { launchConfetti } from "@/lib/gamification/confetti";
import { Trophy, Users, Award, Zap, TrendingUp, Shield, Loader2, Save, Gift } from "lucide-react";

type RoleOptionValue =
  | "owner"
  | "manager"
  | "front_desk"
  | "maintenance"
  | "finance"
  | "marketing"
  | "readonly";
type CategoryValue =
  | "task"
  | "maintenance"
  | "check_in"
  | "reservation_quality"
  | "checklist"
  | "review_mention"
  | "on_time_assignment"
  | "assist"
  | "manual"
  | "other";

type GamificationSettings = Awaited<ReturnType<typeof apiClient.getGamificationSettings>>;
type GamificationRule = Awaited<ReturnType<typeof apiClient.getGamificationRules>>[number];
type GamificationLeaderboard = Awaited<ReturnType<typeof apiClient.getGamificationLeaderboard>>;
type GamificationStats = Awaited<ReturnType<typeof apiClient.getGamificationStats>>;

const roleOptions: Array<{ value: RoleOptionValue; label: string }> = [
  { value: "owner", label: "Owner" },
  { value: "manager", label: "Manager" },
  { value: "front_desk", label: "Front Desk" },
  { value: "maintenance", label: "Maintenance" },
  { value: "finance", label: "Finance" },
  { value: "marketing", label: "Marketing" },
  { value: "readonly", label: "Read-only" },
];

const categories: Array<{ value: CategoryValue; label: string }> = [
  { value: "task", label: "Operational Tasks" },
  { value: "maintenance", label: "Maintenance Closure" },
  { value: "check_in", label: "Check-ins" },
  { value: "reservation_quality", label: "Reservation Quality" },
  { value: "checklist", label: "Checklists" },
  { value: "review_mention", label: "Guest Reviews" },
  { value: "on_time_assignment", label: "On-time Assignments" },
  { value: "assist", label: "Assists" },
  { value: "manual", label: "Merit XP" },
  { value: "other", label: "Other" },
];

const getErrorMessage = (error: unknown) =>
  error instanceof Error && error.message ? error.message : "Unknown error";

const isRoleOptionValue = (value: string): value is RoleOptionValue =>
  roleOptions.some((option) => option.value === value);

const isCategoryValue = (value: string): value is CategoryValue =>
  categories.some((category) => category.value === value);

export default function GamificationSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCampground, isHydrated } = useCampground();
  const campgroundId = selectedCampground?.id;
  const requireCampgroundId = () => {
    if (!campgroundId) {
      throw new Error("Campground is required");
    }
    return campgroundId;
  };

  // Local state for form
  const [enabled, setEnabled] = useState(false);
  const [enabledRoles, setEnabledRoles] = useState<RoleOptionValue[]>([
    "owner",
    "manager",
    "front_desk",
    "maintenance",
  ]);
  const [hasChanges, setHasChanges] = useState(false);

  // Manual award form state
  const [awardTarget, setAwardTarget] = useState<string>("");
  const [awardCategory, setAwardCategory] = useState<CategoryValue>("manual");
  const [awardXp, setAwardXp] = useState<string>("25");
  const [awardReason, setAwardReason] = useState<string>("Merit XP for outstanding work");

  // Fetch settings
  const {
    data: settings,
    isLoading: settingsLoading,
    error: settingsError,
  } = useQuery<GamificationSettings>({
    queryKey: ["gamification-settings", campgroundId],
    queryFn: () => apiClient.getGamificationSettings(requireCampgroundId()),
    enabled: !!campgroundId,
    retry: 1,
  });

  // Sync state when settings data changes
  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setEnabledRoles((settings.enabledRoles ?? []).filter(isRoleOptionValue));
    }
  }, [settings]);

  // Fetch leaderboard
  const { data: leaderboard } = useQuery<GamificationLeaderboard>({
    queryKey: ["gamification-leaderboard", campgroundId],
    queryFn: () => apiClient.getGamificationLeaderboard(requireCampgroundId(), 7),
    enabled: !!campgroundId && enabled,
  });

  // Fetch stats
  const { data: stats } = useQuery<GamificationStats>({
    queryKey: ["gamification-stats", campgroundId],
    queryFn: () => apiClient.getGamificationStats(requireCampgroundId(), 30),
    enabled: !!campgroundId && enabled,
  });

  // Fetch XP rules
  const { data: rules } = useQuery<GamificationRule[]>({
    queryKey: ["gamification-rules", campgroundId],
    queryFn: () => apiClient.getGamificationRules(requireCampgroundId()),
    enabled: !!campgroundId,
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: () => {
      const payload: Parameters<typeof apiClient.updateGamificationSettings>[0] = {
        campgroundId: requireCampgroundId(),
        enabled,
        enabledRoles,
      };
      return apiClient.updateGamificationSettings(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gamification-settings", campgroundId] });
      toast({ title: "Settings saved", description: "Gamification settings have been updated." });
      launchConfetti({ particles: 90 });
      setHasChanges(false);
    },
    onError: (error) => {
      const message = getErrorMessage(error);
      toast({
        title: "Error saving settings",
        description: message || "Failed to update settings",
        variant: "destructive",
      });
    },
  });

  // Manual award mutation
  const awardMutation = useMutation({
    mutationFn: () => {
      const payload: Parameters<typeof apiClient.manualGamificationAward>[0] = {
        campgroundId: requireCampgroundId(),
        targetUserId: awardTarget,
        category: awardCategory,
        xp: parseInt(awardXp, 10),
        reason: awardReason,
      };
      return apiClient.manualGamificationAward(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gamification-leaderboard", campgroundId] });
      queryClient.invalidateQueries({ queryKey: ["gamification-stats", campgroundId] });
      toast({ title: "XP Awarded!", description: `Successfully awarded ${awardXp} XP` });
      launchConfetti({ particles: 140 });
      setAwardXp("25");
      setAwardReason("Merit XP for outstanding work");
    },
    onError: (error) => {
      const message = getErrorMessage(error);
      toast({
        title: "Error awarding XP",
        description: message || "Failed to award XP",
        variant: "destructive",
      });
    },
  });

  const handleToggleRole = (value: RoleOptionValue) => {
    setEnabledRoles((prev) => {
      const newRoles = prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value];
      setHasChanges(true);
      return newRoles;
    });
  };

  const handleSaveSettings = () => {
    updateSettingsMutation.mutate();
  };

  const handleAward = () => {
    if (!awardTarget) {
      toast({
        title: "Select a staff member",
        description: "Choose who receives the XP.",
        variant: "destructive",
      });
      return;
    }
    if (!enabled) {
      toast({
        title: "Gamification is off",
        description: "Enable gamification for this campground to award XP.",
        variant: "destructive",
      });
      return;
    }
    const xpVal = parseInt(awardXp, 10);
    if (isNaN(xpVal) || xpVal <= 0) {
      toast({
        title: "Invalid XP",
        description: "Enter a positive number for XP.",
        variant: "destructive",
      });
      return;
    }
    awardMutation.mutate();
  };

  // Calculate totals from stats
  const totalXp = stats?.categories.reduce((sum, category) => sum + category.xp, 0) ?? 0;
  const topPerformer = leaderboard?.leaderboard?.[0];

  // Wait for hydration before showing "no campground" state to avoid hydration mismatch
  if (!isHydrated || settingsLoading) {
    return (
      <div className="max-w-5xl space-y-6">
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  // Only show "select campground" after hydration confirms no campground is selected
  if (!campgroundId) {
    return (
      <div className="max-w-5xl space-y-6">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
            <Trophy className="w-12 h-12 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Select a Campground</h1>
          <p className="text-muted-foreground max-w-md">
            Please select a campground to manage gamification settings.
          </p>
        </div>
      </div>
    );
  }

  // Show error state if API call failed
  if (settingsError) {
    return (
      <div className="max-w-5xl space-y-6">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-24 h-24 rounded-full bg-status-error/15 flex items-center justify-center mb-6">
            <Trophy className="w-12 h-12 text-status-error/60" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Unable to Load Settings</h1>
          <p className="text-muted-foreground max-w-md mb-4">
            There was an error loading gamification settings. Please try refreshing the page.
          </p>
          <p className="text-xs text-muted-foreground">
            {getErrorMessage(settingsError) || "Unknown error"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Gamification Settings</h1>
          <p className="text-muted-foreground text-sm">
            Make work a friendly competition - configure XP rules, role access, and recognition.
          </p>
        </div>
        <Badge
          variant={enabled ? "default" : "outline"}
          className={
            enabled ? "bg-status-success/15 text-status-success border-status-success/30" : ""
          }
        >
          {enabled ? "Enabled" : "Disabled"}
        </Badge>
      </div>

      {/* Impact Pulse */}
      {enabled && (
        <Card className="bg-status-success/10 border-status-success/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="w-5 h-5 text-status-success" />
              Impact Pulse
            </CardTitle>
            <CardDescription>Quick stats at a glance</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-border bg-card/80 p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-status-success" />
                <span className="text-sm font-medium text-muted-foreground">
                  Total XP (30 days)
                </span>
              </div>
              <div className="text-2xl font-bold text-foreground">{totalXp.toLocaleString()}</div>
            </div>
            <div className="rounded-lg border border-border bg-card/80 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium text-muted-foreground">Top Performer</span>
              </div>
              <div className="text-lg font-bold text-foreground">
                {topPerformer ? `${topPerformer.name} (+${topPerformer.xp} XP)` : "No data yet"}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card/80 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-status-info" />
                <span className="text-sm font-medium text-muted-foreground">Leaderboard Size</span>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {leaderboard?.leaderboard?.length || 0} staff
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Opt-in & Role Gates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-muted-foreground" />
            Opt-in & Role Gates
          </CardTitle>
          <CardDescription>Control who participates in gamification</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">Enable gamification</div>
              <p className="text-sm text-muted-foreground">
                XP, badges, and leaderboards will be available for staff.
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={(val) => {
                setEnabled(val);
                setHasChanges(true);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Roles allowed to participate</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {roleOptions.map((role) => (
                <button
                  key={role.value}
                  type="button"
                  onClick={() => handleToggleRole(role.value)}
                  className={`text-left rounded border px-3 py-2 text-sm transition ${
                    enabledRoles.includes(role.value)
                      ? "border-status-success/40 bg-status-success/10 text-status-success"
                      : "border-border hover:border-border"
                  }`}
                >
                  <div className="font-medium">{role.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {enabledRoles.includes(role.value) ? "Included" : "Excluded"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleSaveSettings}
              disabled={!hasChanges || updateSettingsMutation.isPending}
            >
              {updateSettingsMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Settings
            </Button>
            {hasChanges && <span className="text-sm text-amber-600">Unsaved changes</span>}
          </div>
        </CardContent>
      </Card>

      {/* XP Rules */}
      {enabled && rules && rules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              XP Rules
            </CardTitle>
            <CardDescription>Configure how much XP each activity awards</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded border border-border divide-y">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted/60"
                >
                  <div>
                    <div className="font-medium text-foreground capitalize">
                      {rule.category.replace(/_/g, " ")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Range: {rule.minXp} - {rule.maxXp} XP
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className="bg-status-success/10 text-status-success border-status-success/20"
                    >
                      Default: {rule.defaultXp} XP
                    </Badge>
                    <Badge variant={rule.isActive ? "default" : "secondary"}>
                      {rule.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual Merit XP */}
      {enabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-purple-600" />
              Manual Merit XP
            </CardTitle>
            <CardDescription>Recognize above-and-beyond work with bonus XP</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Staff member</Label>
                <Select value={awardTarget} onValueChange={setAwardTarget}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select staff..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(leaderboard?.leaderboard || []).map((person) => (
                      <SelectItem key={person.userId} value={person.userId}>
                        {person.name} ({person.role || "Staff"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Category</Label>
                <Select
                  value={awardCategory}
                  onValueChange={(value) => {
                    if (isCategoryValue(value)) {
                      setAwardCategory(value);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>XP Amount</Label>
                <Input
                  type="number"
                  value={awardXp}
                  onChange={(e) => setAwardXp(e.target.value)}
                  min={1}
                  max={500}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Reason</Label>
              <Textarea
                rows={2}
                value={awardReason}
                onChange={(e) => setAwardReason(e.target.value)}
                placeholder="Why is this person being recognized?"
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleAward} disabled={awardMutation.isPending || !awardTarget}>
                {awardMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Award className="w-4 h-4 mr-2" />
                )}
                Award XP
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leaderboard Preview */}
      {enabled && (leaderboard?.leaderboard?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Weekly Leaderboard
            </CardTitle>
            <CardDescription>Top performers this week</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(leaderboard?.leaderboard || []).slice(0, 5).map((row) => (
              <div
                key={row.userId}
                className="flex items-center justify-between rounded border border-border px-4 py-3 bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className={`w-8 justify-center ${
                      row.rank === 1
                        ? "bg-status-warning/15 text-status-warning border-status-warning/30"
                        : row.rank === 2
                          ? "bg-muted text-muted-foreground border-border"
                          : row.rank === 3
                            ? "bg-status-warning/10 text-status-warning border-status-warning/20"
                            : ""
                    }`}
                  >
                    {row.rank}
                  </Badge>
                  <div>
                    <div className="font-medium text-foreground">{row.name}</div>
                    <div className="text-xs text-muted-foreground">{row.role || "Staff"}</div>
                  </div>
                </div>
                <div className="font-bold text-emerald-600">+{row.xp} XP</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
