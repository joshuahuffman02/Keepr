"use client";

import React, { useState, useEffect, useCallback } from "react";
import { loadStripe, PaymentRequest, PaymentRequestPaymentMethodEvent } from "@stripe/stripe-js";
import { Elements, PaymentRequestButtonElement, useStripe } from "@stripe/react-stripe-js";
import { Button } from "../../../ui/button";
import { Loader2, AlertCircle, Smartphone } from "lucide-react";
import { usePaymentContext } from "../context/PaymentContext";
import { usePaymentIntent } from "../hooks/usePaymentIntent";
import { cn } from "../../../../lib/utils";

// Initialize Stripe
const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

interface WalletPayMethodProps {
  walletType: "apple_pay" | "google_pay";
  onSuccess?: (paymentId: string) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
}

// Inner component that uses Stripe hooks
function WalletPaymentButton({
  walletType,
  amountCents,
  clientSecret,
  onSuccess,
  onError,
  onCancel,
}: {
  walletType: "apple_pay" | "google_pay";
  amountCents: number;
  clientSecret: string;
  onSuccess?: (paymentId: string) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
}) {
  const stripe = useStripe();
  const { actions, props } = usePaymentContext();

  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [canMakePayment, setCanMakePayment] = useState<{
    applePay: boolean;
    googlePay: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  // Create PaymentRequest on mount
  useEffect(() => {
    if (!stripe) return;

    const pr = stripe.paymentRequest({
      country: "US",
      currency: "usd",
      total: {
        label: "Payment",
        amount: amountCents,
      },
      requestPayerName: true,
      requestPayerEmail: true,
    });

    // Check if the wallet is available
    pr.canMakePayment().then((result) => {
      if (result) {
        setPaymentRequest(pr);
        setCanMakePayment({
          applePay: result.applePay || false,
          googlePay: result.googlePay || false,
        });
      } else {
        setError(
          walletType === "apple_pay"
            ? "Apple Pay is not available on this device"
            : "Google Pay is not available on this device"
        );
      }
    });

    // Handle payment method event
    pr.on("paymentmethod", async (event: PaymentRequestPaymentMethodEvent) => {
      setProcessing(true);
      setError(null);

      try {
        // Confirm the payment with the payment method from the wallet
        const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
          clientSecret,
          { payment_method: event.paymentMethod.id },
          { handleActions: false }
        );

        if (confirmError) {
          event.complete("fail");
          throw new Error(confirmError.message || "Payment failed");
        }

        if (paymentIntent?.status === "requires_action") {
          // Handle additional authentication if needed
          const { error: actionError } = await stripe.confirmCardPayment(clientSecret);
          if (actionError) {
            event.complete("fail");
            throw new Error(actionError.message || "Authentication failed");
          }
        }

        event.complete("success");

        // Add tender entry
        actions.addTenderEntry({
          method: walletType,
          amountCents,
          reference: paymentIntent?.id,
          metadata: {
            payerName: event.payerName,
            payerEmail: event.payerEmail,
          },
        });

        onSuccess?.(paymentIntent?.id || "");
      } catch (err: any) {
        setError(err.message || "Payment failed");
        onError?.(err.message || "Payment failed");
      } finally {
        setProcessing(false);
      }
    });

    pr.on("cancel", () => {
      setError("Payment cancelled");
    });

    return () => {
      // Cleanup
    };
  }, [stripe, amountCents, clientSecret, walletType, actions, onSuccess, onError]);

  // Check if this specific wallet type is available
  const isWalletAvailable =
    canMakePayment &&
    ((walletType === "apple_pay" && canMakePayment.applePay) ||
      (walletType === "google_pay" && canMakePayment.googlePay));

  if (!stripe || !paymentRequest) {
    return (
      <div className="py-8 text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-600" />
        <p className="text-slate-600">Checking wallet availability...</p>
      </div>
    );
  }

  if (!isWalletAvailable) {
    return (
      <div className="py-8 text-center space-y-4">
        <Smartphone className="h-12 w-12 mx-auto text-slate-300" />
        <p className="text-slate-600">
          {walletType === "apple_pay" ? "Apple Pay" : "Google Pay"} is not available
        </p>
        <p className="text-sm text-slate-500">
          {walletType === "apple_pay"
            ? "Apple Pay requires Safari on iOS/macOS with a saved card"
            : "Google Pay requires Chrome with a saved card in Google Pay"}
        </p>
        <Button variant="outline" onClick={onCancel}>
          Choose Another Method
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {processing ? (
        <div className="py-8 text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-600" />
          <p className="text-slate-600">Processing payment...</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-center text-slate-600">
            Click the button below to pay with {walletType === "apple_pay" ? "Apple Pay" : "Google Pay"}
          </p>

          <div className="max-w-sm mx-auto">
            <PaymentRequestButtonElement
              options={{
                paymentRequest,
                style: {
                  paymentRequestButton: {
                    type: "default",
                    theme: "dark",
                    height: "48px",
                  },
                },
              }}
            />
          </div>

          <div className="text-center pt-4">
            <Button variant="ghost" onClick={onCancel} className="text-slate-500">
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Main WalletPayMethod component
export function WalletPayMethod({
  walletType,
  onSuccess,
  onError,
  onCancel,
}: WalletPayMethodProps) {
  const { state, actions } = usePaymentContext();
  const { clientSecret, loading, error, createIntent, resetIntent } = usePaymentIntent({
    autoCreate: true,
  });

  const handleCancel = () => {
    resetIntent();
    actions.selectMethod(null);
    onCancel?.();
  };

  const walletName = walletType === "apple_pay" ? "Apple Pay" : "Google Pay";

  // Stripe not configured
  if (!stripePromise) {
    return (
      <div className="py-8 text-center space-y-4">
        <AlertCircle className="h-8 w-8 mx-auto text-red-500" />
        <p className="text-slate-600">Payment system is not configured</p>
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
        <p className="text-slate-600">Initializing {walletName}...</p>
      </div>
    );
  }

  // Error creating payment intent
  if (error && !clientSecret) {
    return (
      <div className="py-8 text-center space-y-4">
        <AlertCircle className="h-8 w-8 mx-auto text-red-500" />
        <p className="text-slate-600">{error}</p>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={handleCancel}>
            Go Back
          </Button>
          <Button onClick={() => createIntent()}>Try Again</Button>
        </div>
      </div>
    );
  }

  // Ready to show wallet button
  if (clientSecret) {
    return (
      <Elements stripe={stripePromise} options={{ clientSecret }}>
        <WalletPaymentButton
          walletType={walletType}
          amountCents={state.remainingCents}
          clientSecret={clientSecret}
          onSuccess={onSuccess}
          onError={onError}
          onCancel={handleCancel}
        />
      </Elements>
    );
  }

  return null;
}

// Convenience exports for specific wallet types
export function ApplePayMethod(props: Omit<WalletPayMethodProps, "walletType">) {
  return <WalletPayMethod walletType="apple_pay" {...props} />;
}

export function GooglePayMethod(props: Omit<WalletPayMethodProps, "walletType">) {
  return <WalletPayMethod walletType="google_pay" {...props} />;
}

export default WalletPayMethod;
