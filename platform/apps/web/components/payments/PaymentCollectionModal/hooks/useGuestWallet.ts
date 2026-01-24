"use client";

import { useState, useCallback } from "react";
import { usePaymentContext } from "../context/PaymentContext";

interface UseGuestWalletResult {
  balanceCents: number;
  loading: boolean;
  error: string | null;
  debitWallet: (amountCents: number, description?: string) => Promise<DebitResult | null>;
  refreshBalance: () => Promise<void>;
}

interface DebitResult {
  success: boolean;
  transactionId: string;
  newBalanceCents: number;
}

/**
 * Hook for guest wallet balance and debit operations.
 * Note: Wallet debit API endpoint is not yet implemented.
 * Balance is fetched from getGuestWallet API.
 */
export function useGuestWallet(): UseGuestWalletResult {
  const { state, props } = usePaymentContext();
  const { walletBalanceCents } = state;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debitWallet = useCallback(
    async (amountCents: number, _description?: string): Promise<DebitResult | null> => {
      if (!props.guestId) {
        setError("Guest ID is required");
        return null;
      }

      if (amountCents > walletBalanceCents) {
        setError("Insufficient wallet balance");
        return null;
      }

      if (amountCents <= 0) {
        setError("Invalid amount");
        return null;
      }

      setLoading(true);
      setError(null);

      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      // TODO: Implement when wallet debit API is available
      // const result = await apiClient.debitGuestWallet(props.campgroundId, props.guestId, { ... });
      setError("Wallet payments are not yet available");
      setLoading(false);
      return null;
    },
    [props.guestId, props.campgroundId, props.subject, walletBalanceCents],
  );

  const refreshBalance = useCallback(async () => {
    if (!props.guestId) return;

    setLoading(true);
    setError(null);

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    // TODO: Implement proper refresh - for now just clear loading
    // Balance is managed by PaymentContext which uses getGuestWallet
    setLoading(false);
  }, [props.guestId, props.campgroundId]);

  return {
    balanceCents: walletBalanceCents,
    loading,
    error,
    debitWallet,
    refreshBalance,
  };
}

/**
 * Format wallet balance for display
 */
export function formatWalletBalance(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
