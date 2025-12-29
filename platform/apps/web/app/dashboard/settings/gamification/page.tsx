"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useCampground } from "@/contexts/CampgroundContext";
import { apiClient } from "@/lib/api-client";
import { launchConfetti } from "@/lib/gamification/confetti";
import {
  Trophy,
  Users,
  Award,
  Zap,
  TrendingUp,
  Shield,
  Loader2,
  Save,
  Gift,
} from "lucide-react";

const roleOptions = [
  { value: "owner", label: "Owner" },
  { value: "manager", label: "Manager" },
  { value: "front_desk", label: "Front Desk" },
  { value: "maintenance", label: "Maintenance" },
  { value: "finance", label: "Finance" },
  { value: "marketing", label: "Marketing" },
  { value: "readonly", label: "Read-only" },
] as const;

type RoleOptionValue = (typeof roleOptions)[number]["value"];

const categories = [
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
] as const;

type CategoryValue = (typeof categories)[number]["value"];

export default function GamificationSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCampground, isHydrated } = useCampground();
  const campgroundId = selectedCampground?.id;

  // Local state for form
  const [enabled, setEnabled] = useState(false);
  const [enabledRoles, setEnabledRoles] = useState<RoleOptionValue[]>([
    "owner", "manager", "front_desk", "maintenance"
  ]);
  const [hasChanges, setHasChanges] = useState(false);

  // Manual award form state
  const [awardTarget, setAwardTarget] = useState<string>("");
  const [awardCategory, setAwardCategory] = useState<CategoryValue>("manual");
  const [awardXp, setAwardXp] = useState<string>("25");
  const [awardReason, setAwardReason] = useState<string>("Merit XP for outstanding work");

  // Fetch settings
  const { data: settings, isLoading: settingsLoading, error: settingsError } = useQuery({
    queryKey: ["gamification-settings", campgroundId],
    queryFn: () => apiClient.getGamificationSettings(campgroundId!),
    enabled: !!campgroundId,
    retry: 1,
  });

  // Sync state when settings data changes
  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setEnabledRoles((settings.enabledRoles || []) as RoleOptionValue[]);
    }
  }, [settings]);

  // Fetch leaderboard
  const { data: leaderboard } = useQuery({
    queryKey: ["gamification-leaderboard", campgroundId],
    queryFn: () => apiClient.getGamificationLeaderboard(campgroundId!, 7),
    enabled: !!campgroundId && enabled,
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ["gamification-stats", campgroundId],
    queryFn: () => apiClient.getGamificationStats(campgroundId!, 30),
    enabled: !!campgroundId && enabled,
  });

  // Fetch XP rules
  const { data: rules } = useQuery({
    queryKey: ["gamification-rules", campgroundId],
    queryFn: () => apiClient.getGamificationRules(campgroundId!),
    enabled: !!campgroundId,
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: () => apiClient.updateGamificationSettings({
      campgroundId: campgroundId!,
      enabled,
      enabledRoles,
    } as Parameters<typeof apiClient.updateGamificationSettings>[0]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gamification-settings", campgroundId] });
      toast({ title: "Settings saved", description: "Gamification settings have been updated." });
      launchConfetti({ particles: 90 });
      setHasChanges(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error saving settings",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
    },
  });

  // Manual award mutation
  const awardMutation = useMutation({
    mutationFn: () => apiClient.manualGamificationAward({
      campgroundId: campgroundId!,
      targetUserId: awardTarget,
      category: awardCategory,
      xp: parseInt(awardXp, 10),
      reason: awardReason,
    } as Parameters<typeof apiClient.manualGamificationAward>[0]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gamification-leaderboard", campgroundId] });
      queryClient.invalidateQueries({ queryKey: ["gamification-stats", campgroundId] });
      toast({ title: "XP Awarded!", description: `Successfully awarded ${awardXp} XP` });
      launchConfetti({ particles: 140 });
      setAwardXp("25");
      setAwardReason("Merit XP for outstanding work");
    },
    onError: (error: any) => {
      toast({
        title: "Error awarding XP",
        description: error.message || "Failed to award XP",
        variant: "destructive",
      });
    },
  });

  const handleToggleRole = (value: RoleOptionValue) => {
    setEnabledRoles((prev) => {
      const newRoles = prev.includes(value)
        ? prev.filter((r) => r !== value)
        : [...prev, value];
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
  const totalXp = stats?.categories?.reduce((sum: number, c: any) => sum + (c.xp || 0), 0) || 0;
  const topPerformer = leaderboard?.leaderboard?.[0];

  // Wait for hydration before showing "no campground" state to avoid hydration mismatch
  if (!isHydrated || settingsLoading) {
    return (
      <div className="max-w-5xl space-y-6">
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
          <p className="text-slate-500">Loading settings...</p>
        </div>
      </div>
    );
  }

  // Only show "select campground" after hydration confirms no campground is selected
  if (!campgroundId) {
    return (
      <div className="max-w-5xl space-y-6">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center mb-6">
            <Trophy className="w-12 h-12 text-slate-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Select a Campground</h1>
          <p className="text-slate-500 max-w-md">
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
          <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center mb-6">
            <Trophy className="w-12 h-12 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Unable to Load Settings</h1>
          <p className="text-slate-500 max-w-md mb-4">
            There was an error loading gamification settings. Please try refreshing the page.
          </p>
          <p className="text-xs text-slate-400">
            {(settingsError as Error)?.message || "Unknown error"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Gamification Settings</h1>
          <p className="text-slate-600 text-sm">
            Make work a friendly competition - configure XP rules, role access, and recognition.
          </p>
        </div>
        <Badge
          variant={enabled ? "default" : "outline"}
          className={enabled ? "bg-emerald-100 text-emerald-800 border-emerald-200" : ""}
        >
          {enabled ? "Enabled" : "Disabled"}
        </Badge>
      </div>

      {/* Impact Pulse */}
      {enabled && (
        <Card className="bg-gradient-to-r from-emerald-50 via-cyan-50 to-white border-emerald-100">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-600" />
              Impact Pulse
            </CardTitle>
            <CardDescription>Quick stats at a glance</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-emerald-100 bg-white/70 p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-medium text-slate-700">Total XP (30 days)</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{totalXp.toLocaleString()}</div>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-white/70 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium text-slate-700">Top Performer</span>
              </div>
              <div className="text-lg font-bold text-slate-900">
                {topPerformer ? `${topPerformer.name} (+${topPerformer.xp} XP)` : "No data yet"}
              </div>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-white/70 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-slate-700">Leaderboard Size</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">
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
            <Shield className="w-5 h-5 text-slate-600" />
            Opt-in & Role Gates
          </CardTitle>
          <CardDescription>Control who participates in gamification</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-900">Enable gamification</div>
              <p className="text-sm text-slate-600">
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
            <Label className="text-sm text-slate-700">Roles allowed to participate</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {roleOptions.map((role) => (
                <button
                  key={role.value}
                  type="button"
                  onClick={() => handleToggleRole(role.value)}
                  className={`text-left rounded border px-3 py-2 text-sm transition ${
                    enabledRoles.includes(role.value)
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="font-medium">{role.label}</div>
                  <div className="text-xs text-slate-500">
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
            {hasChanges && (
              <span className="text-sm text-amber-600">Unsaved changes</span>
            )}
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
            <div className="rounded border border-slate-200 divide-y">
              {rules.map((rule: any) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
                >
                  <div>
                    <div className="font-medium text-slate-900 capitalize">
                      {rule.category.replace(/_/g, " ")}
                    </div>
                    <div className="text-xs text-slate-500">
                      Range: {rule.minXp} - {rule.maxXp} XP
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
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
            <CardDescription>
              Recognize above-and-beyond work with bonus XP
            </CardDescription>
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
                    {(leaderboard?.leaderboard || []).map((person: any) => (
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
                  onValueChange={(v) => setAwardCategory(v as CategoryValue)}
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
              <Button
                onClick={handleAward}
                disabled={awardMutation.isPending || !awardTarget}
              >
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
            {(leaderboard?.leaderboard || []).slice(0, 5).map((row: any) => (
              <div
                key={row.userId}
                className="flex items-center justify-between rounded border border-slate-100 px-4 py-3 bg-slate-50/50"
              >
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className={`w-8 justify-center ${
                      row.rank === 1
                        ? "bg-amber-100 text-amber-700 border-amber-200"
                        : row.rank === 2
                        ? "bg-slate-100 text-slate-600 border-slate-200"
                        : row.rank === 3
                        ? "bg-amber-50 text-amber-600 border-amber-100"
                        : ""
                    }`}
                  >
                    {row.rank}
                  </Badge>
                  <div>
                    <div className="font-medium text-slate-900">{row.name}</div>
                    <div className="text-xs text-slate-500">{row.role || "Staff"}</div>
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
