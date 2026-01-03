"use client";

import React, { useMemo, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowRight,
  CalendarDays,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Lock,
  Search,
  Sparkles,
  Users,
  Wrench,
  User,
  Mail,
  Phone,
  CreditCard,
  Tent,
  LogIn,
  LogOut,
  Pencil,
  ExternalLink,
  XCircle,
  CheckCircle,
  Clock,
  DollarSign,
  LayoutList,
  AlignJustify,
  Rows3,
  Building2
} from "lucide-react";

import { DashboardShell } from "../../components/ui/layout/DashboardShell";
import { PageHeader } from "../../components/ui/layout/PageHeader";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { Badge } from "../../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { cn } from "../../lib/utils";

import { useCalendarData } from "../calendar/useCalendarData";
import { diffInDays, formatLocalDateInput, parseLocalDateInput, toLocalDate } from "../calendar/utils";
import type { CalendarReservation, CalendarSite, DayMeta, QuotePreview } from "../calendar/types";

const DAY_RANGES = [7, 14, 21, 30];
const SITE_COL_WIDTH = 240;
const DAY_MIN_WIDTH = 104;

const SITE_TYPE_STYLES: Record<string, { label: string; badge: string; border: string }> = {
  rv: { label: "RV", badge: "bg-status-success/15 text-status-success", border: "border-l-status-success" },
  tent: { label: "Tent", badge: "bg-status-warning/15 text-status-warning", border: "border-l-status-warning" },
  cabin: { label: "Cabin", badge: "bg-rose-100 text-rose-700", border: "border-l-rose-400" },
  group: { label: "Group", badge: "bg-indigo-100 text-indigo-700", border: "border-l-indigo-400" },
  glamping: { label: "Glamp", badge: "bg-cyan-100 text-cyan-700", border: "border-l-cyan-400" },
  default: { label: "Site", badge: "bg-muted text-muted-foreground", border: "border-l-border" }
};

// Density configuration for calendar grid
type DensityMode = "compact" | "standard" | "expanded";

const DENSITY_CONFIG: Record<DensityMode, {
  rowHeight: number;
  chipHeight: number;
  padding: string;
  fontSize: string;
  showDetails: boolean;
  icon: typeof LayoutList;
  label: string;
}> = {
  compact: {
    rowHeight: 40,
    chipHeight: 28,
    padding: "py-1",
    fontSize: "text-[9px]",
    showDetails: false,
    icon: LayoutList,
    label: "Compact"
  },
  standard: {
    rowHeight: 64,
    chipHeight: 48,
    padding: "py-3",
    fontSize: "text-[11px]",
    showDetails: true,
    icon: AlignJustify,
    label: "Standard"
  },
  expanded: {
    rowHeight: 88,
    chipHeight: 72,
    padding: "py-4",
    fontSize: "text-xs",
    showDetails: true,
    icon: Rows3,
    label: "Expanded"
  }
};

// Status configuration for legend and chips
const STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof CheckCircle;
  description: string;
}> = {
  confirmed: {
    label: "Confirmed",
    color: "text-status-success",
    bgColor: "bg-status-success",
    borderColor: "border-status-success",
    icon: CheckCircle,
    description: "Reservation is confirmed and ready"
  },
  checked_in: {
    label: "Checked In",
    color: "text-status-info",
    bgColor: "bg-status-info",
    borderColor: "border-status-info",
    icon: Clock,
    description: "Guest is currently on-site"
  },
  pending: {
    label: "Pending",
    color: "text-status-warning",
    bgColor: "bg-status-warning",
    borderColor: "border-status-warning",
    icon: Clock,
    description: "Awaiting confirmation or payment"
  },
  cancelled: {
    label: "Cancelled",
    color: "text-status-error",
    bgColor: "bg-status-error",
    borderColor: "border-status-error",
    icon: XCircle,
    description: "Reservation has been cancelled"
  },
  checked_out: {
    label: "Checked Out",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    borderColor: "border-muted",
    icon: LogOut,
    description: "Guest has departed"
  }
};

interface ActiveSelection {
  siteId: string;
  startIdx: number;
  endIdx: number;
}

interface DragState {
  siteId: string | null;
  startIdx: number | null;
  endIdx: number | null;
  isDragging: boolean;
  pointerId: number | null;
}

export default function CalendarPage() {
  const router = useRouter();
  const data = useCalendarData();
  const { state, actions, queries, derived } = data;

  const sites = queries.sites.data || [];
  const guests = queries.guests.data || [];
  const reservations = derived.filteredReservations;
  const typeFilteredSites = useMemo(() => {
    if (state.siteTypeFilter === "all") return sites;
    return sites.filter((site) => site.siteType === state.siteTypeFilter);
  }, [sites, state.siteTypeFilter]);
  const searchFilteredSiteIds = useMemo(
    () => new Set(reservations.map((res) => res.siteId).filter(Boolean) as string[]),
    [reservations]
  );
  const visibleSites = useMemo(() => {
    if (!state.guestSearch.trim()) return typeFilteredSites;
    return typeFilteredSites.filter((site) => searchFilteredSiteIds.has(site.id));
  }, [typeFilteredSites, state.guestSearch, searchFilteredSiteIds]);
  const visibleSiteIds = useMemo(() => new Set(visibleSites.map((site) => site.id)), [visibleSites]);
  const visibleReservations = useMemo(
    () => reservations.filter((res) => (res.siteId ? visibleSiteIds.has(res.siteId) : false)),
    [reservations, visibleSiteIds]
  );
  const guestSearchStats = useMemo(() => {
    const search = state.guestSearch.trim().toLowerCase();
    if (!search) return { count: 0, samples: [] as string[] };
    let count = 0;
    const samples: string[] = [];
    for (const guest of guests) {
      const first = (guest.primaryFirstName || "").toLowerCase();
      const last = (guest.primaryLastName || "").toLowerCase();
      const email = (guest.email || "").toLowerCase();
      const phone = (guest.phone || "").toLowerCase();
      const fullName = `${first} ${last}`.trim();
      if (!first.includes(search) && !last.includes(search) && !email.includes(search) && !phone.includes(search) && !fullName.includes(search)) {
        continue;
      }
      count += 1;
      if (samples.length < 2) {
        samples.push(fullName || guest.email || "Guest");
      }
    }
    return { count, samples };
  }, [guests, state.guestSearch]);

  // Get the selected reservation for the popup
  interface ReservationWithId {
    id: string;
  }
  const selectedReservation = useMemo(() => {
    if (!state.selectedReservationId) return null;
    // Look in all reservations (not just filtered)
    const allReservations = (queries.reservations.data || []) as ReservationWithId[];
    return allReservations.find((r) => r.id === state.selectedReservationId) || null;
  }, [state.selectedReservationId, queries.reservations.data]);
  const visibleSiteTypes = useMemo(() => {
    const types = new Set<string>();
    visibleSites.forEach((site) => {
      if (site.siteType) types.add(site.siteType);
    });
    return Array.from(types);
  }, [visibleSites]);

  // Count reservations by status for filter chips
  const reservationCountsByStatus = useMemo(() => {
    const counts: Record<string, number> = {
      confirmed: 0,
      checked_in: 0,
      pending: 0,
      cancelled: 0,
      checked_out: 0
    };
    // Use all visible reservations (not status-filtered) for accurate counts
    const allRes = queries.reservations.data || [];
    for (const res of allRes) {
      const status = res.status || "pending";
      if (counts[status] !== undefined) {
        counts[status]++;
      }
    }
    return counts;
  }, [queries.reservations.data]);

  const rangeLabel = useMemo(() => {
    const start = parseLocalDateInput(state.startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + state.dayCount - 1);
    return `${format(start, "MMM d")} - ${format(end, "MMM d")}`;
  }, [state.startDate, state.dayCount]);

  const [todayKey, setTodayKey] = useState("");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [density, setDensity] = useState<DensityMode>("standard");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Get campgrounds list for the inline selector
  const campgrounds = queries.campgrounds.data || [];
  const selectedCampgroundDetails = derived.selectedCampgroundDetails;

  useEffect(() => {
    setTodayKey(formatLocalDateInput(new Date()));
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        // Only handle Escape in inputs
        if (e.key === "Escape") {
          (target as HTMLInputElement).blur();
          return;
        }
        return;
      }

      // Arrow keys: navigate days
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const d = parseLocalDateInput(state.startDate);
        d.setDate(d.getDate() - state.dayCount);
        actions.setStartDate(formatLocalDateInput(d));
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const d = parseLocalDateInput(state.startDate);
        d.setDate(d.getDate() + state.dayCount);
        actions.setStartDate(formatLocalDateInput(d));
        return;
      }

      // T: Jump to today
      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        actions.setStartDate(formatLocalDateInput(new Date()));
        return;
      }

      // N: New reservation (focus search or show message)
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        router.push("/booking");
        return;
      }

      // R: Refresh
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        queries.sites.refetch();
        queries.reservations.refetch();
        return;
      }

      // /: Focus search
      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Escape: Clear selection
      if (e.key === "Escape") {
        e.preventDefault();
        actions.setSelectedReservationId(null);
        setShowShortcuts(false);
        return;
      }

      // 1-9: Set day range
      if (e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const idx = parseInt(e.key, 10) - 1;
        const dayRanges = [7, 14, 21, 30];
        if (idx < dayRanges.length) {
          actions.setDayCount(dayRanges[idx]);
        }
        return;
      }

      // ?: Show shortcuts
      if (e.key === "?") {
        e.preventDefault();
        setShowShortcuts(true);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.startDate, state.dayCount, actions, router, queries]);

  const todayDate = useMemo(() => (todayKey ? parseLocalDateInput(todayKey) : null), [todayKey]);
  const arrivalsToday = useMemo(() => {
    if (!todayKey) return 0;
    return visibleReservations.filter((res) => formatLocalDateInput(toLocalDate(res.arrivalDate)) === todayKey).length;
  }, [visibleReservations, todayKey]);
  const departuresToday = useMemo(() => {
    if (!todayKey) return 0;
    return visibleReservations.filter((res) => formatLocalDateInput(toLocalDate(res.departureDate)) === todayKey).length;
  }, [visibleReservations, todayKey]);
  const occupiedToday = useMemo(() => {
    if (!todayDate) return 0;
    return visibleReservations.filter((res) => {
      const arrival = toLocalDate(res.arrivalDate);
      const departure = toLocalDate(res.departureDate);
      return arrival <= todayDate && departure > todayDate;
    }).length;
  }, [visibleReservations, todayDate]);
  const availableToday = Math.max(0, visibleSites.length - occupiedToday);

  const maintenanceCount = Array.isArray(queries.maintenance.data) ? queries.maintenance.data.length : 0;
  const housekeepingCount = Array.isArray(queries.housekeeping.data) ? queries.housekeeping.data.length : 0;

  const handlePrev = useCallback(() => {
    const d = parseLocalDateInput(state.startDate);
    d.setDate(d.getDate() - state.dayCount);
    actions.setStartDate(formatLocalDateInput(d));
  }, [state.startDate, state.dayCount, actions]);

  const handleNext = useCallback(() => {
    const d = parseLocalDateInput(state.startDate);
    d.setDate(d.getDate() + state.dayCount);
    actions.setStartDate(formatLocalDateInput(d));
  }, [state.startDate, state.dayCount, actions]);

  const bookingDraft = state.reservationDraft;
  const hasFilters = Boolean(
    state.guestSearch || state.statusFilter !== "all" || state.siteTypeFilter !== "all" || state.arrivalsNowOnly
  );
  const activeFilterCount =
    (state.guestSearch ? 1 : 0) +
    (state.statusFilter !== "all" ? 1 : 0) +
    (state.siteTypeFilter !== "all" ? 1 : 0) +
    (state.arrivalsNowOnly ? 1 : 0);

  const handleBookNow = useCallback(() => {
    if (!bookingDraft) return;
    const params = new URLSearchParams({
      siteId: bookingDraft.siteId,
      arrivalDate: bookingDraft.arrival,
      departureDate: bookingDraft.departure
    });
    router.push(`/booking?${params.toString()}`);
  }, [bookingDraft, router]);

  return (
    <DashboardShell density="full">
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Calendar", href: "/calendar" }
          ]}
        />

        <PageHeader
          title={(
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-status-success/15 text-status-success">
                <CalendarDays className="h-5 w-5" />
              </span>
              <span>Booking Calendar</span>
            </span>
          )}
          subtitle="Drag across dates to build a stay. Release to preview pricing and availability."
          actions={(
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center bg-card rounded-xl border border-border p-1">
                {DAY_RANGES.map((range) => (
                  <Button
                    key={range}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 px-3 text-[11px] font-semibold",
                      state.dayCount === range ? "bg-status-success/10 text-status-success" : "text-muted-foreground"
                    )}
                    onClick={() => actions.setDayCount(range)}
                  >
                    {range}d
                  </Button>
                ))}
              </div>

              <div className="flex items-center bg-card rounded-xl border border-border p-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={handlePrev}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 text-xs font-semibold"
                  onClick={() => actions.setStartDate(formatLocalDateInput(new Date()))}
                >
                  Today
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={handleNext}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground">
                <CalendarCheck className="h-4 w-4 text-status-success" />
                <span>{rangeLabel}</span>
              </div>

              {/* Density Toggle */}
              <div className="flex items-center bg-card rounded-xl border border-border p-1">
                {(Object.keys(DENSITY_CONFIG) as DensityMode[]).map((mode) => {
                  const config = DENSITY_CONFIG[mode];
                  const Icon = config.icon;
                  return (
                    <Button
                      key={mode}
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-8 px-2.5 gap-1.5",
                        density === mode ? "bg-status-success/10 text-status-success" : "text-muted-foreground"
                      )}
                      onClick={() => setDensity(mode)}
                      title={`${config.label} view`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-[11px] font-semibold hidden sm:inline">
                        {config.label}
                      </span>
                    </Button>
                  );
                })}
              </div>

              {/* Inline Campground Selector */}
              {campgrounds.length > 0 && (
                <div className="flex items-center bg-card rounded-xl border border-border">
                  <div className="flex items-center gap-2 pl-3 pr-1">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Select
                    value={state.selectedCampground || ""}
                    onValueChange={(value) => actions.setSelectedCampground(value)}
                  >
                    <SelectTrigger className="h-9 min-w-[160px] border-0 shadow-none focus:ring-0 text-sm font-semibold">
                      <SelectValue placeholder="Select campground">
                        {selectedCampgroundDetails?.name || "Select campground"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {campgrounds.map((cg) => (
                        <SelectItem key={cg.id} value={cg.id}>
                          {cg.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        />

        <Card className="p-4 border-border shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Filters & Search</span>
              {hasFilters && (
                <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {activeFilterCount} on
                </span>
              )}
            </div>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  actions.setGuestSearch("");
                  actions.setStatusFilter("all");
                  actions.setSiteTypeFilter("all");
                  actions.setArrivalsNowOnly(false);
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <Label className="text-xs font-medium text-muted-foreground">Search guests</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                <Input
                  ref={searchInputRef}
                  className="h-10 pl-9"
                  placeholder="Name, phone, email... (Press / to search)"
                  value={state.guestSearch}
                  onChange={(e) => actions.setGuestSearch(e.target.value)}
                />
              </div>
              {state.guestSearch && (
                <div className="text-[11px] text-muted-foreground">
                  {queries.guests.isLoading
                    ? "Searching guests..."
                    : guestSearchStats.count > 0
                      ? `Matches ${guestSearchStats.count} guests`
                      : "No guests found"}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Status</Label>
              <Select value={state.statusFilter} onValueChange={actions.setStatusFilter}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="checked_in">Checked In</SelectItem>
                  <SelectItem value="pending">Pending / Hold</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Site type</Label>
              <Select value={state.siteTypeFilter} onValueChange={actions.setSiteTypeFilter}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="rv">RV</SelectItem>
                  <SelectItem value="tent">Tent</SelectItem>
                  <SelectItem value="cabin">Cabin</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                  <SelectItem value="glamping">Glamping</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs font-semibold text-muted-foreground">
              <div className="flex items-center gap-2">
                <Switch checked={state.arrivalsNowOnly} onCheckedChange={actions.setArrivalsNowOnly} />
                <span>Arrivals today only</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              {state.guestSearch || state.statusFilter !== "all" || state.siteTypeFilter !== "all" || state.arrivalsNowOnly
                ? `${visibleReservations.length} stays match filters`
                : `${visibleReservations.length} stays in view`}
            </div>
          </div>
        </Card>

        {!state.selectedCampground && (
          <Card className="p-6 border-dashed border-border text-center text-muted-foreground">
            Choose a campground from the global selector to load the booking grid.
          </Card>
        )}

        {state.selectedCampground && (
          <div className="space-y-4">
            {bookingDraft ? (
              <Card className="p-4 border-emerald-200 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-emerald-700">Draft booking</div>
                    <div className="text-sm font-semibold text-foreground">{bookingDraft.siteName}</div>
                    <div className="text-xs text-muted-foreground">
                      {bookingDraft.arrival} → {bookingDraft.departure} · {bookingDraft.nights} nights
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-xl font-black text-foreground">${(bookingDraft.total / 100).toFixed(2)}</div>
                    <Button className="gap-2" onClick={handleBookNow}>
                      Continue booking
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => actions.setReservationDraft(null)}>
                      Clear
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-4 border-dashed border-border text-sm text-muted-foreground">
                Drag across dates to create a selection and see a booking draft here.
              </Card>
            )}

            <div className="grid gap-4 md:grid-cols-4">
              <StatCard label="Occupied tonight" value={`${occupiedToday}`} sub={`${availableToday} open sites`} icon={<Users className="h-4 w-4" />} />
              <StatCard label="Arrivals today" value={`${arrivalsToday}`} sub={`${departuresToday} departures`} icon={<CalendarCheck className="h-4 w-4" />} />
              <StatCard label="Maintenance" value={`${maintenanceCount}`} sub="Open tickets" icon={<Wrench className="h-4 w-4" />} />
              <StatCard label="Housekeeping" value={`${housekeepingCount}`} sub="Active tasks" icon={<Sparkles className="h-4 w-4" />} />
            </div>

            {/* Status Legend */}
            <StatusLegend />

            {/* Status Filter Chips */}
            <Card className="p-4 border-border shadow-sm">
              <StatusFilterChips
                activeFilter={state.statusFilter}
                onFilterChange={actions.setStatusFilter}
                reservationCounts={reservationCountsByStatus}
              />
            </Card>

            {visibleSiteTypes.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
                <span className="text-xs font-medium text-muted-foreground">Site types</span>
                {visibleSiteTypes.map((type) => {
                  const meta = SITE_TYPE_STYLES[type] || SITE_TYPE_STYLES.default;
                  return (
                    <span key={type} className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", meta.badge)}>
                      {meta.label}
                    </span>
                  );
                })}
              </div>
            )}

            {state.guestSearch && visibleSites.length === 0 ? (
              <Card className="p-6 border-dashed border-border text-center text-muted-foreground">
                No sites match that guest search in this view.
              </Card>
            ) : (
              <CalendarGrid
                days={derived.days}
                dayCount={state.dayCount}
                isLoading={queries.sites.isLoading || queries.reservations.isLoading}
                sites={visibleSites}
                reservationsBySite={derived.reservationsBySite}
                selectionDraft={bookingDraft}
                onSelectionComplete={actions.selectRange}
                onReservationClick={actions.setSelectedReservationId}
                density={density}
              />
            )}
          </div>
        )}
      </div>

      {/* Reservation Detail Popup */}
      <Dialog open={!!selectedReservation} onOpenChange={(open) => !open && actions.setSelectedReservationId(null)}>
        <DialogContent className="sm:max-w-md">
          {selectedReservation && (() => {
            const res = selectedReservation as any;
            const guestName = `${res.guest?.primaryFirstName || ""} ${res.guest?.primaryLastName || ""}`.trim() || "Guest";
            const nights = Math.ceil((new Date(res.departureDate).getTime() - new Date(res.arrivalDate).getTime()) / (1000 * 60 * 60 * 24));
            const total = res.totalAmount ?? 0;
            const paid = res.paidAmount ?? 0;
            const balance = total - paid;
            const statusColors: Record<string, string> = {
              confirmed: "bg-status-success/15 text-status-success border-status-success/30",
              checked_in: "bg-status-info/15 text-status-info border-status-info/30",
              checked_out: "bg-muted text-muted-foreground border-border",
              cancelled: "bg-status-error/15 text-status-error border-status-error/30",
              pending: "bg-status-warning/15 text-status-warning border-status-warning/30"
            };
            const statusIcons: Record<string, React.ReactNode> = {
              confirmed: <CheckCircle className="h-3.5 w-3.5" />,
              checked_in: <Clock className="h-3.5 w-3.5" />,
              checked_out: <LogOut className="h-3.5 w-3.5" />,
              cancelled: <XCircle className="h-3.5 w-3.5" />,
              pending: <Clock className="h-3.5 w-3.5" />
            };

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <User className="h-5 w-5 text-muted-foreground/70" />
                      <span>{guestName}</span>
                    </div>
                    <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium", statusColors[res.status] || statusColors.pending)}>
                      {statusIcons[res.status] || statusIcons.pending}
                      <span className="capitalize">{res.status?.replace(/_/g, " ") || "Pending"}</span>
                    </div>
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  {/* Site & Dates */}
                  <div className="flex items-start gap-3">
                    <Tent className="h-4 w-4 text-muted-foreground/70 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-foreground">
                        {res.site?.name || res.site?.siteNumber || "Unassigned"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(res.arrivalDate), "MMM d")} → {format(new Date(res.departureDate), "MMM d, yyyy")} • {nights} night{nights !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>

                  {/* Contact Info */}
                  {(res.guest?.email || res.guest?.phone) && (
                    <div className="space-y-2">
                      {res.guest?.email && (
                        <div className="flex items-center gap-3 text-sm">
                          <Mail className="h-4 w-4 text-muted-foreground/70" />
                          <span className="text-muted-foreground">{res.guest.email}</span>
                        </div>
                      )}
                      {res.guest?.phone && (
                        <div className="flex items-center gap-3 text-sm">
                          <Phone className="h-4 w-4 text-muted-foreground/70" />
                          <span className="text-muted-foreground">{res.guest.phone}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Payment Summary */}
                  <div className="flex items-start gap-3">
                    <CreditCard className="h-4 w-4 text-muted-foreground/70 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">${(total / 100).toFixed(2)}</span>
                        {balance > 0 ? (
                          <span className="text-xs font-medium text-amber-600">${(balance / 100).toFixed(2)} due</span>
                        ) : paid > 0 ? (
                          <span className="text-xs font-medium text-emerald-600">Paid in full</span>
                        ) : null}
                      </div>
                      {paid > 0 && paid < total && (
                        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${Math.min(100, (paid / total) * 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      router.push(`/reservations/${res.id}`);
                      actions.setSelectedReservationId(null);
                    }}
                  >
                    <ExternalLink className="h-4 w-4 mr-1.5" />
                    View Details
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      router.push(`/campgrounds/${state.selectedCampground}/reservations/${res.id}`);
                      actions.setSelectedReservationId(null);
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-1.5" />
                    Edit
                  </Button>
                  {res.status === "confirmed" && (
                    <Button
                      size="sm"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => {
                        router.push(`/check-in-out?reservationId=${res.id}`);
                        actions.setSelectedReservationId(null);
                      }}
                    >
                      <LogIn className="h-4 w-4 mr-1.5" />
                      Check In
                    </Button>
                  )}
                  {res.status === "checked_in" && (
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        router.push(`/check-in-out?reservationId=${res.id}`);
                        actions.setSelectedReservationId(null);
                      }}
                    >
                      <LogOut className="h-4 w-4 mr-1.5" />
                      Check Out
                    </Button>
                  )}
                  {balance > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        router.push(`/reservations/${res.id}?action=payment`);
                        actions.setSelectedReservationId(null);
                      }}
                    >
                      <DollarSign className="h-4 w-4 mr-1.5" />
                      Collect Payment
                    </Button>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Keyboard Shortcuts Dialog */}
      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Keyboard Shortcuts
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 text-sm py-4">
            <ShortcutItem keys={["←", "→"]} desc="Navigate periods" />
            <ShortcutItem keys={["T"]} desc="Jump to today" />
            <ShortcutItem keys={["N"]} desc="New reservation" />
            <ShortcutItem keys={["R"]} desc="Refresh data" />
            <ShortcutItem keys={["/"]} desc="Focus search" />
            <ShortcutItem keys={["Esc"]} desc="Clear selection" />
            <ShortcutItem keys={["1-4"]} desc="Set day range (7/14/21/30)" />
            <ShortcutItem keys={["?"]} desc="Show this help" />
          </div>
          <div className="text-xs text-muted-foreground border-t pt-3">
            Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Esc</kbd> to close
          </div>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

function ShortcutItem({ keys, desc }: { keys: string[]; desc: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-muted-foreground">{desc}</span>
      <div className="flex gap-1">
        {keys.map((k) => (
          <kbd key={k} className="px-2 py-1 bg-muted rounded text-xs font-mono text-foreground shadow-sm border border-border">
            {k}
          </kbd>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon }: { label: string; value: string; sub: string; icon: React.ReactNode }) {
  return (
    <Card className="p-4 border-border shadow-sm flex items-center gap-3">
      <div className="h-10 w-10 rounded-xl bg-muted text-foreground flex items-center justify-center">
        {icon}
      </div>
      <div>
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </div>
    </Card>
  );
}

interface StatusLegendProps {
  className?: string;
}

function StatusLegend({ className }: StatusLegendProps) {
  return (
    <Card className={cn("p-4 border-border shadow-sm", className)}>
      <div className="flex items-center gap-2 mb-3">
        <div className="h-5 w-5 rounded-md bg-muted flex items-center justify-center">
          <CalendarDays className="h-3 w-3 text-muted-foreground" />
        </div>
        <span className="text-xs font-medium text-muted-foreground">Status Legend</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Object.entries(STATUS_CONFIG).map(([key, config]) => {
          const Icon = config.icon;
          return (
            <div
              key={key}
              className="flex items-center gap-2 group"
              title={config.description}
            >
              <div className={cn(
                "h-6 w-6 rounded-md flex items-center justify-center text-white shadow-sm",
                config.bgColor
              )}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-foreground truncate">
                  {config.label}
                </div>
                <div className="text-[10px] text-muted-foreground/70 truncate hidden sm:block">
                  {config.description}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

interface StatusFilterChipsProps {
  activeFilter: string;
  onFilterChange: (status: string) => void;
  reservationCounts?: Record<string, number>;
  className?: string;
}

function StatusFilterChips({ activeFilter, onFilterChange, reservationCounts = {}, className }: StatusFilterChipsProps) {
  const statuses = ["all", "confirmed", "checked_in", "pending", "cancelled"] as const;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-xs font-medium text-muted-foreground mr-1">
        Filter by status
      </span>
      {statuses.map((status) => {
        const isActive = activeFilter === status;
        const config = status === "all" ? null : STATUS_CONFIG[status];
        const count = status === "all"
          ? Object.values(reservationCounts).reduce((sum, n) => sum + n, 0)
          : reservationCounts[status] || 0;

        return (
          <button
            key={status}
            type="button"
            onClick={() => onFilterChange(status)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200",
              "border shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500/50",
              isActive
                ? config
                  ? cn("text-white border-transparent", config.bgColor)
                  : "bg-foreground text-background border-transparent"
                : config
                  ? cn("bg-card border-border hover:border-border", config.color)
                  : "bg-card text-muted-foreground border-border hover:border-border"
            )}
          >
            {config && (() => {
              const Icon = config.icon;
              return <Icon className="h-3 w-3" />;
            })()}
            <span className="capitalize">{status === "all" ? "All" : config?.label}</span>
            {count > 0 && (
              <span className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                isActive
                  ? "bg-card/20"
                  : "bg-muted"
              )}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface CalendarGridProps {
  days: DayMeta[];
  dayCount: number;
  isLoading: boolean;
  sites: CalendarSite[];
  reservationsBySite: Record<string, CalendarReservation[]>;
  selectionDraft: QuotePreview | null;
  onSelectionComplete: (siteId: string, arrival: Date, departure: Date) => void;
  onReservationClick: (id: string) => void;
  density: DensityMode;
}

function CalendarGrid({
  days,
  dayCount,
  isLoading,
  sites,
  reservationsBySite,
  selectionDraft,
  onSelectionComplete,
  onReservationClick,
  density
}: CalendarGridProps) {
  const densityConfig = DENSITY_CONFIG[density];
  const gridRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState>({
    siteId: null,
    startIdx: null,
    endIdx: null,
    isDragging: false,
    pointerId: null
  });
  const dragRef = useRef<DragState>(dragState);

  const setDrag = useCallback((next: DragState) => {
    dragRef.current = next;
    setDragState(next);
  }, []);

  const clearDrag = useCallback(() => {
    setDrag({ siteId: null, startIdx: null, endIdx: null, isDragging: false, pointerId: null });
  }, [setDrag]);

  const resolveDragTarget = useCallback(
    (clientX: number, clientY: number) => {
      const grid = gridRef.current;
      if (!grid) return null;

      const elements = typeof document.elementsFromPoint === "function"
        ? document.elementsFromPoint(clientX, clientY)
        : [document.elementFromPoint(clientX, clientY)].filter(Boolean);

      const cell = elements.find((el) =>
        el instanceof HTMLElement && (el as HTMLElement).dataset.dayIdx !== undefined
      ) as HTMLElement | undefined;

      if (cell) {
        const dayIdx = Number(cell.dataset.dayIdx);
        if (!Number.isNaN(dayIdx)) {
          return { dayIdx };
        }
      }

      const bounds = grid.getBoundingClientRect();
      if (clientX < bounds.left + SITE_COL_WIDTH || clientX > bounds.right) return null;
      const dayWidth = (bounds.width - SITE_COL_WIDTH) / dayCount;
      const offset = Math.max(0, clientX - bounds.left - SITE_COL_WIDTH);
      const idx = Math.floor(offset / Math.max(dayWidth, 1));
      const dayIdx = Math.min(dayCount - 1, Math.max(0, idx));
      return { dayIdx };
    },
    [dayCount]
  );

  const updateDragEnd = useCallback((dayIdx: number) => {
    const current = dragRef.current;
    if (!current.isDragging || current.endIdx === dayIdx) return;
    setDrag({ ...current, endIdx: dayIdx });
  }, [setDrag]);

  const finishDrag = useCallback(() => {
    const drag = dragRef.current;
    if (drag.isDragging && drag.siteId && drag.startIdx !== null && drag.endIdx !== null) {
      const startIdx = Math.min(drag.startIdx, drag.endIdx);
      const endIdx = Math.max(drag.startIdx, drag.endIdx);

      const arrivalDate = new Date(days[startIdx].date);
      const departureDate = new Date(days[endIdx].date);
      departureDate.setDate(departureDate.getDate() + 1);

      onSelectionComplete(drag.siteId, arrivalDate, departureDate);
    }
    clearDrag();
  }, [days, onSelectionComplete, clearDrag]);

  useEffect(() => {
    const handlePointerUp = () => {
      if (dragRef.current.isDragging) {
        finishDrag();
      }
    };

    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [finishDrag]);

  const handleCellPointerDown = useCallback((siteId: string, dayIdx: number, e: React.PointerEvent) => {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    if (target.setPointerCapture) {
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        // ignore capture errors
      }
    }
    setDrag({ siteId, startIdx: dayIdx, endIdx: dayIdx, isDragging: true, pointerId: e.pointerId });
  }, [setDrag]);

  const handleGridPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.isDragging) return;
    const target = resolveDragTarget(e.clientX, e.clientY);
    if (!target) return;
    updateDragEnd(target.dayIdx);
  }, [resolveDragTarget, updateDragEnd]);

  const activeSelection = useMemo<ActiveSelection | null>(() => {
    if (!dragState.isDragging || !dragState.siteId || dragState.startIdx === null || dragState.endIdx === null) return null;
    return { siteId: dragState.siteId, startIdx: dragState.startIdx, endIdx: dragState.endIdx };
  }, [dragState]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((row) => (
          <div key={row} className="h-16 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (!sites.length) {
    return (
      <Card className="p-6 border-dashed border-border text-center text-muted-foreground">
        No sites match the current filters.
      </Card>
    );
  }

  const gridTemplate = `${SITE_COL_WIDTH}px repeat(${dayCount}, minmax(${DAY_MIN_WIDTH}px, 1fr))`;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <div
          className="grid text-xs font-medium text-muted-foreground border-b border-border bg-muted/50"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          <div className="px-4 py-3 sticky left-0 z-20 bg-muted/40 border-r border-border">
            Sites
          </div>
          {days.map((d, idx) => (
            <div
              key={idx}
              className={cn(
                "px-2 py-3 text-center border-r border-border/60 last:border-r-0",
                d.isToday && "bg-emerald-50 text-emerald-700"
              )}
            >
              <div>{d.label}</div>
            </div>
          ))}
        </div>

        <div
          ref={gridRef}
          className="divide-y divide-border/60"
          onPointerMove={handleGridPointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
        >
          {sites.map((site, idx) => (
            <CalendarRow
              key={site.id}
              site={site}
              days={days}
              dayCount={dayCount}
              reservations={reservationsBySite[site.id] || []}
              gridTemplate={gridTemplate}
              zebra={idx % 2 === 0 ? "bg-card" : "bg-muted/30"}
              activeSelection={activeSelection}
              draftSelection={selectionDraft}
              onCellPointerDown={handleCellPointerDown}
              onReservationClick={onReservationClick}
              densityConfig={densityConfig}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface CalendarRowProps {
  site: CalendarSite;
  days: DayMeta[];
  dayCount: number;
  reservations: CalendarReservation[];
  gridTemplate: string;
  zebra: string;
  activeSelection: ActiveSelection | null;
  draftSelection: QuotePreview | null;
  onCellPointerDown: (siteId: string, dayIdx: number, e: React.PointerEvent) => void;
  onReservationClick: (id: string) => void;
  densityConfig: typeof DENSITY_CONFIG[DensityMode];
}

function CalendarRow({
  site,
  days,
  dayCount,
  reservations,
  gridTemplate,
  zebra,
  activeSelection,
  draftSelection,
  onCellPointerDown,
  onReservationClick,
  densityConfig
}: CalendarRowProps) {
  const active = activeSelection && activeSelection.siteId === site.id ? activeSelection : null;
  const typeKey = (site.siteType || "").toLowerCase();
  const typeMeta = SITE_TYPE_STYLES[typeKey] || SITE_TYPE_STYLES.default;

  const activeStart = active ? Math.min(active.startIdx, active.endIdx) : null;
  const activeEnd = active ? Math.max(active.startIdx, active.endIdx) : null;
  const activeSpan = activeStart !== null && activeEnd !== null ? activeEnd - activeStart + 1 : 0;
  const activeLabel = activeSpan === 1 ? "night" : "nights";

  // Calculate chip height based on density
  const chipHeightClass = densityConfig.rowHeight === 40 ? "h-7" : densityConfig.rowHeight === 88 ? "h-[68px]" : "h-12";
  const selectionHeightClass = densityConfig.rowHeight === 40 ? "h-6" : densityConfig.rowHeight === 88 ? "h-16" : "h-12";

  return (
    <div
      className="grid relative group"
      style={{ gridTemplateColumns: gridTemplate }}
      data-site-id={site.id}
    >
      <div className={cn("px-4 sticky left-0 z-10 border-r border-l-4 border-border", zebra, typeMeta.border, densityConfig.padding)}>
        <div className={cn("font-bold text-foreground truncate", densityConfig.rowHeight === 40 ? "text-xs" : "text-sm")} title={site.name}>{site.name}</div>
        {densityConfig.showDetails && (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider">
            <span className={cn("px-2 py-0.5 rounded-full font-bold", typeMeta.badge)}>{typeMeta.label}</span>
            {site.siteNumber && <span className="text-muted-foreground/70">#{site.siteNumber}</span>}
          </div>
        )}
      </div>

      <div className="relative" style={{ gridColumn: "2 / -1" }}>
        <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${dayCount}, minmax(${DAY_MIN_WIDTH}px, 1fr))` }}>
          {days.map((d, i) => (
            <div
              key={i}
              data-day-idx={i}
              className={cn(
                "border-r border-border/60 cursor-crosshair transition-colors select-none touch-none",
                zebra,
                d.weekend && "bg-muted/50",
                d.isToday && "bg-emerald-50/50",
                "hover:bg-emerald-50/40"
              )}
              style={{ height: `${densityConfig.rowHeight}px` }}
              onPointerDown={(e) => onCellPointerDown(site.id, i, e)}
            />
          ))}
        </div>

        <div
          className="grid absolute inset-0 items-center pointer-events-none"
          style={{ gridTemplateColumns: `repeat(${dayCount}, minmax(${DAY_MIN_WIDTH}px, 1fr))` }}
        >
          {active && activeStart !== null && activeEnd !== null && (
            <div
              className={cn("my-1 mx-1 rounded-xl bg-emerald-500/25 border border-emerald-500/70 shadow-[0_0_20px_rgba(16,185,129,0.25)] flex items-center justify-center z-20", selectionHeightClass)}
              style={{ gridColumn: `${activeStart + 1} / span ${activeSpan}` }}
            >
              <div className={cn("px-3 py-1 rounded-full bg-emerald-600 text-white font-black uppercase tracking-widest flex items-center gap-2", densityConfig.fontSize)}>
                {densityConfig.showDetails && <span className="opacity-80">{site.name}</span>}
                <span>{activeSpan} {activeLabel}</span>
              </div>
            </div>
          )}

          {draftSelection && draftSelection.siteId === site.id && (() => {
            const start = days[0].date;
            const resStart = parseLocalDateInput(draftSelection.arrival);
            const resEnd = parseLocalDateInput(draftSelection.departure);
            const startIdx = Math.max(0, diffInDays(resStart, start));
            const endIdx = Math.min(dayCount, diffInDays(resEnd, start));
            if (endIdx <= 0 || startIdx >= dayCount) return null;
            const span = Math.max(1, endIdx - startIdx);
            return (
              <div
                key="draft-selection"
                className={cn("mx-1 rounded-lg bg-purple-500/10 border-2 border-purple-500 border-dashed flex items-center justify-center z-10", selectionHeightClass)}
                style={{ gridColumn: `${startIdx + 1} / span ${span}` }}
              >
                <span className={cn("font-bold text-purple-700 bg-card/90 px-2 py-0.5 rounded", densityConfig.fontSize)}>
                  Draft
                </span>
              </div>
            );
          })()}

          {reservations.map((res) => {
            const start = days[0].date;
            const resStart = toLocalDate(res.arrivalDate);
            const resEnd = toLocalDate(res.departureDate);
            const startIdx = Math.max(0, diffInDays(resStart, start));
            const endIdx = Math.min(dayCount, diffInDays(resEnd, start));
            if (endIdx <= 0 || startIdx >= dayCount) return null;
            const span = Math.max(1, endIdx - startIdx);

            return (
              <div
                key={res.id}
                className="relative h-full w-full pointer-events-auto z-10"
                style={{ gridColumn: `${startIdx + 1} / span ${span}` }}
              >
                <ReservationChip
                  reservation={res}
                  onClick={() => onReservationClick(res.id)}
                  densityConfig={densityConfig}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface ReservationChipProps {
  reservation: CalendarReservation;
  onClick: () => void;
  densityConfig: typeof DENSITY_CONFIG[DensityMode];
}

function ReservationChip({ reservation, onClick, densityConfig }: ReservationChipProps) {
  const statusStyles: Record<string, string> = {
    confirmed: "bg-status-success/90 border-status-success/40",
    checked_in: "bg-status-info/90 border-status-info/40",
    pending: "bg-status-warning/90 border-status-warning/40",
    cancelled: "bg-status-error/90 border-status-error/40"
  };

  const guestName = `${reservation.guest?.primaryFirstName || ""} ${reservation.guest?.primaryLastName || ""}`.trim() || "Guest";
  const status = reservation.status || "pending";
  const statusClass = statusStyles[status] || statusStyles.pending;

  // Compact mode uses smaller margins and simpler layout
  const isCompact = densityConfig.rowHeight === 40;
  const isExpanded = densityConfig.rowHeight === 88;

  return (
    <div
      className={cn(
        "absolute rounded-lg text-white flex items-center overflow-hidden border shadow-sm cursor-pointer transition-transform",
        "hover:scale-[1.01] active:scale-[0.98]",
        statusClass,
        isCompact ? "top-1 bottom-1 left-1 right-1 px-2" : "top-1.5 bottom-1.5 left-1.5 right-1.5 px-2.5",
        densityConfig.fontSize
      )}
      title={`${guestName} - ${reservation.status}`}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 min-w-0 w-full">
        <div className={cn("flex min-w-0", isExpanded ? "flex-col gap-0.5" : isCompact ? "flex-row items-center" : "flex-col")}>
          <span className="font-bold truncate tracking-tight">{guestName}</span>
          {densityConfig.showDetails && (
            <span className={cn("opacity-80 truncate uppercase tracking-wider", isCompact ? "hidden" : "block", isExpanded ? "text-[10px]" : "text-[9px]")}>
              {status.replace("_", " ")}
            </span>
          )}
          {isExpanded && reservation.guest?.phone && (
            <span className="text-[9px] opacity-70 truncate">{reservation.guest.phone}</span>
          )}
        </div>
        {reservation.siteLocked && (
          <span className="ml-auto inline-flex items-center text-white/90">
            <Lock className={isCompact ? "h-2.5 w-2.5" : "h-3 w-3"} aria-label="Site locked" />
          </span>
        )}
      </div>
    </div>
  );
}
