"use client";

import { useState, useCallback, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { usePaymentContext } from "../context/PaymentContext";
import { SavedCard } from "../context/types";

interface UseSavedCardsResult {
  cards: SavedCard[];
  selectedCard: SavedCard | null;
  loading: boolean;
  error: string | null;
  selectCard: (cardId: string) => void;
  chargeCard: (amountCents?: number) => Promise<ChargeResult | null>;
  refreshCards: () => Promise<void>;
}

interface ChargeResult {
  success: boolean;
  paymentId: string;
  paymentIntentId: string;
  status: string;
}

export function useSavedCards(): UseSavedCardsResult {
  const { state, props } = usePaymentContext();
  const { savedCards } = state;

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-select default card when cards are loaded
  useEffect(() => {
    if (savedCards.length > 0 && !selectedCardId) {
      const defaultCard = savedCards.find((c) => c.isDefault);
      if (defaultCard) {
        setSelectedCardId(defaultCard.id);
      } else {
        setSelectedCardId(savedCards[0].id);
      }
    }
  }, [savedCards, selectedCardId]);

  const selectedCard = savedCards.find((c) => c.id === selectedCardId) || null;

  const selectCard = useCallback((cardId: string) => {
    setSelectedCardId(cardId);
    setError(null);
  }, []);

  const chargeCard = useCallback(
    async (amountCents?: number): Promise<ChargeResult | null> => {
      if (!selectedCard) {
        setError("Please select a card");
        return null;
      }

      if (!props.guestId) {
        setError("Guest ID is required for saved card payments");
        return null;
      }

      const amount = amountCents ?? state.remainingCents;
      if (amount <= 0) {
        setError("Invalid payment amount");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const reservationId =
          props.subject.type === "reservation" || props.subject.type === "balance"
            ? props.subject.reservationId
            : undefined;

        const result = await apiClient.chargeSavedCard(props.campgroundId, {
          guestId: props.guestId,
          paymentMethodId: selectedCard.id,
          amountCents: amount,
          currency: "usd",
          reservationId,
          description: `Payment for ${props.subject.type}`,
          metadata: {
            context: props.context,
            source: "payment_collection_modal",
          },
        });

        if (!result.success) {
          throw new Error("Failed to charge saved card");
        }

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to charge saved card";
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [
      selectedCard,
      props.guestId,
      props.campgroundId,
      props.subject,
      props.context,
      state.remainingCents,
    ],
  );

  const refreshCards = useCallback(async () => {
    if (!props.guestId) return;

    setLoading(true);
    setError(null);

    try {
      const cards = await apiClient.getChargeablePaymentMethods(props.campgroundId, props.guestId);
      // Cards are updated via context, this just triggers a refresh
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load saved cards";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [props.guestId, props.campgroundId]);

  return {
    cards: savedCards,
    selectedCard,
    loading,
    error,
    selectCard,
    chargeCard,
    refreshCards,
  };
}

/**
 * Format card brand for display
 */
export function formatCardBrand(brand: string | null): string {
  if (!brand) return "Card";

  const brandMap: Record<string, string> = {
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "American Express",
    discover: "Discover",
    diners: "Diners Club",
    jcb: "JCB",
    unionpay: "UnionPay",
  };

  return brandMap[brand.toLowerCase()] || brand;
}

/**
 * Get card brand icon name
 */
export function getCardBrandIcon(brand: string | null): string {
  if (!brand) return "credit-card";

  const iconMap: Record<string, string> = {
    visa: "visa",
    mastercard: "mastercard",
    amex: "amex",
    discover: "discover",
  };

  return iconMap[brand.toLowerCase()] || "credit-card";
}
