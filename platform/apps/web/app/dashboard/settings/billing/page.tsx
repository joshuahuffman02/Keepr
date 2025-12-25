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
  founders_circle: "from-amber-500 to-orange-500",
  pioneer: "from-emerald-500 to-teal-500",
  trailblazer: "from-violet-500 to-purple-500",
  standard: "from-slate-500 to-slate-600",
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
  const { selectedCampground } = useCampground();

  // Fetch full campground data to get organizationId
  const { data: campgroundData } = useQuery<{ organizationId: string }>({
    queryKey: ["campground", selectedCampground?.id],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/campgrounds/${selectedCampground?.id}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
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
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
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
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
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
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );
      if (!res.ok) throw new Error("Failed to fetch setup services");
      return res.json();
    },
    enabled: !!organizationId,
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
            Authorization: `Bearer ${localStorage.getItem("token")}`,
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

  if (!organizationId) {
    return (
      <div>
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-500">Please select a campground first.</p>
        </div>
      </div>
    );
  }

  const isLoading = summaryLoading || historyLoading;

  return (
    <div>
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Billing & Usage</h1>
            <p className="text-slate-600 mt-1">
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
                className="h-48 bg-slate-100 rounded-2xl animate-pulse"
              />
            ))}
          </div>
        ) : summary ? (
          <>
            {/* Tier Badge */}
            <div
              className={`bg-gradient-to-r ${tierColors[summary.tier.name] || tierColors.standard} rounded-2xl p-6 text-white`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
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

            {/* Current Period Summary */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      Current Period
                    </h3>
                    <p className="text-slate-600">
                      {formatPeriod(
                        summary.currentPeriod.periodStart,
                        summary.currentPeriod.periodEnd
                      )}
                    </p>
                  </div>
                  <div
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${statusStyles[summary.currentPeriod.status]?.bg || "bg-slate-100"} ${statusStyles[summary.currentPeriod.status]?.color || "text-slate-600"}`}
                  >
                    {statusStyles[summary.currentPeriod.status]?.icon}
                    <span className="text-sm font-medium capitalize">
                      {summary.currentPeriod.status.replace("_", " ")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Charges Breakdown */}
              <div className="divide-y divide-slate-100">
                {/* Subscription */}
                <div className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">
                        {summary.charges.subscription.description}
                      </p>
                      <p className="text-sm text-slate-500">Fixed monthly fee</p>
                    </div>
                  </div>
                  <p className="font-semibold text-slate-900">
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
                      <p className="font-medium text-slate-900">
                        Per-Booking Fees
                      </p>
                      <p className="text-sm text-slate-500">
                        {summary.charges.bookingFees.quantity} bookings @{" "}
                        {formatCents(summary.charges.bookingFees.unitCents)} each
                      </p>
                    </div>
                  </div>
                  <p className="font-semibold text-slate-900">
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
                        <p className="font-medium text-slate-900">
                          Outbound SMS
                        </p>
                        <p className="text-sm text-slate-500">
                          {summary.charges.smsOutbound.quantity} messages @{" "}
                          {formatCents(summary.charges.smsOutbound.unitCents)}{" "}
                          each
                        </p>
                      </div>
                    </div>
                    <p className="font-semibold text-slate-900">
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
                        <p className="font-medium text-slate-900">Inbound SMS</p>
                        <p className="text-sm text-slate-500">
                          {summary.charges.smsInbound.quantity} messages @{" "}
                          {formatCents(summary.charges.smsInbound.unitCents)}{" "}
                          each
                        </p>
                      </div>
                    </div>
                    <p className="font-semibold text-slate-900">
                      {formatCents(summary.charges.smsInbound.amountCents)}
                    </p>
                  </div>
                )}

                {/* Total */}
                <div className="px-6 py-4 bg-slate-50 flex items-center justify-between">
                  <p className="font-semibold text-slate-900">
                    Estimated Total for Period
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    {formatCents(summary.totals.totalCents)}
                  </p>
                </div>
              </div>
            </div>

            {/* Usage Stats */}
            <div className="grid md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-emerald-600" />
                  </div>
                  <span className="text-sm text-slate-600">Bookings</span>
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {summary.usage.bookingCount}
                </p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-violet-600" />
                  </div>
                  <span className="text-sm text-slate-600">SMS Sent</span>
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {summary.usage.smsOutbound}
                </p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-indigo-600" />
                  </div>
                  <span className="text-sm text-slate-600">SMS Received</span>
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {summary.usage.smsInbound}
                </p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-amber-600" />
                  </div>
                  <span className="text-sm text-slate-600">AI Tokens</span>
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {summary.usage.aiTokens.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Setup Services Section */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                      <Wrench className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        Setup Assistance
                      </h3>
                      <p className="text-sm text-slate-500">
                        Need help getting set up? We&apos;ve got you covered.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Setup Services with Balance */}
              {setupServices && setupServices.filter(s => s.balanceRemainingCents > 0).length > 0 && (
                <div className="p-6 border-b border-slate-100 bg-blue-50/50">
                  <h4 className="text-sm font-semibold text-slate-700 mb-4">
                    Pay-Over-Time Balance
                  </h4>
                  <div className="space-y-4">
                    {setupServices
                      .filter((s) => s.balanceRemainingCents > 0)
                      .map((service) => (
                        <div
                          key={service.id}
                          className="bg-white rounded-lg p-4 border border-slate-200"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-slate-900">
                              {service.displayName}
                            </span>
                            <span className="text-sm text-slate-600">
                              {formatCents(service.balanceRemainingCents)} remaining
                            </span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all"
                              style={{ width: `${service.progressPercent}%` }}
                            />
                          </div>
                          <p className="text-xs text-slate-500 mt-2">
                            {service.bookingsCharged} bookings charged @ $1.00 each
                            {" • "}
                            {Math.ceil(service.balanceRemainingCents / 100)} bookings to go
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Purchase Options */}
              <div className="p-6">
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Quick Start */}
                  <div className="border border-slate-200 rounded-xl p-5 hover:border-blue-300 transition-colors">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Headphones className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900">Quick Start</h4>
                        <p className="text-sm text-slate-500">We configure, you relax</p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 mb-2">$249</p>
                    <ul className="text-sm text-slate-600 space-y-1 mb-4">
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
                  <div className="border border-slate-200 rounded-xl p-5 hover:border-emerald-300 transition-colors">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <Database className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900">Data Import</h4>
                        <p className="text-sm text-slate-500">We import your reservations</p>
                      </div>
                    </div>
                    <div className="text-sm text-slate-600 space-y-1 mb-4">
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

                <p className="text-xs text-slate-500 text-center mt-4">
                  Pay-over-time: Add $1/booking until paid off. No interest, no pressure.
                </p>
              </div>
            </div>

            {/* Purchase Confirmation Modal */}
            {purchaseType && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
                  <h3 className="text-xl font-bold text-slate-900 mb-4">
                    Confirm Purchase
                  </h3>
                  <p className="text-slate-600 mb-6">
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
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Billing History
                  </h3>
                  <Button variant="ghost" size="sm">
                    View All
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>

                <div className="divide-y divide-slate-100">
                  {history.slice(1).map((period) => (
                    <div
                      key={period.id}
                      className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${statusStyles[period.status]?.bg || "bg-slate-100"}`}
                        >
                          {statusStyles[period.status]?.icon || (
                            <Receipt className="h-5 w-5 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">
                            {formatPeriod(period.periodStart, period.periodEnd)}
                          </p>
                          <p className="text-sm text-slate-500 capitalize">
                            {period.status.replace("_", " ")}
                            {period.paidAt && ` on ${formatDate(period.paidAt)}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="font-semibold text-slate-900">
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
            <div className="bg-slate-50 rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">
                    Payment Method
                  </h3>
                  <p className="text-slate-600 text-sm mt-1">
                    Manage how you pay for Camp Everyday
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
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <Receipt className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              No billing data available
            </h3>
            <p className="text-slate-600">
              Billing information will appear here once your account is set up.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
