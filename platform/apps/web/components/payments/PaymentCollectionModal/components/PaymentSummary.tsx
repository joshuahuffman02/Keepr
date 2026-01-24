"use client";

import React from "react";
import { X } from "lucide-react";
import { usePaymentContext } from "../context/PaymentContext";
import { cn } from "../../../../lib/utils";

interface PaymentSummaryProps {
  showDiscounts?: boolean;
  showDonation?: boolean;
  showFees?: boolean;
  compact?: boolean;
}

export function PaymentSummary({
  showDiscounts = true,
  showDonation = true,
  showFees = true,
  compact = false,
}: PaymentSummaryProps) {
  const { state, actions } = usePaymentContext();
  const {
    originalAmountCents,
    discountCents,
    donationCents,
    feeCents,
    totalDueCents,
    paidCents,
    remainingCents,
    appliedDiscounts,
    charityDonation,
    config,
  } = state;

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  if (compact) {
    return (
      <div className="flex justify-between items-center py-2 border-t border-border">
        <span className="text-sm text-muted-foreground">Total Due</span>
        <span className="text-lg font-semibold text-foreground">
          {formatCurrency(remainingCents > 0 ? remainingCents : totalDueCents)}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2 py-3 border-t border-border">
      {/* Subtotal */}
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Subtotal</span>
        <span className="text-foreground">{formatCurrency(originalAmountCents)}</span>
      </div>

      {/* Applied discounts */}
      {showDiscounts && appliedDiscounts.length > 0 && (
        <>
          {appliedDiscounts.map((discount) => (
            <div
              key={discount.promoCodeId || discount.code}
              className="flex justify-between text-sm"
            >
              <span className="text-emerald-600 flex items-center gap-1">
                {discount.code || discount.description}
                <button
                  onClick={() =>
                    discount.promoCodeId && actions.removeDiscount(discount.promoCodeId)
                  }
                  className="p-0.5 hover:bg-muted rounded"
                  aria-label="Remove discount"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
              <span className="text-emerald-600">-{formatCurrency(discount.discountCents)}</span>
            </div>
          ))}
        </>
      )}

      {/* Charity donation */}
      {showDonation && charityDonation.optedIn && charityDonation.amountCents > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-pink-600">
            Donation{charityDonation.charityName ? ` (${charityDonation.charityName})` : ""}
          </span>
          <span className="text-pink-600">+{formatCurrency(charityDonation.amountCents)}</span>
        </div>
      )}

      {/* Processing fee (pass-through mode) */}
      {showFees &&
        config?.feeMode === "pass_through" &&
        config.showFeeBreakdown &&
        feeCents > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Processing Fee</span>
            <span className="text-muted-foreground">+{formatCurrency(feeCents)}</span>
          </div>
        )}

      {/* Divider */}
      <div className="border-t border-border my-2" />

      {/* Total */}
      <div className="flex justify-between">
        <span className="font-medium text-foreground">Total</span>
        <span className="font-semibold text-lg text-foreground">
          {formatCurrency(totalDueCents)}
        </span>
      </div>

      {/* Paid amount (for split tender) */}
      {paidCents > 0 && (
        <>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Paid</span>
            <span className="text-green-600">-{formatCurrency(paidCents)}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium text-foreground">Remaining</span>
            <span
              className={cn(
                "font-semibold text-lg",
                remainingCents > 0 ? "text-amber-600" : "text-green-600",
              )}
            >
              {formatCurrency(remainingCents)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Inline summary for showing in headers
 */
export function PaymentSummaryInline() {
  const { state } = usePaymentContext();
  const { totalDueCents, remainingCents, paidCents } = state;

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  if (paidCents > 0) {
    return (
      <span className="text-sm">
        <span className="text-muted-foreground">Remaining: </span>
        <span className="font-medium text-amber-600">{formatCurrency(remainingCents)}</span>
        <span className="text-muted-foreground mx-1">/</span>
        <span className="text-muted-foreground">{formatCurrency(totalDueCents)}</span>
      </span>
    );
  }

  return (
    <span className="text-sm">
      <span className="text-muted-foreground">Amount Due: </span>
      <span className="font-medium text-foreground">{formatCurrency(totalDueCents)}</span>
    </span>
  );
}
