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
  Wrench
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
import { cn } from "../../lib/utils";

import { useCalendarData } from "../calendar/useCalendarData";
import { diffInDays, formatLocalDateInput, parseLocalDateInput, toLocalDate } from "../calendar/utils";
import type { CalendarReservation, CalendarSite, DayMeta, QuotePreview } from "../calendar/types";

const DAY_RANGES = [7, 14, 21, 30];
const SITE_COL_WIDTH = 240;
const DAY_MIN_WIDTH = 104;

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

  const campgrounds = queries.campgrounds.data || [];
  const sites = queries.sites.data || [];
  const reservations = derived.filteredReservations;
  const visibleSites = useMemo(() => {
    if (state.siteTypeFilter === "all") return sites;
    return sites.filter((site) => site.siteType === state.siteTypeFilter);
  }, [sites, state.siteTypeFilter]);
  const visibleSiteIds = useMemo(() => new Set(visibleSites.map((site) => site.id)), [visibleSites]);
  const visibleReservations = useMemo(
    () => reservations.filter((res) => (res.siteId ? visibleSiteIds.has(res.siteId) : false)),
    [reservations, visibleSiteIds]
  );

  const rangeLabel = useMemo(() => {
    const start = parseLocalDateInput(state.startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + state.dayCount - 1);
    return `${format(start, "MMM d")} - ${format(end, "MMM d")}`;
  }, [state.startDate, state.dayCount]);

  const todayKey = useMemo(() => formatLocalDateInput(new Date()), []);
  const arrivalsToday = useMemo(
    () => visibleReservations.filter((res) => formatLocalDateInput(toLocalDate(res.arrivalDate)) === todayKey).length,
    [visibleReservations, todayKey]
  );
  const departuresToday = useMemo(
    () => visibleReservations.filter((res) => formatLocalDateInput(toLocalDate(res.departureDate)) === todayKey).length,
    [visibleReservations, todayKey]
  );
  const occupiedToday = useMemo(() => {
    const today = toLocalDate(new Date());
    return visibleReservations.filter((res) => {
      const arrival = toLocalDate(res.arrivalDate);
      const departure = toLocalDate(res.departureDate);
      return arrival <= today && departure > today;
    }).length;
  }, [visibleReservations]);
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

  const handleCampgroundChange = useCallback(
    (value: string) => {
      actions.setSelectedCampground(value);
      if (typeof window === "undefined") return;
      try {
        localStorage.setItem("campreserv:selectedCampground", value);
        const selected = campgrounds.find((cg) => cg.id === value);
        if (selected?.name) {
          localStorage.setItem("campreserv:selectedCampgroundName", selected.name);
        }
      } catch {
        // ignore storage errors
      }
    },
    [actions, campgrounds]
  );

  const bookingDraft = state.reservationDraft;
  const selectedCampground = derived.selectedCampgroundDetails;

  const handleBookNow = useCallback(() => {
    if (!bookingDraft) return;
    const slug = selectedCampground?.slug || "";
    const params = new URLSearchParams({
      siteId: bookingDraft.siteId,
      arrival: bookingDraft.arrival,
      departure: bookingDraft.departure
    });
    if (slug) {
      router.push(`/park/${slug}/book?${params.toString()}`);
    }
  }, [bookingDraft, router, selectedCampground]);

  return (
    <DashboardShell>
      <div className="px-6 py-6 max-w-[1680px] mx-auto space-y-6">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Calendar Lab", href: "/calender-lab" }
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
                    <Badge variant="secondary" className="uppercase text-[10px] tracking-widest">Lab</Badge>
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
            <div className="grid gap-4 md:grid-cols-[minmax(220px,320px)_1fr]">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Campground</Label>
                <Select value={state.selectedCampground} onValueChange={handleCampgroundChange}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder={queries.campgrounds.isLoading ? "Loading campgrounds..." : "Select campground"} />
                  </SelectTrigger>
                  <SelectContent>
                    {campgrounds.map((cg) => (
                      <SelectItem key={cg.id} value={cg.id}>{cg.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Search guests</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      className="h-10 pl-9"
                      placeholder="Name, phone, email..."
                      value={state.guestSearch}
                      onChange={(e) => actions.setGuestSearch(e.target.value)}
                    />
                  </div>
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
              <div className="text-xs text-slate-500 font-medium">{visibleReservations.length} stays in view</div>
            </div>
          </Card>
        </div>

        {!state.selectedCampground && (
          <Card className="p-6 border-dashed border-slate-200 text-center text-slate-500">
            Select a campground to load the booking grid.
          </Card>
        )}

        {state.selectedCampground && (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <StatCard label="Occupied tonight" value={`${occupiedToday}`} sub={`${availableToday} open sites`} icon={<Users className="h-4 w-4" />} />
                <StatCard label="Arrivals today" value={`${arrivalsToday}`} sub={`${departuresToday} departures`} icon={<CalendarCheck className="h-4 w-4" />} />
                <StatCard label="Maintenance" value={`${maintenanceCount}`} sub="Open tickets" icon={<Wrench className="h-4 w-4" />} />
                <StatCard label="Housekeeping" value={`${housekeepingCount}`} sub="Active tasks" icon={<Sparkles className="h-4 w-4" />} />
              </div>

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
            </div>

            <div className="space-y-4">
              <Card className="p-5 border-slate-200 shadow-sm">
                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Selected campground</div>
                  <div className="text-lg font-black text-slate-900">{selectedCampground?.name || "Campground"}</div>
                  <div className="text-xs text-slate-500">Manage availability, holds, and arrivals in one flow.</div>
                </div>
              </Card>

              {bookingDraft ? (
                <Card className="p-5 border-blue-200 shadow-[0_20px_50px_-30px_rgba(37,99,235,0.55)]">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold uppercase tracking-widest text-blue-700">Draft booking</div>
                    <Badge variant="secondary" className="text-[10px]">Ready</Badge>
                  </div>
                  <div className="mt-3 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-700">{bookingDraft.siteName}</div>
                      <div className="text-xs text-slate-500">{bookingDraft.arrival} to {bookingDraft.departure}</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-slate-500">{bookingDraft.nights} nights</div>
                      <div className="text-xl font-black text-slate-900">${(bookingDraft.total / 100).toFixed(2)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button className="flex-1 gap-2" onClick={handleBookNow}>
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
                <Card className="p-5 border-dashed border-slate-200 text-sm text-slate-500">
                  Drag across dates to create a selection and see a booking draft here.
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
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
      <div className={cn("px-4 py-3 sticky left-0 z-10 border-r border-slate-200", zebra)}>
        <div className="text-sm font-bold text-slate-900 truncate" title={site.name}>{site.name}</div>
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
          {site.siteType || "Site"} {site.siteNumber || ""}
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
            const resStart = parseLocalDateInput(res.arrivalDate);
            const resEnd = parseLocalDateInput(res.departureDate);
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
