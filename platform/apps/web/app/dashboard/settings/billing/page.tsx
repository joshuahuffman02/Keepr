"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useCampground } from "@/contexts/CampgroundContext";
import {
  CreditCard,
  Receipt,
  TrendingUp,
  MessageSquare,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  ChevronRight,
  Crown,
  Rocket,
  Star,
  Wrench,
  Database,
  Headphones,
  Loader2,
  DollarSign,
  ArrowDownRight,
  ArrowUpRight,
  Wallet,
  BarChart3,
  Info,
  Building,
  Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";

interface BillingSummary {
  organization: {
    id: string;
    name: string;
    billingEmail: string | null;
  };
  tier: {
    name: string;
    displayName: string;
    lockedBookingFee: number | null;
    monthlyFeeEndsAt: string | null;
  };
  currentPeriod: {
    id: string;
    periodStart: string;
    periodEnd: string;
    status: string;
    dueAt: string | null;
  };
  charges: {
    subscription: { description: string; amountCents: number };
    bookingFees: {
      description: string;
      quantity: number;
      unitCents: number;
      amountCents: number;
    };
    smsOutbound: {
      description: string;
      quantity: number;
      unitCents: number;
      amountCents: number;
    };
    smsInbound: {
      description: string;
      quantity: number;
      unitCents: number;
      amountCents: number;
    };
    aiUsage?: {
      description: string;
      quantity: number;
      unitCents: number;
      amountCents: number;
    };
  };
  totals: {
    subtotalCents: number;
    discountCents: number;
    taxCents: number;
    totalCents: number;
  };
  usage: {
    bookingCount: number;
    smsOutbound: number;
    smsInbound: number;
    aiTokens: number;
    setupServiceSurchargeCount: number;
    setupServiceSurchargeCents: number;
  };
  setupServices: {
    activeWithBalance: Array<{
      id: string;
      serviceType: string;
      totalCents: number;
      balanceRemainingCents: number;
      bookingsCharged: number;
    }>;
    totalBalanceRemainingCents: number;
  };
}

interface SetupService {
  id: string;
  serviceType: string;
  status: string;
  totalCents: number;
  paidUpfrontCents: number;
  balanceRemainingCents: number;
  perBookingSurchargeCents: number;
  bookingsCharged: number;
  displayName: string;
  isPaidOff: boolean;
  progressPercent: number;
  createdAt: string;
}

interface BillingPeriod {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  totalCents: number;
  paidAt: string | null;
  dueAt: string | null;
}

interface RevenueSummary {
  campground: {
    id: string;
    name: string;
    billingTier: string;
  };
  summary: {
    periodStart: string;
    periodEnd: string;
    revenue: {
      grossRevenueCents: number;
      reservationCount: number;
      averageBookingValue: number;
    };
    platformFees: {
      perBookingFeeCents: number;
      bookingCount: number;
      smsOutboundCents: number;
      smsInboundCents: number;
      totalCents: number;
    };
    paymentFees: {
      stripeFeesCents: number;
      refundsCents: number;
      disputesCents: number;
      totalCents: number;
    };
    netRevenue: {
      totalCents: number;
      payoutsCents: number;
      pendingPayoutCents: number;
    };
  };
}

interface PayoutRecord {
  id: string;
  stripePayoutId: string;
  status: string;
  amountCents: number;
  currency: string;
  arrivalDate: string;
  paidAt: string | null;
  createdAt: string;
  summary: {
    chargeCount: number;
    refundCount: number;
    feeCount: number;
  };
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPeriod(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return `${startDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;
}

const tierIcons: Record<string, React.ReactNode> = {
  founders_circle: <Crown className="h-5 w-5" />,
  pioneer: <Rocket className="h-5 w-5" />,
  trailblazer: <Star className="h-5 w-5" />,
  standard: <CreditCard className="h-5 w-5" />,
};

const tierColors: Record<string, string> = {
  founders_circle: "bg-amber-500",
  pioneer: "bg-emerald-500",
  trailblazer: "bg-violet-500",
  standard: "bg-muted",
};

const statusStyles: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  open: {
    icon: <Clock className="h-4 w-4" />,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  invoiced: {
    icon: <Receipt className="h-4 w-4" />,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  paid: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  past_due: {
    icon: <AlertCircle className="h-4 w-4" />,
    color: "text-red-600",
    bg: "bg-red-50",
  },
};

export default function BillingPage() {
  const { selectedCampground, isHydrated } = useCampground();

  // Fetch full campground data to get organizationId
  const { data: campgroundData } = useQuery<{ organizationId: string }>({
    queryKey: ["campground", selectedCampground?.id],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/campgrounds/${selectedCampground?.id}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("campreserv:authToken")}` },
        }
      );
      if (!res.ok) throw new Error("Failed to fetch campground");
      return res.json();
    },
    enabled: !!selectedCampground?.id,
  });

  const organizationId = campgroundData?.organizationId;

  const { data: summary, isLoading: summaryLoading } = useQuery<BillingSummary>({
    queryKey: ["billing-summary", organizationId],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/organizations/${organizationId}/billing/summary`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("campreserv:authToken")}` },
        }
      );
      if (!res.ok) throw new Error("Failed to fetch billing summary");
      return res.json();
    },
    enabled: !!organizationId,
  });

  const { data: history, isLoading: historyLoading } = useQuery<BillingPeriod[]>({
    queryKey: ["billing-history", organizationId],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/organizations/${organizationId}/billing/history?limit=6`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("campreserv:authToken")}` },
        }
      );
      if (!res.ok) throw new Error("Failed to fetch billing history");
      return res.json();
    },
    enabled: !!organizationId,
  });

  // Setup services
  const { data: setupServices } = useQuery<SetupService[]>({
    queryKey: ["setup-services", organizationId],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/organizations/${organizationId}/setup-services`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("campreserv:authToken")}` },
        }
      );
      if (!res.ok) throw new Error("Failed to fetch setup services");
      return res.json();
    },
    enabled: !!organizationId,
  });

  // Revenue dashboard - campground-level billing transparency
  const { data: revenueSummary } = useQuery<RevenueSummary>({
    queryKey: ["revenue-summary", selectedCampground?.id],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/campgrounds/${selectedCampground?.id}/billing-dashboard/summary`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("campreserv:authToken")}` },
        }
      );
      if (!res.ok) throw new Error("Failed to fetch revenue summary");
      return res.json();
    },
    enabled: !!selectedCampground?.id,
  });

  // Payout history
  const { data: payouts } = useQuery<PayoutRecord[]>({
    queryKey: ["payouts", selectedCampground?.id],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/campgrounds/${selectedCampground?.id}/billing-dashboard/payouts?limit=5`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("campreserv:authToken")}` },
        }
      );
      if (!res.ok) throw new Error("Failed to fetch payouts");
      return res.json();
    },
    enabled: !!selectedCampground?.id,
  });

  const queryClient = useQueryClient();
  const [purchaseType, setPurchaseType] = useState<string | null>(null);
  const [payUpfront, setPayUpfront] = useState(true);

  const purchaseMutation = useMutation({
    mutationFn: async ({
      serviceType,
      payUpfront,
    }: {
      serviceType: string;
      payUpfront: boolean;
    }) => {
      const res = await fetch(
        `${API_BASE}/organizations/${organizationId}/setup-services`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("campreserv:authToken")}`,
          },
          body: JSON.stringify({ serviceType, payUpfront }),
        }
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to purchase");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["setup-services"] });
      queryClient.invalidateQueries({ queryKey: ["billing-summary"] });
      setPurchaseType(null);
    },
  });

  const isLoading = summaryLoading || historyLoading;

  // Wait for hydration before showing "no campground" message to avoid hydration mismatch
  if (!isHydrated || (!organizationId && !selectedCampground?.id)) {
    return (
      <div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      </div>
    );
  }

  if (!organizationId) {
    return (
      <div>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Please select a campground first.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Billing & Usage</h1>
            <p className="text-muted-foreground mt-1">
              View your subscription, usage, and payment history
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/dashboard/settings/payments">
              <CreditCard className="h-4 w-4 mr-2" />
              Payment Settings
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-48 bg-muted rounded-2xl animate-pulse"
              />
            ))}
          </div>
        ) : summary ? (
          <>
            {/* Tier Badge */}
            <div
              className={`${tierColors[summary.tier.name] || tierColors.standard} rounded-2xl p-6 text-white`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-card/20 rounded-xl flex items-center justify-center">
                    {tierIcons[summary.tier.name] || tierIcons.standard}
                  </div>
                  <div>
                    <p className="text-white/80 text-sm font-medium">
                      Current Plan
                    </p>
                    <h2 className="text-2xl font-bold">
                      {summary.tier.displayName}
                    </h2>
                  </div>
                </div>
                <div className="text-right">
                  {summary.tier.lockedBookingFee && (
                    <div>
                      <p className="text-white/80 text-sm">Locked Rate</p>
                      <p className="text-xl font-semibold">
                        {formatCents(summary.tier.lockedBookingFee)}/booking
                      </p>
                    </div>
                  )}
                  {summary.tier.monthlyFeeEndsAt && (
                    <p className="text-white/70 text-sm mt-1">
                      Free monthly until{" "}
                      {formatDate(summary.tier.monthlyFeeEndsAt)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Revenue Transparency Section */}
            {revenueSummary && (
              <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                <div className="p-6 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">
                          Revenue This Month
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          What you earned from guest payments
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-600 text-sm">
                      <Info className="h-4 w-4" />
                      <span>Fee breakdown included</span>
                    </div>
                  </div>
                </div>

                {/* Revenue Summary Cards */}
                <div className="grid md:grid-cols-4 gap-4 p-6 bg-muted">
                  <div className="bg-card rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                      Gross Revenue
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {formatCents(revenueSummary.summary.revenue.grossRevenueCents)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {revenueSummary.summary.revenue.reservationCount} bookings
                    </p>
                  </div>

                  <div className="bg-card rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <ArrowDownRight className="h-4 w-4 text-red-500" />
                      Payment Fees
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      -{formatCents(revenueSummary.summary.paymentFees.totalCents)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Stripe processing fees
                    </p>
                  </div>

                  <div className="bg-card rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <Building className="h-4 w-4 text-blue-500" />
                      Platform Fees
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      -{formatCents(revenueSummary.summary.platformFees.totalCents)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Per-booking + SMS
                    </p>
                  </div>

                  <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                    <div className="flex items-center gap-2 text-emerald-700 text-sm mb-1">
                      <Wallet className="h-4 w-4" />
                      Net Earnings
                    </div>
                    <p className="text-2xl font-bold text-emerald-700">
                      {formatCents(revenueSummary.summary.netRevenue.totalCents)}
                    </p>
                    <p className="text-xs text-emerald-600 mt-1">
                      {revenueSummary.summary.netRevenue.pendingPayoutCents > 0 && (
                        <>
                          {formatCents(revenueSummary.summary.netRevenue.pendingPayoutCents)} pending
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Fee Details */}
                <div className="p-6 border-t border-border">
                  <h4 className="text-sm font-semibold text-foreground mb-4">
                    Fee Breakdown
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Stripe processing fees</span>
                      <span className="text-foreground font-medium">
                        {formatCents(revenueSummary.summary.paymentFees.stripeFeesCents)}
                      </span>
                    </div>
                    {revenueSummary.summary.paymentFees.refundsCents > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Refunds processed</span>
                        <span className="text-foreground font-medium">
                          {formatCents(revenueSummary.summary.paymentFees.refundsCents)}
                        </span>
                      </div>
                    )}
                    {revenueSummary.summary.paymentFees.disputesCents > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-red-600">Disputes/Chargebacks</span>
                        <span className="text-red-600 font-medium">
                          {formatCents(revenueSummary.summary.paymentFees.disputesCents)}
                        </span>
                      </div>
                    )}
                    <div className="border-t border-border pt-3 flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Per-booking fees ({revenueSummary.summary.platformFees.bookingCount} bookings)
                      </span>
                      <span className="text-foreground font-medium">
                        {formatCents(revenueSummary.summary.platformFees.perBookingFeeCents)}
                      </span>
                    </div>
                    {revenueSummary.summary.platformFees.smsOutboundCents > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">SMS messaging</span>
                        <span className="text-foreground font-medium">
                          {formatCents(
                            revenueSummary.summary.platformFees.smsOutboundCents +
                              revenueSummary.summary.platformFees.smsInboundCents
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Recent Payouts */}
            {payouts && payouts.length > 0 && (
              <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                <div className="p-6 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                      <Wallet className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">
                        Recent Payouts
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Bank deposits from Stripe
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/dashboard/settings/payments">
                      View All
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                </div>
                <div className="divide-y divide-border">
                  {payouts.map((payout) => (
                    <div
                      key={payout.id}
                      className="px-6 py-4 flex items-center justify-between hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            payout.status === "paid"
                              ? "bg-emerald-50"
                              : payout.status === "failed"
                                ? "bg-red-50"
                                : "bg-blue-50"
                          }`}
                        >
                          {payout.status === "paid" ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                          ) : payout.status === "failed" ? (
                            <AlertCircle className="h-5 w-5 text-red-600" />
                          ) : (
                            <Clock className="h-5 w-5 text-blue-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {formatCents(payout.amountCents)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {payout.summary.chargeCount} charges
                            {payout.summary.refundCount > 0 &&
                              `, ${payout.summary.refundCount} refunds`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-foreground capitalize">
                          {payout.status === "paid" ? "Deposited" : payout.status}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {payout.paidAt
                            ? formatDate(payout.paidAt)
                            : `Est. ${formatDate(payout.arrivalDate)}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Platform Fees - Current Period Summary */}
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      Platform Fees - Current Period
                    </h3>
                    <p className="text-muted-foreground">
                      {formatPeriod(
                        summary.currentPeriod.periodStart,
                        summary.currentPeriod.periodEnd
                      )}
                    </p>
                  </div>
                  <div
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${statusStyles[summary.currentPeriod.status]?.bg || "bg-muted"} ${statusStyles[summary.currentPeriod.status]?.color || "text-muted-foreground"}`}
                  >
                    {statusStyles[summary.currentPeriod.status]?.icon}
                    <span className="text-sm font-medium capitalize">
                      {summary.currentPeriod.status.replace("_", " ")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Charges Breakdown */}
              <div className="divide-y divide-border">
                {/* Subscription */}
                <div className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {summary.charges.subscription.description}
                      </p>
                      <p className="text-sm text-muted-foreground">Fixed monthly fee</p>
                    </div>
                  </div>
                  <p className="font-semibold text-foreground">
                    {formatCents(summary.charges.subscription.amountCents)}
                  </p>
                </div>

                {/* Booking Fees */}
                <div className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        Per-Booking Fees
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {summary.charges.bookingFees.quantity} bookings @{" "}
                        {formatCents(summary.charges.bookingFees.unitCents)} each
                      </p>
                    </div>
                  </div>
                  <p className="font-semibold text-foreground">
                    {formatCents(summary.charges.bookingFees.amountCents)}
                  </p>
                </div>

                {/* SMS Outbound */}
                {summary.charges.smsOutbound.quantity > 0 && (
                  <div className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-violet-50 rounded-lg flex items-center justify-center">
                        <MessageSquare className="h-5 w-5 text-violet-600" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          Outbound SMS
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {summary.charges.smsOutbound.quantity} messages @{" "}
                          {formatCents(summary.charges.smsOutbound.unitCents)}{" "}
                          each
                        </p>
                      </div>
                    </div>
                    <p className="font-semibold text-foreground">
                      {formatCents(summary.charges.smsOutbound.amountCents)}
                    </p>
                  </div>
                )}

                {/* SMS Inbound */}
                {summary.charges.smsInbound.quantity > 0 && (
                  <div className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
                        <MessageSquare className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Inbound SMS</p>
                        <p className="text-sm text-muted-foreground">
                          {summary.charges.smsInbound.quantity} messages @{" "}
                          {formatCents(summary.charges.smsInbound.unitCents)}{" "}
                          each
                        </p>
                      </div>
                    </div>
                    <p className="font-semibold text-foreground">
                      {formatCents(summary.charges.smsInbound.amountCents)}
                    </p>
                  </div>
                )}

                {/* AI Usage */}
                {summary.charges.aiUsage && summary.charges.aiUsage.quantity > 0 && (
                  <div className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                        <Cpu className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">AI Usage</p>
                        <p className="text-sm text-muted-foreground">
                          {(summary.charges.aiUsage.quantity / 1000).toFixed(1)}K tokens @{" "}
                          {formatCents(summary.charges.aiUsage.unitCents)}/1K
                        </p>
                      </div>
                    </div>
                    <p className="font-semibold text-foreground">
                      {formatCents(summary.charges.aiUsage.amountCents)}
                    </p>
                  </div>
                )}

                {/* Total */}
                <div className="px-6 py-4 bg-muted flex items-center justify-between">
                  <p className="font-semibold text-foreground">
                    Estimated Total for Period
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {formatCents(summary.totals.totalCents)}
                  </p>
                </div>
              </div>
            </div>

            {/* Usage Stats */}
            <div className="grid md:grid-cols-4 gap-4">
              <div className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-emerald-600" />
                  </div>
                  <span className="text-sm text-muted-foreground">Bookings</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {summary.usage.bookingCount}
                </p>
              </div>

              <div className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-violet-600" />
                  </div>
                  <span className="text-sm text-muted-foreground">SMS Sent</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {summary.usage.smsOutbound}
                </p>
              </div>

              <div className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-indigo-600" />
                  </div>
                  <span className="text-sm text-muted-foreground">SMS Received</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {summary.usage.smsInbound}
                </p>
              </div>

              <div className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-amber-600" />
                  </div>
                  <span className="text-sm text-muted-foreground">AI Tokens</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {summary.usage.aiTokens.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Setup Services Section - only show if has active pay-over-time balance OR still in setup phase */}
            {((setupServices && setupServices.some(s => s.balanceRemainingCents > 0)) || summary.usage.bookingCount === 0) && (
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                      <Wrench className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">
                        Setup Assistance
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Need help getting set up? We&apos;ve got you covered.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Setup Services with Balance */}
              {setupServices && setupServices.filter(s => s.balanceRemainingCents > 0).length > 0 && (
                <div className="p-6 border-b border-border bg-blue-50/50">
                  <h4 className="text-sm font-semibold text-foreground mb-4">
                    Pay-Over-Time Balance
                  </h4>
                  <div className="space-y-4">
                    {setupServices
                      .filter((s) => s.balanceRemainingCents > 0)
                      .map((service) => (
                        <div
                          key={service.id}
                          className="bg-card rounded-lg p-4 border border-border"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-foreground">
                              {service.displayName}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {formatCents(service.balanceRemainingCents)} remaining
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all"
                              style={{ width: `${service.progressPercent}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            {service.bookingsCharged} bookings charged @ $1.00 each
                            {" • "}
                            {Math.ceil(service.balanceRemainingCents / 100)} bookings to go
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Purchase Options - only show if still in setup phase (no bookings yet) */}
              {summary.usage.bookingCount === 0 && (
              <div className="p-6">
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Quick Start */}
                  <div className="border border-border rounded-xl p-5 hover:border-blue-300 transition-colors">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Headphones className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground">Quick Start</h4>
                        <p className="text-sm text-muted-foreground">We configure, you relax</p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-foreground mb-2">$249</p>
                    <ul className="text-sm text-muted-foreground space-y-1 mb-4">
                      <li>• Site & rate configuration</li>
                      <li>• Payment gateway setup</li>
                      <li>• 30-minute training call</li>
                    </ul>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setPurchaseType("quick_start");
                          setPayUpfront(true);
                        }}
                      >
                        Pay Now
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setPurchaseType("quick_start");
                          setPayUpfront(false);
                        }}
                      >
                        $1/booking
                      </Button>
                    </div>
                  </div>

                  {/* Data Import */}
                  <div className="border border-border rounded-xl p-5 hover:border-emerald-300 transition-colors">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <Database className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground">Data Import</h4>
                        <p className="text-sm text-muted-foreground">We import your reservations</p>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1 mb-4">
                      <div className="flex justify-between">
                        <span>Up to 500</span>
                        <span className="font-medium">$299</span>
                      </div>
                      <div className="flex justify-between">
                        <span>501 - 2,000</span>
                        <span className="font-medium">$599</span>
                      </div>
                      <div className="flex justify-between">
                        <span>2,001 - 5,000</span>
                        <span className="font-medium">$999</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setPurchaseType("data_import_500");
                          setPayUpfront(true);
                        }}
                      >
                        Get Started
                      </Button>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground text-center mt-4">
                  Pay-over-time: Add $1/booking until paid off. No interest, no pressure.
                </p>
              </div>
              )}
            </div>
            )}

            {/* Purchase Confirmation Modal */}
            {purchaseType && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-card rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
                  <h3 className="text-xl font-bold text-foreground mb-4">
                    Confirm Purchase
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    {payUpfront ? (
                      <>You&apos;ll be charged now for this service.</>
                    ) : (
                      <>
                        No upfront payment. We&apos;ll add $1.00 to each booking until
                        the service is paid off.
                      </>
                    )}
                  </p>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setPurchaseType(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() =>
                        purchaseMutation.mutate({
                          serviceType: purchaseType,
                          payUpfront,
                        })
                      }
                      disabled={purchaseMutation.isPending}
                    >
                      {purchaseMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Confirm"
                      )}
                    </Button>
                  </div>
                  {purchaseMutation.isError && (
                    <p className="text-red-600 text-sm mt-4">
                      {purchaseMutation.error.message}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Billing History */}
            {history && history.length > 0 && (
              <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                <div className="p-6 border-b border-border flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">
                    Billing History
                  </h3>
                  <Button variant="ghost" size="sm">
                    View All
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>

                <div className="divide-y divide-border">
                  {history.slice(1).map((period) => (
                    <div
                      key={period.id}
                      className="px-6 py-4 flex items-center justify-between hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${statusStyles[period.status]?.bg || "bg-muted"}`}
                        >
                          {statusStyles[period.status]?.icon || (
                            <Receipt className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {formatPeriod(period.periodStart, period.periodEnd)}
                          </p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {period.status.replace("_", " ")}
                            {period.paidAt && ` on ${formatDate(period.paidAt)}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="font-semibold text-foreground">
                          {formatCents(period.totalCents)}
                        </p>
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payment Method */}
            <div className="bg-muted rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">
                    Payment Method
                  </h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    Manage how you pay for Keepr
                  </p>
                </div>
                <Button variant="outline" asChild>
                  <Link href="/dashboard/settings/payments">
                    Update Payment Method
                  </Link>
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No billing data available
            </h3>
            <p className="text-muted-foreground">
              Billing information will appear here once your account is set up.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
