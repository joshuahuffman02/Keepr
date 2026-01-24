"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle,
  CreditCard,
  MapPin,
  Search,
  Sparkles,
  Users,
  X,
  UserPlus,
} from "lucide-react";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

type Guest = Awaited<ReturnType<typeof apiClient.getGuests>>[number];
type Site = Awaited<ReturnType<typeof apiClient.getSitesWithStatus>>[number];
type SiteClass = Awaited<ReturnType<typeof apiClient.getSiteClasses>>[number];
type Campground = Awaited<ReturnType<typeof apiClient.getCampgrounds>>[number];
type SeasonalRate = Awaited<ReturnType<typeof apiClient.getSeasonalRates>>[number];
type ReservationConfirmation = Awaited<ReturnType<typeof apiClient.createReservation>>;

interface ReservationPayload {
  campgroundId: string;
  siteId: string;
  siteClassId?: string;
  guestId: string;
  arrivalDate: string;
  departureDate: string;
  adults: number;
  children: number;
  pets: number;
  notes?: string;
  seasonalRateId?: string;
  pricingType: "transient" | "seasonal";
}

type CreateReservationPayload = Parameters<typeof apiClient.createReservation>[0];

export default function BookingV2Page() {
  return (
    <Suspense
      fallback={
        <DashboardShell>
          <div className="p-8 text-center text-slate-500">Loading...</div>
        </DashboardShell>
      }
    >
      <BookingV2Content />
    </Suspense>
  );
}

function BookingV2Content() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const guestParam = searchParams.get("guestId");

  const { data: campgrounds = [] } = useQuery<Campground[]>({
    queryKey: ["campgrounds"],
    queryFn: () => apiClient.getCampgrounds(),
  });

  const [campgroundId, setCampgroundId] = useState<string>("");

  useEffect(() => {
    if (campgrounds.length === 0) return;
    const stored =
      typeof window !== "undefined" ? localStorage.getItem("campreserv:selectedCampground") : null;
    const candidate =
      stored && campgrounds.some((cg) => cg.id === stored) ? stored : campgrounds[0].id;
    setCampgroundId((prev) => prev || candidate);
  }, [campgrounds]);

  useEffect(() => {
    if (campgroundId && typeof window !== "undefined") {
      localStorage.setItem("campreserv:selectedCampground", campgroundId);
    }
  }, [campgroundId]);

  const selectedCampground = campgrounds.find((c) => c.id === campgroundId);

  const guestsQuery = useQuery<Guest[]>({
    queryKey: ["guests"],
    queryFn: () => apiClient.getGuests(),
  });

  const siteClassesQuery = useQuery<SiteClass[]>({
    queryKey: ["site-classes", campgroundId],
    queryFn: () => apiClient.getSiteClasses(campgroundId),
    enabled: !!campgroundId,
  });

  const seasonalRatesQuery = useQuery<SeasonalRate[]>({
    queryKey: ["seasonal-rates", campgroundId],
    queryFn: () => apiClient.getSeasonalRates(campgroundId),
    enabled: !!campgroundId,
  });

  const [form, setForm] = useState<ReservationPayload>({
    campgroundId: "",
    siteId: "",
    siteClassId: "",
    guestId: "",
    arrivalDate: "",
    departureDate: "",
    adults: 2,
    children: 0,
    pets: 0,
    notes: "",
    pricingType: "transient",
  });

  const [guestSearch, setGuestSearch] = useState("");
  const [showGuestDropdown, setShowGuestDropdown] = useState(false);

  useEffect(() => {
    if (!campgroundId) return;
    setForm((prev) => ({ ...prev, campgroundId }));
  }, [campgroundId]);

  useEffect(() => {
    if (guestParam) {
      setForm((prev) => ({ ...prev, guestId: guestParam }));
    }
  }, [guestParam]);

  useEffect(() => {
    if (!form.arrivalDate) {
      const today = new Date();
      const arrival = today.toISOString().split("T")[0];
      const departureDate = new Date(today);
      departureDate.setDate(departureDate.getDate() + 2);
      const departure = departureDate.toISOString().split("T")[0];
      setForm((prev) => ({ ...prev, arrivalDate: arrival, departureDate: departure }));
    }
  }, [form.arrivalDate]);

  const siteStatusQuery = useQuery<Site[]>({
    queryKey: ["site-status", campgroundId, form.arrivalDate, form.departureDate],
    queryFn: () =>
      apiClient.getSitesWithStatus(campgroundId, {
        arrivalDate: form.arrivalDate,
        departureDate: form.departureDate,
      }),
    enabled: !!campgroundId && !!form.arrivalDate && !!form.departureDate,
  });

  const availableSites: Site[] = useMemo(() => {
    const sites = siteStatusQuery.data ?? [];
    return sites.filter((s) => s.status === "available");
  }, [siteStatusQuery.data]);

  const filteredGuests = useMemo(() => {
    const list = guestsQuery.data;
    if (!list) return [];
    const q = guestSearch.toLowerCase();
    return list.filter((g) => {
      if (!q) return true;
      const full = `${g.primaryFirstName} ${g.primaryLastName}`.toLowerCase();
      const email = g.email?.toLowerCase() ?? "";
      return full.includes(q) || email.includes(q);
    });
  }, [guestsQuery.data, guestSearch]);

  const createReservation = useMutation({
    mutationFn: (data: ReservationPayload) => {
      const payload: CreateReservationPayload = {
        ...data,
        status: "pending",
        totalAmount: 0,
      };
      return apiClient.createReservation(payload);
    },
    onSuccess: (res) => {
      toast({ title: "Reservation created", description: "Guest has been booked." });
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      setConfirmation(res);
    },
    onError: () => toast({ title: "Could not create reservation", variant: "destructive" }),
  });

  const [confirmation, setConfirmation] = useState<ReservationConfirmation | null>(null);

  const readyToSubmit =
    !!form.guestId &&
    !!form.arrivalDate &&
    !!form.departureDate &&
    !!form.siteId &&
    (!!form.siteClassId || siteClassesQuery.data?.length === 0);

  const handleCreate = () => {
    if (!readyToSubmit) {
      toast({ title: "Complete guest, dates, and site", variant: "destructive" });
      return;
    }
    createReservation.mutate(form);
  };

  const arrivalDate = form.arrivalDate ? new Date(form.arrivalDate) : null;
  const departureDate = form.departureDate ? new Date(form.departureDate) : null;
  const nights =
    arrivalDate && departureDate
      ? Math.max(
          1,
          Math.round((departureDate.getTime() - arrivalDate.getTime()) / (1000 * 60 * 60 * 24)),
        )
      : 0;

  const selectedGuest = (guestsQuery.data ?? []).find((g) => g.id === form.guestId);
  const selectedSite: Site | undefined = availableSites.find((s) => s.id === form.siteId);
  const selectedClass = siteClassesQuery.data?.find((sc) => sc.id === form.siteClassId);
  const selectedGuestName = selectedGuest
    ? `${selectedGuest.primaryFirstName} ${selectedGuest.primaryLastName}`
    : "";

  useEffect(() => {
    if (!showGuestDropdown) return;
    const handler = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.closest(".guest-search-container")) {
        setShowGuestDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showGuestDropdown]);

  const selectedSeasonalRate = seasonalRatesQuery.data?.find((r) => r.id === form.seasonalRateId);

  useEffect(() => {
    if (selectedSeasonalRate && form.pricingType === "seasonal") {
      if (selectedSeasonalRate.startDate && selectedSeasonalRate.endDate) {
        setForm((p) => ({
          ...p,
          arrivalDate: selectedSeasonalRate.startDate!.split("T")[0],
          departureDate: selectedSeasonalRate.endDate!.split("T")[0],
        }));
      }
    }
  }, [form.seasonalRateId, form.pricingType, selectedSeasonalRate]);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Booking · {selectedCampground?.name ?? "Campground"}
            </p>
            <h1 className="text-3xl font-bold text-slate-900">New reservation</h1>
            <p className="text-sm text-slate-600">
              Pick guest, dates, site, and confirm in one flow.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={campgroundId} onValueChange={setCampgroundId}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Select campground" />
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
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 space-y-4">
            {/* Stay Type */}
            <Card className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase font-semibold text-slate-500">Step 1</div>
                  <h3 className="text-lg font-semibold text-slate-900">Stay Type</h3>
                  <p className="text-xs text-slate-500">
                    Choose between a short-term or a long-term seasonal stay.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() =>
                    setForm((p) => ({ ...p, pricingType: "transient", seasonalRateId: undefined }))
                  }
                  className={`flex-1 p-3 rounded-lg border text-center transition-all ${form.pricingType === "transient" ? "border-status-success bg-status-success/15 text-status-success ring-2 ring-status-success/20" : "border-slate-200 hover:border-slate-300"}`}
                >
                  <div className="font-semibold">Transient</div>
                  <div className="text-xs opacity-70">Short-term/Nightly</div>
                </button>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, pricingType: "seasonal" }))}
                  className={`flex-1 p-3 rounded-lg border text-center transition-all ${form.pricingType === "seasonal" ? "border-status-success bg-status-success/15 text-status-success ring-2 ring-status-success/20" : "border-slate-200 hover:border-slate-300"}`}
                >
                  <div className="font-semibold">Seasonal</div>
                  <div className="text-xs opacity-70">Long-term (Monthly/Weekly)</div>
                </button>
              </div>

              {form.pricingType === "seasonal" && (
                <div className="space-y-3 pt-2">
                  <Label>Select Seasonal Rate Plan</Label>
                  <Select
                    value={form.seasonalRateId}
                    onValueChange={(v) => setForm((p) => ({ ...p, seasonalRateId: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chose a plan..." />
                    </SelectTrigger>
                    <SelectContent>
                      {seasonalRatesQuery.data?.map((rate) => (
                        <SelectItem key={rate.id} value={rate.id}>
                          {rate.name} — ${(rate.amount / 100).toFixed(2)} ({rate.rateType})
                        </SelectItem>
                      ))}
                      {seasonalRatesQuery.data?.length === 0 && (
                        <div className="p-2 text-sm text-slate-500">
                          No seasonal rates configured for this park.
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </Card>

            {/* Guest & party */}
            <Card className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase font-semibold text-slate-500">Step 2</div>
                  <h3 className="text-lg font-semibold text-slate-900">Guest & party</h3>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2 relative guest-search-container">
                  <Label className="mb-2 block">Guest</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search by name or email..."
                      value={form.guestId ? selectedGuestName : guestSearch}
                      onChange={(e) => {
                        setGuestSearch(e.target.value);
                        setForm((prev) => ({ ...prev, guestId: "" }));
                        setShowGuestDropdown(true);
                      }}
                      onFocus={() => setShowGuestDropdown(true)}
                      className="w-full max-w-3xl pl-10 pr-10 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    {form.guestId && (
                      <button
                        type="button"
                        onClick={() => {
                          setForm((prev) => ({ ...prev, guestId: "" }));
                          setGuestSearch("");
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {showGuestDropdown && !form.guestId && (
                    <div className="absolute z-20 w-full max-w-3xl mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      {filteredGuests.length > 0 ? (
                        <>
                          {filteredGuests.map((guest) => (
                            <button
                              key={guest.id}
                              type="button"
                              onClick={() => {
                                setForm((prev) => ({ ...prev, guestId: guest.id }));
                                setShowGuestDropdown(false);
                                setGuestSearch("");
                              }}
                              className="w-full px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors"
                            >
                              <div className="flex justify-between items-center w-full">
                                <div>
                                  <div className="font-medium text-slate-900">
                                    {guest.primaryFirstName} {guest.primaryLastName}
                                  </div>
                                  <div className="text-sm text-slate-600">{guest.email}</div>
                                </div>
                              </div>
                            </button>
                          ))}
                          <Link
                            href="/guests"
                            onClick={() => setShowGuestDropdown(false)}
                            className="w-full px-4 py-3 text-left bg-status-success/15 hover:bg-status-success/25 transition-colors flex items-center gap-2 text-status-success font-medium border-t-2 border-status-success/30"
                          >
                            <UserPlus className="h-4 w-4" />
                            Create or manage guests
                          </Link>
                        </>
                      ) : (
                        <Link
                          href="/guests"
                          onClick={() => setShowGuestDropdown(false)}
                          className="w-full px-4 py-3 text-left hover:bg-status-success/15 transition-colors flex items-center gap-2 text-status-success font-medium"
                        >
                          <UserPlus className="h-4 w-4" />
                          No guests found — add new
                        </Link>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-slate-500 mt-1">
                    Rich search by name or email; add new guests from the guests page.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>Adults</Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.adults}
                      onChange={(e) => setForm((p) => ({ ...p, adults: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Children</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.children}
                      onChange={(e) => setForm((p) => ({ ...p, children: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Pets</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.pets}
                      onChange={(e) => setForm((p) => ({ ...p, pets: Number(e.target.value) }))}
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Dates */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase font-semibold text-slate-500">Step 3</div>
                  <h3 className="text-lg font-semibold text-slate-900">Dates</h3>
                </div>
                {nights > 0 ? <Badge variant="secondary">{nights} nights</Badge> : null}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Arrival</Label>
                  <Input
                    type="date"
                    value={form.arrivalDate}
                    onChange={(e) => setForm((p) => ({ ...p, arrivalDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Departure</Label>
                  <Input
                    type="date"
                    value={form.departureDate}
                    onChange={(e) => setForm((p) => ({ ...p, departureDate: e.target.value }))}
                  />
                </div>
              </div>
            </Card>

            {/* Site selection */}
            <Card className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase font-semibold text-slate-500">Step 4</div>
                  <h3 className="text-lg font-semibold text-slate-900">Site</h3>
                  <p className="text-xs text-slate-500">
                    Showing available sites for the selected dates.
                  </p>
                </div>
                <div className="w-48">
                  <Select
                    value={form.siteClassId || "all"}
                    onValueChange={(v) =>
                      setForm((p) => ({ ...p, siteClassId: v === "all" ? "" : v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All classes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All classes</SelectItem>
                      {siteClassesQuery.data?.map((sc: SiteClass) => (
                        <SelectItem key={sc.id} value={sc.id}>
                          {sc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-md px-3 py-2">
                <Search className="h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search site name..."
                  className="border-none shadow-none px-1"
                  onChange={(e) => {
                    const val = e.target.value.toLowerCase();
                    const match = availableSites.find((s) => s.name.toLowerCase().includes(val));
                    if (match) setForm((p) => ({ ...p, siteId: match.id }));
                  }}
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {availableSites
                  .filter((s) => !form.siteClassId || s.siteClassId === form.siteClassId)
                  .map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, siteId: s.id }))}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition hover:border-status-success/30 ${
                        form.siteId === s.id
                          ? "border-status-success/30 bg-status-success/15 text-status-success"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-slate-400" />
                        {s.name}
                      </span>
                      {form.siteId === s.id ? (
                        <CheckCircle className="h-4 w-4 text-status-success" />
                      ) : null}
                    </button>
                  ))}
                {availableSites.length === 0 && (
                  <div className="col-span-full text-sm text-slate-500 border border-dashed border-slate-200 rounded-lg p-4 text-center">
                    No available sites for these dates.
                  </div>
                )}
              </div>
            </Card>

            {/* Notes */}
            <Card className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase font-semibold text-slate-500">Step 5</div>
                  <h3 className="text-lg font-semibold text-slate-900">Notes & requests</h3>
                </div>
                <Badge variant="outline" className="text-status-success border-status-success/30">
                  Optional
                </Badge>
              </div>
              <textarea
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                rows={3}
                placeholder="Gate codes, late arrival, accessibility, upsells..."
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </Card>
          </div>

          {/* Summary */}
          <div className="space-y-3">
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase font-semibold text-slate-500">Summary</p>
                  <h3 className="text-lg font-semibold text-slate-900">Review & confirm</h3>
                </div>
                {readyToSubmit ? (
                  <Badge variant="secondary">Ready</Badge>
                ) : (
                  <Badge variant="outline">Incomplete</Badge>
                )}
              </div>
              <div className="space-y-2 text-sm text-slate-700">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-400" />
                  <span>
                    {selectedGuest
                      ? `${selectedGuest.primaryFirstName} ${selectedGuest.primaryLastName}`
                      : "Select guest"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <span>
                    {form.arrivalDate || "Arrival"} → {form.departureDate || "Departure"}{" "}
                    {nights ? `(${nights} nights)` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  <span>{selectedSite ? selectedSite.name : "Select site"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-slate-400" />
                  <span>{selectedClass ? selectedClass.name : "Any class"}</span>
                </div>
                {form.pricingType === "seasonal" && selectedSeasonalRate && (
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <div className="text-xs uppercase font-semibold text-slate-500 mb-1">
                      Seasonal Plan
                    </div>
                    <div className="flex items-center gap-2 text-status-success font-medium">
                      <CreditCard className="h-4 w-4" />
                      <span>{selectedSeasonalRate.name}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Billing: {selectedSeasonalRate.paymentSchedule} ·{" "}
                      {selectedSeasonalRate.pricingStructure}
                    </div>
                  </div>
                )}
              </div>
              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={!readyToSubmit || createReservation.isPending}
              >
                {createReservation.isPending ? "Creating..." : "Create reservation"}
              </Button>
              <p className="text-xs text-slate-500">
                A confirmation email/receipt will be sent automatically after creation.
              </p>
            </Card>

            {confirmation ? (
              <Card className="p-4 space-y-2 border-status-success/30 bg-status-success/15">
                <div className="flex items-center gap-2 text-status-success">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-semibold">Reservation created</span>
                </div>
                <div className="text-sm text-slate-800">
                  ID: {confirmation.id ?? "—"}
                  <br />
                  Guest:{" "}
                  {selectedGuest
                    ? `${selectedGuest.primaryFirstName} ${selectedGuest.primaryLastName}`
                    : ""}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Link
                    href="/reservations"
                    className="text-status-success font-semibold flex items-center gap-1"
                  >
                    Go to reservations <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </Card>
            ) : null}

            <Card className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-slate-700">
                <CreditCard className="h-4 w-4 text-slate-400" />
                <div>
                  <div className="text-sm font-semibold text-slate-900">Need payment now?</div>
                  <div className="text-xs text-slate-500">
                    Take payment on the reservation after creation or in POS.
                  </div>
                </div>
              </div>
              <Link
                href="/pos"
                className="text-sm font-semibold text-status-success flex items-center gap-1"
              >
                Open POS <ArrowRight className="h-4 w-4" />
              </Link>
            </Card>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
