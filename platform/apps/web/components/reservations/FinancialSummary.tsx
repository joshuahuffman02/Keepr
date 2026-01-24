import { useState, useEffect } from "react";
import { Reservation, Quote } from "@keepr/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  CreditCard,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Tag,
  Clock,
  Percent,
  Info,
  Building2,
} from "lucide-react";
import { PaymentCollectionModal } from "../payments/PaymentCollectionModal";
import { apiClient } from "@/lib/api-client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface FinancialSummaryProps {
  reservation: Reservation;
}

// Fee config type
interface FeeConfig {
  perBookingFeeCents: number;
  billingPlan: "ota_only" | "standard" | "enterprise";
  feeMode: "absorb" | "pass_through";
  feePercentBasisPoints?: number;
  feeFlatCents?: number;
}

const isBillingPlan = (value: string | null | undefined): value is FeeConfig["billingPlan"] =>
  value === "ota_only" || value === "standard" || value === "enterprise";

const isFeeMode = (value: string | null | undefined): value is FeeConfig["feeMode"] =>
  value === "absorb" || value === "pass_through";

export function FinancialSummary({ reservation }: FinancialSummaryProps) {
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(true);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [feeConfig, setFeeConfig] = useState<FeeConfig | null>(null);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const balanceCents = reservation.balanceAmount ?? 0;
  const totalCents = reservation.totalAmount ?? 0;
  const paidCents = reservation.paidAmount ?? 0;
  const baseCents = reservation.baseSubtotal ?? 0;
  const taxCents = reservation.taxesAmount ?? 0;
  const feesCents = reservation.feesAmount ?? 0;
  const discountsCents = reservation.discountsAmount ?? 0;
  const earlyCheckInCharge = reservation.earlyCheckInCharge ?? 0;
  const lateCheckoutCharge = reservation.lateCheckoutCharge ?? 0;

  const isPaid = balanceCents <= 0;

  const guest = reservation.guest;
  const guestId = guest?.id;
  const guestEmail = guest?.email;
  const guestName = guest
    ? `${guest.primaryFirstName || ""} ${guest.primaryLastName || ""}`.trim()
    : undefined;

  // Fetch quote data for pricing breakdown
  useEffect(() => {
    const fetchQuote = async () => {
      if (!reservation.campgroundId || !reservation.siteId) return;
      setQuoteLoading(true);
      try {
        const arrivalDate =
          typeof reservation.arrivalDate === "string"
            ? reservation.arrivalDate.split("T")[0]
            : new Date(reservation.arrivalDate).toISOString().split("T")[0];
        const departureDate =
          typeof reservation.departureDate === "string"
            ? reservation.departureDate.split("T")[0]
            : new Date(reservation.departureDate).toISOString().split("T")[0];
        const quoteData = await apiClient.getQuote(reservation.campgroundId, {
          siteId: reservation.siteId,
          arrivalDate,
          departureDate,
        });
        setQuote(quoteData);
      } catch (err) {
        console.error("Failed to fetch quote for breakdown:", err);
      } finally {
        setQuoteLoading(false);
      }
    };
    fetchQuote();
  }, [
    reservation.campgroundId,
    reservation.siteId,
    reservation.arrivalDate,
    reservation.departureDate,
  ]);

  // Fetch campground fee settings
  useEffect(() => {
    const fetchFeeConfig = async () => {
      if (!reservation.campgroundId) return;
      try {
        const settings = await apiClient.getCampgroundPaymentSettings(reservation.campgroundId);
        const billingPlan = isBillingPlan(settings.billingPlan) ? settings.billingPlan : "ota_only";
        const defaultPlatformFee =
          billingPlan === "enterprise" ? 100 : billingPlan === "standard" ? 200 : 300;
        const feeMode = isFeeMode(settings.feeMode) ? settings.feeMode : "absorb";
        setFeeConfig({
          perBookingFeeCents: settings.perBookingFeeCents ?? defaultPlatformFee,
          billingPlan,
          feeMode,
        });
      } catch (err) {
        console.error("Failed to fetch fee config:", err);
      }
    };
    fetchFeeConfig();
  }, [reservation.campgroundId]);

  // Calculate credit card processing fee estimate
  const estimatedCCFeePercent = feeConfig?.feePercentBasisPoints
    ? feeConfig.feePercentBasisPoints / 100
    : 2.9;
  const estimatedCCFeeFlatCents = feeConfig?.feeFlatCents ?? 30;
  const estimatedCCFeeCents = Math.round(
    (totalCents * estimatedCCFeePercent) / 100 + estimatedCCFeeFlatCents,
  );

  // Platform fee info
  // Default based on billing plan: Enterprise=$1, Standard=$2, OTA=$3
  const billingPlan = feeConfig?.billingPlan ?? "ota_only";
  const defaultPlatformFee =
    billingPlan === "enterprise" ? 100 : billingPlan === "standard" ? 200 : 300;
  const platformFeeCents = feeConfig?.perBookingFeeCents ?? defaultPlatformFee;
  const ccFeeMode = feeConfig?.feeMode ?? "absorb";
  const billingPlanLabel =
    billingPlan === "enterprise" ? "Enterprise" : billingPlan === "standard" ? "Standard" : "OTA";

  // Get rule type icon
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

  // Get rule type label
  const getRuleTypeLabel = (type: string) => {
    switch (type) {
      case "seasonal":
        return "Seasonal";
      case "dow":
        return "Day of Week";
      case "demand":
        return "Dynamic/Demand";
      case "length_of_stay":
        return "Length of Stay";
      case "override":
        return "Rate Override";
      default:
        return type;
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="w-5 h-5 text-muted-foreground" />
            Financial Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-lg border border-border space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Total Amount</span>
              <span className="font-semibold text-foreground">{formatCurrency(totalCents)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Paid to Date</span>
              <span className="font-medium text-status-success">{formatCurrency(paidCents)}</span>
            </div>
            <div className="pt-3 border-t border-border flex justify-between items-center">
              <span className="font-medium text-foreground">Balance Due</span>
              <span
                className={`text-lg font-bold ${isPaid ? "text-muted-foreground" : "text-status-error"}`}
              >
                {formatCurrency(balanceCents)}
              </span>
            </div>
            {!isPaid && (
              <Button className="w-full mt-2" onClick={() => setIsPaymentModalOpen(true)}>
                <CreditCard className="w-4 h-4 mr-2" />
                Pay Balance
              </Button>
            )}
          </div>

          {/* Detailed Pricing Breakdown */}
          <Collapsible open={isBreakdownOpen} onOpenChange={setIsBreakdownOpen}>
            <CollapsibleTrigger asChild>
              <button className="flex items-center justify-between w-full py-2 text-sm font-medium text-foreground hover:text-foreground transition-colors">
                <span className="flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Pricing Breakdown
                </span>
                {isBreakdownOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-3 pt-2 pb-3 border-t border-border">
                {/* Base Rate */}
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Base Lodging ({quote?.nights ?? "?"} nights)
                    </span>
                    <span className="text-foreground">
                      {formatCurrency(quote?.baseSubtotalCents ?? baseCents)}
                    </span>
                  </div>
                  {quote?.perNightCents && (
                    <div className="flex justify-between text-xs text-muted-foreground pl-4">
                      <span>Average per night</span>
                      <span>{formatCurrency(quote.perNightCents)}/night</span>
                    </div>
                  )}
                </div>

                {/* Applied Pricing Rules */}
                {quote?.appliedRules && quote.appliedRules.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Pricing Rules Applied
                    </div>
                    {quote.appliedRules.map((rule, idx) => (
                      <div key={rule.id + idx} className="flex justify-between text-sm pl-2">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          {getRuleIcon(rule.type)}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help">{rule.name}</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">
                                  {getRuleTypeLabel(rule.type)} pricing rule
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </span>
                        <span
                          className={
                            rule.adjustmentCents >= 0
                              ? "text-status-warning"
                              : "text-status-success"
                          }
                        >
                          {rule.adjustmentCents >= 0 ? "+" : ""}
                          {formatCurrency(rule.adjustmentCents)}
                        </span>
                      </div>
                    ))}
                    {quote.rulesDeltaCents !== 0 && (
                      <div className="flex justify-between text-xs text-muted-foreground pl-4 pt-1 border-t border-border">
                        <span>Net pricing adjustment</span>
                        <span
                          className={
                            quote.rulesDeltaCents >= 0
                              ? "text-status-warning"
                              : "text-status-success"
                          }
                        >
                          {quote.rulesDeltaCents >= 0 ? "+" : ""}
                          {formatCurrency(quote.rulesDeltaCents)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Dynamic Pricing Indicator */}
                {quote?.rulesDeltaCents !== undefined &&
                  quote.rulesDeltaCents !== 0 &&
                  !quote.appliedRules?.length && (
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <TrendingUp className="w-3 h-3" />
                        Dynamic Pricing Adjustment
                      </span>
                      <span
                        className={
                          quote.rulesDeltaCents >= 0 ? "text-status-warning" : "text-status-success"
                        }
                      >
                        {quote.rulesDeltaCents >= 0 ? "+" : ""}
                        {formatCurrency(quote.rulesDeltaCents)}
                      </span>
                    </div>
                  )}

                {/* Early Check-in / Late Checkout */}
                {earlyCheckInCharge > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      Early Check-in Charge
                    </span>
                    <span className="text-foreground">+{formatCurrency(earlyCheckInCharge)}</span>
                  </div>
                )}
                {lateCheckoutCharge > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      Late Checkout Charge
                    </span>
                    <span className="text-foreground">+{formatCurrency(lateCheckoutCharge)}</span>
                  </div>
                )}

                {/* Subtotal before fees */}
                <div className="flex justify-between text-sm pt-2 border-t border-border">
                  <span className="text-muted-foreground">Subtotal (before fees/taxes)</span>
                  <span className="text-foreground">
                    {formatCurrency(quote?.totalCents ?? baseCents)}
                  </span>
                </div>

                {/* Fees Section - Platform Fee + CC Processing Fee */}
                {(feesCents > 0 || platformFeeCents > 0) && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Fees & Processing
                    </div>

                    {/* Platform Fee (goes to Campreserv) */}
                    {platformFeeCents > 0 && (
                      <div className="flex justify-between text-sm pl-2">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Building2 className="w-3 h-3" />
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help">Platform Fee</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">Per-booking fee ({billingPlanLabel} plan)</p>
                                <p className="text-xs text-muted-foreground">Goes to Campreserv</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </span>
                        <span className="text-foreground">{formatCurrency(platformFeeCents)}</span>
                      </div>
                    )}

                    {/* CC Processing Fee (goes to Stripe) */}
                    <div className="flex justify-between text-sm pl-2">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <CreditCard className="w-3 h-3" />
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help">CC Processing</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">
                                {estimatedCCFeePercent}% + $
                                {(estimatedCCFeeFlatCents / 100).toFixed(2)} per transaction
                              </p>
                              <p className="text-xs text-muted-foreground">Goes to Stripe</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </span>
                      <span className="flex items-center gap-1">
                        <span
                          className={
                            ccFeeMode === "absorb"
                              ? "line-through text-muted-foreground"
                              : "text-foreground"
                          }
                        >
                          ~{formatCurrency(estimatedCCFeeCents)}
                        </span>
                        {ccFeeMode === "absorb" && (
                          <span className="text-status-success text-xs">(absorbed)</span>
                        )}
                      </span>
                    </div>

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
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Taxes</span>
                    <span className="text-foreground">+{formatCurrency(taxCents)}</span>
                  </div>
                )}

                {/* Discounts */}
                {discountsCents > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2 text-status-success">
                        <Tag className="w-3 h-3" />
                        Discounts Applied
                      </span>
                      <span className="text-status-success">-{formatCurrency(discountsCents)}</span>
                    </div>
                    {reservation.promoCode && (
                      <div className="text-xs text-muted-foreground pl-4">
                        Promo code: {reservation.promoCode}
                      </div>
                    )}
                  </div>
                )}

                {/* Pricing Rule Version */}
                {(quote?.pricingRuleVersion || reservation.pricingRuleVersion) && (
                  <div className="text-xs text-muted-foreground pt-2">
                    Pricing version: {quote?.pricingRuleVersion || reservation.pricingRuleVersion}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      <PaymentCollectionModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        campgroundId={reservation.campgroundId}
        amountDueCents={balanceCents}
        subject={{ type: "balance", reservationId: reservation.id }}
        context="staff_checkin"
        guestId={guestId}
        guestEmail={guestEmail}
        guestName={guestName}
        enableSplitTender={true}
        enableCharityRoundUp={true}
        onSuccess={() => {
          setIsPaymentModalOpen(false);
          window.location.reload();
        }}
      />
    </>
  );
}
