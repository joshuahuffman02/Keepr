"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Calendar,
  CheckCircle,
  ClipboardList,
  Clock,
  DollarSign,
  LogOut,
  MessageCircle,
  Plus,
  ShoppingBag,
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
  staggerChild,
  hoverScale,
  getStaggerDelay,
  reducedMotion as reducedMotionVariants
} from "@/lib/animations";
import { cn } from "@/lib/utils";

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

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const prefersReducedMotion = useReducedMotion();

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

        {/* Hero */}
        <motion.div
          className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
          {...motionProps}
          transition={{ ...SPRING_CONFIG, delay: 0.1 }}
        >
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {today.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })} ·{" "}
              {selectedCampground?.name ?? "Loading campground"}
            </div>
            <h1 className="text-3xl font-bold text-foreground">Front Desk Overview</h1>
            <p className="text-sm text-muted-foreground">
              Stay ahead of today's arrivals, departures, balances, and quick actions.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <motion.div {...hoverScale}>
              <Link
                href="/booking"
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all"
              >
                <Plus className="h-4 w-4" />
                New booking
              </Link>
            </motion.div>
            <motion.div {...hoverScale}>
              <Link
                href="/pos"
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition-all",
                  "border border-border bg-card text-card-foreground",
                  "hover:border-emerald-300 hover:text-emerald-600 dark:hover:border-emerald-700 dark:hover:text-emerald-400"
                )}
              >
                <ShoppingBag className="h-4 w-4" />
                Open POS
              </Link>
            </motion.div>
          </div>
        </motion.div>

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
          transition={{ ...SPRING_CONFIG, delay: 0.15 }}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            <OpsCard label="Arrivals" value={todayArrivals.length} href="/check-in-out" icon={<UserCheck className="h-4 w-4" />} tone="emerald" index={0} prefersReducedMotion={prefersReducedMotion} />
            <OpsCard label="Departures" value={todayDepartures.length} href="/check-in-out" icon={<LogOut className="h-4 w-4" />} tone="amber" index={1} prefersReducedMotion={prefersReducedMotion} />
            <OpsCard label="In-house" value={inHouse.length} href="/reservations" icon={<Users className="h-4 w-4" />} tone="blue" index={2} prefersReducedMotion={prefersReducedMotion} />
            <OpsCard label="Occupancy" value={`${occupancyRate}%`} href="/calendar" icon={<Calendar className="h-4 w-4" />} tone="purple" index={3} prefersReducedMotion={prefersReducedMotion} />
            <OpsCard label="Balance due" value={formatMoney(outstandingBalanceCents)} href="/billing/repeat-charges" icon={<DollarSign className="h-4 w-4" />} tone="rose" index={4} prefersReducedMotion={prefersReducedMotion} />
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Link href="/calendar" className={cn(
              "inline-flex items-center gap-1 rounded px-3 py-1 transition-colors",
              "border border-border bg-card hover:border-emerald-300 hover:text-emerald-600",
              "dark:hover:border-emerald-700 dark:hover:text-emerald-400"
            )}>
              <Calendar className="h-3 w-3" /> Jump to today
            </Link>
            <Link href="/check-in-out" className={cn(
              "inline-flex items-center gap-1 rounded px-3 py-1 transition-colors",
              "border border-border bg-card hover:border-emerald-300 hover:text-emerald-600",
              "dark:hover:border-emerald-700 dark:hover:text-emerald-400"
            )}>
              <UserCheck className="h-3 w-3" /> Today's arrivals/departures
            </Link>
            <Link href={`/reservations?focus=today`} className={cn(
              "inline-flex items-center gap-1 rounded px-3 py-1 transition-colors",
              "border border-border bg-card hover:border-emerald-300 hover:text-emerald-600",
              "dark:hover:border-emerald-700 dark:hover:text-emerald-400"
            )}>
              <ClipboardList className="h-3 w-3" /> View reservations list
            </Link>
          </div>
        </motion.div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* QUICK ACTIONS - Prominently displayed above the fold */}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
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
            />
            <BoardCard
              title="Departures"
              count={todayDepartures.length}
              ctaLabel="Open departures"
              ctaHref="/check-in-out"
              rows={todayDepartures}
              tone="amber"
              prefersReducedMotion={prefersReducedMotion}
            />
          </div>
        </motion.div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ATTENTION - Needs action items */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <motion.div
          className="space-y-3"
          {...motionProps}
          transition={{ ...SPRING_CONFIG, delay: 0.3 }}
        >
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 pl-1">
            <DollarSign className="h-4 w-4" />
            Needs Attention
            <HelpTooltip
              title="Outstanding Balances"
              content={
                <div className="space-y-2">
                  <p>This section highlights reservations with unpaid balances that require collection.</p>
                  <p className="text-xs text-muted-foreground">
                    Click "Resolve" to process payment, send a reminder, or adjust the balance.
                  </p>
                </div>
              }
              side="right"
              maxWidth={300}
            />
          </div>
          <div className={cn(
            "rounded-xl p-5 space-y-4 backdrop-blur-sm transition-colors",
            "border-2 border-amber-200 bg-amber-50/80",
            "dark:border-amber-700/50 dark:bg-amber-950/30"
          )}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Balances Due</h3>
                <p className="text-sm text-muted-foreground">Outstanding amounts that need collection.</p>
              </div>
              <span className={cn(
                "rounded-full text-xs font-bold px-3 py-1",
                "bg-amber-100 text-amber-800 border border-amber-200",
                "dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700"
              )}>
                {attentionList.length} open
              </span>
            </div>
            {attentionList.length === 0 ? (
              <div className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-3 text-sm",
                "border border-dashed border-emerald-300 bg-emerald-50 text-emerald-700",
                "dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
              )}>
                <CheckCircle className="h-4 w-4" />
                All clear — no outstanding balances right now.
              </div>
            ) : (
              <div className="space-y-2">
                {attentionList.map((r, index) => (
                  <motion.div
                    key={r.id}
                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...SPRING_FAST, delay: getStaggerDelay(index) }}
                    className={cn(
                      "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg px-3 py-2.5 shadow-sm",
                      "border border-amber-200 bg-white",
                      "dark:border-amber-800 dark:bg-slate-800/50"
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
                      <span className="text-sm font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">{formatMoney(r.balance)}</span>
                      <Link
                        href="/billing/repeat-charges"
                        className="inline-flex items-center justify-center rounded-md bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all"
                      >
                        Resolve
                      </Link>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Alerts, Additional Metrics, and 14-day occupancy */}
        <motion.div
          className="grid grid-cols-1 xl:grid-cols-3 gap-4"
          {...motionProps}
          transition={{ ...SPRING_CONFIG, delay: 0.35 }}
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
                "rounded border px-3 py-2 text-sm",
                "border-border bg-muted text-muted-foreground"
              )}>All clear.</div>
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
                        "flex items-center justify-between rounded px-3 py-2 text-sm transition-colors",
                        "border border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300",
                        "dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:border-amber-700"
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
                "rounded border px-3 py-2 text-sm",
                "border-border bg-muted text-muted-foreground"
              )}>No data.</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                {occupancy14.map((d, index) => (
                  <motion.div
                    key={d.label}
                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ ...SPRING_FAST, delay: getStaggerDelay(index, 0.1) }}
                  >
                    <Link
                      href="/calendar"
                      className={cn(
                        "flex flex-col gap-1 rounded px-3 py-2 transition-all hover:shadow-md",
                        "border border-border bg-card",
                        "hover:border-emerald-300 dark:hover:border-emerald-700"
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
          transition={{ ...SPRING_CONFIG, delay: 0.4 }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Quick search</h3>
            <span className="text-xs text-muted-foreground">Guest, site, or reservation ID</span>
          </div>
          <input
            className={cn(
              "w-full rounded px-3 py-2 text-sm transition-all",
              "border border-border bg-background text-foreground placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500",
              "dark:focus:ring-emerald-400/30 dark:focus:border-emerald-400"
            )}
            placeholder="Search guest, site, reservation…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <div className="space-y-2">
              {searchResults.length === 0 && <div className="text-sm text-muted-foreground">No matches.</div>}
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
                      "flex items-center justify-between rounded px-3 py-2 text-sm transition-all",
                      "border border-border bg-card hover:border-emerald-300 hover:shadow-sm",
                      "dark:hover:border-emerald-700"
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
          transition={{ ...SPRING_CONFIG, delay: 0.45 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Recent activity</h3>
              <p className="text-sm text-muted-foreground">Latest arrivals, departures, and moves.</p>
            </div>
            <Link href="/reservations" className="text-sm font-semibold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 flex items-center gap-1">
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
  prefersReducedMotion
}: {
  label: string;
  value: string | number;
  href: string;
  icon: React.ReactNode;
  tone: "emerald" | "amber" | "blue" | "purple" | "rose";
  index: number;
  prefersReducedMotion: boolean | null;
}) {
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
    >
      <Link
        href={href}
        className={cn(
          "flex items-center justify-between gap-3 rounded-xl border p-4 bg-gradient-to-br backdrop-blur-sm transition-all hover:shadow-lg hover:shadow-emerald-500/10",
          toneMap[tone].light,
          toneMap[tone].dark
        )}
      >
        <div className="flex items-center gap-3">
          <span className={cn(
            "rounded-lg p-2",
            "bg-white/70 text-slate-700",
            "dark:bg-white/10 dark:text-slate-300"
          )}>{icon}</span>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="text-xl font-bold text-foreground">{value}</div>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
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
  prefersReducedMotion
}: {
  title: string;
  count: number;
  ctaLabel: string;
  ctaHref: string;
  rows: Reservation[];
  tone?: "emerald" | "amber";
  prefersReducedMotion: boolean | null;
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

      {rows.length === 0 ? (
        <div className={cn(
          "rounded-lg p-6 text-center text-sm",
          "border border-dashed border-border bg-muted text-muted-foreground"
        )}>
          No {title.toLowerCase()} today.
        </div>
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

      <Link href={ctaHref} className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300">
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
    >
      <Link
        href={href}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border-2 px-4 py-5 text-center transition-all shadow-sm hover:shadow-lg",
          colors.light,
          colors.dark
        )}
      >
        <span className={colors.icon}>{icon}</span>
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
        <div className="px-3 py-4 text-sm text-muted-foreground">No activity yet.</div>
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
