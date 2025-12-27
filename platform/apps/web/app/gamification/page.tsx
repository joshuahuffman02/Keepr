"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCampground } from "@/contexts/CampgroundContext";
import { useWhoami } from "@/hooks/use-whoami";
import { apiClient } from "@/lib/api-client";
import { launchConfetti } from "@/lib/gamification/confetti";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { motion, AnimatePresence } from "framer-motion";
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
  X,
  Check,
  Loader2,
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

// Types for API responses
type XpEvent = {
  id: string;
  category: string;
  xp: number;
  reason?: string | null;
  createdAt: string;
};

// Level Up Modal Component
function LevelUpModal({
  isOpen,
  onClose,
  newLevel,
  levelTitle,
}: {
  isOpen: boolean;
  onClose: () => void;
  newLevel: number;
  levelTitle: string;
}) {
  useEffect(() => {
    if (isOpen) {
      launchConfetti({ particles: 300, durationMs: 3000, spread: Math.PI * 2 });
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 text-center shadow-2xl relative overflow-hidden"
            initial={{ scale: 0.5, rotateY: -180, opacity: 0 }}
            animate={{ scale: 1, rotateY: 0, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: "spring", duration: 0.8 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Background decoration */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-cyan-50" />
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-emerald-200/30 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-cyan-200/30 rounded-full blur-3xl" />

            <div className="relative">
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute -top-2 -right-2 p-2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Animated level badge */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              >
                <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-500 flex items-center justify-center shadow-2xl shadow-emerald-500/30">
                  <span className="text-6xl font-bold text-white">{newLevel}</span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <h2 className="text-3xl font-bold text-slate-900 mb-2 flex items-center justify-center gap-2">
                  Level Up! <Sparkles className="h-8 w-8 text-amber-500" />
                </h2>
                <p className="text-xl text-emerald-600 font-semibold mb-4">
                  You're now a <span className="text-emerald-700">{levelTitle}</span>!
                </p>
                <p className="text-slate-600 mb-6">
                  Keep up the amazing work! New challenges and rewards await.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
              >
                <Button
                  onClick={onClose}
                  className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white px-8 py-3 text-lg font-semibold shadow-lg shadow-emerald-500/30"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Keep Crushing It!
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// XP Toast Notification Component
function XpToast({
  xp,
  category,
  reason,
  onClose,
}: {
  xp: number;
  category: string;
  reason?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl p-4 shadow-2xl min-w-[280px] max-w-sm"
      initial={{ opacity: 0, x: 100, scale: 0.8 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.8 }}
      transition={{ type: "spring", stiffness: 200 }}
    >
      <div className="flex items-center gap-3">
        <motion.div
          className="text-4xl"
          animate={{ rotate: [0, -10, 10, -10, 0] }}
          transition={{ duration: 0.5 }}
        >
          {xp > 0 ? "✨" : "🏅"}
        </motion.div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <motion.span
              className="text-2xl font-bold"
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.3, 1] }}
              transition={{ delay: 0.1 }}
            >
              {xp > 0 ? `+${xp} XP` : reason}
            </motion.span>
            <motion.span
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Sparkles className="h-5 w-5" />
            </motion.span>
          </div>

          {xp > 0 && (
            <>
              <div className="text-sm opacity-90">
                {categoryLabels[category] || category}
              </div>
              {reason && (
                <div className="text-xs opacity-75 mt-1">{reason}</div>
              )}
            </>
          )}
        </div>

        <button
          onClick={onClose}
          className="p-1 hover:bg-white/20 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

// XP Toast Container
function XpToastContainer({
  toasts,
  onRemove,
}: {
  toasts: Array<{ id: string; xp: number; category: string; reason?: string }>;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3">
      <AnimatePresence>
        {toasts.map((toast) => (
          <XpToast
            key={toast.id}
            xp={toast.xp}
            category={toast.category}
            reason={toast.reason}
            onClose={() => onRemove(toast.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

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

// Streak display (approximated from events - we could add proper streak tracking)
function StreakDisplay({ recentEvents }: { recentEvents: XpEvent[] }) {
  // Count events from the last 7 days
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weeklyXp = recentEvents
    .filter(e => new Date(e.createdAt) >= weekAgo)
    .reduce((sum, e) => sum + e.xp, 0);
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

// XP Event row
function XpEventRow({ event }: { event: XpEvent }) {
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

export default function GamificationDashboardPage() {
  const { selectedCampground, isHydrated } = useCampground();
  const { data: whoami, isLoading: whoamiLoading, error: whoamiError } = useWhoami();
  const campgroundId = selectedCampground?.id;

  const [windowKey, setWindowKey] = useState<"weekly" | "monthly" | "all">("weekly");
  const prevLevelRef = useRef<number | null>(null);

  // Level up modal state
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [levelUpData, setLevelUpData] = useState<{ level: number; title: string }>({ level: 1, title: "Rookie" });

  // XP toasts state
  const [xpToasts, setXpToasts] = useState<Array<{ id: string; xp: number; category: string; reason?: string }>>([]);

  const addXpToast = useCallback((xp: number, category: string, reason?: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setXpToasts((prev) => [...prev, { id, xp, category, reason }]);
  }, []);

  const removeXpToast = useCallback((id: string) => {
    setXpToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Loading timeout to prevent infinite loading
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  useEffect(() => {
    const timeout = setTimeout(() => setLoadingTimedOut(true), 20000);
    return () => clearTimeout(timeout);
  }, []);

  // Fetch dashboard data
  const { data: dashboard, isLoading: dashboardLoading, error: dashboardError } = useQuery({
    queryKey: ["gamification-dashboard", campgroundId],
    queryFn: async () => {
      console.log("[Gamification] Fetching dashboard for campground:", campgroundId);
      try {
        const result = await apiClient.getGamificationDashboard(campgroundId!);
        console.log("[Gamification] Dashboard loaded successfully");
        return result;
      } catch (err) {
        console.error("[Gamification] Dashboard fetch failed:", err);
        throw err;
      }
    },
    enabled: !!campgroundId,
    retry: 1,
    staleTime: 30000,
  });

  // Fetch leaderboard
  const daysMap: Record<string, number | undefined> = { weekly: 7, monthly: 30, all: undefined };
  const { data: leaderboardData } = useQuery({
    queryKey: ["gamification-leaderboard", campgroundId, windowKey],
    queryFn: () => apiClient.getGamificationLeaderboard(campgroundId!, daysMap[windowKey]),
    enabled: !!campgroundId,
  });

  // Fetch stats for category breakdown
  const { data: statsData } = useQuery({
    queryKey: ["gamification-stats", campgroundId],
    queryFn: () => apiClient.getGamificationStats(campgroundId!, 30),
    enabled: !!campgroundId,
  });

  // Check for level up
  useEffect(() => {
    if (!dashboard?.level) return;
    const currentLevel = dashboard.level.level;
    const levelBefore = prevLevelRef.current;

    if (levelBefore !== null && currentLevel > levelBefore) {
      const title = LEVEL_TITLES[currentLevel] || "Champion";
      setLevelUpData({ level: currentLevel, title });
      setShowLevelUpModal(true);
    }

    prevLevelRef.current = currentLevel;
  }, [dashboard?.level]);

  const currentLevel = dashboard?.level?.level ?? 1;
  const levelTitle = LEVEL_TITLES[currentLevel] || "Champion";
  const totalXp = dashboard?.balance?.totalXp ?? 0;
  const progressPercent = dashboard?.level ? Math.round((dashboard.level.progressToNext || 0) * 100) : 0;
  const xpRemaining = dashboard?.level?.nextMinXp ? dashboard.level.nextMinXp - totalXp : 0;
  const recentEvents = (dashboard?.recentEvents || []) as XpEvent[];

  // Prepare category breakdown for pie chart
  const categoryData = useMemo(() => {
    const cats = statsData?.categories || [];
    return cats.map((c: any) => ({
      name: categoryLabels[c.category] || c.category,
      value: c.xp,
      color: CATEGORY_COLORS[c.category] || "#94a3b8",
    })).filter((c: any) => c.value > 0);
  }, [statsData?.categories]);

  const userName = whoami?.user
    ? `${whoami.user.firstName || ""} ${whoami.user.lastName || ""}`.trim() || whoami.user.email
    : "Staff Member";

  // Wait for hydration before showing content to avoid hydration mismatch
  const isLoading = !isHydrated || dashboardLoading || whoamiLoading;

  // Debug logging
  useEffect(() => {
    console.log("[Gamification] State:", {
      isHydrated,
      campgroundId,
      dashboardLoading,
      whoamiLoading,
      isLoading,
      loadingTimedOut,
      dashboardError: dashboardError?.message,
      whoamiError: whoamiError?.message,
    });
  }, [isHydrated, campgroundId, dashboardLoading, whoamiLoading, isLoading, loadingTimedOut, dashboardError, whoamiError]);

  if (isLoading && !loadingTimedOut) {
    return (
      <DashboardShell>
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
          <p className="text-slate-500">Loading your stats...</p>
        </div>
      </DashboardShell>
    );
  }

  // Show error state if API calls failed or loading timed out (while still loading)
  if (dashboardError || whoamiError || (loadingTimedOut && isLoading)) {
    return (
      <DashboardShell>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center mb-6">
            <Trophy className="w-12 h-12 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Unable to Load Stats</h1>
          <p className="text-slate-500 max-w-md mb-4">
            {loadingTimedOut
              ? "Loading took too long. The server may be unavailable. Please try again later."
              : "There was an error loading your gamification data. Please try refreshing the page."}
          </p>
          <p className="text-xs text-slate-400 mb-4">
            {(dashboardError as Error)?.message || (whoamiError as Error)?.message || (loadingTimedOut ? "Request timeout" : "Unknown error")}
          </p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Refresh Page
          </Button>
        </div>
      </DashboardShell>
    );
  }

  // No campground selected (only check after hydration)
  if (!campgroundId) {
    return (
      <DashboardShell>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center mb-6">
            <Trophy className="w-12 h-12 text-slate-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Select a Campground</h1>
          <p className="text-slate-500 max-w-md">
            Please select a campground from the sidebar to view your gamification stats.
          </p>
        </div>
      </DashboardShell>
    );
  }

  // Gamification not enabled or not allowed
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
      {/* Level Up Modal */}
      <LevelUpModal
        isOpen={showLevelUpModal}
        onClose={() => setShowLevelUpModal(false)}
        newLevel={levelUpData.level}
        levelTitle={levelUpData.title}
      />

      {/* XP Toast Notifications */}
      <XpToastContainer toasts={xpToasts} onRemove={removeXpToast} />

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
              <h1 className="text-3xl font-bold mb-2">{userName}</h1>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
                <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                  <div className="text-3xl font-bold">
                    <AnimatedNumber value={totalXp} />
                  </div>
                  <div className="text-sm opacity-90">Total XP</div>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                  <div className="text-3xl font-bold">{recentEvents.length}</div>
                  <div className="text-sm opacity-90">Recent Activities</div>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                  <div className="text-3xl font-bold">{xpRemaining > 0 ? xpRemaining : "MAX"}</div>
                  <div className="text-sm opacity-90">XP to Level {currentLevel + 1}</div>
                </div>
              </div>

              <div className="mt-4 flex justify-center md:justify-start">
                <StreakDisplay recentEvents={recentEvents} />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview" className="gap-2">
              <Zap className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="gap-2">
              <Trophy className="w-4 h-4" />
              Leaderboard
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2">
              <Clock className="w-4 h-4" />
              Activity
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* XP Breakdown Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-500" />
                    XP Breakdown
                  </CardTitle>
                  <CardDescription>Where your XP comes from (last 30 days)</CardDescription>
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

              {/* Recent Activity Preview */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-blue-600" />
                        Recent Activity
                      </CardTitle>
                      <CardDescription>Your latest XP earnings</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {recentEvents.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <Clock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                      <p>No activity yet. Start earning XP!</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {recentEvents.slice(0, 5).map((event) => (
                        <XpEventRow key={event.id} event={event} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-emerald-50 to-white">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <TrendingUp className="w-8 h-8 mx-auto text-emerald-600 mb-2" />
                    <div className="text-2xl font-bold text-slate-900">{totalXp}</div>
                    <div className="text-sm text-slate-500">Total XP</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-blue-50 to-white">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Target className="w-8 h-8 mx-auto text-blue-600 mb-2" />
                    <div className="text-2xl font-bold text-slate-900">Level {currentLevel}</div>
                    <div className="text-sm text-slate-500">{levelTitle}</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-amber-50 to-white">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Flame className="w-8 h-8 mx-auto text-amber-600 mb-2" />
                    <div className="text-2xl font-bold text-slate-900">{recentEvents.length}</div>
                    <div className="text-sm text-slate-500">Activities</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-purple-50 to-white">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Award className="w-8 h-8 mx-auto text-purple-600 mb-2" />
                    <div className="text-2xl font-bold text-slate-900">{progressPercent}%</div>
                    <div className="text-sm text-slate-500">To Next Level</div>
                  </div>
                </CardContent>
              </Card>
            </div>
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
                    {(["weekly", "monthly", "all"] as const).map((key) => (
                      <Button
                        key={key}
                        size="sm"
                        variant={windowKey === key ? "default" : "outline"}
                        onClick={() => setWindowKey(key)}
                        className={windowKey === key ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                      >
                        {key === "all" ? "All-time" : key === "monthly" ? "Monthly" : "Weekly"}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Podium for top 3 */}
                {(leaderboardData?.leaderboard?.length ?? 0) >= 3 && (
                  <Podium leaderboard={leaderboardData?.leaderboard || []} />
                )}

                {/* Full rankings */}
                <div className="space-y-2 mt-4">
                  {(leaderboardData?.leaderboard || []).map((row: any) => {
                    const isViewer = leaderboardData?.viewer?.userId === row.userId;
                    const isTop3 = row.rank <= 3;

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
                              ? row.rank === 1 ? "bg-gradient-to-br from-amber-400 to-yellow-300 text-white"
                                : row.rank === 2 ? "bg-gradient-to-br from-slate-300 to-slate-200 text-slate-700"
                                : "bg-gradient-to-br from-amber-700 to-amber-600 text-white"
                              : "bg-slate-200 text-slate-600"
                            }
                          `}>
                            {isTop3 ? ["", "🥇", "🥈", "🥉"][row.rank] : row.rank}
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
                  {(leaderboardData?.leaderboard?.length ?? 0) === 0 && (
                    <div className="text-center py-12 text-slate-500">
                      <Trophy className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                      <p>No leaderboard data yet. Start earning XP!</p>
                    </div>
                  )}
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
                {recentEvents.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Clock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p>No activity yet. Start earning XP!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {recentEvents.map((event) => (
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
