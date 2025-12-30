"use client";

import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Tag, TrendingUp, Clock, Percent, Info, CreditCard } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../../ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../ui/tooltip";
import { usePaymentContext } from "../context/PaymentContext";
import { apiClient } from "../../../../lib/api-client";
import { Quote, Reservation } from "@campreserv/shared";

interface ReservationBreakdownProps {
  compact?: boolean;
}

export function ReservationBreakdown({ compact = false }: ReservationBreakdownProps) {
  const { props } = usePaymentContext();
  const [isOpen, setIsOpen] = useState(true);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  // Get reservationId from subject
  const reservationId = props.subject.type === "reservation"
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
          const arrivalDate = typeof res.arrivalDate === 'string'
            ? res.arrivalDate.split('T')[0]
            : new Date(res.arrivalDate).toISOString().split('T')[0];
          const departureDate = typeof res.departureDate === 'string'
            ? res.departureDate.split('T')[0]
            : new Date(res.departureDate).toISOString().split('T')[0];

          const quoteData = await apiClient.getQuote(res.campgroundId, {
            siteId: res.siteId,
            arrivalDate,
            departureDate
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
      case 'seasonal':
      case 'dow':
        return <Tag className="w-3 h-3" />;
      case 'demand':
        return <TrendingUp className="w-3 h-3" />;
      case 'length_of_stay':
        return <Clock className="w-3 h-3" />;
      default:
        return <Percent className="w-3 h-3" />;
    }
  };

  const getRuleTypeLabel = (type: string) => {
    switch (type) {
      case 'seasonal': return 'Seasonal Rate';
      case 'dow': return 'Day of Week';
      case 'demand': return 'Dynamic Pricing';
      case 'length_of_stay': return 'Length of Stay';
      case 'override': return 'Rate Override';
      default: return type;
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

  // CC fee estimate (2.9% + $0.30)
  const ccFeePercent = 2.9;
  const ccFeeFlatCents = 30;
  const estimatedCCFeeCents = Math.round((totalCents * ccFeePercent / 100) + ccFeeFlatCents);

  if (compact) {
    return (
      <div className="text-xs text-slate-500 space-y-1 py-2">
        <div className="flex justify-between">
          <span>Base ({quote?.nights ?? '?'} nights)</span>
          <span>{formatCurrency(quote?.baseSubtotalCents ?? baseCents)}</span>
        </div>
        {quote?.rulesDeltaCents !== undefined && quote.rulesDeltaCents !== 0 && (
          <div className="flex justify-between">
            <span>Pricing adjustments</span>
            <span className={quote.rulesDeltaCents >= 0 ? "text-amber-600" : "text-emerald-600"}>
              {quote.rulesDeltaCents >= 0 ? '+' : ''}{formatCurrency(quote.rulesDeltaCents)}
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
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center justify-between w-full py-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors border-b border-slate-100">
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
              <span className="text-slate-600">Base Lodging ({quote?.nights ?? '?'} nights)</span>
              <span className="text-slate-900">{formatCurrency(quote?.baseSubtotalCents ?? baseCents)}</span>
            </div>
            {quote?.perNightCents && (
              <div className="flex justify-between text-xs text-slate-400 pl-3">
                <span>Avg per night</span>
                <span>{formatCurrency(quote.perNightCents)}/night</span>
              </div>
            )}
          </div>

          {/* Applied Pricing Rules */}
          {quote?.appliedRules && quote.appliedRules.length > 0 && (
            <div className="space-y-1 pt-1">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Pricing Rules
              </div>
              {quote.appliedRules.map((rule, idx) => (
                <div key={rule.id + idx} className="flex justify-between pl-2">
                  <span className="flex items-center gap-1.5 text-slate-600">
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
                  <span className={`text-xs ${rule.adjustmentCents >= 0 ? "text-amber-600" : "text-emerald-600"}`}>
                    {rule.adjustmentCents >= 0 ? '+' : ''}{formatCurrency(rule.adjustmentCents)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Dynamic pricing (if no detailed rules) */}
          {quote?.rulesDeltaCents !== undefined && quote.rulesDeltaCents !== 0 && !quote.appliedRules?.length && (
            <div className="flex justify-between">
              <span className="flex items-center gap-1.5 text-slate-600">
                <TrendingUp className="w-3 h-3" />
                Dynamic Pricing
              </span>
              <span className={quote.rulesDeltaCents >= 0 ? "text-amber-600" : "text-emerald-600"}>
                {quote.rulesDeltaCents >= 0 ? '+' : ''}{formatCurrency(quote.rulesDeltaCents)}
              </span>
            </div>
          )}

          {/* Early check-in / Late checkout */}
          {earlyCheckInCharge > 0 && (
            <div className="flex justify-between">
              <span className="flex items-center gap-1.5 text-slate-600">
                <Clock className="w-3 h-3" />
                Early Check-in
              </span>
              <span className="text-slate-900">+{formatCurrency(earlyCheckInCharge)}</span>
            </div>
          )}
          {lateCheckoutCharge > 0 && (
            <div className="flex justify-between">
              <span className="flex items-center gap-1.5 text-slate-600">
                <Clock className="w-3 h-3" />
                Late Checkout
              </span>
              <span className="text-slate-900">+{formatCurrency(lateCheckoutCharge)}</span>
            </div>
          )}

          {/* Fees */}
          {feesCents > 0 && (
            <div className="flex justify-between pt-1 border-t border-slate-100">
              <span className="text-slate-600">Booking Fees</span>
              <span className="text-slate-900">+{formatCurrency(feesCents)}</span>
            </div>
          )}

          {/* Taxes */}
          {taxCents > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-600">Taxes</span>
              <span className="text-slate-900">+{formatCurrency(taxCents)}</span>
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

          {/* CC Fee Info */}
          <div className="pt-2 mt-1 border-t border-slate-200">
            <div className="flex justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <CreditCard className="w-3 h-3" />
                CC Fee ({ccFeePercent}% + ${(ccFeeFlatCents / 100).toFixed(2)})
              </span>
              <span>~{formatCurrency(estimatedCCFeeCents)}</span>
            </div>
          </div>

          {/* Total */}
          <div className="flex justify-between pt-2 border-t border-slate-200 font-medium">
            <span className="text-slate-900">Reservation Total</span>
            <span className="text-slate-900">{formatCurrency(totalCents)}</span>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
