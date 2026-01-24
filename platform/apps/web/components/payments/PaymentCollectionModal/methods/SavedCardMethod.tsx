"use client";

import React, { useState } from "react";
import { Button } from "../../../ui/button";
import { RadioGroup, RadioGroupItem } from "../../../ui/radio-group";
import { Label } from "../../../ui/label";
import { Loader2, AlertCircle, CreditCard, Check } from "lucide-react";
import { usePaymentContext } from "../context/PaymentContext";
import { useSavedCards, formatCardBrand } from "../hooks/useSavedCards";
import { cn } from "../../../../lib/utils";

interface SavedCardMethodProps {
  onSuccess?: (paymentId: string) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
}

// Card brand icons (simplified SVG components)
function VisaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="4" fill="#1A1F71" />
      <path
        d="M13.2 20.5l1.3-8h2l-1.3 8h-2zm8.8-8l-2 5.5-.3-1.3-.8-4c-.1-.4-.4-.5-.9-.5h-3.1l-.1.3c.8.2 1.5.5 2 .8l1.7 6.2h2.1l3.2-8h-1.8v.3zm-5.4 8h1.9l1.1-8h-2l-1 8z"
        fill="white"
      />
    </svg>
  );
}

function MastercardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="4" fill="#000" />
      <circle cx="12" cy="16" r="7" fill="#EB001B" />
      <circle cx="20" cy="16" r="7" fill="#F79E1B" />
      <path d="M16 10.8a7 7 0 0 0 0 10.4 7 7 0 0 0 0-10.4z" fill="#FF5F00" />
    </svg>
  );
}

function AmexIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="4" fill="#006FCF" />
      <text
        x="16"
        y="18"
        textAnchor="middle"
        fill="white"
        fontSize="8"
        fontWeight="bold"
        fontFamily="Arial"
      >
        AMEX
      </text>
    </svg>
  );
}

function getCardIcon(brand: string | null) {
  const brandLower = brand?.toLowerCase() || "";
  switch (brandLower) {
    case "visa":
      return VisaIcon;
    case "mastercard":
      return MastercardIcon;
    case "amex":
      return AmexIcon;
    default:
      return null;
  }
}

export function SavedCardMethod({ onSuccess, onError, onCancel }: SavedCardMethodProps) {
  const { state, actions, props } = usePaymentContext();
  const { cards, selectedCard, loading, error, selectCard, chargeCard } = useSavedCards();
  const [processing, setProcessing] = useState(false);

  const handleCancel = () => {
    actions.selectMethod(null);
    onCancel?.();
  };

  const handleCharge = async () => {
    if (!selectedCard) {
      onError?.("Please select a card");
      return;
    }

    setProcessing(true);
    try {
      const result = await chargeCard();
      if (result) {
        actions.addTenderEntry({
          method: "saved_card",
          amountCents: state.remainingCents,
          reference: result.paymentId,
          metadata: {
            cardId: selectedCard.id,
            last4: selectedCard.last4,
            brand: selectedCard.brand,
          },
        });
        onSuccess?.(result.paymentId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to charge card";
      onError?.(message);
    } finally {
      setProcessing(false);
    }
  };

  // No saved cards
  if (!loading && cards.length === 0) {
    return (
      <div className="py-8 text-center space-y-4">
        <CreditCard className="h-12 w-12 mx-auto text-muted-foreground" />
        <p className="text-muted-foreground">No saved cards found</p>
        <p className="text-sm text-muted-foreground">
          You can save a card during your next card payment
        </p>
        <Button variant="outline" onClick={handleCancel}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Card selection */}
      <RadioGroup value={selectedCard?.id || ""} onValueChange={selectCard} className="space-y-3">
        {cards.map((card) => {
          const CardIcon = getCardIcon(card.brand);
          const isSelected = selectedCard?.id === card.id;

          return (
            <div
              key={card.id}
              className={cn(
                "flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all",
                isSelected
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-border hover:border-border",
              )}
              onClick={() => selectCard(card.id)}
            >
              <RadioGroupItem value={card.id} id={card.id} className="sr-only" />

              {/* Card icon */}
              <div className="flex-shrink-0">
                {CardIcon ? (
                  <CardIcon className="h-8 w-12" />
                ) : (
                  <div className="h-8 w-12 bg-muted rounded flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Card details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {formatCardBrand(card.brand)} •••• {card.last4}
                  </span>
                  {card.isDefault && (
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                      Default
                    </span>
                  )}
                </div>
                {card.nickname && (
                  <span className="text-sm text-muted-foreground">{card.nickname}</span>
                )}
              </div>

              {/* Selected indicator */}
              {isSelected && (
                <div className="flex-shrink-0">
                  <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </RadioGroup>

      {/* Action buttons */}
      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleCancel}
          disabled={processing || loading}
        >
          Cancel
        </Button>
        <Button
          onClick={handleCharge}
          disabled={!selectedCard || processing || loading}
          className="min-w-[120px]"
        >
          {processing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            `Pay $${(state.remainingCents / 100).toFixed(2)}`
          )}
        </Button>
      </div>
    </div>
  );
}

export default SavedCardMethod;
