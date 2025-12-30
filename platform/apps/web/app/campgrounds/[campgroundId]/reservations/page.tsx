"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient, useQueries } from "@tanstack/react-query";
import { apiClient } from "../../../../lib/api-client";
import { Breadcrumbs } from "../../../../components/breadcrumbs";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { DashboardShell } from "../../../../components/ui/layout/DashboardShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import { TableEmpty } from "../../../../components/ui/table";
import { ReservationSchema, computeDepositDue, CreateCommunicationSchema, DepositConfig } from "@campreserv/shared";
import type { z } from "zod";
import { useGanttStore } from "../../../../lib/gantt-store";
import { BulkMessageModal } from "../../../../components/reservations/BulkMessageModal";
import { AnimatePresence } from "framer-motion";
import { CelebrationOverlay } from "../../../../components/signup/CelebrationOverlay";

type ReservationStatus = z.infer<typeof ReservationSchema>["status"];
type ReservationUpdate = Partial<z.infer<typeof ReservationSchema>> & {
  overrideReason?: string;
  overrideApprovedBy?: string;
};

// Extended types for entities with populated relations
type SiteWithClass = {
  id: string;
  siteClassId?: string | null;
  siteClass?: { id: string; name: string; defaultRate?: number; maxOccupancy?: number } | null;
  [key: string]: unknown;
};

type HoldResponse = {
  id: string;
  [key: string]: unknown;
};

type ReservationWithGuest = {
  id: string;
  guest?: { primaryFirstName: string; primaryLastName: string; email?: string } | null;
  site?: SiteWithClass | null;
  feesAmount?: number;
  taxesAmount?: number;
  discountsAmount?: number;
  promoCode?: string;
  source?: string;
  checkInWindowStart?: string;
  checkInWindowEnd?: string;
  vehiclePlate?: string;
  vehicleState?: string;
  rigType?: string;
  rigLength?: number;
  [key: string]: unknown;
};

type CampgroundWithConfig = {
  id: string;
  depositConfig?: DepositConfig | null;
  [key: string]: unknown;
};

export default function ReservationsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const campgroundId = params?.campgroundId as string;
  const queryClient = useQueryClient();

  const campgroundQuery = useQuery({
    queryKey: ["campground", campgroundId],
    queryFn: () => apiClient.getCampground(campgroundId),
    enabled: !!campgroundId
  });
  const reservationsQuery = useQuery({
    queryKey: ["reservations", campgroundId],
    queryFn: () => apiClient.getReservations(campgroundId),
    enabled: !!campgroundId
  });
  const sitesQuery = useQuery({
    queryKey: ["sites", campgroundId],
    queryFn: () => apiClient.getSites(campgroundId),
    enabled: !!campgroundId
  });
  const siteClassesQuery = useQuery({
    queryKey: ["site-classes", campgroundId],
    queryFn: () => apiClient.getSiteClasses(campgroundId),
    enabled: !!campgroundId
  });
  const guestsQuery = useQuery({
    queryKey: ["guests"],
    queryFn: () => apiClient.getGuests()
  });

  const [listTab, setListTab] = useState<"all" | "inhouse">("all");
  const [guestForm, setGuestForm] = useState({
    primaryFirstName: "",
    primaryLastName: "",
    email: "",
    phone: "",
    notes: ""
  });
  const [formState, setFormState] = useState({
    siteId: "",
    guestId: "",
    arrivalDate: "",
    departureDate: "",
    adults: 2,
    children: 0,
    totalAmount: 0,
    paidAmount: 0,
    notes: "",
    depositRule: "none" as "none" | "full" | "half" | "first_night" | "first_night_fees",
    promoCode: "",
    source: "",
    checkInWindowStart: "",
    checkInWindowEnd: "",
    vehiclePlate: "",
    vehicleState: "",
    rigType: "",
    rigLength: "",
    feesAmount: "",
    taxesAmount: "",
    discountsAmount: ""
  });
  const [editing, setEditing] = useState<Record<string, ReservationUpdate | undefined>>({});
  const [paymentInputs, setPaymentInputs] = useState<Record<string, number>>({});
  const [paymentTenders, setPaymentTenders] = useState<Record<string, "card" | "cash" | "check" | "folio">>({});
  const [refundInputs, setRefundInputs] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [startFilter, setStartFilter] = useState("");
  const [endFilter, setEndFilter] = useState("");
  const [filterDepositsDue, setFilterDepositsDue] = useState(false);
  const [commsFilter, setCommsFilter] = useState<"all" | "messages" | "notes" | "failed">("all");
  const [openDetails, setOpenDetails] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<{
    updated: number;
    skipped: number;
    failed: number;
    action: string;
    id: number;
    skippedIds: string[];
  } | null>(null);
  const [sortBy, setSortBy] = useState<"arrival" | "guest" | "site" | "status" | "balance" | "created">("arrival");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  useEffect(() => {
    if (!bulkFeedback) return;
    const timer = setTimeout(() => setBulkFeedback(null), 6000);
    return () => clearTimeout(timer);
  }, [bulkFeedback]);
  const [guestEdits, setGuestEdits] = useState<Record<string, { email: string; phone: string }>>({});
  const [quoteTotal, setQuoteTotal] = useState<number | null>(null);
  const [quoteBreakdown, setQuoteBreakdown] = useState<{
    baseSubtotalCents: number;
    rulesDeltaCents: number;
    nights: number;
  } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [ledgerByRes, setLedgerByRes] = useState<Record<string, any[]>>({});
  const [ledgerLoading, setLedgerLoading] = useState<Record<string, boolean>>({});
  const [ledgerErrors, setLedgerErrors] = useState<Record<string, string>>({});
  const [commsByRes, setCommsByRes] = useState<Record<string, any[]>>({});
  const [commsLoading, setCommsLoading] = useState<Record<string, boolean>>({});
  const [commsErrors, setCommsErrors] = useState<Record<string, string>>({});
  type CommDraft = {
    type?: "note" | "email";
    subject?: string;
    body?: string;
    toAddress?: string;
    fromAddress?: string;
  };

  const [newComm, setNewComm] = useState<Record<string, CommDraft>>({});
  const [resQuotes, setResQuotes] = useState<
    Record<string, { baseSubtotalCents: number; rulesDeltaCents: number; totalCents: number; nights: number }>
  >({});
  const [resQuoteLoading, setResQuoteLoading] = useState<Record<string, boolean>>({});
  const [resQuoteErrors, setResQuoteErrors] = useState<Record<string, string>>({});
  const [flash, setFlash] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [showBookingSuccess, setShowBookingSuccess] = useState(false);
  const [bulkMessageOpen, setBulkMessageOpen] = useState(false);
  const { selection, setSelection, drag, setDrag, startDrag, resetDrag } = useGanttStore();
  const focusId = selection.openDetailsId;
  const highlighted = selection.highlightedId;
  const overlapCheckQuery = useQuery({
    queryKey: ["overlap-check", campgroundId, formState.siteId, formState.arrivalDate, formState.departureDate],
    queryFn: () =>
      apiClient.checkOverlap(campgroundId, {
        siteId: formState.siteId,
        arrivalDate: formState.arrivalDate,
        departureDate: formState.departureDate
      }),
    enabled: !!campgroundId && !!formState.siteId && !!formState.arrivalDate && !!formState.departureDate
  });
  const overlapsListQuery = useQuery({
    queryKey: ["overlaps", campgroundId],
    queryFn: () => apiClient.listOverlaps(campgroundId),
    enabled: !!campgroundId
  });
  const availabilityQuery = useQuery({
    queryKey: ["availability", campgroundId, formState.arrivalDate, formState.departureDate, formState.rigType, formState.rigLength],
    queryFn: () =>
      apiClient.getAvailability(campgroundId, {
        arrivalDate: formState.arrivalDate,
        departureDate: formState.departureDate,
        rigType: formState.rigType || undefined,
        rigLength: formState.rigLength || undefined
      }),
    enabled: !!campgroundId && !!formState.arrivalDate && !!formState.departureDate
  });
  const siteCount = sitesQuery.data?.length ?? 0;
  const createGuest = useMutation({
    mutationFn: (payload: { primaryFirstName: string; primaryLastName: string; email: string; phone: string; notes?: string }) =>
      apiClient.createGuest(payload),
    onSuccess: (newGuest) => {
      queryClient.invalidateQueries({ queryKey: ["guests"] });
      setFormState((s) => ({ ...s, guestId: newGuest.id }));
      setFlash({ type: "success", message: "Guest saved and selected." });
    },
    onError: (err) => {
      setFlash({ type: "error", message: err instanceof Error ? err.message : "Failed to save guest." });
    }
  });

  const createReservation = useMutation({
    mutationFn: async () => {
      const selectedSite = sitesQuery.data?.find((s) => s.id === formState.siteId);
      const selectedClass =
        siteClassesQuery.data?.find((cls) => cls.id === (selectedSite as SiteWithClass)?.siteClassId) ||
        (selectedSite as SiteWithClass)?.siteClass ||
        null;
      const nights =
        formState.arrivalDate && formState.departureDate
          ? Math.max(
            1,
            Math.round(
              (new Date(formState.departureDate).getTime() - new Date(formState.arrivalDate).getTime()) /
              (1000 * 60 * 60 * 24)
            )
          )
          : 1;
      const autoTotal =
        formState.totalAmount === 0 && selectedClass ? ((selectedClass.defaultRate ?? 0) * nights) / 100 : formState.totalAmount;
      const paymentStatus =
        autoTotal === 0
          ? "unpaid"
          : formState.paidAmount >= autoTotal
            ? "paid"
            : formState.paidAmount > 0
              ? "partial"
              : "unpaid";

      let holdId: string | undefined = undefined;
      if (campgroundId && formState.siteId && formState.arrivalDate && formState.departureDate) {
        try {
          const hold = await apiClient.createHold({
            campgroundId,
            siteId: formState.siteId,
            arrivalDate: formState.arrivalDate,
            departureDate: formState.departureDate
          });
          holdId = (hold as HoldResponse)?.id;
        } catch {
          // If hold creation fails, proceed without blocking reservation
        }
      }

      return apiClient.createReservation({
        campgroundId,
        siteId: formState.siteId,
        guestId: formState.guestId,
        arrivalDate: formState.arrivalDate,
        departureDate: formState.departureDate,
        adults: Number(formState.adults),
        children: Number(formState.children),
        totalAmount: Math.round(effectiveTotal * 100),
        paidAmount: Math.round(Number(formState.paidAmount) * 100),
        balanceAmount: Math.max(0, Math.round(effectiveTotal * 100) - Math.round(Number(formState.paidAmount) * 100)),
        paymentStatus,
        notes: formState.notes || undefined,
        status: "pending",
        promoCode: formState.promoCode || undefined,
        source: formState.source || undefined,
        checkInWindowStart: formState.checkInWindowStart || undefined,
        checkInWindowEnd: formState.checkInWindowEnd || undefined,
        vehiclePlate: formState.vehiclePlate || undefined,
        vehicleState: formState.vehicleState || undefined,
        rigType: formState.rigType || undefined,
        rigLength: formState.rigLength ? Number(formState.rigLength) : undefined,
        baseSubtotal: Math.round(autoTotal * 100),
        feesAmount: Math.round(feesVal * 100),
        taxesAmount: Math.round(taxesVal * 100),
        discountsAmount: Math.round(discountsVal * 100),
        holdId
      });
    },
    onSuccess: () => {
      setFormState({
        siteId: "",
        guestId: "",
        arrivalDate: "",
        departureDate: "",
        adults: 2,
        children: 0,
        totalAmount: 0,
        paidAmount: 0,
        notes: "",
        depositRule: "none",
        promoCode: "",
        source: "",
        checkInWindowStart: "",
        checkInWindowEnd: "",
        vehiclePlate: "",
        vehicleState: "",
        rigType: "",
        rigLength: "",
        feesAmount: "",
        taxesAmount: "",
        discountsAmount: ""
      });
      // Show celebration overlay
      setShowBookingSuccess(true);
      setTimeout(() => setShowBookingSuccess(false), 2500);
      queryClient.invalidateQueries({ queryKey: ["reservations", campgroundId] });
    },
    onError: (err) => {
      setFlash({ type: "error", message: err instanceof Error ? err.message : "Failed to save reservation." });
    }
  });

  const deleteReservation = useMutation({
    mutationFn: (id: string) => apiClient.deleteReservation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations", campgroundId] });
      setFlash({ type: "success", message: "Reservation deleted." });
    },
    onError: (err) => {
      setFlash({ type: "error", message: err instanceof Error ? err.message : "Failed to delete reservation." });
    }
  });

  const reservationsKey = ["reservations", campgroundId];
  const updateReservation = useMutation({
    mutationFn: (payload: { id: string; data: ReservationUpdate }) => apiClient.updateReservation(payload.id, payload.data),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: reservationsKey });
      const previous = queryClient.getQueryData<any[]>(reservationsKey);
      if (previous) {
        const next = previous.map((res) =>
          res.id === payload.id
            ? {
              ...res,
              ...payload.data,
              arrivalDate: payload.data.arrivalDate ?? res.arrivalDate,
              departureDate: payload.data.departureDate ?? res.departureDate,
              siteId: payload.data.siteId ?? res.siteId
            }
            : res
        );
        queryClient.setQueryData(reservationsKey, next);
      }
      return { previous };
    },
    onError: (_err, _payload, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(reservationsKey, ctx.previous);
      }
      setFlash({ type: "error", message: "Failed to update reservation." });
    },
    onSuccess: () => {
      setFlash({ type: "success", message: "Reservation updated." });
    },
    onSettled: () => {
      setEditing({});
      resetDrag();
      queryClient.invalidateQueries({ queryKey: reservationsKey });
    }
  });

  const createCommunication = useMutation({
    mutationFn: (payload: z.infer<typeof CreateCommunicationSchema>) => apiClient.createCommunication(payload),
    onError: (err) => {
      setFlash({ type: "error", message: err instanceof Error ? err.message : "Failed to save note." });
    }
  });

  const statusBadge = (status: ReservationStatus) =>
    status === "confirmed"
      ? "bg-status-success/15 text-status-success border-status-success/30"
      : status === "checked_in"
        ? "bg-status-info/15 text-status-info border-status-info/30"
        : status === "checked_out"
          ? "bg-slate-100 text-slate-700 border-slate-200"
          : status === "cancelled"
            ? "bg-rose-100 text-rose-700 border-rose-200"
            : "bg-status-warning/15 text-status-warning border-status-warning/30";

  const toggleDetails = useCallback(
    async (res: any, forceOpen?: boolean) => {
      const nextOpen = forceOpen !== undefined ? forceOpen : !openDetails[res.id];
      setOpenDetails((prev) => ({ ...prev, [res.id]: nextOpen }));
      setSelection({ openDetailsId: nextOpen ? res.id : null, highlightedId: nextOpen ? res.id : highlighted });

      if (nextOpen && !ledgerByRes[res.id]) {
        setLedgerLoading((prev) => ({ ...prev, [res.id]: true }));
        setLedgerErrors((prev) => {
          const next = { ...prev };
          delete next[res.id];
          return next;
        });
        try {
          const rows = await apiClient.getLedgerByReservation(res.id);
          setLedgerByRes((prev) => ({ ...prev, [res.id]: rows }));
        } catch (e) {
          setLedgerErrors((prev) => ({ ...prev, [res.id]: "Failed to load ledger." }));
        } finally {
          setLedgerLoading((prev) => ({ ...prev, [res.id]: false }));
        }
        setResQuoteLoading((prev) => ({ ...prev, [res.id]: true }));
        setResQuoteErrors((prev) => {
          const next = { ...prev };
          delete next[res.id];
          return next;
        });
        try {
          const quote = await apiClient.getQuote(campgroundId, {
            siteId: res.siteId,
            arrivalDate: res.arrivalDate,
            departureDate: res.departureDate
          });
          setResQuotes((prev) => ({
            ...prev,
            [res.id]: {
              baseSubtotalCents: quote.baseSubtotalCents,
              rulesDeltaCents: quote.rulesDeltaCents,
              totalCents: quote.totalCents,
              nights: quote.nights
            }
          }));
        } catch {
          setResQuoteErrors((prev) => ({ ...prev, [res.id]: "Failed to load pricing breakdown." }));
        } finally {
          setResQuoteLoading((prev) => ({ ...prev, [res.id]: false }));
        }
      }

      if (nextOpen && !commsByRes[res.id]) {
        setCommsLoading((prev) => ({ ...prev, [res.id]: true }));
        setCommsErrors((prev) => {
          const next = { ...prev };
          delete next[res.id];
          return next;
        });
        try {
          const list = await apiClient.listCommunications({
            campgroundId,
            reservationId: res.id,
            guestId: res.guestId || undefined,
            limit: 50
          });
          setCommsByRes((prev) => ({ ...prev, [res.id]: list.items }));
        } catch {
          setCommsErrors((prev) => ({ ...prev, [res.id]: "Failed to load communications." }));
        } finally {
          setCommsLoading((prev) => ({ ...prev, [res.id]: false }));
        }
      }
    },
    [
      openDetails,
      setOpenDetails,
      setSelection,
      highlighted,
      ledgerByRes,
      setLedgerLoading,
      setLedgerErrors,
      setLedgerByRes,
      setResQuoteLoading,
      setResQuoteErrors,
      setResQuotes,
      commsByRes,
      setCommsLoading,
      setCommsErrors,
      campgroundId
    ]
  );

  const beginDrag = useCallback(
    (res: any) => {
      startDrag({
        reservationId: res.id,
        siteId: res.siteId,
        startDate: res.arrivalDate,
        endDate: res.departureDate
      });
      setSelection({ highlightedId: res.id });
    },
    [startDrag, setSelection]
  );

  const moveReservation = useCallback(
    (resId: string, nextSiteId: string, nextArrival: string, nextDeparture: string) => {
      updateReservation.mutate({
        id: resId,
        data: { siteId: nextSiteId, arrivalDate: nextArrival, departureDate: nextDeparture }
      });
      resetDrag();
    },
    [updateReservation, resetDrag]
  );

  const recordPayment = useMutation({
    mutationFn: (payload: { id: string; amount: number; method?: "card" | "cash" | "check" | "folio"; note?: string }) =>
      apiClient.recordReservationPayment(
        payload.id,
        Math.round(payload.amount * 100),
        payload.method
          ? [
            {
              method: payload.method,
              amountCents: Math.round(payload.amount * 100),
              note: payload.note
            }
          ]
          : undefined
      ),
    onSuccess: () => {
      setPaymentInputs({});
      queryClient.invalidateQueries({ queryKey: ["reservations", campgroundId] });
      setFlash({ type: "success", message: "Payment recorded." });
    },
    onError: (err) => {
      setFlash({ type: "error", message: err instanceof Error ? err.message : "Failed to record payment." });
    }
  });

  const refundPayment = useMutation({
    mutationFn: (payload: { id: string; amount: number }) =>
      apiClient.refundReservationPayment(payload.id, Math.round(payload.amount * 100)),
    onSuccess: () => {
      setRefundInputs({});
      queryClient.invalidateQueries({ queryKey: ["reservations", campgroundId] });
      setFlash({ type: "success", message: "Refund saved." });
    },
    onError: (err) => {
      setFlash({ type: "error", message: err instanceof Error ? err.message : "Failed to refund." });
    }
  });

  const updateGuestContact = useMutation({
    mutationFn: (payload: { guestId: string; email?: string; phone?: string }) =>
      apiClient.updateGuest(payload.guestId, {
        ...(payload.email ? { email: payload.email } : {}),
        ...(payload.phone ? { phone: payload.phone } : {})
      }),
    onSuccess: (updated) => {
      setGuestEdits((prev) => {
        const next = { ...prev };
        delete next[updated.id];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["reservations", campgroundId] });
      queryClient.invalidateQueries({ queryKey: ["guests"] });
      setFlash({ type: "success", message: "Guest contact updated." });
    },
    onError: (err) => {
      setFlash({ type: "error", message: err instanceof Error ? err.message : "Failed to update guest contact." });
    }
  });

  const selectedSite = sitesQuery.data?.find((s) => s.id === formState.siteId);
  const selectedClass =
    siteClassesQuery.data?.find((cls) => cls.id === (selectedSite as SiteWithClass)?.siteClassId) ||
    (selectedSite as SiteWithClass)?.siteClass ||
    null;
  const nights =
    formState.arrivalDate && formState.departureDate
      ? Math.max(
        1,
        Math.round(
          (new Date(formState.departureDate).getTime() - new Date(formState.arrivalDate).getTime()) /
          (1000 * 60 * 60 * 24)
        )
      )
      : 1;
  const autoTotal =
    quoteTotal !== null
      ? quoteTotal
      : formState.totalAmount === 0 && selectedClass
        ? ((selectedClass.defaultRate ?? 0) * nights) / 100
        : formState.totalAmount;
  const feesVal = Number(formState.feesAmount || 0);
  const taxesVal = Number(formState.taxesAmount || 0);
  const discountsVal = Number(formState.discountsAmount || 0);
  const effectiveTotal = Math.max(0, autoTotal + feesVal + taxesVal - discountsVal);
  const effectiveBalance =
    effectiveTotal > 0
      ? Math.max(0, Math.round(effectiveTotal * 100) - Math.round(formState.paidAmount * 100)) / 100
      : 0;
  const paymentStatus =
    effectiveTotal === 0
      ? "unpaid"
      : formState.paidAmount >= effectiveTotal
        ? "paid"
        : formState.paidAmount > 0
          ? "partial"
          : "unpaid";
  const suggestedDeposit =
    campgroundQuery.data && effectiveTotal
      ? computeDepositDue({
        total: effectiveTotal,
        nights,
        arrivalDate: formState.arrivalDate || undefined,
        depositRule: campgroundQuery.data.depositRule,
        depositPercentage: campgroundQuery.data.depositPercentage ?? null,
        depositConfig: (campgroundQuery.data as CampgroundWithConfig).depositConfig ?? null
      })
      : null;
  const requiredDeposit = suggestedDeposit ?? 0;
  const invalidDates =
    formState.arrivalDate && formState.departureDate
      ? new Date(formState.departureDate) < new Date(formState.arrivalDate)
      : false;
  const missingRequired =
    !formState.siteId || !formState.guestId || !formState.arrivalDate || !formState.departureDate || invalidDates;
  const hasFilters = search.trim() !== "" || statusFilter !== "all" || startFilter !== "" || endFilter !== "";
  const activeFilterCount =
    (search.trim() ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (startFilter ? 1 : 0) +
    (endFilter ? 1 : 0) +
    (filterDepositsDue ? 1 : 0);
  const occupancy = Number(formState.adults || 0) + Number(formState.children || 0);
  const maxOccupancy = selectedClass?.maxOccupancy ?? null;
  const occupancyOver = maxOccupancy ? occupancy > maxOccupancy : false;
  const availableSiteIds = new Set((availabilityQuery.data || []).map((s) => s.id));
  const hasAvailabilityWindow = !!formState.arrivalDate && !!formState.departureDate;
  const selectedSiteUnavailable = hasAvailabilityWindow && formState.siteId ? !availableSiteIds.has(formState.siteId) : false;
  const overlapConflict = overlapCheckQuery.data?.conflict ?? false;
  const openDetailIds = useMemo(() => Object.keys(openDetails).filter((id) => openDetails[id]), [openDetails]);
  const overlapChecks = useQueries({
    queries: openDetailIds.map((id) => {
      const res = reservationsQuery.data?.find((r) => r.id === id);
      const targetSiteId = editing[id]?.siteId ?? res?.siteId;
      const arrival = editing[id]?.arrivalDate ?? res?.arrivalDate;
      const departure = editing[id]?.departureDate ?? res?.departureDate;
      return {
        queryKey: ["reservation-conflict", id, targetSiteId, arrival, departure],
        queryFn: () =>
          apiClient.checkOverlap(campgroundId, {
            siteId: targetSiteId!,
            arrivalDate: arrival!,
            departureDate: departure!,
            ignoreId: id
          }),
        enabled: !!campgroundId && !!targetSiteId && !!arrival && !!departure
      };
    })
  });
  const conflictByReservation = useMemo(
    () =>
      overlapChecks.reduce<Record<string, { conflict: boolean; reasons?: string[] }>>((acc, q, idx) => {
        const resId = openDetailIds[idx];
        if (resId) {
          if (q.data) {
            acc[resId] = q.data;
          } else if (q.isError) {
            acc[resId] = { conflict: false, reasons: ["error"] };
          }
        }
        return acc;
      }, {}),
    [overlapChecks, openDetailIds]
  );
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    const focus = searchParams.get("focus");
    if (focus) {
      setOpenDetails((prev) => ({ ...prev, [focus]: true }));
      setSelection({ openDetailsId: focus, highlightedId: focus });
      setTimeout(() => setSelection({ highlightedId: null }), 3000);
    }
  }, [searchParams, setSelection]);
  const matchTargetId = useMemo(() => focusId || openDetailIds[0] || null, [focusId, openDetailIds]);
  const matchTargetReservation = useMemo(
    () => (matchTargetId ? reservationsQuery.data?.find((r) => r.id === matchTargetId) ?? null : null),
    [matchTargetId, reservationsQuery.data]
  );
  const matchScoresQuery = useQuery({
    queryKey: ["site-match-score", campgroundId, matchTargetReservation?.guestId],
    queryFn: () => apiClient.getMatchedSites(campgroundId, matchTargetReservation!.guestId),
    enabled: !!campgroundId && !!matchTargetReservation?.guestId
  });
  const topMatches = useMemo(() => matchScoresQuery.data?.slice(0, 5) ?? [], [matchScoresQuery.data]);
  const summaryText = useMemo(() => {
    const siteName = selectedSite?.name || "Site";
    const className = selectedClass?.name ? ` (${selectedClass.name})` : "";
    const dates = formState.arrivalDate && formState.departureDate ? `${formState.arrivalDate} → ${formState.departureDate}` : "";
    const total = `$${effectiveTotal.toFixed(2)}`;
    const paid = `$${formState.paidAmount.toFixed(2)}`;
    const balance = `$${effectiveBalance.toFixed(2)}`;
    const depRule = campgroundQuery.data?.depositRule || formState.depositRule;
    return `${siteName}${className} • ${dates} • ${nights} night(s) • Total ${total} • Paid ${paid} • Balance ${balance} • Deposit rule ${depRule}`;
  }, [selectedSite, selectedClass, formState, effectiveTotal, effectiveBalance, nights, campgroundQuery.data?.depositRule]);

  const filteredReservations = useMemo(() => {
    if (!reservationsQuery.data) return [];
    return reservationsQuery.data.filter((res) => {
      const term = search.toLowerCase();
      const guest = `${(res as ReservationWithGuest).guest?.primaryFirstName || ""} ${(res as ReservationWithGuest).guest?.primaryLastName || ""}`.toLowerCase();
      const site = `${res.site?.name || res.site?.siteNumber || ""}`.toLowerCase();
      const status = res.status.toLowerCase();
      const matchesTerm = term ? guest.includes(term) || site.includes(term) || status.includes(term) : true;
      const matchesStatus = statusFilter === "all" ? true : res.status === statusFilter;
      const arrival = new Date(res.arrivalDate);
      const startOk = startFilter ? arrival >= new Date(startFilter) : true;
      const endOk = endFilter ? arrival <= new Date(endFilter) : true;
      const nights = Math.max(
        1,
        Math.round(
          (new Date(res.departureDate).getTime() - new Date(res.arrivalDate).getTime()) / (1000 * 60 * 60 * 24)
        )
      );
      const total = (res.totalAmount ?? 0) / 100;
      const paid = (res.paidAmount ?? 0) / 100;
      const requiredDeposit =
        campgroundQuery.data && res.totalAmount
          ? computeDepositDue({
              total,
              nights,
              arrivalDate: res.arrivalDate,
              depositRule: campgroundQuery.data.depositRule,
              depositPercentage: campgroundQuery.data.depositPercentage ?? null,
              depositConfig: (campgroundQuery.data as CampgroundWithConfig)?.depositConfig ?? null
            })
          : 0;
      const depositDue = requiredDeposit > paid;

      return matchesTerm && matchesStatus && startOk && endOk && (!filterDepositsDue || depositDue);
    });
  }, [reservationsQuery.data, search, statusFilter, startFilter, endFilter, filterDepositsDue, campgroundQuery.data]);

  const sortedReservations = useMemo(() => {
    const data = [...filteredReservations];
    data.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const getGuest = (r: any) => `${r.guest?.primaryLastName || ""} ${r.guest?.primaryFirstName || ""}`.trim().toLowerCase();
      const getSite = (r: any) => `${r.site?.name || r.site?.siteNumber || ""}`.toLowerCase();
      const balanceA = Math.max(0, (a.totalAmount ?? 0) - (a.paidAmount ?? 0));
      const balanceB = Math.max(0, (b.totalAmount ?? 0) - (b.paidAmount ?? 0));
      switch (sortBy) {
        case "guest":
          return dir * getGuest(a).localeCompare(getGuest(b));
        case "site":
          return dir * getSite(a).localeCompare(getSite(b));
        case "status":
          return dir * (a.status || "").localeCompare(b.status || "");
        case "balance":
          return dir * (balanceA - balanceB);
        case "created":
          return dir * (new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
        case "arrival":
        default:
          return dir * (new Date(a.arrivalDate).getTime() - new Date(b.arrivalDate).getTime());
      }
    });
    return data;
  }, [filteredReservations, sortBy, sortDir]);

  const tabFilteredReservations = useMemo(
    () => (listTab === "inhouse" ? sortedReservations.filter((r) => r.status === "checked_in") : sortedReservations),
    [sortedReservations, listTab]
  );

  const currentRowIds = useMemo(() => tabFilteredReservations.map((r) => r.id), [tabFilteredReservations]);
  const selectedInView = useMemo(
    () => tabFilteredReservations.filter((r) => selectedIds.includes(r.id)),
    [tabFilteredReservations, selectedIds]
  );
  const allInViewSelected = currentRowIds.length > 0 && currentRowIds.every((id) => selectedIds.includes(id));
  const someInViewSelected = currentRowIds.some((id) => selectedIds.includes(id)) && !allInViewSelected;
  useEffect(() => {
    setSelectedIds([]);
  }, [listTab, search, statusFilter, startFilter, endFilter]);

  const summary = useMemo(() => {
    if (!tabFilteredReservations.length) return null;
    const nights = tabFilteredReservations.reduce((sum, r) => {
      const arrival = new Date(r.arrivalDate);
      const departure = new Date(r.departureDate);
      const n = Math.max(1, Math.round((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24)));
      return sum + n;
    }, 0);
    const totalCents = tabFilteredReservations.reduce((sum, r) => sum + (r.totalAmount ?? 0), 0);
    const paidCents = tabFilteredReservations.reduce((sum, r) => sum + (r.paidAmount ?? 0), 0);
    const balanceCents = Math.max(0, totalCents - paidCents);
    const adr = nights > 0 ? totalCents / nights / 100 : 0;
    const revpar = siteCount > 0 && nights > 0 ? totalCents / siteCount / nights / 100 : 0;
    return { nights, totalCents, paidCents, balanceCents, adr, revpar };
  }, [tabFilteredReservations, siteCount]);

  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someInViewSelected;
    }
  }, [someInViewSelected, allInViewSelected]);
  useEffect(() => {
    setBulkFeedback(null);
  }, [selectedIds.length, statusFilter, search, startFilter, endFilter, listTab]);

  const isSameDay = useCallback((value: string | Date | undefined | null, compare: Date) => {
    if (!value) return false;
    const d = new Date(value);
    return d.getFullYear() === compare.getFullYear() && d.getMonth() === compare.getMonth() && d.getDate() === compare.getDate();
  }, []);

  const today = useMemo(() => new Date(), []);
  const arrivalsToday = useMemo(
    () => (reservationsQuery.data || []).filter((res) => isSameDay(res.arrivalDate, today)),
    [reservationsQuery.data, isSameDay, today]
  );
  const departuresToday = useMemo(
    () => (reservationsQuery.data || []).filter((res) => isSameDay(res.departureDate, today)),
    [reservationsQuery.data, isSameDay, today]
  );
  const inHouse = useMemo(
    () => (reservationsQuery.data || []).filter((res) => res.status === "checked_in"),
    [reservationsQuery.data]
  );
  const occupancyRate = siteCount > 0 ? Math.min(100, Math.round((inHouse.length / siteCount) * 100)) : 0;
  const balanceDueCents = useMemo(
    () =>
      (reservationsQuery.data || []).reduce((sum, res) => {
        const totalCents = res.totalAmount ?? 0;
        const paidCents = res.paidAmount ?? 0;
        return sum + Math.max(0, totalCents - paidCents);
      }, 0),
    [reservationsQuery.data]
  );

  const handleExport = (format: "csv" | "json") => {
    if (!filteredReservations.length) return;
    if (format === "json") {
      const blob = new Blob([JSON.stringify(filteredReservations, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "reservations.json";
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const headers = ["id", "status", "arrival", "departure", "nights", "site", "guest", "total", "paid", "balance"];
    const rows = filteredReservations.map((r) => {
      const arrival = new Date(r.arrivalDate);
      const departure = new Date(r.departureDate);
      const nights = Math.max(1, Math.round((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24)));
      const guest = `${(r as ReservationWithGuest).guest?.primaryFirstName || ""} ${(r as ReservationWithGuest).guest?.primaryLastName || ""}`.trim();
      const site = r.site?.name || r.site?.siteNumber || "";
      const total = (r.totalAmount ?? 0) / 100;
      const paid = (r.paidAmount ?? 0) / 100;
      const balance = Math.max(0, total - paid);
      return [r.id, r.status, arrival.toISOString(), departure.toISOString(), nights, site, guest, total, paid, balance];
    });
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reservations.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSelected = (format: "csv" | "json") => {
    const selected = filteredReservations.filter((r) => selectedIds.includes(r.id));
    if (!selected.length) return;
    if (format === "json") {
      const blob = new Blob([JSON.stringify(selected, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "reservations-selected.json";
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const headers = ["id", "status", "arrival", "departure", "nights", "site", "guest", "total", "paid", "balance"];
    const rows = selected.map((r) => {
      const arrival = new Date(r.arrivalDate);
      const departure = new Date(r.departureDate);
      const nights = Math.max(1, Math.round((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24)));
      const guest = `${(r as ReservationWithGuest).guest?.primaryFirstName || ""} ${(r as ReservationWithGuest).guest?.primaryLastName || ""}`.trim();
      const site = r.site?.name || r.site?.siteNumber || "";
      const total = (r.totalAmount ?? 0) / 100;
      const paid = (r.paidAmount ?? 0) / 100;
      const balance = Math.max(0, total - paid);
      return [r.id, r.status, arrival.toISOString(), departure.toISOString(), nights, site, guest, total, paid, balance];
    });
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reservations-selected.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const bulkUpdateStatus = async (nextStatus: ReservationStatus, allowed: ReservationStatus[]) => {
    const eligible = (reservationsQuery.data || []).filter(
      (r) => selectedIds.includes(r.id) && allowed.includes(r.status as ReservationStatus)
    );
    const skipped = (reservationsQuery.data || []).filter(
      (r) => selectedIds.includes(r.id) && !allowed.includes(r.status as ReservationStatus)
    );
    const actionId = Date.now();
    if (!eligible.length) {
      setFlash({ type: "info", message: "No eligible reservations selected." });
      return;
    }
    setBulkPending(true);
    try {
      const results = await Promise.allSettled(eligible.map((r) => apiClient.updateReservation(r.id, { status: nextStatus })));
      const updated = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - updated;
      setBulkFeedback({ updated, skipped: skipped.length, failed, action: nextStatus, id: actionId, skippedIds: skipped.map((s) => s.id) });
      queryClient.invalidateQueries({ queryKey: ["reservations", campgroundId] });
      setFlash({ type: "success", message: `Updated ${updated} reservation(s).${failed ? ` ${failed} failed.` : ""}` });
    } catch (err) {
      setFlash({ type: "error", message: "Bulk update failed." });
    } finally {
      setBulkPending(false);
    }
  };

  const handleBulkMessage = () => {
    if (selectedInView.length === 0) {
      setFlash({ type: "info", message: "Select reservations to message." });
      return;
    }
    setBulkMessageOpen(true);
  };

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    if (allInViewSelected) {
      setSelectedIds((prev) => prev.filter((id) => !currentRowIds.includes(id)));
    } else {
      const merged = new Set([...selectedIds, ...currentRowIds]);
      setSelectedIds(Array.from(merged));
    }
  };

  // Auto-quote when site + dates change
  useEffect(() => {
    const shouldQuote = campgroundId && formState.siteId && formState.arrivalDate && formState.departureDate;
    if (!shouldQuote) {
      setQuoteTotal(null);
      setQuoteBreakdown(null);
      setQuoteError(null);
      setQuoteLoading(false);
      return;
    }
    setQuoteLoading(true);
    setQuoteError(null);
    apiClient
      .getQuote(campgroundId, {
        siteId: formState.siteId,
        arrivalDate: formState.arrivalDate,
        departureDate: formState.departureDate
      })
      .then((quote) => {
        setQuoteTotal((quote.totalCents ?? 0) / 100);
        setQuoteBreakdown({
          baseSubtotalCents: quote.baseSubtotalCents,
          rulesDeltaCents: quote.rulesDeltaCents,
          nights: quote.nights
        });
      })
      .catch(() => {
        setQuoteTotal(null);
        setQuoteBreakdown(null);
        setQuoteError("Could not auto-quote. You can still enter totals manually.");
      })
      .finally(() => {
        setQuoteLoading(false);
      });
  }, [campgroundId, formState.siteId, formState.arrivalDate, formState.departureDate]);

  // If coming from calendar selection, prefill
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("campreserv:pendingSelection");
    if (!raw) return;
    try {
      const sel = JSON.parse(raw);
      if (sel && sel.campgroundId === campgroundId) {
        setFormState((s) => ({
          ...s,
          siteId: sel.siteId || s.siteId,
          arrivalDate: sel.arrival || s.arrivalDate,
          departureDate: sel.departure || s.departureDate
        }));
      }
    } catch { }
    localStorage.removeItem("campreserv:pendingSelection");
  }, [campgroundId]);

  return (
    <DashboardShell>
      <div className="space-y-4">
        <Breadcrumbs
          items={[
            { label: "Campgrounds", href: "/campgrounds?all=true" },
            { label: campgroundQuery.data?.name || campgroundId },
            { label: "Reservations" }
          ]}
        />
        {flash && (
          <div
            className={`rounded-md border px-3 py-2 text-sm ${flash.type === "success"
              ? "border-status-success/30 bg-status-success/15 text-status-success"
              : flash.type === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
          >
            {flash.message}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card data-testid="inhouse-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500">In house</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              <div className="text-2xl font-semibold text-slate-900" data-testid="inhouse-count">
                {inHouse.length} / {siteCount || 0}
              </div>
              <div className="text-xs text-slate-600">{occupancyRate}% occupancy</div>
            </CardContent>
          </Card>
          <Link href="/check-in-out" className="block">
            <Card data-testid="arrivals-card" className="hover:border-emerald-300 hover:shadow-md transition cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-500">Arrivals today</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-1">
                <div className="text-2xl font-semibold text-slate-900" data-testid="arrivals-today">
                  {arrivalsToday.length}
                </div>
                <div className="text-xs text-status-success font-medium">Click to check in →</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/check-in-out" className="block">
            <Card data-testid="departures-card" className="hover:border-orange-300 hover:shadow-md transition cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-500">Departures today</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-1">
                <div className="text-2xl font-semibold text-slate-900" data-testid="departures-today">
                  {departuresToday.length}
                </div>
                <div className="text-xs text-orange-600 font-medium">Click to check out →</div>
              </CardContent>
            </Card>
          </Link>
          <Card data-testid="balance-due-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500">Balance due</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              <div className="text-2xl font-semibold text-slate-900" data-testid="balance-due-value">
                ${(balanceDueCents / 100).toFixed(2)}
              </div>
              <div className="text-xs text-slate-600">Open receivables</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-lg font-semibold text-slate-900">Reservations operations</div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => router.push(`/calendar?campgroundId=${campgroundId}`)}>
              Open calendar
            </Button>
            <Button onClick={() => router.push(`/booking?campgroundId=${campgroundId}`)}>
              Go to booking
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Creating new bookings now lives on the dedicated booking page. Use the dashboard below for arrivals, departures, balances, and guest comms.
        </div>

        <Tabs value={listTab} onValueChange={(v) => setListTab((v as "all" | "inhouse") || "all")} className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="all">All reservations</TabsTrigger>
              <TabsTrigger value="inhouse">In house</TabsTrigger>
            </TabsList>
            <div className="text-xs text-slate-500">
              Showing {tabFilteredReservations.length} of {filteredReservations.length} (filters applied)
            </div>
          </div>

          {summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-2">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs text-slate-500">Reservations</div>
              <div className="text-lg font-semibold text-slate-900">{tabFilteredReservations.length}</div>
              <div className="text-xs text-slate-600">{summary.nights} nights total</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs text-slate-500">Revenue</div>
              <div className="text-lg font-semibold text-slate-900">
                ${(summary.totalCents / 100).toFixed(2)} / Paid ${(summary.paidCents / 100).toFixed(2)}
              </div>
              <div className="text-xs text-slate-600">Balance ${(summary.balanceCents / 100).toFixed(2)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs text-slate-500">ADR</div>
              <div className="text-lg font-semibold text-slate-900">${summary.adr.toFixed(2)}</div>
              <div className="text-xs text-slate-600">Avg daily rate</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs text-slate-500">RevPAR</div>
              <div className="text-lg font-semibold text-slate-900">
                {siteCount > 0 ? `$${summary.revpar.toFixed(2)}` : "n/a"}
              </div>
              <div className="text-xs text-slate-600">Per available site</div>
            </div>
          </div>
          )}

        <TabsContent value="all" className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                      checked={allInViewSelected}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="px-3 py-2 text-left font-semibold cursor-pointer select-none" onClick={() => {
                    setSortBy("arrival");
                    setSortDir((prev) => sortBy === "arrival" ? (prev === "asc" ? "desc" : "asc") : "asc");
                  }}>
                    Dates
                  </th>
                  <th className="px-3 py-2 text-left font-semibold cursor-pointer select-none" onClick={() => {
                    setSortBy((prev) => prev === "guest" ? "guest" : "guest");
                    setSortDir((prev) => sortBy === "guest" ? (prev === "asc" ? "desc" : "asc") : "asc");
                  }}>
                    Guest
                  </th>
                  <th className="px-3 py-2 text-left font-semibold cursor-pointer select-none" onClick={() => {
                    setSortBy((prev) => prev === "site" ? "site" : "site");
                    setSortDir((prev) => sortBy === "site" ? (prev === "asc" ? "desc" : "asc") : "asc");
                  }}>
                    Site
                  </th>
                  <th className="px-3 py-2 text-left font-semibold cursor-pointer select-none" onClick={() => {
                    setSortBy((prev) => prev === "status" ? "status" : "status");
                    setSortDir((prev) => sortBy === "status" ? (prev === "asc" ? "desc" : "asc") : "asc");
                  }}>
                    Status
                  </th>
                  <th className="px-3 py-2 text-left font-semibold cursor-pointer select-none" onClick={() => {
                    setSortBy((prev) => prev === "balance" ? "balance" : "balance");
                    setSortDir((prev) => sortBy === "balance" ? (prev === "asc" ? "desc" : "asc") : "asc");
                  }}>
                    Balance
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tabFilteredReservations.map((res) => {
                  const arrival = new Date(res.arrivalDate);
                  const departure = new Date(res.departureDate);
                  const total = (res.totalAmount ?? 0) / 100;
                  const paid = (res.paidAmount ?? 0) / 100;
                  const balance = Math.max(0, total - paid);
                  const guestName = `${(res as ReservationWithGuest).guest?.primaryFirstName || ""} ${(res as ReservationWithGuest).guest?.primaryLastName || ""}`.trim() || "Unassigned";
                  const statusClass = statusBadge(res.status as ReservationStatus);
                  const balanceClass =
                    balance > 0
                      ? "border-status-warning/30 bg-status-warning/15 text-status-warning"
                      : "border-status-success/30 bg-status-success/15 text-status-success";
                  return (
                    <tr key={res.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300"
                          checked={selectedIds.includes(res.id)}
                          onChange={() => toggleRow(res.id)}
                        />
                      </td>
                      <td className="px-3 py-2 text-slate-800">
                        {arrival.toLocaleDateString()} → {departure.toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 text-slate-800">{guestName}</td>
                      <td className="px-3 py-2 text-slate-800">{res.site?.name || res.site?.siteNumber || "—"}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full border px-2 py-0.5 text-xs capitalize ${statusClass}`}>
                          {res.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-800">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${balanceClass}`}>
                          Paid ${paid.toFixed(2)} • Bal ${balance.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          {res.status === "confirmed" && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => updateReservation.mutate({ id: res.id, data: { status: "checked_in" } })}
                              disabled={updateReservation.isPending}
                            >
                              Check in
                            </Button>
                          )}
                          {res.status === "checked_in" && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => updateReservation.mutate({ id: res.id, data: { status: "checked_out" } })}
                              disabled={updateReservation.isPending}
                            >
                              Check out
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => toggleDetails(res, true)}>
                            Message
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleDetails(res)}
                          >
                            {openDetails[res.id] ? "Hide" : "Expand"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => router.push(`/campgrounds/${campgroundId}/reservations/${res.id}`)}>
                            Details
                          </Button>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-600 mt-1">
                          {activeFilterCount > 0 && (
                            <span className="rounded-full bg-status-success/15 text-status-success border border-status-success/30 px-2 py-0.5 text-[11px] font-semibold">
                              {activeFilterCount} filters
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {tabFilteredReservations.length === 0 && <TableEmpty colSpan={7}>No reservations match the current filters.</TableEmpty>}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="inhouse" className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                      checked={allInViewSelected}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="px-3 py-2 text-left font-semibold cursor-pointer select-none" onClick={() => {
                    setSortBy("arrival");
                    setSortDir((prev) => sortBy === "arrival" ? (prev === "asc" ? "desc" : "asc") : "asc");
                  }}>
                    Dates
                  </th>
                  <th className="px-3 py-2 text-left font-semibold cursor-pointer select-none" onClick={() => {
                    setSortBy((prev) => prev === "guest" ? "guest" : "guest");
                    setSortDir((prev) => sortBy === "guest" ? (prev === "asc" ? "desc" : "asc") : "asc");
                  }}>
                    Guest
                  </th>
                  <th className="px-3 py-2 text-left font-semibold cursor-pointer select-none" onClick={() => {
                    setSortBy((prev) => prev === "site" ? "site" : "site");
                    setSortDir((prev) => sortBy === "site" ? (prev === "asc" ? "desc" : "asc") : "asc");
                  }}>
                    Site
                  </th>
                  <th className="px-3 py-2 text-left font-semibold cursor-pointer select-none" onClick={() => {
                    setSortBy((prev) => prev === "status" ? "status" : "status");
                    setSortDir((prev) => sortBy === "status" ? (prev === "asc" ? "desc" : "asc") : "asc");
                  }}>
                    Status
                  </th>
                  <th className="px-3 py-2 text-left font-semibold cursor-pointer select-none" onClick={() => {
                    setSortBy((prev) => prev === "balance" ? "balance" : "balance");
                    setSortDir((prev) => sortBy === "balance" ? (prev === "asc" ? "desc" : "asc") : "asc");
                  }}>
                    Balance
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tabFilteredReservations.map((res) => {
                  const arrival = new Date(res.arrivalDate);
                  const departure = new Date(res.departureDate);
                  const total = (res.totalAmount ?? 0) / 100;
                  const paid = (res.paidAmount ?? 0) / 100;
                  const balance = Math.max(0, total - paid);
                  const guestName = `${(res as ReservationWithGuest).guest?.primaryFirstName || ""} ${(res as ReservationWithGuest).guest?.primaryLastName || ""}`.trim() || "Unassigned";
                  const statusClass = statusBadge(res.status as ReservationStatus);
                  const balanceClass =
                    balance > 0
                      ? "border-status-warning/30 bg-status-warning/15 text-status-warning"
                      : "border-status-success/30 bg-status-success/15 text-status-success";
                  return (
                    <tr key={res.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300"
                          checked={selectedIds.includes(res.id)}
                          onChange={() => toggleRow(res.id)}
                        />
                      </td>
                      <td className="px-3 py-2 text-slate-800">
                        {arrival.toLocaleDateString()} → {departure.toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 text-slate-800">{guestName}</td>
                      <td className="px-3 py-2 text-slate-800">{res.site?.name || res.site?.siteNumber || "—"}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full border px-2 py-0.5 text-xs capitalize ${statusClass}`}>
                          {res.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-800">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${balanceClass}`}>
                          Paid ${paid.toFixed(2)} • Bal ${balance.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          {res.status === "confirmed" && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => updateReservation.mutate({ id: res.id, data: { status: "checked_in" } })}
                              disabled={updateReservation.isPending}
                            >
                              Check in
                            </Button>
                          )}
                          {res.status === "checked_in" && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => updateReservation.mutate({ id: res.id, data: { status: "checked_out" } })}
                              disabled={updateReservation.isPending}
                            >
                              Check out
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => toggleDetails(res, true)}>
                            Message
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleDetails(res)}
                          >
                            {openDetails[res.id] ? "Hide" : "Expand"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => router.push(`/campgrounds/${campgroundId}/reservations/${res.id}`)}>
                            Details
                          </Button>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-600 mt-1">
                          {activeFilterCount > 0 && (
                            <span className="rounded-full bg-status-success/15 text-status-success border border-status-success/30 px-2 py-0.5 text-[11px] font-semibold">
                              {activeFilterCount} filters
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {tabFilteredReservations.length === 0 && <TableEmpty colSpan={7}>No in-house guests right now.</TableEmpty>}
              </tbody>
            </table>
          </div>
        </TabsContent>
        </Tabs>

        <div className="grid gap-3">
            {overlapsListQuery.data && overlapsListQuery.data.length > 0 && (
              <details className="rounded-lg border border-status-warning/30 bg-status-warning/15 text-sm text-status-warning">
                <summary className="p-3 cursor-pointer hover:bg-status-warning/25 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Overlapping reservations detected</span>
                    <span className="px-2 py-0.5 rounded-full bg-status-warning/25 text-xs font-medium">{overlapsListQuery.data.length}</span>
                  </div>
                  <span className="text-xs">Click to expand</span>
                </summary>
                <div className="px-3 pb-3 space-y-2 border-t border-status-warning/30">
                  <div className="text-xs pt-2">These reservations have conflicting dates on the same site. Update arrival/departure dates or move to a different site.</div>
                  <div className="space-y-1">
                    {overlapsListQuery.data.map((row) => (
                      <div key={`${row.reservationA}-${row.reservationB}`} className="flex flex-wrap items-center gap-2 text-xs p-2 bg-status-warning/25 rounded">
                        <span className="font-semibold">{row.siteId}</span>
                        <span>
                          {row.arrivalA.slice(0, 10)} → {row.departureA.slice(0, 10)}
                        </span>
                        <span>overlaps</span>
                        <span>
                          {row.arrivalB.slice(0, 10)} → {row.departureB.slice(0, 10)}
                        </span>
                        <span className="flex gap-2 ml-auto">
                          <a className="underline hover:opacity-80" href={`/campgrounds/${campgroundId}/reservations/${row.reservationA}`}>
                            Fix A
                          </a>
                          <a className="underline hover:opacity-80" href={`/campgrounds/${campgroundId}/reservations/${row.reservationB}`}>
                            Fix B
                          </a>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            )}
            <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-2">
                  Filters & exports
                  {activeFilterCount > 0 && (
                    <span className="rounded-full bg-status-success/15 text-status-success border border-status-success/30 px-2 py-0.5 text-[11px] font-semibold">
                      {activeFilterCount} on
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!hasFilters && !filterDepositsDue}
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("all");
                      setStartFilter("");
                      setEndFilter("");
                      setFilterDepositsDue(false);
                    }}
                  >
                    Clear all filters
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="rounded-md border border-slate-200 px-2 py-1 text-sm w-64"
                  placeholder="Search guest, site, status…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <input
                  type="date"
                  className="rounded-md border border-slate-200 px-2 py-1 text-sm"
                  value={startFilter}
                  onChange={(e) => setStartFilter(e.target.value)}
                />
                <input
                  type="date"
                  className="rounded-md border border-slate-200 px-2 py-1 text-sm"
                  value={endFilter}
                  onChange={(e) => setEndFilter(e.target.value)}
                />
                <select
                  className="rounded-md border border-slate-200 px-2 py-1 text-sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="checked_in">Checked in</option>
                  <option value="checked_out">Checked out</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const todayStr = new Date().toISOString().slice(0, 10);
                      setStartFilter(todayStr);
                      setEndFilter(todayStr);
                      setStatusFilter("confirmed");
                    }}
                  >
                    Arrivals today
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const todayStr = new Date().toISOString().slice(0, 10);
                      setStartFilter(todayStr);
                      setEndFilter(todayStr);
                      setStatusFilter("checked_in");
                    }}
                  >
                    Departures today
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 1);
                      const tomorrowStr = d.toISOString().slice(0, 10);
                      setStartFilter(tomorrowStr);
                      setEndFilter(tomorrowStr);
                      setStatusFilter("confirmed");
                    }}
                  >
                    Arrivals tomorrow
                  </Button>
                  <Button
                    size="sm"
                    variant={filterDepositsDue ? "secondary" : "outline"}
                    onClick={() => setFilterDepositsDue((v) => !v)}
                  >
                    Deposits due
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const today = new Date();
                      const start = new Date(today);
                      const end = new Date(today);
                      end.setDate(end.getDate() + 6);
                      setStartFilter(start.toISOString().slice(0, 10));
                      setEndFilter(end.toISOString().slice(0, 10));
                      setStatusFilter("all");
                    }}
                  >
                    Next 7 days
                  </Button>
                  <Button
                    size="sm"
                    variant={sortBy === "created" ? "secondary" : "outline"}
                    onClick={() => {
                      setSortBy("created");
                      setSortDir("desc");
                      setStartFilter("");
                      setEndFilter("");
                      setStatusFilter("all");
                    }}
                  >
                    Recently Booked
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const today = new Date();
                      const day = today.getDay();
                      const saturdayOffset = (6 - day + 7) % 7;
                      const sundayOffset = (7 - day + 7) % 7;
                      const start = new Date(today);
                      const end = new Date(today);
                      start.setDate(start.getDate() + saturdayOffset);
                      end.setDate(end.getDate() + sundayOffset);
                      setStartFilter(start.toISOString().slice(0, 10));
                      setEndFilter(end.toISOString().slice(0, 10));
                      setStatusFilter("all");
                    }}
                  >
                    This weekend
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setStartFilter("");
                      setEndFilter("");
                      setFilterDepositsDue(false);
                    }}
                  >
                    Clear dates
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => handleExport("csv")} disabled={!filteredReservations.length}>
                    Export CSV
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleExport("json")} disabled={!filteredReservations.length}>
                    Export JSON
                  </Button>
                </div>
              </div>
            </div>
            {reservationsQuery.isLoading && <p className="text-slate-600">Loading…</p>}
            {reservationsQuery.error && <p className="text-status-error">Error loading reservations</p>}
            {selectedInView.length > 0 && (
              <div className="rounded-lg border border-status-info/30 bg-status-info/15 p-3 flex flex-wrap items-center gap-2 text-sm text-slate-800">
                <div className="font-semibold">{selectedInView.length} selected</div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={bulkPending}
                    onClick={() => bulkUpdateStatus("checked_in", ["confirmed"])}
                  >
                    Check in selected
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={bulkPending}
                    onClick={() => bulkUpdateStatus("checked_out", ["checked_in"])}
                  >
                    Check out selected
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={bulkPending}
                    onClick={() => bulkUpdateStatus("cancelled", ["pending", "confirmed", "checked_in"])}
                  >
                    Cancel selected
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleBulkMessage}>
                    Message selected
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleExportSelected("csv")}>
                    Export CSV
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleExportSelected("json")}>
                    Export JSON
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
                    Clear
                  </Button>
                </div>
                {bulkFeedback && (
                  <div className="flex items-center gap-2 text-xs text-slate-700">
                    <span>
                      {bulkFeedback.action}: updated {bulkFeedback.updated}, skipped {bulkFeedback.skipped}
                      {bulkFeedback.failed ? `, failed ${bulkFeedback.failed}` : ""}
                    </span>
                    <button
                      className="text-status-success hover:opacity-80 font-semibold"
                      onClick={() => setBulkFeedback(null)}
                    >
                      clear
                    </button>
                  </div>
                )}
              </div>
            )}
            {tabFilteredReservations.filter((res) => openDetails[res.id] || focusId === res.id).map((res) => {
              const siteClassName =
                siteClassesQuery.data?.find((cls) => cls.id === (res.site as SiteWithClass)?.siteClassId)?.name || "";
              const siteClass = siteClassesQuery.data?.find((cls) => cls.id === (res.site as SiteWithClass)?.siteClassId);
              const arrival = new Date(res.arrivalDate);
              const departure = new Date(res.departureDate);
              const nights = Math.max(1, Math.round((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24)));
              const total = (res.totalAmount ?? 0) / 100;
              const paid = (res.paidAmount ?? 0) / 100;
              const balance = Math.max(0, total - paid);
              const feesAmount = ((res as ReservationWithGuest).feesAmount ?? 0) / 100;
              const taxesAmount = ((res as ReservationWithGuest).taxesAmount ?? 0) / 100;
              const discountsAmount = ((res as ReservationWithGuest).discountsAmount ?? 0) / 100;
              const shouldAutoOpen = focusId === res.id;
              const resOccupancy = (res.adults ?? 0) + (res.children ?? 0);
              const resMaxOccupancy = siteClass?.maxOccupancy ?? null;
              const resOccupancyOver = resMaxOccupancy ? resOccupancy > resMaxOccupancy : false;
              const statusColor =
                res.status === "confirmed"
                  ? "bg-status-success/15 text-status-success border-status-success/30"
                  : res.status === "checked_in"
                    ? "bg-status-info/15 text-status-info border-status-info/30"
                    : res.status === "checked_out"
                      ? "bg-slate-100 text-slate-700 border-slate-200"
                      : res.status === "cancelled"
                        ? "bg-rose-100 text-rose-700 border-rose-200"
                        : "bg-status-warning/15 text-status-warning border-status-warning/30";
              const suggestedDeposit =
                campgroundQuery.data && total
                  ? computeDepositDue({
                    total,
                    nights,
                    arrivalDate: res.arrivalDate,
                    depositRule: campgroundQuery.data.depositRule,
                    depositPercentage: campgroundQuery.data.depositPercentage ?? null,
                    depositConfig: (campgroundQuery.data as CampgroundWithConfig).depositConfig ?? null
                  })
                  : 0;
              const editedTotalCents = editing[res.id]?.totalAmount ?? res.totalAmount ?? 0;
              const editedPaidCents = editing[res.id]?.paidAmount ?? res.paidAmount ?? 0;
              const editedDepositDue =
                campgroundQuery.data && editedTotalCents
                  ? computeDepositDue({
                    total: editedTotalCents / 100,
                    nights,
                    arrivalDate: res.arrivalDate,
                    depositRule: campgroundQuery.data.depositRule,
                    depositPercentage: campgroundQuery.data.depositPercentage ?? null,
                    depositConfig: (campgroundQuery.data as CampgroundWithConfig).depositConfig ?? null
                  })
                  : suggestedDeposit;
              const depositShortfall = Math.max(0, editedDepositDue - editedPaidCents / 100);
              const paymentAmount = Number(paymentInputs[res.id] ?? balance);
              const depositPaymentTooLow = depositShortfall > 0 && paymentAmount < depositShortfall;
              const conflict = conflictByReservation[res.id];
              const manualOverride =
                editedTotalCents !== (res.totalAmount ?? 0) || (editing[res.id]?.discountsAmount ?? (res as ReservationWithGuest).discountsAmount ?? 0) !== ((res as ReservationWithGuest).discountsAmount ?? 0);
              const overrideMissing =
                manualOverride &&
                (!(editing[res.id]?.overrideReason || "").trim() ||
                  !(editing[res.id]?.overrideApprovedBy || "").trim());
              const guestName = `${(res as ReservationWithGuest).guest?.primaryFirstName || ""} ${(res as ReservationWithGuest).guest?.primaryLastName || ""}`.trim();
              const isOpen = !!openDetails[res.id];
              const wasSkipped =
                !!bulkFeedback &&
                bulkFeedback.skippedIds.includes(res.id);

              return (
                <div
                  key={res.id}
                  className={`card p-3 space-y-2 ${highlighted === res.id ? "ring-2 ring-emerald-300" : ""} ${wasSkipped ? "border-amber-300" : ""}`}
                  ref={
                    shouldAutoOpen
                      ? (el) => {
                        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                      }
                      : undefined
                  }
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-800">
                      <span className={`rounded-full border px-3 py-1 text-xs ${statusColor}`}>{res.status.replace("_", " ")}</span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700">
                        {arrival.toLocaleDateString()} → {departure.toLocaleDateString()} • {nights} night(s)
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700">
                        Paid ${paid.toFixed(2)} • Bal ${balance.toFixed(2)}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700">
                        ADR ${nights > 0 ? (total / nights).toFixed(2) : total.toFixed(2)}
                      </span>
                      {balance > 0 && (
                        <span className="inline-flex items-center gap-2 rounded-full border border-status-warning/30 bg-status-warning/15 px-3 py-1 text-xs text-status-warning">
                          Balance due ${balance.toFixed(2)}
                        </span>
                      )}
                      <span className="text-slate-700">
                        Site {res.site?.name || res.site?.siteNumber} {siteClassName ? `• ${siteClassName}` : ""}
                      </span>
                      <span className="text-slate-700">Guest {guestName || "Unassigned"}</span>
                      {suggestedDeposit > 0 && (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] ${
                            paid >= suggestedDeposit
                              ? "border-status-success/30 bg-status-success/15 text-status-success"
                              : "border-status-warning/30 bg-status-warning/15 text-status-warning"
                          }`}
                        >
                          {paid >= suggestedDeposit ? "Deposit covered" : `Deposit due $${Math.max(0, suggestedDeposit - paid).toFixed(2)}`}
                      </span>
                      )}
                      {wasSkipped && (
                        <span className="rounded-full border border-status-warning/30 bg-status-warning/15 px-2 py-0.5 text-[11px] text-status-warning">
                          Skipped in bulk (status)
                        </span>
                      )}
                      {siteClass?.glCode && (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
                          GL {siteClass.glCode}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {res.status === "confirmed" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => updateReservation.mutate({ id: res.id, data: { status: "checked_in" } })}
                          disabled={updateReservation.isPending}
                        >
                          Check in
                        </Button>
                      )}
                      {res.status === "checked_in" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => updateReservation.mutate({ id: res.id, data: { status: "checked_out" } })}
                          disabled={updateReservation.isPending}
                        >
                          Check out
                        </Button>
                      )}
                      {suggestedDeposit > 0 && paid < suggestedDeposit && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/campgrounds/${campgroundId}/reservations/${res.id}`)}
                        >
                          Collect deposit
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelection({ highlightedId: res.id, openDetailsId: res.id });
                          toggleDetails(res, true);
                        }}
                      >
                        Message guest
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/campgrounds/${campgroundId}/reservations/${res.id}`)}
                      >
                        View details
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => toggleDetails(res)}
                      >
                        {isOpen ? "Hide" : "View"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteReservation.mutate(res.id)} disabled={deleteReservation.isPending}>
                        Delete
                      </Button>
                      <Button size="sm" variant="ghost" asChild>
                        <a href="/ledger" target="_blank" rel="noreferrer">
                          Ledger
                        </a>
                      </Button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="space-y-3 border-t border-slate-200 pt-3">
                      {conflict?.conflict && (
                        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                          <div className="text-sm font-semibold text-rose-900">Conflict detected</div>
                          <div className="flex flex-wrap gap-2">
                            {(conflict.reasons || []).map((r) => (
                              <span key={r} className="rounded-full border border-rose-200 bg-white px-2 py-0.5">
                                {r}
                              </span>
                            ))}
                          </div>
                          <div className="text-[11px] text-rose-700">Resolve conflicts before saving changes.</div>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 space-y-1">
                        <div className="text-sm font-semibold text-slate-900">At a glance</div>
                        <div>
                          {arrival.toLocaleDateString()} → {departure.toLocaleDateString()} • {nights} night(s) • Site{" "}
                          {res.site?.name || res.site?.siteNumber}
                        </div>
                        <div>
                          Deposit rule: {campgroundQuery.data?.depositRule || "none"} • Required ${suggestedDeposit.toFixed(2)} • Paid $
                          {paid.toFixed(2)} • Balance ${balance.toFixed(2)}
                        </div>
                        {resMaxOccupancy && (
                          <div className="text-slate-600">
                            Occupancy {resOccupancy} of {resMaxOccupancy} max {resOccupancyOver ? "• over capacity" : ""}
                          </div>
                        )}
                        <div className="text-slate-600">
                          Status {res.status.replace("_", " ")} • Payment {res.paymentStatus || "unpaid"} • GL {siteClass?.glCode || "n/a"}
                          </div>
                        </div>
                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 space-y-2">
                          <div className="text-sm font-semibold text-slate-900">Recent activity</div>
                          {(() => {
                            const activity: { id: string; label: string; at: string }[] = [];
                            (ledgerByRes[res.id] || []).slice(0, 5).forEach((row: any, idx: number) => {
                              if (row.createdAt) {
                                activity.push({
                                  id: `ledger-${res.id}-${idx}`,
                                  label: `${row.type || "Ledger"} ${row.amount ? `$${(row.amount / 100).toFixed(2)}` : ""}`.trim(),
                                  at: row.createdAt
                                });
                              }
                            });
                            (commsByRes[res.id] || []).slice(0, 5).forEach((c: any, idx: number) => {
                              if (c.createdAt) {
                                activity.push({
                                  id: `comm-${res.id}-${idx}`,
                                  label: c.subject || c.type || "Message",
                                  at: c.createdAt
                                });
                              }
                            });
                            if (activity.length === 0) {
                              activity.push({
                                id: `fallback-${res.id}`,
                                label: "No recent activity",
                                at: res.updatedAt || res.createdAt || ""
                              });
                            }
                            const sorted = activity.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 6);
                            return (
                              <div className="space-y-1">
                                {sorted.map((a) => (
                                  <div key={a.id} className="flex items-center justify-between gap-2">
                                    <span className="truncate">{a.label}</span>
                                    <span className="text-[10px] text-slate-500">{a.at ? new Date(a.at).toLocaleString() : ""}</span>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
                        <label className="flex items-center gap-2">
                          Site
                          <select
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                            value={editing[res.id]?.siteId || res.siteId}
                            onChange={(e) =>
                              setEditing((prev) => ({
                                ...prev,
                                [res.id]: { ...(prev[res.id] || {}), siteId: e.target.value }
                              }))
                            }
                          >
                            {sitesQuery.data?.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.siteType})
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex items-center gap-2">
                          Guest
                          <select
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                            value={editing[res.id]?.guestId || res.guestId}
                            onChange={(e) =>
                              setEditing((prev) => ({
                                ...prev,
                                [res.id]: { ...(prev[res.id] || {}), guestId: e.target.value }
                              }))
                            }
                          >
                            {guestsQuery.data?.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.primaryLastName}, {g.primaryFirstName} ({g.phone})
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      {matchTargetReservation?.id === res.id && (
                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold text-slate-900">Recommended sites</div>
                            {matchScoresQuery.isLoading && <span className="text-[11px] text-slate-500">Checking matches…</span>}
                            {matchScoresQuery.isError && <span className="text-[11px] text-rose-600">Match scoring failed</span>}
                          </div>
                          {topMatches.length === 0 && !matchScoresQuery.isLoading && (
                            <div className="text-slate-500">No ranked matches available for this guest.</div>
                          )}
                          {topMatches.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {topMatches.slice(0, 3).map((m) => (
                                <button
                                  key={m.site.id}
                                  className="rounded-md border border-status-success/30 bg-status-success/15 px-2 py-1 text-[11px] text-status-success hover:border-status-success/50"
                                  onClick={() =>
                                    setEditing((prev) => ({
                                      ...prev,
                                      [res.id]: { ...(prev[res.id] || {}), siteId: m.site.id }
                                    }))
                                  }
                                >
                                  {m.site.name || m.site.siteNumber} • {m.score}/100
                                  {m.reasons?.[0] ? ` (${m.reasons[0]})` : ""}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {res.guest && (
                        <div className="flex flex-col gap-1 text-xs text-slate-600">
                          <div className="font-semibold">
                            {res.guest.primaryFirstName} {res.guest.primaryLastName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Guest profile ID: {res.guest.id} {res.guest.email ? `• ${res.guest.email}` : ""}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <input
                              className="rounded-md border border-slate-200 px-2 py-1"
                              placeholder="Email"
                              value={guestEdits[res.guest.id]?.email ?? res.guest.email ?? ""}
                              onChange={(e) =>
                                setGuestEdits((prev) => ({
                                  ...prev,
                                  [res.guest!.id]: { email: e.target.value, phone: prev[res.guest!.id]?.phone ?? res.guest!.phone ?? "" }
                                }))
                              }
                            />
                            <input
                              className="rounded-md border border-slate-200 px-2 py-1"
                              placeholder="Phone"
                              value={guestEdits[res.guest.id]?.phone ?? res.guest.phone ?? ""}
                              onChange={(e) =>
                                setGuestEdits((prev) => ({
                                  ...prev,
                                  [res.guest!.id]: { phone: e.target.value, email: prev[res.guest!.id]?.email ?? res.guest!.email ?? "" }
                                }))
                              }
                            />
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                updateGuestContact.mutate({
                                  guestId: res.guest!.id,
                                  email: guestEdits[res.guest!.id]?.email ?? res.guest!.email,
                                  phone: guestEdits[res.guest!.id]?.phone ?? res.guest!.phone
                                })
                              }
                              disabled={updateGuestContact.isPending}
                            >
                              Save guest
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-slate-800">
                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                          <div className="text-slate-500 text-xs">Payment</div>
                          <div className="font-semibold">${total.toFixed(2)}</div>
                          <div className="text-xs text-slate-600">Paid ${paid.toFixed(2)} • Balance ${balance.toFixed(2)}</div>
                          {suggestedDeposit > 0 && (
                            <div className="text-xs text-status-warning mt-1">
                              Deposit: ${suggestedDeposit.toFixed(2)} {paid >= suggestedDeposit ? "✔" : "← due"}
                            </div>
                          )}
                        </div>
                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 flex flex-col gap-1">
                          <div className="text-slate-500 text-xs">Guests</div>
                          <div className="text-sm">Adults {res.adults} • Children {res.children}</div>
                          <div className="flex gap-2 text-xs">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                setEditing((prev) => ({
                                  ...prev,
                                  [res.id]: { ...(prev[res.id] || {}), status: "confirmed" }
                                }))
                              }
                            >
                              Confirm
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onMouseDown={() => beginDrag(res)}
                              onClick={() =>
                                setEditing((prev) => ({
                                  ...prev,
                                  [res.id]: { ...(prev[res.id] || {}), status: "checked_in" }
                                }))
                              }
                            >
                              Check in
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setEditing((prev) => ({
                                  ...prev,
                                  [res.id]: { ...(prev[res.id] || {}), status: "checked_out" }
                                }))
                              }
                            >
                              Check out
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setEditing((prev) => ({
                                  ...prev,
                                  [res.id]: { ...(prev[res.id] || {}), status: "cancelled" }
                                }))
                              }
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 flex flex-col gap-1 text-xs">
                          <div className="text-slate-500 text-xs">Quick payments</div>
                          <div className="flex flex-wrap gap-2">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              className="rounded-md border border-slate-200 px-2 py-1 w-24"
                              placeholder="Add payment"
                              value={
                                paymentInputs[res.id] !== undefined
                                  ? paymentInputs[res.id]
                                  : Math.max(0, balance).toFixed(2)
                              }
                              onChange={(e) =>
                                setPaymentInputs((prev) => ({ ...prev, [res.id]: Number(e.target.value || 0) }))
                              }
                            />
                            <select
                              className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                              value={paymentTenders[res.id] ?? "card"}
                              onChange={(e) =>
                                setPaymentTenders((prev) => ({
                                  ...prev,
                                  [res.id]: (e.target.value as "card" | "cash" | "check" | "folio") || "card"
                                }))
                              }
                            >
                              <option value="card">Card</option>
                              <option value="cash">Cash</option>
                              <option value="check">Check</option>
                              <option value="folio">Folio</option>
                            </select>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                recordPayment.mutate({
                                  id: res.id,
                                  amount: paymentAmount,
                                  method: paymentTenders[res.id] ?? "card"
                                })
                              }
                              disabled={recordPayment.isPending || depositPaymentTooLow}
                            >
                              {recordPayment.isPending ? "Saving…" : "Record"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setPaymentInputs((prev) => ({
                                  ...prev,
                                  [res.id]: Math.max(0, balance)
                                }))
                              }
                            >
                              Fill balance
                            </Button>
                          </div>
                          {depositPaymentTooLow && (
                            <div className="text-[11px] text-status-warning">
                              Deposit shortfall ${depositShortfall.toFixed(2)} — collect at least this amount.
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2 mt-1">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              className="rounded-md border border-rose-200 px-2 py-1 w-24"
                              placeholder="Refund"
                              value={refundInputs[res.id] ?? ""}
                              onChange={(e) =>
                                setRefundInputs((prev) => ({ ...prev, [res.id]: Number(e.target.value || 0) }))
                              }
                            />
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                refundPayment.mutate({
                                  id: res.id,
                                  amount: Number(refundInputs[res.id] ?? 0)
                                })
                              }
                              disabled={refundPayment.isPending}
                            >
                              {refundPayment.isPending ? "Saving…" : "Refund"}
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-slate-700">
                        <label className="flex items-center gap-2">
                          Adults
                          <input
                            type="number"
                            className="rounded-md border border-slate-200 px-2 py-1 w-20"
                            value={editing[res.id]?.adults ?? res.adults}
                            onChange={(e) =>
                              setEditing((prev) => ({
                                ...prev,
                                [res.id]: {
                                  ...prev[res.id],
                                  adults: Number(e.target.value)
                                }
                              }))
                            }
                          />
                        </label>
                        <label className="flex items-center gap-2">
                          Children
                          <input
                            type="number"
                            className="rounded-md border border-slate-200 px-2 py-1 w-20"
                            value={editing[res.id]?.children ?? res.children}
                            onChange={(e) =>
                              setEditing((prev) => ({
                                ...prev,
                                [res.id]: {
                                  ...prev[res.id],
                                  children: Number(e.target.value)
                                }
                              }))
                            }
                          />
                        </label>
                        <label className="flex items-center gap-2">
                          Total $
                          <input
                            type="number"
                            className="rounded-md border border-slate-200 px-2 py-1 w-28"
                            value={((editing[res.id]?.totalAmount ?? res.totalAmount) / 100).toFixed(2)}
                            onChange={(e) =>
                              setEditing((prev) => ({
                                ...prev,
                                [res.id]: {
                                  ...prev[res.id],
                                  totalAmount: Math.round(Number(e.target.value) * 100)
                                }
                              }))
                            }
                          />
                        </label>
                        <label className="flex items-center gap-2">
                          Paid $
                          <input
                            type="number"
                            className="rounded-md border border-slate-200 px-2 py-1 w-28"
                            value={((editing[res.id]?.paidAmount ?? res.paidAmount ?? 0) / 100).toFixed(2)}
                            onChange={(e) =>
                              setEditing((prev) => ({
                                ...prev,
                                [res.id]: {
                                  ...prev[res.id],
                                  paidAmount: Math.round(Number(e.target.value) * 100)
                                }
                              }))
                            }
                          />
                        </label>
                        <label className="flex items-center gap-2">
                          Payment
                          <select
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                            value={editing[res.id]?.paymentStatus || res.paymentStatus || "unpaid"}
                            onChange={(e) =>
                              setEditing((prev) => ({
                                ...prev,
                                [res.id]: {
                                  ...prev[res.id],
                                  paymentStatus: e.target.value
                                }
                              }))
                            }
                          >
                            <option value="unpaid">unpaid</option>
                            <option value="partial">partial</option>
                            <option value="paid">paid</option>
                          </select>
                        </label>
                      </div>
                      {/* Related reservations */}
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 space-y-2">
                        <div className="text-sm font-semibold text-slate-900">Related reservations</div>
                        {(() => {
                          const related = (reservationsQuery.data || [])
                            .filter((r) => r.id !== res.id && r.guestId === res.guestId)
                            .sort((a, b) => new Date(a.arrivalDate).getTime() - new Date(b.arrivalDate).getTime())
                            .slice(0, 3);
                          if (related.length === 0) {
                            return <div className="text-slate-500">No other stays for this guest.</div>;
                          }
                          return (
                            <div className="space-y-1">
                              {related.map((r) => (
                                <div key={r.id} className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">
                                    {new Date(r.arrivalDate).toLocaleDateString()} → {new Date(r.departureDate).toLocaleDateString()}
                                  </span>
                                  <span className="text-slate-700">{r.site?.name || r.site?.siteNumber || r.siteId}</span>
                                  <span className={`rounded-full border px-2 py-0.5 text-[11px] capitalize ${statusBadge(r.status as ReservationStatus)}`}>
                                    {r.status.replace("_", " ")}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => router.push(`/campgrounds/${campgroundId}/reservations/${r.id}`)}
                                  >
                                    Open
                                  </Button>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-700">
                        <label className="flex items-center gap-2">
                          Check-in
                          <input
                            type="datetime-local"
                            className="rounded-md border border-slate-200 px-2 py-1"
                            value={(editing[res.id]?.checkInAt || res.checkInAt || "").toString().slice(0, 16)}
                            onChange={(e) =>
                              setEditing((prev) => ({
                                ...prev,
                                [res.id]: {
                                  ...prev[res.id],
                                  checkInAt: e.target.value
                                }
                              }))
                            }
                          />
                        </label>
                        <label className="flex items-center gap-2">
                          Check-out
                          <input
                            type="datetime-local"
                            className="rounded-md border border-slate-200 px-2 py-1"
                            value={(editing[res.id]?.checkOutAt || res.checkOutAt || "").toString().slice(0, 16)}
                            onChange={(e) =>
                              setEditing((prev) => ({
                                ...prev,
                                [res.id]: {
                                  ...prev[res.id],
                                  checkOutAt: e.target.value
                                }
                              }))
                            }
                          />
                        </label>
                      </div>
                      <div>
                        <textarea
                          className="rounded-md border border-slate-200 px-2 py-1 w-full text-sm"
                          placeholder="Notes"
                          value={editing[res.id]?.notes ?? res.notes ?? ""}
                          onChange={(e) =>
                            setEditing((prev) => ({
                              ...prev,
                              [res.id]: {
                                ...prev[res.id],
                                notes: e.target.value
                              }
                            }))
                          }
                        />
                      </div>
                      {manualOverride && (
                        <div className="rounded-md border border-status-warning/30 bg-status-warning/15 px-3 py-2 text-xs text-status-warning space-y-2">
                          <div className="text-sm font-semibold">Manual pricing override</div>
                          <div className="text-[11px]">Provide reason and approval to save discount/total changes.</div>
                          <div className="grid md:grid-cols-2 gap-2">
                            <input
                              className="rounded-md border border-amber-300 px-2 py-1 text-xs"
                              placeholder="Override reason"
                              value={editing[res.id]?.overrideReason ?? ""}
                              onChange={(e) =>
                                setEditing((prev) => ({
                                  ...prev,
                                  [res.id]: { ...(prev[res.id] || {}), overrideReason: e.target.value }
                                }))
                              }
                            />
                            <input
                              className="rounded-md border border-amber-300 px-2 py-1 text-xs"
                              placeholder="Approved by"
                              value={editing[res.id]?.overrideApprovedBy ?? ""}
                              onChange={(e) =>
                                setEditing((prev) => ({
                                  ...prev,
                                  [res.id]: { ...(prev[res.id] || {}), overrideApprovedBy: e.target.value }
                                }))
                              }
                            />
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          onClick={() =>
                            updateReservation.mutate({
                              id: res.id,
                              data: {
                                adults: editing[res.id]?.adults ?? res.adults,
                                children: editing[res.id]?.children ?? res.children,
                                totalAmount: editing[res.id]?.totalAmount ?? res.totalAmount,
                                paidAmount: editing[res.id]?.paidAmount ?? res.paidAmount ?? 0,
                                balanceAmount: Math.max(
                                  0,
                                  (editing[res.id]?.totalAmount ?? res.totalAmount) -
                                  (editing[res.id]?.paidAmount ?? res.paidAmount ?? 0)
                                ),
                                paymentStatus:
                                  (editing[res.id]?.paidAmount ?? res.paidAmount ?? 0) >=
                                    (editing[res.id]?.totalAmount ?? res.totalAmount)
                                    ? "paid"
                                    : (editing[res.id]?.paidAmount ?? res.paidAmount ?? 0) > 0
                                      ? "partial"
                                      : "unpaid",
                                checkInAt: editing[res.id]?.checkInAt ?? res.checkInAt ?? undefined,
                                checkOutAt: editing[res.id]?.checkOutAt ?? res.checkOutAt ?? undefined,
                                notes: editing[res.id]?.notes ?? res.notes ?? undefined,
                                status: editing[res.id]?.status ?? res.status,
                                siteId: editing[res.id]?.siteId ?? res.siteId,
                                guestId: editing[res.id]?.guestId ?? res.guestId,
                                promoCode: editing[res.id]?.promoCode ?? (res as ReservationWithGuest).promoCode ?? undefined,
                                source: editing[res.id]?.source ?? (res as ReservationWithGuest).source ?? undefined,
                                checkInWindowStart:
                                  editing[res.id]?.checkInWindowStart ?? (res as ReservationWithGuest).checkInWindowStart ?? undefined,
                                checkInWindowEnd: editing[res.id]?.checkInWindowEnd ?? (res as ReservationWithGuest).checkInWindowEnd ?? undefined,
                                vehiclePlate: editing[res.id]?.vehiclePlate ?? (res as ReservationWithGuest).vehiclePlate ?? undefined,
                                vehicleState: editing[res.id]?.vehicleState ?? (res as ReservationWithGuest).vehicleState ?? undefined,
                                rigType: editing[res.id]?.rigType ?? (res as ReservationWithGuest).rigType ?? undefined,
                                rigLength: editing[res.id]?.rigLength ?? (res as ReservationWithGuest).rigLength ?? undefined,
                                baseSubtotal: editing[res.id]?.totalAmount ?? res.totalAmount,
                                feesAmount: (res as ReservationWithGuest).feesAmount ?? 0,
                                taxesAmount: (res as ReservationWithGuest).taxesAmount ?? 0,
                                discountsAmount: (res as ReservationWithGuest).discountsAmount ?? 0,
                                overrideReason: editing[res.id]?.overrideReason ?? undefined,
                                overrideApprovedBy: editing[res.id]?.overrideApprovedBy ?? undefined
                              }
                            })
                          }
                          disabled={updateReservation.isPending || conflict?.conflict || overrideMissing || depositShortfall > 0}
                        >
                          {updateReservation.isPending ? "Saving…" : "Save"}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            setEditing((prev) => {
                              const next = { ...prev };
                              delete next[res.id];
                              return next;
                            })
                          }
                        >
                          Cancel
                        </Button>
                      </div>
                      {(depositShortfall > 0 || overrideMissing || conflict?.conflict) && (
                        <div className="text-[11px] text-status-warning">
                          {depositShortfall > 0 && `Deposit shortfall $${depositShortfall.toFixed(2)} — collect before saving. `}
                          {overrideMissing && "Override reason + approver are required when editing totals. "}
                          {conflict?.conflict && "Resolve site conflicts before saving."}
                        </div>
                      )}

                      <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3 space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold text-slate-700">Communications</div>
                          <div className="flex gap-2 items-center flex-wrap">
                            <div className="flex gap-1">
                              {(["all", "messages", "notes", "failed"] as const).map((f) => (
                                <button
                                  key={f}
                                  className={`rounded-full border px-2 py-1 text-[11px] ${commsFilter === f ? "border-status-success/30 bg-status-success/15 text-status-success" : "border-slate-200 text-slate-600"}`}
                                  onClick={() => setCommsFilter(f)}
                                >
                                  {f === "failed" ? "Failed" : f === "messages" ? "Messages" : f[0].toUpperCase() + f.slice(1)}
                                </button>
                              ))}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs"
                              onClick={() => setCommsFilter("failed")}
                            >
                              Failed only
                            </Button>
                          {commsLoading[res.id] && <div className="text-xs text-slate-500">Loading…</div>}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs"
                              onClick={() => {
                                localStorage.setItem("campreserv:openReservationId", res.id);
                                router.push("/messages");
                              }}
                            >
                              View all
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="text-xs"
                              onClick={() => {
                                localStorage.setItem("campreserv:openReservationId", res.id);
                                router.push("/messages");
                              }}
                            >
                              Message guest
                            </Button>
                          </div>
                        </div>
                        {commsErrors[res.id] && <div className="text-xs text-status-warning">{commsErrors[res.id]}</div>}
                        {!commsLoading[res.id] && (commsByRes[res.id] || []).length === 0 && (
                          <div className="overflow-hidden rounded border border-slate-200 bg-white">
                            <table className="w-full text-sm">
                              <tbody>
                                <TableEmpty>No notes or messages yet.</TableEmpty>
                              </tbody>
                            </table>
                          </div>
                        )}
                        {(commsByRes[res.id] || [])
                          .filter((c: any) => {
                            if (commsFilter === "notes") return (c.type || "").toLowerCase() === "note";
                            if (commsFilter === "messages") return (c.type || "").toLowerCase() !== "note";
                            if (commsFilter === "failed") {
                              const s = (c.status || "").toLowerCase();
                              return s.includes("fail") || s.includes("bounce") || s.includes("error");
                            }
                            return true;
                          })
                          .slice(0, 5)
                          .map((c: any) => {
                          const status = c.status || "sent";
                          const statusClass =
                            status.startsWith("delivered") || status === "received"
                              ? "bg-status-success/15 text-status-success border border-status-success/30"
                              : status.includes("fail") || status.includes("bounce")
                                ? "bg-status-error/15 text-status-error border border-status-error/30"
                                : "bg-slate-100 text-slate-700 border border-slate-200";
                          return (
                            <div key={c.id} className="rounded border border-slate-100 bg-slate-50 px-2 py-1 text-xs text-slate-700">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold uppercase">{c.type}</span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                    c.direction === "outbound"
                                      ? "bg-status-info/15 text-status-info border border-status-info/30"
                                      : "bg-status-success/15 text-status-success border border-status-success/30"
                                  }`}
                                >
                                  {c.direction}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${statusClass}`}>
                                  {status}
                                </span>
                                <span className="text-slate-500">{c.createdAt ? new Date(c.createdAt).toLocaleString() : ""}</span>
                              </div>
                              {c.subject && <div className="text-slate-800">{c.subject}</div>}
                              {c.body && <div className="text-slate-700 whitespace-pre-wrap">{c.body}</div>}
                              <div className="text-[11px] text-slate-500 mt-1">
                                {c.provider ? `Provider: ${c.provider}` : ""}
                                {c.toAddress ? ` • To: ${c.toAddress}` : ""}
                                {c.fromAddress ? ` • From: ${c.fromAddress}` : ""}
                              </div>
                            </div>
                          );
                        })}
                        {(() => {
                          const commDraft: {
                            type?: "note" | "email";
                            subject?: string;
                            body?: string;
                            toAddress?: string;
                            fromAddress?: string;
                          } = newComm[res.id] || {};
                          return (
                        <div className="rounded border border-slate-100 bg-slate-50 px-2 py-2 space-y-2">
                          <div className="flex gap-2 items-center">
                            <label className="text-xs text-slate-600">Type</label>
                            <select
                              className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                              value={commDraft.type || "note"}
                              onChange={(e) =>
                                setNewComm((prev) => ({
                                  ...prev,
                                  [res.id]: { ...(prev[res.id] || { body: "" }), type: e.target.value as "note" | "email" }
                                }))
                              }
                            >
                              <option value="note">Note</option>
                              <option value="email">Email</option>
                            </select>
                            {commDraft.type === "email" && (
                              <input
                                className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs"
                                placeholder="To email"
                                value={commDraft.toAddress ?? (res as ReservationWithGuest)?.guest?.email ?? ""}
                                onChange={(e) =>
                                  setNewComm((prev) => ({
                                    ...prev,
                                    [res.id]: { ...(prev[res.id] || { body: "", type: "email" }), toAddress: e.target.value }
                                  }))
                                }
                              />
                            )}
                          </div>
                          <input
                            className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                            placeholder="Subject (optional)"
                            value={commDraft.subject ?? ""}
                            onChange={(e) => setNewComm((prev) => ({ ...prev, [res.id]: { ...(prev[res.id] || { body: "" }), subject: e.target.value } }))}
                          />
                          <textarea
                            className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                            placeholder="Add a note or email body"
                            value={commDraft.body ?? ""}
                            onChange={(e) => setNewComm((prev) => ({ ...prev, [res.id]: { ...(prev[res.id] || { subject: "" }), body: e.target.value } }))}
                          />
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              onClick={async () => {
                                const payloadType = commDraft.type || "note";
                                if (payloadType === "email") {
                                  if (!commDraft.toAddress) {
                                    setFlash({ type: "error", message: "Recipient email is required." });
                                    return;
                                  }
                                  try {
                                    const sent = await apiClient.sendCommunication({
                                      campgroundId,
                                      reservationId: res.id,
                                      guestId: res.guestId,
                                      type: "email",
                                      direction: "outbound",
                                      subject: commDraft.subject || undefined,
                                      body: commDraft.body || "",
                                      toAddress: commDraft.toAddress
                                    });
                                    setCommsByRes((prev) => ({
                                      ...prev,
                                      [res.id]: [sent, ...(prev[res.id] || [])]
                                    }));
                                    setNewComm((prev) => ({ ...prev, [res.id]: { type: "note", subject: "", body: "", toAddress: "" } }));
                                    setFlash({ type: "success", message: "Email sent." });
                                  } catch (err) {
                                    setFlash({ type: "error", message: err instanceof Error ? err.message : "Failed to send email." });
                                  }
                                  return;
                                }

                                if (!commDraft.body) {
                                  setFlash({ type: "error", message: "Note body is required." });
                                  return;
                                }
                                try {
                                  const created = await createCommunication.mutateAsync({
                                    campgroundId,
                                    reservationId: res.id,
                                    guestId: res.guestId,
                                    type: "note",
                                    direction: "outbound",
                                    subject: commDraft.subject || undefined,
                                    body: commDraft.body || ""
                                  });
                                  setCommsByRes((prev) => ({
                                    ...prev,
                                    [res.id]: [created, ...(prev[res.id] || [])]
                                  }));
                                  setNewComm((prev) => ({ ...prev, [res.id]: { type: "note", subject: "", body: "", toAddress: "" } }));
                                  setFlash({ type: "success", message: "Note saved." });
                                } catch {
                                  // handled by mutation onError
                                }
                              }}
                              disabled={createCommunication.isPending}
                            >
                              {createCommunication.isPending ? "Saving…" : commDraft.type === "email" ? "Send email" : "Add note"}
                            </Button>
                          </div>
                        </div>
                          );
                        })()}
                      </div>

                      <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1 text-sm">
                        <div className="text-xs font-semibold text-slate-700">Payments / Ledger</div>
                        <div className="text-xs text-slate-600">
                          Promo {res.promoCode || "n/a"} • Source {res.source || "n/a"}
                          {res.checkInWindowStart || res.checkInWindowEnd
                            ? ` • Check-in window ${res.checkInWindowStart || "n/a"} - ${res.checkInWindowEnd || "n/a"}`
                            : ""}
                        </div>
                        {(res.vehiclePlate || res.vehicleState || res.rigType || res.rigLength) && (
                          <div className="text-xs text-slate-600">
                            Vehicle {res.vehiclePlate || "n/a"} {res.vehicleState ? `(${res.vehicleState})` : ""} • Rig{" "}
                            {res.rigType || "n/a"} {res.rigLength ? `• ${res.rigLength}ft` : ""}
                          </div>
                        )}
                        {resQuoteLoading[res.id] && <div className="text-xs text-slate-500">Loading pricing breakdown…</div>}
                        {resQuoteErrors[res.id] && <div className="text-xs text-status-warning">{resQuoteErrors[res.id]}</div>}
                        {resQuotes[res.id] && (
                          <div className="text-xs text-slate-600">
                            Base ${(resQuotes[res.id].baseSubtotalCents / 100).toFixed(2)} • Rules{" "}
                            {resQuotes[res.id].rulesDeltaCents >= 0 ? "+" : "-"}$
                            {Math.abs(resQuotes[res.id].rulesDeltaCents / 100).toFixed(2)} • Total $
                            {(resQuotes[res.id].totalCents / 100).toFixed(2)} ({resQuotes[res.id].nights} nights)
                          </div>
                        )}
                        {(feesAmount || taxesAmount || discountsAmount) > 0 && (
                          <div className="text-xs text-slate-600">
                            Fees ${feesAmount.toFixed(2)} • Taxes ${taxesAmount.toFixed(2)} • Discounts ${discountsAmount.toFixed(2)}
                          </div>
                        )}
                        {ledgerLoading[res.id] && <div className="text-xs text-slate-600">Loading ledger…</div>}
                        {ledgerErrors[res.id] && <div className="text-xs text-status-warning">{ledgerErrors[res.id]}</div>}
                        {!ledgerLoading[res.id] && ledgerByRes[res.id] && ledgerByRes[res.id].length === 0 && (
                          <div className="overflow-hidden rounded border border-slate-200 bg-white">
                            <table className="w-full text-sm">
                              <tbody>
                                <TableEmpty>No ledger entries yet.</TableEmpty>
                              </tbody>
                            </table>
                          </div>
                        )}
                        {!ledgerLoading[res.id] &&
                          (ledgerByRes[res.id] || []).map((row) => (
                            <div key={row.id} className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
                              <span className="text-slate-500">{new Date(row.occurredAt).toLocaleDateString()}</span>
                              <span>{row.direction === "credit" ? "+" : "-"}${(row.amountCents / 100).toFixed(2)}</span>
                              <span className="text-slate-500">{row.glCode || "GL n/a"}</span>
                              <span className="text-slate-500">{row.description || "Ledger entry"}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {!reservationsQuery.isLoading && reservationsQuery.data?.length && !filteredReservations.length && (
              <div className="overflow-hidden rounded border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <tbody>
                    <TableEmpty>No reservations match the current filters.</TableEmpty>
                  </tbody>
                </table>
              </div>
            )}
            {!reservationsQuery.isLoading && !reservationsQuery.data?.length && (
              <div className="overflow-hidden rounded border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <tbody>
                    <TableEmpty>No reservations yet.</TableEmpty>
                  </tbody>
                </table>
              </div>
            )}
          </div>
      </div>
      <BulkMessageModal
        open={bulkMessageOpen}
        onClose={() => setBulkMessageOpen(false)}
        campgroundId={campgroundId}
        reservations={selectedInView}
        onComplete={(results) => {
          setFlash({
            type: results.failed === 0 ? "success" : "info",
            message: results.failed === 0
              ? `Message sent to ${results.sent} guest${results.sent !== 1 ? "s" : ""}`
              : `Sent to ${results.sent}, failed for ${results.failed}`
          });
          if (results.failed === 0) {
            setSelectedIds([]);
          }
        }}
      />
      <AnimatePresence>
        <CelebrationOverlay
          show={showBookingSuccess}
          title="Reservation Created!"
          subtitle="Your booking has been saved successfully"
        />
      </AnimatePresence>
    </DashboardShell>
  );
}
