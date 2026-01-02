"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { Loader2, CreditCard, Tent } from "lucide-react";
import { recordTelemetry } from "@/lib/sync-telemetry";
import { RoundUpForCharity } from "@/components/checkout/RoundUpForCharity";

type CartItem = {
    id: string;
    name: string;
    priceCents: number;
    qty: number;
};

interface GuestCheckoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    cart: CartItem[];
    campgroundId: string;
    guest: any; // Using any for now, ideally Guest type
    onSuccess: (order: any) => void;
    isOnline: boolean;
    queueOrder: (payload: any) => void;
    onQueued: () => void;
}

type PaymentMethod = "card" | "charge_to_site";

export function GuestCheckoutModal({ isOpen, onClose, cart, campgroundId, guest, onSuccess, isOnline, queueOrder, onQueued }: GuestCheckoutModalProps) {
    const [method, setMethod] = useState<PaymentMethod>("charge_to_site");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fulfillment, setFulfillment] = useState<"pickup" | "curbside" | "delivery" | "table_service">("delivery");
    const [instructions, setInstructions] = useState("");
    const [locationHint, setLocationHint] = useState("");
    const [charityDonation, setCharityDonation] = useState<{ optedIn: boolean; amountCents: number; charityId: string | null }>({ optedIn: false, amountCents: 0, charityId: null });

    const subtotalCents = cart.reduce((sum, item) => sum + item.priceCents * item.qty, 0);
    const totalCents = subtotalCents + (charityDonation.optedIn ? charityDonation.amountCents : 0);

    // Find active reservation
    const currentReservation = guest?.reservations?.find(
        (r: any) => r.status === "checked_in" || r.status === "confirmed"
    );

    const canChargeToSite = !!currentReservation;

    const handleSubmit = async () => {
        setLoading(true);
        setError(null);
        try {
            const payload: any = {
                items: cart.map(item => ({ productId: item.id, qty: item.qty })),
                paymentMethod: method,
                channel: "online",
                fulfillmentType: fulfillment,
                charityDonation: charityDonation.optedIn && charityDonation.charityId ? {
                    charityId: charityDonation.charityId,
                    amountCents: charityDonation.amountCents,
                } : undefined,
            };

            if (method === "charge_to_site") {
                if (!currentReservation) {
                    throw new Error("No active reservation found to charge to.");
                }
                // We pass the site number from the reservation
                payload.siteNumber = currentReservation.site.siteNumber;
            }

            if (!payload.siteNumber && locationHint) {
                payload.siteNumber = locationHint;
            }

            if (instructions) {
                payload.deliveryInstructions = instructions;
            }

            if (!isOnline) {
                queueOrder(payload);
                recordTelemetry({ source: "portal-store", type: "queue", status: "pending", message: "Order queued offline", meta: { items: cart.length, paymentMethod: method } });
                onQueued();
                onClose();
                return;
            }

            const order = await apiClient.createStoreOrder(campgroundId, payload);
            recordTelemetry({ source: "portal-store", type: "sync", status: "success", message: "Order processed", meta: { items: cart.length, paymentMethod: method } });
            onSuccess(order);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to process order");
            recordTelemetry({ source: "portal-store", type: "error", status: "failed", message: "Order failed", meta: { error: err?.message } });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Checkout</DialogTitle>
                    <DialogDescription>
                        Complete your order of ${(totalCents / 100).toFixed(2)}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setFulfillment("delivery")}
                            className={`p-3 rounded-lg border text-sm font-medium transition ${fulfillment === "delivery"
                                    ? "border-primary bg-primary/5 text-primary"
                                    : "border-border hover:border-border text-foreground"
                                }`}
                        >
                            Deliver to my site/cabin
                        </button>
                        <button
                            onClick={() => setFulfillment("pickup")}
                            className={`p-3 rounded-lg border text-sm font-medium transition ${fulfillment === "pickup"
                                    ? "border-primary bg-primary/5 text-primary"
                                    : "border-border hover:border-border text-foreground"
                                }`}
                        >
                            I’ll pick up
                        </button>
                        <button
                            onClick={() => setFulfillment("curbside")}
                            className={`p-3 rounded-lg border text-sm font-medium transition ${fulfillment === "curbside"
                                    ? "border-primary bg-primary/5 text-primary"
                                    : "border-border hover:border-border text-foreground"
                                }`}
                        >
                            Curbside / meet at gate
                        </button>
                        <button
                            onClick={() => setFulfillment("table_service")}
                            className={`p-3 rounded-lg border text-sm font-medium transition ${fulfillment === "table_service"
                                    ? "border-primary bg-primary/5 text-primary"
                                    : "border-border hover:border-border text-foreground"
                                }`}
                        >
                            Table/QR service
                        </button>
                    </div>

                    {fulfillment !== "pickup" && (
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-foreground">
                                Where should we bring it?
                            </p>
                            <input
                                className="w-full rounded-md border border-border px-3 py-2 text-sm"
                                placeholder="e.g. Site A12, Cabin 3, Table 4, Gatehouse"
                                value={method === "charge_to_site" ? (locationHint || currentReservation?.site?.siteNumber || "") : locationHint}
                                onChange={(e) => setLocationHint(e.target.value)}
                            />
                        </div>
                    )}

                    <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">Notes for staff</p>
                        <input
                            className="w-full rounded-md border border-border px-3 py-2 text-sm"
                            placeholder="Gate code, vehicle description, allergy note…"
                            value={instructions}
                            onChange={(e) => setInstructions(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setMethod("charge_to_site")}
                            disabled={!canChargeToSite}
                            className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${method === "charge_to_site"
                                    ? "border-primary bg-primary/5 text-primary"
                                    : "border-border hover:border-border text-muted-foreground"
                                } ${!canChargeToSite ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                            <Tent className="h-6 w-6" />
                            <span className="font-medium text-sm">Charge to Site</span>
                        </button>

                        <button
                            onClick={() => setMethod("card")}
                            className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${method === "card"
                                    ? "border-primary bg-primary/5 text-primary"
                                    : "border-border hover:border-border text-muted-foreground"
                                }`}
                        >
                            <CreditCard className="h-6 w-6" />
                            <span className="font-medium text-sm">Pay Now</span>
                        </button>
                    </div>

                    {method === "charge_to_site" && currentReservation && (
                        <div className="p-3 bg-muted rounded-md text-sm">
                            Charging to <strong>Site {currentReservation.site.siteNumber}</strong>
                        </div>
                    )}

                    {method === "card" && (
                        <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
                            Card payments are mocked for this demo.
                        </div>
                    )}

                    {/* Round up for charity */}
                    <RoundUpForCharity
                        campgroundId={campgroundId}
                        totalCents={subtotalCents}
                        onChange={setCharityDonation}
                    />

                    {error && (
                        <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                            {error}
                        </div>
                    )}

                    <div className="pt-4 flex gap-3">
                        <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
                            Cancel
                        </Button>
                        <Button className="flex-1" onClick={handleSubmit} disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                `Pay $${(totalCents / 100).toFixed(2)}`
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
