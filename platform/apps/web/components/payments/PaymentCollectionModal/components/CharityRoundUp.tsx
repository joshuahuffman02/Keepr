"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Checkbox } from "../../../ui/checkbox";
import { Label } from "../../../ui/label";
import { Heart } from "lucide-react";
import { usePaymentContext } from "../context/PaymentContext";
import { cn } from "../../../../lib/utils";
import { apiClient } from "../../../../lib/api-client";

// Payment methods that incur CC processing fees
const CARD_PAYMENT_METHODS = ["card", "saved_card", "apple_pay", "google_pay", "terminal"];

interface CharityRoundUpProps {
  disabled?: boolean;
}

export function CharityRoundUp({ disabled = false }: CharityRoundUpProps) {
  const { state, actions, props } = usePaymentContext();
  const { charityDonation, discountCents, donationCents, selectedMethod, config } = state;
  const [reservationTotal, setReservationTotal] = useState<number | null>(null);

  // Get reservationId from subject
  const reservationId = props.subject.type === "reservation"
    ? props.subject.reservationId
    : props.subject.type === "balance"
      ? props.subject.reservationId
      : null;

  // Fetch reservation total to ensure we're rounding up the correct amount
  useEffect(() => {
    if (!reservationId) return;

    apiClient.getReservation(reservationId)
      .then((res) => {
        setReservationTotal(res.totalAmount ?? 0);
      })
      .catch(() => {
        // Fall back to state if fetch fails
        setReservationTotal(null);
      });
  }, [reservationId]);

  // Calculate round-up amount based on actual payment total (including CC fees when applicable)
  const roundUpAmount = useMemo(() => {
    // Use the fetched reservation total, or fall back to state calculation
    let baseTotal = reservationTotal !== null
      ? reservationTotal - discountCents  // Reservation total minus any promo discounts applied in modal
      : state.originalAmountCents - discountCents;

    // If a card payment method is selected (or likely to be selected), include CC processing fees
    // This ensures the round-up creates a nice round number after fees are added
    if (selectedMethod && CARD_PAYMENT_METHODS.includes(selectedMethod) && config?.feeMode === "pass_through") {
      const ccFeeCents = actions.calculateFees(selectedMethod, baseTotal);
      baseTotal += ccFeeCents;
    }

    const dollars = baseTotal / 100;
    const roundedUp = Math.ceil(dollars);
    const roundUpCents = Math.round((roundedUp - dollars) * 100);

    // If already a round number, round up to next dollar
    return roundUpCents === 0 ? 100 : roundUpCents;
  }, [reservationTotal, state.originalAmountCents, discountCents, selectedMethod, config, actions]);

  const handleToggle = (checked: boolean) => {
    actions.setCharityDonation({
      optedIn: checked,
      amountCents: roundUpAmount,
      charityId: charityDonation.charityId || "default-charity",
      charityName: charityDonation.charityName || "Local Community Fund",
    });
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border transition-colors",
        charityDonation.optedIn
          ? "border-pink-300 bg-pink-50"
          : "border-border bg-muted hover:border-border"
      )}
    >
      <Checkbox
        id="charity-roundup"
        checked={charityDonation.optedIn}
        onCheckedChange={handleToggle}
        disabled={disabled}
        className={cn(
          charityDonation.optedIn && "border-pink-500 data-[state=checked]:bg-pink-500"
        )}
      />
      <div className="flex-1 min-w-0">
        <Label
          htmlFor="charity-roundup"
          className={cn(
            "text-sm cursor-pointer flex items-center gap-2",
            charityDonation.optedIn ? "text-pink-700" : "text-foreground"
          )}
        >
          <Heart
            className={cn(
              "h-4 w-4",
              charityDonation.optedIn ? "fill-pink-500 text-pink-500" : "text-muted-foreground"
            )}
          />
          Round up ${(roundUpAmount / 100).toFixed(2)} for{" "}
          {charityDonation.charityName || "charity"}
        </Label>
      </div>
    </div>
  );
}

/**
 * Inline charity round-up for compact display
 */
export function CharityRoundUpInline({ disabled = false }: CharityRoundUpProps) {
  const { state, actions, props } = usePaymentContext();
  const { charityDonation, discountCents, selectedMethod, config } = state;
  const [reservationTotal, setReservationTotal] = useState<number | null>(null);

  // Get reservationId from subject
  const reservationId = props.subject.type === "reservation"
    ? props.subject.reservationId
    : props.subject.type === "balance"
      ? props.subject.reservationId
      : null;

  // Fetch reservation total
  useEffect(() => {
    if (!reservationId) return;

    apiClient.getReservation(reservationId)
      .then((res) => {
        setReservationTotal(res.totalAmount ?? 0);
      })
      .catch(() => setReservationTotal(null));
  }, [reservationId]);

  const roundUpAmount = useMemo(() => {
    let baseTotal = reservationTotal !== null
      ? reservationTotal - discountCents
      : state.originalAmountCents - discountCents;

    // Include CC fees when card payment method is selected
    if (selectedMethod && CARD_PAYMENT_METHODS.includes(selectedMethod) && config?.feeMode === "pass_through") {
      const ccFeeCents = actions.calculateFees(selectedMethod, baseTotal);
      baseTotal += ccFeeCents;
    }

    const dollars = baseTotal / 100;
    const roundedUp = Math.ceil(dollars);
    const roundUpCents = Math.round((roundedUp - dollars) * 100);
    return roundUpCents === 0 ? 100 : roundUpCents;
  }, [reservationTotal, state.originalAmountCents, discountCents, selectedMethod, config, actions]);

  const handleToggle = () => {
    actions.setCharityDonation({
      optedIn: !charityDonation.optedIn,
      amountCents: roundUpAmount,
      charityId: charityDonation.charityId || "default-charity",
    });
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={disabled}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-full text-sm transition-colors",
        charityDonation.optedIn
          ? "bg-pink-100 text-pink-700 hover:bg-pink-200"
          : "bg-muted text-muted-foreground hover:bg-muted",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <Heart
        className={cn(
          "h-4 w-4",
          charityDonation.optedIn && "fill-pink-500"
        )}
      />
      <span>
        {charityDonation.optedIn ? "Donating" : "Add"} ${(roundUpAmount / 100).toFixed(2)}
      </span>
    </button>
  );
}
