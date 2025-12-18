"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "../../components/ui/layout/DashboardShell";
import { Breadcrumbs } from "../../components/breadcrumbs";
import { Button } from "../../components/ui/button";
import { apiClient } from "../../lib/api-client";
import { Calendar, Users, MapPin, DollarSign, CheckCircle, Plus, X, CreditCard, Banknote, Printer, Mail, ArrowRight, Search, UserPlus, History, Star, Sparkles, Zap, MessageSquare, Coffee, Trees as TreePine, Map as MapIcon } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { HelpAnchor } from "../../components/help/HelpAnchor";
import { BookingMap } from "../../components/maps/BookingMap";

function NewReservationInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialGuestId = searchParams.get("guestId");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (initialGuestId) {
      setFormData(prev => ({ ...prev, guestId: initialGuestId }));
    }
  }, [initialGuestId]);
  const { toast } = useToast();

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
    const storedValid = stored && campgrounds.some(cg => cg.id === stored);
    const currentValid = selectedCampgroundId && campgrounds.some(cg => cg.id === selectedCampgroundId);

    if (!currentValid && storedValid) {
      setSelectedCampgroundId(stored as string);
      return;
    }
    if (!currentValid && campgrounds.length > 0) {
      setSelectedCampgroundId(campgrounds[0].id);
    }
  }, [campgrounds, selectedCampgroundId]);

  const selectedCampground = campgrounds.find(cg => cg.id === selectedCampgroundId) || campgrounds[0];

  const sitesQuery = useQuery({
    queryKey: ["sites", selectedCampground?.id],
    queryFn: () => apiClient.getSites(selectedCampground!.id),
    enabled: !!selectedCampground?.id
  });

  const siteClassesQuery = useQuery({
    queryKey: ["site-classes", selectedCampground?.id],
    queryFn: () => apiClient.getSiteClasses(selectedCampground!.id),
    enabled: !!selectedCampground?.id
  });

  const guestsQuery = useQuery({
    queryKey: ["guests"],
    queryFn: () => apiClient.getGuests()
  });

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    guestId: "",
    siteId: "",
    siteClassId: "",
    lockSpecificSite: false,
    arrivalDate: "",
    departureDate: "",
    adults: 2,
    children: 0,
    pets: 0,
    rvLength: 0,
    rvType: "",
    notes: ""
  });

  const matchesQuery = useQuery({
    queryKey: ["matches", selectedCampground?.id, formData.guestId],
    queryFn: () => apiClient.getMatchedSites(selectedCampground!.id, formData.guestId),
    enabled: !!selectedCampground?.id && !!formData.guestId
  });

  const paymentSettingsQuery = useQuery({
    queryKey: ["payment-settings-admin", selectedCampground?.id],
    queryFn: () => apiClient.getCampgroundPaymentSettings(selectedCampground!.id),
    enabled: !!selectedCampground?.id,
    staleTime: 30_000
  });

  const paymentsGating = useMemo(() => {
    const s = paymentSettingsQuery.data;
    if (!s?.stripeAccountId) return { stale: true, ach: false, wallets: false };
    const fetched = s.stripeCapabilitiesFetchedAt ? new Date(s.stripeCapabilitiesFetchedAt).getTime() : 0;
    const stale = !fetched || (Date.now() - fetched > 24 * 60 * 60 * 1000);
    const caps = s.stripeCapabilities || {};
    const ach = caps.us_bank_account_ach_payments === "active";
    const wallets = caps.card_payments === "active" && caps.transfers === "active" && (caps.apple_pay === "active" || caps.google_pay === "active" || caps.link_payments === "active");
    return { stale, ach, wallets };
  }, [paymentSettingsQuery.data]);

  const holdMutation = useMutation({
    mutationFn: async () => {
      if (!formData.siteId || !selectedCampground?.id || !formData.arrivalDate || !formData.departureDate) return;
      return apiClient.createHold({
        campgroundId: selectedCampground.id,
        siteId: formData.siteId,
        arrivalDate: formData.arrivalDate,
        departureDate: formData.departureDate,
        holdMinutes: 30
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-status", selectedCampground?.id, formData.arrivalDate, formData.departureDate] });
      toast({ title: "Hold placed", description: "Site held for 30 minutes." });
    },
    onError: () => toast({ title: "Hold failed", description: "Could not place hold.", variant: "destructive" })
  });

  const siteStatusQuery = useQuery({
    queryKey: ["site-status", selectedCampground?.id, formData.arrivalDate, formData.departureDate],
    queryFn: () => apiClient.getSitesWithStatus(selectedCampground!.id, {
      arrivalDate: formData.arrivalDate,
      departureDate: formData.departureDate
    }),
    enabled: !!selectedCampground?.id && !!formData.arrivalDate && !!formData.departureDate
  });

  const mapSites = (siteStatusQuery.data ?? []).map(s => ({
    ...s,
    status: s.status as "available" | "occupied" | "maintenance",
    latitude: s.latitude ?? null,
    longitude: s.longitude ?? null
  }));

  const campgroundCenter = selectedCampground
    ? {
      latitude: selectedCampground.latitude ? Number(selectedCampground.latitude) : null,
      longitude: selectedCampground.longitude ? Number(selectedCampground.longitude) : null
    }
    : undefined;

  const selectedSiteStatus = formData.siteId
    ? (siteStatusQuery.data ?? []).find(s => s.id === formData.siteId)
    : null;

  const [showNewGuestModal, setShowNewGuestModal] = useState(false);
  const [guestSearch, setGuestSearch] = useState("");
  const [showGuestDropdown, setShowGuestDropdown] = useState(false);
  const [newGuestData, setNewGuestData] = useState({
    primaryFirstName: "",
    primaryLastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    rvLength: 0,
    rvType: ""
  });

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentData, setPaymentData] = useState({
    paymentAmount: 0,
    paymentMethod: "",
    transactionId: "",
    notes: ""
  });

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmedReservation, setConfirmedReservation] = useState<any>(null);

  // Upsell State
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [selectedUpsells, setSelectedUpsells] = useState<string[]>([]);
  const [showCopilot, setShowCopilot] = useState(false);

  const upsellItemsQuery = useQuery({
    queryKey: ["upsell-items", selectedCampground?.id],
    queryFn: () => apiClient.getUpsellItems(selectedCampground!.id),
    enabled: !!selectedCampground?.id
  });

  const upsellOptions = useMemo(() => {
    return (upsellItemsQuery.data || [])
      .filter(item => item.active)
      .map(item => ({
        id: item.id,
        label: item.name,
        price: item.priceCents,
        // Simple condition: always show unless it requires pets/children logic which we can't easily map from generic items yet
        // For now, show all active upsells
        condition: (data: any) => true
      }));
  }, [upsellItemsQuery.data]);

  const relevantUpsells = upsellOptions.filter(opt => opt.condition(formData));

  const handleAddUpsells = () => {
    const upsellNotes = selectedUpsells.map(id => {
      const opt = upsellOptions.find(o => o.id === id);
      return `Added ${opt?.label} ($${(opt?.price || 0) / 100})`;
    }).join(", ");

    if (upsellNotes) {
      setFormData(prev => ({
        ...prev,
        notes: prev.notes ? `${prev.notes}\n\n${upsellNotes}` : upsellNotes
      }));
    }
    setShowUpsellModal(false);
    setStep(3);
  };

  // Site filters
  const [siteFilters, setSiteFilters] = useState({
    amenities: [] as string[]
  });

  const createGuest = useMutation({
    mutationFn: (data: any) => apiClient.createGuest(data),
    onSuccess: (newGuest) => {
      queryClient.setQueryData<any[]>(["guests"], (prev = []) => {
        if (prev.some((g) => g.id === newGuest.id)) return prev;
        return [newGuest, ...prev];
      });
      queryClient.invalidateQueries({ queryKey: ["guests"] });
      setFormData({
        ...formData,
        guestId: newGuest.id,
        rvLength: newGuest.rigLength || 0,
        rvType: newGuest.rigType || ""
      });
      setShowNewGuestModal(false);
      setNewGuestData({
        primaryFirstName: "",
        primaryLastName: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        state: "",
        zip: "",
        rvLength: 0,
        rvType: ""
      });
      toast({ title: "Guest created", description: "Guest profile saved successfully." });
    },
    onError: (err) => {
      toast({
        title: "Failed to create guest",
        description: err instanceof Error ? err.message : "Please check the form and try again.",
        variant: "destructive"
      });
    }
  });

  const updateGuestRig = useMutation({
    mutationFn: (data: { guestId: string; rigType: string | null; rigLength: number | null }) =>
      apiClient.updateGuest(data.guestId, { rigType: data.rigType, rigLength: data.rigLength }),
    onSuccess: (updatedGuest) => {
      queryClient.setQueryData<any[]>(["guests"], (prev = []) =>
        prev.map((g) => (g.id === updatedGuest.id ? { ...g, ...updatedGuest } : g))
      );
    }
  });

  const createReservation = useMutation({
    mutationFn: (data: any) => apiClient.createReservation(data),
    onSuccess: (newReservation) => {
      console.log("Reservation created successfully:", newReservation);
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      setConfirmedReservation(newReservation);
      setShowPaymentModal(false);
      setShowConfirmation(true);
      // Email receipt will be sent automatically by the API after reservation creation
    },
    onError: (error) => {
      console.error("Failed to create reservation:", error);
      alert("Failed to create reservation. Please try again or contact support.");
    }
  });

  // Auto-populate departure date 3 days after arrival
  useEffect(() => {
    if (formData.arrivalDate && !formData.departureDate) {
      const arrival = new Date(formData.arrivalDate);
      const departure = new Date(arrival);
      departure.setDate(departure.getDate() + 3);
      const departureStr = departure.toISOString().split('T')[0];
      setFormData(prev => ({ ...prev, departureDate: departureStr }));
    }
  }, [formData.arrivalDate, formData.departureDate]);

  // Auto-populate RV details when guest is selected
  useEffect(() => {
    if (formData.guestId && guestsQuery.data) {
      const selectedGuest = guestsQuery.data.find((g: any) => g.id === formData.guestId);
      if (selectedGuest) {
        setFormData(prev => ({
          ...prev,
          rvLength: selectedGuest.rigLength || 0,
          rvType: selectedGuest.rigType || ""
        }));
      }
    }
  }, [formData.guestId, guestsQuery.data]);

  // Debug: Log when confirmation state changes
  useEffect(() => {
    console.log("Confirmation state changed:", {
      showConfirmation,
      hasReservation: !!confirmedReservation,
      reservationId: confirmedReservation?.id
    });
  }, [showConfirmation, confirmedReservation]);

  // Close guest dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.guest-search-container')) {
        setShowGuestDropdown(false);
      }
    };

    if (showGuestDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showGuestDropdown]);

  // Helper functions for preset buttons
  const setPresetDates = (nights: number) => {
    const today = new Date();
    const arrival = today.toISOString().split('T')[0];
    const departureDate = new Date(today);
    departureDate.setDate(departureDate.getDate() + nights);
    const departure = departureDate.toISOString().split('T')[0];
    setFormData({ ...formData, arrivalDate: arrival, departureDate: departure });
  };

  const setWeekendDates = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7; // Next Friday
    const friday = new Date(today);
    friday.setDate(friday.getDate() + daysUntilFriday);
    const sunday = new Date(friday);
    sunday.setDate(sunday.getDate() + 2);

    const arrival = friday.toISOString().split('T')[0];
    const departure = sunday.toISOString().split('T')[0];
    setFormData({ ...formData, arrivalDate: arrival, departureDate: departure });
  };

  const handleCreateGuest = (e: React.FormEvent) => {
    e.preventDefault();
    const { rvType, rvLength, address, zip, ...rest } = newGuestData;
    const rigType = rvType || null;
    const rigLength = rvType === "tent" || rvType === "cabin" ? null : (rvLength || null);
    createGuest.mutate({
      ...rest,
      address1: address || null,
      postalCode: zip || null,
      rigType,
      rigLength
    });
  };

  // Toggle amenity filter
  const toggleAmenityFilter = (amenity: string) => {
    setSiteFilters(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }));
  };

  const handleSelectSiteOnMap = (siteId: string) => {
    const target = siteStatusQuery.data?.find(s => s.id === siteId);
    setFormData(prev => ({
      ...prev,
      siteId,
      siteClassId: target?.siteClassId || prev.siteClassId,
      lockSpecificSite: true
    }));
    setStep(2);
  };

  // Filter site classes based on selected filters and guest RV details
  const filteredSiteClasses = siteClassesQuery.data?.filter((siteClass: any) => {
    // Get sites in this class
    const sitesInClass = sitesQuery.data?.filter((site: any) => site.siteClassId === siteClass.id) || [];

    if (sitesInClass.length === 0) return false;

    // Filter by amenities
    if (siteFilters.amenities.length > 0) {
      const hasAllAmenities = siteFilters.amenities.every(amenity =>
        siteClass.amenities?.toLowerCase().includes(amenity.toLowerCase())
      );
      if (!hasAllAmenities) return false;
    }

    // Filter by RV length (from guest data) - skip if tent or cabin
    if (formData.rvLength > 0 && formData.rvType !== "tent" && formData.rvType !== "cabin") {
      const maxLength = siteClass.rigMaxLength || 999;
      if (formData.rvLength > maxLength) return false;
    }

    // Filter by accommodation type (from guest data) - skip if tent or cabin
    if (formData.rvType && formData.rvType !== "tent" && formData.rvType !== "cabin") {
      const siteType = (siteClass.siteType || "").toLowerCase();
      if (siteType !== "rv") return false;
    }

    return true;
  }) || [];

  const SITE_LOCK_FEE = 1500; // $15.00

  // Filter guests based on search
  const filteredGuests = guestsQuery.data?.filter((guest: any) => {
    if (!guestSearch) return true;
    const searchLower = guestSearch.toLowerCase();
    const fullName = `${guest.primaryFirstName} ${guest.primaryLastName}`.toLowerCase();
    const email = guest.email?.toLowerCase() || "";
    return fullName.includes(searchLower) || email.includes(searchLower);
  }) || [];

  // Get selected guest display name
  const selectedGuest = guestsQuery.data?.find((g: any) => g.id === formData.guestId);
  const selectedGuestName = selectedGuest
    ? `${selectedGuest.primaryFirstName} ${selectedGuest.primaryLastName}`
    : "";

  if (!selectedCampground) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">No Campground Selected</h2>
            <p className="text-slate-600 mb-4">Select a campground from the dropdown to create a reservation</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Set default payment amount to total including add-ons
    const upsellTotalForPayment = selectedUpsells.reduce((acc, id) => {
      const item = upsellOptions.find(o => o.id === id);
      return acc + (item?.price || 0);
    }, 0);
    const totalInCents = (nights * ratePerNight) + siteLockFee + upsellTotalForPayment;
    setPaymentData({
      paymentAmount: totalInCents / 100, // Convert to dollars for display
      paymentMethod: "",
      transactionId: "",
      notes: ""
    });
    setShowPaymentModal(true);
  };

  const handleProcessPayment = async () => {
    const upsellTotal = selectedUpsells.reduce((acc, id) => {
      const item = upsellOptions.find(o => o.id === id);
      return acc + (item?.price || 0);
    }, 0);

    const totalInCents = (nights * ratePerNight) + siteLockFee + upsellTotal;
    const paidInCents = Math.round(paymentData.paymentAmount * 100);
    const balanceInCents = Math.max(0, totalInCents - paidInCents);
    const normalizedRigType = formData.rvType || null;
    const normalizedRigLength =
      formData.rvType === "tent" || formData.rvType === "cabin" ? null : (formData.rvLength || null);

    const reservationData: any = {
      guestId: formData.guestId,
      campgroundId: selectedCampground!.id,
      arrivalDate: formData.arrivalDate,
      departureDate: formData.departureDate,
      adults: formData.adults,
      children: formData.children,
      pets: formData.pets,
      notes: formData.notes,
      totalAmount: totalInCents,
      paidAmount: paidInCents,
      balanceAmount: balanceInCents,
      status: "confirmed",
      paymentMethod: paymentData.paymentMethod,
      rvLength: normalizedRigLength ?? undefined,
      rvType: normalizedRigType ?? undefined
    };

    // Only include siteId if a specific site was locked, otherwise use siteClassId
    if (formData.lockSpecificSite && formData.siteId) {
      reservationData.siteId = formData.siteId;
    } else if (formData.siteClassId) {
      reservationData.siteClassId = formData.siteClassId;
    }

    // Only include transaction details if provided
    if (paymentData.transactionId) {
      reservationData.transactionId = paymentData.transactionId;
    }
    if (paymentData.notes) {
      reservationData.paymentNotes = paymentData.notes;
    }

    if (formData.guestId && (normalizedRigType || normalizedRigLength !== null)) {
      try {
        await updateGuestRig.mutateAsync({
          guestId: formData.guestId,
          rigType: normalizedRigType,
          rigLength: normalizedRigLength
        });
      } catch (err) {
        console.error("Failed to update guest rig details", err);
      }
    }

    console.log("Creating reservation with data:", reservationData);
    createReservation.mutate(reservationData);
  };

  const nights = formData.arrivalDate && formData.departureDate
    ? Math.ceil((new Date(formData.departureDate).getTime() - new Date(formData.arrivalDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const selectedSiteClass = siteClassesQuery.data?.find(sc => sc.id === formData.siteClassId);
  const selectedSite = sitesQuery.data?.find(s => s.id === formData.siteId);
  const sitesInSelectedClass = sitesQuery.data?.filter((s: any) => s.siteClassId === formData.siteClassId) || [];
  const ratePerNight = selectedSiteClass?.defaultRate || 5000;
  const siteLockFee = formData.lockSpecificSite ? SITE_LOCK_FEE : 0;

  const upsellTotal = selectedUpsells.reduce((acc, id) => {
    const item = upsellOptions.find(o => o.id === id);
    return acc + (item?.price || 0);
  }, 0);

  const subtotal = (nights * ratePerNight / 100) + (siteLockFee / 100) + (upsellTotal / 100);
  const tax = subtotal * 0.08; // 8% tax
  const total = subtotal + tax;

  return (
    <DashboardShell>
      <div className="space-y-6 sm:space-y-8">
        <Breadcrumbs
          items={[
            { label: "Reservations", href: "/reservations" },
            { label: "New Reservation" }
          ]}
        />

        {(paymentsGating.stale || (!paymentsGating.ach && !paymentsGating.wallets)) && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Payments: cards only until Stripe is connected and capabilities are refreshed. Connect Stripe in Settings to enable ACH and wallets.
          </div>
        )}

        <div className="card p-4 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Campground</p>
              <h2 className="text-lg font-semibold text-slate-900">{selectedCampground?.name || "Loading…"}</h2>
              <p className="text-xs text-slate-500">Using the global selector in the header.</p>
            </div>
            <div className="text-xs text-slate-600 text-right">
              <div className="font-semibold text-slate-800">Map center</div>
              <div>Lat: {selectedCampground?.latitude ?? "—"} | Lng: {selectedCampground?.longitude ?? "—"}</div>
              <div className="text-[11px] text-slate-500">If sites lack coords, pins jitter around center.</div>
            </div>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">New Reservation</h1>
                <HelpAnchor topicId="booking-new" label="How to create a reservation" />
              </div>
              <p className="text-slate-600 mt-1">Create a new booking at {selectedCampground.name}</p>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowCopilot(!showCopilot)}
              className={`gap-2 ${showCopilot ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : ''}`}
            >
              <Sparkles className="h-4 w-4" />
              {showCopilot ? "Hide Copilot" : "Staff Copilot"}
            </Button>
          </div>

          {/* Progress Steps */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
            {[
              { num: 1, label: "Guest & Dates" },
              { num: 2, label: "Site Selection" },
              { num: 3, label: "Review & Confirm" }
            ].map((s) => (
              <div key={s.num} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${step >= s.num ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"
                  }`}>
                  {s.num}
                </div>
                <span className={`text-sm font-medium ${step >= s.num ? "text-slate-900" : "text-slate-500"}`}>
                  {s.label}
                </span>
                {s.num < 3 && <div className="w-12 h-0.5 bg-slate-200" />}
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: Guest & Dates */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Guest Search */}
                  <div className="md:col-span-2 relative guest-search-container">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      <Users className="inline h-4 w-4 mr-1" />
                      Guest
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={formData.guestId ? selectedGuestName : guestSearch}
                        onChange={(e) => {
                          setGuestSearch(e.target.value);
                          setFormData({ ...formData, guestId: "" });
                          setShowGuestDropdown(true);
                        }}
                        onFocus={() => setShowGuestDropdown(true)}
                        className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      {formData.guestId && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, guestId: "" });
                            setGuestSearch("");
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {/* Dropdown Results */}
                    {showGuestDropdown && !formData.guestId && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                        {filteredGuests.length > 0 ? (
                          <>
                            {filteredGuests.map((guest: any) => (
                              <button
                                key={guest.id}
                                type="button"
                                onClick={() => {
                                  setFormData({ ...formData, guestId: guest.id });
                                  setShowGuestDropdown(false);
                                  setGuestSearch("");
                                }}
                                className="w-full px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors"
                              >
                                <div className="flex justify-between items-center w-full">
                                  <div>
                                    <div className="font-medium text-slate-900 flex items-center">
                                      {guest.primaryFirstName} {guest.primaryLastName}
                                      {guest.loyaltyProfile?.tier && (
                                        <span className={`ml-2 text-xs px-2 py-0.5 rounded-full border ${guest.loyaltyProfile.tier === 'Gold' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' :
                                          guest.loyaltyProfile.tier === 'Platinum' ? 'bg-slate-100 border-slate-200 text-slate-700' :
                                            'bg-amber-50 border-amber-200 text-amber-700'
                                          }`}>
                                          {guest.loyaltyProfile.tier}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-sm text-slate-600">{guest.email}</div>
                                  </div>
                                  {guest.reservations?.[0] && (
                                    <div className="text-xs text-right text-slate-500 bg-slate-50 px-2 py-1 rounded">
                                      <div className="font-medium">Last Stay</div>
                                      <div>{new Date(guest.reservations[0].departureDate).toLocaleDateString()}</div>
                                      <div className="text-slate-400">Site {guest.reservations[0].site?.siteNumber}</div>
                                    </div>
                                  )}
                                </div>
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                setShowGuestDropdown(false);
                                setShowNewGuestModal(true);
                              }}
                              className="w-full px-4 py-3 text-left bg-emerald-50 hover:bg-emerald-100 transition-colors flex items-center gap-2 text-emerald-700 font-medium border-t-2 border-emerald-200"
                            >
                              <UserPlus className="h-4 w-4" />
                              Create New Guest
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setShowGuestDropdown(false);
                              setShowNewGuestModal(true);
                            }}
                            className="w-full px-4 py-3 text-left hover:bg-emerald-50 transition-colors"
                          >
                            <div className="flex items-center gap-2 text-emerald-600 font-medium">
                              <UserPlus className="h-4 w-4" />
                              No guests found - Create New Guest
                            </div>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Party Size */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Adults</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.adults}
                        onChange={(e) => setFormData({ ...formData, adults: Number(e.target.value) })}
                        className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Children</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.children}
                        onChange={(e) => setFormData({ ...formData, children: Number(e.target.value) })}
                        className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Pets</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.pets}
                        onChange={(e) => setFormData({ ...formData, pets: Number(e.target.value) })}
                        className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Accommodation Type */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Accommodation Type</label>
                    <select
                      value={formData.rvType}
                      onChange={(e) => setFormData({ ...formData, rvType: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Select type...</option>
                      <option value="tent">Tent</option>
                      <option value="cabin">Cabin</option>
                      <option value="popup">Pop-up Camper</option>
                      <option value="trailer">Travel Trailer</option>
                      <option value="5thwheel">5th Wheel</option>
                      <option value="motorhome">Motorhome (Class A/B/C)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      RV Length (feet)
                      {(formData.rvType === "tent" || formData.rvType === "cabin") &&
                        <span className="text-xs text-slate-500 ml-1">(not needed)</span>}
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g., 35"
                      value={(formData.rvType === "tent" || formData.rvType === "cabin") ? "" : (formData.rvLength || "")}
                      onChange={(e) => setFormData({ ...formData, rvLength: Number(e.target.value) })}
                      disabled={formData.rvType === "tent" || formData.rvType === "cabin"}
                      className={`w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${(formData.rvType === "tent" || formData.rvType === "cabin") ? "bg-slate-100 text-slate-400 cursor-not-allowed" : ""
                        }`}
                    />
                  </div>
                </div>

                {/* Quick Date Presets */}
                <div className="card p-4 bg-slate-50">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Quick Date Presets</h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setPresetDates(1)}
                      className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 transition-colors"
                    >
                      1 Night
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetDates(2)}
                      className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 transition-colors"
                    >
                      2 Nights
                    </button>
                    <button
                      type="button"
                      onClick={setWeekendDates}
                      className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 transition-colors"
                    >
                      Weekend (Fri-Sun)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetDates(7)}
                      className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 transition-colors"
                    >
                      1 Week
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Arrival Date */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      <Calendar className="inline h-4 w-4 mr-1" />
                      Arrival Date
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.arrivalDate}
                      onChange={(e) => setFormData({ ...formData, arrivalDate: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Departure Date */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      <Calendar className="inline h-4 w-4 mr-1" />
                      Departure Date
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.departureDate}
                      onChange={(e) => setFormData({ ...formData, departureDate: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {nights > 0 && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-900">
                      <strong>{nights}</strong> night{nights !== 1 ? 's' : ''} • {formData.adults + formData.children} guest{formData.adults + formData.children !== 1 ? 's' : ''}
                    </p>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={!formData.guestId || !formData.arrivalDate || !formData.departureDate || nights <= 0}
                  >
                    Continue to Site Selection →
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Site Selection */}
            {step === 2 && (
              <div className="space-y-6">
                {/* Filters */}
                <div className="card p-5 bg-slate-50">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">Filter by Amenities</h3>

                  {/* Guest Accommodation Info Display */}
                  {formData.rvType && formData.rvType !== "tent" && formData.rvType !== "cabin" && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-900">
                        <strong>Filtering for:</strong>{" "}
                        <span className="capitalize">{formData.rvType === "5thwheel" ? "5th Wheel" : formData.rvType}</span>
                        {formData.rvLength > 0 && <span> • {formData.rvLength}ft length</span>}
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        Only showing sites that can accommodate your RV
                      </p>
                    </div>
                  )}
                  {formData.rvType === "tent" && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-900">
                        <strong>Tent camping</strong> - All sites available (length restrictions don't apply)
                      </p>
                    </div>
                  )}
                  {formData.rvType === "cabin" && (
                    <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <p className="text-sm text-purple-900">
                        <strong>Cabin rental</strong> - Viewing cabin sites
                      </p>
                    </div>
                  )}

                  {/* Amenities */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-2 uppercase">Amenities</label>
                    <div className="flex flex-wrap gap-2">
                      {["Full Hookup", "Water/Electric", "Water Only", "Electric Only", "Pull-Through", "Back-In", "Waterfront", "Shade"].map(amenity => (
                        <button
                          key={amenity}
                          type="button"
                          onClick={() => toggleAmenityFilter(amenity)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${siteFilters.amenities.includes(amenity)
                            ? "bg-emerald-600 text-white"
                            : "bg-white border border-slate-200 text-slate-700 hover:border-emerald-300"
                            }`}
                        >
                          {amenity}
                        </button>
                      ))}
                    </div>
                  </div>

                  {siteFilters.amenities.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSiteFilters({ amenities: [] })}
                      className="mt-3 text-sm text-slate-600 hover:text-slate-900 underline"
                    >
                      Clear amenity filters
                    </button>
                  )}
                </div>

                {/* Map View */}
                <div className="card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700">Map view (beta)</h3>
                      <p className="text-xs text-slate-500">Availability and status for selected dates</p>
                    </div>
                    <span className="text-xs text-slate-500">
                      {siteStatusQuery.isFetching ? "Updating…" : `${mapSites.length} sites`}
                    </span>
                  </div>
                  <BookingMap
                    sites={mapSites}
                    campgroundCenter={campgroundCenter}
                    selectedSiteId={formData.siteId}
                    onSelectSite={handleSelectSiteOnMap}
                    isLoading={siteStatusQuery.isPending}
                  />
                  <p className="mt-2 text-xs text-slate-600">
                    Tap a site to lock it. Colors show availability (green = available, amber = occupied, red = maintenance/blackout).
                  </p>
                </div>

                {/* Admin Tools */}
                {formData.siteId && (
                  <div className="card p-4 bg-slate-50 border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800">Admin tools</h3>
                        <p className="text-xs text-slate-600">Holds and overrides for selected site</p>
                      </div>
                      <span className="text-xs text-slate-500">
                        Status: {selectedSiteStatus?.status ?? "unknown"} {selectedSiteStatus?.statusDetail ? `• ${selectedSiteStatus.statusDetail}` : ""}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 items-center">
                      <Button
                        variant="outline"
                        disabled={!formData.arrivalDate || !formData.departureDate || holdMutation.isPending}
                        onClick={() => holdMutation.mutate()}
                      >
                        {holdMutation.isPending ? "Placing hold…" : "Place 30-min hold"}
                      </Button>
                      <p className="text-xs text-slate-600">
                        Uses selected arrival/departure dates. Holds prevent double-booking while you finish checkout.
                      </p>
                    </div>
                  </div>
                )}

                {/* Site Class Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    <MapPin className="inline h-4 w-4 mr-1" />
                    Select Site Class
                  </label>
                  <p className="text-sm text-slate-600 mb-4">
                    We'll assign you the best available site in your selected class. Want a specific site? Add site lock for ${(SITE_LOCK_FEE / 100).toFixed(2)}.
                  </p>

                  {filteredSiteClasses.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 card p-6">
                      <MapPin className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                      <p className="font-medium text-slate-700 mb-1">No site classes available</p>
                      <p className="text-sm text-slate-600 mb-3">
                        {formData.rvLength > 0 && formData.rvType !== "tent"
                          ? `No sites can accommodate a ${formData.rvLength}ft ${formData.rvType || 'RV'}`
                          : "Try adjusting your amenity filters"}
                      </p>
                      {siteFilters.amenities.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSiteFilters({ amenities: [] })}
                          className="mt-2 text-sm text-emerald-600 hover:text-emerald-700 underline"
                        >
                          Clear amenity filters
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto p-2">
                      {filteredSiteClasses.map((siteClass: any) => {
                        const sitesInClass = sitesQuery.data?.filter((s: any) => s.siteClassId === siteClass.id) || [];
                        const availableCount = sitesInClass.length;
                        // Get rate from site class or first site in class
                        const ratePerNight = siteClass.defaultRate || 0;

                        // Check for past stays
                        const selectedGuestData = guestsQuery.data?.find((g: any) => g.id === formData.guestId);
                        const pastReservations = selectedGuestData?.reservations || [];
                        const hasStayedInClass = pastReservations.some((r: any) => r.site?.siteClassId === siteClass.id);

                        // Check for match score
                        const matchData = matchesQuery.data?.filter(m => m.site.siteClassId === siteClass.id) || [];
                        const bestMatchScore = matchData.length > 0 ? Math.max(...matchData.map(m => m.score)) : 0;

                        return (
                          <button
                            key={siteClass.id}
                            type="button"
                            onClick={() => setFormData({ ...formData, siteClassId: siteClass.id, siteId: "", lockSpecificSite: false })}
                            className={`p-4 border-2 rounded-lg text-left transition-all ${formData.siteClassId === siteClass.id
                              ? "border-emerald-500 bg-emerald-50"
                              : "border-slate-200 hover:border-slate-300"
                              }`}
                          >
                            <div className="flex flex-wrap gap-1 mb-2">
                              {hasStayedInClass && (
                                <div className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded-full font-medium">
                                  <History className="w-3 h-3" />
                                  Stayed Here Before
                                </div>
                              )}
                              {bestMatchScore >= 80 && (
                                <div className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded-full font-medium">
                                  <Star className="w-3 h-3" />
                                  {bestMatchScore}% Match
                                </div>
                              )}
                            </div>
                            {siteClass.photos?.[0] && (
                              <div className="mb-3 h-32 w-full overflow-hidden rounded-md bg-slate-100">
                                <img
                                  src={siteClass.photos[0]}
                                  alt={siteClass.name}
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              </div>
                            )}
                            <div className="font-semibold text-slate-900">{siteClass.name}</div>
                            <div className="text-xs text-slate-600 mt-1">{availableCount} sites in class</div>
                            <div className="text-sm font-semibold text-emerald-600 mt-2">
                              ${(ratePerNight / 100).toFixed(0)}/night
                            </div>
                            {siteClass.amenities && (
                              <div className="text-xs text-slate-500 mt-2 line-clamp-2">{siteClass.amenities}</div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Site Lock Option */}
                {formData.siteClassId && (
                  <div className="card p-5 bg-amber-50 border-2 border-amber-200">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="lockSite"
                        checked={formData.lockSpecificSite}
                        onChange={(e) => setFormData({ ...formData, lockSpecificSite: e.target.checked, siteId: e.target.checked ? formData.siteId : "" })}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <label htmlFor="lockSite" className="font-semibold text-slate-900 cursor-pointer">
                          Lock Specific Site (+${(SITE_LOCK_FEE / 100).toFixed(2)})
                        </label>
                        <p className="text-sm text-slate-700 mt-1">
                          Choose a specific site number instead of being auto-assigned
                        </p>

                        {formData.lockSpecificSite && (
                          <div className="mt-3">
                            <label className="block text-xs font-medium text-slate-600 mb-2">Select Specific Site</label>
                            <select
                              value={formData.siteId}
                              onChange={(e) => setFormData({ ...formData, siteId: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                            >
                              <option value="">Choose a site...</option>
                              {sitesQuery.data
                                ?.filter((s: any) => s.siteClassId === formData.siteClassId)
                                .map((site: any) => {
                                  const selectedGuestData = guestsQuery.data?.find((g: any) => g.id === formData.guestId);
                                  const hasStayedInSite = selectedGuestData?.reservations?.some((r: any) => r.site?.id === site.id);
                                  const matchData = matchesQuery.data?.find(m => m.site.id === site.id);
                                  const score = matchData?.score || 0;
                                  return (
                                    <option key={site.id} value={site.id}>
                                      {site.siteNumber} {hasStayedInSite ? "★ (Stayed Here)" : ""} {score >= 80 ? `(${score}% Match)` : ""}
                                    </option>
                                  );
                                })}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between">
                  <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                    ← Back
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      if (relevantUpsells.length > 0) {
                        setShowUpsellModal(true);
                      } else {
                        setStep(3);
                      }
                    }}
                    disabled={!formData.siteClassId || (formData.lockSpecificSite && !formData.siteId)}
                  >
                    Review Reservation →
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Review & Confirm */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="card p-4 bg-slate-50">
                    <h3 className="font-semibold text-slate-900 mb-3">Reservation Details</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Guest:</span>
                        <span className="font-medium">
                          {guestsQuery.data?.find((g: any) => g.id === formData.guestId)?.primaryFirstName}{" "}
                          {guestsQuery.data?.find((g: any) => g.id === formData.guestId)?.primaryLastName}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Site Class:</span>
                        <span className="font-medium">{selectedSiteClass?.name}</span>
                      </div>
                      {formData.lockSpecificSite && formData.siteId && (
                        <div className="flex justify-between">
                          <span className="text-slate-600">Locked Site:</span>
                          <span className="font-medium">{selectedSite?.name}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-slate-600">Dates:</span>
                        <span className="font-medium">{formData.arrivalDate} to {formData.departureDate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Nights:</span>
                        <span className="font-medium">{nights}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Party:</span>
                        <span className="font-medium">{formData.adults} adults, {formData.children} children</span>
                      </div>
                    </div>
                  </div>

                  <div className="card p-4 bg-emerald-50">
                    <h3 className="font-semibold text-slate-900 mb-3">
                      <DollarSign className="inline h-4 w-4" /> Payment Summary
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">{nights} nights × ${(ratePerNight / 100).toFixed(0)}</span>
                        <span className="font-medium">${((nights * ratePerNight) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      {formData.lockSpecificSite && (
                        <div className="flex justify-between">
                          <span className="text-slate-600">Site Lock Fee</span>
                          <span className="font-medium">${(siteLockFee / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-slate-600">Tax (8%)</span>
                        <span className="font-medium">${tax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="border-t border-emerald-200 pt-2 mt-2">
                        <div className="flex justify-between text-lg">
                          <span className="font-semibold text-slate-900">Total</span>
                          <span className="font-bold text-emerald-600">${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                      <div className="text-xs text-slate-600 mt-2">
                        Balance due: ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Special Notes (Optional)</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Any special requests or notes..."
                  />
                </div>

                <div className="flex justify-between">
                  <Button type="button" variant="secondary" onClick={() => setStep(2)}>
                    ← Back
                  </Button>
                  <Button type="submit" disabled={createReservation.isPending}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {createReservation.isPending ? "Creating..." : "Confirm Reservation"}
                  </Button>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Create New Guest Modal */}
        {
          showNewGuestModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-slate-900">Create New Guest</h2>
                    <button
                      type="button"
                      onClick={() => setShowNewGuestModal(false)}
                      className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <X className="h-5 w-5 text-slate-500" />
                    </button>
                  </div>

                  <form onSubmit={handleCreateGuest} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          First Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={newGuestData.primaryFirstName}
                          onChange={(e) => setNewGuestData({ ...newGuestData, primaryFirstName: e.target.value })}
                          className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Last Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={newGuestData.primaryLastName}
                          onChange={(e) => setNewGuestData({ ...newGuestData, primaryLastName: e.target.value })}
                          className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Email *
                        </label>
                        <input
                          type="email"
                          required
                          value={newGuestData.email}
                          onChange={(e) => setNewGuestData({ ...newGuestData, email: e.target.value })}
                          className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Phone
                        </label>
                        <input
                          type="tel"
                          value={newGuestData.phone}
                          onChange={(e) => setNewGuestData({ ...newGuestData, phone: e.target.value })}
                          className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Address
                        </label>
                        <input
                          type="text"
                          value={newGuestData.address}
                          onChange={(e) => setNewGuestData({ ...newGuestData, address: e.target.value })}
                          className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          City
                        </label>
                        <input
                          type="text"
                          value={newGuestData.city}
                          onChange={(e) => setNewGuestData({ ...newGuestData, city: e.target.value })}
                          className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          State
                        </label>
                        <input
                          type="text"
                          value={newGuestData.state}
                          onChange={(e) => setNewGuestData({ ...newGuestData, state: e.target.value })}
                          className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          ZIP Code
                        </label>
                        <input
                          type="text"
                          value={newGuestData.zip}
                          onChange={(e) => setNewGuestData({ ...newGuestData, zip: e.target.value })}
                          className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          RV/Camper Type
                        </label>
                        <select
                          value={newGuestData.rvType}
                          onChange={(e) => setNewGuestData({ ...newGuestData, rvType: e.target.value })}
                          className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="">None / Tent camping</option>
                          <option value="popup">Pop-up Camper</option>
                          <option value="trailer">Travel Trailer</option>
                          <option value="5thwheel">5th Wheel</option>
                          <option value="motorhome">Motorhome (Class A/B/C)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          RV Length (feet)
                        </label>
                        <input
                          type="number"
                          min="0"
                          placeholder="e.g., 35"
                          value={newGuestData.rvLength || ""}
                          onChange={(e) => setNewGuestData({ ...newGuestData, rvLength: Number(e.target.value) })}
                          disabled={!newGuestData.rvType}
                          className={`w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${!newGuestData.rvType ? "bg-slate-100 text-slate-400 cursor-not-allowed" : ""}`}
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setShowNewGuestModal(false)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createGuest.isPending}
                        className="flex-1"
                      >
                        {createGuest.isPending ? "Creating..." : "Create Guest"}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )
        }

        {/* Payment Modal */}
        {
          showPaymentModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg max-w-lg w-full">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-100 rounded-lg">
                        <CreditCard className="h-6 w-6 text-emerald-600" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-slate-900">Process Payment</h2>
                        <p className="text-sm text-slate-600">Total due: ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPaymentModal(false)}
                      className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <X className="h-5 w-5 text-slate-500" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* Payment Amount */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Payment Amount *
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={total}
                          required
                          value={paymentData.paymentAmount}
                          onChange={(e) => setPaymentData({ ...paymentData, paymentAmount: Number(e.target.value) })}
                          className="w-full pl-8 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      {paymentData.paymentAmount < total && (
                        <p className="text-xs text-amber-600 mt-1">
                          Partial payment - Balance of ${(total - paymentData.paymentAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} will be due
                        </p>
                      )}
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => setPaymentData({ ...paymentData, paymentAmount: total })}
                          className="text-xs px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100"
                        >
                          Pay in Full
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentData({ ...paymentData, paymentAmount: total * 0.5 })}
                          className="text-xs px-3 py-1 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"
                        >
                          50% Deposit
                        </button>
                      </div>
                    </div>

                    {/* Payment Method */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Payment Method *
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: "cash", label: "Cash", icon: Banknote },
                          { value: "credit", label: "Credit Card", icon: CreditCard },
                          { value: "debit", label: "Debit Card", icon: CreditCard },
                          { value: "check", label: "Check", icon: Banknote }
                        ].map((method) => {
                          const Icon = method.icon;
                          return (
                            <button
                              key={method.value}
                              type="button"
                              onClick={() => setPaymentData({ ...paymentData, paymentMethod: method.value })}
                              className={`p-3 border-2 rounded-lg text-left transition-all flex items-center gap-2 ${paymentData.paymentMethod === method.value
                                ? "border-emerald-500 bg-emerald-50"
                                : "border-slate-200 hover:border-slate-300"
                                }`}
                            >
                              <Icon className="h-4 w-4" />
                              <span className="text-sm font-medium">{method.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Transaction ID / Check Number */}
                    {(paymentData.paymentMethod === "credit" || paymentData.paymentMethod === "debit" || paymentData.paymentMethod === "check") && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          {paymentData.paymentMethod === "check" ? "Check Number" : "Transaction ID"}
                        </label>
                        <input
                          type="text"
                          value={paymentData.transactionId}
                          onChange={(e) => setPaymentData({ ...paymentData, transactionId: e.target.value })}
                          placeholder={paymentData.paymentMethod === "check" ? "Enter check number" : "Enter transaction ID"}
                          className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    )}

                    {/* Payment Notes */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Payment Notes (Optional)
                      </label>
                      <textarea
                        value={paymentData.notes}
                        onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                        rows={2}
                        placeholder="Any notes about this payment..."
                        className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    {/* Payment Summary */}
                    <div className="card p-4 bg-slate-50 border-2 border-slate-200">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Total Amount:</span>
                          <span className="font-semibold">${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-emerald-600">
                          <span>Payment:</span>
                          <span className="font-semibold">-${paymentData.paymentAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="border-t border-slate-300 pt-2 mt-2">
                          <div className="flex justify-between font-bold text-base">
                            <span>Balance Due:</span>
                            <span className={total - paymentData.paymentAmount > 0 ? "text-amber-600" : "text-emerald-600"}>
                              ${(total - paymentData.paymentAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setShowPaymentModal(false)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={handleProcessPayment}
                        disabled={!paymentData.paymentMethod || paymentData.paymentAmount <= 0 || createReservation.isPending}
                        className="flex-1 relative"
                      >
                        {createReservation.isPending && (
                          <span className="absolute left-4">
                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          </span>
                        )}
                        {createReservation.isPending ? "Processing Payment..." : "Complete Reservation"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        }

        {/* Confirmation Screen */}
        {
          showConfirmation && confirmedReservation && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
              <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom-4 duration-500">
                <div className="p-8">
                  {/* Success Header */}
                  <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-full mb-4 animate-in zoom-in duration-700">
                      <CheckCircle className="h-14 w-14 text-emerald-600" strokeWidth={2.5} />
                    </div>
                    <h2 className="text-4xl font-bold text-slate-900 mb-3">Reservation Confirmed!</h2>
                    <div className="inline-block px-4 py-2 bg-emerald-50 border-2 border-emerald-200 rounded-lg">
                      <p className="text-lg font-semibold text-emerald-700">
                        Confirmation #{confirmedReservation.id || confirmedReservation.confirmationNumber}
                      </p>
                    </div>
                  </div>

                  {/* Email Confirmation Notice */}
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
                    <Mail className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900">Receipt emailed</p>
                      <p className="text-xs text-blue-700 mt-1">
                        Confirmation and receipt sent to{" "}
                        {guestsQuery.data?.find((g: any) => g.id === formData.guestId)?.email}
                      </p>
                    </div>
                  </div>

                  {/* Reservation Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="card p-4 bg-slate-50">
                      <h3 className="font-semibold text-slate-900 mb-3">Guest Information</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Name:</span>
                          <span className="font-medium">
                            {guestsQuery.data?.find((g: any) => g.id === formData.guestId)?.primaryFirstName}{" "}
                            {guestsQuery.data?.find((g: any) => g.id === formData.guestId)?.primaryLastName}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Email:</span>
                          <span className="font-medium text-xs">
                            {guestsQuery.data?.find((g: any) => g.id === formData.guestId)?.email}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Party:</span>
                          <span className="font-medium">
                            {formData.adults} adults, {formData.children} children
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="card p-4 bg-slate-50">
                      <h3 className="font-semibold text-slate-900 mb-3">Stay Details</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Check-in:</span>
                          <span className="font-medium">{formData.arrivalDate}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Check-out:</span>
                          <span className="font-medium">{formData.departureDate}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Nights:</span>
                          <span className="font-medium">{nights}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Site Class:</span>
                          <span className="font-medium">{selectedSiteClass?.name}</span>
                        </div>
                        {formData.lockSpecificSite && formData.siteId && (
                          <div className="flex justify-between">
                            <span className="text-slate-600">Locked Site:</span>
                            <span className="font-medium">{selectedSite?.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Payment Summary */}
                  <div className="card p-4 bg-emerald-50 border-2 border-emerald-200 mb-6">
                    <h3 className="font-semibold text-slate-900 mb-3">Payment Summary</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Total Amount:</span>
                        <span className="font-semibold">${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-emerald-600">
                        <span>Paid ({paymentData.paymentMethod}):</span>
                        <span className="font-semibold">
                          ${paymentData.paymentAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      {paymentData.transactionId && (
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-600">Transaction ID:</span>
                          <span className="font-mono">{paymentData.transactionId}</span>
                        </div>
                      )}
                      <div className="border-t border-emerald-300 pt-2 mt-2">
                        <div className="flex justify-between font-bold text-base">
                          <span>Balance Due:</span>
                          <span className={total - paymentData.paymentAmount > 0 ? "text-amber-600" : "text-emerald-600"}>
                            ${(total - paymentData.paymentAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-3">
                    <div className="text-center">
                      <p className="text-sm text-slate-600 mb-3">What would you like to do next?</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => window.print()}
                        className="flex items-center justify-center gap-2 h-12 border-2 hover:border-slate-400"
                      >
                        <Printer className="h-5 w-5" />
                        <span className="font-semibold">Print Receipt</span>
                      </Button>
                      <Button
                        type="button"
                        onClick={async () => {
                          try {
                            await apiClient.checkInReservation(confirmedReservation.id);
                            toast({ title: "Guest Checked In", description: "Reservation status updated to Checked In." });
                            setShowConfirmation(false);
                            router.push(`/reservations/${confirmedReservation.id}`);
                          } catch (err) {
                            toast({ title: "Check-in Failed", description: "Could not check in guest.", variant: "destructive" });
                          }
                        }}
                        className="flex items-center justify-center gap-2 h-12 bg-green-600 hover:bg-green-700 text-white"
                      >
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-semibold">Check In Now</span>
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          setShowConfirmation(false);
                          router.push(`/reservations/${confirmedReservation.id}`);
                        }}
                        className="flex items-center justify-center gap-2 h-12"
                      >
                        <span className="font-semibold">View Reservation</span>
                        <ArrowRight className="h-5 w-5" />
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          setShowConfirmation(false);
                          router.push("/dashboard");
                        }}
                        className="flex items-center justify-center gap-2 h-12"
                      >
                        <span className="font-semibold">Back to Dashboard</span>
                      </Button>
                    </div>
                    <p className="text-xs text-center text-slate-500 mt-2">
                      💚 Prefer paperless? The receipt has been emailed to your guest
                    </p>
                  </div>

                  {/* Print-Only Content */}
                  <div className="hidden print:block mt-8 pt-8 border-t-2 border-slate-300">
                    <div className="text-center mb-6">
                      <h1 className="text-2xl font-bold">{selectedCampground.name}</h1>
                      <p className="text-sm text-slate-600">Reservation Receipt</p>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <strong>Confirmation Number:</strong> {confirmedReservation.id || confirmedReservation.confirmationNumber}
                      </div>
                      <div>
                        <strong>Guest:</strong>{" "}
                        {guestsQuery.data?.find((g: any) => g.id === formData.guestId)?.primaryFirstName}{" "}
                        {guestsQuery.data?.find((g: any) => g.id === formData.guestId)?.primaryLastName}
                      </div>
                      <div>
                        <strong>Check-in:</strong> {formData.arrivalDate} | <strong>Check-out:</strong> {formData.departureDate}
                      </div>
                      <div>
                        <strong>Site Class:</strong> {selectedSiteClass?.name}
                        {formData.lockSpecificSite && formData.siteId && ` - Site ${selectedSite?.name}`}
                      </div>
                      <div>
                        <strong>Total:</strong> ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} |{" "}
                        <strong>Paid:</strong> ${paymentData.paymentAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} |{" "}
                        <strong>Balance:</strong> ${(total - paymentData.paymentAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        }
        {/* Upsell Modal */}
        <Dialog open={showUpsellModal} onOpenChange={setShowUpsellModal}>
          {/* ... existing modal content ... */}
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Enhance Your Stay</DialogTitle>
              <DialogDescription>
                Based on your trip details, we think you might like these add-ons.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {relevantUpsells.map(opt => (
                <div key={opt.id} className="flex items-center space-x-4 border p-4 rounded-lg hover:bg-slate-50 cursor-pointer" onClick={() => {
                  if (selectedUpsells.includes(opt.id)) {
                    setSelectedUpsells(prev => prev.filter(id => id !== opt.id));
                  } else {
                    setSelectedUpsells(prev => [...prev, opt.id]);
                  }
                }}>
                  <input
                    type="checkbox"
                    checked={selectedUpsells.includes(opt.id)}
                    readOnly
                    className="h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{opt.label}</p>
                    <p className="text-sm text-emerald-600 font-semibold">+${(opt.price / 100).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowUpsellModal(false); setStep(3); }}>
                Skip
              </Button>
              <Button onClick={handleAddUpsells}>
                Add Selected & Continue
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Staff Copilot Sidebar */}
      <div className={`fixed inset-y-0 right-0 w-80 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-50 border-l border-slate-200 ${showCopilot ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-full flex flex-col">
          <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="bg-emerald-500 p-1.5 rounded-lg">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <h2 className="font-semibold">Staff Copilot</h2>
            </div>
            <button onClick={() => setShowCopilot(false)} className="text-slate-400 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {!formData.guestId ? (
              <div className="text-center py-8 text-slate-500">
                <Users className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                <p>Select a guest to see AI insights.</p>
              </div>
            ) : (
              <>
                {/* Guest Vibe */}
                <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                  <h3 className="text-xs font-bold text-purple-900 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Zap className="h-3 w-3" /> Guest Vibe
                  </h3>
                  <p className="text-sm text-purple-800 leading-relaxed">
                    {guestsQuery.data?.find((g: any) => g.id === formData.guestId)?.insights?.vibe || "This guest loves nature and quiet spots. They usually book well in advance."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {guestsQuery.data?.find((g: any) => g.id === formData.guestId)?.preferences?.tags?.map((tag: string) => (
                      <span key={tag} className="text-xs bg-white text-purple-700 px-2 py-1 rounded-md border border-purple-200 font-medium">
                        #{tag}
                      </span>
                    )) || (
                        <>
                          <span className="text-xs bg-white text-purple-700 px-2 py-1 rounded-md border border-purple-200 font-medium">#Quiet</span>
                          <span className="text-xs bg-white text-purple-700 px-2 py-1 rounded-md border border-purple-200 font-medium">#Shade</span>
                        </>
                      )}
                  </div>
                </div>

                {/* Conversation Starters */}
                <div>
                  <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-blue-500" />
                    Conversation Starters
                  </h3>
                  <ul className="space-y-3">
                    <li className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      "How was your last stay at {guestsQuery.data?.find((g: any) => g.id === formData.guestId)?.reservations?.[0]?.site?.name || "our park"}?"
                    </li>
                    <li className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      "Are you bringing any pets this time?"
                    </li>
                  </ul>
                </div>

                {/* Recommendations */}
                <div>
                  <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <MapIcon className="h-4 w-4 text-emerald-500" />
                    Local Recs
                  </h3>
                  <div className="space-y-3">
                    <div className="flex gap-3 items-start">
                      <div className="h-8 w-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Coffee className="h-4 w-4 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">Morning Brew</p>
                        <p className="text-xs text-slate-500">Best coffee spot 5 mins away.</p>
                      </div>
                    </div>
                    <div className="flex gap-3 items-start">
                      <div className="h-8 w-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <TreePine className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">Sunset Trail</p>
                        <p className="text-xs text-slate-500">Perfect for evening walks.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

export default function NewReservation() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-600">Loading reservation…</div>}>
      <NewReservationInner />
    </Suspense>
  );
}
