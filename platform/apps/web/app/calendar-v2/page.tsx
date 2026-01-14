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
  Building2,
  Sparkles,
  Search,
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
import { formatLocalDateInput, parseLocalDateInput, toLocalDate } from "../calendar/utils";
import type { CalendarBlackout } from "../calendar/types";

import {
  CalendarGrid,
  StatusFilterChips,
  StatCard,
  type DensityMode,
  DENSITY_CONFIG,
} from "./components";

const DAY_RANGES = [7, 14, 21, 30];

const DENSITY_ICONS: Record<DensityMode, typeof LayoutList> = {
  compact: LayoutList,
  standard: AlignJustify,
  expanded: Rows3,
};

const DENSITY_LABELS: Record<DensityMode, string> = {
  compact: "Compact",
  standard: "Standard",
  expanded: "Expanded",
};

const DENSITY_MODES: DensityMode[] = ["compact", "standard", "expanded"];

export default function CalendarPage() {
  const router = useRouter();
  const data = useCalendarData();
  const { state, actions, queries, derived } = data;

  const sites = queries.sites.data ?? [];
  const guests = queries.guests.data ?? [];
  const reservations = derived.filteredReservations;

  const typeFilteredSites = useMemo(() => {
    if (state.siteTypeFilter === "all") return sites;
    return sites.filter((site) => site.siteType === state.siteTypeFilter);
  }, [sites, state.siteTypeFilter]);

  const searchFilteredSiteIds = useMemo(
    () => new Set(reservations.map((res) => res.siteId)),
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

  // Get blackouts and group by site
  const blackouts = queries.blackouts.data ?? [];
  const blackoutsBySite = useMemo(() => {
    const grouped: Record<string, CalendarBlackout[]> = {};
    for (const blackout of blackouts) {
      if (!blackout.siteId) continue;
      if (!grouped[blackout.siteId]) {
        grouped[blackout.siteId] = [];
      }
      grouped[blackout.siteId].push(blackout);
    }
    return grouped;
  }, [blackouts]);

  const guestSearchStats = useMemo((): { count: number; samples: string[] } => {
    const search = state.guestSearch.trim().toLowerCase();
    if (!search) {
      return { count: 0, samples: [] };
    }
    let count = 0;
    const samples: string[] = [];
    for (const guest of guests) {
      const first = (guest.primaryFirstName ?? "").toLowerCase();
      const last = (guest.primaryLastName ?? "").toLowerCase();
      const email = (guest.email ?? "").toLowerCase();
      const phone = (guest.phone ?? "").toLowerCase();
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
  const selectedReservation = useMemo(() => {
    if (!state.selectedReservationId) return null;
    const allReservations = queries.reservations.data ?? [];
    return allReservations.find((reservation) => reservation.id === state.selectedReservationId) ?? null;
  }, [state.selectedReservationId, queries.reservations.data]);

  // Count reservations by status for filter chips - stable reference
  const reservationCountsByStatus = useMemo(() => {
    const allRes = queries.reservations.data ?? [];
    const counts: Record<string, number> = {
      confirmed: 0,
      checked_in: 0,
      pending: 0,
      cancelled: 0,
      checked_out: 0
    };
    for (const res of allRes) {
      const status = res.status ?? "pending";
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
  const campgrounds = queries.campgrounds.data ?? [];
  const selectedCampgroundDetails = derived.selectedCampgroundDetails;

  useEffect(() => {
    setTodayKey(formatLocalDateInput(new Date()));
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target;
      if (target instanceof HTMLElement) {
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
          if (e.key === "Escape" && target instanceof HTMLInputElement) {
            target.blur();
            return;
          }
          return;
        }
      }

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

      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        actions.setStartDate(formatLocalDateInput(new Date()));
        return;
      }

      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        router.push("/booking");
        return;
      }

      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        queries.sites.refetch();
        queries.reservations.refetch();
        return;
      }

      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        actions.setSelectedReservationId(null);
        setShowShortcuts(false);
        return;
      }

      if (e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const idx = parseInt(e.key, 10) - 1;
        const dayRanges = [7, 14, 21, 30];
        if (idx < dayRanges.length) {
          actions.setDayCount(dayRanges[idx]);
        }
        return;
      }

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

  const handleClearFilters = useCallback(() => {
    actions.setGuestSearch("");
    actions.setStatusFilter("all");
    actions.setSiteTypeFilter("all");
    actions.setArrivalsNowOnly(false);
  }, [actions]);

  const handleCloseReservationDialog = useCallback((open: boolean) => {
    if (!open) {
      actions.setSelectedReservationId(null);
    }
  }, [actions]);

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
          eyebrow="Reservations"
          title={(
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground">
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
                    aria-pressed={state.dayCount === range}
                  >
                    {range}d
                  </Button>
                ))}
              </div>

              <div className="flex items-center bg-card rounded-xl border border-border p-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  onClick={handlePrev}
                  aria-label="Previous date range"
                >
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  onClick={handleNext}
                  aria-label="Next date range"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground">
                <CalendarCheck className="h-4 w-4 text-status-success" />
                <span>{rangeLabel}</span>
              </div>

              {/* Density Toggle */}
              <div className="flex items-center bg-card rounded-xl border border-border p-1">
                {DENSITY_MODES.map((mode) => {
                  const Icon = DENSITY_ICONS[mode];
                  const label = DENSITY_LABELS[mode];
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
                      title={`${label} view`}
                      aria-pressed={density === mode}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-[11px] font-semibold hidden sm:inline">
                        {label}
                      </span>
                    </Button>
                  );
                })}
              </div>

              {/* Inline Campground Selector */}
              {campgrounds.length > 0 ? (
                <div className="flex items-center bg-card rounded-xl border border-border">
                  <div className="flex items-center gap-2 pl-3 pr-1">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Select
                    value={state.selectedCampground ?? ""}
                    onValueChange={(value) => actions.setSelectedCampground(value)}
                  >
                    <SelectTrigger className="h-9 min-w-[160px] border-0 shadow-none focus:ring-0 text-sm font-semibold">
                      <SelectValue placeholder="Select campground">
                        {selectedCampgroundDetails?.name ?? "Select campground"}
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
              ) : null}
            </div>
          )}
        />

        <Card className="border-border shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Filters
              </span>
              {hasFilters ? (
                <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {activeFilterCount} on
                </span>
              ) : null}
            </div>
            {hasFilters ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2.5 text-[11px]"
                onClick={handleClearFilters}
              >
                Clear filters
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <div className="relative flex-1 min-w-[220px]">
              <Label className="sr-only">Search guests</Label>
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
              <Input
                ref={searchInputRef}
                className="h-9 pl-9 text-sm"
                placeholder="Search guests (press /)"
                value={state.guestSearch}
                onChange={(e) => actions.setGuestSearch(e.target.value)}
              />
            </div>

            <div className="min-w-[150px]">
              <Label className="sr-only">Status</Label>
              <Select value={state.statusFilter} onValueChange={actions.setStatusFilter}>
                <SelectTrigger className="h-9 text-sm">
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

            <div className="min-w-[150px]">
              <Label className="sr-only">Site type</Label>
              <Select value={state.siteTypeFilter} onValueChange={actions.setSiteTypeFilter}>
                <SelectTrigger className="h-9 text-sm">
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

            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground">
              <Switch checked={state.arrivalsNowOnly} onCheckedChange={actions.setArrivalsNowOnly} />
              <span>Arrivals today</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-muted-foreground ml-auto">
              {state.guestSearch ? (
                <span>
                  {queries.guests.isLoading
                    ? "Searching guests…"
                    : guestSearchStats.count > 0
                      ? `Matches ${guestSearchStats.count} guests`
                      : "No guests found"}
                </span>
              ) : null}
              <span>
                {state.guestSearch || state.statusFilter !== "all" || state.siteTypeFilter !== "all" || state.arrivalsNowOnly
                  ? `${visibleReservations.length} stays match filters`
                  : `${visibleReservations.length} stays in view`}
              </span>
            </div>
          </div>
        </Card>

        {!state.selectedCampground ? (
          <Card className="p-6 border-dashed border-border text-center text-muted-foreground">
            Choose a campground from the global selector to load the booking grid.
          </Card>
        ) : (
          <div className="space-y-4">
            {bookingDraft ? (
              <Card className="p-4 border-primary/20 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-primary">Draft booking</div>
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

            <Card className="border-border shadow-sm">
              <div className="flex flex-wrap items-center gap-3 border-b border-border/70 px-4 py-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Status
                </span>
                <StatusFilterChips
                  activeFilter={state.statusFilter}
                  onFilterChange={actions.setStatusFilter}
                  reservationCounts={reservationCountsByStatus}
                  className="flex-1"
                />
              </div>
            </Card>

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
                blackoutsBySite={blackoutsBySite}
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
      <Dialog open={!!selectedReservation} onOpenChange={handleCloseReservationDialog}>
        <DialogContent className="sm:max-w-md">
          {selectedReservation ? (
            <ReservationDetailContent
              reservation={selectedReservation}
              selectedCampground={state.selectedCampground}
              onClose={() => actions.setSelectedReservationId(null)}
              router={router}
            />
          ) : null}
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

// Extracted to avoid inline function in JSX
function ReservationDetailContent({
  reservation,
  selectedCampground,
  onClose,
  router
}: {
  reservation: NonNullable<ReturnType<typeof useCalendarData>["queries"]["reservations"]["data"]>[number];
  selectedCampground: string | null;
  onClose: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  const guestName = `${reservation.guest?.primaryFirstName ?? ""} ${reservation.guest?.primaryLastName ?? ""}`.trim() || "Guest";
  const nights = Math.ceil((new Date(reservation.departureDate).getTime() - new Date(reservation.arrivalDate).getTime()) / (1000 * 60 * 60 * 24));
  const total = reservation.totalAmount ?? 0;
  const paid = reservation.paidAmount ?? 0;
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

  const status = reservation.status ?? "pending";

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground/70" />
            <span>{guestName}</span>
          </div>
          <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium", statusColors[status] ?? statusColors.pending)}>
            {statusIcons[status] ?? statusIcons.pending}
            <span className="capitalize">{status.replace(/_/g, " ")}</span>
          </div>
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4 py-4">
        {/* Site & Dates */}
        <div className="flex items-start gap-3">
          <Tent className="h-4 w-4 text-muted-foreground/70 mt-0.5" />
          <div className="flex-1">
            <div className="font-medium text-foreground">
              {reservation.site?.name ?? reservation.site?.siteNumber ?? "Unassigned"}
            </div>
            <div className="text-sm text-muted-foreground">
              {format(new Date(reservation.arrivalDate), "MMM d")} → {format(new Date(reservation.departureDate), "MMM d, yyyy")} • {nights} night{nights !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        {/* Contact Info */}
        {(reservation.guest?.email || reservation.guest?.phone) ? (
          <div className="space-y-2">
            {reservation.guest?.email ? (
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground/70" />
                <span className="text-muted-foreground">{reservation.guest.email}</span>
              </div>
            ) : null}
            {reservation.guest?.phone ? (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground/70" />
                <span className="text-muted-foreground">{reservation.guest.phone}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Payment Summary */}
        <div className="flex items-start gap-3">
          <CreditCard className="h-4 w-4 text-muted-foreground/70 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">${(total / 100).toFixed(2)}</span>
              {balance > 0 ? (
                <span className="text-xs font-medium text-status-warning">${(balance / 100).toFixed(2)} due</span>
              ) : paid > 0 ? (
                <span className="text-xs font-medium text-status-success">Paid in full</span>
              ) : null}
            </div>
            {paid > 0 && paid < total ? (
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-status-success rounded-full"
                  style={{ width: `${Math.min(100, (paid / total) * 100)}%` }}
                />
              </div>
            ) : null}
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
            router.push(`/reservations/${reservation.id}`);
            onClose();
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
            router.push(`/campgrounds/${selectedCampground}/reservations/${reservation.id}`);
            onClose();
          }}
        >
          <Pencil className="h-4 w-4 mr-1.5" />
          Edit
        </Button>
        {status === "confirmed" ? (
          <Button
            size="sm"
            className="flex-1 bg-action-primary text-action-primary-foreground hover:bg-action-primary-hover"
            onClick={() => {
              router.push(`/check-in-out?reservationId=${reservation.id}`);
              onClose();
            }}
          >
            <LogIn className="h-4 w-4 mr-1.5" />
            Check In
          </Button>
        ) : null}
        {status === "checked_in" ? (
          <Button
            size="sm"
            className="flex-1"
            onClick={() => {
              router.push(`/check-in-out?reservationId=${reservation.id}`);
              onClose();
            }}
          >
            <LogOut className="h-4 w-4 mr-1.5" />
            Check Out
          </Button>
        ) : null}
        {balance > 0 ? (
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => {
              router.push(`/reservations/${reservation.id}?action=payment`);
              onClose();
            }}
          >
            <DollarSign className="h-4 w-4 mr-1.5" />
            Collect Payment
          </Button>
        ) : null}
      </div>
    </>
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
