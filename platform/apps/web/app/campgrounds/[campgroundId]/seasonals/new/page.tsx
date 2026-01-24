"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiClient } from "@/lib/api-client";
import {
  ArrowLeft,
  User,
  MapPin,
  CreditCard,
  Zap,
  Shield,
  Car,
  Dog,
  Phone,
  Loader2,
  Check,
  Calculator,
  Gift,
  Percent,
  Plus,
  X,
} from "lucide-react";

type Guest = {
  id: string;
  primaryFirstName: string;
  primaryLastName: string;
  email?: string | null;
  phone?: string | null;
};

type Site = {
  id: string;
  name: string;
  siteClassId?: string | null;
  siteClass?: {
    name: string;
    rentalType?: string; // "transient" | "seasonal" | "flexible"
  };
};

type RateCard = {
  id: string;
  name: string;
  seasonYear: number;
  baseRate: number;
  billingFrequency: string;
  seasonStartDate: string;
  seasonEndDate: string;
  isDefault: boolean;
  discounts: Array<{
    id: string;
    name: string;
    type: string;
    value: number;
    condition: string;
  }>;
  incentives: Array<{
    id: string;
    name: string;
    type: string;
    value: number;
    condition: string;
  }>;
};

type PricingPreview = {
  baseRate: number;
  totalDiscount: number;
  finalRate: number;
  appliedDiscounts: Array<{ name: string; amount: number }>;
  earnedIncentives: Array<{ name: string; type: string; value: number }>;
  paymentSchedule: Array<{ dueDate: string; amount: number; description: string }>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isDiscount = (value: unknown): value is RateCard["discounts"][number] =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.name === "string" &&
  typeof value.type === "string" &&
  typeof value.value === "number" &&
  typeof value.condition === "string";

const isRateCard = (value: unknown): value is RateCard =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.name === "string" &&
  typeof value.seasonYear === "number" &&
  typeof value.baseRate === "number" &&
  typeof value.billingFrequency === "string" &&
  typeof value.seasonStartDate === "string" &&
  typeof value.seasonEndDate === "string" &&
  typeof value.isDefault === "boolean" &&
  Array.isArray(value.discounts) &&
  value.discounts.every(isDiscount) &&
  Array.isArray(value.incentives) &&
  value.incentives.every(isDiscount);

const isPricingPreview = (value: unknown): value is PricingPreview =>
  isRecord(value) &&
  typeof value.baseRate === "number" &&
  typeof value.totalDiscount === "number" &&
  typeof value.finalRate === "number" &&
  Array.isArray(value.appliedDiscounts) &&
  value.appliedDiscounts.every(
    (item) => isRecord(item) && typeof item.name === "string" && typeof item.amount === "number",
  ) &&
  Array.isArray(value.earnedIncentives) &&
  value.earnedIncentives.every(
    (item) =>
      isRecord(item) &&
      typeof item.name === "string" &&
      typeof item.type === "string" &&
      typeof item.value === "number",
  ) &&
  Array.isArray(value.paymentSchedule) &&
  value.paymentSchedule.every(
    (item) =>
      isRecord(item) &&
      typeof item.dueDate === "string" &&
      typeof item.amount === "number" &&
      typeof item.description === "string",
  );

export default function NewSeasonalGuestPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const campgroundParam = params.campgroundId;
  const campgroundId = typeof campgroundParam === "string" ? campgroundParam : "";

  // Form state
  const [selectedGuestId, setSelectedGuestId] = useState<string>("");
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [selectedRateCardId, setSelectedRateCardId] = useState<string>("");
  const [guestSearch, setGuestSearch] = useState("");

  // Billing preferences
  const [billingFrequency, setBillingFrequency] = useState<string>("monthly");
  const [preferredPaymentMethod, setPreferredPaymentMethod] = useState<string>("");
  const [paysInFull, setPaysInFull] = useState(false);
  const [autoPayEnabled, setAutoPayEnabled] = useState(false);
  const [paymentDay, setPaymentDay] = useState(1);

  // Utilities
  const [isMetered, setIsMetered] = useState(false);
  const [meteredElectric, setMeteredElectric] = useState(false);
  const [meteredWater, setMeteredWater] = useState(false);

  // Compliance
  const [vehiclePlates, setVehiclePlates] = useState("");
  const [petCount, setPetCount] = useState(0);
  const [petNotes, setPetNotes] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [coiExpiresAt, setCoiExpiresAt] = useState("");

  // Notes
  const [notes, setNotes] = useState("");

  // First season year (current year by default)
  const currentYear = new Date().getFullYear();
  const [firstSeasonYear, setFirstSeasonYear] = useState(currentYear);

  // Create new guest state
  const [showCreateGuest, setShowCreateGuest] = useState(false);
  const [newGuestFirstName, setNewGuestFirstName] = useState("");
  const [newGuestLastName, setNewGuestLastName] = useState("");
  const [newGuestEmail, setNewGuestEmail] = useState("");
  const [newGuestPhone, setNewGuestPhone] = useState("");

  // Fetch guests with backend search - only when user starts typing
  const {
    data: guests = [],
    isLoading: loadingGuests,
    refetch: refetchGuests,
  } = useQuery({
    queryKey: ["guests-search", campgroundId, guestSearch],
    queryFn: async () => {
      return apiClient.getGuests(campgroundId, {
        search: guestSearch,
        limit: 50,
      });
    },
    enabled: !!campgroundId && guestSearch.length >= 2,
  });

  // Create guest mutation
  const createGuestMutation = useMutation({
    mutationFn: async () => {
      return apiClient.createGuest(
        {
          primaryFirstName: newGuestFirstName,
          primaryLastName: newGuestLastName,
          email: newGuestEmail || "",
          phone: newGuestPhone || "",
        },
        campgroundId,
      );
    },
    onSuccess: (newGuest) => {
      setSelectedGuestId(newGuest.id);
      setShowCreateGuest(false);
      setNewGuestFirstName("");
      setNewGuestLastName("");
      setNewGuestEmail("");
      setNewGuestPhone("");
      refetchGuests();
    },
  });

  // Fetch sites and filter to seasonal/flexible only
  const { data: allSites = [], isLoading: loadingSites } = useQuery<Site[]>({
    queryKey: ["sites", campgroundId],
    queryFn: () => apiClient.getSites(campgroundId),
  });

  // Filter to only show sites with seasonal or flexible rental type
  const sites = useMemo(() => {
    return allSites.filter((site) => {
      const rentalType = site.siteClass?.rentalType;
      return rentalType === "seasonal" || rentalType === "flexible";
    });
  }, [allSites]);

  // Fetch rate cards
  const { data: rateCards = [], isLoading: loadingRateCards } = useQuery<RateCard[]>({
    queryKey: ["seasonal-rate-cards", campgroundId],
    queryFn: async () => {
      try {
        const data = await apiClient.getSeasonalRateCards(campgroundId);
        return Array.isArray(data) ? data.filter(isRateCard) : [];
      } catch {
        return [];
      }
    },
  });

  // Set default rate card
  useEffect(() => {
    if (rateCards.length > 0 && !selectedRateCardId) {
      const defaultCard = rateCards.find((rc) => rc.isDefault) || rateCards[0];
      setSelectedRateCardId(defaultCard.id);
      setBillingFrequency(defaultCard.billingFrequency);
    }
  }, [rateCards, selectedRateCardId]);

  // Fetch pricing preview
  const { data: pricingPreview, isLoading: loadingPricing } = useQuery<PricingPreview | null>({
    queryKey: [
      "seasonal-pricing-preview",
      campgroundId,
      selectedRateCardId,
      isMetered,
      paysInFull,
      preferredPaymentMethod,
      billingFrequency,
    ],
    queryFn: async (): Promise<PricingPreview | null> => {
      if (!selectedRateCardId) return null;
      try {
        const data = await apiClient.previewSeasonalPricing({
          rateCardId: selectedRateCardId,
          isMetered,
          paysInFull,
          paymentMethod: preferredPaymentMethod || undefined,
        });
        return isPricingPreview(data) ? data : null;
      } catch {
        return null;
      }
    },
    enabled: !!selectedRateCardId,
  });

  const selectedGuest = useMemo(
    () => guests.find((g) => g.id === selectedGuestId),
    [guests, selectedGuestId],
  );

  const selectedSite = useMemo(
    () => sites.find((s) => s.id === selectedSiteId),
    [sites, selectedSiteId],
  );

  const selectedRateCard = useMemo(
    () => rateCards.find((rc) => rc.id === selectedRateCardId),
    [rateCards, selectedRateCardId],
  );

  // Create seasonal mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      return apiClient.createSeasonalGuest({
        guestId: selectedGuestId,
        currentSiteId: selectedSiteId || undefined,
        rateCardId: selectedRateCardId,
        firstSeasonYear,
        billingFrequency,
        preferredPaymentMethod: preferredPaymentMethod || undefined,
        paysInFull,
        autoPayEnabled,
        paymentDay,
        isMetered,
        meteredElectric,
        meteredWater,
        vehiclePlates: vehiclePlates ? vehiclePlates.split(",").map((p) => p.trim()) : [],
        petCount,
        petNotes: petNotes || undefined,
        emergencyContact: emergencyContact || undefined,
        emergencyPhone: emergencyPhone || undefined,
        coiExpiresAt: coiExpiresAt ? new Date(coiExpiresAt).toISOString() : undefined,
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seasonal-guests", campgroundId] });
      router.push(`/campgrounds/${campgroundId}/seasonals`);
    },
  });

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

  const canSubmit = selectedGuestId && selectedRateCardId;

  return (
    <DashboardShell>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Go back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Add Seasonal Guest</h1>
            <p className="text-muted-foreground">
              Set up a new seasonal guest with site assignment and pricing
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form - 2 cols */}
          <div className="lg:col-span-2 space-y-6">
            {/* Guest Selection */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Guest
                    </CardTitle>
                    <CardDescription>Select an existing guest or create a new one</CardDescription>
                  </div>
                  {!showCreateGuest && (
                    <Button variant="outline" size="sm" onClick={() => setShowCreateGuest(true)}>
                      <Plus className="h-4 w-4 mr-1" />
                      New Guest
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {showCreateGuest ? (
                  /* Create New Guest Form */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b">
                      <h4 className="font-medium">Create New Guest</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowCreateGuest(false);
                          setNewGuestFirstName("");
                          setNewGuestLastName("");
                          setNewGuestEmail("");
                          setNewGuestPhone("");
                        }}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="new-guest-first-name">First Name *</Label>
                        <Input
                          id="new-guest-first-name"
                          placeholder="John"
                          value={newGuestFirstName}
                          onChange={(e) => setNewGuestFirstName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-guest-last-name">Last Name *</Label>
                        <Input
                          id="new-guest-last-name"
                          placeholder="Smith"
                          value={newGuestLastName}
                          onChange={(e) => setNewGuestLastName(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-guest-email">Email</Label>
                      <Input
                        id="new-guest-email"
                        type="email"
                        placeholder="hello@keeprstay.com"
                        value={newGuestEmail}
                        onChange={(e) => setNewGuestEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-guest-phone">Phone</Label>
                      <Input
                        id="new-guest-phone"
                        type="tel"
                        placeholder="(555) 123-4567"
                        value={newGuestPhone}
                        onChange={(e) => setNewGuestPhone(e.target.value)}
                      />
                    </div>
                    {createGuestMutation.isError && (
                      <p className="text-sm text-destructive">
                        {createGuestMutation.error instanceof Error
                          ? createGuestMutation.error.message
                          : "Failed to create guest"}
                      </p>
                    )}
                    <Button
                      className="w-full"
                      disabled={
                        !newGuestFirstName || !newGuestLastName || createGuestMutation.isPending
                      }
                      onClick={() => createGuestMutation.mutate()}
                    >
                      {createGuestMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Create Guest
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  /* Search Existing Guests */
                  <>
                    <Input
                      placeholder="Search guests by name or email..."
                      value={guestSearch}
                      onChange={(e) => setGuestSearch(e.target.value)}
                      aria-label="Search guests"
                    />
                    {loadingGuests ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </div>
                    ) : guests.length === 0 ? (
                      <div className="text-center py-4 space-y-3">
                        <p className="text-sm text-muted-foreground">
                          {guestSearch
                            ? `No guests found for "${guestSearch}".`
                            : "No guests found."}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowCreateGuest(true);
                            // Pre-fill name from search if it looks like a name
                            if (guestSearch) {
                              const parts = guestSearch.trim().split(/\s+/);
                              if (parts.length >= 1) setNewGuestFirstName(parts[0]);
                              if (parts.length >= 2) setNewGuestLastName(parts.slice(1).join(" "));
                            }
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          {guestSearch
                            ? `Create "${guestSearch}" as New Guest`
                            : "Create New Guest"}
                        </Button>
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
                        {guests.slice(0, 20).map((guest) => (
                          <div
                            key={guest.id}
                            className={`p-3 cursor-pointer hover:bg-muted transition-colors ${
                              selectedGuestId === guest.id
                                ? "bg-primary/10 border-l-2 border-primary"
                                : ""
                            }`}
                            onClick={() => setSelectedGuestId(guest.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-medium">
                                  {guest.primaryFirstName} {guest.primaryLastName}
                                </span>
                                {guest.email && (
                                  <span className="text-sm text-muted-foreground ml-2">
                                    {guest.email}
                                  </span>
                                )}
                              </div>
                              {selectedGuestId === guest.id && (
                                <Check className="h-4 w-4 text-primary" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Site Assignment */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Site Assignment
                </CardTitle>
                <CardDescription>
                  Assign a seasonal site (only sites with rental type "seasonal" or "flexible" are
                  shown)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingSites ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : sites.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    <p className="text-sm">No seasonal sites available.</p>
                    <p className="text-xs mt-1">
                      Configure site classes with rental type "seasonal" in Settings → Site Classes.
                    </p>
                  </div>
                ) : (
                  <>
                    <Label htmlFor="seasonal-site" className="sr-only">
                      Seasonal site
                    </Label>
                    <Select
                      value={selectedSiteId || "__none__"}
                      onValueChange={(v) => setSelectedSiteId(v === "__none__" ? "" : v)}
                    >
                      <SelectTrigger id="seasonal-site">
                        <SelectValue placeholder="Select a site..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No site assigned yet</SelectItem>
                        {sites.map((site) => (
                          <SelectItem key={site.id} value={site.id}>
                            {site.name}
                            {site.siteClass && (
                              <span className="text-muted-foreground ml-2">
                                ({site.siteClass.name})
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Rate Card Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Rate Card
                </CardTitle>
                <CardDescription>Select the pricing package for this seasonal</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingRateCards ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : rateCards.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground mb-2">No rate cards configured</p>
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/campgrounds/${campgroundId}/seasonals/rate-cards`}>
                        Create Rate Card
                      </a>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {rateCards.map((card) => (
                      <div
                        key={card.id}
                        className={`p-4 border rounded-lg cursor-pointer hover:border-primary transition-colors ${
                          selectedRateCardId === card.id ? "border-primary bg-primary/5" : ""
                        }`}
                        onClick={() => {
                          setSelectedRateCardId(card.id);
                          setBillingFrequency(card.billingFrequency);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{card.name}</span>
                              {card.isDefault && (
                                <Badge variant="secondary" className="text-xs">
                                  Default
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatCurrency(card.baseRate)} • {card.billingFrequency}
                            </div>
                          </div>
                          {selectedRateCardId === card.id && (
                            <Check className="h-5 w-5 text-primary" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Separator />

                {/* Billing Frequency Override */}
                <div className="space-y-2">
                  <Label htmlFor="billing-frequency">Billing Frequency</Label>
                  <Select value={billingFrequency} onValueChange={setBillingFrequency}>
                    <SelectTrigger id="billing-frequency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="seasonal">Full Season</SelectItem>
                      <SelectItem value="biweekly">Bi-Weekly</SelectItem>
                      <SelectItem value="semi_monthly">Semi-Monthly (1st & 15th)</SelectItem>
                      <SelectItem value="deposit_plus_monthly">Deposit + Monthly</SelectItem>
                      <SelectItem value="offseason_installments">
                        Off-Season Installments
                      </SelectItem>
                      <SelectItem value="custom">Custom Schedule</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="payment-day">Payment Day of Month</Label>
                    <Select
                      value={String(paymentDay)}
                      onValueChange={(v) => setPaymentDay(Number(v))}
                    >
                      <SelectTrigger id="payment-day">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 5, 10, 15, 20, 25].map((day) => (
                          <SelectItem key={day} value={String(day)}>
                            {day === 1 ? "1st" : day === 15 ? "15th" : `${day}th`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="preferred-payment-method">Preferred Payment Method</Label>
                    <Select
                      value={preferredPaymentMethod || "__any__"}
                      onValueChange={(v) => setPreferredPaymentMethod(v === "__any__" ? "" : v)}
                    >
                      <SelectTrigger id="preferred-payment-method">
                        <SelectValue placeholder="Any method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__any__">Any method</SelectItem>
                        <SelectItem value="card">Credit/Debit Card</SelectItem>
                        <SelectItem value="ach">ACH/Bank Transfer</SelectItem>
                        <SelectItem value="check">Check</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="pays-in-full"
                      checked={paysInFull}
                      onCheckedChange={setPaysInFull}
                    />
                    <Label htmlFor="pays-in-full">Pays in Full</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="auto-pay-enabled"
                      checked={autoPayEnabled}
                      onCheckedChange={setAutoPayEnabled}
                    />
                    <Label htmlFor="auto-pay-enabled">Auto-Pay Enabled</Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Utilities */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Utilities
                </CardTitle>
                <CardDescription>Configure metered utilities if applicable</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Switch id="is-metered" checked={isMetered} onCheckedChange={setIsMetered} />
                  <Label htmlFor="is-metered">Guest is on metered utilities</Label>
                </div>

                {isMetered && (
                  <div className="pl-6 space-y-3 border-l-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="metered-electric"
                        checked={meteredElectric}
                        onCheckedChange={setMeteredElectric}
                      />
                      <Label htmlFor="metered-electric">Metered Electric</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="metered-water"
                        checked={meteredWater}
                        onCheckedChange={setMeteredWater}
                      />
                      <Label htmlFor="metered-water">Metered Water</Label>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Compliance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Compliance & Emergency
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emergency-contact" className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Emergency Contact
                    </Label>
                    <Input
                      id="emergency-contact"
                      placeholder="Contact name"
                      value={emergencyContact}
                      onChange={(e) => setEmergencyContact(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergency-phone">Emergency Phone</Label>
                    <Input
                      id="emergency-phone"
                      placeholder="Phone number"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vehicle-plates" className="flex items-center gap-2">
                    <Car className="h-4 w-4" />
                    Vehicle Plates
                  </Label>
                  <Input
                    id="vehicle-plates"
                    placeholder="ABC123, XYZ789 (comma separated)"
                    value={vehiclePlates}
                    onChange={(e) => setVehiclePlates(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pet-count" className="flex items-center gap-2">
                      <Dog className="h-4 w-4" />
                      Number of Pets
                    </Label>
                    <Select value={String(petCount)} onValueChange={(v) => setPetCount(Number(v))}>
                      <SelectTrigger id="pet-count">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 1, 2, 3, 4, 5].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n === 0 ? "No pets" : n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {petCount > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="pet-notes">Pet Notes</Label>
                      <Input
                        id="pet-notes"
                        placeholder="Breeds, names..."
                        value={petNotes}
                        onChange={(e) => setPetNotes(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="coi-expiry">Certificate of Insurance Expiry</Label>
                  <Input
                    id="coi-expiry"
                    type="date"
                    value={coiExpiresAt}
                    onChange={(e) => setCoiExpiresAt(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  id="seasonal-notes"
                  placeholder="Any additional notes about this seasonal guest..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Pricing Preview */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Pricing Preview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loadingPricing ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : pricingPreview ? (
                    <>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Base Rate</span>
                          <span>{formatCurrency(pricingPreview.baseRate)}</span>
                        </div>

                        {pricingPreview.appliedDiscounts?.length > 0 && (
                          <>
                            <Separator />
                            <div className="space-y-1">
                              {pricingPreview.appliedDiscounts.map((d, i) => (
                                <div
                                  key={i}
                                  className="flex justify-between text-sm text-green-600"
                                >
                                  <span className="flex items-center gap-1">
                                    <Percent className="h-3 w-3" />
                                    {d.name}
                                  </span>
                                  <span>-{formatCurrency(d.amount)}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}

                        <Separator />

                        <div className="flex justify-between font-semibold text-lg">
                          <span>Total</span>
                          <span>{formatCurrency(pricingPreview.finalRate)}</span>
                        </div>
                      </div>

                      {pricingPreview.earnedIncentives?.length > 0 && (
                        <div className="pt-3 border-t">
                          <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                            <Gift className="h-4 w-4 text-amber-500" />
                            Earned Bonuses
                          </h4>
                          <div className="space-y-1">
                            {pricingPreview.earnedIncentives.map((inc, i) => (
                              <div
                                key={i}
                                className="text-sm text-amber-700 bg-amber-50 p-2 rounded"
                              >
                                {inc.name}: {formatCurrency(inc.value)}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {pricingPreview.paymentSchedule?.length > 0 && (
                        <div className="pt-3 border-t">
                          <h4 className="text-sm font-medium mb-2">Payment Schedule</h4>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {pricingPreview.paymentSchedule.slice(0, 6).map((p, i) => (
                              <div
                                key={i}
                                className="flex justify-between text-xs text-muted-foreground"
                              >
                                <span>{p.description}</span>
                                <span>{formatCurrency(p.amount)}</span>
                              </div>
                            ))}
                            {pricingPreview.paymentSchedule.length > 6 && (
                              <div className="text-xs text-muted-foreground text-center">
                                +{pricingPreview.paymentSchedule.length - 6} more payments
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Select a rate card to see pricing
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Guest</span>
                    <span className="font-medium">
                      {selectedGuest
                        ? `${selectedGuest.primaryFirstName} ${selectedGuest.primaryLastName}`
                        : "Not selected"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Site</span>
                    <span className="font-medium">{selectedSite?.name || "Not assigned"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rate Card</span>
                    <span className="font-medium">{selectedRateCard?.name || "Not selected"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Billing</span>
                    <span className="font-medium capitalize">
                      {billingFrequency.replace("_", " ")}
                    </span>
                  </div>
                  {isMetered && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Utilities</span>
                      <Badge variant="outline" className="text-xs">
                        Metered
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Submit */}
              <Button
                className="w-full"
                size="lg"
                disabled={!canSubmit || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Add Seasonal Guest"
                )}
              </Button>

              {createMutation.isError && (
                <p className="text-sm text-destructive text-center">
                  {createMutation.error instanceof Error
                    ? createMutation.error.message
                    : "Unable to create seasonal guest"}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
