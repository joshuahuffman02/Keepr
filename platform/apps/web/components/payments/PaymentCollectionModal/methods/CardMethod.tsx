"use client";

import React, { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "../../../ui/button";
import { Label } from "../../../ui/label";
import { Checkbox } from "../../../ui/checkbox";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { usePaymentContext } from "../context/PaymentContext";
import { usePaymentIntent } from "../hooks/usePaymentIntent";

// Initialize Stripe - requires NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY env var
const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

interface CardMethodProps {
  onSuccess?: (paymentId: string) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
}

// Inner form component that uses Stripe hooks
function CardPaymentForm({
  amountCents,
  onSuccess,
  onError,
  onCancel,
  saveCard,
  onSaveCardChange,
  showSaveCard,
}: {
  amountCents: number;
  onSuccess?: (paymentId: string) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
  saveCard: boolean;
  onSaveCardChange: (checked: boolean) => void;
  showSaveCard: boolean;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { actions, props } = usePaymentContext();

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
        throw new Error(submitError.message || "Failed to submit payment details");
      }

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

      // Payment succeeded - webhook will record the payment in database
      // Do NOT record here to avoid double-charging
      if (paymentIntent) {
        // Add tender entry for split tender support (local state only)
        actions.addTenderEntry({
          method: "card",
          amountCents,
          reference: paymentIntent.id,
          metadata: { brand: "card" },
        });

        onSuccess?.(paymentIntent.id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payment failed";
      setError(message);
      onError?.(message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Stripe PaymentElement - includes its own billing ZIP field */}
      <div className="border border-border rounded-lg p-4 bg-card">
        <PaymentElement
          options={{
            layout: "tabs",
            paymentMethodOrder: ["card"],
          }}
        />
      </div>

      {/* Save card checkbox */}
      {showSaveCard && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="save-card"
            checked={saveCard}
            onCheckedChange={(checked) => onSaveCardChange(checked === true)}
          />
          <Label htmlFor="save-card" className="text-sm text-muted-foreground cursor-pointer">
            Save card for future payments
          </Label>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={processing}>
          Cancel
        </Button>
        <Button type="submit" disabled={!stripe || processing} className="min-w-[120px]">
          {processing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            `Pay $${(amountCents / 100).toFixed(2)}`
          )}
        </Button>
      </div>
    </form>
  );
}

// Main CardMethod component
export function CardMethod({ onSuccess, onError, onCancel }: CardMethodProps) {
  const { state, actions, props } = usePaymentContext();
  const { clientSecret, loading, error, createIntent, resetIntent } = usePaymentIntent({
    autoCreate: true,
  });

  const [saveCard, setSaveCard] = useState(false);
  const showSaveCard = props.enableSaveCard !== false && !!props.guestId;

  const handleCancel = () => {
    resetIntent();
    actions.selectMethod(null);
    onCancel?.();
  };

  const handleSuccess = (paymentId: string) => {
    onSuccess?.(paymentId);
    // The parent modal will handle transitioning to success state
  };

  // Stripe not configured
  if (!stripePromise) {
    return (
      <div className="py-8 text-center space-y-4">
        <div className="flex items-center justify-center gap-2 text-red-600">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm">Payment system is not configured</span>
        </div>
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
        <p className="text-muted-foreground">Initializing payment...</p>
      </div>
    );
  }

  // Error creating payment intent
  if (error && !clientSecret) {
    return (
      <div className="py-8 text-center space-y-4">
        <div className="flex items-center justify-center gap-2 text-red-600">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm">{error}</span>
        </div>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={handleCancel}>
            Go Back
          </Button>
          <Button onClick={() => createIntent()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Ready to collect payment
  if (clientSecret) {
    return (
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret,
          appearance: {
            theme: "stripe",
            variables: {
              colorPrimary: "#059669", // emerald-600
              colorBackground: "#ffffff",
              colorText: "#1e293b", // slate-800
              colorDanger: "#dc2626", // red-600
              borderRadius: "8px",
              fontFamily: "system-ui, sans-serif",
            },
          },
        }}
      >
        <CardPaymentForm
          amountCents={state.remainingCents}
          onSuccess={handleSuccess}
          onError={onError}
          onCancel={handleCancel}
          saveCard={saveCard}
          onSaveCardChange={setSaveCard}
          showSaveCard={showSaveCard}
        />
      </Elements>
    );
  }

  // Fallback - should not reach here
  return (
    <div className="py-8 text-center">
      <Button onClick={() => createIntent()}>Initialize Payment</Button>
    </div>
  );
}

export default CardMethod;
