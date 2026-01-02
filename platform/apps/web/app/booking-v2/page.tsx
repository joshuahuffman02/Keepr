"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ChevronsRight,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  HelpCircle,
  Info,
  Lock,
  MapPin,
  Search,
  Sparkles,
  UserPlus
} from "lucide-react";

import { DashboardShell } from "../../components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { Badge } from "../../components/ui/badge";
import { Textarea } from "../../components/ui/textarea";
import { useToast } from "../../components/ui/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../components/ui/collapsible";
import { PaymentCollectionModal } from "../../components/payments/PaymentCollectionModal";
import { BookingSuccessDialog, BookingReceiptData } from "../../components/booking/BookingSuccessDialog";
import { apiClient } from "../../lib/api-client";
import { cn } from "../../lib/utils";
import { useWhoami } from "@/hooks/use-whoami";
import { diffInDays, formatLocalDateInput, parseLocalDateInput } from "../calendar/utils";
import { useBookingFormPersistence, createDebouncedSave, BookingFormData } from "@/hooks/use-booking-form-persistence";

const SITE_TYPE_STYLES: Record<string, { label: string; badge: string; border: string }> = {
  rv: { label: "RV", badge: "bg-status-success/15 text-status-success", border: "border-l-status-success" },
  tent: { label: "Tent", badge: "bg-status-warning/15 text-status-warning", border: "border-l-status-warning" },
  cabin: { label: "Cabin", badge: "bg-rose-100 text-rose-700", border: "border-l-rose-400" },
  group: { label: "Group", badge: "bg-indigo-100 text-indigo-700", border: "border-l-indigo-400" },
  glamping: { label: "Glamp", badge: "bg-cyan-100 text-cyan-700", border: "border-l-cyan-400" },
  default: { label: "Site", badge: "bg-slate-100 text-slate-600", border: "border-l-slate-300" }
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

export default function BookingPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading booking...</div>}>
      <BookingPageInner />
    </Suspense>
  );
}

function BookingPageInner() {
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

  interface CampgroundWithFees {
    id: string;
    name?: string;
    siteSelectionFeeCents?: number;
  }
  const selectedCampground = campgrounds.find((cg) => cg.id === selectedCampgroundId) || null;
  const campgroundGuestTag = selectedCampground?.id ? `campground:${selectedCampground.id}` : null;
  const siteLockFeeCents = (selectedCampground as CampgroundWithFees)?.siteSelectionFeeCents ?? 0;

  const guestsQuery = useQuery({
    queryKey: ["booking-v2-guests", selectedCampground?.id],
    queryFn: () => apiClient.getGuests(selectedCampground?.id),
    enabled: !!selectedCampground?.id
  });

  const siteClassesQuery = useQuery({
    queryKey: ["booking-v2-site-classes", selectedCampground?.id],
    queryFn: () => apiClient.getSiteClasses(selectedCampground!.id),
    enabled: !!selectedCampground?.id
  });

  const reservationsQuery = useQuery({
    queryKey: ["booking-v2-reservations", selectedCampground?.id],
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
  const [receiptData, setReceiptData] = useState<BookingReceiptData | null>(null);

  // Form persistence for back navigation
  const { restoredData, hasRestoredData, saveFormData, clearFormData } = useBookingFormPersistence();
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showExitWarning, setShowExitWarning] = useState(false);

  // Validation errors state
  const [validationErrors, setValidationErrors] = useState<{
    guest?: string;
    dates?: string;
    site?: string;
    payment?: string;
  }>({});

  // Pricing breakdown expanded state
  const [priceBreakdownExpanded, setPriceBreakdownExpanded] = useState(true);

  // Show restore dialog if there's saved data
  useEffect(() => {
    if (hasRestoredData && !formData.guestId && !formData.siteId) {
      setShowRestoreDialog(true);
    }
  }, [hasRestoredData, formData.guestId, formData.siteId]);

  // Restore form data handler
  const handleRestoreData = useCallback(() => {
    if (!restoredData) return;
    setFormData((prev) => ({
      ...prev,
      arrivalDate: restoredData.arrivalDate || prev.arrivalDate,
      departureDate: restoredData.departureDate || prev.departureDate,
      adults: restoredData.adults ?? prev.adults,
      children: restoredData.children ?? prev.children,
      pets: restoredData.pets ?? prev.pets,
      rigType: restoredData.rigType || prev.rigType,
      rigLength: restoredData.rigLength || prev.rigLength,
      guestId: restoredData.guestId || prev.guestId,
      guestAddress1: restoredData.guestAddress1 || prev.guestAddress1,
      guestCity: restoredData.guestCity || prev.guestCity,
      guestState: restoredData.guestState || prev.guestState,
      guestPostalCode: restoredData.guestPostalCode || prev.guestPostalCode,
      siteId: restoredData.siteId || prev.siteId,
      siteClassId: restoredData.siteClassId || prev.siteClassId,
      lockSite: restoredData.lockSite ?? prev.lockSite,
      notes: restoredData.notes || prev.notes,
      referralSource: restoredData.referralSource || prev.referralSource,
      stayReason: restoredData.stayReason || prev.stayReason,
      collectPayment: restoredData.collectPayment ?? prev.collectPayment,
      paymentAmount: restoredData.paymentAmount || prev.paymentAmount,
      paymentMethod: restoredData.paymentMethod || prev.paymentMethod,
      cardEntryMode: restoredData.cardEntryMode || prev.cardEntryMode,
      cashReceived: restoredData.cashReceived || prev.cashReceived,
      paymentNotes: restoredData.paymentNotes || prev.paymentNotes
    }));
    if (restoredData.guestSearch) {
      setGuestSearch(restoredData.guestSearch);
    }
    if (restoredData.siteTypeFilter) {
      setSiteTypeFilter(restoredData.siteTypeFilter);
    }
    if (restoredData.siteClassFilter) {
      setSiteClassFilter(restoredData.siteClassFilter);
    }
    if (restoredData.newGuest) {
      setGuestForm(restoredData.newGuest);
      setShowNewGuest(true);
    }
    setShowRestoreDialog(false);
    toast({ title: "Form restored", description: "Your previous booking data has been restored." });
  }, [restoredData, toast]);

  // Auto-save form data on changes (debounced)
  const debouncedSave = useMemo(
    () => createDebouncedSave(saveFormData, 1000),
    [saveFormData]
  );

  // Validate form before submission
  const validateForm = useCallback(() => {
    const errors: typeof validationErrors = {};

    if (!formData.guestId) {
      errors.guest = "Please select or create a guest";
    }

    if (!formData.arrivalDate || !formData.departureDate) {
      errors.dates = "Please select arrival and departure dates";
    } else {
      const arrival = parseLocalDateInput(formData.arrivalDate);
      const departure = parseLocalDateInput(formData.departureDate);
      if (departure <= arrival) {
        errors.dates = "Departure date must be after arrival date";
      }
    }

    if (!formData.siteId) {
      errors.site = "Please select a site";
    }

    // Only validate payment if we're collecting payment now
    if (formData.collectPayment) {
      const amount = parseFloat(formData.paymentAmount);
      if (isNaN(amount) || amount <= 0) {
        errors.payment = "Please enter a valid payment amount";
      }
      if (formData.paymentMethod === "cash") {
        const cashReceived = parseFloat(formData.cashReceived);
        if (isNaN(cashReceived) || cashReceived < amount) {
          errors.payment = "Cash received must be at least the payment amount";
        }
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // Handle back navigation with warning
  const handleBackNavigation = useCallback(() => {
    const hasUnsavedData = formData.guestId || formData.siteId || formData.notes;
    if (hasUnsavedData) {
      setShowExitWarning(true);
    } else {
      router.back();
    }
  }, [formData, router]);

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
    queryKey: ["booking-v2-site-status", selectedCampground?.id, formData.arrivalDate, formData.departureDate],
    queryFn: () => apiClient.getSitesWithStatus(selectedCampground!.id, {
      arrivalDate: formData.arrivalDate,
      departureDate: formData.departureDate
    }),
    enabled: !!selectedCampground?.id && dateRangeValid
  });

  const [siteTypeFilter, setSiteTypeFilter] = useState(initialSiteTypeFilter);
  const [siteClassFilter, setSiteClassFilter] = useState(initialSiteClassId || "all");
  const [availableOnly, setAvailableOnly] = useState(true);

  // Save form state whenever it changes (after all state declarations)
  useEffect(() => {
    // Only save if we have meaningful data
    if (formData.guestId || formData.siteId || formData.arrivalDate) {
      debouncedSave({
        ...formData,
        guestSearch,
        siteTypeFilter,
        siteClassFilter,
        newGuest: showNewGuest ? guestForm : undefined,
        campgroundId: selectedCampground?.id
      });
    }
  }, [formData, guestSearch, siteTypeFilter, siteClassFilter, showNewGuest, guestForm, selectedCampground?.id, debouncedSave]);
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
  const rigTypeFilter = useMemo(() => {
    if (isRvRigType) return new Set(["rv"]);
    if (formData.rigType === "tent") return new Set(["tent"]);
    if (formData.rigType === "cabin") return new Set(["cabin", "glamping"]);
    if (formData.rigType === "group") return new Set(["group"]);
    return null;
  }, [formData.rigType, isRvRigType]);

  const filteredSites = useMemo(() => {
    const sites = siteStatusQuery.data || [];
    return sites.filter((site) => {
      if (availableOnly && site.status !== "available") return false;
      if (siteTypeFilter !== "all" && site.siteType !== siteTypeFilter) return false;
      if (siteClassFilter !== "all" && site.siteClassId !== siteClassFilter) return false;
      if (rigTypeFilter && !rigTypeFilter.has(site.siteType)) return false;
      if (hasRigLength && rigTypeFilter?.has("rv")) {
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
    rigTypeFilter,
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
    queryKey: ["booking-v2-quote", selectedCampground?.id, formData.siteId, formData.arrivalDate, formData.departureDate],
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
    queryKey: ["booking-v2-matches", selectedCampground?.id, formData.guestId],
    queryFn: () => apiClient.getMatchedSites(selectedCampground!.id, formData.guestId),
    enabled: !!selectedCampground?.id && !!formData.guestId
  });
  const filteredMatches = useMemo(() => {
    const matches = matchesQuery.data || [];
    return matches.filter((match) => {
      const siteType = (match.site.siteType || "").toLowerCase();
      if (rigTypeFilter && !rigTypeFilter.has(siteType)) return false;
      if (siteTypeFilter !== "all" && siteType !== siteTypeFilter) return false;
      if (hasRigLength && rigTypeFilter?.has("rv")) {
        const maxLength = match.site.rigMaxLength ?? match.site.siteClass?.rigMaxLength ?? null;
        if (maxLength && rigLengthValue > maxLength) return false;
      }
      return true;
    });
  }, [matchesQuery.data, rigTypeFilter, siteTypeFilter, hasRigLength, rigLengthValue]);

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
        ["booking-v2-guests", selectedCampground?.id],
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

      // If not collecting payment, skip payment logic
      const isCardPayment = formData.collectPayment && formData.paymentMethod === "card";
      // For card payments, paid amount starts at 0 until payment modal confirms
      // For pay later, paid amount is also 0
      const paidAmountCents = (isCardPayment || !formData.collectPayment) ? 0 : paymentAmountCents;
      const cashNote =
        formData.collectPayment && formData.paymentMethod === "cash" && cashReceivedCents > 0
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
        // Card payments and pay later start as "pending" until payment completes
        status: (isCardPayment || !formData.collectPayment) ? "pending" : "confirmed",
        paymentMethod: formData.collectPayment ? formData.paymentMethod : undefined,
        paymentNotes: (formData.collectPayment && !isCardPayment) ? paymentNotes : undefined,
        siteLocked: formData.lockSite,
        overrideReason,
        overrideApprovedBy
      };

      console.log("[Booking] Creating reservation with payload:", JSON.stringify(payload, null, 2));
      return apiClient.createReservation(payload);
    },
    onSuccess: (reservation) => {
      queryClient.invalidateQueries({ queryKey: ["booking-v2-guests", selectedCampground?.id] });
      // Clear saved form data on successful booking
      clearFormData();

      // Pay later: redirect to reservation with success message
      if (!formData.collectPayment) {
        toast({
          title: "Reservation created",
          description: "Invoice will be sent to guest. Reservation is pending payment."
        });
        router.push(`/reservations/${reservation.id}`);
        return;
      }

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
    !formData.collectPayment || (
      !!formData.paymentMethod &&
      paymentAmountCents > 0 &&
      (formData.paymentMethod !== "cash" || cashReceivedCents >= paymentAmountCents) &&
      !cardEntryBlocked
    );
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
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBackNavigation}
                className="h-11 w-11 rounded-2xl"
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
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
              <Card className={cn(
                "p-5 border-slate-200 shadow-sm",
                validationErrors.guest && "border-red-300 ring-2 ring-red-100"
              )}>
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
                {validationErrors.guest && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-red-600" role="alert">
                    <AlertCircle className="h-4 w-4" />
                    <span>{validationErrors.guest}</span>
                  </div>
                )}

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
                      <div className="rounded-xl border border-status-success/20 bg-status-success/15 px-4 py-3 text-xs text-status-success">
                        <div className="flex items-center gap-2">
                          <BadgeCheck className="h-4 w-4" />
                          <div className="font-semibold">{selectedGuest.primaryFirstName} {selectedGuest.primaryLastName}</div>
                        </div>
                        <div className="mt-1">{selectedGuest.email}</div>
                        {selectedGuest.phone && (
                          <div className="mt-1">{selectedGuest.phone}</div>
                        )}
                        {guestStayedSet && !guestStayedSet.has(selectedGuest.id) && (
                          <div className="mt-1 text-[11px] opacity-80">No prior stays at this campground</div>
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

              <Card className={cn(
                "p-5 border-slate-200 shadow-sm",
                validationErrors.dates && "border-red-300 ring-2 ring-red-100"
              )}>
                <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Stay details</div>
                {validationErrors.dates && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-red-600" role="alert">
                    <AlertCircle className="h-4 w-4" />
                    <span>{validationErrors.dates}</span>
                  </div>
                )}
                <div className="mt-4 space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Arrival</Label>
                      <Input
                        type="date"
                        value={formData.arrivalDate}
                        onChange={(e) => {
                          setFormData((prev) => ({ ...prev, arrivalDate: e.target.value }));
                          if (validationErrors.dates) setValidationErrors((prev) => ({ ...prev, dates: undefined }));
                        }}
                        className={validationErrors.dates ? "border-red-300" : ""}
                        aria-invalid={!!validationErrors.dates}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Departure</Label>
                      <Input
                        type="date"
                        value={formData.departureDate}
                        onChange={(e) => {
                          setFormData((prev) => ({ ...prev, departureDate: e.target.value }));
                          if (validationErrors.dates) setValidationErrors((prev) => ({ ...prev, dates: undefined }));
                        }}
                        className={validationErrors.dates ? "border-red-300" : ""}
                        aria-invalid={!!validationErrors.dates}
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
                    {filteredMatches.slice(0, 3).map((match) => {
                      // Get up to 2 reasons, or generate fallback reasons based on site attributes
                      const displayReasons = match.reasons && match.reasons.length > 0
                        ? match.reasons.slice(0, 2)
                        : (() => {
                            const fallbacks: string[] = [];
                            if (match.score >= 85) fallbacks.push("Excellent match for guest preferences");
                            else if (match.score >= 70) fallbacks.push("Good match for stay requirements");
                            else if (match.score >= 55) fallbacks.push("Compatible with guest profile");

                            // Add generic reason based on site features if available
                            if (match.site.vibeTags && Array.isArray(match.site.vibeTags) && match.site.vibeTags.length > 0) {
                              const tags = match.site.vibeTags.slice(0, 1).join(", ");
                              fallbacks.push(`Features: ${tags}`);
                            }
                            return fallbacks.slice(0, 2);
                          })();

                      return (
                        <button
                          key={match.site.id}
                          type="button"
                          className="w-full rounded-lg border border-status-success/20 bg-status-success/15 px-3 py-2.5 text-left text-sm hover:bg-status-success/20 transition-colors"
                          onClick={() => setFormData((prev) => ({ ...prev, siteId: match.site.id }))}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="font-semibold text-status-success">{match.site.name}</div>
                            <Badge className="bg-status-success text-white text-[10px]">{match.score}%</Badge>
                          </div>
                          {displayReasons.length > 0 && (
                            <div className="space-y-0.5">
                              {displayReasons.map((reason, idx) => (
                                <div key={idx} className="flex items-start gap-1.5 text-[11px] text-status-success/80">
                                  <span className="mt-0.5">•</span>
                                  <span className="flex-1">{reason}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </Card>
              )}
            </div>

            <div className="space-y-4">
              <Card className={cn(
                "p-5 border-slate-200 shadow-sm",
                validationErrors.site && "border-red-300 ring-2 ring-red-100"
              )}>
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
                {validationErrors.site && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-red-600" role="alert">
                    <AlertCircle className="h-4 w-4" />
                    <span>{validationErrors.site}</span>
                  </div>
                )}

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
                            "rounded-xl border border-l-4 p-3 text-left transition-all",
                            isSelected ? "border-status-success bg-status-success/15" : "border-slate-200 hover:border-status-success/50",
                            isDisabled && "opacity-60 cursor-not-allowed",
                            meta.border
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

                {/* Booking summary */}
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
                    <span className="text-slate-500">Duration</span>
                    <span className="font-semibold text-slate-800">{nights ? `${nights} night${nights === 1 ? "" : "s"}` : "-"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Guests</span>
                    <span className="font-semibold text-slate-800">
                      {formData.adults} adult{formData.adults !== 1 ? "s" : ""}
                      {formData.children > 0 && `, ${formData.children} child${formData.children !== 1 ? "ren" : ""}`}
                      {formData.pets > 0 && `, ${formData.pets} pet${formData.pets !== 1 ? "s" : ""}`}
                    </span>
                  </div>
                </div>

                {(quoteQuery.isError || pricingIsEstimate) && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 flex items-start gap-2">
                    <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>
                      {quoteQuery.isError
                        ? "Live quote unavailable. Showing estimated rate based on site default pricing."
                        : "Estimate based on default rate. Final pricing may vary with promotions or seasonal rates."}
                    </span>
                  </div>
                )}

                {/* Detailed price breakdown */}
                <TooltipProvider>
                  <Collapsible
                    open={priceBreakdownExpanded}
                    onOpenChange={setPriceBreakdownExpanded}
                    className="mt-4 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden"
                  >
                    <div className="px-3 py-2 bg-slate-100 border-b border-slate-200">
                      <CollapsibleTrigger className="w-full group">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                            <CircleDollarSign className="h-3.5 w-3.5" />
                            Price Breakdown
                          </div>
                          <div className="flex items-center gap-1">
                            {displayTotalCents !== null && !priceBreakdownExpanded && (
                              <span className="text-sm font-bold text-slate-900 mr-2">
                                ${(displayTotalCents / 100).toFixed(2)}
                              </span>
                            )}
                            {priceBreakdownExpanded ? (
                              <ChevronUp className="h-4 w-4 text-slate-500 group-hover:text-slate-700" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-slate-500 group-hover:text-slate-700" />
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent className="px-3 py-3 space-y-2 text-sm">
                      {/* Nightly rate calculation */}
                      {nights > 0 && pricingSubtotalCents !== null && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-600">
                              ${((pricingSubtotalCents / nights) / 100).toFixed(2)} x {nights} night{nights === 1 ? "" : "s"}
                            </span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button type="button" className="text-slate-400 hover:text-slate-600">
                                  <HelpCircle className="h-3.5 w-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p className="text-xs">
                                  Base nightly rate for {selectedSite?.name || "the selected site"}.
                                  This is calculated from the site class default rate or site-specific pricing.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <span className="font-medium text-slate-800">
                            ${(pricingSubtotalCents / 100).toFixed(2)}
                          </span>
                        </div>
                      )}
                      {nights === 0 && (
                        <div className="flex items-center justify-between text-slate-500">
                          <span>Site rate</span>
                          <span>-</span>
                        </div>
                      )}

                      {/* Pricing rules adjustment */}
                      {pricingRulesDeltaCents !== null && pricingRulesDeltaCents !== 0 && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className={pricingRulesDeltaCents < 0 ? "text-emerald-600" : "text-slate-600"}>
                              {pricingRulesDeltaCents < 0 ? "Discount applied" : "Rate adjustment"}
                            </span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button type="button" className={pricingRulesDeltaCents < 0 ? "text-emerald-500 hover:text-emerald-700" : "text-slate-400 hover:text-slate-600"}>
                                  <HelpCircle className="h-3.5 w-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p className="text-xs font-semibold mb-1">Why this adjustment?</p>
                                <ul className="text-xs space-y-1">
                                  {pricingRulesDeltaCents < 0 ? (
                                    <>
                                      <li>• Length-of-stay discount (7+ nights)</li>
                                      <li>• Promotional offer applied</li>
                                      <li>• Off-season pricing</li>
                                    </>
                                  ) : (
                                    <>
                                      <li>• Weekend rate premium</li>
                                      <li>• Peak season pricing</li>
                                      <li>• Holiday rate increase</li>
                                    </>
                                  )}
                                </ul>
                                <p className="text-xs text-slate-500 mt-2">
                                  These pricing rules are configured in your campground settings.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <span className={pricingRulesDeltaCents < 0 ? "font-medium text-emerald-600" : "font-medium text-slate-800"}>
                            {pricingRulesDeltaCents < 0 ? "-" : "+"}${(Math.abs(pricingRulesDeltaCents) / 100).toFixed(2)}
                          </span>
                        </div>
                      )}

                      {/* Site lock fee */}
                      {lockFeeCents > 0 && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-600 flex items-center gap-1">
                              <Lock className="h-3 w-3" />
                              Site reservation fee
                            </span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button type="button" className="text-slate-400 hover:text-slate-600">
                                  <HelpCircle className="h-3.5 w-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p className="text-xs">
                                  One-time fee to guarantee this specific site for your stay.
                                  Without this, you'll receive a site from the same class but not a specific site number.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <span className="font-medium text-slate-800">
                            +${(lockFeeCents / 100).toFixed(2)}
                          </span>
                        </div>
                      )}

                      {/* Additional fees could be added here in the future */}
                      {/* Examples: cleaning fee, service fee, pet fee, etc. */}

                      {/* Divider and total */}
                      <div className="border-t border-slate-200 pt-2 mt-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">Total due</span>
                          <span className="text-lg font-black text-slate-900">
                            {displayTotalCents !== null ? `$${(displayTotalCents / 100).toFixed(2)}` : "-"}
                          </span>
                        </div>
                        {displayTotalCents !== null && displayTotalCents > 0 && (
                          <p className="text-xs text-slate-500 mt-1">
                            Amount charged at checkout
                          </p>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </TooltipProvider>

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

                <div className="mt-4 border-t border-slate-200 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Payment</div>
                      <div className="text-sm font-semibold text-slate-900">Collection timing</div>
                    </div>
                    <Switch
                      checked={formData.collectPayment}
                      onCheckedChange={(value) => setFormData((prev) => ({ ...prev, collectPayment: value }))}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <CircleDollarSign className="h-3.5 w-3.5 text-emerald-600" />
                    <span>
                      {formData.collectPayment
                        ? "Collect payment now during booking"
                        : "Send invoice / Pay later - guest will receive invoice by email"}
                    </span>
                  </div>
                </div>

                {formData.collectPayment && (
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
                            <SelectItem value="reader" disabled>Card reader (requires terminal setup)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {formData.cardEntryMode === "reader" && (
                        <div className="mt-2 text-[11px] text-amber-600">
                          Card reader requires terminal configuration. Go to Settings &gt; Payments to set up.
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
                        <div className="mt-2 text-xs text-status-warning">
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
                )}

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
                    onClick={() => {
                      if (validateForm()) {
                        createReservationMutation.mutate();
                      } else {
                        toast({
                          title: "Please complete all required fields",
                          description: "Check the highlighted sections for missing information.",
                          variant: "destructive"
                        });
                      }
                    }}
                    disabled={createReservationMutation.isPending}
                  >
                    {createReservationMutation.isPending
                      ? "Creating..."
                      : formData.collectPayment
                      ? "Collect payment & book"
                      : "Create reservation (invoice later)"}
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
      {paymentModal && selectedCampground && (
        <PaymentCollectionModal
          isOpen={!!paymentModal}
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
          campgroundId={selectedCampground.id}
          amountDueCents={paymentModal.amountCents}
          subject={{ type: "reservation", reservationId: paymentModal.reservationId }}
          context="staff_booking"
          guestId={formData.guestId || undefined}
          guestEmail={selectedGuest?.email || undefined}
          guestName={selectedGuest ? `${selectedGuest.primaryFirstName || ''} ${selectedGuest.primaryLastName || ''}`.trim() : undefined}
          enableSplitTender={true}
          enableCharityRoundUp={true}
          onSuccess={(result) => {
            const reservationId = paymentModal.reservationId;
            paymentCompletedRef.current = true;
            setPaymentModal(null);
            apiClient.updateReservation(reservationId, { status: "confirmed" }).catch(() => undefined);
            toast({ title: "Payment captured", description: `$${(result.totalPaidCents / 100).toFixed(2)} collected. Booking confirmed.` });
            router.push(`/reservations/${reservationId}`);
          }}
          onError={(error) => {
            toast({ title: "Payment failed", description: error.message, variant: "destructive" });
          }}
        />
      )}
      <BookingSuccessDialog
        open={!!receiptData}
        receiptData={receiptData}
        onClose={() => {
          if (!receiptData) return;
          const reservationId = receiptData.reservationId;
          setReceiptData(null);
          router.push(`/reservations/${reservationId}`);
        }}
        onDone={(reservationId) => {
          setReceiptData(null);
          router.push(`/reservations/${reservationId}`);
        }}
      />

      {/* Restore saved form data dialog */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resume previous booking?</DialogTitle>
            <DialogDescription>
              You have a booking in progress from earlier. Would you like to continue where you left off?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {restoredData && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm space-y-1">
                {restoredData.arrivalDate && restoredData.departureDate && (
                  <p className="text-slate-600">
                    <span className="text-slate-500">Dates:</span>{" "}
                    {restoredData.arrivalDate} to {restoredData.departureDate}
                  </p>
                )}
                {restoredData.guestSearch && (
                  <p className="text-slate-600">
                    <span className="text-slate-500">Guest:</span> {restoredData.guestSearch}
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => {
                clearFormData();
                setShowRestoreDialog(false);
              }}
            >
              Start fresh
            </Button>
            <Button onClick={handleRestoreData}>
              Resume booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exit warning dialog */}
      <Dialog open={showExitWarning} onOpenChange={setShowExitWarning}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Leave booking page?</DialogTitle>
            <DialogDescription>
              Your booking progress will be saved. You can return later to continue.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setShowExitWarning(false)}
            >
              Stay on page
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                clearFormData();
                router.back();
              }}
            >
              Discard and leave
            </Button>
            <Button
              onClick={() => {
                setShowExitWarning(false);
                router.back();
              }}
            >
              Save and leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
