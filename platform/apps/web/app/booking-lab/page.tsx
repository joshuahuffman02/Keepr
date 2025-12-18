"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
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
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { Badge } from "../../components/ui/badge";
import { Textarea } from "../../components/ui/textarea";
import { useToast } from "../../components/ui/use-toast";
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

  const [guestSearch, setGuestSearch] = useState("");
  const [showGuestResults, setShowGuestResults] = useState(false);
  const [showNewGuest, setShowNewGuest] = useState(false);
  const [guestForm, setGuestForm] = useState({
    primaryFirstName: "",
    primaryLastName: "",
    email: "",
    phone: ""
  });

  const [formData, setFormData] = useState({
    guestId: "",
    arrivalDate: initialArrival,
    departureDate: initialDeparture,
    adults: 2,
    children: 0,
    pets: 0,
    rigType: "",
    rigLength: "",
    siteId: initialSiteId,
    siteClassId: "",
    lockSite: false,
    notes: "",
    collectPayment: false,
    paymentAmount: "",
    paymentMethod: "",
    transactionId: "",
    paymentNotes: ""
  });

  useEffect(() => {
    if (formData.arrivalDate && !formData.departureDate) {
      const arrival = parseLocalDateInput(formData.arrivalDate);
      arrival.setDate(arrival.getDate() + 1);
      setFormData((prev) => ({ ...prev, departureDate: formatLocalDateInput(arrival) }));
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

  const [siteTypeFilter, setSiteTypeFilter] = useState("all");
  const [siteClassFilter, setSiteClassFilter] = useState("all");
  const [availableOnly, setAvailableOnly] = useState(true);

  const filteredSites = useMemo(() => {
    const sites = siteStatusQuery.data || [];
    return sites.filter((site) => {
      if (availableOnly && site.status !== "available") return false;
      if (siteTypeFilter !== "all" && site.siteType !== siteTypeFilter) return false;
      if (siteClassFilter !== "all" && site.siteClassId !== siteClassFilter) return false;
      return true;
    });
  }, [siteStatusQuery.data, availableOnly, siteTypeFilter, siteClassFilter]);

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
  const totalCents = (quoteQuery.data?.totalCents ?? 0) + lockFeeCents;
  const paymentAmountDefault = totalCents > 0 ? (totalCents / 100).toFixed(2) : "";

  useEffect(() => {
    if (formData.collectPayment && paymentAmountDefault) {
      setFormData((prev) => ({ ...prev, paymentAmount: paymentAmountDefault }));
    }
  }, [formData.collectPayment, paymentAmountDefault]);

  const guests = guestsQuery.data || [];
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

  const matchesQuery = useQuery({
    queryKey: ["booking-lab-matches", selectedCampground?.id, formData.guestId],
    queryFn: () => apiClient.getMatchedSites(selectedCampground!.id, formData.guestId),
    enabled: !!selectedCampground?.id && !!formData.guestId
  });

  const createGuestMutation = useMutation({
    mutationFn: () => apiClient.createGuest({
      primaryFirstName: guestForm.primaryFirstName,
      primaryLastName: guestForm.primaryLastName,
      email: guestForm.email,
      phone: guestForm.phone
    }),
    onSuccess: (guest) => {
      setFormData((prev) => ({ ...prev, guestId: guest.id }));
      setGuestSearch(`${guest.primaryFirstName} ${guest.primaryLastName}`.trim());
      setShowNewGuest(false);
      setGuestForm({ primaryFirstName: "", primaryLastName: "", email: "", phone: "" });
      queryClient.invalidateQueries({ queryKey: ["booking-lab-guests", selectedCampground?.id] });
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
      const paidAmountCents = formData.collectPayment
        ? Math.round(Number(formData.paymentAmount || 0) * 100)
        : 0;
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
        totalAmount: totalCents,
        paidAmount: paidAmountCents,
        balanceAmount: Math.max(0, totalCents - paidAmountCents),
        status: "confirmed",
        paymentMethod: formData.collectPayment ? formData.paymentMethod : undefined,
        transactionId: formData.collectPayment ? formData.transactionId : undefined,
        paymentNotes: formData.collectPayment ? formData.paymentNotes : undefined,
        siteLocked: formData.lockSite,
        overrideReason: lockFeeCents > 0 ? "Site lock fee" : undefined,
        overrideApprovedBy: whoami?.user?.id || undefined
      };

      return apiClient.createReservation(payload);
    },
    onSuccess: (reservation) => {
      toast({ title: "Reservation created", description: "Booking saved successfully." });
      router.push(`/reservations/${reservation.id}`);
    },
    onError: (err: any) => {
      toast({ title: "Booking failed", description: err?.message || "Please try again.", variant: "destructive" });
    }
  });

  const canCreate =
    !!selectedCampground?.id &&
    !!formData.guestId &&
    !!formData.siteId &&
    dateRangeValid &&
    !!quoteQuery.data &&
    (!formData.collectPayment || (!!formData.paymentMethod && Number(formData.paymentAmount) > 0));

  return (
    <DashboardShell>
      <div className="px-6 py-6 w-full max-w-none space-y-6">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Booking Lab", href: "/booking-lab" }
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
                  <Badge variant="secondary" className="uppercase text-[10px] tracking-widest">Lab</Badge>
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
                        {guestMatches.map((guest) => (
                          <button
                            key={guest.id}
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                            onClick={() => {
                              setFormData((prev) => ({ ...prev, guestId: guest.id }));
                              setGuestSearch(`${guest.primaryFirstName} ${guest.primaryLastName}`.trim());
                              setShowGuestResults(false);
                            }}
                          >
                            <div className="font-semibold text-slate-800">
                              {guest.primaryFirstName} {guest.primaryLastName}
                            </div>
                            <div className="text-xs text-slate-500">{guest.email}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedGuest ? (
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
                      <div className="flex items-center gap-2">
                        <BadgeCheck className="h-4 w-4" />
                        <div className="font-semibold">{selectedGuest.primaryFirstName} {selectedGuest.primaryLastName}</div>
                      </div>
                      <div className="mt-1 text-emerald-700">{selectedGuest.email}</div>
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
                      <Input
                        placeholder="RV / Trailer / Tent"
                        value={formData.rigType}
                        onChange={(e) => setFormData((prev) => ({ ...prev, rigType: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Rig length</Label>
                      <Input
                        placeholder="ft"
                        value={formData.rigLength}
                        onChange={(e) => setFormData((prev) => ({ ...prev, rigLength: e.target.value }))}
                      />
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

              {matchesQuery.data && matchesQuery.data.length > 0 && (
                <Card className="p-5 border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold uppercase tracking-widest text-slate-500">AI suggestions</div>
                    <Sparkles className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="mt-3 space-y-2">
                    {matchesQuery.data.slice(0, 3).map((match) => (
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
                      const isSelected = site.id === formData.siteId;
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
                            <div className="text-sm font-semibold text-slate-900">{site.name}</div>
                            <Badge className={cn("text-[10px]", meta.badge)}>{meta.label}</Badge>
                          </div>
                          <div className="text-xs text-slate-500">#{site.siteNumber} • {site.siteClassName || "Class"}</div>
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

                <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Subtotal</span>
                    <span className="font-semibold text-slate-800">
                      {quoteQuery.data ? `$${(quoteQuery.data.baseSubtotalCents / 100).toFixed(2)}` : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Rules delta</span>
                    <span className="font-semibold text-slate-800">
                      {quoteQuery.data ? `$${(quoteQuery.data.rulesDeltaCents / 100).toFixed(2)}` : "-"}
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
                      {quoteQuery.data ? `$${(totalCents / 100).toFixed(2)}` : "-"}
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

                <div className="mt-4 flex items-center gap-2">
                  <Switch
                    checked={formData.collectPayment}
                    onCheckedChange={(value) => setFormData((prev) => ({ ...prev, collectPayment: value }))}
                  />
                  <div className="text-xs text-slate-600">Collect payment now</div>
                </div>

                {formData.collectPayment && (
                  <div className="mt-3 space-y-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Amount</Label>
                        <Input
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
                    <Input
                      placeholder="Transaction ID (optional)"
                      value={formData.transactionId}
                      onChange={(e) => setFormData((prev) => ({ ...prev, transactionId: e.target.value }))}
                    />
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
                    onClick={() => createReservationMutation.mutate()}
                    disabled={!canCreate || createReservationMutation.isPending}
                  >
                    {createReservationMutation.isPending ? "Creating..." : "Create reservation"}
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
    </DashboardShell>
  );
}
