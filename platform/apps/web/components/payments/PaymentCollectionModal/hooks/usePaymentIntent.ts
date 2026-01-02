"use client";

import { useState, useCallback, useEffect } from "react";
import { apiClient } from "../../../../lib/api-client";
import { usePaymentContext } from "../context/PaymentContext";

interface PaymentIntentData {
  id: string;
  clientSecret: string;
  amountCents: number;
  currency: string;
  status: string;
}

interface UsePaymentIntentOptions {
  autoCreate?: boolean;
  captureMethod?: "automatic" | "manual";
}

interface UsePaymentIntentResult {
  clientSecret: string | null;
  paymentIntentId: string | null;
  loading: boolean;
  error: string | null;
  createIntent: (amountCents?: number) => Promise<PaymentIntentData | null>;
  resetIntent: () => void;
}

export function usePaymentIntent(options: UsePaymentIntentOptions = {}): UsePaymentIntentResult {
  const { autoCreate = false, captureMethod = "automatic" } = options;
  const { state, props } = usePaymentContext();

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoCreateAttempted, setAutoCreateAttempted] = useState(false);

  const getReservationId = useCallback((): string | undefined => {
    if (props.subject.type === "reservation") return props.subject.reservationId;
    if (props.subject.type === "balance") return props.subject.reservationId;
    return undefined;
  }, [props.subject]);

  const createIntent = useCallback(
    async (amountCents?: number): Promise<PaymentIntentData | null> => {
      const amount = amountCents ?? state.remainingCents;
      if (amount <= 0) {
        setError("Invalid payment amount");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const reservationId = getReservationId();

        // Use public endpoint for public contexts, authenticated for staff
        let data: PaymentIntentData;

        if (props.context === "public_booking" || props.context === "portal") {
          // Public payment intent (no auth required)
          // Note: Server computes amount from reservation balance
          data = await apiClient.createPublicPaymentIntent({
            reservationId: reservationId || "",
            currency: "usd",
            guestEmail: props.guestEmail,
            captureMethod,
          });
        } else if (reservationId) {
          // Authenticated payment intent
          data = await apiClient.createPaymentIntent(
            amount,
            "usd",
            reservationId,
            captureMethod === "automatic"
          );
        } else {
          throw new Error("Missing reservation ID for payment");
        }

        setClientSecret(data.clientSecret);
        setPaymentIntentId(data.id);
        return data;
      } catch (err: any) {
        const message = err.message || "Failed to initialize payment";
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [state.remainingCents, getReservationId, props.context, props.guestEmail, captureMethod]
  );

  const resetIntent = useCallback(() => {
    setClientSecret(null);
    setPaymentIntentId(null);
    setError(null);
    setLoading(false);
    setAutoCreateAttempted(false);
  }, []);

  // Auto-create intent when hook mounts if requested
  // Only auto-create once - don't retry on error (user can click "Try Again")
  useEffect(() => {
    if (autoCreate && state.remainingCents > 0 && !clientSecret && !loading && !autoCreateAttempted) {
      setAutoCreateAttempted(true);
      createIntent();
    }
  }, [autoCreate, state.remainingCents, clientSecret, loading, autoCreateAttempted, createIntent]);

  return {
    clientSecret,
    paymentIntentId,
    loading,
    error,
    createIntent,
    resetIntent,
  };
}

/**
 * Hook for creating a deposit/auth hold payment intent
 */
export function useDepositHold() {
  const { state, props } = usePaymentContext();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hold, setHold] = useState<{
    paymentIntentId: string;
    clientSecret: string;
    expiresAt: string;
  } | null>(null);

  const createHold = useCallback(
    async (amountCents: number, reason?: string) => {
      setLoading(true);
      setError(null);

      try {
        const reservationId =
          props.subject.type === "reservation" || props.subject.type === "balance"
            ? props.subject.reservationId
            : undefined;

        if (!reservationId) {
          throw new Error("Deposit holds require a reservation");
        }

        // Create a manual capture payment intent (hold only)
        const data = await apiClient.createPaymentIntent(
          amountCents,
          "usd",
          reservationId,
          false // autoCapture = false for holds
        );

        setHold({
          paymentIntentId: data.id,
          clientSecret: data.clientSecret,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        });

        return data;
      } catch (err: any) {
        setError(err.message || "Failed to create deposit hold");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [props.subject]
  );

  const captureHold = useCallback(
    async (amountCents?: number) => {
      if (!hold) {
        setError("No active hold to capture");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        // This would call a capture endpoint
        // For now, return the hold info
        return hold;
      } catch (err: any) {
        setError(err.message || "Failed to capture hold");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [hold]
  );

  const releaseHold = useCallback(async () => {
    if (!hold) {
      setError("No active hold to release");
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      // This would call a cancel/release endpoint
      setHold(null);
      return true;
    } catch (err: any) {
      setError(err.message || "Failed to release hold");
      return false;
    } finally {
      setLoading(false);
    }
  }, [hold]);

  return {
    hold,
    loading,
    error,
    createHold,
    captureHold,
    releaseHold,
  };
}
