"use client";

import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DashboardShell } from "../../../../../components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../../../components/ui/card";
import { Badge } from "../../../../../components/ui/badge";
import { Button } from "../../../../../components/ui/button";
import { Input } from "../../../../../components/ui/input";
import { Textarea } from "../../../../../components/ui/textarea";
import { Label } from "../../../../../components/ui/label";
import { format } from "date-fns";
import {
  Plus,
  Settings,
  DollarSign,
  Calendar,
  Tag,
  Gift,
  ChevronRight,
  X,
  Check,
  Percent,
  Zap,
  Users,
  Clock,
  CreditCard,
  Award,
  Trash2,
  Edit,
  Copy,
} from "lucide-react";

// Types
type BillingFrequency = "monthly" | "quarterly" | "semi_annual" | "seasonal";
type DiscountCondition =
  | "metered_utilities"
  | "pay_in_full"
  | "payment_method"
  | "early_bird"
  | "returning_guest"
  | "tenure_years"
  | "referral"
  | "military"
  | "senior"
  | "custom";
type DiscountType = "fixed_amount" | "percentage" | "per_month";
type IncentiveType =
  | "guest_passes"
  | "store_credit"
  | "free_nights"
  | "early_site_selection"
  | "rate_lock"
  | "amenity_access"
  | "custom";

interface Discount {
  id: string;
  name: string;
  description?: string;
  conditionType: DiscountCondition;
  conditionValue?: string;
  discountType: DiscountType;
  discountAmount: number;
  stackable: boolean;
  priority: number;
  isActive: boolean;
}

interface Incentive {
  id: string;
  name: string;
  description?: string;
  conditionType: DiscountCondition;
  conditionValue?: string;
  incentiveType: IncentiveType;
  incentiveValue: number;
  isActive: boolean;
}

interface RateCard {
  id: string;
  name: string;
  seasonYear: number;
  baseRate: number;
  billingFrequency: BillingFrequency;
  description?: string;
  includedUtilities: string[];
  seasonStartDate: string;
  seasonEndDate: string;
  isActive: boolean;
  isDefault: boolean;
  discounts: Discount[];
  incentives: Incentive[];
}

// Helper components
const conditionLabels: Record<DiscountCondition, string> = {
  metered_utilities: "Metered Utilities",
  pay_in_full: "Pay in Full",
  payment_method: "Payment Method",
  early_bird: "Early Bird",
  returning_guest: "Returning Guest",
  tenure_years: "Tenure Years",
  referral: "Referral",
  military: "Military/Veteran",
  senior: "Senior",
  custom: "Custom",
};

const discountTypeLabels: Record<DiscountType, string> = {
  fixed_amount: "Fixed Amount",
  percentage: "Percentage",
  per_month: "Per Month",
};

const incentiveTypeLabels: Record<IncentiveType, string> = {
  guest_passes: "Guest Passes",
  store_credit: "Store Credit",
  free_nights: "Free Nights",
  early_site_selection: "Early Site Selection",
  rate_lock: "Rate Lock",
  amenity_access: "Amenity Access",
  custom: "Custom",
};

const billingFrequencyLabels: Record<BillingFrequency, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  semi_annual: "Semi-Annual",
  seasonal: "Full Season",
};

function PricingPreview({
  rateCard,
  isMetered,
  paysInFull,
  paymentMethod,
}: {
  rateCard: RateCard;
  isMetered: boolean;
  paysInFull: boolean;
  paymentMethod: string;
}) {
  // Calculate preview
  let total = rateCard.baseRate;
  const appliedDiscounts: { name: string; amount: number }[] = [];

  for (const discount of rateCard.discounts.filter((d) => d.isActive)) {
    let applies = false;

    switch (discount.conditionType) {
      case "metered_utilities":
        applies = isMetered;
        break;
      case "pay_in_full":
        applies = paysInFull;
        break;
      case "payment_method":
        const methods = discount.conditionValue
          ? JSON.parse(discount.conditionValue).methods || []
          : [];
        applies = methods.includes(paymentMethod);
        break;
    }

    if (applies) {
      let amount = 0;
      if (discount.discountType === "fixed_amount") {
        amount = discount.discountAmount;
      } else if (discount.discountType === "percentage") {
        amount = (total * discount.discountAmount) / 100;
      } else if (discount.discountType === "per_month") {
        const months = 6; // Assume 6-month season for preview
        amount = discount.discountAmount * months;
      }
      appliedDiscounts.push({ name: discount.name, amount });
      total -= amount;
    }
  }

  // Find incentives
  const earnedIncentives = rateCard.incentives
    .filter((i) => i.isActive && (i.conditionType === "pay_in_full" ? paysInFull : false))
    .map((i) => ({
      name: i.name,
      value: i.incentiveValue,
      type: i.incentiveType,
    }));

  return (
    <div className="bg-muted rounded-lg p-4 space-y-3">
      <div className="text-sm font-medium text-foreground">Pricing Preview</div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Base Rate</span>
          <span className="font-medium">${rateCard.baseRate.toLocaleString()}</span>
        </div>
        {appliedDiscounts.map((d, i) => (
          <div key={i} className="flex justify-between text-emerald-600">
            <span>{d.name}</span>
            <span>-${d.amount.toLocaleString()}</span>
          </div>
        ))}
        <div className="border-t pt-2 flex justify-between font-bold">
          <span>Total</span>
          <span className="text-lg">${total.toLocaleString()}</span>
        </div>
      </div>
      {earnedIncentives.length > 0 && (
        <div className="border-t pt-3 mt-3">
          <div className="text-sm font-medium text-amber-700 mb-2 flex items-center gap-1">
            <Gift className="h-4 w-4" />
            Bonuses Earned
          </div>
          {earnedIncentives.map((i, idx) => (
            <div key={idx} className="text-sm text-amber-600 flex items-center gap-1">
              <Check className="h-3 w-3" />
              {i.type === "guest_passes" && `$${i.value} in Guest Passes`}
              {i.type === "store_credit" && `$${i.value} Store Credit`}
              {i.type !== "guest_passes" && i.type !== "store_credit" && i.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RateCardsPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const campgroundId = params.campgroundId as string;
  const currentYear = new Date().getFullYear();

  // State
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showIncentiveModal, setShowIncentiveModal] = useState(false);
  const [editingRateCard, setEditingRateCard] = useState<RateCard | null>(null);
  const [editingRateCardId, setEditingRateCardId] = useState<string | null>(null);

  // Preview state
  const [previewMetered, setPreviewMetered] = useState(false);
  const [previewPayInFull, setPreviewPayInFull] = useState(false);
  const [previewPaymentMethod, setPreviewPaymentMethod] = useState("check");

  // Form state
  const [newRateCard, setNewRateCard] = useState({
    name: `${currentYear + 1} Season`,
    seasonYear: currentYear + 1,
    baseRate: 2400,
    billingFrequency: "monthly" as BillingFrequency,
    description: "",
    includedUtilities: [] as string[],
    seasonStartDate: `${currentYear + 1}-04-15`,
    seasonEndDate: `${currentYear + 1}-10-15`,
    isDefault: true,
  });

  const [newDiscount, setNewDiscount] = useState({
    name: "",
    description: "",
    conditionType: "metered_utilities" as DiscountCondition,
    conditionValue: "",
    discountType: "fixed_amount" as DiscountType,
    discountAmount: 0,
    stackable: true,
    priority: 0,
  });

  const [newIncentive, setNewIncentive] = useState({
    name: "",
    description: "",
    conditionType: "pay_in_full" as DiscountCondition,
    conditionValue: "",
    incentiveType: "guest_passes" as IncentiveType,
    incentiveValue: 0,
  });

  // Queries
  const rateCardsQuery = useQuery({
    queryKey: ["rate-cards", campgroundId, selectedYear],
    queryFn: async () => {
      const response = await fetch(
        `/api/seasonals/campground/${campgroundId}/rate-cards?seasonYear=${selectedYear}`,
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("Failed to fetch rate cards");
      return response.json() as Promise<RateCard[]>;
    },
    enabled: !!campgroundId,
  });

  // Mutations
  const createRateCardMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/seasonals/rate-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...newRateCard, campgroundId }),
      });
      if (!response.ok) throw new Error("Failed to create rate card");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rate-cards", campgroundId] });
      setShowCreateModal(false);
      setNewRateCard({
        name: `${currentYear + 1} Season`,
        seasonYear: currentYear + 1,
        baseRate: 2400,
        billingFrequency: "monthly",
        description: "",
        includedUtilities: [],
        seasonStartDate: `${currentYear + 1}-04-15`,
        seasonEndDate: `${currentYear + 1}-10-15`,
        isDefault: true,
      });
    },
  });

  const addDiscountMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/seasonals/rate-cards/${editingRateCardId}/discounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newDiscount),
      });
      if (!response.ok) throw new Error("Failed to add discount");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rate-cards", campgroundId] });
      setShowDiscountModal(false);
      setNewDiscount({
        name: "",
        description: "",
        conditionType: "metered_utilities",
        conditionValue: "",
        discountType: "fixed_amount",
        discountAmount: 0,
        stackable: true,
        priority: 0,
      });
    },
  });

  const addIncentiveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/seasonals/rate-cards/${editingRateCardId}/incentives`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newIncentive),
      });
      if (!response.ok) throw new Error("Failed to add incentive");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rate-cards", campgroundId] });
      setShowIncentiveModal(false);
      setNewIncentive({
        name: "",
        description: "",
        conditionType: "pay_in_full",
        conditionValue: "",
        incentiveType: "guest_passes",
        incentiveValue: 0,
      });
    },
  });

  const rateCards = rateCardsQuery.data || [];

  return (
    <DashboardShell>
      <div className="space-y-4">
        <Breadcrumbs
          items={[
            { label: "Campgrounds", href: "/campgrounds?all=true" },
            { label: "Campground", href: `/campgrounds/${campgroundId}` },
            { label: "Seasonals", href: `/campgrounds/${campgroundId}/seasonals` },
            { label: "Rate Cards" },
          ]}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Seasonal Rate Cards</h1>
            <p className="text-sm text-muted-foreground">
              Configure pricing, discounts, and incentives for seasonal guests
            </p>
          </div>
          <div className="flex gap-2">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="text-sm border border-border rounded px-3 py-2"
            >
              {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((year) => (
                <option key={year} value={year}>
                  {year} Season
                </option>
              ))}
            </select>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-1" />
              New Rate Card
            </Button>
          </div>
        </div>

        {/* Rate Cards Grid */}
        {rateCardsQuery.isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading rate cards...</div>
        ) : rateCards.length === 0 ? (
          <Card className="p-12 text-center">
            <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-medium text-foreground">No rate cards for {selectedYear}</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Create a rate card to define pricing for seasonal guests
            </p>
            <Button onClick={() => {
              setNewRateCard({ ...newRateCard, seasonYear: selectedYear, name: `${selectedYear} Season` });
              setShowCreateModal(true);
            }}>
              <Plus className="h-4 w-4 mr-1" />
              Create Rate Card
            </Button>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            {rateCards.map((rateCard) => (
              <Card key={rateCard.id} className={`${!rateCard.isActive ? "opacity-60" : ""}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {rateCard.name}
                        {rateCard.isDefault && (
                          <Badge className="bg-blue-500">Default</Badge>
                        )}
                        {!rateCard.isActive && (
                          <Badge variant="outline" className="text-muted-foreground">
                            Inactive
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {format(new Date(rateCard.seasonStartDate), "MMM d")} -{" "}
                        {format(new Date(rateCard.seasonEndDate), "MMM d, yyyy")}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-foreground">
                        ${rateCard.baseRate.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {billingFrequencyLabels[rateCard.billingFrequency]}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {rateCard.description && (
                    <p className="text-sm text-muted-foreground">{rateCard.description}</p>
                  )}

                  {rateCard.includedUtilities.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {rateCard.includedUtilities.map((util) => (
                        <Badge key={util} variant="outline" className="text-xs">
                          {util}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Discounts */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-foreground flex items-center gap-1">
                        <Tag className="h-4 w-4" />
                        Discounts ({rateCard.discounts.filter((d) => d.isActive).length})
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingRateCardId(rateCard.id);
                          setShowDiscountModal(true);
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add
                      </Button>
                    </div>
                    <div className="space-y-1">
                      {rateCard.discounts.filter((d) => d.isActive).map((discount) => (
                        <div
                          key={discount.id}
                          className="flex items-center justify-between p-2 bg-emerald-50 rounded text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <Check className="h-3 w-3 text-emerald-600" />
                            <span>{discount.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {conditionLabels[discount.conditionType]}
                            </Badge>
                          </div>
                          <span className="font-medium text-emerald-700">
                            {discount.discountType === "percentage"
                              ? `-${discount.discountAmount}%`
                              : discount.discountType === "per_month"
                              ? `-$${discount.discountAmount}/mo`
                              : `-$${discount.discountAmount}`}
                          </span>
                        </div>
                      ))}
                      {rateCard.discounts.filter((d) => d.isActive).length === 0 && (
                        <p className="text-sm text-muted-foreground italic">No discounts configured</p>
                      )}
                    </div>
                  </div>

                  {/* Incentives */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-foreground flex items-center gap-1">
                        <Gift className="h-4 w-4" />
                        Incentives ({rateCard.incentives.filter((i) => i.isActive).length})
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingRateCardId(rateCard.id);
                          setShowIncentiveModal(true);
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add
                      </Button>
                    </div>
                    <div className="space-y-1">
                      {rateCard.incentives.filter((i) => i.isActive).map((incentive) => (
                        <div
                          key={incentive.id}
                          className="flex items-center justify-between p-2 bg-amber-50 rounded text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <Gift className="h-3 w-3 text-amber-600" />
                            <span>{incentive.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {conditionLabels[incentive.conditionType]}
                            </Badge>
                          </div>
                          <span className="font-medium text-amber-700">
                            ${incentive.incentiveValue} {incentiveTypeLabels[incentive.incentiveType]}
                          </span>
                        </div>
                      ))}
                      {rateCard.incentives.filter((i) => i.isActive).length === 0 && (
                        <p className="text-sm text-muted-foreground italic">No incentives configured</p>
                      )}
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="border-t pt-4">
                    <div className="flex items-center gap-4 mb-3 text-sm">
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={previewMetered}
                          onChange={(e) => setPreviewMetered(e.target.checked)}
                          className="rounded"
                        />
                        Metered
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={previewPayInFull}
                          onChange={(e) => setPreviewPayInFull(e.target.checked)}
                          className="rounded"
                        />
                        Pay in Full
                      </label>
                      <select
                        value={previewPaymentMethod}
                        onChange={(e) => setPreviewPaymentMethod(e.target.value)}
                        className="text-xs border rounded px-2 py-1"
                      >
                        <option value="check">Check</option>
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                        <option value="ach">ACH</option>
                      </select>
                    </div>
                    <PricingPreview
                      rateCard={rateCard}
                      isMetered={previewMetered}
                      paysInFull={previewPayInFull}
                      paymentMethod={previewPaymentMethod}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Rate Card Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Create Rate Card</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowCreateModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={newRateCard.name}
                      onChange={(e) => setNewRateCard({ ...newRateCard, name: e.target.value })}
                      placeholder="2025 Season"
                    />
                  </div>
                  <div>
                    <Label>Season Year</Label>
                    <Input
                      type="number"
                      value={newRateCard.seasonYear}
                      onChange={(e) =>
                        setNewRateCard({ ...newRateCard, seasonYear: parseInt(e.target.value) })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Base Rate ($)</Label>
                    <Input
                      type="number"
                      value={newRateCard.baseRate}
                      onChange={(e) =>
                        setNewRateCard({ ...newRateCard, baseRate: parseFloat(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <Label>Billing Frequency</Label>
                    <select
                      value={newRateCard.billingFrequency}
                      onChange={(e) =>
                        setNewRateCard({
                          ...newRateCard,
                          billingFrequency: e.target.value as BillingFrequency,
                        })
                      }
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="semi_annual">Semi-Annual</option>
                      <option value="seasonal">Full Season</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Season Start</Label>
                    <Input
                      type="date"
                      value={newRateCard.seasonStartDate}
                      onChange={(e) =>
                        setNewRateCard({ ...newRateCard, seasonStartDate: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Season End</Label>
                    <Input
                      type="date"
                      value={newRateCard.seasonEndDate}
                      onChange={(e) =>
                        setNewRateCard({ ...newRateCard, seasonEndDate: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={newRateCard.description}
                    onChange={(e) => setNewRateCard({ ...newRateCard, description: e.target.value })}
                    placeholder="Includes water, sewer, WiFi..."
                    rows={2}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isDefault"
                    checked={newRateCard.isDefault}
                    onChange={(e) => setNewRateCard({ ...newRateCard, isDefault: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="isDefault" className="cursor-pointer">
                    Set as default rate card for new seasonals
                  </Label>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={createRateCardMutation.isPending}
                    onClick={() => createRateCardMutation.mutate()}
                  >
                    {createRateCardMutation.isPending ? "Creating..." : "Create Rate Card"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Add Discount Modal */}
        {showDiscountModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Add Discount</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowDiscountModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Discount Name</Label>
                  <Input
                    value={newDiscount.name}
                    onChange={(e) => setNewDiscount({ ...newDiscount, name: e.target.value })}
                    placeholder="Metered Electric Discount"
                  />
                </div>

                <div>
                  <Label>Condition</Label>
                  <select
                    value={newDiscount.conditionType}
                    onChange={(e) =>
                      setNewDiscount({
                        ...newDiscount,
                        conditionType: e.target.value as DiscountCondition,
                      })
                    }
                    className="w-full border rounded px-3 py-2"
                  >
                    {Object.entries(conditionLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                {newDiscount.conditionType === "payment_method" && (
                  <div>
                    <Label>Allowed Methods (comma-separated)</Label>
                    <Input
                      placeholder="check, cash"
                      onChange={(e) =>
                        setNewDiscount({
                          ...newDiscount,
                          conditionValue: JSON.stringify({
                            methods: e.target.value.split(",").map((m) => m.trim()),
                          }),
                        })
                      }
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Discount Type</Label>
                    <select
                      value={newDiscount.discountType}
                      onChange={(e) =>
                        setNewDiscount({
                          ...newDiscount,
                          discountType: e.target.value as DiscountType,
                        })
                      }
                      className="w-full border rounded px-3 py-2"
                    >
                      {Object.entries(discountTypeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      value={newDiscount.discountAmount}
                      onChange={(e) =>
                        setNewDiscount({
                          ...newDiscount,
                          discountAmount: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="stackable"
                    checked={newDiscount.stackable}
                    onChange={(e) => setNewDiscount({ ...newDiscount, stackable: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="stackable" className="cursor-pointer">
                    Can stack with other discounts
                  </Label>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowDiscountModal(false)}>
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={!newDiscount.name || addDiscountMutation.isPending}
                    onClick={() => addDiscountMutation.mutate()}
                  >
                    {addDiscountMutation.isPending ? "Adding..." : "Add Discount"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Add Incentive Modal */}
        {showIncentiveModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Add Incentive</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowIncentiveModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Incentive Name</Label>
                  <Input
                    value={newIncentive.name}
                    onChange={(e) => setNewIncentive({ ...newIncentive, name: e.target.value })}
                    placeholder="Pay in Full Guest Pass Bonus"
                  />
                </div>

                <div>
                  <Label>Condition</Label>
                  <select
                    value={newIncentive.conditionType}
                    onChange={(e) =>
                      setNewIncentive({
                        ...newIncentive,
                        conditionType: e.target.value as DiscountCondition,
                      })
                    }
                    className="w-full border rounded px-3 py-2"
                  >
                    {Object.entries(conditionLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Incentive Type</Label>
                    <select
                      value={newIncentive.incentiveType}
                      onChange={(e) =>
                        setNewIncentive({
                          ...newIncentive,
                          incentiveType: e.target.value as IncentiveType,
                        })
                      }
                      className="w-full border rounded px-3 py-2"
                    >
                      {Object.entries(incentiveTypeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Value ($)</Label>
                    <Input
                      type="number"
                      value={newIncentive.incentiveValue}
                      onChange={(e) =>
                        setNewIncentive({
                          ...newIncentive,
                          incentiveValue: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowIncentiveModal(false)}>
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={!newIncentive.name || addIncentiveMutation.isPending}
                    onClick={() => addIncentiveMutation.mutate()}
                  >
                    {addIncentiveMutation.isPending ? "Adding..." : "Add Incentive"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
