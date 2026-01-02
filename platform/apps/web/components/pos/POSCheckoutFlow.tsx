"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { PaymentCollectionModal } from "../payments/PaymentCollectionModal";
import { RoundUpInline } from "../checkout/RoundUpForCharity";
import { CartItem } from "../../app/pos/page";
import { apiClient } from "../../lib/api-client";
import { recordTelemetry } from "../../lib/sync-telemetry";

// Extended CartItem type that supports location-aware pricing
type ExtendedCartItem = CartItem & {
    effectivePriceCents?: number;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

async function fetchJSON<T = any>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, init);
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Request failed ${res.status}: ${text}`);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
}

const posApi = {
    createStoreOrder: (campgroundId: string, payload: any, headers?: Record<string, string>) =>
        fetchJSON(`${API_BASE}/campgrounds/${campgroundId}/store/orders`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(headers || {}) },
            body: JSON.stringify(payload)
        })
};

interface POSCheckoutFlowProps {
    isOpen: boolean;
    onClose: () => void;
    cart: ExtendedCartItem[];
    campgroundId: string;
    locationId?: string | null;
    onSuccess: (order: any) => void;
    onQueued: () => void;
    isOnline: boolean;
    queueOrder: (payload: any) => void;
    guestId?: string | null;
    guestName?: string | null;
    guestEmail?: string | null;
    walletBalanceCents?: number;
}

type FulfillmentType = "pickup" | "curbside" | "delivery" | "table_service";

export function POSCheckoutFlow({
    isOpen,
    onClose,
    cart,
    campgroundId,
    locationId,
    onSuccess,
    onQueued,
    isOnline,
    queueOrder,
    guestId,
    guestName,
    guestEmail,
    walletBalanceCents = 0,
}: POSCheckoutFlowProps) {
    // Step management
    const [step, setStep] = useState<"config" | "payment">("config");

    // Order configuration
    const [fulfillment, setFulfillment] = useState<FulfillmentType>("pickup");
    const [deliveryInstructions, setDeliveryInstructions] = useState("");
    const [locationHint, setLocationHint] = useState("");
    const [charityDonation, setCharityDonation] = useState<{
        optedIn: boolean;
        amountCents: number;
        charityId: string | null;
    }>({ optedIn: false, amountCents: 0, charityId: null });

    // Error handling
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Reset state when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setStep("config");
            setFulfillment("pickup");
            setDeliveryInstructions("");
            setLocationHint("");
            setCharityDonation({ optedIn: false, amountCents: 0, charityId: null });
            setError(null);
        }
    }, [isOpen]);

    const subtotalCents = cart.reduce(
        (sum, item) => sum + (item.effectivePriceCents ?? item.priceCents) * item.qty,
        0
    );
    const totalCents = subtotalCents + (charityDonation.optedIn ? charityDonation.amountCents : 0);

    const needsLocation = fulfillment !== "pickup";

    const handleProceedToPayment = () => {
        if (needsLocation && !locationHint) {
            setError("Please enter a site, table, or delivery location");
            return;
        }
        setError(null);
        setStep("payment");
    };

    const handlePaymentSuccess = async (paymentResult: any) => {
        setLoading(true);
        setError(null);

        try {
            // Build order payload with payment result
            const payload: any = {
                items: cart.map(item => ({
                    productId: item.id,
                    qty: item.qty,
                    priceCents: item.effectivePriceCents ?? item.priceCents,
                })),
                paymentMethod: paymentResult.payments?.[0]?.method || "card",
                channel: "pos",
                fulfillmentType: fulfillment,
                locationId: locationId || undefined,
                guestId: guestId || undefined,
            };

            // Add payment reference if available
            if (paymentResult.payments?.[0]?.paymentId) {
                payload.paymentId = paymentResult.payments[0].paymentId;
            }

            // Add location hint / site number
            if (locationHint) {
                payload.siteNumber = locationHint;
            }

            // Add delivery instructions
            if (deliveryInstructions) {
                payload.deliveryInstructions = deliveryInstructions;
            }

            // Add charity donation if applicable
            if (charityDonation.optedIn && charityDonation.charityId) {
                payload.charityDonation = {
                    charityId: charityDonation.charityId,
                    amountCents: charityDonation.amountCents,
                };
            }

            // Create the order
            const order = await posApi.createStoreOrder(campgroundId, payload);

            recordTelemetry({
                source: "pos",
                type: "sync",
                status: "success",
                message: "POS order completed via unified payment modal",
                meta: { items: cart.length, paymentMethod: payload.paymentMethod },
            });

            onSuccess(order);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to create order");
            recordTelemetry({
                source: "pos",
                type: "error",
                status: "failed",
                message: "Order creation failed after payment",
                meta: { error: err?.message },
            });
        } finally {
            setLoading(false);
        }
    };

    // Handle offline/queued orders (cash, check, folio)
    const handleOfflinePayment = (method: string) => {
        const payload: any = {
            items: cart.map(item => ({
                productId: item.id,
                qty: item.qty,
                priceCents: item.effectivePriceCents ?? item.priceCents,
            })),
            paymentMethod: method,
            channel: "pos",
            fulfillmentType: fulfillment,
            locationId: locationId || undefined,
            guestId: guestId || undefined,
        };

        if (locationHint) {
            payload.siteNumber = locationHint;
        }

        if (deliveryInstructions) {
            payload.deliveryInstructions = deliveryInstructions;
        }

        if (charityDonation.optedIn && charityDonation.charityId) {
            payload.charityDonation = {
                charityId: charityDonation.charityId,
                amountCents: charityDonation.amountCents,
            };
        }

        queueOrder(payload);
        onQueued();
        recordTelemetry({
            source: "pos",
            type: "queue",
            status: "pending",
            message: "Order queued offline",
            meta: { items: cart.length, paymentMethod: method },
        });
        onClose();
    };

    const handleClose = () => {
        setStep("config");
        onClose();
    };

    // Step 1: Order Configuration
    if (step === "config") {
        return (
            <Dialog open={isOpen} onOpenChange={handleClose}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Checkout - ${(totalCents / 100).toFixed(2)}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {/* Fulfillment Type Selection */}
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setFulfillment("pickup")}
                                className={`p-3 rounded-lg border text-sm font-medium transition ${
                                    fulfillment === "pickup"
                                        ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                                        : "border-border hover:border-border text-foreground"
                                }`}
                            >
                                Pickup
                            </button>
                            <button
                                onClick={() => setFulfillment("curbside")}
                                className={`p-3 rounded-lg border text-sm font-medium transition ${
                                    fulfillment === "curbside"
                                        ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                                        : "border-border hover:border-border text-foreground"
                                }`}
                            >
                                Curbside / Site drop
                            </button>
                            <button
                                onClick={() => setFulfillment("delivery")}
                                className={`p-3 rounded-lg border text-sm font-medium transition ${
                                    fulfillment === "delivery"
                                        ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                                        : "border-border hover:border-border text-foreground"
                                }`}
                            >
                                Delivery to site/cabin
                            </button>
                            <button
                                onClick={() => setFulfillment("table_service")}
                                className={`p-3 rounded-lg border text-sm font-medium transition ${
                                    fulfillment === "table_service"
                                        ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                                        : "border-border hover:border-border text-foreground"
                                }`}
                            >
                                Table/QR service
                            </button>
                        </div>

                        {/* Location hint - required for non-pickup */}
                        {needsLocation && (
                            <div className="space-y-2">
                                <Label htmlFor="location-hint">
                                    Site / table / delivery location
                                    <span className="text-red-500 ml-1">*</span>
                                </Label>
                                <Input
                                    id="location-hint"
                                    placeholder="e.g. A12, Cabin 3, Table 14"
                                    value={locationHint}
                                    onChange={(e) => setLocationHint(e.target.value)}
                                />
                            </div>
                        )}

                        {/* Delivery instructions */}
                        <div className="space-y-2">
                            <Label htmlFor="delivery-instructions">Notes for runner</Label>
                            <Input
                                id="delivery-instructions"
                                placeholder="Gate code, vehicle color, ice request, etc."
                                value={deliveryInstructions}
                                onChange={(e) => setDeliveryInstructions(e.target.value)}
                            />
                        </div>

                        {/* Order summary */}
                        <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Items ({cart.length})</span>
                                <span className="font-medium">${(subtotalCents / 100).toFixed(2)}</span>
                            </div>
                            {charityDonation.optedIn && charityDonation.amountCents > 0 && (
                                <div className="flex justify-between text-emerald-600">
                                    <span>Charity donation</span>
                                    <span>+${(charityDonation.amountCents / 100).toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between font-semibold pt-2 border-t border-border">
                                <span>Total</span>
                                <span>${(totalCents / 100).toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Round up for charity */}
                        <RoundUpInline
                            campgroundId={campgroundId}
                            totalCents={subtotalCents}
                            onChange={setCharityDonation}
                        />

                        {/* Offline warning */}
                        {!isOnline && (
                            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                You're offline. Cash and charge-to-site payments will be queued for later sync.
                            </div>
                        )}

                        {error && (
                            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-md border border-red-100">
                                {error}
                            </div>
                        )}

                        <div className="pt-4 flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={handleClose}>
                                Cancel
                            </Button>
                            <Button className="flex-1" onClick={handleProceedToPayment}>
                                Continue to Payment
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    // Step 2: Payment Collection via unified modal
    return (
        <PaymentCollectionModal
            isOpen={isOpen}
            onClose={() => setStep("config")}
            campgroundId={campgroundId}
            amountDueCents={totalCents}
            subject={{ type: "cart", items: cart }}
            context="pos"
            guestId={guestId || undefined}
            guestEmail={guestEmail || undefined}
            guestName={guestName || undefined}
            enableSplitTender={true}
            enableCharityRoundUp={false} // Already handled in config step
            enablePartialPayment={false}
            onSuccess={handlePaymentSuccess}
            onError={(error) => {
                setError(error.message);
                setStep("config");
            }}
        />
    );
}
