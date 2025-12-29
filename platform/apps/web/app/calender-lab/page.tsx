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
  DollarSign
} from "lucide-react";

import { DashboardShell } from "../../components/ui/layout/DashboardShell";
import { Breadcrumbs } from "../../components/breadcrumbs";
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
  rv: { label: "RV", badge: "bg-emerald-100 text-emerald-700", border: "border-l-emerald-400" },
  tent: { label: "Tent", badge: "bg-amber-100 text-amber-800", border: "border-l-amber-400" },
  cabin: { label: "Cabin", badge: "bg-rose-100 text-rose-700", border: "border-l-rose-400" },
  group: { label: "Group", badge: "bg-indigo-100 text-indigo-700", border: "border-l-indigo-400" },
  glamping: { label: "Glamp", badge: "bg-cyan-100 text-cyan-700", border: "border-l-cyan-400" },
  default: { label: "Site", badge: "bg-slate-100 text-slate-600", border: "border-l-slate-300" }
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

export default function CalendarLabPage() {
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

  const rangeLabel = useMemo(() => {
    const start = parseLocalDateInput(state.startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + state.dayCount - 1);
    return `${format(start, "MMM d")} - ${format(end, "MMM d")}`;
  }, [state.startDate, state.dayCount]);

  const [todayKey, setTodayKey] = useState("");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
    <DashboardShell>
      <div className="px-6 py-6 w-full max-w-none space-y-6">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Calendar", href: "/calendar" }
          ]}
        />

        <div className="flex flex-col gap-4">
          <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-blue-600/10 text-blue-700 flex items-center justify-center">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-3xl font-black tracking-tight text-slate-900">Booking Calendar</h1>
                  </div>
                  <p className="text-sm text-slate-500 font-medium">
                    Drag across dates to build a stay. Release to preview pricing and availability.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center bg-white rounded-xl border border-slate-200 shadow-sm p-1">
                {DAY_RANGES.map((range) => (
                  <Button
                    key={range}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 px-3 text-[10px] font-black uppercase tracking-wider",
                      state.dayCount === range ? "bg-slate-100 text-blue-700" : "text-slate-500"
                    )}
                    onClick={() => actions.setDayCount(range)}
                  >
                    {range}d
                  </Button>
                ))}
              </div>

              <div className="flex items-center bg-white rounded-xl border border-slate-200 shadow-sm p-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600" onClick={handlePrev}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 text-xs font-black uppercase tracking-wider"
                  onClick={() => actions.setStartDate(formatLocalDateInput(new Date()))}
                >
                  Today
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600" onClick={handleNext}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600">
                <CalendarCheck className="h-4 w-4 text-blue-600" />
                <span>{rangeLabel}</span>
              </div>
            </div>
          </div>

          <Card className="p-4 border-slate-200 shadow-sm">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Search guests</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    ref={searchInputRef}
                    className="h-10 pl-9"
                    placeholder="Name, phone, email... (Press / to search)"
                    value={state.guestSearch}
                    onChange={(e) => actions.setGuestSearch(e.target.value)}
                  />
                </div>
                {state.guestSearch && (
                  <div className="text-[11px] text-slate-500">
                    {queries.guests.isLoading
                      ? "Searching guests..."
                      : guestSearchStats.count > 0
                        ? `Matches ${guestSearchStats.count} guests`
                        : "No guests found"}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</Label>
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
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Site type</Label>
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
              <div className="flex items-center gap-3 text-xs font-semibold text-slate-600">
                <div className="flex items-center gap-2">
                  <Switch checked={state.arrivalsNowOnly} onCheckedChange={actions.setArrivalsNowOnly} />
                  <span>Arrivals today only</span>
                </div>
                {(state.guestSearch || state.statusFilter !== "all" || state.siteTypeFilter !== "all" || state.arrivalsNowOnly) && (
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
              <div className="text-xs text-slate-500 font-medium">
                {state.guestSearch || state.statusFilter !== "all" || state.siteTypeFilter !== "all" || state.arrivalsNowOnly
                  ? `${visibleReservations.length} stays match filters`
                  : `${visibleReservations.length} stays in view`}
              </div>
            </div>
          </Card>
        </div>

        {!state.selectedCampground && (
          <Card className="p-6 border-dashed border-slate-200 text-center text-slate-500">
            Choose a campground from the global selector to load the booking grid.
          </Card>
        )}

        {state.selectedCampground && (
          <div className="space-y-4">
            {bookingDraft ? (
              <Card className="p-4 border-blue-200 shadow-[0_20px_50px_-30px_rgba(37,99,235,0.35)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-blue-700">Draft booking</div>
                    <div className="text-sm font-semibold text-slate-900">{bookingDraft.siteName}</div>
                    <div className="text-xs text-slate-500">
                      {bookingDraft.arrival} → {bookingDraft.departure} · {bookingDraft.nights} nights
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-xl font-black text-slate-900">${(bookingDraft.total / 100).toFixed(2)}</div>
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
              <Card className="p-4 border-dashed border-slate-200 text-sm text-slate-500">
                Drag across dates to create a selection and see a booking draft here.
              </Card>
            )}

            <div className="grid gap-4 md:grid-cols-4">
              <StatCard label="Occupied tonight" value={`${occupiedToday}`} sub={`${availableToday} open sites`} icon={<Users className="h-4 w-4" />} />
              <StatCard label="Arrivals today" value={`${arrivalsToday}`} sub={`${departuresToday} departures`} icon={<CalendarCheck className="h-4 w-4" />} />
              <StatCard label="Maintenance" value={`${maintenanceCount}`} sub="Open tickets" icon={<Wrench className="h-4 w-4" />} />
              <StatCard label="Housekeeping" value={`${housekeepingCount}`} sub="Active tasks" icon={<Sparkles className="h-4 w-4" />} />
            </div>

            {visibleSiteTypes.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Site types</span>
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
              <Card className="p-6 border-dashed border-slate-200 text-center text-slate-500">
                No sites match that guest search in this view.
              </Card>
            ) : (
              <CalendarLabGrid
                days={derived.days}
                dayCount={state.dayCount}
                isLoading={queries.sites.isLoading || queries.reservations.isLoading}
                sites={visibleSites}
                reservationsBySite={derived.reservationsBySite}
                selectionDraft={bookingDraft}
                onSelectionComplete={actions.selectRange}
                onReservationClick={actions.setSelectedReservationId}
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
              confirmed: "bg-emerald-100 text-emerald-700 border-emerald-200",
              checked_in: "bg-blue-100 text-blue-700 border-blue-200",
              checked_out: "bg-slate-100 text-slate-700 border-slate-200",
              cancelled: "bg-rose-100 text-rose-700 border-rose-200",
              pending: "bg-amber-100 text-amber-700 border-amber-200"
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
                      <User className="h-5 w-5 text-slate-400" />
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
                    <Tent className="h-4 w-4 text-slate-400 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">
                        {res.site?.name || res.site?.siteNumber || "Unassigned"}
                      </div>
                      <div className="text-sm text-slate-500">
                        {format(new Date(res.arrivalDate), "MMM d")} → {format(new Date(res.departureDate), "MMM d, yyyy")} • {nights} night{nights !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>

                  {/* Contact Info */}
                  {(res.guest?.email || res.guest?.phone) && (
                    <div className="space-y-2">
                      {res.guest?.email && (
                        <div className="flex items-center gap-3 text-sm">
                          <Mail className="h-4 w-4 text-slate-400" />
                          <span className="text-slate-600">{res.guest.email}</span>
                        </div>
                      )}
                      {res.guest?.phone && (
                        <div className="flex items-center gap-3 text-sm">
                          <Phone className="h-4 w-4 text-slate-400" />
                          <span className="text-slate-600">{res.guest.phone}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Payment Summary */}
                  <div className="flex items-start gap-3">
                    <CreditCard className="h-4 w-4 text-slate-400 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-900">${(total / 100).toFixed(2)}</span>
                        {balance > 0 ? (
                          <span className="text-xs font-medium text-amber-600">${(balance / 100).toFixed(2)} due</span>
                        ) : paid > 0 ? (
                          <span className="text-xs font-medium text-emerald-600">Paid in full</span>
                        ) : null}
                      </div>
                      {paid > 0 && paid < total && (
                        <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
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
          <div className="text-xs text-slate-500 border-t pt-3">
            Press <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono">Esc</kbd> to close
          </div>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

function ShortcutItem({ keys, desc }: { keys: string[]; desc: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-slate-600">{desc}</span>
      <div className="flex gap-1">
        {keys.map((k) => (
          <kbd key={k} className="px-2 py-1 bg-slate-100 rounded text-xs font-mono text-slate-700 shadow-sm border border-slate-200">
            {k}
          </kbd>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon }: { label: string; value: string; sub: string; icon: React.ReactNode }) {
  return (
    <Card className="p-4 border-slate-200 shadow-sm flex items-center gap-3">
      <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</div>
        <div className="text-lg font-black text-slate-900">{value}</div>
        <div className="text-xs text-slate-500">{sub}</div>
      </div>
    </Card>
  );
}

interface CalendarLabGridProps {
  days: DayMeta[];
  dayCount: number;
  isLoading: boolean;
  sites: CalendarSite[];
  reservationsBySite: Record<string, CalendarReservation[]>;
  selectionDraft: QuotePreview | null;
  onSelectionComplete: (siteId: string, arrival: Date, departure: Date) => void;
  onReservationClick: (id: string) => void;
}

function CalendarLabGrid({
  days,
  dayCount,
  isLoading,
  sites,
  reservationsBySite,
  selectionDraft,
  onSelectionComplete,
  onReservationClick
}: CalendarLabGridProps) {
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
          <div key={row} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!sites.length) {
    return (
      <Card className="p-6 border-dashed border-slate-200 text-center text-slate-500">
        No sites match the current filters.
      </Card>
    );
  }

  const gridTemplate = `${SITE_COL_WIDTH}px repeat(${dayCount}, minmax(${DAY_MIN_WIDTH}px, 1fr))`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <div
          className="grid text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 bg-slate-50/70"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          <div className="px-4 py-3 sticky left-0 z-20 bg-slate-50 border-r border-slate-200">
            Sites
          </div>
          {days.map((d, idx) => (
            <div
              key={idx}
              className={cn(
                "px-2 py-3 text-center border-r border-slate-100 last:border-r-0",
                d.isToday && "bg-blue-50 text-blue-700"
              )}
            >
              <div>{d.label}</div>
            </div>
          ))}
        </div>

        <div
          ref={gridRef}
          className="divide-y divide-slate-100"
          onPointerMove={handleGridPointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
        >
          {sites.map((site, idx) => (
            <CalendarLabRow
              key={site.id}
              site={site}
              days={days}
              dayCount={dayCount}
              reservations={reservationsBySite[site.id] || []}
              gridTemplate={gridTemplate}
              zebra={idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}
              activeSelection={activeSelection}
              draftSelection={selectionDraft}
              onCellPointerDown={handleCellPointerDown}
              onReservationClick={onReservationClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface CalendarLabRowProps {
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
}

function CalendarLabRow({
  site,
  days,
  dayCount,
  reservations,
  gridTemplate,
  zebra,
  activeSelection,
  draftSelection,
  onCellPointerDown,
  onReservationClick
}: CalendarLabRowProps) {
  const active = activeSelection && activeSelection.siteId === site.id ? activeSelection : null;
  const typeKey = (site.siteType || "").toLowerCase();
  const typeMeta = SITE_TYPE_STYLES[typeKey] || SITE_TYPE_STYLES.default;

  const activeStart = active ? Math.min(active.startIdx, active.endIdx) : null;
  const activeEnd = active ? Math.max(active.startIdx, active.endIdx) : null;
  const activeSpan = activeStart !== null && activeEnd !== null ? activeEnd - activeStart + 1 : 0;
  const activeLabel = activeSpan === 1 ? "night" : "nights";

  return (
    <div
      className="grid relative group"
      style={{ gridTemplateColumns: gridTemplate }}
      data-site-id={site.id}
    >
      <div className={cn("px-4 py-3 sticky left-0 z-10 border-r border-l-4 border-slate-200", zebra, typeMeta.border)}>
        <div className="text-sm font-bold text-slate-900 truncate" title={site.name}>{site.name}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider">
          <span className={cn("px-2 py-0.5 rounded-full font-bold", typeMeta.badge)}>{typeMeta.label}</span>
          {site.siteNumber && <span className="text-slate-400">#{site.siteNumber}</span>}
        </div>
      </div>

      <div className="relative" style={{ gridColumn: "2 / -1" }}>
        <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${dayCount}, minmax(${DAY_MIN_WIDTH}px, 1fr))` }}>
          {days.map((d, i) => (
            <div
              key={i}
              data-day-idx={i}
              className={cn(
                "border-r border-slate-100 h-16 cursor-crosshair transition-colors select-none touch-none",
                zebra,
                d.weekend && "bg-slate-50/60",
                d.isToday && "bg-blue-50/50",
                "hover:bg-blue-50/40"
              )}
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
              className="my-1 mx-1 h-12 rounded-xl bg-blue-500/25 border border-blue-500/70 shadow-[0_0_20px_rgba(59,130,246,0.25)] flex items-center justify-center z-20"
              style={{ gridColumn: `${activeStart + 1} / span ${activeSpan}` }}
            >
              <div className="px-3 py-1 rounded-full bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <span className="opacity-80">{site.name}</span>
                <span>{activeSpan} {activeLabel} selected</span>
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
                className="mx-1 rounded-lg bg-purple-500/10 border-2 border-purple-500 border-dashed h-12 flex items-center justify-center z-10"
                style={{ gridColumn: `${startIdx + 1} / span ${span}` }}
              >
                <span className="text-[10px] font-bold text-purple-700 bg-white/90 px-2 py-0.5 rounded">
                  Draft selected
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
                <ReservationChip reservation={res} onClick={() => onReservationClick(res.id)} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ReservationChip({ reservation, onClick }: { reservation: CalendarReservation; onClick: () => void }) {
  const statusStyles: Record<string, string> = {
    confirmed: "bg-gradient-to-br from-emerald-500/90 to-emerald-600/95 border-emerald-400/40",
    checked_in: "bg-gradient-to-br from-blue-500/90 to-blue-600/95 border-blue-400/40",
    pending: "bg-gradient-to-br from-amber-400/90 to-amber-500/95 border-amber-400/40",
    cancelled: "bg-gradient-to-br from-rose-400/90 to-rose-500/95 border-rose-400/40"
  };

  const guestName = `${reservation.guest?.primaryFirstName || ""} ${reservation.guest?.primaryLastName || ""}`.trim() || "Guest";
  const status = reservation.status || "pending";
  const statusClass = statusStyles[status] || statusStyles.pending;

  return (
    <div
      className={cn(
        "absolute top-1.5 bottom-1.5 left-1.5 right-1.5 rounded-lg text-[11px] text-white flex items-center px-2.5 overflow-hidden border shadow-sm cursor-pointer transition-transform",
        "hover:scale-[1.01] active:scale-[0.98]",
        statusClass
      )}
      title={`${guestName} - ${reservation.status}`}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 min-w-0 w-full">
        <div className="flex flex-col min-w-0">
          <span className="font-bold truncate tracking-tight">{guestName}</span>
          <span className="text-[9px] opacity-80 truncate uppercase tracking-wider">{status.replace("_", " ")}</span>
        </div>
        {reservation.siteLocked && (
          <span className="ml-auto inline-flex items-center text-white/90">
            <Lock className="h-3 w-3" aria-label="Site locked" />
          </span>
        )}
      </div>
    </div>
  );
}
