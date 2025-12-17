"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchLeaderboard,
  fetchStaffDashboard,
  listBadgeLibrary,
  listStaff,
  type GamificationBadge,
  type GamificationEvent,
} from "@/lib/gamification/stub-data";
import { launchConfetti } from "@/lib/gamification/confetti";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import {
  Trophy,
  Flame,
  Target,
  Award,
  TrendingUp,
  Star,
  Zap,
  Crown,
  Medal,
  Sparkles,
  ChevronRight,
  Clock,
  Gift,
  Users,
} from "lucide-react";

const categoryLabels: Record<string, string> = {
  task: "Tasks",
  maintenance: "Maintenance",
  check_in: "Check-ins",
  reservation_quality: "Reservations",
  checklist: "Checklists",
  review_mention: "Reviews",
  on_time_assignment: "On-time",
  assist: "Assists",
  manual: "Merit",
  other: "Other",
};

const CATEGORY_COLORS: Record<string, string> = {
  task: "#3b82f6",
  maintenance: "#f59e0b",
  check_in: "#10b981",
  reservation_quality: "#8b5cf6",
  checklist: "#ec4899",
  review_mention: "#06b6d4",
  on_time_assignment: "#f97316",
  assist: "#14b8a6",
  manual: "#6366f1",
  other: "#94a3b8",
};

const BADGE_EMOJIS: Record<string, string> = {
  bronze: "🥉",
  silver: "🥈",
  gold: "🥇",
  platinum: "💎",
};

const LEVEL_TITLES: Record<number, string> = {
  1: "Rookie",
  2: "Camper",
  3: "Explorer",
  4: "Ranger",
  5: "Trailblazer",
  6: "Pathfinder",
  7: "Guide",
  8: "Master",
  9: "Legend",
  10: "Champion",
};

// Animated circular progress ring
function ProgressRing({ progress, size = 180, strokeWidth = 12, children }: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle with gradient */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#progressGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="50%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

// Animated XP counter
function AnimatedNumber({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const duration = 1000;
    const steps = 30;
    const increment = value / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  return <span>{prefix}{displayValue.toLocaleString()}{suffix}</span>;
}

// Podium component for top 3
function Podium({ leaderboard }: { leaderboard: any[] }) {
  const top3 = leaderboard.slice(0, 3);
  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
  const heights = ["h-24", "h-32", "h-20"];
  const colors = ["bg-gradient-to-t from-slate-300 to-slate-200", "bg-gradient-to-t from-amber-400 to-yellow-300", "bg-gradient-to-t from-amber-700 to-amber-600"];
  const positions = ["2nd", "1st", "3rd"];
  const icons = [<Medal key="2" className="w-6 h-6 text-slate-500" />, <Crown key="1" className="w-8 h-8 text-yellow-500" />, <Medal key="3" className="w-5 h-5 text-amber-700" />];

  if (top3.length === 0) return null;

  return (
    <div className="flex items-end justify-center gap-4 py-8">
      {podiumOrder.map((person, idx) => {
        if (!person) return null;
        const actualIdx = idx === 1 ? 0 : idx === 0 ? 1 : 2;
        return (
          <div key={person.userId} className="flex flex-col items-center">
            <div className="mb-2 text-center">
              {icons[idx]}
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-100 to-cyan-100 border-4 border-white shadow-lg flex items-center justify-center text-2xl font-bold text-emerald-600 mx-auto mb-2">
                {person.name?.charAt(0) || "?"}
              </div>
              <div className="font-semibold text-slate-900 text-sm truncate max-w-[80px]">{person.name}</div>
              <div className="text-xs text-slate-500">{person.xp.toLocaleString()} XP</div>
            </div>
            <div className={`w-20 ${heights[idx]} ${colors[idx]} rounded-t-lg flex items-center justify-center shadow-md`}>
              <span className="font-bold text-white text-lg drop-shadow">{positions[idx]}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Streak display
function StreakDisplay({ weeklyXp, streak = 0 }: { weeklyXp: number; streak?: number }) {
  const hasStreak = weeklyXp > 0;

  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${hasStreak ? "bg-gradient-to-r from-orange-100 to-amber-100 border border-orange-200" : "bg-slate-100 border border-slate-200"}`}>
      <Flame className={`w-5 h-5 ${hasStreak ? "text-orange-500 animate-pulse" : "text-slate-400"}`} />
      <span className={`font-semibold ${hasStreak ? "text-orange-700" : "text-slate-500"}`}>
        {hasStreak ? `${weeklyXp} XP this week!` : "Start your streak!"}
      </span>
    </div>
  );
}

// Badge card with visual appeal
function BadgeCard({ badge, isEarned, large = false }: { badge: any; isEarned: boolean; large?: boolean }) {
  const emoji = BADGE_EMOJIS[badge.tier?.toLowerCase()] || "🏅";

  return (
    <div className={`
      relative overflow-hidden rounded-xl border-2 transition-all duration-300
      ${isEarned
        ? "bg-gradient-to-br from-emerald-50 via-white to-cyan-50 border-emerald-200 shadow-md hover:shadow-lg hover:-translate-y-1"
        : "bg-slate-50 border-slate-200 opacity-60 grayscale"
      }
      ${large ? "p-6" : "p-4"}
    `}>
      {isEarned && (
        <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-emerald-200/50 to-transparent rounded-bl-full" />
      )}
      <div className="flex items-start gap-3">
        <div className={`
          flex items-center justify-center rounded-xl
          ${large ? "w-16 h-16 text-3xl" : "w-12 h-12 text-2xl"}
          ${isEarned ? "bg-gradient-to-br from-emerald-100 to-cyan-100" : "bg-slate-200"}
        `}>
          {emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className={`font-semibold text-slate-900 ${large ? "text-lg" : "text-sm"}`}>{badge.name}</h4>
            {badge.tier && (
              <Badge variant="outline" className={`text-xs ${isEarned ? "border-emerald-300 text-emerald-700" : ""}`}>
                {badge.tier}
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{badge.description}</p>
          {isEarned && badge.earnedAt && (
            <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Earned {new Date(badge.earnedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
      {!isEarned && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/5">
          <div className="bg-white/90 rounded-full px-3 py-1 text-xs font-medium text-slate-600 shadow">
            🔒 Locked
          </div>
        </div>
      )}
    </div>
  );
}

// XP Event row
function XpEventRow({ event }: { event: GamificationEvent }) {
  const isPositive = event.xp >= 0;

  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors px-2 rounded">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isPositive ? "bg-emerald-100" : "bg-amber-100"}`}>
          {isPositive ? <TrendingUp className="w-5 h-5 text-emerald-600" /> : <Zap className="w-5 h-5 text-amber-600" />}
        </div>
        <div>
          <div className="font-medium text-slate-900 text-sm">{categoryLabels[event.category] || event.category}</div>
          <div className="text-xs text-slate-500">{event.reason || "Activity completed"}</div>
        </div>
      </div>
      <div className="text-right">
        <div className={`font-bold ${isPositive ? "text-emerald-600" : "text-amber-600"}`}>
          {isPositive ? "+" : ""}{event.xp} XP
        </div>
        <div className="text-xs text-slate-400">{new Date(event.createdAt).toLocaleDateString()}</div>
      </div>
    </div>
  );
}

// Challenge card
function ChallengeCard({ challenge }: { challenge: any }) {
  const progress = Math.min(100, Math.round((challenge.currentXp / (challenge.challenge?.targetXp || 1)) * 100));
  const isComplete = challenge.status === "completed";

  return (
    <div className={`
      rounded-xl border-2 p-4 transition-all
      ${isComplete
        ? "bg-gradient-to-br from-emerald-50 to-cyan-50 border-emerald-300"
        : "bg-white border-slate-200 hover:border-emerald-200"
      }
    `}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isComplete ? "bg-emerald-500" : "bg-slate-100"}`}>
            {isComplete ? <Trophy className="w-5 h-5 text-white" /> : <Target className="w-5 h-5 text-slate-500" />}
          </div>
          <div>
            <h4 className="font-semibold text-slate-900">{challenge.challenge?.title || "Challenge"}</h4>
            <p className="text-xs text-slate-500">{challenge.challenge?.description}</p>
          </div>
        </div>
        {isComplete && (
          <Badge className="bg-emerald-500 text-white">Complete!</Badge>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">{challenge.currentXp} / {challenge.challenge?.targetXp} XP</span>
          <span className="font-medium text-emerald-600">{progress}%</span>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isComplete ? "bg-gradient-to-r from-emerald-400 to-cyan-400" : "bg-gradient-to-r from-emerald-500 to-emerald-400"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Gift className="w-3 h-3" />
          Reward: <span className="font-medium text-emerald-600">{challenge.challenge?.rewardBadge || "Badge"}</span>
        </div>
      </div>
    </div>
  );
}

export default function GamificationDashboardPage() {
  const staffOptions = useMemo(() => listStaff(), []);
  const [selectedUserId, setSelectedUserId] = useState<string>(staffOptions[0]?.id || "");
  const [windowKey, setWindowKey] = useState<"weekly" | "seasonal" | "all">("weekly");
  const [dashboard, setDashboard] = useState<any | null>(null);
  const [leaderboard, setLeaderboard] = useState<{ leaderboard: any[]; viewer: any | null } | null>(null);
  const prevLevelRef = useRef<number | null>(null);
  const prevBadgesRef = useRef<number | null>(null);
  const [badgeLibrary, setBadgeLibrary] = useState<any[]>([]);
  const [badgeTierFilter, setBadgeTierFilter] = useState<string>("all");
  const earnedBadgeNames = useMemo(() => new Set((dashboard?.badges || []).map((b: any) => b.name)), [dashboard?.badges]);

  useEffect(() => {
    let active = true;
    fetchStaffDashboard(selectedUserId || staffOptions[0]?.id || "").then((res) => {
      if (!active) return;
      const levelBefore = prevLevelRef.current;
      const badgeCountBefore = prevBadgesRef.current;

      setDashboard(res);
      if (levelBefore && res.level?.level && res.level.level > levelBefore) {
        launchConfetti({ particles: 200, durationMs: 2000, spread: Math.PI * 1.5 });
      }
      const badgeCountAfter = res.badges?.length ?? 0;
      if (badgeCountBefore !== null && badgeCountAfter > badgeCountBefore) {
        launchConfetti({ particles: 150, durationMs: 1500, spread: Math.PI * 1.3 });
      }
      prevLevelRef.current = res.level?.level ?? null;
      prevBadgesRef.current = badgeCountAfter;
    });
    setBadgeLibrary(listBadgeLibrary());
    return () => { active = false; };
  }, [selectedUserId, staffOptions]);

  useEffect(() => {
    let active = true;
    fetchLeaderboard(windowKey, selectedUserId || staffOptions[0]?.id || "").then((res) => {
      if (!active) return;
      setLeaderboard(res);
    });
    return () => { active = false; };
  }, [selectedUserId, staffOptions, windowKey]);

  const progressPercent = dashboard?.level ? Math.round((dashboard.level.progressToNext || 0) * 100) : 0;
  const currentLevel = dashboard?.level?.level ?? 1;
  const levelTitle = LEVEL_TITLES[currentLevel] || "Champion";
  const totalXp = dashboard?.balance?.totalXp ?? 0;
  const weeklyXp = dashboard?.balance?.weeklyXp ?? 0;
  const badgeCount = dashboard?.badges?.length ?? 0;
  const xpRemaining = dashboard?.level?.nextMinXp ? dashboard.level.nextMinXp - totalXp : 0;

  // Prepare category breakdown for pie chart
  const categoryData = useMemo(() => {
    const cats = dashboard?.categories || [];
    return cats.map((c: any) => ({
      name: categoryLabels[c.category] || c.category,
      value: c.xp,
      color: CATEGORY_COLORS[c.category] || "#94a3b8",
    }));
  }, [dashboard?.categories]);

  const selectedStaff = staffOptions.find((s) => s.id === selectedUserId);

  if (!dashboard?.enabled || !dashboard?.allowed) {
    return (
      <DashboardShell>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center mb-6">
            <Trophy className="w-12 h-12 text-slate-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Gamification Not Available</h1>
          <p className="text-slate-500 max-w-md">
            {!dashboard?.enabled
              ? "Gamification is not enabled for this property. Ask your manager to turn it on in Settings."
              : "Your role doesn't currently participate in gamification."}
          </p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6 max-w-6xl">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 p-8 text-white">
          <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10" />
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />

          <div className="relative flex flex-col md:flex-row items-center gap-8">
            {/* Level Ring */}
            <ProgressRing progress={progressPercent} size={180} strokeWidth={14}>
              <div className="text-center">
                <div className="text-5xl font-bold">{currentLevel}</div>
                <div className="text-sm opacity-90">{levelTitle}</div>
              </div>
            </ProgressRing>

            {/* Stats */}
            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                <h1 className="text-3xl font-bold">
                  {selectedStaff?.name || "Staff Member"}
                </h1>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="bg-white/20 border border-white/30 rounded-lg px-2 py-1 text-sm backdrop-blur"
                >
                  {staffOptions.map((staff) => (
                    <option key={staff.id} value={staff.id} className="text-slate-900">
                      {staff.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                  <div className="text-3xl font-bold">
                    <AnimatedNumber value={totalXp} />
                  </div>
                  <div className="text-sm opacity-90">Total XP</div>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                  <div className="text-3xl font-bold">{badgeCount}</div>
                  <div className="text-sm opacity-90">Badges</div>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                  <div className="text-3xl font-bold">{xpRemaining}</div>
                  <div className="text-sm opacity-90">XP to Level {currentLevel + 1}</div>
                </div>
              </div>

              <div className="mt-4 flex justify-center md:justify-start">
                <StreakDisplay weeklyXp={weeklyXp} />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview" className="gap-2">
              <Zap className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="gap-2">
              <Trophy className="w-4 h-4" />
              Leaderboard
            </TabsTrigger>
            <TabsTrigger value="badges" className="gap-2">
              <Award className="w-4 h-4" />
              Badges
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2">
              <Clock className="w-4 h-4" />
              Activity
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Challenges */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-emerald-600" />
                        Weekly Challenges
                      </CardTitle>
                      <CardDescription>Complete challenges to earn badges</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(dashboard.weeklyChallenges || []).length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <Target className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                      <p>No active challenges this week</p>
                    </div>
                  ) : (
                    (dashboard.weeklyChallenges || []).map((ch: any) => (
                      <ChallengeCard key={ch.challengeId} challenge={ch} />
                    ))
                  )}
                </CardContent>
              </Card>

              {/* XP Breakdown Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-500" />
                    XP Breakdown
                  </CardTitle>
                  <CardDescription>Where your XP comes from</CardDescription>
                </CardHeader>
                <CardContent>
                  {categoryData.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <Star className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                      <p>No XP earned yet</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={categoryData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={3}
                            dataKey="value"
                            nameKey="name"
                          >
                            {categoryData.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number) => [`${value} XP`, ""]}
                            contentStyle={{
                              backgroundColor: "white",
                              border: "1px solid #e2e8f0",
                              borderRadius: "8px",
                              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)"
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap justify-center gap-3 mt-2">
                        {categoryData.map((cat: any) => (
                          <div key={cat.name} className="flex items-center gap-2 text-sm">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                            <span className="text-slate-600">{cat.name}</span>
                            <span className="font-medium text-slate-900">{cat.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Recent Badges */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-purple-600" />
                      Recent Badges
                    </CardTitle>
                    <CardDescription>Your latest achievements</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" className="text-emerald-600">
                    View all <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {(dashboard.badges || []).length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Award className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p>No badges earned yet. Complete challenges to earn your first badge!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(dashboard.badges || []).slice(0, 3).map((badge: any) => (
                      <BadgeCard key={badge.id} badge={badge} isEarned={true} large />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Leaderboard Tab */}
          <TabsContent value="leaderboard" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-amber-500" />
                      Leaderboard
                    </CardTitle>
                    <CardDescription>See how you stack up against the team</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {(["weekly", "seasonal", "all"] as const).map((key) => (
                      <Button
                        key={key}
                        size="sm"
                        variant={windowKey === key ? "default" : "outline"}
                        onClick={() => setWindowKey(key)}
                        className={windowKey === key ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                      >
                        {key === "all" ? "All-time" : key.charAt(0).toUpperCase() + key.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Podium for top 3 */}
                {(leaderboard?.leaderboard?.length ?? 0) >= 3 && (
                  <Podium leaderboard={leaderboard?.leaderboard || []} />
                )}

                {/* Full rankings */}
                <div className="space-y-2 mt-4">
                  {(leaderboard?.leaderboard || []).map((row, idx) => {
                    const isViewer = leaderboard?.viewer?.userId === row.userId;
                    const isTop3 = idx < 3;

                    return (
                      <div
                        key={row.userId}
                        className={`
                          flex items-center justify-between p-4 rounded-xl transition-all
                          ${isViewer ? "bg-gradient-to-r from-emerald-50 to-cyan-50 border-2 border-emerald-200 shadow-sm" : "bg-slate-50 border border-slate-100 hover:border-slate-200"}
                        `}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`
                            w-10 h-10 rounded-full flex items-center justify-center font-bold
                            ${isTop3
                              ? idx === 0 ? "bg-gradient-to-br from-amber-400 to-yellow-300 text-white"
                                : idx === 1 ? "bg-gradient-to-br from-slate-300 to-slate-200 text-slate-700"
                                : "bg-gradient-to-br from-amber-700 to-amber-600 text-white"
                              : "bg-slate-200 text-slate-600"
                            }
                          `}>
                            {isTop3 ? ["🥇", "🥈", "🥉"][idx] : row.rank}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-2">
                              {row.name}
                              {isViewer && <Badge className="bg-emerald-100 text-emerald-700 text-xs">You</Badge>}
                            </div>
                            <div className="text-sm text-slate-500">{row.role || "Staff"}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-lg text-emerald-600">+{row.xp.toLocaleString()}</div>
                          <div className="text-xs text-slate-500">XP</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Badges Tab */}
          <TabsContent value="badges" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-purple-600" />
                      Badge Collection
                    </CardTitle>
                    <CardDescription>
                      {earnedBadgeNames.size} of {badgeLibrary.length} badges earned
                    </CardDescription>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {["all", "bronze", "silver", "gold", "platinum"].map((tier) => (
                      <Button
                        key={tier}
                        size="sm"
                        variant={badgeTierFilter === tier ? "default" : "outline"}
                        onClick={() => setBadgeTierFilter(tier)}
                        className={badgeTierFilter === tier ? "bg-purple-600 hover:bg-purple-700" : ""}
                      >
                        {tier === "all" ? "All" : `${BADGE_EMOJIS[tier] || ""} ${tier}`}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Progress bar */}
                <div className="mb-6 p-4 bg-slate-50 rounded-xl">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-600">Collection Progress</span>
                    <span className="font-medium text-purple-600">
                      {Math.round((earnedBadgeNames.size / badgeLibrary.length) * 100)}%
                    </span>
                  </div>
                  <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
                      style={{ width: `${(earnedBadgeNames.size / badgeLibrary.length) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {badgeLibrary
                    .filter((badge) => badgeTierFilter === "all" || badge.tier?.toLowerCase() === badgeTierFilter)
                    .sort((a, b) => {
                      const aEarned = earnedBadgeNames.has(a.name);
                      const bEarned = earnedBadgeNames.has(b.name);
                      if (aEarned !== bEarned) return aEarned ? -1 : 1;
                      return 0;
                    })
                    .map((badge) => {
                      const isEarned = earnedBadgeNames.has(badge.name);
                      const earnedBadge = (dashboard?.badges || []).find((b: any) => b.name === badge.name);
                      return (
                        <BadgeCard
                          key={badge.id}
                          badge={isEarned ? { ...badge, earnedAt: earnedBadge?.earnedAt } : badge}
                          isEarned={isEarned}
                        />
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  Recent Activity
                </CardTitle>
                <CardDescription>Your XP earning history</CardDescription>
              </CardHeader>
              <CardContent>
                {(dashboard.recentEvents || []).length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Clock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p>No activity yet. Start earning XP!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {(dashboard.recentEvents || []).map((event: GamificationEvent) => (
                      <XpEventRow key={event.id} event={event} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardShell>
  );
}
