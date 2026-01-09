"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Banknote,
  Calendar,
  CheckCircle,
  ClipboardList,
  Clock,
  DollarSign,
  Hand,
  LogOut,
  MessageCircle,
  Minus,
  Moon,
  PartyPopper,
  Plus,
  RefreshCw,
  Scale,
  Search,
  ShoppingBag,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Tent,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Trophy,
  UserCheck,
  Users
} from "lucide-react";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { apiClient } from "@/lib/api-client";
import { HelpTooltip, HelpTooltipContent, HelpTooltipSection } from "@/components/help/HelpTooltip";
import { PageOnboardingHint } from "@/components/help/OnboardingHint";
import { useTour, DASHBOARD_TOUR } from "@/hooks/use-onboarding-tour";
import { TourOverlay } from "@/components/onboarding/TourOverlay";
import {
  SPRING_CONFIG,
  SPRING_FAST,
  fadeInUp,
  staggerContainer,
  hoverScale,
  getStaggerDelay,
  reducedMotion as reducedMotionVariants
} from "@/lib/animations";
import { cn } from "@/lib/utils";
import { CharityImpactWidget } from "@/components/charity/CharityImpactWidget";
import { SetupQueueWidget } from "@/components/onboarding/SetupQueueWidget";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NpsGauge } from "@/components/analytics/NpsGauge";
import type { NpsMetrics } from "@keepr/shared";

type Reservation = {
  id: string;
  arrivalDate: string;
  departureDate: string;
  status?: string;
  totalAmount?: number;
  paidAmount?: number;
  siteId?: string;
  guest?: {
    primaryFirstName?: string;
    primaryLastName?: string;
  };
};

// Loading skeleton component
function SkeletonCard() {
  return (
    <div className={cn(
      "rounded-xl border p-4 animate-pulse",
      "bg-muted border-border"
    )}>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-muted" />
        <div className="space-y-2 flex-1">
          <div className="h-3 w-16 bg-muted rounded" />
          <div className="h-6 w-12 bg-muted rounded" />
        </div>
      </div>
    </div>
  );
}

// Error state component
function ErrorState({
  message,
  onRetry
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl p-6 space-y-4",
        "bg-red-50 border-2 border-red-200",
        ""
      )}
    >
      <div className="flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-red-600" />
        <h3 className="font-semibold text-red-900">
          Unable to load data
        </h3>
      </div>
      <p className="text-sm text-red-700">
        {message || "Please check your connection and try again."}
      </p>
      <button
        onClick={onRetry}
        className={cn(
          "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold",
          "bg-red-600 text-white hover:bg-red-700",
          "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
        )}
      >
        <RefreshCw className="h-4 w-4" />
        Retry
      </button>
    </motion.div>
  );
}

// Today's Wins component
function TodaysWins({
  todayArrivals,
  todayDepartures,
  outstandingBalanceCents,
  occupancyRate,
  reservationsCount,
  prefersReducedMotion
}: {
  todayArrivals: Reservation[];
  todayDepartures: Reservation[];
  outstandingBalanceCents: number;
  occupancyRate: number;
  reservationsCount: number;
  prefersReducedMotion: boolean | null;
}) {
  const achievements = useMemo(() => {
    const list: { id: string; icon: React.ReactNode; text: string }[] = [];

    if (outstandingBalanceCents === 0 && reservationsCount > 0) {
      list.push({
        id: "paid",
        icon: <DollarSign className="h-4 w-4 text-emerald-600" />,
        text: "All payments collected"
      });
    }

    if (occupancyRate >= 90) {
      list.push({
        id: "busy",
        icon: <Tent className="h-4 w-4 text-purple-600" />,
        text: `${occupancyRate}% occupancy - Nearly full!`
      });
    } else if (occupancyRate >= 70) {
      list.push({
        id: "good-occ",
        icon: <TrendingUp className="h-4 w-4 text-emerald-600" />,
        text: `${occupancyRate}% occupancy - Great day!`
      });
    }

    if (todayArrivals.length >= 5) {
      list.push({
        id: "busy-arrivals",
        icon: <PartyPopper className="h-4 w-4 text-amber-600" />,
        text: `${todayArrivals.length} arrivals today`
      });
    }

    if (todayArrivals.length === todayDepartures.length && todayArrivals.length > 0) {
      list.push({
        id: "balanced",
        icon: <Scale className="h-4 w-4 text-blue-600" />,
        text: "Balanced arrivals & departures"
      });
    }

    return list;
  }, [todayArrivals, todayDepartures, outstandingBalanceCents, occupancyRate, reservationsCount]);

  if (achievements.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING_CONFIG, delay: 0.15 }}
      className={cn(
        "rounded-xl p-4",
        "bg-muted/30",
        "border border-border/70"
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">
          Today's Wins
        </span>
        <span className="text-xs text-muted-foreground">
          {achievements.length} achievement{achievements.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {achievements.map((achievement, i) => (
          <motion.div
            key={achievement.id}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...SPRING_CONFIG, delay: 0.2 + (i * 0.1) }}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm",
              "bg-card",
              "border border-border/70"
            )}
          >
            {achievement.icon}
            <span className="text-foreground font-medium">
              {achievement.text}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// Celebration badge for high-performing metrics
function CelebrationBadge({
  show,
  message
}: {
  show: boolean;
  message: string;
}) {
  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring" as const, duration: 0.5, delay: 0.3 }}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold",
        "bg-card text-foreground border border-border",
        "shadow-sm"
      )}
    >
      <motion.div
        animate={{
          rotate: [0, 10, -10, 10, 0],
          scale: [1, 1.2, 1.2, 1.2, 1]
        }}
        transition={{ duration: 0.6, delay: 0.5 }}
      >
        <Sparkles className="h-4 w-4 text-amber-500" />
      </motion.div>
      {message}
    </motion.div>
  );
}

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const prefersReducedMotion = useReducedMotion();

  // Onboarding tour disabled - was annoying users
  // const tour = useTour({
  //   tour: DASHBOARD_TOUR,
  //   onComplete: () => {
  //     console.log("Dashboard tour completed!");
  //   },
  // });

  const { data: campgrounds = [] } = useQuery({
    queryKey: ["campgrounds"],
    queryFn: () => apiClient.getCampgrounds(),
    staleTime: 60000, // 1 minute - campgrounds don't change often
    placeholderData: keepPreviousData,
  });

  // Track when client-side hydration is complete to avoid hydration mismatch
  const [hasMounted, setHasMounted] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");

  // After mount, read from localStorage and set up selection
  useEffect(() => {
    const stored = localStorage.getItem("campreserv:selectedCampground");
    if (stored) {
      setSelectedId(stored);
    }
    setHasMounted(true);
  }, []);

  // Onboarding tour disabled - was annoying users
  // useEffect(() => {
  //   if (hasMounted && !tour.hasCompleted && selectedId) {
  //     const timer = setTimeout(() => {
  //       tour.start();
  //     }, 1500);
  //     return () => clearTimeout(timer);
  //   }
  // }, [hasMounted, tour.hasCompleted, selectedId]);

  // Get time-of-day greeting only after mount to prevent hydration mismatch
  // (server time may differ from client time)
  const timeOfDay = useMemo(() => {
    if (!hasMounted) {
      // Return a neutral default during SSR to prevent mismatch
      return {
        greeting: "Welcome",
        icon: <Sun className="h-8 w-8 text-amber-500" />,
        message: "Here's what's happening at the park",
        tone: "bg-card border-border"
      };
    }

    // Only call getTimeOfDayGreeting() on client after hydration
    const hour = new Date().getHours();

    if (hour < 12) {
      return {
        greeting: "Good morning",
        icon: <Sun className="h-8 w-8 text-amber-500" />,
        message: "Here's what's happening at the park today",
        tone: "bg-card border-border"
      };
    } else if (hour < 17) {
      return {
        greeting: "Good afternoon",
        icon: <Sunset className="h-8 w-8 text-sky-500" />,
        message: "Let's check on today's progress",
        tone: "bg-card border-border"
      };
    } else {
      return {
        greeting: "Good evening",
        icon: <Moon className="h-8 w-8 text-indigo-500" />,
        message: "Winding down the day",
        tone: "bg-card border-border"
      };
    }
  }, [hasMounted]);

  // Update selection when campgrounds load (if no valid selection yet)
  useEffect(() => {
    if (campgrounds.length > 0 && hasMounted && !selectedId) {
      const stored = localStorage.getItem("campreserv:selectedCampground");
      if (stored && campgrounds.some((c) => c.id === stored)) {
        setSelectedId(stored);
      } else {
        setSelectedId(campgrounds[0].id);
      }
    }
  }, [campgrounds, hasMounted, selectedId]);

  const selectedCampground = campgrounds.find((c) => c.id === selectedId) || campgrounds[0];

  const reservationsQuery = useQuery({
    queryKey: ["reservations", selectedId],
    queryFn: () => apiClient.getReservations(selectedId ?? ""),
    enabled: !!selectedId,
    staleTime: 30000,
    placeholderData: keepPreviousData,
  });

  const sitesQuery = useQuery({
    queryKey: ["sites", selectedId],
    queryFn: () => apiClient.getSites(selectedId ?? ""),
    enabled: !!selectedId,
    staleTime: 30000,
    placeholderData: keepPreviousData,
  });

  const npsQuery = useQuery({
    queryKey: ["nps-metrics", selectedId],
    queryFn: () => apiClient.getNpsMetrics(selectedId ?? ""),
    enabled: !!selectedId,
    staleTime: 30000,
    placeholderData: keepPreviousData,
  });

  const yieldMetricsQuery = useQuery({
    queryKey: ["yield-metrics", selectedId],
    queryFn: () => apiClient.getYieldMetrics(selectedId ?? ""),
    enabled: !!selectedId,
    staleTime: 30000,
    placeholderData: keepPreviousData,
  });

  // Get today's date as YYYY-MM-DD string (for reliable date comparison)
  const todayString = useMemo(() => {
    if (!hasMounted) return null;
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, [hasMounted]);

  // Also keep a Date object for display purposes
  const today = useMemo(() => {
    if (!hasMounted) return null;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, [hasMounted]);

  const todayLabel = useMemo(() => {
    if (!today) return "Today";
    return today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  }, [today]);

  const reservations = reservationsQuery.data as Reservation[] | undefined;
  const isLoading = !hasMounted || reservationsQuery.isLoading || sitesQuery.isLoading;
  const isError = reservationsQuery.isError || sitesQuery.isError;
  const totalSites = sitesQuery.data?.length ?? 0;
  const yieldMetrics = yieldMetricsQuery.data;

  // Single-pass computation of all dashboard metrics
  const dashboardMetrics = useMemo(() => {
    if (!today || !todayString) {
      return {
        todayArrivals: [],
        todayDepartures: [],
        inHouse: [],
        outstandingBalanceCents: 0,
        balanceDueToday: 0,
        balanceOverdue: 0,
        balanceFuture: 0,
        futureReservationsCount: 0,
        attentionList: [],
        occupancy14: [],
      };
    }

    const todayTime = today.getTime();
    const todayArrivals: Reservation[] = [];
    const todayDepartures: Reservation[] = [];
    const inHouse: Reservation[] = [];
    const withBalance: Array<Reservation & { balance: number }> = [];
    let outstandingBalanceCents = 0;
    let balanceDueToday = 0;
    let balanceOverdue = 0;
    let balanceFuture = 0;
    let futureReservationsCount = 0;

    // Pre-compute 14-day range for occupancy chart
    const days14: Date[] = [];
    const days14Strings: string[] = [];
    const occupancy14Counts = new Array(14).fill(0);
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      days14.push(d);
      // Also store as YYYY-MM-DD string for reliable comparison
      days14Strings.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    }

    // Helper to extract date portion (YYYY-MM-DD) from ISO string
    const getDatePart = (isoStr: string) => isoStr.split('T')[0];

    if (reservations) {
      for (const r of reservations) {
        if (r.status === "cancelled") continue;

        // Use string comparison for reliable date matching across timezones
        const arrivalDateStr = getDatePart(r.arrivalDate);
        const departureDateStr = getDatePart(r.departureDate);

        // Today's arrivals (exclude already checked in)
        if (arrivalDateStr === todayString && r.status !== "checked_in" && r.status !== "checked_out") {
          todayArrivals.push(r);
        }

        // Today's departures (exclude already checked out)
        if (departureDateStr === todayString && r.status !== "checked_out") {
          todayDepartures.push(r);
        }

        // In-house (arrival <= today && departure > today)
        if (arrivalDateStr <= todayString && departureDateStr > todayString) {
          inHouse.push(r);
        }

        // Future reservations
        if (arrivalDateStr > todayString) {
          futureReservationsCount++;
        }

        // Outstanding balance with aging buckets
        const balance = (r.totalAmount ?? 0) - (r.paidAmount ?? 0);
        if (balance > 0) {
          outstandingBalanceCents += balance;
          withBalance.push({ ...r, balance });

          // Calculate aging based on arrival date
          if (arrivalDateStr < todayString) {
            // Overdue: arrival was in the past
            balanceOverdue += balance;
          } else if (arrivalDateStr === todayString) {
            // Due today: arrival is today
            balanceDueToday += balance;
          } else {
            // Future: arrival is in the future
            balanceFuture += balance;
          }
        }

        // 14-day occupancy (check each day the reservation spans)
        for (let i = 0; i < 14; i++) {
          const dayStr = days14Strings[i];
          if (arrivalDateStr <= dayStr && departureDateStr > dayStr) {
            occupancy14Counts[i]++;
          }
        }
      }
    }

    // Sort and slice attention list
    const attentionList = withBalance
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 4);

    // Build occupancy chart data
    const occupancy14 = totalSites > 0
      ? days14.map((day, i) => ({
          label: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          rate: Math.round((occupancy14Counts[i] / totalSites) * 100)
        }))
      : [];

    return {
      todayArrivals,
      todayDepartures,
      inHouse,
      outstandingBalanceCents,
      balanceDueToday,
      balanceOverdue,
      balanceFuture,
      futureReservationsCount,
      attentionList,
      occupancy14,
    };
  }, [reservations, today, todayString, totalSites]);

  const {
    todayArrivals,
    todayDepartures,
    inHouse,
    outstandingBalanceCents,
    balanceDueToday,
    balanceOverdue,
    balanceFuture,
    futureReservationsCount: futureReservations,
    attentionList,
    occupancy14,
  } = dashboardMetrics;

  const occupiedSites = inHouse.length;
  const occupancyRate = totalSites > 0 ? Math.round((occupiedSites / totalSites) * 100) : 0;

  const formatMoney = (cents?: number) =>
    `$${((cents ?? 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const alerts = useMemo(() => {
    const list: { id: string; label: string; href: string }[] = [];
    if ((attentionList?.length ?? 0) > 0) {
      list.push({ id: "balances", label: "Balances due need attention", href: "/billing/repeat-charges" });
    }
    if (occupancyRate >= 90) {
      list.push({ id: "high-occ", label: "High occupancy today — verify arrivals", href: "/check-in-out" });
    }
    if ((todayArrivals?.length ?? 0) === 0 && (futureReservations ?? 0) > 0) {
      list.push({ id: "no-arrivals", label: "No arrivals today — check calendar", href: "/calendar" });
    }
    if (totalSites === 0) {
      list.push({ id: "no-sites", label: "No sites configured for this park", href: "/campgrounds" });
    }
    return list;
  }, [attentionList, occupancyRate, todayArrivals, futureReservations, totalSites]);

  const searchResults = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term || !reservations) return [];
    return reservations
      .filter((r) => {
        const guest = `${r.guest?.primaryFirstName || ""} ${r.guest?.primaryLastName || ""}`.toLowerCase();
        const site = `${r.siteId || ""}`.toLowerCase();
        return guest.includes(term) || site.includes(term) || r.id.toLowerCase().includes(term);
      })
      .slice(0, 5);
  }, [search, reservations]);

  // Animation variants based on reduced motion preference
  const motionProps = prefersReducedMotion ? reducedMotionVariants : fadeInUp;

  return (
    <DashboardShell>
      {/* Onboarding Tour Overlay - disabled, was annoying users
      <TourOverlay
        isActive={tour.isActive}
        currentStep={tour.currentStep}
        currentStepIndex={tour.currentStepIndex}
        totalSteps={tour.totalSteps}
        isFirstStep={tour.isFirstStep}
        isLastStep={tour.isLastStep}
        onNext={tour.next}
        onPrev={tour.prev}
        onSkip={tour.skip}
      />
      */}

      <motion.div
        className="space-y-6"
        initial="initial"
        animate="animate"
        variants={staggerContainer}
        data-tour="dashboard-header"
      >
        {!selectedCampground ? (
          <motion.div
            className="flex items-center justify-center min-h-[40vh]"
            {...motionProps}
            transition={SPRING_CONFIG}
          >
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Welcome to Keepr</h2>
              <p className="text-muted-foreground">Select a campground from the dropdown to get started.</p>
            </div>
          </motion.div>
        ) : null}

        {/* Daily briefing */}
        <motion.div
          className={cn(
            "flex flex-col gap-4 rounded-2xl p-6 shadow-sm transition-colors",
            "border border-border bg-card"
          )}
          {...motionProps}
          transition={{ ...SPRING_CONFIG, delay: 0.05 }}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <motion.div
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...SPRING_CONFIG, delay: 0.1 }}
              >
                <span className="rounded-xl bg-muted p-2">
                  {timeOfDay.icon}
                </span>
                <div>
                  <div className="text-xs font-semibold text-muted-foreground">Daily briefing</div>
                  <h1 className="text-2xl font-semibold text-foreground">
                    {timeOfDay.greeting}
                  </h1>
                </div>
              </motion.div>

              <div className="text-sm text-muted-foreground">
                {todayLabel} · {selectedCampground?.name ?? "Loading campground"}
              </div>

              <p className="text-sm text-muted-foreground font-medium">
                {timeOfDay.message}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <motion.div {...hoverScale} whileTap={{ scale: 0.95 }}>
                <Link
                  href="/booking"
                  aria-label="Create a new booking"
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white",
                    "bg-action-primary text-action-primary-foreground hover:bg-action-primary-hover",
                    "shadow-sm transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action-primary focus-visible:ring-offset-2"
                  )}
                >
                  <Plus className="h-4 w-4" />
                  New booking
                </Link>
              </motion.div>
              <motion.div {...hoverScale} whileTap={{ scale: 0.95 }}>
                <Link
                  href="/pos"
                  aria-label="Open point of sale"
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold",
                    "border border-border bg-muted/30 text-foreground",
                    "hover:border-muted-foreground/30 hover:bg-muted/60",
                    "shadow-sm transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action-primary focus-visible:ring-offset-2"
                  )}
                >
                  <ShoppingBag className="h-4 w-4" />
                  Open POS
                </Link>
              </motion.div>
              <motion.div {...hoverScale} whileTap={{ scale: 0.95 }}>
                <Link
                  href="/calendar"
                  aria-label="Open the calendar"
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold",
                    "border border-border bg-muted/30 text-foreground",
                    "hover:border-muted-foreground/30 hover:bg-muted/60",
                    "shadow-sm transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action-primary focus-visible:ring-offset-2"
                  )}
                >
                  <Calendar className="h-4 w-4" />
                  View calendar
                </Link>
              </motion.div>
            </div>
          </div>
        </motion.div>


        {/* Impact highlights: NPS + Charity */}
        <motion.div
          className="grid gap-4 lg:grid-cols-2"
          {...motionProps}
          transition={{ ...SPRING_CONFIG, delay: 0.02 }}
        >
          <NpsSummaryCard npsData={npsQuery.data} />
          {hasMounted && selectedId ? (
            <CharityImpactWidget campgroundId={selectedId} />
          ) : (
            <div className="grid gap-4">
              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-8 w-28 bg-muted rounded" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="animate-pulse grid grid-cols-3 gap-4">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div key={`charity-placeholder-${index}`} className="space-y-2">
                        <div className="h-6 w-12 bg-muted rounded mx-auto" />
                        <div className="h-3 w-16 bg-muted rounded mx-auto" />
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="h-3 w-full bg-muted rounded" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </motion.div>

        {/* Onboarding Hint */}
        <PageOnboardingHint
          id="dashboard-overview"
          title="Welcome to your Dashboard!"
          content={
            <div>
              <p className="mb-2">
                This is your command center for managing your campground. Here you'll find:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Today's arrivals and departures at a glance</li>
                <li>Current occupancy rates and key metrics</li>
                <li>Outstanding balances that need attention</li>
                <li>Quick actions to create bookings and process orders</li>
              </ul>
            </div>
          }
          actions={[
            {
              label: "View Calendar",
              onClick: () => (window.location.href = "/calendar"),
              variant: "ghost"
            }
          ]}
        />


        {/* Error State */}
        {isError && (
          <ErrorState
            message="We couldn't load your dashboard data. This might be a temporary issue."
            onRetry={() => {
              reservationsQuery.refetch();
              sitesQuery.refetch();
            }}
          />
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <motion.div
              className={cn(
                "rounded-2xl p-6 space-y-6 shadow-sm transition-colors",
                "bg-card border border-border"
              )}
              {...motionProps}
              transition={{ ...SPRING_CONFIG, delay: 0.1 }}
              data-tour="quick-stats"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    Operations snapshot
                    <HelpTooltip
                      title="Daily Metrics"
                      content={
                        <HelpTooltipContent>
                          <HelpTooltipSection>
                            These cards show your most important daily metrics:
                          </HelpTooltipSection>
                          <HelpTooltipSection title="Arrivals">
                            Guests checking in today. Click to view the check-in list.
                          </HelpTooltipSection>
                          <HelpTooltipSection title="Departures">
                            Guests checking out today. Review to ensure checkout tasks are complete.
                          </HelpTooltipSection>
                          <HelpTooltipSection title="In-house">
                            Total number of occupied sites right now.
                          </HelpTooltipSection>
                          <HelpTooltipSection title="Occupancy">
                            Percentage of sites currently occupied. High occupancy (90%+) means you're nearly full!
                          </HelpTooltipSection>
                          <HelpTooltipSection title="Balance due">
                            Total unpaid balances across all active reservations. The breakdown shows:
                            Overdue (past arrival date), Due Today (arriving today), and Future (not yet due).
                          </HelpTooltipSection>
                          <HelpTooltipSection title="Revenue">
                            Total revenue collected today. Click to view detailed revenue analytics and trends.
                          </HelpTooltipSection>
                        </HelpTooltipContent>
                      }
                      side="bottom"
                      maxWidth={380}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Occupancy, revenue, and balances for today.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Link
                    href="/calendar"
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 transition-colors",
                      "border border-border bg-muted/30 hover:border-muted-foreground/30 hover:text-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                    )}
                  >
                    <Calendar className="h-3.5 w-3.5" /> Calendar
                  </Link>
                  <Link
                    href="/check-in-out"
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 transition-colors",
                      "border border-border bg-muted/30 hover:border-muted-foreground/30 hover:text-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                    )}
                  >
                    <UserCheck className="h-3.5 w-3.5" /> Check-ins
                  </Link>
                  <Link
                    href="/reservations?focus=today"
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 transition-colors",
                      "border border-border bg-muted/30 hover:border-muted-foreground/30 hover:text-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                    )}
                  >
                    <ClipboardList className="h-3.5 w-3.5" /> Reservations
                  </Link>
                </div>
              </div>

              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <OpsCard label="Arrivals" value={todayArrivals.length} href="/check-in-out" icon={<UserCheck className="h-4 w-4" />} tone="emerald" index={0} prefersReducedMotion={prefersReducedMotion} celebrate={todayArrivals.length >= 5} />
                  <OpsCard label="Departures" value={todayDepartures.length} href="/check-in-out" icon={<LogOut className="h-4 w-4" />} tone="amber" index={1} prefersReducedMotion={prefersReducedMotion} />
                  <OpsCard label="In-house" value={inHouse.length} href="/reservations" icon={<Users className="h-4 w-4" />} tone="blue" index={2} prefersReducedMotion={prefersReducedMotion} />
                  <OpsCard label="Occupancy" value={`${occupancyRate}%`} href="/calendar" icon={<Calendar className="h-4 w-4" />} tone="purple" index={3} prefersReducedMotion={prefersReducedMotion} celebrate={occupancyRate >= 90} />
                  <OpsCard
                    label="Balance due"
                    value={formatMoney(outstandingBalanceCents)}
                    href="/billing/repeat-charges"
                    icon={<DollarSign className="h-4 w-4" />}
                    tone={outstandingBalanceCents === 0 ? "emerald" : "rose"}
                    index={4}
                    prefersReducedMotion={prefersReducedMotion}
                    celebrate={outstandingBalanceCents === 0 && (reservations?.length ?? 0) > 0}
                    breakdown={outstandingBalanceCents > 0 ? [
                      ...(balanceOverdue > 0 ? [{ label: "overdue", value: formatMoney(balanceOverdue), tone: "danger" as const }] : []),
                      ...(balanceDueToday > 0 ? [{ label: "due today", value: formatMoney(balanceDueToday), tone: "warning" as const }] : []),
                      ...(balanceFuture > 0 ? [{ label: "future", value: formatMoney(balanceFuture), tone: "success" as const }] : []),
                    ] : undefined}
                  />
                  <OpsCard
                    label="Revenue"
                    value={formatMoney(yieldMetrics?.todayRevenue ?? 0)}
                    href="/ai/yield"
                    icon={<Banknote className="h-4 w-4" />}
                    tone="emerald"
                    index={5}
                    prefersReducedMotion={prefersReducedMotion}
                    celebrate={(yieldMetrics?.todayRevenue ?? 0) >= 100000}
                    breakdown={yieldMetrics?.yoyChange ? [
                      {
                        label: "vs last year",
                        value: `${yieldMetrics.yoyChange.revenue >= 0 ? "+" : ""}${yieldMetrics.yoyChange.revenue.toFixed(0)}%`,
                        tone: yieldMetrics.yoyChange.revenue >= 0 ? "success" as const : "danger" as const
                      }
                    ] : undefined}
                  />
                </div>
              )}

              {!isLoading && !isError && (
                <TodaysWins
                  todayArrivals={todayArrivals}
                  todayDepartures={todayDepartures}
                  outstandingBalanceCents={outstandingBalanceCents}
                  occupancyRate={occupancyRate}
                  reservationsCount={reservations?.length ?? 0}
                  prefersReducedMotion={prefersReducedMotion}
                />
              )}

              <div className="border-t border-border pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-foreground">Occupancy outlook</div>
                  <span className="text-xs text-muted-foreground">Next 14 days</span>
                </div>
                {isLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                    {Array.from({ length: 7 }).map((_, index) => (
                      <div
                        key={`occupancy-skeleton-${index}`}
                        className="h-16 rounded-lg bg-muted animate-pulse"
                      />
                    ))}
                  </div>
                ) : occupancy14.length === 0 ? (
                  <div className={cn(
                    "rounded-lg p-6 text-center space-y-3",
                    "border border-dashed border-border bg-muted/40"
                  )}>
                    <div className="flex justify-center mb-2">
                      <BarChart3 className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">No occupancy data yet</p>
                    <p className="text-xs text-muted-foreground">Add sites and create reservations to see your occupancy forecast</p>
                    <div className="flex justify-center gap-2 pt-2">
                      <Link
                        href="/campgrounds"
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold",
                          "bg-emerald-600 text-white hover:bg-emerald-500",
                          "shadow-sm transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                        )}
                      >
                        <Tent className="h-3.5 w-3.5" />
                        Add Sites
                      </Link>
                      <Link
                        href="/booking-v2"
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold",
                          "border border-border bg-card text-foreground hover:bg-muted",
                          "shadow-sm transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                        )}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Create Booking
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                    {occupancy14.map((d, index) => (
                      <motion.div
                        key={d.label}
                        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ ...SPRING_FAST, delay: getStaggerDelay(index, 0.05) }}
                      >
                        <Link
                          href="/calendar"
                          aria-label={`${d.label}: ${d.rate}% occupancy`}
                          className={cn(
                            "flex flex-col gap-1 rounded-lg px-3 py-2 transition-all",
                            "border border-border bg-muted/30",
                            "hover:border-muted-foreground/30 hover:bg-muted/50",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                          )}
                        >
                          <span className="text-xs text-muted-foreground">{d.label}</span>
                          <div className={cn(
                            "h-2 w-full rounded",
                            "bg-muted"
                          )}>
                            <div
                              className={cn(
                                "h-2 rounded transition-all",
                                d.rate >= 90 ? "bg-amber-500" : "bg-emerald-500"
                              )}
                              style={{ width: `${Math.min(100, d.rate)}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-foreground">{d.rate}%</span>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <UserCheck className="h-4 w-4 text-muted-foreground" />
                    Guest flow
                  </div>
                  <Link
                    href="/check-in-out"
                    className={cn(
                      "text-xs font-semibold text-emerald-600 hover:text-emerald-500 flex items-center gap-1",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 rounded"
                    )}
                  >
                    Open check-in/out <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <BoardCard
                    title="Arrivals"
                    count={todayArrivals.length}
                    ctaLabel="Open arrivals"
                    ctaHref="/check-in-out"
                    rows={todayArrivals}
                    prefersReducedMotion={prefersReducedMotion}
                    isLoading={isLoading}
                  />
                  <BoardCard
                    title="Departures"
                    count={todayDepartures.length}
                    ctaLabel="Open departures"
                    ctaHref="/check-in-out"
                    rows={todayDepartures}
                    tone="amber"
                    prefersReducedMotion={prefersReducedMotion}
                    isLoading={isLoading}
                  />
                </div>
                <div className="border-t border-border pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-foreground">Recent movement</div>
                    <Link
                      href="/reservations"
                      className={cn(
                        "text-xs font-semibold text-emerald-600 hover:text-emerald-500 flex items-center gap-1",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 rounded"
                      )}
                    >
                      View reservations <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                  {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {Array.from({ length: 2 }).map((_, index) => (
                        <div
                          key={`movement-skeleton-${index}`}
                          className="h-40 rounded-xl border border-border/70 bg-muted/30 animate-pulse"
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <ActivityList title="Arrivals" tone="emerald" rows={todayArrivals.slice(0, 6)} prefersReducedMotion={prefersReducedMotion} />
                      <ActivityList title="Departures" tone="amber" rows={todayDepartures.slice(0, 6)} prefersReducedMotion={prefersReducedMotion} />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          <div className="space-y-6">
            <motion.div
              className={cn(
                "rounded-2xl p-6 space-y-6 shadow-sm transition-colors",
                "bg-card border border-border"
              )}
              {...motionProps}
              transition={{ ...SPRING_CONFIG, delay: 0.14 }}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Hand className="h-4 w-4 text-muted-foreground" />
                  Front desk console
                </div>
                <p className="text-xs text-muted-foreground">
                  Collections, quick actions, and guest communication in one place.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ClipboardList className="h-4 w-4" />
                  Action items
                  <HelpTooltip
                    title="Outstanding Balances"
                    content={
                      <div className="space-y-2">
                        <p>Quick actions to keep your finances on track.</p>
                        <p className="text-xs text-muted-foreground">
                          Click "Collect" to process payment or send a friendly reminder.
                        </p>
                      </div>
                    }
                    side="right"
                    maxWidth={300}
                  />
                </div>

                <div className={cn(
                  "rounded-xl p-4 space-y-4 transition-colors",
                  "border border-border/70 bg-card"
                )}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">
                        {attentionList.length === 0 ? "All Caught Up!" : "Balances to Collect"}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {attentionList.length === 0
                          ? "Every reservation is fully paid. Nice work!"
                          : `${attentionList.length} reservation${attentionList.length !== 1 ? 's' : ''} to follow up on`}
                      </p>
                    </div>
                    {attentionList.length > 0 && (
                      <span className={cn(
                        "rounded-full text-xs font-bold px-3 py-1",
                        "bg-card text-foreground border border-border"
                      )}>
                        {attentionList.length}
                      </span>
                    )}
                  </div>

                  {attentionList.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: "spring" as const, duration: 0.5 }}
                      className={cn(
                        "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-lg px-4 py-4",
                        "border border-border bg-card"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <motion.div
                          animate={{
                            rotate: [0, 10, -10, 10, 0],
                            scale: [1, 1.2, 1.2, 1.2, 1]
                          }}
                          transition={{ duration: 0.6 }}
                        >
                          <CheckCircle className="h-5 w-5 text-emerald-600" />
                        </motion.div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            All clear - no outstanding balances!
                          </p>
                          <p className="text-xs text-muted-foreground">
                            You're on top of collections. Keep it up!
                          </p>
                        </div>
                      </div>
                      <Link
                        href="/finance/overview"
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap",
                          "border border-border bg-card text-foreground hover:bg-muted",
                          "shadow-sm transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                        )}
                      >
                        <BarChart3 className="h-3.5 w-3.5" />
                        View Reports
                      </Link>
                    </motion.div>
                  ) : (
                    <div className="space-y-2">
                      {attentionList.map((r, index) => (
                        <motion.div
                          key={r.id}
                          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ ...SPRING_FAST, delay: getStaggerDelay(index) }}
                          className={cn(
                            "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3",
                            "rounded-lg px-3 py-2.5 shadow-sm",
                            "border border-border bg-muted/40",
                            "hover:border-muted-foreground/30",
                            "hover:shadow-md transition-all duration-200"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "h-8 w-8 rounded-full font-semibold flex items-center justify-center text-xs",
                              "bg-muted text-muted-foreground border border-border"
                            )}>
                              {r.guest?.primaryFirstName?.[0] ?? "?"}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-foreground">
                                {r.guest?.primaryFirstName ?? "Guest"} {r.guest?.primaryLastName ?? ""}
                              </div>
                              <div className="text-xs text-muted-foreground">Site {r.siteId ?? "—"}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                            <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                              {formatMoney(r.balance)}
                            </span>
                            <motion.div
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <Link
                                href={`/campgrounds/${selectedId}/reservations/${r.id}`}
                                aria-label={`Collect payment from ${r.guest?.primaryFirstName ?? 'Guest'}`}
                                className={cn(
                                  "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-semibold text-white",
                                  "bg-emerald-600 hover:bg-emerald-500",
                                  "shadow-sm hover:shadow-md transition-all duration-200",
                                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                                )}
                              >
                                Collect
                              </Link>
                            </motion.div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3 border-t border-border pt-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Plus className="h-4 w-4 text-muted-foreground" />
                  Quick actions
                  <HelpTooltip
                    title="Common Tasks"
                    content={
                      <div className="space-y-2">
                        <p>Tap these buttons to quickly perform common front desk tasks without navigating through menus.</p>
                        <p className="text-xs text-muted-foreground">Tip: Use keyboard shortcuts to speed up your workflow even more!</p>
                      </div>
                    }
                    side="right"
                    maxWidth={280}
                  />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <QuickActionButton
                    href="/booking"
                    label="New booking"
                    icon={<Plus className="h-5 w-5" />}
                    tone="emerald"
                    index={0}
                    prefersReducedMotion={prefersReducedMotion}
                  />
                  <QuickActionButton
                    href="/reservations"
                    label="Extend / Move"
                    icon={<ArrowRight className="h-5 w-5" />}
                    tone="blue"
                    index={1}
                    prefersReducedMotion={prefersReducedMotion}
                  />
                  <QuickActionButton
                    href="/pos"
                    label="POS order"
                    icon={<ShoppingBag className="h-5 w-5" />}
                    tone="purple"
                    index={2}
                    prefersReducedMotion={prefersReducedMotion}
                  />
                  <QuickActionButton
                    href="/finance/gift-cards"
                    label="Credit / Refund"
                    icon={<DollarSign className="h-5 w-5" />}
                    tone="amber"
                    index={3}
                    prefersReducedMotion={prefersReducedMotion}
                  />
                  <QuickActionButton
                    href="/messages"
                    label="Pre-arrival message"
                    icon={<MessageCircle className="h-5 w-5" />}
                    tone="slate"
                    index={4}
                    prefersReducedMotion={prefersReducedMotion}
                  />
                </div>
              </div>

              <div className="space-y-3 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    Alerts
                  </div>
                  <Badge variant="secondary" className="text-xs font-semibold">
                    {alerts.length}
                  </Badge>
                </div>
                {alerts.length === 0 ? (
                  <div className={cn(
                    "rounded-lg border border-dashed px-4 py-3 text-sm flex items-center gap-2",
                    "border-border bg-muted/30 text-muted-foreground"
                  )}>
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    All clear - nothing needs your attention.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {alerts.map((a, index) => (
                      <motion.div
                        key={a.id}
                        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...SPRING_FAST, delay: getStaggerDelay(index) }}
                      >
                        <Link
                          href={a.href}
                          className={cn(
                            "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-all",
                            "border border-border bg-muted/30 text-foreground hover:border-muted-foreground/30 hover:shadow-sm",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
                          )}
                        >
                          <span>{a.label}</span>
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                )}
                <div className="pt-2">
                  <StatCard label="Future bookings" value={futureReservations} hint="Upcoming arrivals" icon={<ClipboardList className="h-4 w-4" />} />
                </div>
              </div>

              <div className="space-y-3 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    Quick search
                  </div>
                  <span className="text-xs text-muted-foreground">Guest, site, or reservation ID</span>
                </div>
                <Input
                  className="h-11"
                  placeholder="Search guest, site, reservation..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search reservations"
                />
                {search && (
                  <div className="space-y-2">
                    {searchResults.length === 0 && (
                      <div className="text-sm text-muted-foreground flex items-center gap-2 py-2">
                        <Search className="h-4 w-4" />
                        No matches found. Try a different search term.
                      </div>
                    )}
                    {searchResults.map((r, index) => (
                      <motion.div
                        key={r.id}
                        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...SPRING_FAST, delay: getStaggerDelay(index) }}
                      >
                        <Link
                          href={`/campgrounds/${selectedId}/reservations/${r.id}`}
                          className={cn(
                            "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-all",
                            "border border-border bg-muted/30 hover:border-muted-foreground/30 hover:shadow-sm",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                          )}
                        >
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground">
                              {(r.guest?.primaryFirstName || "Guest") + " " + (r.guest?.primaryLastName || "")}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(r.arrivalDate).toLocaleDateString()} → {new Date(r.departureDate).toLocaleDateString()} • Site {r.siteId}
                            </span>
                          </div>
                          <span className="text-xs uppercase text-muted-foreground">{r.status}</span>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>

            {hasMounted && selectedId && (
              <motion.div
                {...motionProps}
                transition={{ ...SPRING_CONFIG, delay: 0.18 }}
              >
                <SetupQueueWidget campgroundId={selectedId} />
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </DashboardShell>
  );
}

function OpsCard({
  label,
  value,
  href,
  icon,
  tone,
  index,
  prefersReducedMotion,
  celebrate = false,
  breakdown
}: {
  label: string;
  value: string | number;
  href: string;
  icon: React.ReactNode;
  tone: "emerald" | "amber" | "blue" | "purple" | "rose";
  index: number;
  prefersReducedMotion: boolean | null;
  celebrate?: boolean;
  breakdown?: Array<{ label: string; value: string; tone?: "success" | "warning" | "danger" }>;
}) {
  const toneMap: Record<typeof tone, { dot: string; icon: string }> = {
    emerald: { dot: "bg-emerald-500", icon: "text-emerald-600" },
    amber: { dot: "bg-amber-500", icon: "text-amber-600" },
    blue: { dot: "bg-blue-500", icon: "text-blue-600" },
    purple: { dot: "bg-purple-500", icon: "text-purple-600" },
    rose: { dot: "bg-rose-500", icon: "text-rose-600" },
  };
  const toneStyle = toneMap[tone];

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING_CONFIG, delay: getStaggerDelay(index) }}
    >
      <Link
        href={href}
        aria-label={`${label}: ${value}`}
          className={cn(
          "flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 p-4 transition-colors",
          "hover:border-muted-foreground/30 hover:bg-muted/50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        )}
      >
        <div className="flex items-start gap-3 flex-1">
          <span className={cn("rounded-lg p-2 bg-muted", toneStyle.icon)}>
            {icon}
          </span>
          <div className="flex-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-full", toneStyle.dot)} />
              {label}
            </div>
            <div className="text-xl font-semibold text-foreground">{value}</div>
            {breakdown && breakdown.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                {breakdown.map((item, idx) => (
                  <span
                    key={idx}
                    className={cn(
                      "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px]",
                      item.tone === "danger" && "border-red-200 text-red-700 bg-red-50",
                      item.tone === "warning" && "border-amber-200 text-amber-700 bg-amber-50",
                      item.tone === "success" && "border-emerald-200 text-emerald-700 bg-emerald-50",
                      !item.tone && "border-border text-muted-foreground bg-muted"
                    )}
                  >
                    <span className="font-semibold">{item.value}</span>
                    <span className="opacity-80">{item.label}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        {celebrate ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring" as const, delay: 0.2 }}
            className="text-emerald-600"
          >
            <CheckCircle className="h-5 w-5" />
          </motion.div>
        ) : (
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        )}
      </Link>
    </motion.div>
  );
}

function BoardCard({
  title,
  count,
  ctaLabel,
  ctaHref,
  rows,
  tone = "emerald",
  prefersReducedMotion,
  isLoading = false
}: {
  title: string;
  count: number;
  ctaLabel: string;
  ctaHref: string;
  rows: Reservation[];
  tone?: "emerald" | "amber";
  prefersReducedMotion: boolean | null;
  isLoading?: boolean;
}) {
  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING_CONFIG}
      className={cn(
        "rounded-xl p-4 space-y-3 transition-colors",
        "bg-muted/30 border border-border/70",
        ""
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{count} scheduled</p>
        </div>
        <Badge variant="secondary" className="text-xs font-semibold">
          {count}
        </Badge>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-lg bg-muted h-14" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring" as const, duration: 0.4 }}
          className={cn(
            "rounded-lg p-6 text-center space-y-3",
            "border border-dashed border-border bg-muted/40"
          )}
        >
          <div className="flex justify-center mb-2">
            {title === "Arrivals" ? (
              <Sunrise className="h-10 w-10 text-emerald-500" />
            ) : (
              <Hand className="h-10 w-10 text-amber-500" />
            )}
          </div>
          <p className="text-sm font-semibold text-foreground">
            {title === "Arrivals"
              ? "No check-ins scheduled for today"
              : "No checkouts scheduled for today"}
          </p>
          <p className="text-xs text-muted-foreground">
            {title === "Arrivals"
              ? "A quiet day - perfect time to prepare for upcoming guests"
              : "Everyone's staying another night!"}
          </p>
          <div className="flex justify-center gap-2 pt-2">
            <Link
              href="/booking-v2"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold",
                "bg-emerald-600 text-white hover:bg-emerald-500",
                "shadow-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              )}
            >
              <Plus className="h-3.5 w-3.5" />
              Create Booking
            </Link>
            <Link
              href="/calendar"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold",
                "border border-border bg-card text-foreground hover:bg-muted",
                "shadow-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
              )}
            >
              <Calendar className="h-3.5 w-3.5" />
              View Calendar
            </Link>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-2">
          {rows.slice(0, 6).map((r, index) => (
            <motion.div
              key={r.id}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...SPRING_FAST, delay: getStaggerDelay(index) }}
              className={cn(
                "flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors",
                "border border-border bg-card",
                "hover:border-muted-foreground/30"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-9 w-9 rounded-full font-semibold flex items-center justify-center text-xs",
                  "bg-muted text-muted-foreground"
                )}>
                  {r.guest?.primaryFirstName?.[0] ?? "?"}
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    {r.guest?.primaryFirstName ?? "Guest"} {r.guest?.primaryLastName ?? ""}
                  </div>
                  <div className="text-xs text-muted-foreground">Site {r.siteId ?? "—"}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">{r.status ?? "Pending"}</div>
                <div className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {new Date(r.arrivalDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Link
        href={ctaHref}
        className={cn(
          "inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 hover:text-emerald-500",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 rounded"
        )}
      >
        {ctaLabel} <ArrowRight className="h-4 w-4" />
      </Link>
    </motion.div>
  );
}

function QuickActionButton({
  href,
  label,
  icon,
  tone,
  index,
  prefersReducedMotion
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  tone: "emerald" | "blue" | "purple" | "amber" | "slate";
  index: number;
  prefersReducedMotion: boolean | null;
}) {
  const toneMap: Record<typeof tone, string> = {
    emerald: "text-emerald-600",
    blue: "text-blue-600",
    purple: "text-purple-600",
    amber: "text-amber-600",
    slate: "text-muted-foreground"
  };

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING_CONFIG, delay: getStaggerDelay(index) }}
    >
      <Link
        href={href}
        aria-label={label}
        className={cn(
          "group flex h-full min-h-[120px] flex-col items-center justify-center gap-2.5 rounded-xl border border-border/70 bg-muted/30 px-3 py-4 text-center transition-all",
          "hover:-translate-y-0.5 hover:bg-muted/50 hover:border-muted-foreground/30 hover:shadow-md",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        )}
      >
        <span className={cn("rounded-lg p-2 bg-muted", toneMap[tone])}>
          {icon}
        </span>
        <span className="text-[13px] font-semibold text-foreground leading-snug whitespace-normal break-words text-center w-full min-h-[32px]">
          {label}
        </span>
      </Link>
    </motion.div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <div className={cn(
      "rounded-lg p-3 transition-colors",
      "border border-border/70 bg-muted/30"
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-muted-foreground">{label}</div>
        <span className={cn(
          "rounded-md p-2",
          "bg-muted text-muted-foreground"
        )}>{icon}</span>
      </div>
      <div className="text-xl font-semibold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{hint}</div>
    </div>
  );
}

function NpsSummaryCard({
  npsData
}: {
  npsData?: NpsMetrics;
}) {
  const totalResponses = npsData?.totalResponses ?? 0;
  const promoters = npsData?.promoters ?? 0;
  const passives = npsData?.passives ?? 0;
  const detractors = npsData?.detractors ?? 0;
  const responseRate = npsData?.responseRate;
  const npsScore = npsData?.nps;
  const hasScore = typeof npsScore === "number";
  const score = hasScore ? npsScore : 0;
  const isLoading = !npsData;

  const formatPercent = (value: number) => (
    totalResponses > 0
      ? `${Math.round((value / totalResponses) * 100)}%`
      : "—"
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {hasScore || isLoading ? (
        <NpsGauge
          score={score}
          loading={isLoading}
          size="md"
          title="Guest NPS Score"
        />
      ) : (
        <Card className="border-border bg-muted/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-muted p-2 text-muted-foreground">
                <MessageCircle className="h-5 w-5" />
              </span>
              <div>
                <div className="text-sm font-semibold text-foreground">Guest NPS Score</div>
                <div className="text-xs text-muted-foreground">No survey responses yet.</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border overflow-hidden">
        <CardContent className="p-6">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="min-w-0">
              <div className="flex items-center justify-center gap-1 mb-2">
                <ThumbsUp className="h-5 w-5 text-green-500 shrink-0" />
              </div>
              <p className="text-2xl font-bold text-green-600">{promoters}</p>
              <p className="text-xs text-muted-foreground truncate">Promoters</p>
              <p className="text-sm text-green-600">{formatPercent(promoters)}</p>
            </div>
            <div className="min-w-0">
              <div className="flex items-center justify-center gap-1 mb-2">
                <Minus className="h-5 w-5 text-amber-500 shrink-0" />
              </div>
              <p className="text-2xl font-bold text-amber-600">{passives}</p>
              <p className="text-xs text-muted-foreground truncate">Passives</p>
              <p className="text-sm text-amber-600">{formatPercent(passives)}</p>
            </div>
            <div className="min-w-0">
              <div className="flex items-center justify-center gap-1 mb-2">
                <ThumbsDown className="h-5 w-5 text-red-500 shrink-0" />
              </div>
              <p className="text-2xl font-bold text-red-600">{detractors}</p>
              <p className="text-xs text-muted-foreground truncate">Detractors</p>
              <p className="text-sm text-red-600">{formatPercent(detractors)}</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Responses</span>
              <span className="text-foreground font-medium">{totalResponses.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-muted-foreground">Response Rate</span>
              <span className="text-foreground font-medium">
                {responseRate == null ? "—" : `${responseRate.toFixed(1)}%`}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ActivityList({
  title,
  rows,
  tone,
  prefersReducedMotion
}: {
  title: string;
  rows: Reservation[];
  tone: "emerald" | "amber";
  prefersReducedMotion: boolean | null;
}) {
  const accent = tone === "emerald"
    ? "text-emerald-600"
    : "text-amber-600";

  return (
    <div className={cn(
      "rounded-xl overflow-hidden transition-colors",
      "border border-border/70 bg-muted/30"
    )}>
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className={cn("text-xs font-semibold", accent)}>{rows.length}</div>
      </div>
      {rows.length === 0 ? (
        <div className="px-3 py-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {title === "Arrivals" ? (
              <Sunrise className="h-4 w-4 text-amber-500" />
            ) : (
              <Moon className="h-4 w-4 text-indigo-500" />
            )}
            No {title.toLowerCase()} scheduled for today
          </div>
          <div className="flex gap-2">
            <Link
              href="/booking-v2"
              className={cn(
                "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium",
                "bg-muted text-foreground hover:bg-accent",
                "transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"
              )}
            >
              <Plus className="h-3 w-3" />
              New Booking
            </Link>
            <Link
              href="/calendar"
              className={cn(
                "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium",
                "text-muted-foreground hover:text-foreground hover:bg-muted",
                "transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"
              )}
            >
              <Calendar className="h-3 w-3" />
              Calendar
            </Link>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((r, index) => (
            <motion.div
              key={r.id}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...SPRING_FAST, delay: getStaggerDelay(index) }}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 py-2.5"
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-8 w-8 rounded-full font-semibold flex items-center justify-center text-xs",
                  "bg-muted text-muted-foreground"
                )}>
                  {r.guest?.primaryFirstName?.[0] ?? "?"}
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    {r.guest?.primaryFirstName ?? "Guest"} {r.guest?.primaryLastName ?? ""}
                  </div>
                  <div className="text-xs text-muted-foreground">Site {r.siteId ?? "—"}</div>
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground sm:min-w-[80px]">
                {new Date(r.arrivalDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
