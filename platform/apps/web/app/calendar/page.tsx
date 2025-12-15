"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "../../components/ui/layout/DashboardShell";
import { Breadcrumbs } from "../../components/breadcrumbs";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { apiClient } from "../../lib/api-client";
import { useGanttStore } from "../../lib/gantt-store";
import { recordMetric, recordError, startTiming } from "../../lib/calendar-metrics";
import { useWhoami } from "@/hooks/use-whoami";
import { CalendarRow } from "./CalendarRow";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { HelpAnchor } from "../../components/help/HelpAnchor";
import {
  CheckCircle,
  Clock,
  XCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Tent,
  Home,
  Caravan,
  RefreshCw,
  Wrench,
  Sparkles,
  AlertTriangle,
  Mail,
  CreditCard
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { computeDepositDue } from "@campreserv/shared";

type DayMeta = { date: Date; label: string; weekend: boolean; isToday: boolean };
type AsyncReturn<T extends (...args: any[]) => any> = Awaited<ReturnType<T>>;

const cellWidth = 110; // px per day for pill positioning fallback

function diffInDays(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function formatLocalDateInput(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseLocalDateInput(value: string) {
  const [y, m, d] = value.split("-").map((n) => parseInt(n, 10));
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return new Date();
  return new Date(y, m - 1, d);
}

function toLocalDate(value: string | Date) {
  if (value instanceof Date) {
    const d = new Date(value);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const str = typeof value === "string" ? value.slice(0, 10) : "";
  const parsed = parseLocalDateInput(str);
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export default function CalendarPage() {
  const [selectedCampground, setSelectedCampground] = useState<string>("");
  const [startDate, setStartDate] = useState(() => formatLocalDateInput(new Date()));
  const [viewMode, setViewMode] = useState<"day" | "week" | "month" | "list">("week");
  const [dayCount, setDayCount] = useState(14);
  const [dragSiteId, setDragSiteId] = useState<string | null>(null);
  const [dragStartIdx, setDragStartIdx] = useState<number | null>(null);
  const [dragEndIdx, setDragEndIdx] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [quotePreview, setQuotePreview] = useState<{
    siteId: string;
    siteName: string;
    arrival: string;
    departure: string;
    total: number;
    nights: number;
    base: number;
    perNight: number;
    rulesDelta: number;
    depositRule: string | null;
  } | null>(null);
  const [selection, setSelection] = useState<{ siteId: string; arrival: string; departure: string } | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [selectionConflict, setSelectionConflict] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [siteTypeFilter, setSiteTypeFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [assignmentFilter, setAssignmentFilter] = useState<"all" | "assigned" | "unassigned">("all");
  const [arrivalsNowOnly, setArrivalsNowOnly] = useState(false);
  const [conflictDrawerOpen, setConflictDrawerOpen] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState<any | null>(null);
  const [resolveAction, setResolveAction] = useState<"reassign" | "adjust" | "comp" | null>(null);
  const [resolveSiteId, setResolveSiteId] = useState<string>("");
  const [resolveArrival, setResolveArrival] = useState<string>("");
  const [resolveDeparture, setResolveDeparture] = useState<string>("");
  const [resolveNote, setResolveNote] = useState<string>("");
  const [quickActionRes, setQuickActionRes] = useState<string | null>(null);
  const [quickActionAnchor, setQuickActionAnchor] = useState<string | null>(null);
  const [quickActionLoading, setQuickActionLoading] = useState(false);
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  const quickActionsEnabled = !!quickActionRes && !!quickActionAnchor;
  const [showPopover, setShowPopover] = useState<string | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [holdStatus, setHoldStatus] = useState<{ state: "idle" | "loading" | "success" | "error"; message?: string }>({
    state: "idle"
  });
  const [extendPrompt, setExtendPrompt] = useState<{
    reservation: any;
    arrivalDate: string;
    departureDate: string;
    totalCents: number;
    deltaCents: number;
  } | null>(null);
  const [isExtendSubmitting, setIsExtendSubmitting] = useState(false);
  const [pendingMove, setPendingMove] = useState<{
    reservation: any;
    siteId: string;
    arrivalDate: string;
    departureDate: string;
    deltaCents: number;
    quoteTotalCents: number;
    currentTotalCents: number;
  } | null>(null);
  const [isMoveSubmitting, setIsMoveSubmitting] = useState(false);

  // Split booking state
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [splitReservation, setSplitReservation] = useState<any>(null);
  const [splitSegments, setSplitSegments] = useState<Array<{ siteId: string; startDate: string; endDate: string }>>([]);
  const [splitLoading, setSplitLoading] = useState(false);

  const loadTimers = useRef<Record<string, number | null>>({
    campgrounds: null,
    sites: null,
    reservations: null,
    blackouts: null
  });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const selectionActive = isDragging && dragSiteId !== null && dragStartIdx !== null && dragEndIdx !== null;
  const [clickStart, setClickStart] = useState<{ siteId: string; idx: number } | null>(null);
  const [jumpDate, setJumpDate] = useState<string>("");
  const [showConflictsOnly, setShowConflictsOnly] = useState(false);
  const [commsByRes, setCommsByRes] = useState<Record<string, any[]>>({});
  const [commsLoading, setCommsLoading] = useState<Record<string, boolean>>({});
  const [commsErrors, setCommsErrors] = useState<Record<string, string>>({});
  const [commsFilter, setCommsFilter] = useState<"all" | "messages" | "notes" | "failed">("all");
  const calendarFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (siteTypeFilter !== "all" ? 1 : 0) +
    (channelFilter !== "all" ? 1 : 0) +
    (assignmentFilter !== "all" ? 1 : 0) +
    (arrivalsNowOnly ? 1 : 0);
  const queryClient = useQueryClient();
  const { selection: ganttSelection, setSelection: setStoreSelection } = useGanttStore();
  const { data: whoami } = useWhoami();
  const memberships = whoami?.user?.memberships ?? [];
  const hasCampgroundAccess = selectedCampground
    ? memberships.some((m) => m.campgroundId === selectedCampground)
    : memberships.length > 0;
  const allowOps = (whoami?.allowed?.operationsWrite ?? false) && hasCampgroundAccess;
  const opsEnabled = allowOps && !!selectedCampground;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("campreserv:selectedCampground");
    if (stored) setSelectedCampground(stored);
  }, []);

  const campgroundsQuery = useQuery<AsyncReturn<typeof apiClient.getCampgrounds>>({
    queryKey: ["campgrounds"],
    queryFn: () => {
      loadTimers.current.campgrounds = typeof performance !== "undefined" ? performance.now() : Date.now();
      return apiClient.getCampgrounds();
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false
  });

  useEffect(() => {
    if (!selectedCampground && !localStorage.getItem("campreserv:selectedCampground") && campgroundsQuery.data?.length === 1) {
      const only = campgroundsQuery.data[0]?.id;
      if (only) {
        setSelectedCampground(only);
        localStorage.setItem("campreserv:selectedCampground", only);
      }
    }
  }, [selectedCampground, campgroundsQuery.data]);

  const selectedCampgroundDetails = useMemo(
    () => campgroundsQuery.data?.find((cg) => cg.id === selectedCampground) ?? null,
    [campgroundsQuery.data, selectedCampground]
  );

  const quoteDepositDue = useMemo(() => {
    if (!quotePreview || !selectedCampgroundDetails) return null;
    return computeDepositDue({
      total: quotePreview.total,
      nights: quotePreview.nights,
      arrivalDate: quotePreview.arrival,
      depositRule: selectedCampgroundDetails.depositRule,
      depositPercentage: selectedCampgroundDetails.depositPercentage ?? null,
      depositConfig: (selectedCampgroundDetails as any)?.depositConfig ?? null
    });
  }, [quotePreview, selectedCampgroundDetails]);

  const sitesQuery = useQuery<AsyncReturn<typeof apiClient.getSites>>({
    queryKey: ["calendar-sites", selectedCampground],
    queryFn: () => {
      loadTimers.current.sites = typeof performance !== "undefined" ? performance.now() : Date.now();
      return apiClient.getSites(selectedCampground);
    },
    enabled: !!selectedCampground,
    staleTime: 15_000,
    refetchInterval: 60_000
  });

  const reservationsQuery = useQuery<AsyncReturn<typeof apiClient.getReservations>>({
    queryKey: ["calendar-reservations", selectedCampground],
    queryFn: () => {
      loadTimers.current.reservations = typeof performance !== "undefined" ? performance.now() : Date.now();
      return apiClient.getReservations(selectedCampground);
    },
    enabled: !!selectedCampground,
    staleTime: 15_000,
    refetchInterval: 60_000
  });

  const blackoutsQuery = useQuery<AsyncReturn<typeof apiClient.getBlackouts>>({
    queryKey: ["calendar-blackouts", selectedCampground],
    queryFn: () => {
      loadTimers.current.blackouts = typeof performance !== "undefined" ? performance.now() : Date.now();
      return apiClient.getBlackouts(selectedCampground);
    },
    enabled: !!selectedCampground,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000
  });

  const maintenanceQuery = useQuery<AsyncReturn<typeof apiClient.getMaintenanceTickets>>({
    queryKey: ["calendar-maintenance", selectedCampground],
    queryFn: () => apiClient.getMaintenanceTickets("open", selectedCampground),
    enabled: !!selectedCampground,
    staleTime: 60_000,
    refetchInterval: 60_000
  });

  const housekeepingTasksQuery = useQuery<AsyncReturn<typeof apiClient.listTasks>>({
    queryKey: ["calendar-housekeeping", selectedCampground, allowOps],
    queryFn: () => apiClient.listTasks(selectedCampground, { type: "housekeeping" }),
    enabled: opsEnabled,
    staleTime: 30_000,
    refetchInterval: opsEnabled ? 30_000 : false
  });

  const housekeepingTasks = allowOps ? housekeepingTasksQuery.data || [] : [];

  // Sync dayCount to view mode presets
  useEffect(() => {
    if (viewMode === "day") {
      setDayCount(1);
    } else if (viewMode === "week") {
      setDayCount(7);
    } else if (viewMode === "month" || viewMode === "list") {
      setDayCount(30);
    }
  }, [viewMode]);

  // Load saved filters/view
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("campreserv:calendar:viewstate");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.statusFilter) setStatusFilter(parsed.statusFilter);
        if (parsed.siteTypeFilter) setSiteTypeFilter(parsed.siteTypeFilter);
        if (parsed.channelFilter) setChannelFilter(parsed.channelFilter);
        if (parsed.assignmentFilter) setAssignmentFilter(parsed.assignmentFilter);
        if (parsed.arrivalsNowOnly) setArrivalsNowOnly(parsed.arrivalsNowOnly);
        if (parsed.viewMode) setViewMode(parsed.viewMode);
      }
    } catch {
      // ignore
    } finally {
      setFiltersLoaded(true);
    }
  }, []);

  // Persist filters/view
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!filtersLoaded) return;
    const payload = {
      statusFilter,
      siteTypeFilter,
      channelFilter,
      assignmentFilter,
      arrivalsNowOnly,
      viewMode
    };
    localStorage.setItem("campreserv:calendar:viewstate", JSON.stringify(payload));
  }, [statusFilter, siteTypeFilter, channelFilter, assignmentFilter, arrivalsNowOnly, viewMode, filtersLoaded]);


  const createMaintenanceMutation = useMutation({
    mutationFn: (payload: Parameters<typeof apiClient.createMaintenanceTicket>[0]) =>
      apiClient.createMaintenanceTicket(payload),
    onSuccess: () => {
      if (selectedCampground) {
        queryClient.invalidateQueries({ queryKey: ["calendar-maintenance", selectedCampground] });
      }
    }
  });

  const createTaskMutation = useMutation({
    mutationFn: ({ campgroundId, data }: { campgroundId: string; data: Parameters<typeof apiClient.createTask>[1] }) =>
      apiClient.createTask(campgroundId, data),
    onSuccess: () => {
      if (selectedCampground) {
        queryClient.invalidateQueries({ queryKey: ["calendar-housekeeping", selectedCampground, allowOps] });
      }
    }
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof apiClient.updateTask>[1] }) =>
      apiClient.updateTask(id, data),
    onSuccess: () => {
      if (selectedCampground) {
        queryClient.invalidateQueries({ queryKey: ["calendar-housekeeping", selectedCampground, allowOps] });
      }
    }
  });

  const updateHousekeepingMutation = useMutation({
    mutationFn: ({ siteId, status }: { siteId: string; status: string }) =>
      apiClient.updateSiteHousekeeping(siteId, status),
    onSuccess: () => {
      if (selectedCampground) {
        queryClient.invalidateQueries({ queryKey: ["calendar-sites", selectedCampground] });
        queryClient.invalidateQueries({ queryKey: ["calendar-housekeeping", selectedCampground, allowOps] });
      }
    }
  });

  const updateMaintenanceMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof apiClient.updateMaintenance>[1] }) =>
      apiClient.updateMaintenance(id, data),
    onSuccess: () => {
      if (selectedCampground) {
        queryClient.invalidateQueries({ queryKey: ["calendar-maintenance", selectedCampground] });
      }
    }
  });

  const findHousekeepingTask = (siteId: string | null | undefined) =>
    housekeepingTasks.find((t) => t.siteId === siteId && t.type === "housekeeping" && t.status !== "completed");

  const ensureOpsAccess = useCallback(() => {
    if (!allowOps) {
      setSelectionError("Operations tasks are disabled for your role or campground.");
      return false;
    }
    return true;
  }, [allowOps]);

  const markDirty = async (siteId: string) => {
    if (!ensureOpsAccess()) return;
    if (!selectedCampground) return;
    await updateHousekeepingMutation.mutateAsync({ siteId, status: "dirty" });
    await createTaskMutation.mutateAsync({
      campgroundId: selectedCampground,
      data: {
        type: "custom",
        priority: "medium",
        siteId,
        notes: "Cleaning required (auto-created from calendar)",
        createdBy: "system"
      }
    });
  };

  const startCleaning = async (siteId: string) => {
    if (!ensureOpsAccess()) return;
    if (!selectedCampground) return;
    const existing = findHousekeepingTask(siteId);
    await updateHousekeepingMutation.mutateAsync({ siteId, status: "inspecting" });
    if (existing) {
      await updateTaskMutation.mutateAsync({ id: existing.id, data: { state: "in_progress" } });
    } else {
      await createTaskMutation.mutateAsync({
        campgroundId: selectedCampground,
        data: {
          type: "custom",
          priority: "medium",
          siteId,
          notes: "Cleaning in progress",
          createdBy: "system"
        }
      });
    }
  };

  const markClean = async (siteId: string) => {
    if (!ensureOpsAccess()) return;
    const existing = findHousekeepingTask(siteId);
    await updateHousekeepingMutation.mutateAsync({ siteId, status: "clean" });
    if (existing) {
      await updateTaskMutation.mutateAsync({
        id: existing.id,
        data: { state: "done" }
      });
    }
  };

  // Telemetry for data loads and failures
  useEffect(() => {
    if (campgroundsQuery.isSuccess && loadTimers.current.campgrounds) {
      startTiming("campgrounds.load").end({ count: campgroundsQuery.data.length });
    }
    if (campgroundsQuery.isError && campgroundsQuery.error) {
      recordError("campgrounds.load", campgroundsQuery.error);
    }
  }, [campgroundsQuery.isSuccess, campgroundsQuery.isError, campgroundsQuery.data, campgroundsQuery.error]);

  useEffect(() => {
    if (sitesQuery.isSuccess && loadTimers.current.sites) {
      startTiming("sites.load").end({ count: sitesQuery.data.length });
    }
    if (sitesQuery.isError && sitesQuery.error) {
      recordError("sites.load", sitesQuery.error);
    }
  }, [sitesQuery.isSuccess, sitesQuery.isError, sitesQuery.data, sitesQuery.error]);

  useEffect(() => {
    if (reservationsQuery.isSuccess && loadTimers.current.reservations) {
      const activeCount = (reservationsQuery.data || []).filter((r) => r.status !== "cancelled").length;
      startTiming("reservations.load").end({ count: activeCount, dayCount });
      recordMetric("calendar.reservations.visible", { total: activeCount, dayCount });
      setLastUpdated(new Date());
    }
    if (reservationsQuery.isError && reservationsQuery.error) {
      recordError("reservations.load", reservationsQuery.error);
    }
  }, [reservationsQuery.isSuccess, reservationsQuery.isError, reservationsQuery.data, reservationsQuery.error, dayCount]);

  useEffect(() => {
    if (blackoutsQuery.isSuccess && loadTimers.current.blackouts) {
      startTiming("blackouts.load").end({ count: blackoutsQuery.data.length });
    }
    if (blackoutsQuery.isError && blackoutsQuery.error) {
      recordError("blackouts.load", blackoutsQuery.error);
    }
  }, [blackoutsQuery.isSuccess, blackoutsQuery.isError, blackoutsQuery.data, blackoutsQuery.error]);

  // Helper to check if a date is blacked out for a specific site (or park-wide)
  const isDateBlackedOut = (date: Date, siteId: string): boolean => {
    const blackouts = blackoutsQuery.data || [];
    return blackouts.some((b) => {
      const start = new Date(b.startDate);
      const end = new Date(b.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      const checkDate = new Date(date);
      checkDate.setHours(0, 0, 0, 0);
      const inRange = checkDate >= start && checkDate <= end;
      // Park-wide (no siteId) or matches this site
      return inRange && (!b.siteId || b.siteId === siteId);
    });
  };

  const moveMutation = useMutation({
    mutationFn: async (payload: { id: string; siteId: string; arrivalDate: string; departureDate: string }) =>
      apiClient.updateReservation(payload.id, {
        siteId: payload.siteId,
        arrivalDate: payload.arrivalDate,
        departureDate: payload.departureDate
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-reservations", selectedCampground] });
      queryClient.invalidateQueries({ queryKey: ["reservations", selectedCampground] });
      recordMetric("calendar.move.success", { campgroundId: selectedCampground });
    },
    onError: (err) => {
      recordError("reservation.move", err);
      setSelectionError("Move failed. Please retry.");
    }
  });

  const start = useMemo(() => parseLocalDateInput(startDate), [startDate]);
  const days: DayMeta[] = useMemo(() => {
    return Array.from({ length: dayCount }).map((_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const weekend = d.getDay() === 0 || d.getDay() === 6;
      const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      return { date: d, weekend, label, isToday: isToday(d) };
    });
  }, [start, dayCount]);

  const reservationsActive = useMemo(
    () => (reservationsQuery.data || []).filter((r) => r.status !== "cancelled"),
    [reservationsQuery.data]
  );

  const filteredReservations = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return reservationsActive.filter((res) => {
      if (statusFilter !== "all" && res.status !== statusFilter) return false;
      if (assignmentFilter === "assigned" && !res.siteId) return false;
      if (assignmentFilter === "unassigned" && res.siteId) return false;
      if (channelFilter !== "all") {
        const channel = (res as any).channel || (res as any).bookingChannel || (res as any).source;
        if (channel !== channelFilter) return false;
      }
      if (arrivalsNowOnly) {
        const arr = new Date(res.arrivalDate);
        arr.setHours(0, 0, 0, 0);
        if (arr.getTime() !== today.getTime()) return false;
      }
      return true;
    });
  }, [reservationsActive, statusFilter, assignmentFilter, channelFilter, arrivalsNowOnly]);

  const visibleEnd = useMemo(() => {
    const end = new Date(start);
    end.setDate(end.getDate() + dayCount);
    return end;
  }, [start, dayCount]);

  const qaRes = useMemo(() => {
    if (!quickActionAnchor) return null;
    return filteredReservations.find((r) => r.id === quickActionAnchor) || selectedReservation || null;
  }, [filteredReservations, quickActionAnchor, selectedReservation]);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState<number>(0);

  // Keyboard shortcuts for quick actions
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!quickActionsEnabled || !qaRes) return;
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          (target as any).isContentEditable);
      if (isTyping) return;
      if (e.key === "Escape") {
        setQuickActionAnchor(null);
        setQuickActionRes(null);
        return;
      }
      // r: highlight/reassign
      if (e.key.toLowerCase() === "r") {
        setSelection({
          siteId: qaRes.siteId,
          arrival: qaRes.arrivalDate,
          departure: qaRes.departureDate
        });
        setStoreSelection({ highlightedId: qaRes.id, openDetailsId: qaRes.id });
        setQuickActionAnchor(null);
        return;
      }
      // o: open
      if (e.key.toLowerCase() === "o" || e.key === "Enter") {
        setSelectedReservation(qaRes);
        return;
      }
      // m: messages
      if (e.key.toLowerCase() === "m") {
        localStorage.setItem("campreserv:openReservationId", qaRes.id);
        window.location.href = "/messages";
        return;
      }
      // p: payments/collect
      if (e.key.toLowerCase() === "p") {
        window.location.href = "/billing/repeat-charges";
        return;
      }
      // c: check-in/out
      if (e.key.toLowerCase() === "c") {
        setQuickActionLoading(true);
        const action =
          qaRes.status === "checked_in"
            ? apiClient.checkOutReservation(qaRes.id)
            : apiClient.checkInReservation(qaRes.id);
        action.finally(async () => {
          await queryClient.invalidateQueries({ queryKey: ["calendar-reservations", selectedCampground] });
          setQuickActionLoading(false);
        });
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [quickActionsEnabled, qaRes, setSelection, setStoreSelection, selectedCampground, queryClient]);

  const conflicts = useMemo(() => {
    const bySite: Record<string, any[]> = {};
    filteredReservations.forEach((res) => {
      if (!res.siteId) return;
      if (!bySite[res.siteId]) bySite[res.siteId] = [];
      bySite[res.siteId].push(res);
    });
    const results: any[] = [];
    Object.entries(bySite).forEach(([siteId, list]) => {
      const sorted = [...list].sort((a: any, b: any) => new Date(a.arrivalDate).getTime() - new Date(b.arrivalDate).getTime());
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const cur = sorted[i];
        const prevEnd = new Date(prev.departureDate);
        const curStart = new Date(cur.arrivalDate);
        if (curStart < prevEnd) {
          const overlapStart = curStart > start ? curStart : start;
          const overlapEnd = prevEnd < visibleEnd ? prevEnd : visibleEnd;
          if (overlapEnd > overlapStart) {
            results.push({ siteId, overlapStart, overlapEnd, a: prev, b: cur });
          }
        }
      }
    });
    return results;
  }, [filteredReservations, start, visibleEnd]);

  // Calculate summary statistics for visible period (exclude cancelled)
  const stats = useMemo(() => {
    const reservations = filteredReservations as any[];
    const sites = sitesQuery.data || [];
    const endDate = visibleEnd;

    const visibleReservations = reservations.filter((res) => {
      const resStart = new Date(res.arrivalDate);
      const resEnd = new Date(res.departureDate);
      return resEnd > start && resStart < endDate;
    });

    const visibleFiltered = statusFilter === "all"
      ? visibleReservations
      : visibleReservations.filter((r) => r.status === statusFilter);

    const totalRevenue = visibleFiltered.reduce((sum, r) => sum + (r.totalAmount ?? 0), 0) / 100;
    const totalNights = visibleFiltered.reduce((sum, r) => {
      const resStart = new Date(r.arrivalDate);
      const resEnd = new Date(r.departureDate);
      return sum + diffInDays(resEnd, resStart);
    }, 0);

    const totalAvailableNights = sites.length * dayCount;
    const occupancyRate = totalAvailableNights > 0 ? (totalNights / totalAvailableNights) * 100 : 0;

    return {
      totalReservations: visibleFiltered.length,
      totalRevenue,
      occupancyRate,
      averageDailyRate: totalNights > 0 ? totalRevenue / totalNights : 0
    };
  }, [filteredReservations, sitesQuery.data, start, dayCount, statusFilter, visibleEnd]);

  // Navigation helpers
  const jumpToToday = () => {
    setStartDate(formatLocalDateInput(new Date()));
  };

  const jumpToDate = () => {
    if (!jumpDate) return;
    setStartDate(jumpDate);
  };

  const shiftDays = (delta: number) => {
    const newStart = parseLocalDateInput(startDate);
    newStart.setDate(newStart.getDate() + delta);
    setStartDate(formatLocalDateInput(newStart));
  };

  const clearSelection = () => {
    setSelection(null);
    setQuotePreview(null);
    setSelectionError(null);
    setSelectionConflict(null);
    setHoldStatus({ state: "idle" });
    setStoreSelection({ highlightedId: null, openDetailsId: null });
  };

  useEffect(() => {
    setHoldStatus({ state: "idle" });
  }, [selection?.siteId, selection?.arrival, selection?.departure]);

  // Load communications for selected reservation (on-demand)
  useEffect(() => {
    const resId = selectedReservation?.id;
    if (!resId || !selectedCampground) return;
    if (commsByRes[resId] || commsLoading[resId]) return;
    setCommsLoading((prev) => ({ ...prev, [resId]: true }));
    setCommsErrors((prev) => {
      const next = { ...prev };
      delete next[resId];
      return next;
    });
    apiClient
      .listCommunications({
        campgroundId: selectedCampground,
        reservationId: resId,
        guestId: selectedReservation.guestId || undefined,
        limit: 50
      })
      .then((resp) => {
        setCommsByRes((prev) => ({ ...prev, [resId]: resp.items }));
      })
      .catch(() => {
        setCommsErrors((prev) => ({ ...prev, [resId]: "Failed to load messages." }));
      })
      .finally(() => {
        setCommsLoading((prev) => ({ ...prev, [resId]: false }));
      });
  }, [selectedReservation, selectedCampground, commsByRes, commsLoading]);

  const dayColumnWidth = useMemo(() => {
    if (dayCount > 30) return 64;
    if (dayCount > 21) return 72;
    if (dayCount > 14) return 82;
    return 94;
  }, [dayCount]);

  const siteColumnWidth = 160;
  const gridTemplate = useMemo(
    () => `${siteColumnWidth}px repeat(${dayCount}, minmax(${dayColumnWidth}px, 1fr))`,
    [dayCount, dayColumnWidth]
  );
  const gridMinWidth = useMemo(
    () => `${Math.max(780, Math.min(1100, siteColumnWidth + dayCount * dayColumnWidth))}px`,
    [dayCount, dayColumnWidth]
  );

  const handleMouseDown = (siteId: string, dayIdx: number) => {
    if (clickStart && clickStart.siteId !== siteId) {
      setClickStart(null);
    }
    setDragSiteId(siteId);
    setDragStartIdx(dayIdx);
    setDragEndIdx(dayIdx);
    setIsDragging(false);
  };
  const handleMouseEnter = (dayIdx: number) => {
    if (dragSiteId !== null && dragStartIdx !== null) {
      setDragEndIdx(dayIdx);
      if (dayIdx !== dragStartIdx) {
        setIsDragging(true);
      }
    }
  };
  const selectRange = async (siteId: string, startIdx: number, endIdx: number) => {
    const boundedStart = Math.max(0, Math.min(startIdx, endIdx));
    const boundedEndExclusive = Math.min(dayCount, Math.max(startIdx, endIdx) + 1);
    const arrivalDate = days[boundedStart]?.date ? formatLocalDateInput(days[boundedStart].date) : undefined;
    const departureDateObj =
      days[boundedEndExclusive]?.date ||
      (() => {
        const last = days[Math.min(boundedEndExclusive - 1, days.length - 1)]?.date;
        if (!last) return null;
        const d = new Date(last);
        d.setDate(d.getDate() + 1); // exclusive end
        return d;
      })();
    const departureExclusive = departureDateObj ? formatLocalDateInput(departureDateObj) : undefined;

    if (!arrivalDate || !departureExclusive) return;

    setSelectionError(null);
    setSelectionConflict(null);
    setSelection(null);
    setQuotePreview(null);
    if (!selectedCampground) return;

    // Quick availability check; if it fails, still allow selection but warn later.
    let isAvailable = true;
    try {
      const available = await apiClient.getAvailability(selectedCampground, {
        arrivalDate,
        departureDate: departureExclusive
      });
      isAvailable = available.some((s) => s.id === siteId);
    } catch (err) {
      setSelectionError("Availability check failed (server error). You can still try to save in Reservations.");
      recordError("availability.check", err);
    }

    if (!isAvailable) {
      setSelectionError("This site is unavailable for those dates. Try another range or site.");
      recordMetric("calendar.selection.unavailable", { siteId, arrivalDate, departureDate: departureExclusive });
      return;
    }

    // Conflict preflight against existing reservations
    try {
      const overlap = await apiClient.checkOverlap(selectedCampground, {
        siteId,
        arrivalDate,
        departureDate: departureExclusive
      });
      if (overlap.conflict) {
        setSelectionConflict("Another reservation overlaps these dates for this site.");
        recordMetric("calendar.selection.conflict", { siteId, arrivalDate, departureDate: departureExclusive });
        return;
      }
    } catch (err) {
      // Soft-fail: still allow selection but show warning
      setSelectionConflict("Conflict check failed (server error). Double-check before saving.");
      recordError("overlap.check", err);
    }

    // If a reservation is highlighted elsewhere, move it; otherwise keep selection for new create.
    if (ganttSelection.highlightedId) {
      const movingRes = reservationsQuery.data?.find((r) => r.id === ganttSelection.highlightedId);
      if (movingRes?.status === "checked_in") {
        setSelectionError("Checked-in stays cannot be moved from calendar.");
        recordMetric("calendar.move.blocked", { reason: "checked_in", reservationId: movingRes.id });
        return;
      }
      const isSameSite = movingRes?.siteId === siteId;
      const sameArrival =
        movingRes &&
        new Date(arrivalDate).toISOString().slice(0, 10) === new Date(movingRes.arrivalDate).toISOString().slice(0, 10);
      const isExtension =
        isSameSite &&
        sameArrival &&
        movingRes &&
        new Date(departureExclusive).getTime() > new Date(movingRes.departureDate).getTime();

      if (isExtension && selectedCampground && movingRes) {
        try {
          const quote = await apiClient.getQuote(selectedCampground, {
            siteId,
            arrivalDate,
            departureDate: departureExclusive
          });
          const currentTotal = movingRes.totalAmount ?? 0;
          const newTotal = quote.totalCents ?? currentTotal;
          const delta = Math.max(0, newTotal - currentTotal);
          setExtendPrompt({
            reservation: movingRes,
            arrivalDate,
            departureDate: departureExclusive,
            totalCents: newTotal,
            deltaCents: delta
          });
          return;
        } catch (err) {
          recordError("reservation.extend.quote", err);
          setSelectionError("Unable to fetch extension quote. Try again.");
          return;
        }
      }

      if (selectedCampground && movingRes) {
        try {
          const quote = await apiClient.getQuote(selectedCampground, {
            siteId,
            arrivalDate,
            departureDate: departureExclusive
          });
          const currentTotal = movingRes.totalAmount ?? 0;
          const newTotal = quote.totalCents ?? currentTotal;
          const delta = Math.max(0, newTotal - currentTotal);
          if (delta > 0) {
            setPendingMove({
              reservation: movingRes,
              siteId,
              arrivalDate,
              departureDate: departureExclusive,
              deltaCents: delta,
              quoteTotalCents: newTotal,
              currentTotalCents: currentTotal
            });
            return;
          }
        } catch (err) {
          recordError("reservation.move.quote", err);
          // Continue without price confirmation
        }
      }

      moveMutation.mutate({
        id: ganttSelection.highlightedId,
        siteId,
        arrivalDate,
        departureDate: departureExclusive
      });
      setSelectionError(null);
      setSelectionConflict(null);
      setSelection(null);
      setQuotePreview(null);
    } else {
      setSelection({ siteId, arrival: arrivalDate, departure: departureExclusive });
      try {
        const quote = await apiClient.getQuote(selectedCampground, {
          siteId,
          arrivalDate,
          departureDate: departureExclusive
        });
        const site = sitesQuery.data?.find(s => s.id === siteId);
        setQuotePreview({
          siteId,
          siteName: site?.name || siteId,
          arrival: arrivalDate,
          departure: departureExclusive,
          nights: quote.nights ?? Math.max(1, diffInDays(new Date(departureExclusive), new Date(arrivalDate))),
          total: (quote.totalCents ?? 0) / 100,
          base: (quote.baseSubtotalCents ?? quote.totalCents ?? 0) / 100,
          perNight: (quote.perNightCents ?? 0) / 100,
          rulesDelta: (quote.rulesDeltaCents ?? 0) / 100,
          depositRule: campgroundsQuery.data?.find(cg => cg.id === selectedCampground)?.depositRule ?? null
        });
        recordMetric("calendar.selection.quote", {
          siteId,
          arrivalDate,
          departureDate: departureExclusive,
          nights: quote.nights,
          totalCents: quote.totalCents
        });
      } catch {
        setQuotePreview(null);
      }
    }
    recordMetric("calendar.selection.success", { siteId, arrivalDate, departureDate: departureExclusive, isMove: !!ganttSelection.highlightedId });
  };

  const handleCreateHold = async () => {
    if (!selection || !selectedCampground) {
      setSelectionError("Select a site and dates first.");
      return;
    }
    setHoldStatus({ state: "loading" });
    recordMetric("calendar.hold.start", { siteId: selection.siteId });
    try {
      await apiClient.createHold({
        campgroundId: selectedCampground,
        siteId: selection.siteId,
        arrivalDate: selection.arrival,
        departureDate: selection.departure,
        holdMinutes: 15
      });
      setHoldStatus({ state: "success", message: "Hold placed for 15 minutes." });
      recordMetric("calendar.hold.success", { siteId: selection.siteId, minutes: 15 });
    } catch (err) {
      setHoldStatus({ state: "error", message: "Hold failed. Please retry." });
      setSelectionError("Hold failed. Please retry or create the reservation directly.");
      recordError("hold.create", err);
    }
  };

  const handleMouseUp = async (siteId?: string, dayIdx?: number) => {
    // Full drag flow - user dragged across multiple cells
    if (isDragging && dragSiteId !== null && dragStartIdx !== null && dragEndIdx !== null && siteId !== undefined && dayIdx !== undefined) {
      await selectRange(siteId, dragStartIdx, dayIdx);
    }
    // Single-cell click-and-release: user clicked a cell and released without dragging
    // This creates a 1-night selection from that day
    else if (!isDragging && dragSiteId !== null && dragStartIdx !== null && siteId === dragSiteId && dayIdx === dragStartIdx) {
      await selectRange(siteId, dragStartIdx, dragStartIdx);
    }
    // Two-click flow for range selection
    else if (siteId && typeof dayIdx === "number") {
      if (!clickStart || clickStart.siteId !== siteId) {
        setClickStart({ siteId, idx: dayIdx });
      } else {
        await selectRange(siteId, clickStart.idx, dayIdx);
        setClickStart(null);
      }
    }

    // reset drag state immediately to prevent hover from extending selection
    setDragSiteId(null);
    setDragStartIdx(null);
    setDragEndIdx(null);
    setIsDragging(false);
  };

  useEffect(() => {
    const onUp = () => {
      if (isDragging) {
        handleMouseUp();
      } else {
        // when not dragging and mouseup happens outside, just clear drag markers
        setDragSiteId(null);
        setDragStartIdx(null);
        setDragEndIdx(null);
      }
    };
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, [isDragging, dragSiteId, dragStartIdx, dragEndIdx]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          shiftDays(-1);
          break;
        case "ArrowRight":
          e.preventDefault();
          shiftDays(1);
          break;
        case "ArrowUp":
          e.preventDefault();
          shiftDays(-7);
          break;
        case "ArrowDown":
          e.preventDefault();
          shiftDays(7);
          break;
        case "Escape":
          e.preventDefault();
          clearSelection();
          break;
        case "t":
        case "T":
          e.preventDefault();
          jumpToToday();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [start, dayCount]);

  return (
    <DashboardShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Breadcrumbs items={[{ label: "Smart Calendar" }]} />
          <HelpAnchor topicId="calendar-availability" label="Calendar help" />
        </div>

        {/* Summary Statistics */}
        {selectedCampground && !sitesQuery.isLoading && !reservationsQuery.isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="card p-3">
              <div className="text-xs text-slate-600 mb-1">Reservations</div>
              <div className="text-2xl font-bold text-slate-900">{stats.totalReservations}</div>
            </div>
            <div className="card p-3">
              <div className="text-xs text-slate-600 mb-1">Revenue</div>
              <div className="text-2xl font-bold text-emerald-600">${stats.totalRevenue.toFixed(0)}</div>
            </div>
            <div className="card p-3">
              <div className="text-xs text-slate-600 mb-1">Occupancy</div>
              <div className="text-2xl font-bold text-blue-600">{stats.occupancyRate.toFixed(1)}%</div>
            </div>
            <div className="card p-3">
              <div className="text-xs text-slate-600 mb-1">Avg Daily Rate</div>
              <div className="text-2xl font-bold text-purple-600">${stats.averageDailyRate.toFixed(0)}</div>
            </div>
          </div>
        )}

        <Dialog open={conflictDrawerOpen} onOpenChange={setConflictDrawerOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Resolve conflicts</DialogTitle>
            </DialogHeader>
            {selectedConflict ? (
              <div className="space-y-3">
                <div className="text-sm text-slate-600">
                  Site: <span className="font-semibold">{selectedConflict.a?.site?.name || selectedConflict.a?.siteId || "Unknown"}</span>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Overlap {selectedConflict.overlapStart?.toISOString()?.slice(0, 10)} → {selectedConflict.overlapEnd?.toISOString()?.slice(0, 10)}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1">
                    <div className="font-semibold text-slate-800">Reservation A</div>
                    <div>{selectedConflict.a?.guest?.primaryFirstName} {selectedConflict.a?.guest?.primaryLastName}</div>
                    <div>{selectedConflict.a?.arrivalDate?.slice(0, 10)} → {selectedConflict.a?.departureDate?.slice(0, 10)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="font-semibold text-slate-800">Reservation B</div>
                    <div>{selectedConflict.b?.guest?.primaryFirstName} {selectedConflict.b?.guest?.primaryLastName}</div>
                    <div>{selectedConflict.b?.arrivalDate?.slice(0, 10)} → {selectedConflict.b?.departureDate?.slice(0, 10)}</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  {(["reassign", "adjust", "comp"] as const).map((mode) => (
                    <Button
                      key={mode}
                      variant={resolveAction === mode ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setResolveAction(mode)}
                    >
                      {mode === "reassign" ? "Reassign site" : mode === "adjust" ? "Adjust dates" : "Comp / note"}
                    </Button>
                  ))}
                </div>

                {resolveAction === "reassign" && (
                  <div className="space-y-2">
                    <label className="text-xs text-slate-500">New site</label>
                    <select
                      className="w-full rounded border border-slate-200 px-2 py-2 text-sm"
                      value={resolveSiteId}
                      onChange={(e) => setResolveSiteId(e.target.value)}
                    >
                      <option value="">Select site</option>
                      {(sitesQuery.data || []).map((s: any) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      disabled={!resolveSiteId}
                      onClick={async () => {
                        const target = resolveSiteId;
                        const resId = selectedConflict.a?.id;
                        if (!target || !resId) return;
                        await moveMutation.mutateAsync({
                          id: resId,
                          siteId: target,
                          arrivalDate: selectedConflict.a.arrivalDate,
                          departureDate: selectedConflict.a.departureDate
                        });
                        setConflictDrawerOpen(false);
                      }}
                    >
                      Save reassign
                    </Button>
                  </div>
                )}

                {resolveAction === "adjust" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500">Arrival</label>
                      <input
                        type="date"
                        className="w-full rounded border border-slate-200 px-2 py-2 text-sm"
                        value={resolveArrival}
                        onChange={(e) => setResolveArrival(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500">Departure</label>
                      <input
                        type="date"
                        className="w-full rounded border border-slate-200 px-2 py-2 text-sm"
                        value={resolveDeparture}
                        onChange={(e) => setResolveDeparture(e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Button
                        size="sm"
                        disabled={!resolveArrival || !resolveDeparture}
                        onClick={async () => {
                          const resId = selectedConflict.a?.id;
                          if (!resId) return;
                          await moveMutation.mutateAsync({
                            id: resId,
                            siteId: selectedConflict.a.siteId,
                            arrivalDate: resolveArrival,
                            departureDate: resolveDeparture
                          });
                          setConflictDrawerOpen(false);
                        }}
                      >
                        Save date change
                      </Button>
                    </div>
                  </div>
                )}

                {resolveAction === "comp" && (
                  <div className="space-y-2">
                    <label className="text-xs text-slate-500">Note</label>
                    <textarea
                      className="w-full rounded border border-slate-200 px-2 py-2 text-sm"
                      value={resolveNote}
                      onChange={(e) => setResolveNote(e.target.value)}
                      placeholder="Add comp/discount note"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        // Placeholder: integrate ledger/comp action
                        setResolveNote("");
                        setConflictDrawerOpen(false);
                      }}
                    >
                      Save note
                    </Button>
                  </div>
                )}

                <Button variant="outline" onClick={() => setConflictDrawerOpen(false)}>Close</Button>
              </div>
            ) : (
              <div className="text-sm text-slate-600">No conflict selected.</div>
            )}
          </DialogContent>
        </Dialog>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Campground Selector */}
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium min-w-[200px]"
            value={selectedCampground}
            onChange={(e) => {
              setSelectedCampground(e.target.value);
              localStorage.setItem("campreserv:selectedCampground", e.target.value);
              clearSelection();
            }}
          >
            <option value="">Select Campground</option>
            {campgroundsQuery.data?.map((cg) => (
              <option key={cg.id} value={cg.id}>
                {cg.name}
              </option>
            ))}
          </select>

          <div className="h-6 w-px bg-slate-300" />

          {/* View Mode */}
          <div className="inline-flex rounded-md border border-slate-200 bg-white shadow-sm overflow-hidden">
            {(["day", "week", "month", "list"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`px-3 py-2 text-sm font-medium capitalize transition-colors ${viewMode === mode
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-slate-600 hover:bg-slate-50"
                  }`}
                onClick={() => setViewMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>

          <div className="h-6 w-px bg-slate-300" />

          {/* Status Filter */}
          <select
            className={`rounded-md border px-3 py-2 text-sm ${statusFilter === "all"
              ? "border-slate-200"
              : "border-blue-300 bg-blue-50 font-medium"
              }`}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="checked_in">Checked In</option>
            <option value="pending">Pending</option>
          </select>

          {/* Site Type Filter */}
          <select
            className={`rounded-md border px-3 py-2 text-sm ${siteTypeFilter === "all"
              ? "border-slate-200"
              : "border-emerald-300 bg-emerald-50 font-medium"
              }`}
            value={siteTypeFilter}
            onChange={(e) => setSiteTypeFilter(e.target.value)}
          >
            <option value="all">All Site Types</option>
            <option value="rv_full">RV Full Hookup</option>
            <option value="rv_partial">RV Partial</option>
            <option value="tent">Tent</option>
            <option value="cabin">Cabin</option>
            <option value="glamping">Glamping</option>
          </select>

          {/* Channel Filter */}
          <select
            className={`rounded-md border px-3 py-2 text-sm ${channelFilter === "all"
              ? "border-slate-200"
              : "border-violet-300 bg-violet-50 font-medium"
              }`}
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
          >
            <option value="all">All Channels</option>
            <option value="direct">Direct</option>
            <option value="ota">OTA / Marketplace</option>
            <option value="phone">Phone</option>
            <option value="web">Web</option>
          </select>

          {/* Assignment Filter */}
          <select
            className={`rounded-md border px-3 py-2 text-sm ${assignmentFilter === "all"
              ? "border-slate-200"
              : "border-amber-300 bg-amber-50 font-medium"
              }`}
            value={assignmentFilter}
            onChange={(e) => setAssignmentFilter(e.target.value as any)}
          >
            <option value="all">All Assignments</option>
            <option value="assigned">Assigned</option>
            <option value="unassigned">Unassigned</option>
          </select>

          <button
            type="button"
            className={`rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${arrivalsNowOnly
              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
              : "border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            onClick={() => setArrivalsNowOnly((v) => !v)}
          >
            Arrivals now
          </button>

          <div className="h-6 w-px bg-slate-300" />

          {/* Date Controls */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => shiftDays(-dayCount)}
          >
            ← Prev
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={jumpToToday}
          >
            Today
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => shiftDays(dayCount)}
          >
            Next →
          </Button>

          <input
            type="date"
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="rounded-md border border-slate-200 px-3 py-2 text-sm"
              placeholder="Go to date"
              value={jumpDate}
              onChange={(e) => setJumpDate(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") jumpToDate();
              }}
            />
            <Button variant="secondary" size="sm" onClick={jumpToDate}>
              Go
            </Button>
            <span className="text-[11px] text-slate-500">Shortcut: press G then type date</span>
          </div>

          <Button
            variant={showConflictsOnly ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowConflictsOnly((v) => !v)}
          >
            {showConflictsOnly ? "Conflicts only" : "Highlight conflicts"}
          </Button>

          {/* View Range */}
          <select
            className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={dayCount}
            onChange={(e) => setDayCount(Number(e.target.value))}
          >
            {[7, 14, 21, 30, 60].map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </select>

          <div className="h-6 w-px bg-slate-300" />

          {calendarFilterCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 text-[11px] font-semibold">
                {calendarFilterCount} filter{calendarFilterCount > 1 ? "s" : ""}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatusFilter("all");
                  setSiteTypeFilter("all");
                  setChannelFilter("all");
                  setAssignmentFilter("all");
                  setArrivalsNowOnly(false);
                  setViewMode("week");
                }}
              >
                Clear filters
              </Button>
            </div>
          )}

          {/* Actions - always rendered to prevent layout shift */}
          <Button
            variant="secondary"
            size="sm"
            onClick={clearSelection}
            className={selection ? "" : "opacity-0 pointer-events-none"}
          >
            Clear Selection
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter("all");
              setSiteTypeFilter("all");
            }}
          >
            Clear filters
          </Button>

          <div className="ml-auto text-xs text-slate-500 hidden lg:block">
            Shortcuts: ← → (days) • ↑ ↓ (weeks) • T (today) • Esc (clear)
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border border-amber-500 flex items-center justify-center">
              <Wrench className="h-3 w-3 text-amber-600" />
            </div>
            <span>Maintenance on site</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded border border-cyan-500 flex items-center justify-center">
              <Sparkles className="h-3 w-3 text-cyan-600" />
            </div>
            <span>Cleaning needed</span>
          </div>
        </div>

        {/* Refresh / Updated */}
        <div className="flex items-center gap-2 text-xs text-slate-600 mt-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => {
              if (selectedCampground) {
                queryClient.invalidateQueries({ queryKey: ["calendar-reservations", selectedCampground] });
                queryClient.invalidateQueries({ queryKey: ["calendar-sites", selectedCampground] });
                queryClient.invalidateQueries({ queryKey: ["calendar-blackouts", selectedCampground] });
              }
              queryClient.invalidateQueries({ queryKey: ["campgrounds"] });
            }}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Refresh
          </Button>
          <span className="text-slate-500">
            {lastUpdated ? `Updated ${formatDistanceToNow(lastUpdated, { addSuffix: true })}` : "Not updated yet"}
          </span>
        </div>

        {/* Conflict banner */}
        {conflicts.length > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <AlertTriangle className="h-4 w-4" />
              {conflicts.length} conflict{conflicts.length > 1 ? "s" : ""} detected
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setSelectedConflict(conflicts[0]);
                setConflictDrawerOpen(true);
                setResolveAction(null);
                setResolveSiteId(conflicts[0]?.a?.siteId || "");
                setResolveArrival(conflicts[0]?.a?.arrivalDate?.slice(0, 10) || "");
                setResolveDeparture(conflicts[0]?.a?.departureDate?.slice(0, 10) || "");
                setResolveNote("");
              }}
            >
              Resolve
            </Button>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-emerald-600" />
            <span>Confirmed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-600" />
            <span>Checked In</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-amber-500" />
            <span>Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-purple-600" />
            <span>Your Selection</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded"
              style={{ background: "repeating-linear-gradient(45deg, #fecaca, #fecaca 2px, #fee2e2 2px, #fee2e2 4px)" }}
            />
            <span>Blackout</span>
          </div>
        </div>

        {/* Loading State */}
        {selectedCampground && (sitesQuery.isLoading || reservationsQuery.isLoading) && (
          <div className="card p-8 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent" />
            <p className="mt-3 text-sm text-slate-600">Loading calendar data...</p>
          </div>
        )}

        {/* Empty State - No Sites */}
        {selectedCampground && !sitesQuery.isLoading && !reservationsQuery.isLoading && (sitesQuery.data?.length || 0) === 0 && (
          <div className="card p-8 text-center">
            <div className="text-4xl mb-3">🗺️</div>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">No sites yet</h2>
            <p className="text-sm text-slate-600">Add sites to this campground to start booking on the calendar.</p>
          </div>
        )}

        {/* Empty State - No Reservations in range */}
        {selectedCampground &&
          !sitesQuery.isLoading &&
          !reservationsQuery.isLoading &&
          (sitesQuery.data?.length || 0) > 0 &&
          reservationsActive.length === 0 && (
            <div className="card p-8 text-center">
              <div className="text-4xl mb-3">🛶</div>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">No reservations in this range</h2>
              <p className="text-sm text-slate-600">Try expanding the date range or creating a new reservation.</p>
            </div>
          )}

        {/* Empty State - No Campground */}
        {!selectedCampground && (
          <div className="card p-8 text-center">
            <div className="text-4xl mb-3">📅</div>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Smart Booking Calendar</h2>
            <p className="text-sm text-slate-600 mb-4">
              Select a campground above to view and manage reservations with drag-and-drop
            </p>
            <ul className="text-xs text-slate-500 text-left max-w-md mx-auto space-y-1">
              <li>• Drag across dates to create new reservations</li>
              <li>• Drag existing reservations to reschedule</li>
              <li>• See real-time availability and pricing</li>
              <li>• Navigate by day, week, or month</li>
            </ul>
          </div>
        )}

        {/* Day View */}
        {selectedCampground && !sitesQuery.isLoading && !reservationsQuery.isLoading && viewMode === "day" && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">
                Day view · {start.toLocaleDateString()}
              </div>
              <span className="text-xs text-slate-500">Hours 6a–10p</span>
            </div>
            <div className="divide-y divide-slate-100">
              {filteredReservations
                .filter((res: any) => {
                  const arr = toLocalDate(res.arrivalDate);
                  const dep = toLocalDate(res.departureDate);
                  return dep > start && arr <= visibleEnd;
                })
                .sort((a: any, b: any) => new Date(a.arrivalDate).getTime() - new Date(b.arrivalDate).getTime())
                .map((res: any) => {
                  const site = (sitesQuery.data || []).find((s: any) => s.id === res.siteId);
                  return (
                    <div key={res.id} className="p-4 flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold text-slate-900">
                          {res.guest?.primaryFirstName} {res.guest?.primaryLastName}
                        </div>
                        <Badge variant="outline" className="capitalize text-[11px]">
                          {res.status?.replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600 flex-wrap">
                        <span>{site?.name || "Unassigned"}</span>
                        <span>•</span>
                        <span>{res.arrivalDate?.slice(11, 16) || res.arrivalDate?.slice(0, 10)} → {res.departureDate?.slice(11, 16) || res.departureDate?.slice(0, 10)}</span>
                        <span>•</span>
                        <span>{(res.channel || res.bookingChannel || res.source) ?? "direct"}</span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" variant="secondary" onClick={() => setSelectedReservation(res)}>
                          Open
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => {
                          setSelection({
                            siteId: res.siteId,
                            arrival: res.arrivalDate,
                            departure: res.departureDate
                          });
                          setStoreSelection({ highlightedId: res.id, openDetailsId: res.id });
                        }}>
                          Highlight
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowPopover(res.id)}>
                          Quick actions
                        </Button>
                      </div>
                    </div>
                  );
                })}
              {filteredReservations.length === 0 && (
                <div className="p-6 text-center text-sm text-slate-500">No reservations for this day.</div>
              )}
            </div>
          </div>
        )}

        {/* Week View */}
        {selectedCampground && !sitesQuery.isLoading && !reservationsQuery.isLoading && viewMode === "week" && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-auto">
            <div className="grid grid-cols-8 text-xs font-semibold text-slate-700 border-b border-slate-200 min-w-[960px]">
              <div className="px-3 py-2 sticky left-0 z-30 bg-slate-100 border-r border-slate-200 text-left text-sm">
                Site
              </div>
              {days.slice(0, 7).map((d, idx) => (
                <div
                  key={idx}
                  className={`px-2 py-2 text-center border-r border-slate-200 relative ${d.isToday ? "bg-blue-100 font-bold text-blue-900" : d.weekend ? "bg-slate-100" : "bg-slate-50"}`}
                >
                  {d.label}
                  {d.isToday && <div className="text-[10px] text-blue-600 font-normal">Today</div>}
                </div>
              ))}
            </div>

            <div className="divide-y divide-slate-200 min-w-[960px]">
              {(sitesQuery.data || []).map((site, rowIdx) => {
                const zebra = rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50";
                const siteReservations = filteredReservations.filter((r) => r.siteId === site.id);
                return (
                  <div key={site.id} className={`grid grid-cols-8 ${zebra}`}>
                    <div className="px-3 py-2 sticky left-0 z-20 border-r border-slate-200 flex flex-col gap-1">
                      <div className="text-sm font-semibold text-slate-900">{site.name}</div>
                      <div className="text-xs text-slate-500">{site.siteType}</div>
                    </div>
                    {days.slice(0, 7).map((d, idx) => {
                      const res = siteReservations.find((r) => {
                        const resStart = toLocalDate(r.arrivalDate);
                        const resEnd = toLocalDate(r.departureDate);
                        return resStart <= d.date && resEnd > d.date;
                      });
                      const conflictHit = res
                        ? conflicts.some((c) => c.a?.id === res.id || c.b?.id === res.id)
                        : false;
                      return (
                        <div key={idx} className="border-r border-slate-200 min-h-[72px] relative px-2 py-1">
                          {res && (
                            <div
                              className={`rounded-md text-[11px] text-white px-2 py-1 flex items-center gap-1 ${res.status === "checked_in"
                                ? "bg-blue-600"
                                : res.status === "confirmed"
                                  ? "bg-emerald-600"
                                  : "bg-amber-500"
                                }`}
                              onClick={() => {
                                setSelectedReservation(res);
                                setQuickActionRes(res.id);
                                setQuickActionAnchor(res.id);
                                setShowPopover(res.id);
                              }}
                            >
                              <span className="truncate">{res.guest?.primaryFirstName} {res.guest?.primaryLastName}</span>
                              {conflictHit && <AlertTriangle className="h-3 w-3 text-amber-100" />}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Month View (condensed) */}
        {selectedCampground && !sitesQuery.isLoading && !reservationsQuery.isLoading && viewMode === "month" && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-7 border-b border-slate-200 text-xs font-semibold text-slate-700">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="px-3 py-2 text-center bg-slate-50">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px bg-slate-200">
              {days.slice(0, 30).map((d, idx) => {
                const dayReservations = filteredReservations.filter((res) => {
                  const resStart = toLocalDate(res.arrivalDate);
                  const resEnd = toLocalDate(res.departureDate);
                  return resStart <= d.date && resEnd > d.date;
                });
                return (
                  <div key={idx} className="min-h-[120px] bg-white px-2 py-2 flex flex-col gap-2">
                    <div className={`flex items-center justify-between text-xs ${d.isToday ? "text-blue-700 font-semibold" : "text-slate-700"}`}>
                      <span>{d.label}</span>
                      {d.isToday && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Today</span>}
                    </div>
                    <div className="space-y-1">
                      {dayReservations.slice(0, 3).map((res) => {
                        const site = (sitesQuery.data || []).find((s: any) => s.id === res.siteId);
                        const conflictHit = conflicts.some((c) => c.a?.id === res.id || c.b?.id === res.id);
                        const statusColor =
                          res.status === "checked_in"
                            ? "bg-blue-600"
                            : res.status === "confirmed"
                              ? "bg-emerald-600"
                              : "bg-amber-500";
                        return (
                          <button
                            key={res.id}
                            className={`w-full text-left rounded px-2 py-1 text-[11px] text-white flex items-center gap-1 ${statusColor}`}
                            onClick={() => {
                              setSelectedReservation(res);
                              setQuickActionRes(res.id);
                              setQuickActionAnchor(res.id);
                              setShowPopover(res.id);
                            }}
                          >
                            <span className="truncate">{res.guest?.primaryFirstName} {res.guest?.primaryLastName}</span>
                            {conflictHit && <AlertTriangle className="h-3 w-3 text-amber-100" />}
                            <span className="text-[10px] opacity-90 ml-auto">{site?.name || "Unassigned"}</span>
                          </button>
                        );
                      })}
                      {dayReservations.length > 3 && (
                        <div className="text-[10px] text-slate-500">+{dayReservations.length - 3} more</div>
                      )}
                      {dayReservations.length === 0 && (
                        <div className="text-[11px] text-slate-400">No stays</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* List View */}
        {selectedCampground && !sitesQuery.isLoading && !reservationsQuery.isLoading && viewMode === "list" && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="divide-y divide-slate-200">
              {filteredReservations
                .slice()
                .sort((a: any, b: any) => new Date(a.arrivalDate).getTime() - new Date(b.arrivalDate).getTime())
                .map((res: any) => {
                  const site = (sitesQuery.data || []).find((s: any) => s.id === res.siteId);
                  return (
                    <div key={res.id} className="p-4 flex flex-col gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[11px] capitalize">
                          {res.status}
                        </Badge>
                        <div className="font-semibold text-slate-900">
                          {res.guest?.primaryFirstName} {res.guest?.primaryLastName}
                        </div>
                        <span className="text-sm text-slate-500">
                          • {res.arrivalDate?.slice(0, 10)} → {res.departureDate?.slice(0, 10)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-slate-600 flex-wrap">
                        <span>{site?.name || "Unassigned"}</span>
                        <span>•</span>
                        <span>{(res.channel || res.bookingChannel || res.source) ?? "direct"}</span>
                        {res.balanceAmount ? (
                          <>
                            <span>•</span>
                            <Badge variant="destructive" className="text-[11px]">Balance due</Badge>
                          </>
                        ) : null}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" variant="secondary" onClick={() => setSelectedReservation(res)}>
                          Open
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setSelection({
                              siteId: res.siteId,
                              arrival: res.arrivalDate,
                              departure: res.departureDate
                            })
                          }
                        >
                          Highlight
                        </Button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Calendar Grid */}
        {selectedCampground && !sitesQuery.isLoading && !reservationsQuery.isLoading && viewMode !== "list" && (
          <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm select-none">
            <div
              className="grid text-xs font-semibold text-slate-700 border-b border-slate-200"
              style={{ gridTemplateColumns: gridTemplate, minWidth: gridMinWidth }}
            >
              <div className="px-3 py-2 sticky left-0 z-30 bg-slate-100 border-r border-slate-200 text-left text-sm">
                Sites
              </div>
              {days.map((d, idx) => (
                <div
                  key={idx}
                  className={`px-2 py-2 text-center border-r border-slate-200 relative ${d.isToday
                    ? "bg-blue-100 font-bold text-blue-900"
                    : d.weekend
                      ? "bg-slate-100"
                      : "bg-slate-50"
                    }`}
                >
                  {d.isToday && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-blue-600" />
                  )}
                  {d.label}
                  {d.isToday && (
                    <div className="text-[10px] text-blue-600 font-normal">Today</div>
                  )}
                </div>
              ))}
            </div>

            <div className="divide-y divide-slate-200">
              {(sitesQuery.data || [])
                .filter(site => siteTypeFilter === "all" || site.siteType === siteTypeFilter)
                .filter(site => !showConflictsOnly || ((blackoutsQuery.data || []).some((b) => {
                  const bStart = new Date(b.startDate);
                  const bEnd = new Date(b.endDate);
                  bStart.setHours(0, 0, 0, 0);
                  bEnd.setHours(0, 0, 0, 0);
                  const overlaps = bEnd > start && bStart < visibleEnd;
                  const matchesSite = !b.siteId || b.siteId === site.id;
                  return overlaps && matchesSite;
                }) || (filteredReservations.filter((r) => r.siteId === site.id && r.status !== "cancelled").length > 1)))
                .map((site, rowIdx) => {
                  const allSiteReservations = filteredReservations.filter((r) => r.siteId === site.id);
                  const siteReservations = statusFilter === "all"
                    ? allSiteReservations
                    : allSiteReservations.filter(r => r.status === statusFilter);
                  const zebra = rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50";

                  // Per-site helpers for visible window
                  const visibleEnd = new Date(start);
                  visibleEnd.setDate(visibleEnd.getDate() + dayCount);
                  const visibleReservations = allSiteReservations.filter((res) => {
                    const resStart = new Date(res.arrivalDate);
                    const resEnd = new Date(res.departureDate);
                    return resEnd > start && resStart < visibleEnd && res.status !== "cancelled";
                  });
                  const occupiedNights = visibleReservations.reduce((sum, res) => {
                    const resStart = new Date(res.arrivalDate);
                    const resEnd = new Date(res.departureDate);
                    const overlapStart = resStart > start ? resStart : start;
                    const overlapEnd = resEnd < visibleEnd ? resEnd : visibleEnd;
                    const nights = Math.max(0, diffInDays(overlapEnd, overlapStart));
                    return sum + nights;
                  }, 0);
                  const nextArrival = allSiteReservations
                    .filter((res) => {
                      const resStart = new Date(res.arrivalDate);
                      return resStart >= start && resStart < visibleEnd && res.status !== "cancelled";
                    })
                    .sort((a, b) => new Date(a.arrivalDate).getTime() - new Date(b.arrivalDate).getTime())[0];
                  let blackoutStart: Date | null = null;
                  const hasBlackout = (blackoutsQuery.data || []).some((b) => {
                    const bStart = new Date(b.startDate);
                    const bEnd = new Date(b.endDate);
                    bStart.setHours(0, 0, 0, 0);
                    bEnd.setHours(0, 0, 0, 0);
                    const overlaps = bEnd > start && bStart < visibleEnd;
                    const matchesSite = !b.siteId || b.siteId === site.id;
                    if (overlaps && matchesSite) {
                      if (!blackoutStart || bStart < blackoutStart) blackoutStart = bStart;
                      return true;
                    }
                    return false;
                  });
                  let firstOverlapDate: Date | null = null;
                  const hasOverlap = (() => {
                    const sorted = [...allSiteReservations].sort(
                      (a, b) => new Date(a.arrivalDate).getTime() - new Date(b.arrivalDate).getTime()
                    );
                    for (let i = 1; i < sorted.length; i++) {
                      const prevEnd = new Date(sorted[i - 1].departureDate);
                      const curStart = new Date(sorted[i].arrivalDate);
                      if (curStart < prevEnd && sorted[i].status !== "cancelled" && sorted[i - 1].status !== "cancelled") {
                        // overlap in visible window?
                        const overlapStart = curStart > start ? curStart : start;
                        const overlapEnd = prevEnd < visibleEnd ? prevEnd : visibleEnd;
                        if (overlapEnd > overlapStart) {
                          firstOverlapDate = overlapStart;
                          return true;
                        }
                      }
                    }
                    return false;
                  })();
                  const conflictDate = (() => {
                    const dates = [blackoutStart, firstOverlapDate].filter(Boolean) as Date[];
                    if (!dates.length) return null;
                    return dates.sort((a, b) => a.getTime() - b.getTime())[0];
                  })();
                  const conflictCount = (hasBlackout ? 1 : 0) + (hasOverlap ? 1 : 0);

                  const siteMaintenance = (maintenanceQuery.data || []).filter((m) => m.siteId === site.id);
                  const hasMaintenance = siteMaintenance.length > 0;
                  const cleaningStatus = site.housekeepingStatus || "clean";
                  const cleaningTask = findHousekeepingTask(site.id);
                  const cleaningLabel =
                    cleaningStatus === "dirty"
                      ? "Dirty"
                      : cleaningStatus === "inspecting"
                        ? "Cleaning"
                        : "Clean";
                  const cleaningClasses =
                    cleaningStatus === "dirty"
                      ? "border-rose-400 bg-rose-50 text-rose-700"
                      : cleaningStatus === "inspecting"
                        ? "border-cyan-400 bg-cyan-50 text-cyan-700"
                        : "border-emerald-300 bg-emerald-50 text-emerald-700";

                  return (
                    <div
                      key={site.id}
                      className={`grid relative group ${showConflictsOnly && !hasBlackout && !hasOverlap ? "opacity-50" : ""}`}
                      style={{ gridTemplateColumns: gridTemplate, minWidth: gridMinWidth }}
                    >
                      <div
                        className={`px-3 py-2 sticky left-0 z-20 border-r border-slate-200 ${zebra}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 truncate" title={site.name}>{site.name}</div>
                            <div className="text-xs text-slate-600 truncate">
                              {site.siteType} • Max {site.maxOccupancy} ppl
                            </div>
                          </div>
                          <div className="flex gap-1 flex-wrap opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
                            {cleaningStatus === "clean" && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!allowOps || updateHousekeepingMutation.isPending || createTaskMutation.isPending}
                                onClick={() => markDirty(site.id)}
                                className="h-7 px-2 text-[11px]"
                              >
                                Mark dirty
                              </Button>
                            )}
                            {cleaningStatus === "dirty" && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!allowOps || updateHousekeepingMutation.isPending || updateTaskMutation.isPending}
                                onClick={() => startCleaning(site.id)}
                                className="h-7 px-2 text-[11px]"
                              >
                                Start cleaning
                              </Button>
                            )}
                            {cleaningStatus === "inspecting" && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-7 px-2 text-[11px] bg-cyan-600 hover:bg-cyan-700"
                                disabled={!allowOps || updateHousekeepingMutation.isPending || updateTaskMutation.isPending}
                                onClick={() => markClean(site.id)}
                              >
                                Mark clean
                              </Button>
                            )}
                            {!allowOps && (
                              <span className="text-[11px] text-amber-700 px-2 py-1 rounded border border-amber-200 bg-amber-50">
                                Ops locked
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                          {(hasBlackout || hasOverlap) && (
                            <span className="inline-flex items-center gap-1 rounded border border-amber-400 bg-amber-50 px-1.5 py-[2px] text-[11px] text-amber-800">
                              <Clock className="h-3 w-3" /> {hasBlackout ? "Blackout in view" : "Potential overlap"}
                            </span>
                          )}
                          {hasMaintenance ? (
                            <span className="inline-flex items-center gap-1 rounded border border-amber-500 bg-amber-50 px-1.5 py-[2px] text-[11px] text-amber-700">
                              <Wrench className="h-3 w-3" /> Maint open
                            </span>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 rounded px-1.5 py-[2px] text-[11px] ${cleaningClasses}`}
                              title={cleaningTask?.description || undefined}
                            >
                              <Sparkles className="h-3 w-3" /> {cleaningLabel}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-[2px]">
                            <Calendar className="h-3 w-3" />
                            {nextArrival
                              ? `Arrives ${new Date(nextArrival.arrivalDate).toLocaleDateString(undefined, { weekday: "short" })} · ${Math.max(
                                1,
                                diffInDays(new Date(nextArrival.departureDate), new Date(nextArrival.arrivalDate))
                              )}n`
                              : "No arrivals in view"}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-[2px]">
                            <Tent className="h-3 w-3" />
                            {occupiedNights}/{dayCount} nights
                          </span>
                          {conflictCount > 0 && (
                            <button
                              className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-1.5 py-[2px] text-[11px] text-amber-800"
                              onClick={() => {
                                if (conflictDate) {
                                  setStartDate(formatLocalDateInput(conflictDate));
                                }
                              }}
                            >
                              <Clock className="h-3 w-3" /> {conflictCount} conflict{conflictCount > 1 ? "s" : ""}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="relative" style={{ gridColumn: "2 / -1" }}>
                        <div className="grid" style={{ gridTemplateColumns: `repeat(${dayCount}, minmax(90px, 1fr))` }}>
                          {days.map((d, i) => {
                            const inSelection =
                              dragSiteId === site.id &&
                              dragStartIdx !== null &&
                              dragEndIdx !== null &&
                              i >= Math.min(dragStartIdx, dragEndIdx) &&
                              i <= Math.max(dragStartIdx, dragEndIdx);
                            const blackout = (blackoutsQuery.data || []).find((b) => {
                              const bStart = new Date(b.startDate);
                              const bEnd = new Date(b.endDate);
                              bStart.setHours(0, 0, 0, 0);
                              bEnd.setHours(0, 0, 0, 0);
                              const day = new Date(d.date);
                              day.setHours(0, 0, 0, 0);
                              const inRange = day >= bStart && day <= bEnd;
                              const matchesSite = !b.siteId || b.siteId === site.id;
                              return inRange && matchesSite;
                            });
                            const isBlackedOut = !!blackout;
                            return (
                              <div
                                key={i}
                                className={`h-12 border-r border-slate-100 select-none ${zebra} ${d.isToday ? "bg-blue-50/50 border-l-2 border-l-blue-400" :
                                  d.weekend ? "bg-slate-100" : ""
                                  } ${inSelection ? "bg-emerald-100 border-emerald-300" : ""} ${isBlackedOut ? "cursor-not-allowed" : "cursor-pointer"}`}
                                style={isBlackedOut ? {
                                  background: "repeating-linear-gradient(45deg, #fecaca, #fecaca 4px, #fee2e2 4px, #fee2e2 8px)"
                                } : undefined}
                                onMouseDown={() => !isBlackedOut && handleMouseDown(site.id, i)}
                                onMouseEnter={() => handleMouseEnter(i)}
                                onMouseUp={() => !isBlackedOut && handleMouseUp(site.id, i)}
                                title={isBlackedOut ? `Blocked: ${blackout?.reason || "Blackout"} (${blackout?.startDate?.slice(0, 10)} → ${blackout?.endDate?.slice(0, 10)})` : undefined}
                              />
                            );
                          })}
                        </div>
                        <div
                          className="grid absolute inset-0 items-stretch auto-rows-fr"
                          style={{ gridTemplateColumns: `repeat(${dayCount}, minmax(90px, 1fr))`, pointerEvents: "none" }}
                        >
                          {selectionActive &&
                            dragSiteId === site.id &&
                            dragStartIdx !== null &&
                            dragEndIdx !== null &&
                            (() => {
                              const selStart = Math.min(dragStartIdx, dragEndIdx);
                              const selEnd = Math.max(dragStartIdx, dragEndIdx) + 1;
                              const span = Math.max(1, selEnd - selStart);
                              return (
                                <div
                                  key="selection-pill-active"
                                  className="rounded-md text-xs text-white shadow-sm flex items-center px-2 overflow-hidden bg-emerald-600 h-full w-full self-stretch"
                                  style={{
                                    gridColumn: `${selStart + 1} / span ${span}`,
                                    pointerEvents: "none",
                                    zIndex: 5,
                                    height: "100%"
                                  }}
                                >
                                  <span className="truncate">Selecting…</span>
                                </div>
                              );
                            })()}
                          {selection &&
                            selection.siteId === site.id &&
                            (() => {
                              const selStartIdx = Math.max(0, diffInDays(toLocalDate(selection.arrival), start));
                              const selEndIdx = Math.min(dayCount, diffInDays(toLocalDate(selection.departure), start));
                              if (selEndIdx <= 0 || selStartIdx >= dayCount) return null;
                              const span = Math.max(1, selEndIdx - selStartIdx);
                              return (
                                <div
                                  key="selection-pill-stored"
                                  className="rounded-md text-xs text-white shadow-sm flex items-center px-2 overflow-hidden bg-purple-600 h-full w-full self-stretch"
                                  style={{
                                    gridColumn: `${selStartIdx + 1} / span ${span}`,
                                    pointerEvents: "none",
                                    zIndex: 4,
                                    height: "100%"
                                  }}
                                >
                                  <span className="truncate">Selected</span>
                                </div>
                              );
                            })()}
                          {siteReservations.map((res) => {
                            const conflictHit = conflicts.some((c) => c.a?.id === res.id || c.b?.id === res.id);
                            const resStart = toLocalDate(res.arrivalDate);
                            const resEnd = toLocalDate(res.departureDate);
                            const startIdx = Math.max(0, diffInDays(resStart, start));
                            const endIdx = Math.min(dayCount, diffInDays(resEnd, start));
                            if (endIdx <= 0 || startIdx >= dayCount) return null;
                            const span = Math.max(1, endIdx - startIdx);
                            const statusColor =
                              res.status === "confirmed"
                                ? "bg-emerald-600"
                                : res.status === "checked_in"
                                  ? "bg-blue-600"
                                  : res.status === "cancelled"
                                    ? "bg-rose-500"
                                    : "bg-amber-500";
                            const guestName = `${(res as any).guest?.primaryFirstName || ""} ${(res as any).guest?.primaryLastName || ""}`.trim();
                            const total = (res.totalAmount ?? 0) / 100;
                            const nights = Math.max(1, endIdx - startIdx);
                            const adr = nights > 0 ? total / nights : total;
                            return (
                              <div
                                key={res.id}
                                className={`rounded-md text-xs text-white shadow-sm flex items-center px-2 overflow-hidden ${statusColor} ${ganttSelection.highlightedId === res.id ? "ring-2 ring-amber-300" : ""
                                  }`}
                                style={{
                                  gridColumn: `${startIdx + 1} / span ${span}`,
                                  minWidth: `${span * 90}px`,
                                  pointerEvents: "auto",
                                  height: "100%"
                                }}
                                title={`${guestName || "Guest"} • ${res.arrivalDate} → ${res.departureDate} • $${total.toFixed(
                                  2
                                )} (${adr.toFixed(2)}/night)`}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  setDragSiteId(site.id);
                                  setDragStartIdx(startIdx);
                                  setDragEndIdx(startIdx);
                                  setIsDragging(true);
                                  setStoreSelection({ highlightedId: res.id, openDetailsId: res.id });
                                }}
                                onMouseUp={(e) => {
                                  e.stopPropagation();
                                  if (isDragging && dragStartIdx !== null) {
                                    handleMouseUp(site.id, startIdx);
                                  }
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedReservation(res);
                                  setQuickActionRes(res.id);
                                  setQuickActionAnchor(res.id);
                                  setShowPopover(res.id);
                                }}
                                data-res-id={res.id}
                              >
                                <span className="truncate flex items-center gap-1">
                                  {guestName || "Guest"} — {res.status.replace("_", " ")}
                                  {conflictHit && <AlertTriangle className="h-3.5 w-3.5 text-amber-100" />}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              {sitesQuery.data?.length === 0 && (
                <div className="px-4 py-12 text-center text-slate-600">
                  <div className="text-3xl mb-2">🏕️</div>
                  <p className="text-sm font-medium">No sites configured</p>
                  <p className="text-xs text-slate-500 mt-1">Add sites to this campground to start managing reservations</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Inspector + quick actions */}
        <div className="hidden xl:block fixed right-6 top-28 w-96 z-40 space-y-3">
          {selectedReservation ? (() => {
            const res = selectedReservation;
            const guestName = `${res.guest?.primaryFirstName || ""} ${res.guest?.primaryLastName || ""}`.trim() || "Guest";
            const total = (res.totalAmount ?? 0) / 100;
            const nights = diffInDays(toLocalDate(res.departureDate), toLocalDate(res.arrivalDate));
            const requiredDeposit =
              selectedCampgroundDetails && res.totalAmount
                ? computeDepositDue({
                  total: res.totalAmount / 100,
                  nights,
                  arrivalDate: res.arrivalDate,
                  depositRule: selectedCampgroundDetails.depositRule,
                  depositPercentage: selectedCampgroundDetails.depositPercentage ?? null,
                  depositConfig: (selectedCampgroundDetails as any)?.depositConfig ?? null
                })
                : 0;
            const statusColors: Record<string, string> = {
              confirmed: "bg-emerald-100 text-emerald-800",
              checked_in: "bg-blue-100 text-blue-800",
              pending: "bg-amber-100 text-amber-800",
              cancelled: "bg-rose-100 text-rose-800"
            };
            const cleaningStatus =
              sitesQuery.data?.find((s) => s.id === res.siteId)?.housekeepingStatus || "clean";
            const cleaningTask = findHousekeepingTask(res.siteId);
            const resBlackout = (blackoutsQuery.data || []).find((b) => {
              const bStart = new Date(b.startDate);
              const bEnd = new Date(b.endDate);
              bStart.setHours(0, 0, 0, 0);
              bEnd.setHours(0, 0, 0, 0);
              const arr = new Date(res.arrivalDate);
              const dep = new Date(res.departureDate);
              return dep > bStart && arr < bEnd && (!b.siteId || b.siteId === res.siteId);
            });
            const resOverlap = (() => {
              const siteRes = (reservationsQuery.data || []).filter((r) => r.siteId === res.siteId && r.id !== res.id && r.status !== "cancelled");
              return siteRes.find((r) => {
                const arr = new Date(r.arrivalDate);
                const dep = new Date(r.departureDate);
                const resArr = new Date(res.arrivalDate);
                const resDep = new Date(res.departureDate);
                return dep > resArr && arr < resDep;
              });
            })();
            return (
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{guestName}</div>
                    <div className="text-xs text-slate-600">Reservation inspector</div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-[11px] font-medium capitalize ${statusColors[res.status] || "bg-slate-100"}`}>
                    {res.status?.replace("_", " ")}
                  </span>
                </div>
                {(resBlackout || resOverlap) && (
                  <div className="flex flex-wrap gap-2">
                    {resBlackout && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                        <Clock className="h-3 w-3" /> Blackout: {resBlackout.reason || "Unavailable"}
                      </span>
                    )}
                    {resOverlap && (
                      <button
                        className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-2 py-1 text-[11px] text-rose-800"
                        onClick={() => {
                          const arrIdx = Math.max(0, diffInDays(new Date(resOverlap.arrivalDate), start));
                          const elem = document.querySelector(`[data-res-id="${resOverlap.id}"]`) as HTMLElement | null;
                          if (elem) elem.scrollIntoView({ behavior: "smooth", block: "center" });
                          setStoreSelection({ highlightedId: resOverlap.id, openDetailsId: resOverlap.id });
                          setStartDate(formatLocalDateInput(new Date(resOverlap.arrivalDate)));
                          // ensure date range covers
                          setDayCount((prev) => Math.max(prev, Math.max(14, diffInDays(new Date(resOverlap.departureDate), start) + 1)));
                        }}
                      >
                        <Clock className="h-3 w-3" /> Overlap with {(resOverlap as any).guest?.primaryLastName || resOverlap.id}
                      </button>
                    )}
                  </div>
                )}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Site</span>
                    <span className="font-medium">{res.site?.name || res.site?.siteNumber || res.siteId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Dates</span>
                    <span className="font-medium">{toLocalDate(res.arrivalDate).toLocaleDateString()} → {toLocalDate(res.departureDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Nights</span>
                    <span className="font-medium">{nights}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Deposit</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${(res.paidAmount ?? 0) / 100 >= requiredDeposit
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                        }`}
                    >
                      {(res.paidAmount ?? 0) / 100 >= requiredDeposit
                        ? "Deposit covered"
                        : `Deposit due $${Math.max(0, requiredDeposit - (res.paidAmount ?? 0) / 100).toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total</span>
                    <span className="font-bold text-emerald-700">${total.toFixed(2)}</span>
                  </div>
                </div>
                {requiredDeposit > 0 && (res.paidAmount ?? 0) / 100 < requiredDeposit && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      localStorage.setItem("campreserv:openReservationId", res.id);
                      window.location.href = `/campgrounds/${selectedCampground}/reservations/${res.id}`;
                    }}
                  >
                    Collect deposit
                  </Button>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => {
                      localStorage.setItem("campreserv:openReservationId", res.id);
                      window.location.href = `/campgrounds/${selectedCampground}/reservations/${res.id}`;
                    }}
                  >
                    Open details
                  </Button>
                  {res.status === "confirmed" && (
                    <Button
                      size="sm"
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                      onClick={() => {
                        apiClient.checkInReservation(res.id).then(() => {
                          queryClient.invalidateQueries({ queryKey: ["calendar-reservations", selectedCampground] });
                          setSelectedReservation(null);
                        });
                      }}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Check in
                    </Button>
                  )}
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-slate-700 uppercase">Communications</div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs"
                      onClick={() => {
                        localStorage.setItem("campreserv:openReservationId", res.id);
                        window.location.href = "/messages";
                      }}
                    >
                      View all
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    {(["all", "messages", "notes", "failed"] as const).map((f) => (
                      <button
                        key={f}
                        className={`rounded-full border px-2 py-1 ${commsFilter === f ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600"}`}
                        onClick={() => setCommsFilter(f)}
                      >
                        {f === "failed" ? "Failed" : f === "messages" ? "Messages" : f[0].toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                    <Button size="sm" variant="ghost" className="text-[11px]" onClick={() => setCommsFilter("failed")}>
                      Failed only
                    </Button>
                  </div>
                  {(() => {
                    const comms = (commsByRes[res.id] || []).filter((c: any) => {
                      if (commsFilter === "notes") return (c.type || "").toLowerCase() === "note";
                      if (commsFilter === "messages") return (c.type || "").toLowerCase() !== "note";
                      if (commsFilter === "failed") {
                        const s = (c.status || "").toLowerCase();
                        return s.includes("fail") || s.includes("bounce") || s.includes("error");
                      }
                      return true;
                    });
                    if (commsErrors[res.id]) {
                      return <div className="text-xs text-rose-700">Failed to load messages.</div>;
                    }
                    if (commsLoading[res.id]) {
                      return <div className="text-xs text-slate-500">Loading…</div>;
                    }
                    if (!comms.length) {
                      return <div className="text-xs text-slate-500">No messages yet.</div>;
                    }
                    return (
                      <div className="space-y-1">
                        {comms.slice(0, 5).map((c: any) => (
                          <div key={c.id} className="flex items-center justify-between rounded border border-slate-200 bg-white px-2 py-1 text-xs">
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-slate-900 truncate">
                                {c.subject || c.type || "Message"}
                              </span>
                              <span className="text-[11px] text-slate-500 truncate">
                                {c.createdAt ? new Date(c.createdAt).toLocaleString() : ""}
                              </span>
                            </div>
                            <span
                              className={`text-[11px] uppercase px-2 py-0.5 rounded-full ${(c.status || "").toLowerCase().includes("fail") || (c.status || "").toLowerCase().includes("bounce")
                                ? "bg-rose-100 text-rose-700 border border-rose-200"
                                : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                }`}
                            >
                              {(c.status || "").toString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1"
                      onClick={() => {
                        setStoreSelection({ highlightedId: res.id, openDetailsId: res.id });
                        setSelectedReservation(res);
                        localStorage.setItem("campreserv:openReservationId", res.id);
                        window.location.href = "/messages";
                      }}
                    >
                      Message guest
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        localStorage.setItem("campreserv:openReservationId", res.id);
                        window.location.href = `/campgrounds/${selectedCampground}/reservations/${res.id}`;
                      }}
                    >
                      Open in Reservations
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-700">Cleaning</div>
                  <div className="text-xs text-slate-500">
                    Status: <span className="font-medium capitalize">{cleaningStatus.replace("_", " ")}</span>
                    {cleaningTask ? ` • Task: ${cleaningTask.status.replace("_", " ")}` : ""}
                  </div>
                  {cleaningStatus === "clean" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!allowOps || updateHousekeepingMutation.isPending || createTaskMutation.isPending}
                      onClick={() => markDirty(res.siteId)}
                    >
                      Mark dirty
                    </Button>
                  )}
                  {cleaningStatus === "dirty" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!allowOps || updateHousekeepingMutation.isPending || updateTaskMutation.isPending}
                      onClick={() => startCleaning(res.siteId)}
                    >
                      Start cleaning
                    </Button>
                  )}
                  {cleaningStatus === "inspecting" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="bg-cyan-600 hover:bg-cyan-700"
                      disabled={!allowOps || updateHousekeepingMutation.isPending || updateTaskMutation.isPending}
                      onClick={() => markClean(res.siteId)}
                    >
                      Mark clean
                    </Button>
                  )}
                  {!allowOps && (
                    <div className="text-xs text-amber-700">
                      Operations tasks are disabled for your account or campground.
                    </div>
                  )}
                </div>
                <Button variant="ghost" size="sm" className="w-full" onClick={() => setSelectedReservation(null)}>
                  Close inspector
                </Button>
              </div>
            );
          })() : selection ? (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Selection</div>
                  <div className="text-xs text-slate-600">{quotePreview?.siteName || selection.siteId}</div>
                </div>
                <span className="rounded-full bg-purple-100 text-purple-800 px-2 py-1 text-[11px] font-medium">Draft</span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Check-in</span>
                  <span className="font-medium">{selection.arrival}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Check-out</span>
                  <span className="font-medium">{selection.departure}</span>
                </div>
                {quotePreview && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Nights</span>
                      <span className="font-medium">{quotePreview.nights}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Base</span>
                      <span className="font-medium">${quotePreview.base.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Rules/adjust</span>
                      <span className="font-medium">${quotePreview.rulesDelta.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Avg / night</span>
                      <span className="font-medium">${quotePreview.perNight.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-2">
                      <span className="text-slate-500">Total</span>
                      <span className="font-bold text-emerald-700">${quotePreview.total.toFixed(2)}</span>
                    </div>
                    {quoteDepositDue !== null && (
                      <div className="text-xs text-slate-600 bg-slate-50 rounded-md p-2">
                        Deposit due now: ${quoteDepositDue.toFixed(2)}
                        {quotePreview.depositRule ? ` • Rule: ${quotePreview.depositRule}` : ""}
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="space-y-2">
                <Button
                  size="sm"
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => {
                    localStorage.setItem(
                      "campreserv:pendingSelection",
                      JSON.stringify({ campgroundId: selectedCampground, ...selection })
                    );
                    window.location.href = `/campgrounds/${selectedCampground}/reservations?action=create`;
                  }}
                >
                  Create reservation →
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full"
                  onClick={handleCreateHold}
                  disabled={holdStatus.state === "loading"}
                >
                  {holdStatus.state === "loading" ? "Placing hold..." : "Place 15-min hold"}
                </Button>
                {holdStatus.state === "success" && (
                  <div className="text-xs text-emerald-700 bg-emerald-50 rounded-md p-2">{holdStatus.message}</div>
                )}
                {holdStatus.state === "error" && (
                  <div className="text-xs text-rose-700 bg-rose-50 rounded-md p-2">{holdStatus.message}</div>
                )}
              </div>
              <Button variant="ghost" size="sm" className="w-full" onClick={clearSelection}>
                Clear selection
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm max-w-md">
              <div className="font-semibold text-slate-900 mb-2">Calendar tips</div>
              <ul className="list-disc pl-4 space-y-1.5">
                <li>Drag to select dates or move reservations.</li>
                <li>Use ← → ↑ ↓ to navigate quickly.</li>
                <li>Filter by status or site type to declutter.</li>
                <li>Selections will show live quotes and holds here.</li>
              </ul>
            </div>
          )}
        </div>

        {/* Extension confirmation */}
        <Dialog open={!!extendPrompt} onOpenChange={() => setExtendPrompt(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Confirm extension</DialogTitle>
            </DialogHeader>
            {extendPrompt && (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Arrival</span>
                  <span className="font-medium">{extendPrompt.arrivalDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">New departure</span>
                  <span className="font-medium">{extendPrompt.departureDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">New total</span>
                  <span className="font-semibold">${(extendPrompt.totalCents / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="text-slate-500">Amount to collect</span>
                  <span className="font-bold text-emerald-700">${(extendPrompt.deltaCents / 100).toFixed(2)}</span>
                </div>
                <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
                  Confirming will extend the stay and take you to payment collection.
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    size="sm"
                    onClick={() => setExtendPrompt(null)}
                    disabled={isExtendSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    size="sm"
                    onClick={async () => {
                      if (!extendPrompt) return;
                      setIsExtendSubmitting(true);
                      try {
                        await moveMutation.mutateAsync({
                          id: extendPrompt.reservation.id,
                          siteId: extendPrompt.reservation.siteId,
                          arrivalDate: extendPrompt.arrivalDate,
                          departureDate: extendPrompt.departureDate
                        });
                        recordMetric("calendar.extend.confirmed", {
                          reservationId: extendPrompt.reservation.id,
                          deltaCents: extendPrompt.deltaCents
                        });
                        setExtendPrompt(null);
                        window.location.href = `/campgrounds/${selectedCampground}/reservations/${extendPrompt.reservation.id}?action=payment`;
                      } catch (err) {
                        recordError("reservation.extend.apply", err);
                        setSelectionError("Extension failed. Please retry.");
                      } finally {
                        setIsExtendSubmitting(false);
                      }
                    }}
                    disabled={isExtendSubmitting}
                  >
                    {isExtendSubmitting ? "Extending..." : `Confirm & collect $${(extendPrompt.deltaCents / 100).toFixed(2)}`}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Move confirmation when price increases */}
        <Dialog open={!!pendingMove} onOpenChange={() => setPendingMove(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Confirm move</DialogTitle>
            </DialogHeader>
            {pendingMove && (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">New site</span>
                  <span className="font-medium">{pendingMove.siteId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Dates</span>
                  <span className="font-medium">
                    {pendingMove.arrivalDate} → {pendingMove.departureDate}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Current total</span>
                  <span className="font-medium">${(pendingMove.currentTotalCents / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">New total</span>
                  <span className="font-semibold">${(pendingMove.quoteTotalCents / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="text-slate-500">Additional amount</span>
                  <span className="font-bold text-amber-700">+${(pendingMove.deltaCents / 100).toFixed(2)}</span>
                </div>
                <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
                  Confirm to move and collect the difference. You can also choose to keep the original price.
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    size="sm"
                    onClick={() => setPendingMove(null)}
                    disabled={isMoveSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    size="sm"
                    onClick={async () => {
                      if (!pendingMove) return;
                      setIsMoveSubmitting(true);
                      try {
                        await moveMutation.mutateAsync({
                          id: pendingMove.reservation.id,
                          siteId: pendingMove.siteId,
                          arrivalDate: pendingMove.arrivalDate,
                          departureDate: pendingMove.departureDate
                        });
                        recordMetric("calendar.move.confirmed.pay_extra", {
                          reservationId: pendingMove.reservation.id,
                          deltaCents: pendingMove.deltaCents
                        });
                        setPendingMove(null);
                      } catch (err) {
                        recordError("reservation.move.apply", err);
                        setSelectionError("Move failed. Please retry.");
                      } finally {
                        setIsMoveSubmitting(false);
                      }
                    }}
                    disabled={isMoveSubmitting}
                  >
                    {isMoveSubmitting ? "Moving..." : `Confirm & collect $${(pendingMove.deltaCents / 100).toFixed(2)}`}
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={async () => {
                    if (!pendingMove) return;
                    setIsMoveSubmitting(true);
                    try {
                      await moveMutation.mutateAsync({
                        id: pendingMove.reservation.id,
                        siteId: pendingMove.siteId,
                        arrivalDate: pendingMove.arrivalDate,
                        departureDate: pendingMove.departureDate
                      });
                      recordMetric("calendar.move.override_price", {
                        reservationId: pendingMove.reservation.id,
                        deltaCents: pendingMove.deltaCents
                      });
                      setPendingMove(null);
                    } catch (err) {
                      recordError("reservation.move.apply", err);
                      setSelectionError("Move failed. Please retry.");
                    } finally {
                      setIsMoveSubmitting(false);
                    }
                  }}
                  disabled={isMoveSubmitting}
                >
                  Keep original price (override)
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Error/Warning Toasts - Fixed Overlay */}
        {(selectionError || selectionConflict) && (
          <div className="fixed bottom-6 right-6 z-50 max-w-md space-y-2 animate-in slide-in-from-bottom-2">
            {selectionError && (
              <div className="rounded-lg border-2 border-amber-500 bg-amber-50 px-4 py-3 shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm text-amber-800">{selectionError}</div>
                  <button
                    onClick={() => setSelectionError(null)}
                    className="text-amber-600 hover:text-amber-800 text-xs font-medium"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
            {selectionConflict && (
              <div className="rounded-lg border-2 border-rose-500 bg-rose-50 px-4 py-3 shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm text-rose-700">{selectionConflict}</div>
                  <button
                    onClick={() => setSelectionConflict(null)}
                    className="text-rose-600 hover:text-rose-800 text-xs font-medium"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reservation Detail Dialog */}
        <Dialog open={!!selectedReservation} onOpenChange={() => setSelectedReservation(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Reservation Details
              </DialogTitle>
            </DialogHeader>
            {selectedReservation && (() => {
              const res = selectedReservation;
              const guestName = `${res.guest?.primaryFirstName || ""} ${res.guest?.primaryLastName || ""}`.trim() || "Guest";
              const total = (res.totalAmount ?? 0) / 100;
              const nights = diffInDays(new Date(res.departureDate), new Date(res.arrivalDate));
              const statusColors: Record<string, string> = {
                confirmed: "bg-emerald-100 text-emerald-800",
                checked_in: "bg-blue-100 text-blue-800",
                pending: "bg-amber-100 text-amber-800",
                cancelled: "bg-rose-100 text-rose-800"
              };
              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-semibold text-slate-900">{guestName}</div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${statusColors[res.status] || "bg-slate-100"}`}>
                      {res.status?.replace("_", " ")}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-slate-500">Check-in</div>
                      <div className="font-medium">{new Date(res.arrivalDate).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Check-out</div>
                      <div className="font-medium">{new Date(res.departureDate).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Nights</div>
                      <div className="font-medium">{nights}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Total</div>
                      <div className="font-bold text-emerald-600">${total.toFixed(2)}</div>
                    </div>
                    {res.guest?.email && (
                      <div className="col-span-2">
                        <div className="text-slate-500">Email</div>
                        <div className="font-medium">{res.guest.email}</div>
                      </div>
                    )}
                    {res.guest?.phone && (
                      <div className="col-span-2">
                        <div className="text-slate-500">Phone</div>
                        <div className="font-medium">{res.guest.phone}</div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSplitReservation(res);
                        const nights = diffInDays(new Date(res.departureDate), new Date(res.arrivalDate));
                        const midDate = new Date(res.arrivalDate);
                        midDate.setDate(midDate.getDate() + Math.floor(nights / 2));
                        setSplitSegments([
                          { siteId: res.siteId || '', startDate: res.arrivalDate.slice(0, 10), endDate: midDate.toISOString().slice(0, 10) },
                          { siteId: '', startDate: midDate.toISOString().slice(0, 10), endDate: res.departureDate.slice(0, 10) }
                        ]);
                        setSplitModalOpen(true);
                        setSelectedReservation(null);
                      }}
                    >
                      Split Stay
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1"
                      onClick={() => {
                        window.location.href = `/campgrounds/${selectedCampground}/reservations/${res.id}`;
                      }}
                    >
                      View Full Details
                    </Button>
                    {res.status === "confirmed" && (
                      <Button
                        size="sm"
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                        onClick={() => {
                          apiClient.checkInReservation(res.id).then(() => {
                            queryClient.invalidateQueries({ queryKey: ["calendar-reservations", selectedCampground] });
                            setSelectedReservation(null);
                          });
                        }}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Check In
                      </Button>
                    )}
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        {qaRes && (
          <div className="fixed bottom-6 right-6 z-40 max-w-sm rounded-lg border border-slate-200 bg-white shadow-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {qaRes.guest?.primaryFirstName} {qaRes.guest?.primaryLastName}
                </div>
                <div className="text-xs text-slate-500">
                  {qaRes.arrivalDate?.slice(0, 10)} → {qaRes.departureDate?.slice(0, 10)}
                </div>
              </div>
              <button
                className="text-slate-400 hover:text-slate-600"
                onClick={() => {
                  setQuickActionAnchor(null);
                  setQuickActionRes(null);
                }}
                aria-label="Close quick actions"
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={quickActionLoading}
                onClick={() => setSelectedReservation(qaRes)}
              >
                Open
              </Button>
              {qaRes.status === "checked_in" ? (
                <Button
                  size="sm"
                  disabled={quickActionLoading}
                  onClick={async () => {
                    setQuickActionLoading(true);
                    try {
                      await apiClient.checkOutReservation(qaRes.id);
                      await queryClient.invalidateQueries({ queryKey: ["calendar-reservations", selectedCampground] });
                    } finally {
                      setQuickActionLoading(false);
                    }
                  }}
                >
                  Check Out
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={quickActionLoading}
                  onClick={async () => {
                    setQuickActionLoading(true);
                    try {
                      await apiClient.checkInReservation(qaRes.id);
                      await queryClient.invalidateQueries({ queryKey: ["calendar-reservations", selectedCampground] });
                    } finally {
                      setQuickActionLoading(false);
                    }
                  }}
                >
                  Check In
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => {
                  localStorage.setItem("campreserv:openReservationId", qaRes.id);
                  window.location.href = "/messages";
                }}
              >
                <Mail className="h-4 w-4" />
                Message
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => {
                  setPayAmount(Math.max(0, (qaRes.balanceAmount ?? 0) / 100));
                  setPayModalOpen(true);
                }}
              >
                <CreditCard className="h-4 w-4" />
                Collect
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="col-span-2"
                onClick={() => {
                  setSelection({
                    siteId: qaRes.siteId,
                    arrival: qaRes.arrivalDate,
                    departure: qaRes.departureDate
                  });
                  setStoreSelection({ highlightedId: qaRes.id, openDetailsId: qaRes.id });
                  setQuickActionAnchor(null);
                }}
              >
                Highlight / Reassign
              </Button>
            </div>
          </div>
        )}

        <Dialog open={payModalOpen} onOpenChange={setPayModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Collect Payment</DialogTitle>
            </DialogHeader>
            {qaRes ? (
              <div className="space-y-3">
                <div className="text-sm text-slate-600">
                  {qaRes.guest?.primaryFirstName} {qaRes.guest?.primaryLastName} · Balance ${(qaRes.balanceAmount ?? 0) / 100}
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">Amount</label>
                  <input
                    type="number"
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                    min={0}
                    step={1}
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                  />
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={async () => {
                    await apiClient.recordReservationPayment(qaRes.id, Math.round(payAmount * 100));
                    await queryClient.invalidateQueries({ queryKey: ["calendar-reservations", selectedCampground] });
                    setPayModalOpen(false);
                  }}
                >
                  Collect
                </Button>
              </div>
            ) : (
              <div className="text-sm text-slate-500">No reservation selected.</div>
            )}
          </DialogContent>
        </Dialog>

        {showPopover && qaRes && (
          <div className="fixed bottom-28 right-6 z-50 max-w-sm rounded-lg border border-slate-200 bg-white shadow-xl p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Quick actions</div>
              <button
                className="text-slate-400 hover:text-slate-600"
                onClick={() => setShowPopover(null)}
                aria-label="Close popover"
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setSelectedReservation(qaRes);
                  setShowPopover(null);
                }}
              >
                Open
              </Button>
              {qaRes.status === "checked_in" ? (
                <Button
                  size="sm"
                  onClick={async () => {
                    await apiClient.checkOutReservation(qaRes.id);
                    await queryClient.invalidateQueries({ queryKey: ["calendar-reservations", selectedCampground] });
                    setShowPopover(null);
                  }}
                >
                  Check Out
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={async () => {
                    await apiClient.checkInReservation(qaRes.id);
                    await queryClient.invalidateQueries({ queryKey: ["calendar-reservations", selectedCampground] });
                    setShowPopover(null);
                  }}
                >
                  Check In
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => {
                  localStorage.setItem("campreserv:openReservationId", qaRes.id);
                  window.location.href = "/messages";
                }}
              >
                <Mail className="h-4 w-4" />
                Message
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => {
                  setPayAmount(Math.max(0, (qaRes.balanceAmount ?? 0) / 100));
                  setPayModalOpen(true);
                }}
              >
                <CreditCard className="h-4 w-4" />
                Collect
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="col-span-2"
                onClick={() => {
                  setSelection({
                    siteId: qaRes.siteId,
                    arrival: qaRes.arrivalDate,
                    departure: qaRes.departureDate
                  });
                  setStoreSelection({ highlightedId: qaRes.id, openDetailsId: qaRes.id });
                  setShowPopover(null);
                }}
              >
                Highlight / Reassign
              </Button>
            </div>
          </div>
        )}

        {/* Split Stay Modal */}
        <Dialog open={splitModalOpen} onOpenChange={(open) => { setSplitModalOpen(open); if (!open) setSplitReservation(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Split Stay - Multiple Sites</DialogTitle>
            </DialogHeader>
            {splitReservation && (
              <div className="space-y-4">
                <div className="text-sm text-slate-600">
                  <span className="font-medium">{splitReservation.guest?.primaryFirstName} {splitReservation.guest?.primaryLastName}</span>
                  <span className="mx-2">·</span>
                  {splitReservation.arrivalDate?.slice(0, 10)} → {splitReservation.departureDate?.slice(0, 10)}
                </div>

                <div className="space-y-3">
                  {splitSegments.map((seg, idx) => (
                    <div key={idx} className="p-3 rounded-lg border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">Segment {idx + 1}</span>
                        {splitSegments.length > 2 && (
                          <button
                            className="text-xs text-rose-500 hover:text-rose-700"
                            onClick={() => setSplitSegments(s => s.filter((_, i) => i !== idx))}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-xs text-slate-500">Site</label>
                          <select
                            className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                            value={seg.siteId}
                            onChange={(e) => setSplitSegments(s => s.map((x, i) => i === idx ? { ...x, siteId: e.target.value } : x))}
                          >
                            <option value="">Select site...</option>
                            {(sitesQuery.data || []).map((s: any) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">Start</label>
                          <input
                            type="date"
                            className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                            value={seg.startDate}
                            min={splitReservation.arrivalDate?.slice(0, 10)}
                            max={splitReservation.departureDate?.slice(0, 10)}
                            onChange={(e) => {
                              const newStart = e.target.value;
                              setSplitSegments(s => s.map((x, i) => {
                                if (i === idx) return { ...x, startDate: newStart };
                                if (i === idx - 1) return { ...x, endDate: newStart };
                                return x;
                              }));
                            }}
                            disabled={idx === 0}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">End</label>
                          <input
                            type="date"
                            className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                            value={seg.endDate}
                            min={seg.startDate}
                            max={splitReservation.departureDate?.slice(0, 10)}
                            onChange={(e) => {
                              const newEnd = e.target.value;
                              setSplitSegments(s => s.map((x, i) => {
                                if (i === idx) return { ...x, endDate: newEnd };
                                if (i === idx + 1) return { ...x, startDate: newEnd };
                                return x;
                              }));
                            }}
                            disabled={idx === splitSegments.length - 1}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    const last = splitSegments[splitSegments.length - 1];
                    const midDate = new Date(last.startDate);
                    midDate.setDate(midDate.getDate() + Math.max(1, Math.floor(diffInDays(new Date(last.endDate), new Date(last.startDate)) / 2)));
                    setSplitSegments(s => [
                      ...s.slice(0, -1),
                      { ...last, endDate: midDate.toISOString().slice(0, 10) },
                      { siteId: '', startDate: midDate.toISOString().slice(0, 10), endDate: last.endDate }
                    ]);
                  }}
                >
                  + Add Another Segment
                </Button>

                <div className="flex gap-2 pt-2 border-t">
                  <Button variant="outline" className="flex-1" onClick={() => setSplitModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={splitLoading || splitSegments.some(s => !s.siteId)}
                    onClick={async () => {
                      if (!splitReservation) return;
                      setSplitLoading(true);
                      try {
                        await apiClient.splitReservation(splitReservation.id, {
                          segments: splitSegments,
                          sendNotification: true
                        });
                        await queryClient.invalidateQueries({ queryKey: ["calendar-reservations", selectedCampground] });
                        setSplitModalOpen(false);
                        setSplitReservation(null);
                      } catch (err: any) {
                        alert(err?.message || "Failed to split reservation");
                      } finally {
                        setSplitLoading(false);
                      }
                    }}
                  >
                    {splitLoading ? "Saving..." : "Save Split"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardShell>
  );
}
