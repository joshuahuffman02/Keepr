"use client";

import React from "react";
import { Info } from "lucide-react";
import { usePaymentContext } from "../context/PaymentContext";
import { PaymentMethodType } from "../context/types";
import { cn } from "../../../../lib/utils";

interface FeeBreakdownProps {
  method?: PaymentMethodType;
  amountCents?: number;
  showTooltip?: boolean;
}

export function FeeBreakdown({
  method,
  amountCents,
  showTooltip = true,
}: FeeBreakdownProps) {
  const { state, actions } = usePaymentContext();
  const { config, selectedMethod, remainingCents } = state;

  const activeMethod = method || selectedMethod;
  const activeAmount = amountCents ?? remainingCents;

  if (!config || config.feeMode === "absorb") {
    return null;
  }

  const feeCents = activeMethod
    ? actions.calculateFees(activeMethod, activeAmount)
    : 0;

  if (feeCents <= 0) {
    return null;
  }

  const feePercentage = config.feePercentBasisPoints / 100;
  const flatFee = config.feeFlatCents / 100;

  return (
    <div className="p-3 bg-muted border border-border rounded-lg">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Processing Fee</p>
          <p className="text-xs text-muted-foreground">
            {feePercentage}% + ${flatFee.toFixed(2)} per transaction
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-foreground">
            +${(feeCents / 100).toFixed(2)}
          </p>
        </div>
      </div>

      {showTooltip && (
        <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span>
            This fee covers payment processing costs and is passed through to you.
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Compact fee display for inline use
 */
export function FeeBreakdownInline({
  method,
  amountCents,
}: Omit<FeeBreakdownProps, "showTooltip">) {
  const { state, actions } = usePaymentContext();
  const { config, selectedMethod, remainingCents } = state;

  const activeMethod = method || selectedMethod;
  const activeAmount = amountCents ?? remainingCents;

  if (!config || config.feeMode === "absorb") {
    return null;
  }

  const feeCents = activeMethod
    ? actions.calculateFees(activeMethod, activeAmount)
    : 0;

  if (feeCents <= 0) {
    return null;
  }

  return (
    <span className="text-sm text-muted-foreground">
      + ${(feeCents / 100).toFixed(2)} fee
    </span>
  );
}

/**
 * Fee estimation before method selection
 */
export function FeeEstimate() {
  const { state, actions } = usePaymentContext();
  const { config, remainingCents } = state;

  if (!config || config.feeMode === "absorb" || !config.showFeeBreakdown) {
    return null;
  }

  // Show fee for card payment as an estimate
  const estimatedFee = actions.calculateFees("card", remainingCents);

  if (estimatedFee <= 0) {
    return null;
  }

  return (
    <div className="text-center text-xs text-muted-foreground">
      Processing fees may apply for card payments (~${(estimatedFee / 100).toFixed(2)})
    </div>
  );
}
