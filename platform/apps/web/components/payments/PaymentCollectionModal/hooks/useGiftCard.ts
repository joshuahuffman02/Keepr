"use client";

import { useState, useCallback } from "react";
import { usePaymentContext } from "../context/PaymentContext";

interface GiftCardInfo {
  code: string;
  balanceCents: number;
  expiresAt?: string;
  isActive: boolean;
}

interface UseGiftCardResult {
  giftCard: GiftCardInfo | null;
  loading: boolean;
  error: string | null;
  lookupGiftCard: (code: string) => Promise<GiftCardInfo | null>;
  redeemGiftCard: (code: string, amountCents: number) => Promise<RedeemResult | null>;
  clearGiftCard: () => void;
}

interface RedeemResult {
  success: boolean;
  transactionId: string;
  amountRedeemedCents: number;
  remainingBalanceCents: number;
}

/**
 * Hook for gift card lookup and redemption.
 * Note: Gift card API endpoints are not yet implemented.
 * This is a stub that returns "not implemented" errors.
 */
export function useGiftCard(): UseGiftCardResult {
  const { props } = usePaymentContext();

  const [giftCard, setGiftCard] = useState<GiftCardInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookupGiftCard = useCallback(
    async (code: string): Promise<GiftCardInfo | null> => {
      if (!code.trim()) {
        setError("Please enter a gift card code");
        return null;
      }

      setLoading(true);
      setError(null);

      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Gift card API not yet implemented - return gracefully without error
      setLoading(false);
      return null;
    },
    [props.campgroundId]
  );

  const redeemGiftCard = useCallback(
    async (_code: string, _amountCents: number): Promise<RedeemResult | null> => {
      if (!giftCard) {
        setError("Please look up a gift card first");
        return null;
      }

      setLoading(true);
      setError(null);

      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      // TODO: Implement when gift card API is available
      setError("Gift card payments are not yet available");
      setLoading(false);
      return null;
    },
    [props.campgroundId, props.subject, giftCard]
  );

  const clearGiftCard = useCallback(() => {
    setGiftCard(null);
    setError(null);
  }, []);

  return {
    giftCard,
    loading,
    error,
    lookupGiftCard,
    redeemGiftCard,
    clearGiftCard,
  };
}

/**
 * Format gift card code for display (e.g., XXXX-XXXX-XXXX)
 */
export function formatGiftCardCode(code: string): string {
  const cleaned = code.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const chunks = cleaned.match(/.{1,4}/g) || [];
  return chunks.join("-");
}
