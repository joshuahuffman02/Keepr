"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
} from "lucide-react";

type Guest = {
  id: string;
  primaryFirstName: string;
  primaryLastName: string;
  email: string;
  phone: string;
};

type Site = {
  id: string;
  name: string;
  siteClassId?: string | null;
  siteClass?: { name: string };
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

export default function NewSeasonalGuestPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const campgroundId = params.campgroundId as string;

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

  // Fetch guests
  const { data: guests = [], isLoading: loadingGuests } = useQuery<Guest[]>({
    queryKey: ["guests", campgroundId, guestSearch],
    queryFn: async () => {
      const data = await apiClient.getGuests(campgroundId);
      if (guestSearch) {
        const search = guestSearch.toLowerCase();
        return data.filter((g: Guest) =>
          g.primaryFirstName?.toLowerCase().includes(search) ||
          g.primaryLastName?.toLowerCase().includes(search) ||
          g.email?.toLowerCase().includes(search)
        );
      }
      return data.slice(0, 50); // Limit to first 50 if no search
    },
  });

  // Fetch sites
  const { data: sites = [], isLoading: loadingSites } = useQuery<Site[]>({
    queryKey: ["sites", campgroundId],
    queryFn: () => apiClient.getSites(campgroundId),
  });

  // Fetch rate cards
  const { data: rateCards = [], isLoading: loadingRateCards } = useQuery<RateCard[]>({
    queryKey: ["seasonal-rate-cards", campgroundId],
    queryFn: async () => {
      const response = await fetch(`/api/campgrounds/${campgroundId}/seasonals/rate-cards`);
      if (!response.ok) return [];
      return response.json();
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
  const { data: pricingPreview, isLoading: loadingPricing } = useQuery<PricingPreview>({
    queryKey: [
      "seasonal-pricing-preview",
      campgroundId,
      selectedRateCardId,
      isMetered,
      paysInFull,
      preferredPaymentMethod,
      billingFrequency,
    ],
    queryFn: async () => {
      if (!selectedRateCardId) return null;
      const response = await fetch(`/api/campgrounds/${campgroundId}/seasonals/pricing/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rateCardId: selectedRateCardId,
          context: {
            isMetered,
            paysInFull,
            paymentMethod: preferredPaymentMethod,
            billingFrequency,
          },
        }),
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!selectedRateCardId,
  });

  const selectedGuest = useMemo(
    () => guests.find((g) => g.id === selectedGuestId),
    [guests, selectedGuestId]
  );

  const selectedSite = useMemo(
    () => sites.find((s) => s.id === selectedSiteId),
    [sites, selectedSiteId]
  );

  const selectedRateCard = useMemo(
    () => rateCards.find((rc) => rc.id === selectedRateCardId),
    [rateCards, selectedRateCardId]
  );

  // Create seasonal mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/campgrounds/${campgroundId}/seasonals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
          vehiclePlates: vehiclePlates
            ? vehiclePlates.split(",").map((p) => p.trim())
            : [],
          petCount,
          petNotes: petNotes || undefined,
          emergencyContact: emergencyContact || undefined,
          emergencyPhone: emergencyPhone || undefined,
          coiExpiresAt: coiExpiresAt ? new Date(coiExpiresAt).toISOString() : undefined,
          notes: notes || undefined,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create seasonal guest");
      }
      return response.json();
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
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
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
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Guest
              </CardTitle>
              <CardDescription>Select an existing guest or create a new one</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Search guests by name or email..."
                value={guestSearch}
                onChange={(e) => setGuestSearch(e.target.value)}
              />
              {loadingGuests ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : guests.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No guests found. Try a different search.
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
                  {guests.slice(0, 20).map((guest) => (
                    <div
                      key={guest.id}
                      className={`p-3 cursor-pointer hover:bg-muted transition-colors ${
                        selectedGuestId === guest.id ? "bg-primary/10 border-l-2 border-primary" : ""
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
            </CardContent>
          </Card>

          {/* Site Assignment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Site Assignment
              </CardTitle>
              <CardDescription>Assign a site for the season (optional)</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedSiteId || "__none__"} onValueChange={(v) => setSelectedSiteId(v === "__none__" ? "" : v)}>
                <SelectTrigger>
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
                <Label>Billing Frequency</Label>
                <Select value={billingFrequency} onValueChange={setBillingFrequency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="seasonal">Full Season</SelectItem>
                    <SelectItem value="biweekly">Bi-Weekly</SelectItem>
                    <SelectItem value="semi_monthly">Semi-Monthly (1st & 15th)</SelectItem>
                    <SelectItem value="deposit_plus_monthly">Deposit + Monthly</SelectItem>
                    <SelectItem value="offseason_installments">Off-Season Installments</SelectItem>
                    <SelectItem value="custom">Custom Schedule</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payment Day of Month</Label>
                  <Select
                    value={String(paymentDay)}
                    onValueChange={(v) => setPaymentDay(Number(v))}
                  >
                    <SelectTrigger>
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
                  <Label>Preferred Payment Method</Label>
                  <Select value={preferredPaymentMethod || "__any__"} onValueChange={(v) => setPreferredPaymentMethod(v === "__any__" ? "" : v)}>
                    <SelectTrigger>
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
                  <Switch checked={paysInFull} onCheckedChange={setPaysInFull} />
                  <Label>Pays in Full</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={autoPayEnabled} onCheckedChange={setAutoPayEnabled} />
                  <Label>Auto-Pay Enabled</Label>
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
                <Switch checked={isMetered} onCheckedChange={setIsMetered} />
                <Label>Guest is on metered utilities</Label>
              </div>

              {isMetered && (
                <div className="pl-6 space-y-3 border-l-2">
                  <div className="flex items-center gap-2">
                    <Switch checked={meteredElectric} onCheckedChange={setMeteredElectric} />
                    <Label>Metered Electric</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={meteredWater} onCheckedChange={setMeteredWater} />
                    <Label>Metered Water</Label>
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
                  <Label className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Emergency Contact
                  </Label>
                  <Input
                    placeholder="Contact name"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Emergency Phone</Label>
                  <Input
                    placeholder="Phone number"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  Vehicle Plates
                </Label>
                <Input
                  placeholder="ABC123, XYZ789 (comma separated)"
                  value={vehiclePlates}
                  onChange={(e) => setVehiclePlates(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Dog className="h-4 w-4" />
                    Number of Pets
                  </Label>
                  <Select value={String(petCount)} onValueChange={(v) => setPetCount(Number(v))}>
                    <SelectTrigger>
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
                    <Label>Pet Notes</Label>
                    <Input
                      placeholder="Breeds, names..."
                      value={petNotes}
                      onChange={(e) => setPetNotes(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Certificate of Insurance Expiry</Label>
                <Input
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
                              <div key={i} className="flex justify-between text-sm text-green-600">
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
                            <div key={i} className="text-sm text-amber-700 bg-amber-50 p-2 rounded">
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
                            <div key={i} className="flex justify-between text-xs text-muted-foreground">
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
                  <span className="font-medium capitalize">{billingFrequency.replace("_", " ")}</span>
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
                {(createMutation.error as Error).message}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
