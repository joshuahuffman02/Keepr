"use client";

import { useState, useEffect, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { apiClient } from "../../lib/api-client";
import { AlertCircle, RefreshCw } from "lucide-react";

// Initialize Stripe outside of component to avoid recreating object on renders
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "pk_test_placeholder");

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    reservationId: string;
    amountCents: number;
    onSuccess: () => void;
    entryMode?: "manual" | "reader";
    requirePostalCode?: boolean;
    defaultPostalCode?: string;
}

function CheckoutForm({
    amountCents,
    onSuccess,
    onClose,
    entryMode = "manual",
    requirePostalCode = true,
    defaultPostalCode
}: {
    amountCents: number;
    onSuccess: () => void;
    onClose: () => void;
    entryMode?: "manual" | "reader";
    requirePostalCode?: boolean;
    defaultPostalCode?: string;
}) {
    const stripe = useStripe();
    const elements = useElements();
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const [postalCode, setPostalCode] = useState(defaultPostalCode ?? "");
    const postalRequired = requirePostalCode === undefined ? true : requirePostalCode;
    const postalReady = !postalRequired || postalCode.trim().length > 0;

    useEffect(() => {
        if (!defaultPostalCode) return;
        setPostalCode((prev) => (prev ? prev : defaultPostalCode));
    }, [defaultPostalCode]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (entryMode === "reader") {
            setError("Card reader payments are not configured yet.");
            return;
        }
        if (!stripe || !elements) return;
        if (!postalReady) {
            setError("Billing ZIP is required.");
            return;
        }

        setProcessing(true);
        setError(null);

        const { error: submitError } = await elements.submit();
        if (submitError) {
            setError(submitError.message || "An error occurred");
            setProcessing(false);
            return;
        }

        const confirmParams: any = {
            return_url: window.location.href,
        };
        if (postalCode.trim()) {
            confirmParams.payment_method_data = {
                billing_details: {
                    address: { postal_code: postalCode.trim() }
                }
            };
        }

        const { error: confirmError } = await stripe.confirmPayment({
            elements,
            confirmParams,
            redirect: "if_required",
        });

        if (confirmError) {
            setError(confirmError.message || "Payment failed");
            setProcessing(false);
        } else {
            // Payment succeeded
            onSuccess();
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
                <Label className="text-xs text-slate-500">Billing ZIP</Label>
                <Input
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="Zip code"
                />
            </div>
            <PaymentElement />
            {error && <div className="text-sm text-red-600">{error}</div>}
            <div className="flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={onClose} disabled={processing}>
                    Cancel
                </Button>
                <Button type="submit" disabled={!stripe || processing || !postalReady || entryMode === "reader"}>
                    {processing ? "Processing..." : `Pay $${(amountCents / 100).toFixed(2)}`}
                </Button>
            </div>
        </form>
    );
}

export function PaymentModal({
    isOpen,
    onClose,
    reservationId,
    amountCents,
    onSuccess,
    entryMode = "manual",
    requirePostalCode = true,
    defaultPostalCode
}: PaymentModalProps) {
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [initError, setInitError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const createPaymentIntent = useCallback(async () => {
        if (!reservationId || amountCents <= 0) return;

        setIsLoading(true);
        setInitError(null);
        setClientSecret(null);

        try {
            const data = await apiClient.createPaymentIntent(amountCents, "usd", reservationId);
            setClientSecret(data.clientSecret);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to initialize payment";
            setInitError(message);
        } finally {
            setIsLoading(false);
        }
    }, [amountCents, reservationId]);

    useEffect(() => {
        if (isOpen && reservationId && amountCents > 0) {
            createPaymentIntent();
        }

        // Reset state when modal closes
        if (!isOpen) {
            setClientSecret(null);
            setInitError(null);
            setIsLoading(false);
        }
    }, [isOpen, reservationId, amountCents, createPaymentIntent]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Pay Balance</DialogTitle>
                    <div className="text-xs text-slate-500">
                        {entryMode === "reader" ? "Card reader" : "Manual entry"}
                    </div>
                </DialogHeader>

                {initError && (
                    <div className="py-6 text-center space-y-4">
                        <div className="flex items-center justify-center gap-2 text-red-600">
                            <AlertCircle className="h-5 w-5" />
                            <span className="text-sm">{initError}</span>
                        </div>
                        <Button
                            variant="outline"
                            onClick={createPaymentIntent}
                            disabled={isLoading}
                            className="gap-2"
                        >
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            Try Again
                        </Button>
                    </div>
                )}

                {clientSecret && !initError && (
                    <Elements stripe={stripePromise} options={{ clientSecret }}>
                        <CheckoutForm
                            amountCents={amountCents}
                            onSuccess={onSuccess}
                            onClose={onClose}
                            entryMode={entryMode}
                            requirePostalCode={requirePostalCode}
                            defaultPostalCode={defaultPostalCode}
                        />
                    </Elements>
                )}

                {isLoading && !initError && (
                    <div className="py-8 text-center text-slate-500">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                        Initializing payment...
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
