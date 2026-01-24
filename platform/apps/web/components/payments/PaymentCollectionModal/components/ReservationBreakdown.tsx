"use client";

import React, { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  Tag,
  TrendingUp,
  Clock,
  Percent,
  Info,
  Heart,
  CreditCard,
  Building2,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../../ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../ui/tooltip";
import { usePaymentContext } from "../context/PaymentContext";
import { apiClient } from "../../../../lib/api-client";
import { Quote, Reservation } from "@keepr/shared";

interface ReservationBreakdownProps {
  compact?: boolean;
}

export function ReservationBreakdown({ compact = false }: ReservationBreakdownProps) {
  const { props, state } = usePaymentContext();
  const [isOpen, setIsOpen] = useState(true);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);

  // Get charity donation and config from context
  const charityDonation = state.charityDonation;
  const config = state.config;

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  // Get reservationId from subject
  const reservationId =
    props.subject.type === "reservation"
      ? props.subject.reservationId
      : props.subject.type === "balance"
        ? props.subject.reservationId
        : null;

  // Fetch reservation and quote data
  useEffect(() => {
    const fetchData = async () => {
      if (!reservationId) {
        setLoading(false);
        return;
      }

      try {
        // Fetch reservation
        const res = await apiClient.getReservation(reservationId);
        setReservation(res);

        // Fetch quote for pricing rules
        if (res.campgroundId && res.siteId) {
          const arrivalDate =
            typeof res.arrivalDate === "string"
              ? res.arrivalDate.split("T")[0]
              : new Date(res.arrivalDate).toISOString().split("T")[0];
          const departureDate =
            typeof res.departureDate === "string"
              ? res.departureDate.split("T")[0]
              : new Date(res.departureDate).toISOString().split("T")[0];

          const quoteData = await apiClient.getQuote(res.campgroundId, {
            siteId: res.siteId,
            arrivalDate,
            departureDate,
          });
          setQuote(quoteData);
        }
      } catch (err) {
        console.error("Failed to fetch reservation breakdown:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [reservationId]);

  // Rule type helpers
  const getRuleIcon = (type: string) => {
    switch (type) {
      case "seasonal":
      case "dow":
        return <Tag className="w-3 h-3" />;
      case "demand":
        return <TrendingUp className="w-3 h-3" />;
      case "length_of_stay":
        return <Clock className="w-3 h-3" />;
      default:
        return <Percent className="w-3 h-3" />;
    }
  };

  const getRuleTypeLabel = (type: string) => {
    switch (type) {
      case "seasonal":
        return "Seasonal Rate";
      case "dow":
        return "Day of Week";
      case "demand":
        return "Dynamic Pricing";
      case "length_of_stay":
        return "Length of Stay";
      case "override":
        return "Rate Override";
      default:
        return type;
    }
  };

  if (!reservationId) return null;
  if (loading) return null;
  if (!reservation) return null;

  const baseCents = reservation.baseSubtotal ?? 0;
  const taxCents = reservation.taxesAmount ?? 0;
  const feesCents = reservation.feesAmount ?? 0;
  const discountsCents = reservation.discountsAmount ?? 0;
  const totalCents = reservation.totalAmount ?? 0;
  const earlyCheckInCharge = reservation.earlyCheckInCharge ?? 0;
  const lateCheckoutCharge = reservation.lateCheckoutCharge ?? 0;

  // Charity donation from context
  const donationCents = charityDonation.optedIn ? charityDonation.amountCents : 0;

  // Grand total including donation
  const grandTotalCents = totalCents + donationCents;

  // Fee calculations from config
  const ccFeePercent = config ? config.feePercentBasisPoints / 100 : 2.9;
  const ccFeeFlatCents = config?.feeFlatCents ?? 30;
  // If fees are being charged to guest, they're being passed through (not absorbed)
  const ccFeeMode = feesCents > 0 ? "pass_through" : (config?.feeMode ?? "pass_through");

  // Only show CC fees for card-based payment methods
  const selectedMethod = state.selectedMethod;
  const isCardPayment =
    !selectedMethod ||
    ["card", "saved_card", "terminal", "apple_pay", "google_pay", "link"].includes(selectedMethod);

  // Platform fee (Campreserv's per-booking fee)
  // Default based on billing plan: Enterprise=$1, Standard=$2, OTA=$3
  const billingPlan = config?.billingPlan ?? "ota_only";
  const defaultPlatformFee =
    billingPlan === "enterprise" ? 100 : billingPlan === "standard" ? 200 : 300;
  const platformFeeCents = config?.perBookingFeeCents ?? defaultPlatformFee;
  const platformFeeMode = config?.platformFeeMode ?? "pass_through";
  const billingPlanLabel =
    billingPlan === "enterprise" ? "Enterprise" : billingPlan === "standard" ? "Standard" : "OTA";

  // CC fee estimate - calculated on grand total for pass_through mode
  const estimatedCCFeeCents = Math.round((grandTotalCents * ccFeePercent) / 100 + ccFeeFlatCents);

  // CC fee on charity donation specifically (for accounting info)
  const charityDonationCCFeeCents =
    donationCents > 0
      ? Math.round(
          (donationCents * ccFeePercent) / 100 +
            (donationCents > 0 ? ccFeeFlatCents * (donationCents / grandTotalCents) : 0),
        )
      : 0;

  if (compact) {
    return (
      <div className="text-xs text-muted-foreground space-y-1 py-2">
        <div className="flex justify-between">
          <span>Base ({quote?.nights ?? "?"} nights)</span>
          <span>{formatCurrency(quote?.baseSubtotalCents ?? baseCents)}</span>
        </div>
        {quote?.rulesDeltaCents !== undefined && quote.rulesDeltaCents !== 0 && (
          <div className="flex justify-between">
            <span>Pricing adjustments</span>
            <span className={quote.rulesDeltaCents >= 0 ? "text-amber-600" : "text-emerald-600"}>
              {quote.rulesDeltaCents >= 0 ? "+" : ""}
              {formatCurrency(quote.rulesDeltaCents)}
            </span>
          </div>
        )}
        {feesCents > 0 && (
          <div className="flex justify-between">
            <span>Fees</span>
            <span>+{formatCurrency(feesCents)}</span>
          </div>
        )}
        {taxCents > 0 && (
          <div className="flex justify-between">
            <span>Taxes</span>
            <span>+{formatCurrency(taxCents)}</span>
          </div>
        )}
        {donationCents > 0 && (
          <div className="flex justify-between">
            <span className="text-pink-600">Charity</span>
            <span className="text-pink-600">+{formatCurrency(donationCents)}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center justify-between w-full py-2 text-sm font-medium text-foreground hover:text-foreground transition-colors border-b border-border">
          <span className="flex items-center gap-2">
            <Info className="w-4 h-4" />
            Pricing Breakdown
          </span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-2 py-3 text-sm">
          {/* Base Rate */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Base Lodging ({quote?.nights ?? "?"} nights)
              </span>
              <span className="text-foreground">
                {formatCurrency(quote?.baseSubtotalCents ?? baseCents)}
              </span>
            </div>
            {quote?.perNightCents && (
              <div className="flex justify-between text-xs text-muted-foreground pl-3">
                <span>Avg per night</span>
                <span>{formatCurrency(quote.perNightCents)}/night</span>
              </div>
            )}
          </div>

          {/* Applied Pricing Rules */}
          {quote?.appliedRules && quote.appliedRules.length > 0 && (
            <div className="space-y-1 pt-1">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Pricing Rules
              </div>
              {quote.appliedRules.map((rule, idx) => (
                <div key={rule.id + idx} className="flex justify-between pl-2">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    {getRuleIcon(rule.type)}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help text-xs">{rule.name}</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">{getRuleTypeLabel(rule.type)}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </span>
                  <span
                    className={`text-xs ${rule.adjustmentCents >= 0 ? "text-amber-600" : "text-emerald-600"}`}
                  >
                    {rule.adjustmentCents >= 0 ? "+" : ""}
                    {formatCurrency(rule.adjustmentCents)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Dynamic pricing (if no detailed rules) */}
          {quote?.rulesDeltaCents !== undefined &&
            quote.rulesDeltaCents !== 0 &&
            !quote.appliedRules?.length && (
              <div className="flex justify-between">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <TrendingUp className="w-3 h-3" />
                  Dynamic Pricing
                </span>
                <span
                  className={quote.rulesDeltaCents >= 0 ? "text-amber-600" : "text-emerald-600"}
                >
                  {quote.rulesDeltaCents >= 0 ? "+" : ""}
                  {formatCurrency(quote.rulesDeltaCents)}
                </span>
              </div>
            )}

          {/* Early check-in / Late checkout */}
          {earlyCheckInCharge > 0 && (
            <div className="flex justify-between">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="w-3 h-3" />
                Early Check-in
              </span>
              <span className="text-foreground">+{formatCurrency(earlyCheckInCharge)}</span>
            </div>
          )}
          {lateCheckoutCharge > 0 && (
            <div className="flex justify-between">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="w-3 h-3" />
                Late Checkout
              </span>
              <span className="text-foreground">+{formatCurrency(lateCheckoutCharge)}</span>
            </div>
          )}

          {/* Fees Section - Platform Fee + CC Processing Fee */}
          {(feesCents > 0 || platformFeeCents > 0) && (
            <div className="space-y-1.5 pt-2 border-t border-border">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Fees & Processing
              </div>

              {/* Platform Fee (goes to Campreserv) */}
              {platformFeeCents > 0 && (
                <div className="flex justify-between pl-2">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Building2 className="w-3 h-3" />
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help text-xs">Platform Fee</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Per-booking fee ({billingPlanLabel} plan)</p>
                          <p className="text-xs text-muted-foreground">Goes to Campreserv</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </span>
                  <span className="flex items-center gap-1 text-xs">
                    <span
                      className={
                        platformFeeMode === "absorb"
                          ? "line-through text-muted-foreground"
                          : "text-foreground"
                      }
                    >
                      {formatCurrency(platformFeeCents)}
                    </span>
                    {platformFeeMode === "absorb" && (
                      <span className="text-emerald-600 text-xs">(absorbed)</span>
                    )}
                  </span>
                </div>
              )}

              {/* CC Processing Fee (goes to Stripe) - only show for card payments */}
              {isCardPayment && (
                <div className="flex justify-between pl-2">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <CreditCard className="w-3 h-3" />
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help text-xs">CC Processing</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">
                            {ccFeePercent}% + ${(ccFeeFlatCents / 100).toFixed(2)} per transaction
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Goes to Stripe (card payments only)
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </span>
                  <span className="text-xs text-foreground">
                    ~{formatCurrency(estimatedCCFeeCents)}
                  </span>
                </div>
              )}

              {/* Total fees if guest pays any */}
              {feesCents > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground pl-4 pt-1 border-t border-border">
                  <span>Fees charged to guest</span>
                  <span className="text-foreground">+{formatCurrency(feesCents)}</span>
                </div>
              )}
            </div>
          )}

          {/* Taxes */}
          {taxCents > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Taxes</span>
              <span className="text-foreground">+{formatCurrency(taxCents)}</span>
            </div>
          )}

          {/* Discounts */}
          {discountsCents > 0 && (
            <div className="flex justify-between">
              <span className="flex items-center gap-1.5 text-emerald-600">
                <Tag className="w-3 h-3" />
                Discounts
              </span>
              <span className="text-emerald-600">-{formatCurrency(discountsCents)}</span>
            </div>
          )}

          {/* Subtotal before extras */}
          <div className="flex justify-between pt-2 border-t border-border">
            <span className="text-muted-foreground">Reservation Subtotal</span>
            <span className="text-foreground">{formatCurrency(totalCents)}</span>
          </div>

          {/* Charity Round-Up (from context - shows when opted in) */}
          {donationCents > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="flex items-center gap-1.5 text-pink-600">
                  <Heart className="w-3 h-3" />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">Charity Round-Up</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">100% goes to charity</p>
                        <p className="text-xs text-muted-foreground">
                          CC fee (~{formatCurrency(charityDonationCCFeeCents)}) absorbed by
                          campground
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {charityDonation.charityName && (
                    <span className="text-xs text-pink-400">({charityDonation.charityName})</span>
                  )}
                </span>
                <span className="text-pink-600">+{formatCurrency(donationCents)}</span>
              </div>
            </div>
          )}

          {/* Grand Total - should be a nice round number when charity is opted in */}
          <div className="flex justify-between pt-2 border-t border-border font-medium">
            <span className="text-foreground">You Pay</span>
            <span className="text-lg text-foreground">{formatCurrency(grandTotalCents)}</span>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
