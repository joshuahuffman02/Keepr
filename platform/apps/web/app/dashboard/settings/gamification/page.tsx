"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  awardManualXp,
  computeLevel,
  fetchLeaderboard,
  fetchManagerSnapshot,
  listStaff,
  listCampgrounds,
  updateOptIn,
  overrideXp,
  listBadgeLibrary,
  upsertBadge,
  removeBadge,
  listRecentAwards,
  listRecentBadgeUnlocks,
  sendGamificationNotification,
  listHistoryEntries,
  listNotifications,
} from "@/lib/gamification/stub-data";
import { launchConfetti } from "@/lib/gamification/confetti";

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

const tierOptions = [
  { value: "bronze", label: "Bronze" },
  { value: "silver", label: "Silver" },
  { value: "gold", label: "Gold" },
  { value: "platinum", label: "Platinum" },
] as const;

type NotifyPayload = {
  title: string;
  description?: string;
  userId?: string;
  type?: "xp_award" | "badge_unlock" | "generic";
  meta?: Record<string, any>;
};

function useGamificationNotify() {
  const { toast } = useToast();
  return (payload: NotifyPayload) => {
    sendGamificationNotification({
      type: payload.type || "generic",
      userId: payload.userId,
      message: payload.description || payload.title,
      meta: payload.meta,
    });
    toast({ title: payload.title, description: payload.description });
  };
}

export default function GamificationSettingsPage() {
  const { toast } = useToast();
  const notify = useGamificationNotify();
  const [loading, setLoading] = useState(true);
  const campgrounds = useMemo(() => listCampgrounds(), []);
  const [campgroundId, setCampgroundId] = useState<string>(campgrounds[0]?.id || "cg-default");
  const [enabled, setEnabled] = useState(false);
  const [enabledRoles, setEnabledRoles] = useState<RoleOptionValue[]>(["owner", "manager", "front_desk", "maintenance"]);
  const [awardTarget, setAwardTarget] = useState<string>("");
  const [awardCategory, setAwardCategory] = useState<CategoryValue>("manual");
  const [awardXp, setAwardXp] = useState<string>("25");
  const [awardReason, setAwardReason] = useState<string>("Merit XP for outstanding work");
  const [staff, setStaff] = useState(listStaff());
  const [leaderboard, setLeaderboard] = useState<{ leaderboard: any[] } | null>(null);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [badgeLibrary, setBadgeLibrary] = useState<any[]>([]);
  const [editingBadgeId, setEditingBadgeId] = useState<string | null>(null);
  const [badgeName, setBadgeName] = useState("");
  const [badgeDescription, setBadgeDescription] = useState("");
  const [badgeTier, setBadgeTier] = useState<string>("bronze");
  const [awardBadgeId, setAwardBadgeId] = useState<string | null>(null);
  const [recentAwards, setRecentAwards] = useState(listRecentAwards());
  const [recentBadges, setRecentBadges] = useState(listRecentBadgeUnlocks());
  const [historyEntries, setHistoryEntries] = useState(listHistoryEntries());
  const [notifications, setNotifications] = useState(listNotifications());
  const totalXp = staff.reduce((sum, s) => sum + s.totalXp, 0);
  const topPerformer = leaderboard?.leaderboard?.[0];
  const badgeCount = staff.reduce((sum, s) => sum + (s.badges?.length || 0), 0);

  const staffOptions = useMemo(
    () =>
      staff.map((m) => ({
        value: m.id,
        label: `${m.name} · ${m.role}`,
      })),
    [staff]
  );

  const refresh = async () => {
    setLoading(true);
    const snapshot = await fetchManagerSnapshot(campgroundId);
    const lb = await fetchLeaderboard("weekly");
    setEnabled(snapshot.optIn.enabled);
    setEnabledRoles(snapshot.optIn.enabledRoles as RoleOptionValue[]);
    setStaff(snapshot.staff);
    setChallenges(snapshot.challenges);
    setLeaderboard(lb);
    setBadgeLibrary(snapshot.badgeLibrary || listBadgeLibrary());
    setRecentAwards(listRecentAwards());
    setRecentBadges(listRecentBadgeUnlocks());
    setHistoryEntries(listHistoryEntries());
    setNotifications(listNotifications());
    const firstBadgeId = snapshot.badgeLibrary?.[0]?.id || listBadgeLibrary()[0]?.id;
    if (!awardBadgeId && firstBadgeId) {
      setAwardBadgeId(firstBadgeId);
    }
    if (!awardTarget && snapshot.staff?.[0]?.id) setAwardTarget(snapshot.staff[0].id);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, [campgroundId]);

  const handleSaveSettings = async () => {
    updateOptIn({ enabled, enabledRoles }, campgroundId);
    await refresh();
    toast({ title: "Saved", description: "Gamification opt-in and role gates updated." });
    launchConfetti({ particles: 90 });
  };

  const handleToggleRole = (value: RoleOptionValue) => {
    setEnabledRoles((prev) => (prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value]));
  };

  const handleAward = async () => {
    const xpVal = Number(awardXp);
    const targetMember = staff.find((m) => m.id === awardTarget);
    const badgeName = badgeLibrary.find((b) => b.id === awardBadgeId)?.name;
    if (!awardTarget) {
      toast({ title: "Select a staff member", description: "Choose who receives the XP.", variant: "destructive" });
      return;
    }
    if (!enabled) {
      toast({ title: "Gamification is off", description: "Enable gamification for this campground to award XP.", variant: "destructive" });
      return;
    }
    if (targetMember && !enabledRoles.includes(targetMember.role as RoleOptionValue)) {
      toast({ title: "Role is gated", description: "This role is excluded for this campground.", variant: "destructive" });
      return;
    }
    if (Number.isNaN(xpVal)) {
      toast({ title: "Enter XP", description: "XP must be a number.", variant: "destructive" });
      return;
    }
    awardManualXp(awardTarget, xpVal, awardReason, awardCategory as any, awardBadgeId || undefined, campgroundId);
    await refresh();
    notify({
      title: "XP awarded",
      description: `${targetMember?.name || "Staff"} received +${xpVal} XP${badgeName ? ` · Badge: ${badgeName}` : ""}`,
      userId: awardTarget,
      type: "xp_award",
      meta: { xp: xpVal, badgeId: awardBadgeId, category: awardCategory },
    });
    launchConfetti({ particles: 140 });
  };

  const handleOverride = async (userId: string, value: string) => {
    const xpVal = Number(value);
    if (Number.isNaN(xpVal)) {
      toast({ title: "Invalid XP", description: "Enter a numeric XP total.", variant: "destructive" });
      return;
    }
    overrideXp(userId, xpVal);
    await refresh();
    toast({ title: "Override applied", description: "Total XP updated for this staff member." });
  };

  const handleBadgeSave = async () => {
    if (!badgeName.trim()) {
      toast({ title: "Name required", description: "Enter a badge name.", variant: "destructive" });
      return;
    }
    upsertBadge({ id: editingBadgeId || undefined, name: badgeName.trim(), description: badgeDescription.trim(), tier: badgeTier as any });
    setBadgeLibrary(listBadgeLibrary());
    setEditingBadgeId(null);
    setBadgeName("");
    setBadgeDescription("");
    setBadgeTier("bronze");
    toast({ title: "Badge saved", description: "Stub badge library updated." });
  };

  const handleBadgeEdit = (badge: any) => {
    setEditingBadgeId(badge.id);
    setBadgeName(badge.name);
    setBadgeDescription(badge.description);
    setBadgeTier(badge.tier || "bronze");
  };

  const handleBadgeDelete = (id: string) => {
    removeBadge(id);
    setBadgeLibrary(listBadgeLibrary());
    if (editingBadgeId === id) {
      setEditingBadgeId(null);
      setBadgeName("");
      setBadgeDescription("");
      setBadgeTier("bronze");
    }
    toast({ title: "Badge removed", description: "Stub badge deleted." });
  };

  return (
    <div className="max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Gamification</h1>
            <p className="text-slate-600 text-sm">Make work a friendly competition—opt-in, celebrate wins, and steer the game.</p>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <Badge variant={enabled ? "default" : "outline"} className={enabled ? "bg-emerald-100 text-emerald-800 border-emerald-200" : ""}>
              {enabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Campground admin (stub)</CardTitle>
            <CardDescription>Toggle per-property gamification without leaving stub data.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="space-y-2">
              <Label>Campground</Label>
              <Select value={campgroundId} onValueChange={setCampgroundId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select campground" />
                </SelectTrigger>
                <SelectContent>
                  {campgrounds.map((cg) => (
                    <SelectItem key={cg.id} value={cg.id}>
                      {cg.name} {cg.region ? `· ${cg.region}` : ""} {cg.status ? `(${cg.status})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 rounded border border-emerald-100 bg-emerald-50/70 p-3">
              <div className="font-semibold text-slate-900">Opt-in state</div>
              <div className="flex items-center gap-2 text-xs">
                <Badge variant={enabled ? "default" : "outline"} className={enabled ? "bg-emerald-100 text-emerald-800 border-emerald-200" : ""}>
                  {enabled ? "Enabled" : "Disabled"}
                </Badge>
                <Badge variant="outline">{enabledRoles.length} roles allowed</Badge>
              </div>
              <div className="text-xs text-slate-600">Saved per campground (in-memory stub).</div>
            </div>
            <div className="space-y-1 rounded border border-slate-200 bg-white p-3">
              <div className="font-semibold text-slate-900">Manual merit XP</div>
              <div className="text-xs text-slate-600">Awards stay scoped to this panel and reuse the same stub roster.</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-emerald-50 via-cyan-50 to-white border-emerald-100">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="text-lg">Impact pulse</CardTitle>
                <CardDescription>Quick hits to see momentum at a glance.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">XP bank: {totalXp} total</Badge>
                <Badge variant="outline">Badges earned: {badgeCount}</Badge>
                {topPerformer && <Badge variant="outline">Top: {topPerformer.name} (+{topPerformer.xp} XP)</Badge>}
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-slate-700">
            <div className="rounded-lg border border-emerald-100 bg-white/70 p-3">
              <div className="font-semibold text-slate-900 mb-1">Opt-in magic</div>
              <div>{enabled ? "Gamification is on—staff see XP, challenges, and badges." : "Turn it on to unlock XP, challenges, and recognition."}</div>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-white/70 p-3">
              <div className="font-semibold text-slate-900 mb-1">Weekly focus</div>
              <div>
                {challenges[0]
                  ? `Push “${challenges[0].title}” this week. Reward: ${challenges[0].rewardBadge || "badge"}.`
                  : "Add a weekly challenge to keep momentum up."}
              </div>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-white/70 p-3">
              <div className="font-semibold text-slate-900 mb-1">Celebrate loud</div>
              <div>Drop merit XP when you spot great work; badges and XP will rise together.</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Opt-in & role gates</CardTitle>
            <CardDescription>Staff-only. Guests never see XP.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-900">Enable gamification for this property</div>
                <p className="text-sm text-slate-600">XP, badges, and challenges unlock when enabled.</p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} disabled={loading} />
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-slate-700">Roles allowed</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {roleOptions.map((role) => (
                  <button
                    key={role.value}
                    type="button"
                    onClick={() => handleToggleRole(role.value)}
                    className={`text-left rounded border px-3 py-2 text-sm transition ${
                      enabledRoles.includes(role.value) ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="font-medium">{role.label}</div>
                    <div className="text-xs text-slate-500">{enabledRoles.includes(role.value) ? "Included" : "Excluded"}</div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500">Role gates are enforced server-side in production; stubbed locally here.</p>
            </div>

            <Button onClick={handleSaveSettings} disabled={loading}>
              Save settings
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent recognition</CardTitle>
            <CardDescription>Latest XP drops and badge unlocks (stubbed).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-500 uppercase">XP awards</div>
              <div className="rounded border border-slate-200 divide-y bg-white/70">
                {recentAwards.map((evt) => (
                  <div key={evt.id} className="flex items-center justify-between px-3 py-2 gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{evt.userName}</div>
                      <div className="text-xs text-slate-500">{evt.role}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">+{evt.xp} XP</Badge>
                      <div className="text-xs text-slate-500 text-right">
                        <div className="capitalize">{evt.category.replace("_", " ")}</div>
                        <div>{new Date(evt.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                ))}
                {recentAwards.length === 0 && <div className="px-3 py-2 text-slate-600">No XP awards yet.</div>}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-500 uppercase">Badge unlocks</div>
              <div className="rounded border border-slate-200 divide-y bg-white/70">
                {recentBadges.map((badge) => (
                  <div key={`${badge.userId}-${badge.id}`} className="flex items-center justify-between px-3 py-2 gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{badge.userName}</div>
                      <div className="text-xs text-slate-500">{badge.role}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{badge.tier || "badge"}</Badge>
                      <div className="text-xs text-slate-500 text-right">
                        <div className="font-semibold text-slate-900">{badge.name}</div>
                        <div>{new Date(badge.earnedAt).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                ))}
                {recentBadges.length === 0 && <div className="px-3 py-2 text-slate-600">No badges yet.</div>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
            <CardDescription>XP awards, overrides, and badge grants with timestamps.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded border border-slate-200 divide-y bg-white/70">
              {historyEntries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between px-3 py-2 gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{entry.userName || "Unknown staff"}</div>
                    <div className="text-xs text-slate-500">{entry.role || "staff"}</div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-600">
                    <Badge variant="outline">
                      {entry.type === "xp_award" ? "XP" : entry.type === "badge_unlock" ? "Badge" : "Override"}
                    </Badge>
                    {entry.type === "xp_award" && <div className="font-semibold text-slate-900">+{entry.xp} XP</div>}
                    {entry.type === "badge_unlock" && (
                      <div className="text-right">
                        <div className="font-semibold text-slate-900">{entry.badgeName}</div>
                        <div className="text-[11px] text-slate-500">{entry.badgeTier || "badge"}</div>
                      </div>
                    )}
                    {entry.type === "override" && <div className="font-semibold text-slate-900">Set to {entry.xp} XP</div>}
                    <div className="text-[11px] text-slate-500">{new Date(entry.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              ))}
              {historyEntries.length === 0 && <div className="px-3 py-2 text-slate-600">No history yet.</div>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notification log (stubbed)</CardTitle>
            <CardDescription>Same signals as the toast hook, persisted in-memory.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="rounded border border-slate-200 divide-y bg-white/70">
              {notifications.map((n) => (
                <div key={n.id} className="flex items-center justify-between px-3 py-2 gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{n.message}</div>
                    {n.userId && <div className="text-xs text-slate-500">User: {n.userId}</div>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Badge variant="outline">{n.type}</Badge>
                    <div>{new Date(n.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              ))}
              {notifications.length === 0 && <div className="px-3 py-2 text-slate-600">No notifications logged.</div>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Staff overview</CardTitle>
            <CardDescription>XP totals, levels, badges, overrides—and who’s inspiring the team.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {staff.map((member) => {
              const level = computeLevel(member.totalXp);
              return (
                <div key={member.id} className="rounded border border-slate-200 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{member.name}</div>
                      <div className="text-xs text-slate-500">{member.role}</div>
                    </div>
                    <Badge variant="outline">Level {level.level}</Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-slate-600">
                    <div className="rounded border border-slate-200 p-2">
                      <div className="font-semibold text-slate-900">{member.totalXp} XP</div>
                      <div>Total</div>
                    </div>
                    <div className="rounded border border-slate-200 p-2">
                      <div className="font-semibold text-slate-900">{member.weeklyXp} XP</div>
                      <div>Weekly</div>
                    </div>
                    <div className="rounded border border-slate-200 p-2">
                      <div className="font-semibold text-slate-900">{member.badges.length}</div>
                      <div>Badges</div>
                    </div>
                    <div className="rounded border border-slate-200 p-2">
                      <div className="font-semibold text-slate-900">{member.challenges.length}</div>
                      <div>Active challenges</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      defaultValue={member.totalXp}
                      onBlur={(e) => handleOverride(member.id, e.target.value)}
                      className="max-w-[160px]"
                    />
                    <span className="text-xs text-slate-500">Override total XP (stubbed, updates in-memory)</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weekly challenges</CardTitle>
            <CardDescription>Live for the current staff cohort (stubbed).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {challenges.map((ch) => (
              <div key={ch.id} className="rounded border border-slate-200 p-3 bg-gradient-to-br from-white via-emerald-50/30 to-white">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-semibold text-slate-900">{ch.title}</div>
                    <div className="text-xs text-slate-500">{ch.description}</div>
                  </div>
                  <Badge variant="outline">{ch.cadence === "weekly" ? "Weekly" : "Seasonal"}</Badge>
                </div>
                <div className="text-xs text-slate-600 mt-1">Reward: {ch.rewardBadge || "Badge"}</div>
              </div>
            ))}
            {challenges.length === 0 && <div className="text-sm text-slate-600">No challenges configured.</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manual Merit XP</CardTitle>
            <CardDescription>Managers can recognize above-and-beyond work.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label>Staff member</Label>
                <Select value={awardTarget} onValueChange={setAwardTarget}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select staff" />
                  </SelectTrigger>
                  <SelectContent>
                    {staffOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Category</Label>
                <Select value={awardCategory} onValueChange={(v) => setAwardCategory(v as CategoryValue)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Category" />
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
                <Label>XP</Label>
                <Input type="number" value={awardXp} onChange={(e) => setAwardXp(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Badge (optional)</Label>
                <Select value={awardBadgeId || ""} onValueChange={(v) => setAwardBadgeId(v || null)}>
                  <SelectTrigger>
                    <SelectValue placeholder="No badge" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No badge</SelectItem>
                    {badgeLibrary.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name} · {b.tier || "untiered"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Reason</Label>
              <Textarea rows={2} value={awardReason} onChange={(e) => setAwardReason(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleAward} disabled={loading}>
                Award XP & cheer
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Badge editor (stub)</CardTitle>
            <CardDescription>Create, edit, or remove badges in the library.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Badge name</Label>
                <Input value={badgeName} onChange={(e) => setBadgeName(e.target.value)} placeholder="e.g., Checklist Champ" />
              </div>
              <div className="space-y-1">
                <Label>Tier</Label>
                <Select value={badgeTier} onValueChange={setBadgeTier}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tier" />
                  </SelectTrigger>
                  <SelectContent>
                    {tierOptions.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Input value={badgeDescription} onChange={(e) => setBadgeDescription(e.target.value)} placeholder="What unlocks this badge?" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleBadgeSave} disabled={loading}>
                {editingBadgeId ? "Update badge" : "Add badge"}
              </Button>
              {editingBadgeId && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditingBadgeId(null);
                    setBadgeName("");
                    setBadgeDescription("");
                    setBadgeTier("bronze");
                  }}
                >
                  Cancel edit
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <div className="text-xs text-slate-500">Stub-only: persists in-memory until reload.</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {badgeLibrary.map((badge) => (
                  <div key={badge.id} className="rounded border border-slate-200 p-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{badge.name}</div>
                      <div className="text-xs text-slate-500">{badge.description}</div>
                      <div className="text-xs text-emerald-700 mt-1">{badge.tier || "untiered"}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleBadgeEdit(badge)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleBadgeDelete(badge.id)}>
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
                {badgeLibrary.length === 0 && <div className="text-sm text-slate-600">No badges defined yet.</div>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leaderboard (weekly)</CardTitle>
            <CardDescription>Snapshot of the current top performers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(leaderboard?.leaderboard || []).map((row) => (
              <div key={row.userId} className="flex items-center justify-between rounded border border-slate-100 px-3 py-2 bg-white/80">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="w-10 justify-center">{row.rank}</Badge>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{row.name}</div>
                    <div className="text-xs text-slate-500">{row.role || "staff"}</div>
                  </div>
                </div>
                <div className="text-sm font-semibold text-slate-900">+{row.xp} XP</div>
              </div>
            ))}
            {(leaderboard?.leaderboard?.length ?? 0) === 0 && <div className="text-sm text-slate-600">No XP events yet.</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
            <CardDescription>Controls are stubbed and stored in-memory.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <div>Opt-in and overrides are persisted only for this session.</div>
            <div>Use this view to demo toggles, overrides, challenges, badges, and leaderboards without external dependencies.</div>
          </CardContent>
        </Card>
      </div>
  );
}

