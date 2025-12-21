"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ChevronsRight,
  CircleDollarSign,
  Lock,
  MapPin,
  Search,
  Sparkles,
  UserPlus
} from "lucide-react";

import { DashboardShell } from "../../components/ui/layout/DashboardShell";
import { Breadcrumbs } from "../../components/breadcrumbs";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { Badge } from "../../components/ui/badge";
import { Textarea } from "../../components/ui/textarea";
import { useToast } from "../../components/ui/use-toast";
import { PaymentModal } from "../../components/payments/PaymentModal";
import { apiClient } from "../../lib/api-client";
import { cn } from "../../lib/utils";
import { useWhoami } from "@/hooks/use-whoami";
import { diffInDays, formatLocalDateInput, parseLocalDateInput } from "../calendar/utils";

const SITE_TYPE_STYLES: Record<string, { label: string; badge: string; border: string }> = {
  rv: { label: "RV", badge: "bg-emerald-100 text-emerald-700", border: "border-emerald-400" },
  tent: { label: "Tent", badge: "bg-amber-100 text-amber-800", border: "border-amber-400" },
  cabin: { label: "Cabin", badge: "bg-rose-100 text-rose-700", border: "border-rose-400" },
  group: { label: "Group", badge: "bg-indigo-100 text-indigo-700", border: "border-indigo-400" },
  glamping: { label: "Glamp", badge: "bg-cyan-100 text-cyan-700", border: "border-cyan-400" },
  default: { label: "Site", badge: "bg-slate-100 text-slate-600", border: "border-slate-300" }
};

const RIG_TYPE_OPTIONS = [
  { value: "class-a", label: "Class A Motorhome" },
  { value: "class-b", label: "Class B Camper Van" },
  { value: "class-c", label: "Class C Motorhome" },
  { value: "travel-trailer", label: "Travel Trailer" },
  { value: "fifth-wheel", label: "Fifth Wheel" },
  { value: "toy-hauler", label: "Toy Hauler" },
  { value: "pop-up", label: "Pop-up Camper" },
  { value: "truck-camper", label: "Truck Camper" },
  { value: "rv-other", label: "Other RV" },
  { value: "tent", label: "Tent" },
  { value: "cabin", label: "Cabin" },
  { value: "other", label: "Other" }
];

const RV_RIG_TYPES = new Set([
  "class-a",
  "class-b",
  "class-c",
  "travel-trailer",
  "fifth-wheel",
  "toy-hauler",
  "pop-up",
  "truck-camper",
  "rv-other"
]);

const PAYMENT_METHODS = [
  { value: "card", label: "Card" },
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "folio", label: "Folio" }
];

export default function BookingLabPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading booking lab...</div>}>
      <BookingLabPageInner />
    </Suspense>
  );
}

function BookingLabPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: whoami } = useWhoami();

  const initialArrival = searchParams.get("arrivalDate") || "";
  const initialDeparture = searchParams.get("departureDate") || "";
  const initialSiteId = searchParams.get("siteId") || "";
  const initialSiteClassId = searchParams.get("siteClassId") || "";
  const initialRigType = searchParams.get("rigType") || searchParams.get("rvType") || "";
  const initialRigLength = searchParams.get("rigLength") || searchParams.get("rvLength") || "";
  const initialSiteTypeFilter = searchParams.get("siteType") || "all";
  const initialAdultsRaw = searchParams.get("adults") || searchParams.get("guests") || "";
  const initialChildrenRaw = searchParams.get("children") || "";
  const parsedAdults = Number(initialAdultsRaw);
  const parsedChildren = Number(initialChildrenRaw);
  const initialAdults = Number.isFinite(parsedAdults) && parsedAdults > 0 ? parsedAdults : 2;
  const initialChildren = Number.isFinite(parsedChildren) && parsedChildren >= 0 ? parsedChildren : 0;

  const { data: campgrounds = [] } = useQuery({
    queryKey: ["campgrounds"],
    queryFn: () => apiClient.getCampgrounds()
  });

  const [selectedCampgroundId, setSelectedCampgroundId] = useState<string | null>(null);

  useEffect(() => {
    if (campgrounds.length === 0) return;
    let stored: string | null = null;
    if (typeof window !== "undefined") {
      stored = localStorage.getItem("campreserv:selectedCampground");
    }
    const storedValid = stored && campgrounds.some((cg) => cg.id === stored);
    const currentValid = selectedCampgroundId && campgrounds.some((cg) => cg.id === selectedCampgroundId);

    if (!currentValid && storedValid) {
      setSelectedCampgroundId(stored as string);
      return;
    }
    if (!currentValid) {
      setSelectedCampgroundId(campgrounds[0].id);
    }
  }, [campgrounds, selectedCampgroundId]);

  const selectedCampground = campgrounds.find((cg) => cg.id === selectedCampgroundId) || null;
  const campgroundGuestTag = selectedCampground?.id ? `campground:${selectedCampground.id}` : null;
  const siteLockFeeCents = (selectedCampground as any)?.siteSelectionFeeCents ?? 0;

  const guestsQuery = useQuery({
    queryKey: ["booking-lab-guests", selectedCampground?.id],
    queryFn: () => apiClient.getGuests(selectedCampground?.id),
    enabled: !!selectedCampground?.id
  });

  const siteClassesQuery = useQuery({
    queryKey: ["booking-lab-site-classes", selectedCampground?.id],
    queryFn: () => apiClient.getSiteClasses(selectedCampground!.id),
    enabled: !!selectedCampground?.id
  });

  const reservationsQuery = useQuery({
    queryKey: ["booking-lab-reservations", selectedCampground?.id],
    queryFn: () => apiClient.getReservations(selectedCampground!.id),
    enabled: !!selectedCampground?.id,
    staleTime: 30_000
  });

  const [guestSearch, setGuestSearch] = useState("");
  const [showGuestResults, setShowGuestResults] = useState(false);
  const [showNewGuest, setShowNewGuest] = useState(false);
  const [guestForm, setGuestForm] = useState({
    primaryFirstName: "",
    primaryLastName: "",
    email: "",
    phone: "",
    address1: "",
    city: "",
    state: "",
    postalCode: ""
  });

  const [formData, setFormData] = useState({
    guestId: "",
    arrivalDate: initialArrival,
    departureDate: initialDeparture,
    adults: initialAdults,
    children: initialChildren,
    pets: 0,
    rigType: initialRigType,
    rigLength: initialRigLength,
    siteId: initialSiteId,
    siteClassId: initialSiteClassId,
    lockSite: false,
    notes: "",
    referralSource: "",
    stayReason: "",
    collectPayment: true,
    paymentAmount: "",
    paymentMethod: "card",
    cardEntryMode: "manual",
    cashReceived: "",
    paymentNotes: "",
    // Guest address fields
    guestAddress1: "",
    guestCity: "",
    guestState: "",
    guestPostalCode: ""
  });
  const [paymentModal, setPaymentModal] = useState<{ reservationId: string; amountCents: number } | null>(null);
  const paymentCompletedRef = useRef(false);
  const [receiptData, setReceiptData] = useState<{
    reservationId: string;
    guestName: string;
    siteName: string;
    arrivalDate: string;
    departureDate: string;
    amountCents: number;
    method: string;
    cashReceivedCents?: number;
    changeDueCents?: number;
  } | null>(null);

  useEffect(() => {
    if (!paymentModal) {
      paymentCompletedRef.current = false;
    }
  }, [paymentModal]);

  useEffect(() => {
    if (formData.arrivalDate && !formData.departureDate) {
      const arrival = parseLocalDateInput(formData.arrivalDate);
      arrival.setDate(arrival.getDate() + 2);
      setFormData((prev) => ({ ...prev, departureDate: formatLocalDateInput(arrival) }));
    }
  }, [formData.arrivalDate, formData.departureDate]);

  useEffect(() => {
    if (!formData.arrivalDate) return;
    if (!formData.departureDate) return;
    const arrival = parseLocalDateInput(formData.arrivalDate);
    const departure = parseLocalDateInput(formData.departureDate);
    if (departure <= arrival) {
      const next = new Date(arrival);
      next.setDate(next.getDate() + 2);
      setFormData((prev) => ({ ...prev, departureDate: formatLocalDateInput(next) }));
    }
  }, [formData.arrivalDate, formData.departureDate]);

  const nights = useMemo(() => {
    if (!formData.arrivalDate || !formData.departureDate) return 0;
    const arrival = parseLocalDateInput(formData.arrivalDate);
    const departure = parseLocalDateInput(formData.departureDate);
    return Math.max(1, diffInDays(departure, arrival));
  }, [formData.arrivalDate, formData.departureDate]);

  const dateRangeValid = useMemo(() => {
    if (!formData.arrivalDate || !formData.departureDate) return false;
    const arrival = parseLocalDateInput(formData.arrivalDate);
    const departure = parseLocalDateInput(formData.departureDate);
    return departure > arrival;
  }, [formData.arrivalDate, formData.departureDate]);

  const siteStatusQuery = useQuery({
    queryKey: ["booking-lab-site-status", selectedCampground?.id, formData.arrivalDate, formData.departureDate],
    queryFn: () => apiClient.getSitesWithStatus(selectedCampground!.id, {
      arrivalDate: formData.arrivalDate,
      departureDate: formData.departureDate
    }),
    enabled: !!selectedCampground?.id && dateRangeValid
  });

  const [siteTypeFilter, setSiteTypeFilter] = useState(initialSiteTypeFilter);
  const [siteClassFilter, setSiteClassFilter] = useState(initialSiteClassId || "all");
  const [availableOnly, setAvailableOnly] = useState(true);
  const siteClassById = useMemo(() => {
    return new Map((siteClassesQuery.data || []).map((siteClass) => [siteClass.id, siteClass]));
  }, [siteClassesQuery.data]);
  const siteClassByName = useMemo(() => {
    return new Map((siteClassesQuery.data || []).map((siteClass) => [siteClass.name.toLowerCase(), siteClass]));
  }, [siteClassesQuery.data]);

  useEffect(() => {
    if (siteClassFilter === "all") return;
    const exists = (siteClassesQuery.data || []).some((siteClass) => siteClass.id === siteClassFilter);
    if (!exists) {
      setSiteClassFilter("all");
    }
  }, [siteClassesQuery.data, siteClassFilter]);
  const rigLengthValue = Number(formData.rigLength);
  const hasRigLength = Number.isFinite(rigLengthValue) && rigLengthValue > 0;
  const isRvRigType = RV_RIG_TYPES.has(formData.rigType);

  const filteredSites = useMemo(() => {
    const sites = siteStatusQuery.data || [];
    return sites.filter((site) => {
      if (availableOnly && site.status !== "available") return false;
      if (siteTypeFilter !== "all" && site.siteType !== siteTypeFilter) return false;
      if (siteClassFilter !== "all" && site.siteClassId !== siteClassFilter) return false;
      if (isRvRigType && (site.siteType === "tent" || site.siteType === "cabin")) return false;
      if (hasRigLength) {
        const siteMaxLength =
          (site as { rigMaxLength?: number | null }).rigMaxLength ??
          siteClassById.get(site.siteClassId ?? "")?.rigMaxLength ??
          null;
        if (siteMaxLength && rigLengthValue > siteMaxLength) return false;
      }
      return true;
    });
  }, [
    siteStatusQuery.data,
    availableOnly,
    siteTypeFilter,
    siteClassFilter,
    isRvRigType,
    hasRigLength,
    rigLengthValue,
    siteClassById
  ]);

  useEffect(() => {
    if (formData.siteId || !formData.siteClassId) return;
    const match = filteredSites.find((site) => site.siteClassId === formData.siteClassId);
    if (match) {
      setFormData((prev) => ({ ...prev, siteId: match.id }));
    }
  }, [filteredSites, formData.siteId, formData.siteClassId]);

  const selectedSite = useMemo(() => {
    const all = siteStatusQuery.data || [];
    return all.find((site) => site.id === formData.siteId) || null;
  }, [siteStatusQuery.data, formData.siteId]);

  useEffect(() => {
    if (!selectedSite) return;
    setFormData((prev) => ({
      ...prev,
      siteClassId: prev.siteClassId || selectedSite.siteClassId || ""
    }));
  }, [selectedSite]);

  const quoteQuery = useQuery({
    queryKey: ["booking-lab-quote", selectedCampground?.id, formData.siteId, formData.arrivalDate, formData.departureDate],
    queryFn: () => apiClient.getQuote(selectedCampground!.id, {
      siteId: formData.siteId,
      arrivalDate: formData.arrivalDate,
      departureDate: formData.departureDate
    }),
    enabled: !!selectedCampground?.id && !!formData.siteId && dateRangeValid
  });

  const lockFeeCents = formData.lockSite && siteLockFeeCents > 0 ? siteLockFeeCents : 0;
  const fallbackRateCents = (() => {
    if (selectedSite?.defaultRate !== null && selectedSite?.defaultRate !== undefined) {
      return selectedSite.defaultRate;
    }
    if (selectedSite?.siteClassId) {
      const rate = siteClassById.get(selectedSite.siteClassId)?.defaultRate;
      if (rate !== null && rate !== undefined) return rate;
    }
    if (selectedSite?.siteClassName) {
      const rate = siteClassByName.get(selectedSite.siteClassName.toLowerCase())?.defaultRate;
      if (rate !== null && rate !== undefined) return rate;
    }
    return null;
  })();
  const fallbackSubtotalCents = fallbackRateCents !== null && nights ? fallbackRateCents * nights : null;
  const pricingSubtotalCents = quoteQuery.data?.baseSubtotalCents ?? fallbackSubtotalCents;
  const pricingRulesDeltaCents = quoteQuery.data?.rulesDeltaCents ?? null;
  const pricingTotalCents = quoteQuery.data?.totalCents ?? fallbackSubtotalCents;
  const pricingIsEstimate = !quoteQuery.data && fallbackSubtotalCents !== null;
  const paymentAmountCents = Math.round(Number(formData.paymentAmount || 0) * 100);
  const manualTotalCents = paymentAmountCents > 0 ? paymentAmountCents : null;
  const estimatedTotalCents = pricingTotalCents !== null ? pricingTotalCents + lockFeeCents : null;
  const totalCents = estimatedTotalCents ?? manualTotalCents ?? 0;
  const paymentAmountDefault = estimatedTotalCents && estimatedTotalCents > 0
    ? (estimatedTotalCents / 100).toFixed(2)
    : "";
  const displaySubtotalCents = pricingSubtotalCents ?? manualTotalCents;
  const displayTotalCents = estimatedTotalCents ?? manualTotalCents;
  const cashReceivedCents = Math.round(Number(formData.cashReceived || 0) * 100);
  const cashChangeDueCents =
    formData.paymentMethod === "cash" && cashReceivedCents > paymentAmountCents
      ? cashReceivedCents - paymentAmountCents
      : 0;
  const cashShortCents =
    formData.paymentMethod === "cash" && cashReceivedCents > 0 && cashReceivedCents < paymentAmountCents
      ? paymentAmountCents - cashReceivedCents
      : 0;

  useEffect(() => {
    if (formData.collectPayment && paymentAmountDefault) {
      setFormData((prev) => ({ ...prev, paymentAmount: paymentAmountDefault }));
    }
  }, [formData.collectPayment, paymentAmountDefault]);

  useEffect(() => {
    if (!formData.collectPayment || formData.paymentMethod !== "cash") return;
    if (formData.cashReceived) return;
    if (paymentAmountDefault) {
      setFormData((prev) => ({ ...prev, cashReceived: paymentAmountDefault }));
    }
  }, [formData.collectPayment, formData.paymentMethod, formData.cashReceived, paymentAmountDefault]);

  useEffect(() => {
    if (formData.paymentMethod !== "card") return;
    if (formData.cardEntryMode) return;
    setFormData((prev) => ({ ...prev, cardEntryMode: "manual" }));
  }, [formData.paymentMethod, formData.cardEntryMode]);

  const guests = guestsQuery.data || [];
  const guestStayedSet = useMemo(() => {
    if (!reservationsQuery.data) return null;
    const today = parseLocalDateInput(formatLocalDateInput(new Date()));
    return new Set(
      reservationsQuery.data
        .filter((reservation) => {
          if (reservation.status === "cancelled") return false;
          if (reservation.status === "checked_in" || reservation.status === "checked_out") return true;
          const departure = parseLocalDateInput(reservation.departureDate);
          return departure <= today;
        })
        .map((reservation) => reservation.guestId)
    );
  }, [reservationsQuery.data]);
  const guestMatches = useMemo(() => {
    const search = guestSearch.trim().toLowerCase();
    if (!search) return [];
    return guests.filter((guest) => {
      const first = (guest.primaryFirstName || "").toLowerCase();
      const last = (guest.primaryLastName || "").toLowerCase();
      const email = (guest.email || "").toLowerCase();
      const phone = (guest.phone || "").toLowerCase();
      const full = `${first} ${last}`.trim();
      return (
        first.includes(search) ||
        last.includes(search) ||
        email.includes(search) ||
        phone.includes(search) ||
        full.includes(search)
      );
    }).slice(0, 6);
  }, [guestSearch, guests]);

  const selectedGuest = useMemo(
    () => guests.find((guest) => guest.id === formData.guestId) || null,
    [guests, formData.guestId]
  );

  // Pre-populate address fields when guest is selected
  useEffect(() => {
    if (selectedGuest) {
      setFormData((prev) => ({
        ...prev,
        guestAddress1: selectedGuest.address1 || "",
        guestCity: selectedGuest.city || "",
        guestState: selectedGuest.state || "",
        guestPostalCode: selectedGuest.postalCode || ""
      }));
    }
  }, [selectedGuest?.id]);

  const matchesQuery = useQuery({
    queryKey: ["booking-lab-matches", selectedCampground?.id, formData.guestId],
    queryFn: () => apiClient.getMatchedSites(selectedCampground!.id, formData.guestId),
    enabled: !!selectedCampground?.id && !!formData.guestId
  });
  const filteredMatches = useMemo(() => {
    const matches = matchesQuery.data || [];
    return matches.filter((match) => {
      const siteType = (match.site.siteType || "").toLowerCase();
      if (isRvRigType && (siteType === "tent" || siteType === "cabin")) return false;
      if (hasRigLength) {
        const maxLength = match.site.rigMaxLength ?? match.site.siteClass?.rigMaxLength ?? null;
        if (maxLength && rigLengthValue > maxLength) return false;
      }
      return true;
    });
  }, [matchesQuery.data, isRvRigType, hasRigLength, rigLengthValue]);

  const createGuestMutation = useMutation({
    mutationFn: () => apiClient.createGuest({
      primaryFirstName: guestForm.primaryFirstName,
      primaryLastName: guestForm.primaryLastName,
      email: guestForm.email,
      phone: guestForm.phone,
      address1: guestForm.address1 || undefined,
      city: guestForm.city || undefined,
      state: guestForm.state || undefined,
      postalCode: guestForm.postalCode || undefined,
      ...(campgroundGuestTag ? { tags: [campgroundGuestTag] } : {})
    }),
    onSuccess: (guest) => {
      setFormData((prev) => ({ ...prev, guestId: guest.id }));
      setGuestSearch(`${guest.primaryFirstName} ${guest.primaryLastName}`.trim());
      setShowNewGuest(false);
      setGuestForm({ primaryFirstName: "", primaryLastName: "", email: "", phone: "", address1: "", city: "", state: "", postalCode: "" });
      queryClient.setQueryData(
        ["booking-lab-guests", selectedCampground?.id],
        (current: typeof guests | undefined) => {
          if (!current) return [guest];
          if (current.some((item) => item.id === guest.id)) return current;
          return [guest, ...current];
        }
      );
      toast({ title: "Guest created", description: "New guest added and selected." });
    },
    onError: () => toast({ title: "Guest creation failed", variant: "destructive" })
  });

  const holdMutation = useMutation({
    mutationFn: () => apiClient.createHold({
      campgroundId: selectedCampground!.id,
      siteId: formData.siteId,
      arrivalDate: formData.arrivalDate,
      departureDate: formData.departureDate,
      holdMinutes: 30
    }),
    onSuccess: () => {
      toast({ title: "Hold placed", description: "Site held for 30 minutes." });
    },
    onError: () => toast({ title: "Hold failed", description: "Unable to place hold.", variant: "destructive" })
  });

  const createReservationMutation = useMutation({
    mutationFn: async () => {
      // Update guest address if it changed
      if (selectedGuest) {
        const addressChanged =
          formData.guestAddress1 !== (selectedGuest.address1 || "") ||
          formData.guestCity !== (selectedGuest.city || "") ||
          formData.guestState !== (selectedGuest.state || "") ||
          formData.guestPostalCode !== (selectedGuest.postalCode || "");

        if (addressChanged) {
          await apiClient.updateGuest(selectedGuest.id, {
            address1: formData.guestAddress1 || undefined,
            city: formData.guestCity || undefined,
            state: formData.guestState || undefined,
            postalCode: formData.guestPostalCode || undefined
          });
        }
      }

      const isCardPayment = formData.paymentMethod === "card";
      // For card payments, paid amount starts at 0 until payment modal confirms
      const paidAmountCents = isCardPayment ? 0 : paymentAmountCents;
      const cashNote =
        formData.paymentMethod === "cash" && cashReceivedCents > 0
          ? `Cash received $${(cashReceivedCents / 100).toFixed(2)}${cashChangeDueCents ? ` • Change due $${(cashChangeDueCents / 100).toFixed(2)}` : ""}`
          : "";
      const paymentNotes = [formData.paymentNotes, cashNote].filter(Boolean).join(" • ") || undefined;
      const needsOverride = lockFeeCents > 0 || pricingIsEstimate || quoteQuery.isError;
      const overrideReason = lockFeeCents > 0 ? "Site lock fee" : needsOverride ? "Manual rate estimate" : undefined;
      const overrideApprovedBy = overrideReason ? whoami?.user?.id || undefined : undefined;
      if (overrideReason && !overrideApprovedBy) {
        throw new Error("Override approval required. Refresh and try again.");
      }
      const payload: any = {
        campgroundId: selectedCampground!.id,
        guestId: formData.guestId,
        siteId: formData.siteId,
        arrivalDate: formData.arrivalDate,
        departureDate: formData.departureDate,
        adults: formData.adults,
        children: formData.children,
        pets: formData.pets,
        rigType: formData.rigType || undefined,
        rigLength: formData.rigLength ? Number(formData.rigLength) : undefined,
        notes: formData.notes || undefined,
        referralSource: formData.referralSource || undefined,
        stayReasonPreset: formData.stayReason || undefined,
        totalAmount: totalCents,
        paidAmount: paidAmountCents,
        balanceAmount: Math.max(0, totalCents - paidAmountCents),
        // Card payments start as "pending" until payment completes
        status: isCardPayment ? "pending" : "confirmed",
        paymentMethod: formData.paymentMethod,
        paymentNotes: !isCardPayment ? paymentNotes : undefined,
        siteLocked: formData.lockSite,
        overrideReason,
        overrideApprovedBy
      };

      console.log("[Booking] Creating reservation with payload:", JSON.stringify(payload, null, 2));
      return apiClient.createReservation(payload);
    },
    onSuccess: (reservation) => {
      queryClient.invalidateQueries({ queryKey: ["booking-lab-guests", selectedCampground?.id] });
      // Card payment: open modal to complete payment
      if (formData.paymentMethod === "card") {
        setPaymentModal({ reservationId: reservation.id, amountCents: paymentAmountCents });
        toast({ title: "Reservation created", description: "Complete payment to finish booking." });
        return;
      }
      // Cash/check/folio: show receipt
      setReceiptData({
        reservationId: reservation.id,
        guestName: `${reservation.guest?.primaryFirstName || ""} ${reservation.guest?.primaryLastName || ""}`.trim() || "Guest",
        siteName: reservation.site?.name || "Site",
        arrivalDate: reservation.arrivalDate,
        departureDate: reservation.departureDate,
        amountCents: paymentAmountCents,
        method: formData.paymentMethod || "cash",
        cashReceivedCents: formData.paymentMethod === "cash" ? cashReceivedCents : undefined,
        changeDueCents: formData.paymentMethod === "cash" ? cashChangeDueCents : undefined
      });
    },
    onError: (err: any) => {
      console.error("[Booking] Reservation creation failed:", err);
      toast({ title: "Booking failed", description: err?.message || "Please try again.", variant: "destructive" });
    }
  });

  const hasPricing = displayTotalCents !== null;
  const cardEntryBlocked = formData.paymentMethod === "card" && formData.cardEntryMode === "reader";
  const paymentReady =
    !!formData.paymentMethod &&
    paymentAmountCents > 0 &&
    (formData.paymentMethod !== "cash" || cashReceivedCents >= paymentAmountCents) &&
    !cardEntryBlocked;
  const canCreate =
    !!selectedCampground?.id &&
    !!formData.guestId &&
    !!formData.siteId &&
    dateRangeValid &&
    hasPricing &&
    paymentReady;

  return (
    <DashboardShell>
      <div className="px-6 py-6 w-full max-w-none space-y-6">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Booking", href: "/booking" }
          ]}
        />

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-emerald-600/10 text-emerald-700 flex items-center justify-center">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-black tracking-tight text-slate-900">New Booking</h1>
                </div>
                <p className="text-sm text-slate-500 font-medium">
                  Build a reservation in one flow - guest, stay, site, pricing, and payment.
                </p>
              </div>
            </div>

            {selectedCampground && (
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600">
                <MapPin className="h-4 w-4 text-emerald-600" />
                <span>{selectedCampground.name}</span>
              </div>
            )}
          </div>
        </div>

        {!selectedCampground && (
          <Card className="p-6 border-dashed border-slate-200 text-center text-slate-500">
            Choose a campground from the global selector to start a booking.
          </Card>
        )}

        {selectedCampground && (
          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <Card className="p-5 border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Guest</div>
                    <div className="text-lg font-black text-slate-900">Find or create</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setShowNewGuest((prev) => !prev)}>
                    <UserPlus className="h-4 w-4 mr-1" />
                    Add guest
                  </Button>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      className="h-10 pl-9"
                      placeholder="Search guest name, email, phone"
                      value={guestSearch}
                      onChange={(e) => {
                        setGuestSearch(e.target.value);
                        setShowGuestResults(true);
                      }}
                      onFocus={() => setShowGuestResults(true)}
                    />
                    {showGuestResults && guestSearch && (
                      <div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-lg">
                        {guestMatches.length === 0 && (
                          <div className="p-3 text-xs text-slate-500">No matching guests.</div>
                        )}
                        {guestMatches.map((guest) => {
                          const hasStayed = !guestStayedSet || guestStayedSet.has(guest.id);
                          return (
                            <button
                              key={guest.id}
                              type="button"
                              className={cn(
                                "w-full px-3 py-2 text-left text-sm hover:bg-slate-50",
                                !hasStayed && "text-slate-400"
                              )}
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, guestId: guest.id }));
                                setGuestSearch(`${guest.primaryFirstName} ${guest.primaryLastName}`.trim());
                                setShowGuestResults(false);
                              }}
                            >
                              <div className={cn("font-semibold", hasStayed ? "text-slate-800" : "text-slate-400")}>
                                {guest.primaryFirstName} {guest.primaryLastName}
                              </div>
                              <div className={cn("text-xs", hasStayed ? "text-slate-500" : "text-slate-400")}>
                                {guest.email}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {selectedGuest ? (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
                        <div className="flex items-center gap-2">
                          <BadgeCheck className="h-4 w-4" />
                          <div className="font-semibold">{selectedGuest.primaryFirstName} {selectedGuest.primaryLastName}</div>
                        </div>
                        <div className="mt-1 text-emerald-700">{selectedGuest.email}</div>
                        {selectedGuest.phone && (
                          <div className="mt-1 text-emerald-700">{selectedGuest.phone}</div>
                        )}
                        {guestStayedSet && !guestStayedSet.has(selectedGuest.id) && (
                          <div className="mt-1 text-[11px] text-emerald-700/80">No prior stays at this campground</div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-slate-500">Address</Label>
                        <Input
                          placeholder="Street address"
                          value={formData.guestAddress1}
                          onChange={(e) => setFormData((prev) => ({ ...prev, guestAddress1: e.target.value }))}
                        />
                        <div className="grid gap-2 sm:grid-cols-3">
                          <Input
                            placeholder="City"
                            value={formData.guestCity}
                            onChange={(e) => setFormData((prev) => ({ ...prev, guestCity: e.target.value }))}
                          />
                          <Input
                            placeholder="State"
                            value={formData.guestState}
                            onChange={(e) => setFormData((prev) => ({ ...prev, guestState: e.target.value }))}
                          />
                          <Input
                            placeholder="ZIP"
                            value={formData.guestPostalCode}
                            onChange={(e) => setFormData((prev) => ({ ...prev, guestPostalCode: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">Select a guest to unlock personalized recommendations.</div>
                  )}

                  {showNewGuest && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          placeholder="First name"
                          value={guestForm.primaryFirstName}
                          onChange={(e) => setGuestForm((prev) => ({ ...prev, primaryFirstName: e.target.value }))}
                        />
                        <Input
                          placeholder="Last name"
                          value={guestForm.primaryLastName}
                          onChange={(e) => setGuestForm((prev) => ({ ...prev, primaryLastName: e.target.value }))}
                        />
                      </div>
                      <Input
                        placeholder="Email"
                        value={guestForm.email}
                        onChange={(e) => setGuestForm((prev) => ({ ...prev, email: e.target.value }))}
                      />
                      <Input
                        placeholder="Phone"
                        value={guestForm.phone}
                        onChange={(e) => setGuestForm((prev) => ({ ...prev, phone: e.target.value }))}
                      />
                      <Input
                        placeholder="Street address"
                        value={guestForm.address1}
                        onChange={(e) => setGuestForm((prev) => ({ ...prev, address1: e.target.value }))}
                      />
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Input
                          placeholder="City"
                          value={guestForm.city}
                          onChange={(e) => setGuestForm((prev) => ({ ...prev, city: e.target.value }))}
                        />
                        <Input
                          placeholder="State"
                          value={guestForm.state}
                          onChange={(e) => setGuestForm((prev) => ({ ...prev, state: e.target.value }))}
                        />
                        <Input
                          placeholder="ZIP"
                          value={guestForm.postalCode}
                          onChange={(e) => setGuestForm((prev) => ({ ...prev, postalCode: e.target.value }))}
                        />
                      </div>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => createGuestMutation.mutate()}
                        disabled={!guestForm.primaryFirstName || !guestForm.primaryLastName || !guestForm.email}
                      >
                        Create guest
                      </Button>
                    </div>
                  )}
                </div>
              </Card>

              <Card className="p-5 border-slate-200 shadow-sm">
                <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Stay details</div>
                <div className="mt-4 space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Arrival</Label>
                      <Input
                        type="date"
                        value={formData.arrivalDate}
                        onChange={(e) => setFormData((prev) => ({ ...prev, arrivalDate: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Departure</Label>
                      <Input
                        type="date"
                        value={formData.departureDate}
                        onChange={(e) => setFormData((prev) => ({ ...prev, departureDate: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <CalendarDays className="h-4 w-4 text-emerald-500" />
                    <span>{nights ? `${nights} nights` : "Select dates"}</span>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Adults</Label>
                      <Input
                        type="number"
                        min={1}
                        value={formData.adults}
                        onChange={(e) => setFormData((prev) => ({ ...prev, adults: Number(e.target.value) }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Children</Label>
                      <Input
                        type="number"
                        min={0}
                        value={formData.children}
                        onChange={(e) => setFormData((prev) => ({ ...prev, children: Number(e.target.value) }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Pets</Label>
                      <Input
                        type="number"
                        min={0}
                        value={formData.pets}
                        onChange={(e) => setFormData((prev) => ({ ...prev, pets: Number(e.target.value) }))}
                      />
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Rig type</Label>
                      <Select
                        value={formData.rigType}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, rigType: value }))}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Select rig type" />
                        </SelectTrigger>
                        <SelectContent>
                          {RIG_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Rig length</Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="ft"
                        value={formData.rigLength}
                        onChange={(e) => setFormData((prev) => ({ ...prev, rigLength: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">How did you hear about us?</Label>
                      <Select
                        value={formData.referralSource}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, referralSource: value }))}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Select source" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="google">Google Search</SelectItem>
                          <SelectItem value="facebook">Facebook</SelectItem>
                          <SelectItem value="instagram">Instagram</SelectItem>
                          <SelectItem value="friend">Friend/Family</SelectItem>
                          <SelectItem value="repeat">Repeat Guest</SelectItem>
                          <SelectItem value="rvpark">RV Park Website</SelectItem>
                          <SelectItem value="campspot">Campspot</SelectItem>
                          <SelectItem value="hipcamp">Hipcamp</SelectItem>
                          <SelectItem value="driving_by">Driving By</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Reason for visit</Label>
                      <Select
                        value={formData.stayReason}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, stayReason: value }))}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Select reason" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vacation">Vacation</SelectItem>
                          <SelectItem value="family_visit">Family Visit</SelectItem>
                          <SelectItem value="event">Event</SelectItem>
                          <SelectItem value="work_remote">Work/Remote</SelectItem>
                          <SelectItem value="stopover">Stopover</SelectItem>
                          <SelectItem value="relocation">Relocation</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Internal notes</Label>
                    <Textarea
                      rows={3}
                      value={formData.notes}
                      onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                      placeholder="Preferences, VIP notes, housekeeping, etc."
                    />
                  </div>
                </div>
              </Card>

              {filteredMatches.length > 0 && (
                <Card className="p-5 border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold uppercase tracking-widest text-slate-500">AI suggestions</div>
                    <Sparkles className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="mt-3 space-y-2">
                    {filteredMatches.slice(0, 3).map((match) => (
                      <button
                        key={match.site.id}
                        type="button"
                        className="w-full rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-left text-sm"
                        onClick={() => setFormData((prev) => ({ ...prev, siteId: match.site.id }))}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-emerald-800">{match.site.name}</div>
                          <Badge className="bg-emerald-600 text-white text-[10px]">{match.score}%</Badge>
                        </div>
                        <div className="text-xs text-emerald-700">{match.reasons?.[0] || "High match"}</div>
                      </button>
                    ))}
                  </div>
                </Card>
              )}
            </div>

            <div className="space-y-4">
              <Card className="p-5 border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Availability</div>
                    <div className="text-lg font-black text-slate-900">Choose a site</div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Switch checked={availableOnly} onCheckedChange={setAvailableOnly} />
                    Available only
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Site type</Label>
                    <Select value={siteTypeFilter} onValueChange={setSiteTypeFilter}>
                      <SelectTrigger className="h-9">
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
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Site class</Label>
                    <Select value={siteClassFilter} onValueChange={setSiteClassFilter}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="All classes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {(siteClassesQuery.data || []).map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 flex items-center justify-between">
                    <span>Matches</span>
                    <span className="font-semibold text-slate-700">{filteredSites.length}</span>
                  </div>
                </div>

                {!dateRangeValid && (
                  <div className="mt-4 rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                    Select arrival and departure dates to view availability.
                  </div>
                )}

                {dateRangeValid && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredSites.map((site) => {
                      const typeKey = (site.siteType || "").toLowerCase();
                      const meta = SITE_TYPE_STYLES[typeKey] || SITE_TYPE_STYLES.default;
                      const displayName = site.name.replace(new RegExp(`^${meta.label}\\s+`, 'i'), '');
                      const displayNum = site.siteNumber.replace(new RegExp(`^${meta.label}`, 'i'), '');
                      const displayClass = (site.siteClassName || "Class").replace(new RegExp(`\\s+${meta.label}$`, 'i'), '');
                      const isSelected = formData.siteId === site.id;
                      const isDisabled = site.status !== "available";

                      return (
                        <button
                          key={site.id}
                          type="button"
                          className={cn(
                            "rounded-xl border p-3 text-left transition-all",
                            isSelected ? "border-emerald-400 bg-emerald-50" : "border-slate-200 hover:border-emerald-300",
                            isDisabled && "opacity-60 cursor-not-allowed"
                          )}
                          disabled={isDisabled}
                          onClick={() => setFormData((prev) => ({ ...prev, siteId: site.id }))}
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold text-slate-900">{displayName}</div>
                            <Badge className={cn("text-[10px]", meta.badge)}>{meta.label}</Badge>
                          </div>
                          <div className="text-xs text-slate-500">#{displayNum} • {displayClass}</div>
                          <div className="mt-2 flex items-center justify-between text-xs">
                            <span className="text-slate-500">{site.statusDetail || site.status}</span>
                            {site.defaultRate ? (
                              <span className="font-semibold text-slate-700">${(site.defaultRate / 100).toFixed(0)}/night</span>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}

                    {filteredSites.length === 0 && (
                      <div className="col-span-full rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                        No sites match your filters. Try changing the site type or class.
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="p-5 border-slate-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Pricing</div>
                    <div className="text-lg font-black text-slate-900">Reservation total</div>
                  </div>
                  <CircleDollarSign className="h-5 w-5 text-emerald-500" />
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Site</span>
                    <span className="font-semibold text-slate-800">{selectedSite?.name || "Select a site"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Dates</span>
                    <span className="font-semibold text-slate-800">
                      {formData.arrivalDate && formData.departureDate
                        ? `${formData.arrivalDate} → ${formData.departureDate}`
                        : "Set dates"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Nights</span>
                    <span className="font-semibold text-slate-800">{nights || "-"}</span>
                  </div>
                </div>

                {(quoteQuery.isError || pricingIsEstimate) && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                    {quoteQuery.isError
                      ? "Quote unavailable right now. Showing default rate estimate."
                      : "Estimate from default rate; final pricing may vary."}
                  </div>
                )}

                <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Subtotal</span>
                    <span className="font-semibold text-slate-800">
                      {displaySubtotalCents !== null ? `$${(displaySubtotalCents / 100).toFixed(2)}` : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Rules delta</span>
                    <span className="font-semibold text-slate-800">
                      {pricingRulesDeltaCents !== null ? `$${(pricingRulesDeltaCents / 100).toFixed(2)}` : "—"}
                    </span>
                  </div>
                  {lockFeeCents > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Site lock fee</span>
                      <span className="font-semibold text-slate-800">${(lockFeeCents / 100).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-base">
                    <span className="font-semibold text-slate-700">Total</span>
                    <span className="font-black text-slate-900">
                      {displayTotalCents !== null ? `$${(displayTotalCents / 100).toFixed(2)}` : "-"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <Switch
                    checked={formData.lockSite}
                    onCheckedChange={(value) => setFormData((prev) => ({ ...prev, lockSite: value }))}
                  />
                  <div className="text-xs text-slate-600 flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    Lock this site {siteLockFeeCents > 0 ? `(+$${(siteLockFeeCents / 100).toFixed(2)})` : ""}
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {formData.paymentMethod === "card" && (
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500">
                      {formData.cardEntryMode === "reader"
                        ? "Card reader payments require a connected terminal."
                        : "Manual card checkout opens right after the reservation is created."}
                    </div>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Amount to charge</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={formData.paymentAmount}
                        onChange={(e) => setFormData((prev) => ({ ...prev, paymentAmount: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Method</Label>
                      <Select
                        value={formData.paymentMethod}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, paymentMethod: value }))}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map((method) => (
                            <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {formData.paymentMethod === "card" && (
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Card entry</Label>
                        <Select
                          value={formData.cardEntryMode}
                          onValueChange={(value) => setFormData((prev) => ({ ...prev, cardEntryMode: value }))}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select entry method" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manual">Manual entry (keyed)</SelectItem>
                            <SelectItem value="reader">Card reader (coming soon)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {formData.cardEntryMode === "reader" && (
                        <div className="mt-2 text-[11px] text-amber-600">
                          Card reader payments are not enabled in this sandbox.
                        </div>
                      )}
                    </div>
                  )}
                  {formData.paymentMethod === "cash" && (
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-slate-500">Cash received</Label>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={formData.cashReceived}
                            onChange={(e) => setFormData((prev) => ({ ...prev, cashReceived: e.target.value }))}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-slate-500">Change due</Label>
                          <div className="h-10 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm flex items-center">
                            {cashChangeDueCents > 0 ? `$${(cashChangeDueCents / 100).toFixed(2)}` : "—"}
                          </div>
                        </div>
                      </div>
                      {cashShortCents > 0 && (
                        <div className="mt-2 text-xs text-amber-600">
                          Cash received is short by ${(cashShortCents / 100).toFixed(2)}.
                        </div>
                      )}
                    </div>
                  )}
                  <Textarea
                    rows={2}
                    placeholder="Payment notes"
                    value={formData.paymentNotes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, paymentNotes: e.target.value }))}
                  />
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => holdMutation.mutate()}
                    disabled={!formData.siteId || !dateRangeValid}
                  >
                    Place 30-min hold
                  </Button>
                  <Button
                    className="w-full gap-2"
                    onClick={() => createReservationMutation.mutate()}
                    disabled={!canCreate || createReservationMutation.isPending}
                  >
                    {createReservationMutation.isPending ? "Creating..." : "Collect payment & book"}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </Card>

              <Card className="p-4 border-slate-200 bg-slate-50 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Tip: Drag on the calendar to prefill site + dates.</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <ChevronsRight className="h-4 w-4 text-slate-400" />
                  <span>Use AI suggestions to jump to the best-fit site for the guest.</span>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
      {paymentModal && (
        <PaymentModal
          isOpen={!!paymentModal}
          reservationId={paymentModal.reservationId}
          amountCents={paymentModal.amountCents}
          entryMode={formData.cardEntryMode === "reader" ? "reader" : "manual"}
          defaultPostalCode={formData.guestPostalCode}
          onClose={() => {
            const reservationId = paymentModal.reservationId;
            setPaymentModal(null);
            if (paymentCompletedRef.current) {
              paymentCompletedRef.current = false;
              return;
            }
            apiClient.cancelReservation(reservationId).catch(() => undefined);
            toast({ title: "Payment canceled", description: "Reservation canceled." });
          }}
          onSuccess={() => {
            const reservationId = paymentModal.reservationId;
            paymentCompletedRef.current = true;
            setPaymentModal(null);
            apiClient.updateReservation(reservationId, { status: "confirmed" }).catch(() => undefined);
            toast({ title: "Payment captured", description: "Booking confirmed." });
            router.push(`/reservations/${reservationId}`);
          }}
        />
      )}
      {receiptData && (
        <Dialog open={!!receiptData} onOpenChange={() => {
          if (!receiptData) return;
          const reservationId = receiptData.reservationId;
          setReceiptData(null);
          router.push(`/reservations/${reservationId}`);
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Payment Receipt</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Reservation</span>
                <span className="font-semibold text-slate-900">#{receiptData.reservationId.slice(0, 8)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Guest</span>
                <span className="font-semibold text-slate-900">{receiptData.guestName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Site</span>
                <span className="font-semibold text-slate-900">{receiptData.siteName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Dates</span>
                <span className="font-semibold text-slate-900">{receiptData.arrivalDate} → {receiptData.departureDate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Method</span>
                <span className="font-semibold text-slate-900">{receiptData.method}</span>
              </div>
              <div className="flex items-center justify-between text-base">
                <span className="font-semibold text-slate-700">Amount</span>
                <span className="font-black text-slate-900">${(receiptData.amountCents / 100).toFixed(2)}</span>
              </div>
              {receiptData.cashReceivedCents !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Cash received</span>
                  <span className="font-semibold text-slate-900">${(receiptData.cashReceivedCents / 100).toFixed(2)}</span>
                </div>
              )}
              {receiptData.changeDueCents ? (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Change due</span>
                  <span className="font-semibold text-slate-900">${(receiptData.changeDueCents / 100).toFixed(2)}</span>
                </div>
              ) : null}
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  const receiptText = [
                    `Reservation #${receiptData.reservationId.slice(0, 8)}`,
                    `Guest: ${receiptData.guestName}`,
                    `Site: ${receiptData.siteName}`,
                    `Dates: ${receiptData.arrivalDate} → ${receiptData.departureDate}`,
                    `Method: ${receiptData.method}`,
                    `Amount: $${(receiptData.amountCents / 100).toFixed(2)}`,
                    receiptData.cashReceivedCents !== undefined
                      ? `Cash received: $${(receiptData.cashReceivedCents / 100).toFixed(2)}`
                      : "",
                    receiptData.changeDueCents
                      ? `Change due: $${(receiptData.changeDueCents / 100).toFixed(2)}`
                      : ""
                  ].filter(Boolean).join("\n");
                  if (navigator?.clipboard?.writeText) {
                    navigator.clipboard.writeText(receiptText).catch(() => undefined);
                    toast({ title: "Receipt copied", description: "Receipt details copied to clipboard." });
                  }
                }}
              >
                Copy receipt
              </Button>
              <Button onClick={() => {
                const reservationId = receiptData.reservationId;
                setReceiptData(null);
                router.push(`/reservations/${reservationId}`);
              }}>
                Done
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </DashboardShell>
  );
}
