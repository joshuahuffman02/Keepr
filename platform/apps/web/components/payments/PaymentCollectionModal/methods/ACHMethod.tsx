"use client";

import React, { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "../../../ui/button";
import { Loader2, AlertCircle, Landmark, Info } from "lucide-react";
import { usePaymentContext } from "../context/PaymentContext";
import { usePaymentIntent } from "../hooks/usePaymentIntent";
import { cn } from "../../../../lib/utils";

// Initialize Stripe
const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

interface ACHMethodProps {
  onSuccess?: (paymentId: string) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
}

// Inner form component
function ACHPaymentForm({
  amountCents,
  onSuccess,
  onError,
  onCancel,
}: {
  amountCents: number;
  onSuccess?: (paymentId: string) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { actions } = usePaymentContext();

  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      setError("Payment system not ready");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Submit the PaymentElement
      const { error: submitError } = await elements.submit();
      if (submitError) {
        throw new Error(submitError.message || "Failed to submit bank details");
      }

      // Confirm the payment
      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: "if_required",
      });

      if (confirmError) {
        throw new Error(confirmError.message || "Payment failed");
      }

      // ACH payments are typically pending until the bank transfer completes
      if (paymentIntent) {
        actions.addTenderEntry({
          method: "ach",
          amountCents,
          reference: paymentIntent.id,
          metadata: {
            status: paymentIntent.status,
            note: "Bank transfer initiated - may take 1-3 business days to complete",
          },
        });

        onSuccess?.(paymentIntent.id);
      }
    } catch (err: any) {
      const message = err.message || "Payment failed";
      setError(message);
      onError?.(message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">Bank Transfer (ACH)</p>
          <p className="mt-1 text-blue-700">
            ACH transfers typically take 1-3 business days to complete. You&apos;ll receive
            confirmation once the transfer is processed.
          </p>
        </div>
      </div>

      {/* Stripe PaymentElement configured for ACH */}
      <div className="border border-border rounded-lg p-4 bg-card">
        <PaymentElement
          options={{
            layout: "tabs",
            paymentMethodOrder: ["us_bank_account"],
            fields: {
              billingDetails: {
                name: "auto",
                email: "auto",
              },
            },
          }}
        />
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={processing}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!stripe || processing}
          className="min-w-[140px]"
        >
          {processing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Landmark className="h-4 w-4 mr-2" />
              Pay ${(amountCents / 100).toFixed(2)}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

// Main ACHMethod component
export function ACHMethod({ onSuccess, onError, onCancel }: ACHMethodProps) {
  const { state, actions } = usePaymentContext();
  const { clientSecret, loading, error, createIntent, resetIntent } = usePaymentIntent({
    autoCreate: true,
  });

  const handleCancel = () => {
    resetIntent();
    actions.selectMethod(null);
    onCancel?.();
  };

  // Stripe not configured
  if (!stripePromise) {
    return (
      <div className="py-8 text-center space-y-4">
        <AlertCircle className="h-8 w-8 mx-auto text-red-500" />
        <p className="text-muted-foreground">Payment system is not configured</p>
        <Button variant="outline" onClick={handleCancel}>
          Go Back
        </Button>
      </div>
    );
  }

  // Loading payment intent
  if (loading) {
    return (
      <div className="py-12 text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-600" />
        <p className="text-muted-foreground">Initializing bank transfer...</p>
      </div>
    );
  }

  // Error creating payment intent
  if (error && !clientSecret) {
    return (
      <div className="py-8 text-center space-y-4">
        <AlertCircle className="h-8 w-8 mx-auto text-red-500" />
        <p className="text-muted-foreground">{error}</p>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={handleCancel}>
            Go Back
          </Button>
          <Button onClick={() => createIntent()}>Try Again</Button>
        </div>
      </div>
    );
  }

  // Ready to collect bank details
  if (clientSecret) {
    return (
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret,
          appearance: {
            theme: "stripe",
            variables: {
              colorPrimary: "#059669",
              colorBackground: "#ffffff",
              colorText: "#1e293b",
              colorDanger: "#dc2626",
              borderRadius: "8px",
              fontFamily: "system-ui, sans-serif",
            },
          },
        }}
      >
        <ACHPaymentForm
          amountCents={state.remainingCents}
          onSuccess={onSuccess}
          onError={onError}
          onCancel={handleCancel}
        />
      </Elements>
    );
  }

  return null;
}

export default ACHMethod;
