"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle,
  ClipboardList,
  Clock,
  DollarSign,
  Hand,
  LogOut,
  MessageCircle,
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
  TrendingUp,
  Trophy,
  UserCheck,
  Users
} from "lucide-react";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { apiClient } from "@/lib/api-client";
import { HelpTooltip, HelpTooltipContent, HelpTooltipSection } from "@/components/help/HelpTooltip";
import { PageOnboardingHint } from "@/components/help/OnboardingHint";
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

// Time-of-day greeting helper
function getTimeOfDayGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return {
      greeting: "Good morning",
      icon: <Sun className="h-8 w-8 text-amber-500" />,
      message: "Here's what's happening at the park today",
      tone: "from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800"
    };
  } else if (hour < 17) {
    return {
      greeting: "Good afternoon",
      icon: <Sunset className="h-8 w-8 text-sky-500" />,
      message: "Let's check on today's progress",
      tone: "from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/30 border-sky-200 dark:border-sky-800"
    };
  } else {
    return {
      greeting: "Good evening",
      icon: <Moon className="h-8 w-8 text-indigo-500" />,
      message: "Winding down the day",
      tone: "from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border-indigo-200 dark:border-indigo-800"
    };
  }
}

// Loading skeleton component
function SkeletonCard() {
  return (
    <div className={cn(
      "rounded-xl border p-4 animate-pulse",
      "bg-gradient-to-br from-slate-50 to-slate-100",
      "dark:from-slate-800/50 dark:to-slate-900/50 dark:border-slate-700"
    )}>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-slate-200 dark:bg-slate-700" />
        <div className="space-y-2 flex-1">
          <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-6 w-12 bg-slate-200 dark:bg-slate-700 rounded" />
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
        "dark:bg-red-950/30 dark:border-red-800"
      )}
    >
      <div className="flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
        <h3 className="font-semibold text-red-900 dark:text-red-200">
          Unable to load data
        </h3>
      </div>
      <p className="text-sm text-red-700 dark:text-red-300">
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
        icon: <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
        text: "All payments collected"
      });
    }

    if (occupancyRate >= 90) {
      list.push({
        id: "busy",
        icon: <Tent className="h-4 w-4 text-purple-600 dark:text-purple-400" />,
        text: `${occupancyRate}% occupancy - Nearly full!`
      });
    } else if (occupancyRate >= 70) {
      list.push({
        id: "good-occ",
        icon: <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
        text: `${occupancyRate}% occupancy - Great day!`
      });
    }

    if (todayArrivals.length >= 5) {
      list.push({
        id: "busy-arrivals",
        icon: <PartyPopper className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
        text: `${todayArrivals.length} arrivals today`
      });
    }

    if (todayArrivals.length === todayDepartures.length && todayArrivals.length > 0) {
      list.push({
        id: "balanced",
        icon: <Scale className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
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
        "rounded-xl p-4 backdrop-blur-sm",
        "bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50",
        "dark:from-emerald-950/30 dark:via-teal-950/30 dark:to-cyan-950/30",
        "border border-emerald-200 dark:border-emerald-800"
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
          Today's Wins
        </span>
        <span className="text-xs text-emerald-600 dark:text-emerald-500">
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
              "bg-white dark:bg-slate-800",
              "border border-emerald-200 dark:border-emerald-700",
              "shadow-sm"
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
        "bg-gradient-to-r from-emerald-500 to-teal-500 text-white",
        "shadow-lg shadow-emerald-500/30"
      )}
    >
      <motion.div
        animate={{
          rotate: [0, 10, -10, 10, 0],
          scale: [1, 1.2, 1.2, 1.2, 1]
        }}
        transition={{ duration: 0.6, delay: 0.5 }}
      >
        <Sparkles className="h-4 w-4" />
      </motion.div>
      {message}
    </motion.div>
  );
}

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const prefersReducedMotion = useReducedMotion();
  const timeOfDay = getTimeOfDayGreeting();

  const { data: campgrounds = [] } = useQuery({
    queryKey: ["campgrounds"],
    queryFn: () => apiClient.getCampgrounds()
  });

  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    // Sync with sidebar selection
    const stored = typeof window !== "undefined" ? localStorage.getItem("campreserv:selectedCampground") : null;
    if (campgrounds.length > 0) {
      if (stored && campgrounds.some((c) => c.id === stored)) {
        setSelectedId(stored);
      } else {
        setSelectedId(campgrounds[0].id);
      }
    }
  }, [campgrounds]);

  const selectedCampground = campgrounds.find((c) => c.id === selectedId) || campgrounds[0];

  const reservationsQuery = useQuery({
    queryKey: ["reservations", selectedId],
    queryFn: () => apiClient.getReservations(selectedId ?? ""),
    enabled: !!selectedId
  });

  const sitesQuery = useQuery({
    queryKey: ["sites", selectedId],
    queryFn: () => apiClient.getSites(selectedId ?? ""),
    enabled: !!selectedId
  });

  const npsQuery = useQuery({
    queryKey: ["nps-metrics", selectedId],
    queryFn: () => apiClient.getNpsMetrics(selectedId ?? ""),
    enabled: !!selectedId
  });

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const reservations = reservationsQuery.data as Reservation[] | undefined;
  const isLoading = reservationsQuery.isLoading || sitesQuery.isLoading;
  const isError = reservationsQuery.isError || sitesQuery.isError;

  const todayArrivals = useMemo(() => {
    if (!reservations) return [];
    return reservations.filter((r) => {
      const arrival = new Date(r.arrivalDate);
      arrival.setHours(0, 0, 0, 0);
      return arrival.getTime() === today.getTime() && r.status !== "cancelled";
    });
  }, [reservations, today]);

  const todayDepartures = useMemo(() => {
    if (!reservations) return [];
    return reservations.filter((r) => {
      const departure = new Date(r.departureDate);
      departure.setHours(0, 0, 0, 0);
      return departure.getTime() === today.getTime() && r.status !== "cancelled";
    });
  }, [reservations, today]);

  const inHouse = useMemo(() => {
    if (!reservations) return [];
    return reservations.filter((r) => {
      const arrival = new Date(r.arrivalDate);
      const departure = new Date(r.departureDate);
      return arrival <= today && departure > today && r.status !== "cancelled";
    });
  }, [reservations, today]);

  const totalSites = sitesQuery.data?.length ?? 0;
  const occupiedSites = inHouse.length;
  const occupancyRate = totalSites > 0 ? Math.round((occupiedSites / totalSites) * 100) : 0;

  const outstandingBalanceCents =
    reservations?.reduce((sum, r) => {
      const balance = (r.totalAmount ?? 0) - (r.paidAmount ?? 0);
      return sum + (balance > 0 ? balance : 0);
    }, 0) ?? 0;

  const futureReservations =
    reservations?.filter((r) => new Date(r.arrivalDate) > today && r.status !== "cancelled").length ?? 0;

  const formatMoney = (cents?: number) =>
    `$${((cents ?? 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const attentionList = useMemo(() => {
    if (!reservations) return [];
    return reservations
      .map((r) => ({
        ...r,
        balance: (r.totalAmount ?? 0) - (r.paidAmount ?? 0)
      }))
      .filter((r) => (r.balance ?? 0) > 0)
      .sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0))
      .slice(0, 4);
  }, [reservations]);

  const occupancy14 = useMemo(() => {
    if (!reservations || totalSites === 0) return [];
    const start = new Date(today);
    return Array.from({ length: 14 }).map((_, i) => {
      const day = new Date(start);
      day.setDate(day.getDate() + i);
      const inhouse = reservations.filter((r) => {
        const arr = new Date(r.arrivalDate);
        const dep = new Date(r.departureDate);
        arr.setHours(0, 0, 0, 0);
        dep.setHours(0, 0, 0, 0);
        return arr <= day && dep > day && r.status !== "cancelled";
      }).length;
      return {
        label: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        rate: Math.round((inhouse / totalSites) * 100)
      };
    });
  }, [reservations, today, totalSites]);

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
      <motion.div
        className="space-y-6"
        initial="initial"
        animate="animate"
        variants={staggerContainer}
      >
        {!selectedCampground ? (
          <motion.div
            className="flex items-center justify-center min-h-[40vh]"
            {...motionProps}
            transition={SPRING_CONFIG}
          >
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Welcome to Camp Everyday Host</h2>
              <p className="text-muted-foreground">Select a campground from the dropdown to get started.</p>
            </div>
          </motion.div>
        ) : null}

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

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* PERSONALIZED HERO - Time-of-day greeting */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <motion.div
          className={cn(
            "flex flex-col gap-4 rounded-2xl p-6 backdrop-blur-sm transition-all duration-500",
            "border bg-gradient-to-br",
            timeOfDay.tone
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
                {timeOfDay.icon}
                <h1 className="text-3xl font-bold text-foreground">
                  {timeOfDay.greeting}
                </h1>
              </motion.div>

              <div className="text-sm text-muted-foreground">
                {today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} · {selectedCampground?.name ?? "Loading campground"}
              </div>

              <p className="text-base text-foreground/80 font-medium">
                {timeOfDay.message}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <motion.div {...hoverScale} whileTap={{ scale: 0.95 }}>
                <Link
                  href="/booking"
                  aria-label="Create a new booking"
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold text-white",
                    "bg-gradient-to-r from-emerald-500 to-teal-500",
                    "hover:from-emerald-400 hover:to-teal-400",
                    "shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40",
                    "transition-all duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
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
                    "inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold",
                    "border border-border bg-card text-card-foreground",
                    "hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50",
                    "dark:hover:border-emerald-700 dark:hover:text-emerald-400 dark:hover:bg-emerald-950/30",
                    "shadow-sm hover:shadow-md transition-all duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                  )}
                >
                  <ShoppingBag className="h-4 w-4" />
                  Open POS
                </Link>
              </motion.div>
            </div>
          </div>

          {/* Celebration badges */}
          <div className="flex flex-wrap gap-2">
            <CelebrationBadge
              show={occupancyRate >= 90 && !isLoading}
              message="Nearly Full! Great job!"
            />
            <CelebrationBadge
              show={outstandingBalanceCents === 0 && (reservations?.length ?? 0) > 0 && !isLoading}
              message="All payments collected!"
            />
          </div>
        </motion.div>

        {/* Today's Wins */}
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

        {/* Charity Impact Widget */}
        {selectedId && (
          <CharityImpactWidget campgroundId={selectedId} />
        )}

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

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TODAY'S NUMBERS - Most important metrics at a glance */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <motion.div
          className={cn(
            "rounded-2xl p-5 space-y-4 backdrop-blur-sm transition-colors",
            "bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200",
            "dark:from-slate-800/50 dark:to-slate-900/50 dark:border-slate-700"
          )}
          {...motionProps}
          transition={{ ...SPRING_CONFIG, delay: 0.1 }}
        >
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Today's Numbers
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
                    Total unpaid balances across all active reservations.
                  </HelpTooltipSection>
                </HelpTooltipContent>
              }
              side="bottom"
              maxWidth={380}
            />
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <OpsCard label="Arrivals" value={todayArrivals.length} href="/check-in-out" icon={<UserCheck className="h-4 w-4" />} tone="emerald" index={0} prefersReducedMotion={prefersReducedMotion} celebrate={todayArrivals.length >= 5} />
              <OpsCard label="Departures" value={todayDepartures.length} href="/check-in-out" icon={<LogOut className="h-4 w-4" />} tone="amber" index={1} prefersReducedMotion={prefersReducedMotion} />
              <OpsCard label="In-house" value={inHouse.length} href="/reservations" icon={<Users className="h-4 w-4" />} tone="blue" index={2} prefersReducedMotion={prefersReducedMotion} />
              <OpsCard label="Occupancy" value={`${occupancyRate}%`} href="/calendar" icon={<Calendar className="h-4 w-4" />} tone="purple" index={3} prefersReducedMotion={prefersReducedMotion} celebrate={occupancyRate >= 90} />
              <OpsCard label="Balance due" value={formatMoney(outstandingBalanceCents)} href="/billing/repeat-charges" icon={<DollarSign className="h-4 w-4" />} tone={outstandingBalanceCents === 0 ? "emerald" : "rose"} index={4} prefersReducedMotion={prefersReducedMotion} celebrate={outstandingBalanceCents === 0 && (reservations?.length ?? 0) > 0} />
            </div>
          )}

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Link href="/calendar" className={cn(
              "inline-flex items-center gap-1 rounded px-3 py-1.5 transition-colors",
              "border border-border bg-card hover:border-emerald-300 hover:text-emerald-600",
              "dark:hover:border-emerald-700 dark:hover:text-emerald-400",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            )}>
              <Calendar className="h-3 w-3" /> Jump to today
            </Link>
            <Link href="/check-in-out" className={cn(
              "inline-flex items-center gap-1 rounded px-3 py-1.5 transition-colors",
              "border border-border bg-card hover:border-emerald-300 hover:text-emerald-600",
              "dark:hover:border-emerald-700 dark:hover:text-emerald-400",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            )}>
              <UserCheck className="h-3 w-3" /> Today's arrivals/departures
            </Link>
            <Link href={`/reservations?focus=today`} className={cn(
              "inline-flex items-center gap-1 rounded px-3 py-1.5 transition-colors",
              "border border-border bg-card hover:border-emerald-300 hover:text-emerald-600",
              "dark:hover:border-emerald-700 dark:hover:text-emerald-400",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            )}>
              <ClipboardList className="h-3 w-3" /> View reservations list
            </Link>
          </div>
        </motion.div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ACTION ITEMS - Reframed from "Needs Attention" */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <motion.div
          className="space-y-3"
          {...motionProps}
          transition={{ ...SPRING_CONFIG, delay: 0.15 }}
        >
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-foreground pl-1">
            <ClipboardList className="h-4 w-4" />
            Action Items
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
            "rounded-xl p-5 space-y-4 backdrop-blur-sm transition-colors",
            "border-2 bg-card",
            attentionList.length > 0
              ? "border-amber-200 dark:border-amber-700/50"
              : "border-emerald-200 dark:border-emerald-700/50"
          )}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {attentionList.length === 0 ? "All Caught Up!" : "Balances to Collect"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {attentionList.length === 0
                    ? "Every reservation is fully paid. Nice work!"
                    : `${attentionList.length} reservation${attentionList.length !== 1 ? 's' : ''} to follow up on`}
                </p>
              </div>
              {attentionList.length > 0 && (
                <span className={cn(
                  "rounded-full text-xs font-bold px-3 py-1",
                  "bg-amber-100 text-amber-800 border border-amber-200",
                  "dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700"
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
                  "flex items-center gap-3 rounded-lg px-4 py-4",
                  "border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50",
                  "dark:border-emerald-700 dark:from-emerald-950/30 dark:to-teal-950/30"
                )}
              >
                <motion.div
                  animate={{
                    rotate: [0, 10, -10, 10, 0],
                    scale: [1, 1.2, 1.2, 1.2, 1]
                  }}
                  transition={{ duration: 0.6 }}
                >
                  <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </motion.div>
                <div>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    All clear — no outstanding balances!
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-500">
                    You're on top of collections. Keep it up!
                  </p>
                </div>
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
                      "border border-amber-200 bg-amber-50/50",
                      "dark:border-amber-800 dark:bg-amber-950/20",
                      "hover:border-amber-300 dark:hover:border-amber-700",
                      "hover:shadow-md transition-all duration-200"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-8 w-8 rounded-full font-semibold flex items-center justify-center text-xs",
                        "bg-amber-100 text-amber-700 border border-amber-200",
                        "dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700"
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
                      <span className="text-sm font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                        {formatMoney(r.balance)}
                      </span>
                      <motion.div
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Link
                          href="/billing/repeat-charges"
                          aria-label={`Collect payment from ${r.guest?.primaryFirstName ?? 'Guest'}`}
                          className={cn(
                            "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-semibold text-white",
                            "bg-gradient-to-r from-emerald-500 to-teal-500",
                            "hover:from-emerald-400 hover:to-teal-400",
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
        </motion.div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* QUICK ACTIONS - Common tasks */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <motion.div
          className={cn(
            "rounded-2xl p-5 space-y-3 backdrop-blur-sm shadow-lg transition-colors",
            "bg-white/80 border-2 border-emerald-200",
            "dark:bg-slate-800/50 dark:border-emerald-700/50"
          )}
          {...motionProps}
          transition={{ ...SPRING_CONFIG, delay: 0.2 }}
        >
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-foreground">
            <Plus className="h-4 w-4 text-emerald-500" />
            Quick Actions
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
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
        </motion.div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ARRIVALS & DEPARTURES - Detailed boards */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <motion.div
          className="space-y-3"
          {...motionProps}
          transition={{ ...SPRING_CONFIG, delay: 0.25 }}
        >
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground pl-1">
            <UserCheck className="h-4 w-4" />
            Arrivals & Departures
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
        </motion.div>

        {/* Alerts, Additional Metrics, and 14-day occupancy */}
        <motion.div
          className="grid grid-cols-1 xl:grid-cols-3 gap-4"
          {...motionProps}
          transition={{ ...SPRING_CONFIG, delay: 0.3 }}
        >
          <div className={cn(
            "rounded-xl p-5 space-y-3 backdrop-blur-sm transition-colors",
            "bg-card border border-border",
            "dark:bg-slate-800/50"
          )}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Alerts</h3>
              <span className="text-xs text-muted-foreground">{alerts.length} items</span>
            </div>
            {alerts.length === 0 ? (
              <div className={cn(
                "rounded-lg border-2 border-dashed px-4 py-3 text-sm flex items-center gap-2",
                "border-emerald-200 bg-emerald-50 text-emerald-700",
                "dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
              )}>
                <CheckCircle className="h-4 w-4" />
                All clear — nothing needs your attention!
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
                        "border border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:shadow-sm",
                        "dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:border-amber-700",
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
            <div className="pt-3 border-t border-border space-y-2">
              <StatCard label="Future bookings" value={futureReservations} hint="Upcoming arrivals" icon={<ClipboardList className="h-4 w-4" />} />
              <StatCard
                label="NPS"
                value={npsQuery.data?.nps ?? "—"}
                hint={`${npsQuery.data?.totalResponses ?? 0} responses · ${npsQuery.data?.responseRate ?? "—"}% rate`}
                icon={<MessageCircle className="h-4 w-4" />}
              />
            </div>
          </div>

          <div className={cn(
            "rounded-xl p-5 space-y-3 xl:col-span-2 backdrop-blur-sm transition-colors",
            "bg-card border border-border",
            "dark:bg-slate-800/50"
          )}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">14-day occupancy</h3>
              <span className="text-xs text-muted-foreground">Tap a day to open calendar</span>
            </div>
            {occupancy14.length === 0 ? (
              <div className={cn(
                "rounded-lg p-6 text-center space-y-2",
                "border-2 border-dashed border-border bg-muted"
              )}>
                <div className="flex justify-center mb-2">
                  <BarChart3 className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold text-foreground">No occupancy data yet</p>
                <p className="text-xs text-muted-foreground">Data will appear as you add reservations and sites</p>
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
                        "flex flex-col gap-1 rounded-lg px-3 py-2 transition-all hover:shadow-md",
                        "border border-border bg-card",
                        "hover:border-emerald-300 dark:hover:border-emerald-700",
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
        </motion.div>

        {/* Search */}
        <motion.div
          className={cn(
            "rounded-xl p-5 space-y-3 backdrop-blur-sm transition-colors",
            "bg-card border border-border",
            "dark:bg-slate-800/50"
          )}
          {...motionProps}
          transition={{ ...SPRING_CONFIG, delay: 0.35 }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Quick search</h3>
            <span className="text-xs text-muted-foreground">Guest, site, or reservation ID</span>
          </div>
          <input
            className={cn(
              "w-full rounded-lg px-4 py-2.5 text-sm transition-all duration-200",
              "border-2 border-border bg-background text-foreground placeholder:text-muted-foreground",
              "focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10",
              "dark:focus:border-emerald-400 dark:focus:ring-emerald-400/10"
            )}
            placeholder="Search guest, site, reservation…"
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
                      "border border-border bg-card hover:border-emerald-300 hover:shadow-sm",
                      "dark:hover:border-emerald-700",
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
        </motion.div>

        {/* Recent activity */}
        <motion.div
          className={cn(
            "rounded-xl p-5 space-y-3 backdrop-blur-sm transition-colors",
            "bg-card border border-border",
            "dark:bg-slate-800/50"
          )}
          {...motionProps}
          transition={{ ...SPRING_CONFIG, delay: 0.4 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Recent activity</h3>
              <p className="text-sm text-muted-foreground">Latest arrivals, departures, and moves.</p>
            </div>
            <Link
              href="/reservations"
              className={cn(
                "text-sm font-semibold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 flex items-center gap-1",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 rounded"
              )}
            >
              View reservations <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ActivityList title="Arrivals" tone="emerald" rows={todayArrivals.slice(0, 6)} prefersReducedMotion={prefersReducedMotion} />
            <ActivityList title="Departures" tone="amber" rows={todayDepartures.slice(0, 6)} prefersReducedMotion={prefersReducedMotion} />
          </div>
        </motion.div>
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
  celebrate = false
}: {
  label: string;
  value: string | number;
  href: string;
  icon: React.ReactNode;
  tone: "emerald" | "amber" | "blue" | "purple" | "rose";
  index: number;
  prefersReducedMotion: boolean | null;
  celebrate?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);

  const toneMap: Record<typeof tone, { light: string; dark: string }> = {
    emerald: {
      light: "from-emerald-50 to-emerald-100 text-emerald-800 border-emerald-200",
      dark: "dark:from-emerald-950/50 dark:to-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
    },
    amber: {
      light: "from-amber-50 to-amber-100 text-amber-800 border-amber-200",
      dark: "dark:from-amber-950/50 dark:to-amber-900/30 dark:text-amber-300 dark:border-amber-800"
    },
    blue: {
      light: "from-blue-50 to-blue-100 text-blue-800 border-blue-200",
      dark: "dark:from-blue-950/50 dark:to-blue-900/30 dark:text-blue-300 dark:border-blue-800"
    },
    purple: {
      light: "from-purple-50 to-purple-100 text-purple-800 border-purple-200",
      dark: "dark:from-purple-950/50 dark:to-purple-900/30 dark:text-purple-300 dark:border-purple-800"
    },
    rose: {
      light: "from-rose-50 to-rose-100 text-rose-800 border-rose-200",
      dark: "dark:from-rose-950/50 dark:to-rose-900/30 dark:text-rose-300 dark:border-rose-800"
    }
  };

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING_CONFIG, delay: getStaggerDelay(index) }}
      whileHover={prefersReducedMotion ? {} : { scale: 1.02, y: -2 }}
      whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      <Link
        href={href}
        aria-label={`${label}: ${value}`}
        className={cn(
          "flex items-center justify-between gap-3 rounded-xl border p-4 bg-gradient-to-br backdrop-blur-sm transition-all hover:shadow-lg hover:shadow-emerald-500/10",
          toneMap[tone].light,
          toneMap[tone].dark,
          celebrate && "ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        )}
      >
        <div className="flex items-center gap-3">
          <motion.span
            className={cn(
              "rounded-lg p-2",
              "bg-white/70 text-slate-700",
              "dark:bg-white/10 dark:text-slate-300"
            )}
            animate={isHovered && !prefersReducedMotion ? {
              rotate: [0, -10, 10, -10, 0],
              scale: [1, 1.1, 1.1, 1.1, 1]
            } : {}}
            transition={{ duration: 0.4 }}
          >
            {icon}
          </motion.span>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="text-xl font-bold text-foreground">{value}</div>
          </div>
        </div>
        {celebrate ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring" as const, delay: 0.2 }}
            className="text-emerald-500"
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
  const colorClasses = tone === "emerald"
    ? "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/50"
    : "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/50";

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING_CONFIG}
      className={cn(
        "rounded-xl p-5 space-y-3 backdrop-blur-sm transition-colors",
        "bg-card border border-border",
        "dark:bg-slate-800/50"
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{count} scheduled</p>
        </div>
        <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", colorClasses)}>{count}</span>
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
            "rounded-lg p-6 text-center space-y-2",
            "border-2 border-dashed border-border bg-gradient-to-br from-slate-50 to-slate-100",
            "dark:from-slate-800/30 dark:to-slate-900/30"
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
              ? "No check-ins today"
              : "No checkouts today"}
          </p>
          <p className="text-xs text-muted-foreground">
            {title === "Arrivals"
              ? "A quiet day to catch up on other tasks"
              : "Everyone's staying another night!"}
          </p>
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
                "hover:border-emerald-300 dark:hover:border-emerald-700"
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
          "inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300",
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
  const [isHovered, setIsHovered] = useState(false);

  const toneMap: Record<typeof tone, { light: string; dark: string; icon: string }> = {
    emerald: {
      light: "bg-emerald-50 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300",
      dark: "dark:bg-emerald-950/30 dark:border-emerald-800 dark:hover:bg-emerald-900/40 dark:hover:border-emerald-700",
      icon: "text-emerald-600 dark:text-emerald-400"
    },
    blue: {
      light: "bg-blue-50 border-blue-200 hover:bg-blue-100 hover:border-blue-300",
      dark: "dark:bg-blue-950/30 dark:border-blue-800 dark:hover:bg-blue-900/40 dark:hover:border-blue-700",
      icon: "text-blue-600 dark:text-blue-400"
    },
    purple: {
      light: "bg-purple-50 border-purple-200 hover:bg-purple-100 hover:border-purple-300",
      dark: "dark:bg-purple-950/30 dark:border-purple-800 dark:hover:bg-purple-900/40 dark:hover:border-purple-700",
      icon: "text-purple-600 dark:text-purple-400"
    },
    amber: {
      light: "bg-amber-50 border-amber-200 hover:bg-amber-100 hover:border-amber-300",
      dark: "dark:bg-amber-950/30 dark:border-amber-800 dark:hover:bg-amber-900/40 dark:hover:border-amber-700",
      icon: "text-amber-600 dark:text-amber-400"
    },
    slate: {
      light: "bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300",
      dark: "dark:bg-slate-800/30 dark:border-slate-700 dark:hover:bg-slate-700/40 dark:hover:border-slate-600",
      icon: "text-slate-600 dark:text-slate-400"
    }
  };

  const colors = toneMap[tone];

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING_CONFIG, delay: getStaggerDelay(index) }}
      whileHover={prefersReducedMotion ? {} : { scale: 1.03, y: -3 }}
      whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      <Link
        href={href}
        aria-label={label}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border-2 px-4 py-5 text-center transition-all shadow-sm hover:shadow-lg",
          colors.light,
          colors.dark,
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        )}
      >
        <motion.span
          className={colors.icon}
          animate={isHovered && !prefersReducedMotion ? {
            rotate: [0, -10, 10, -10, 0],
            scale: [1, 1.1, 1.1, 1.1, 1]
          } : {}}
          transition={{ duration: 0.4 }}
        >
          {icon}
        </motion.span>
        <span className="text-sm font-semibold text-foreground">{label}</span>
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
      "rounded-lg p-4 shadow-sm transition-colors",
      "border border-border bg-card"
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
        <span className={cn(
          "rounded-md p-2",
          "bg-muted text-muted-foreground"
        )}>{icon}</span>
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{hint}</div>
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
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-amber-600 dark:text-amber-400";

  return (
    <div className={cn(
      "rounded-lg overflow-hidden transition-colors",
      "border border-border bg-card"
    )}>
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className={cn("text-xs font-semibold", accent)}>{rows.length}</div>
      </div>
      {rows.length === 0 ? (
        <div className="px-3 py-4 text-sm text-muted-foreground flex items-center gap-2">
          {title === "Arrivals" ? (
            <Sunrise className="h-4 w-4 text-amber-500" />
          ) : (
            <Moon className="h-4 w-4 text-indigo-500" />
          )}
          No {title.toLowerCase()} yet today.
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
