import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { useGanttStore } from "./store";
import { useWhoami } from "../../lib/auth/hooks";
import { recordError, recordMetric, startTiming } from "../../lib/telemetry";
import { computeDepositDue } from "@campreserv/shared";
import { format, parseISO } from "date-fns";
import {
    diffInDays,
    formatLocalDateInput,
    parseLocalDateInput,
    toLocalDate,
    isToday
} from "./utils";
import type {
    CalendarSite,
    CalendarReservation,
    CalendarBlackout,
    DayMeta,
    ReservationConflict,
    QuotePreview,
    HoldStatus,
    ExtendPrompt,
    CalendarViewMode,
    AssignmentFilter
} from "./types";

export function useCalendarData() {
    const queryClient = useQueryClient();
    const { selection: ganttSelection, setSelection: setStoreSelection } = useGanttStore();
    const { data: whoami } = useWhoami();

    const [selectedCampground, setSelectedCampground] = useState<string>("");
    const [startDate, setStartDate] = useState(() => formatLocalDateInput(new Date()));
    const [viewMode, setViewMode] = useState<CalendarViewMode>("week");
    const [dayCount, setDayCount] = useState(14);

    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [siteTypeFilter, setSiteTypeFilter] = useState<string>("all");
    const [channelFilter, setChannelFilter] = useState<string>("all");
    const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("all");
    const [guestSearch, setGuestSearch] = useState<string>("");
    const [arrivalsNowOnly, setArrivalsNowOnly] = useState(false);

    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const loadTimers = useRef<Record<string, number | null>>({
        campgrounds: null,
        sites: null,
        reservations: null,
        blackouts: null
    });

    // Basic Queries
    const campgroundsQuery = useQuery({
        queryKey: ["campgrounds"],
        queryFn: () => {
            loadTimers.current.campgrounds = typeof performance !== "undefined" ? performance.now() : Date.now();
            return apiClient.getCampgrounds();
        },
        staleTime: 60_000,
        refetchOnWindowFocus: false
    });

    const selectedCampgroundDetails = useMemo(
        () => campgroundsQuery.data?.find((cg) => cg.id === selectedCampground) ?? null,
        [campgroundsQuery.data, selectedCampground]
    );

    const sitesQuery = useQuery({
        queryKey: ["calendar-sites", selectedCampground],
        queryFn: () => {
            loadTimers.current.sites = typeof performance !== "undefined" ? performance.now() : Date.now();
            return apiClient.getSites(selectedCampground);
        },
        enabled: !!selectedCampground,
        staleTime: 15_000,
        refetchInterval: 60_000
    });

    const reservationsQuery = useQuery({
        queryKey: ["calendar-reservations", selectedCampground],
        queryFn: () => {
            loadTimers.current.reservations = typeof performance !== "undefined" ? performance.now() : Date.now();
            return apiClient.getReservations(selectedCampground);
        },
        enabled: !!selectedCampground,
        staleTime: 15_000,
        refetchInterval: 60_000
    });

    const blackoutsQuery = useQuery({
        queryKey: ["calendar-blackouts", selectedCampground],
        queryFn: () => {
            loadTimers.current.blackouts = typeof performance !== "undefined" ? performance.now() : Date.now();
            return apiClient.getBlackouts(selectedCampground);
        },
        enabled: !!selectedCampground,
        staleTime: 5 * 60_000,
        refetchInterval: 5 * 60_000
    });

    const maintenanceQuery = useQuery({
        queryKey: ["calendar-maintenance", selectedCampground],
        queryFn: () => apiClient.getMaintenanceTickets("open", selectedCampground),
        enabled: !!selectedCampground,
        staleTime: 60_000,
        refetchInterval: 60_000
    });

    const housekeepingTasksQuery = useQuery({
        queryKey: ["calendar-housekeeping", selectedCampground],
        queryFn: () => apiClient.listTasks(selectedCampground, { type: "housekeeping" }),
        enabled: !!selectedCampground,
        staleTime: 30_000,
        refetchInterval: 30_000
    });

    // Permissions
    const memberships = whoami?.user?.memberships ?? [];
    const hasCampgroundAccess = selectedCampground
        ? memberships.some((m: any) => m.campgroundId === selectedCampground)
        : memberships.length > 0;
    const allowOps = (whoami?.allowed?.operationsWrite ?? false) && hasCampgroundAccess;

    // Derived Data
    const start = useMemo(() => parseLocalDateInput(startDate), [startDate]);
    const visibleEnd = useMemo(() => {
        const end = new Date(start);
        end.setDate(end.getDate() + dayCount);
        return end;
    }, [start, dayCount]);

    const days: DayMeta[] = useMemo(() => {
        return Array.from({ length: dayCount }).map((_, i) => {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            const weekend = d.getDay() === 0 || d.getDay() === 6;
            const label = format(d, "MMM d");
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
        const searchLower = guestSearch.toLowerCase().trim();
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
            if (searchLower) {
                const firstName = (res.guest?.primaryFirstName || "").toLowerCase();
                const lastName = (res.guest?.primaryLastName || "").toLowerCase();
                const email = (res.guest?.email || "").toLowerCase();
                const phone = (res.guest?.phone || "").toLowerCase();
                const fullName = `${firstName} ${lastName}`;
                if (
                    !firstName.includes(searchLower) &&
                    !lastName.includes(searchLower) &&
                    !email.includes(searchLower) &&
                    !phone.includes(searchLower) &&
                    !fullName.includes(searchLower)
                ) {
                    return false;
                }
            }
            return true;
        });
    }, [reservationsActive, statusFilter, assignmentFilter, channelFilter, arrivalsNowOnly, guestSearch]);

    const reservationsBySite = useMemo(() => {
        const grouped: Record<string, typeof filteredReservations> = {};
        for (const res of filteredReservations) {
            if (!res.siteId) continue;
            if (!grouped[res.siteId]) {
                grouped[res.siteId] = [];
            }
            grouped[res.siteId].push(res);
        }
        return grouped;
    }, [filteredReservations]);

    const conflicts = useMemo(() => {
        const bySite: Record<string, any[]> = {};
        filteredReservations.forEach((res) => {
            if (!res.siteId) return;
            if (!bySite[res.siteId]) bySite[res.siteId] = [];
            bySite[res.siteId].push(res);
        });
        const results: ReservationConflict[] = [];
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

    // Telemetry effects
    useEffect(() => {
        if (reservationsQuery.isSuccess && loadTimers.current.reservations) {
            const activeCount = (reservationsQuery.data || []).filter((r) => r.status !== "cancelled").length;
            startTiming("reservations.load").end({ count: activeCount, dayCount });
            recordMetric("calendar.reservations.visible", { total: activeCount, dayCount });
            setLastUpdated(new Date());
        }
    }, [reservationsQuery.isSuccess, reservationsQuery.data, dayCount]);

    // Selection & Quote logic
    const [selection, setSelection] = useState<QuotePreview | null>(null);

    const selectRange = async (siteId: string, arrival: Date, departure: Date) => {
        const arrivalStr = formatLocalDateInput(arrival);
        const departureStr = formatLocalDateInput(departure);
        const site = sitesQuery.data?.find((s: any) => s.id === siteId) as CalendarSite | undefined;

        if (!site) return;

        try {
            const nights = diffInDays(departure, arrival);
            // Simulated quote for now - in real app, call apiClient.getQuote
            const base = (site.siteClass?.defaultRate || 5000) * nights;
            const quote: QuotePreview = {
                siteId,
                siteName: site.name,
                arrival: arrivalStr,
                departure: departureStr,
                total: base,
                nights,
                base,
                perNight: site.siteClass?.defaultRate || 5000,
                rulesDelta: 0,
                depositRule: null
            };
            setSelection(quote);
        } catch (err) {
            recordError(err as Error, { context: "calendar.selectRange" });
        }
    };

    // Mutations
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
        }
    });

    return {
        state: {
            selectedCampground,
            startDate,
            viewMode,
            dayCount,
            statusFilter,
            siteTypeFilter,
            channelFilter,
            assignmentFilter,
            guestSearch,
            arrivalsNowOnly,
            lastUpdated,
            selection
        },
        actions: {
            setSelectedCampground,
            setStartDate,
            setViewMode,
            setDayCount,
            setStatusFilter,
            setSiteTypeFilter,
            setChannelFilter,
            setAssignmentFilter,
            setGuestSearch,
            setArrivalsNowOnly,
            setSelection,
            selectRange
        },
        queries: {
            campgrounds: campgroundsQuery,
            sites: sitesQuery,
            reservations: reservationsQuery,
            blackouts: blackoutsQuery,
            maintenance: maintenanceQuery,
            housekeeping: housekeepingTasksQuery
        },
        derived: {
            selectedCampgroundDetails,
            days,
            dayCount,
            start,
            visibleEnd,
            filteredReservations,
            reservationsBySite,
            conflicts,
            allowOps,
            ganttSelection
        },
        mutations: {
            move: moveMutation
        }
    };
}
