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
import { motion, AnimatePresence } from "framer-motion";

type RechartsModule = typeof import("recharts");

// Dynamic import for recharts to reduce initial bundle size
let PieChart: RechartsModule["PieChart"] | null = null;
let Pie: RechartsModule["Pie"] | null = null;
let Cell: RechartsModule["Cell"] | null = null;
let ResponsiveContainer: RechartsModule["ResponsiveContainer"] | null = null;
let Tooltip: RechartsModule["Tooltip"] | null = null;

const loadRecharts = async () => {
  if (!PieChart) {
    const rechartsModule = await import("recharts");
    PieChart = rechartsModule.PieChart;
    Pie = rechartsModule.Pie;
    Cell = rechartsModule.Cell;
    ResponsiveContainer = rechartsModule.ResponsiveContainer;
    Tooltip = rechartsModule.Tooltip;
  }
  return { PieChart, Pie, Cell, ResponsiveContainer, Tooltip };
};
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

const BADGE_ICONS: Record<string, string> = {
  bronze: "medal",
  silver: "medal",
  gold: "trophy",
  platinum: "gem",
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

type GamificationDashboard = Awaited<ReturnType<typeof apiClient.getGamificationDashboard>>;
type GamificationLeaderboard = Awaited<ReturnType<typeof apiClient.getGamificationLeaderboard>>;
type GamificationStats = Awaited<ReturnType<typeof apiClient.getGamificationStats>>;
type LeaderboardEntry = GamificationLeaderboard["leaderboard"][number];
type XpEvent = GamificationDashboard["recentEvents"][number];

type CategoryDatum = {
  name: string;
  value: number;
  color: string;
};

const LEADERBOARD_WINDOWS: Array<"weekly" | "monthly" | "all"> = ["weekly", "monthly", "all"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (isRecord(error) && typeof error.message === "string") return error.message;
  return fallback;
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
            className="bg-card rounded-3xl p-8 max-w-md w-full mx-4 text-center shadow-2xl relative overflow-hidden"
            initial={{ scale: 0.5, rotateY: -180, opacity: 0 }}
            animate={{ scale: 1, rotateY: 0, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: "spring", duration: 0.8 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Background decoration */}
            <div className="absolute inset-0 bg-muted" />
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-status-success/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-status-info/10 rounded-full blur-3xl" />

            <div className="relative">
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute -top-2 -right-2 p-2 text-muted-foreground hover:text-muted-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Animated level badge */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              >
                <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-action-primary flex items-center justify-center shadow-lg">
                  <span className="text-6xl font-bold text-white">{newLevel}</span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <h2 className="text-3xl font-bold text-foreground mb-2 flex items-center justify-center gap-2">
                  Level Up! <Sparkles className="h-8 w-8 text-status-warning" />
                </h2>
                <p className="text-xl text-status-success font-semibold mb-4">
                  You're now a <span className="text-status-success-text">{levelTitle}</span>!
                </p>
                <p className="text-muted-foreground mb-6">
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
                  className="bg-action-primary text-action-primary-foreground hover:bg-action-primary-hover px-8 py-3 text-lg font-semibold shadow-lg"
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
      className="bg-action-primary text-action-primary-foreground rounded-xl p-4 shadow-2xl min-w-[280px] max-w-sm"
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
          {xp > 0 ? "+" : ""}
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
              <div className="text-sm opacity-90">{categoryLabels[category] || category}</div>
              {reason && <div className="text-xs opacity-75 mt-1">{reason}</div>}
            </>
          )}
        </div>

        <button onClick={onClose} className="p-1 hover:bg-card/20 rounded transition-colors">
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
function ProgressRing({
  progress,
  size = 180,
  strokeWidth = 12,
  children,
}: {
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
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

// Animated XP counter
function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
}: {
  value: number;
  prefix?: string;
  suffix?: string;
}) {
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

  return (
    <span>
      {prefix}
      {displayValue.toLocaleString()}
      {suffix}
    </span>
  );
}

// Podium component for top 3
function Podium({ leaderboard }: { leaderboard: LeaderboardEntry[] }) {
  const top3 = leaderboard.slice(0, 3);
  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
  const heights = ["h-24", "h-32", "h-20"];
  const colors = ["bg-muted", "bg-status-warning", "bg-status-warning/80"];
  const positions = ["2nd", "1st", "3rd"];
  const icons = [
    <Medal key="2" className="w-6 h-6 text-muted-foreground" />,
    <Crown key="1" className="w-8 h-8 text-status-warning" />,
    <Medal key="3" className="w-5 h-5 text-status-warning-text" />,
  ];

  if (top3.length === 0) return null;

  return (
    <div className="flex items-end justify-center gap-4 py-8">
      {podiumOrder.map((person, idx) => {
        if (!person) return null;
        return (
          <div key={person.userId} className="flex flex-col items-center">
            <div className="mb-2 text-center">
              {icons[idx]}
              <div className="w-16 h-16 rounded-full bg-muted border-4 border-card shadow-lg flex items-center justify-center text-2xl font-bold text-status-success mx-auto mb-2">
                {person.name?.charAt(0) || "?"}
              </div>
              <div className="font-semibold text-foreground text-sm truncate max-w-[80px]">
                {person.name}
              </div>
              <div className="text-xs text-muted-foreground">{person.xp.toLocaleString()} XP</div>
            </div>
            <div
              className={`w-20 ${heights[idx]} ${colors[idx]} rounded-t-lg flex items-center justify-center shadow-md`}
            >
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
    .filter((e) => new Date(e.createdAt) >= weekAgo)
    .reduce((sum, e) => sum + e.xp, 0);
  const hasStreak = weeklyXp > 0;

  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 rounded-full ${hasStreak ? "bg-status-warning-bg border border-status-warning-border" : "bg-muted border border-border"}`}
    >
      <Flame
        className={`w-5 h-5 ${hasStreak ? "text-status-warning animate-pulse" : "text-muted-foreground"}`}
      />
      <span
        className={`font-semibold ${hasStreak ? "text-status-warning-text" : "text-muted-foreground"}`}
      >
        {hasStreak ? `${weeklyXp} XP this week!` : "Start your streak!"}
      </span>
    </div>
  );
}

// XP Event row
function XpEventRow({ event }: { event: XpEvent }) {
  const isPositive = event.xp >= 0;

  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0 hover:bg-muted/50 transition-colors px-2 rounded">
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center ${isPositive ? "bg-status-success-bg" : "bg-status-warning-bg"}`}
        >
          {isPositive ? (
            <TrendingUp className="w-5 h-5 text-status-success" />
          ) : (
            <Zap className="w-5 h-5 text-status-warning" />
          )}
        </div>
        <div>
          <div className="font-medium text-foreground text-sm">
            {categoryLabels[event.category] || event.category}
          </div>
          <div className="text-xs text-muted-foreground">
            {event.reason || "Activity completed"}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className={`font-bold ${isPositive ? "text-status-success" : "text-status-warning"}`}>
          {isPositive ? "+" : ""}
          {event.xp} XP
        </div>
        <div className="text-xs text-muted-foreground">
          {new Date(event.createdAt).toLocaleDateString()}
        </div>
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
  const [isRechartsLoaded, setIsRechartsLoaded] = useState(false);
  const charts =
    PieChart && Pie && Cell && ResponsiveContainer && Tooltip
      ? { PieChart, Pie, Cell, ResponsiveContainer, Tooltip }
      : null;

  // Load recharts library
  useEffect(() => {
    loadRecharts().then(() => setIsRechartsLoaded(true));
  }, []);

  // Level up modal state
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [levelUpData, setLevelUpData] = useState<{ level: number; title: string }>({
    level: 1,
    title: "Rookie",
  });

  // XP toasts state
  const [xpToasts, setXpToasts] = useState<
    Array<{ id: string; xp: number; category: string; reason?: string }>
  >([]);

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
  const {
    data: dashboard,
    isLoading: dashboardLoading,
    error: dashboardError,
  } = useQuery<GamificationDashboard>({
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
  const { data: leaderboardData } = useQuery<GamificationLeaderboard>({
    queryKey: ["gamification-leaderboard", campgroundId, windowKey],
    queryFn: () => apiClient.getGamificationLeaderboard(campgroundId!, daysMap[windowKey]),
    enabled: !!campgroundId,
  });

  // Fetch stats for category breakdown
  const { data: statsData } = useQuery<GamificationStats>({
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
  const progressPercent = dashboard?.level
    ? Math.round((dashboard.level.progressToNext || 0) * 100)
    : 0;
  const xpRemaining = dashboard?.level?.nextMinXp ? dashboard.level.nextMinXp - totalXp : 0;
  const recentEvents: XpEvent[] = dashboard?.recentEvents ?? [];

  // Prepare category breakdown for pie chart
  const categoryData = useMemo<CategoryDatum[]>(() => {
    const cats = statsData?.categories ?? [];
    return cats
      .map((category) => ({
        name: categoryLabels[category.category] || category.category,
        value: category.xp,
        color: CATEGORY_COLORS[category.category] || "#94a3b8",
      }))
      .filter((category) => category.value > 0);
  }, [statsData?.categories]);

  const userName = whoami?.user
    ? `${whoami.user.firstName || ""} ${whoami.user.lastName || ""}`.trim() || whoami.user.email
    : "Staff Member";

  // Wait for hydration before showing content to avoid hydration mismatch
  // If hydrated but no campgroundId, don't wait on dashboard (it won't run)
  const isLoading = !isHydrated || whoamiLoading || (campgroundId && dashboardLoading);

  // Debug logging
  useEffect(() => {
    console.log(
      "[Gamification] State:",
      JSON.stringify({
        isHydrated,
        campgroundId: campgroundId || "NONE",
        dashboardLoading,
        whoamiLoading,
        isLoading,
        loadingTimedOut,
        dashboardError: dashboardError?.message || null,
        whoamiError: whoamiError?.message || null,
      }),
    );
  }, [
    isHydrated,
    campgroundId,
    dashboardLoading,
    whoamiLoading,
    isLoading,
    loadingTimedOut,
    dashboardError,
    whoamiError,
  ]);

  if (isLoading && !loadingTimedOut) {
    return (
      <DashboardShell>
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="w-12 h-12 text-status-success animate-spin mb-4" />
          <p className="text-muted-foreground">Loading your stats...</p>
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
          <h1 className="text-2xl font-bold text-foreground mb-2">Unable to Load Stats</h1>
          <p className="text-muted-foreground max-w-md mb-4">
            {loadingTimedOut
              ? "Loading took too long. The server may be unavailable. Please try again later."
              : "There was an error loading your gamification data. Please try refreshing the page."}
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            {getErrorMessage(
              dashboardError,
              getErrorMessage(whoamiError, loadingTimedOut ? "Request timeout" : "Unknown error"),
            )}
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
          <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
            <Trophy className="w-12 h-12 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Select a Campground</h1>
          <p className="text-muted-foreground max-w-md">
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
          <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
            <Trophy className="w-12 h-12 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Gamification Not Available</h1>
          <p className="text-muted-foreground max-w-md">
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
        <div className="relative overflow-hidden rounded-2xl bg-action-primary p-8 text-action-primary-foreground">
          <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10" />
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-card/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-card/10 rounded-full blur-3xl" />

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
                <div className="bg-card/10 backdrop-blur rounded-xl p-4">
                  <div className="text-3xl font-bold">
                    <AnimatedNumber value={totalXp} />
                  </div>
                  <div className="text-sm opacity-90">Total XP</div>
                </div>
                <div className="bg-card/10 backdrop-blur rounded-xl p-4">
                  <div className="text-3xl font-bold">{recentEvents.length}</div>
                  <div className="text-sm opacity-90">Recent Activities</div>
                </div>
                <div className="bg-card/10 backdrop-blur rounded-xl p-4">
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
                    <Star className="w-5 h-5 text-status-warning" />
                    XP Breakdown
                  </CardTitle>
                  <CardDescription>Where your XP comes from (last 30 days)</CardDescription>
                </CardHeader>
                <CardContent>
                  {!isRechartsLoaded || !charts ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-status-success border-t-transparent" />
                        <p>Loading chart...</p>
                      </div>
                    </div>
                  ) : categoryData.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Star className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                      <p>No XP earned yet</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <charts.ResponsiveContainer width="100%" height={220}>
                        <charts.PieChart>
                          <charts.Pie
                            data={categoryData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={3}
                            dataKey="value"
                            nameKey="name"
                          >
                            {categoryData.map((entry, index) => (
                              <charts.Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </charts.Pie>
                          <charts.Tooltip
                            formatter={(value: number) => [`${value} XP`, ""]}
                            contentStyle={{
                              backgroundColor: "white",
                              border: "1px solid #e2e8f0",
                              borderRadius: "8px",
                              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            }}
                          />
                        </charts.PieChart>
                      </charts.ResponsiveContainer>
                      <div className="flex flex-wrap justify-center gap-3 mt-2">
                        {categoryData.map((cat) => (
                          <div key={cat.name} className="flex items-center gap-2 text-sm">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span className="text-muted-foreground">{cat.name}</span>
                            <span className="font-medium text-foreground">{cat.value}</span>
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
                        <Clock className="w-5 h-5 text-status-info" />
                        Recent Activity
                      </CardTitle>
                      <CardDescription>Your latest XP earnings</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {recentEvents.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                      <p>No activity yet. Start earning XP!</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
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
              <Card className="bg-card">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <TrendingUp className="w-8 h-8 mx-auto text-status-success mb-2" />
                    <div className="text-2xl font-bold text-foreground">{totalXp}</div>
                    <div className="text-sm text-muted-foreground">Total XP</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Target className="w-8 h-8 mx-auto text-status-info mb-2" />
                    <div className="text-2xl font-bold text-foreground">Level {currentLevel}</div>
                    <div className="text-sm text-muted-foreground">{levelTitle}</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Flame className="w-8 h-8 mx-auto text-status-warning mb-2" />
                    <div className="text-2xl font-bold text-foreground">{recentEvents.length}</div>
                    <div className="text-sm text-muted-foreground">Activities</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Award className="w-8 h-8 mx-auto text-status-info mb-2" />
                    <div className="text-2xl font-bold text-foreground">{progressPercent}%</div>
                    <div className="text-sm text-muted-foreground">To Next Level</div>
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
                      <Trophy className="w-5 h-5 text-status-warning" />
                      Leaderboard
                    </CardTitle>
                    <CardDescription>See how you stack up against the team</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {LEADERBOARD_WINDOWS.map((key) => (
                      <Button
                        key={key}
                        size="sm"
                        variant={windowKey === key ? "default" : "outline"}
                        onClick={() => setWindowKey(key)}
                        className={
                          windowKey === key
                            ? "bg-action-primary text-action-primary-foreground hover:bg-action-primary-hover"
                            : ""
                        }
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
                  {(leaderboardData?.leaderboard || []).map((row) => {
                    const isViewer = leaderboardData?.viewer?.userId === row.userId;
                    const isTop3 = row.rank <= 3;

                    return (
                      <div
                        key={row.userId}
                        className={`
                          flex items-center justify-between p-4 rounded-xl transition-all
                          ${isViewer ? "bg-status-success-bg border-2 border-status-success-border shadow-sm" : "bg-muted border border-border hover:border-border"}
                        `}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`
                            w-10 h-10 rounded-full flex items-center justify-center font-bold
                            ${
                              isTop3
                                ? row.rank === 1
                                  ? "bg-status-warning text-status-warning-foreground"
                                  : row.rank === 2
                                    ? "bg-muted text-foreground"
                                    : "bg-status-warning/80 text-status-warning-foreground"
                                : "bg-muted text-muted-foreground"
                            }
                          `}
                          >
                            {isTop3 ? ["", "🥇", "🥈", "🥉"][row.rank] : row.rank}
                          </div>
                          <div>
                            <div className="font-semibold text-foreground flex items-center gap-2">
                              {row.name}
                              {isViewer && (
                                <Badge className="bg-status-success/15 text-status-success text-xs">
                                  You
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {row.role || "Staff"}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-lg text-status-success">
                            +{row.xp.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground">XP</div>
                        </div>
                      </div>
                    );
                  })}
                  {(leaderboardData?.leaderboard?.length ?? 0) === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Trophy className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
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
                  <Clock className="w-5 h-5 text-status-info" />
                  Recent Activity
                </CardTitle>
                <CardDescription>Your XP earning history</CardDescription>
              </CardHeader>
              <CardContent>
                {recentEvents.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                    <p>No activity yet. Start earning XP!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {recentEvents.map((event) => (
                      <XpEventRow key={event.id} event={event} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* How to Earn XP Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-status-warning" />
              How to Earn XP
            </CardTitle>
            <CardDescription>
              Complete these activities to level up and climb the leaderboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-status-success-bg border border-status-success-border">
                <div className="w-10 h-10 rounded-full bg-status-success-bg flex items-center justify-center flex-shrink-0">
                  <Check className="w-5 h-5 text-status-success" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Check-ins</div>
                  <div className="text-sm text-muted-foreground">Check guests in smoothly</div>
                  <div className="text-xs text-status-success-text font-medium mt-1">
                    +5 to +25 XP
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg bg-status-info-bg border border-status-info-border">
                <div className="w-10 h-10 rounded-full bg-status-info-bg flex items-center justify-center flex-shrink-0">
                  <Target className="w-5 h-5 text-status-info" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Tasks</div>
                  <div className="text-sm text-muted-foreground">Complete assigned tasks</div>
                  <div className="text-xs text-status-info-text font-medium mt-1">+5 to +25 XP</div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg bg-status-warning-bg border border-status-warning-border">
                <div className="w-10 h-10 rounded-full bg-status-warning-bg flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-status-warning" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Maintenance</div>
                  <div className="text-sm text-muted-foreground">
                    Complete maintenance work orders
                  </div>
                  <div className="text-xs text-status-warning-text font-medium mt-1">
                    +10 to +40 XP
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg bg-status-info-bg border border-status-info-border">
                <div className="w-10 h-10 rounded-full bg-status-info-bg flex items-center justify-center flex-shrink-0">
                  <Star className="w-5 h-5 text-status-info" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Quality Reservations</div>
                  <div className="text-sm text-muted-foreground">
                    Complete reservations with all details
                  </div>
                  <div className="text-xs text-status-info-text font-medium mt-1">+5 to +20 XP</div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg bg-status-success-bg border border-status-success-border">
                <div className="w-10 h-10 rounded-full bg-status-success-bg flex items-center justify-center flex-shrink-0">
                  <Check className="w-5 h-5 text-status-success" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Checklists</div>
                  <div className="text-sm text-muted-foreground">Complete daily checklists</div>
                  <div className="text-xs text-status-success-text font-medium mt-1">
                    +2 to +10 XP
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg bg-status-info-bg border border-status-info-border">
                <div className="w-10 h-10 rounded-full bg-status-info-bg flex items-center justify-center flex-shrink-0">
                  <Award className="w-5 h-5 text-status-info" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Review Mentions</div>
                  <div className="text-sm text-muted-foreground">
                    Get mentioned positively in guest reviews
                  </div>
                  <div className="text-xs text-status-info-text font-medium mt-1">
                    +15 to +50 XP
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg bg-status-warning-bg border border-status-warning-border">
                <div className="w-10 h-10 rounded-full bg-status-warning-bg flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-status-warning" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">On-time Assignments</div>
                  <div className="text-sm text-muted-foreground">
                    Complete assignments before deadline
                  </div>
                  <div className="text-xs text-status-warning-text font-medium mt-1">
                    +5 to +20 XP
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg bg-status-info-bg border border-status-info-border">
                <div className="w-10 h-10 rounded-full bg-status-info-bg flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-status-info" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Team Assists</div>
                  <div className="text-sm text-muted-foreground">
                    Help teammates with their tasks
                  </div>
                  <div className="text-xs text-status-info-text font-medium mt-1">+5 to +20 XP</div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg bg-status-info-bg border border-status-info-border">
                <div className="w-10 h-10 rounded-full bg-status-info-bg flex items-center justify-center flex-shrink-0">
                  <Gift className="w-5 h-5 text-status-info" />
                </div>
                <div>
                  <div className="font-semibold text-foreground">Merit Awards</div>
                  <div className="text-sm text-muted-foreground">
                    Receive recognition from managers
                  </div>
                  <div className="text-xs text-status-info-text font-medium mt-1">
                    +5 to +100 XP
                  </div>
                </div>
              </div>
            </div>

            {/* Level Guide */}
            <div className="mt-8 pt-6 border-t border-border">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-status-success" />
                Level Progression
              </h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(LEVEL_TITLES).map(([level, title]) => (
                  <div
                    key={level}
                    className={`px-3 py-2 rounded-lg border text-sm ${
                      parseInt(level) === currentLevel
                        ? "bg-status-success-bg border-status-success-border text-status-success-text font-semibold"
                        : parseInt(level) < currentLevel
                          ? "bg-muted border-border text-muted-foreground"
                          : "bg-card border-border text-muted-foreground"
                    }`}
                  >
                    <span className="font-medium">Lvl {level}:</span> {title}
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Each level requires progressively more XP. Keep earning to unlock new titles and
                climb the leaderboard!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
