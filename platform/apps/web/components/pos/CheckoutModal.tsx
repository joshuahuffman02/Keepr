"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { CartItem } from "../../app/pos/page";

// Extended CartItem type that supports location-aware pricing
type ExtendedCartItem = CartItem & {
    effectivePriceCents?: number;
};
import { recordTelemetry } from "../../lib/sync-telemetry";
import { RoundUpInline } from "../checkout/RoundUpForCharity";

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

interface CheckoutModalProps {
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
    walletBalanceCents?: number;
}

type PaymentMethod = "card" | "cash" | "charge_to_site" | "guest_wallet";

export function CheckoutModal({ isOpen, onClose, cart, campgroundId, locationId, onSuccess, onQueued, isOnline, queueOrder, guestId, guestName, walletBalanceCents = 0 }: CheckoutModalProps) {
    const [method, setMethod] = useState<PaymentMethod>("card");
    const [loading, setLoading] = useState(false);
    const [siteSearch, setSiteSearch] = useState("");
    const [fulfillment, setFulfillment] = useState<"pickup" | "curbside" | "delivery" | "table_service">("pickup");
    const [deliveryInstructions, setDeliveryInstructions] = useState("");
    const [locationHint, setLocationHint] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [charityDonation, setCharityDonation] = useState<{ optedIn: boolean; amountCents: number; charityId: string | null }>({ optedIn: false, amountCents: 0, charityId: null });
    const offlineCardWarning = !isOnline && method === "card";
    const hasWallet = !!guestId && walletBalanceCents > 0;

    const subtotalCents = cart.reduce((sum, item) => sum + (item.effectivePriceCents ?? item.priceCents) * item.qty, 0);
    const totalCents = subtotalCents + (charityDonation.optedIn ? charityDonation.amountCents : 0);

    const handleSubmit = async () => {
        setLoading(true);
        setError(null);
        try {
            const payload: any = {
                items: cart.map(item => ({
                    productId: item.id,
                    qty: item.qty,
                    // Use effective price if available (location-specific)
                    priceCents: item.effectivePriceCents ?? item.priceCents,
                })),
                paymentMethod: method,
                channel: "pos",
                fulfillmentType: fulfillment,
                locationId: locationId || undefined,
                charityDonation: charityDonation.optedIn && charityDonation.charityId ? {
                    charityId: charityDonation.charityId,
                    amountCents: charityDonation.amountCents,
                } : undefined,
                // Include guestId for wallet payments
                guestId: method === "guest_wallet" ? guestId : undefined,
            };

            if (method === "charge_to_site") {
                if (!siteSearch) {
                    throw new Error("Please enter a site number or guest name");
                }
                // In a real app, we'd probably have a proper search/select UI here.
                // For now, we'll just pass the search string as siteNumber if it looks like one,
                // or rely on the backend to figure it out (or mock it).
                // Based on requirements: "lookup reservation by site # or guest name"
                // We'll send it as siteNumber for simplicity in this MVP or add a note.
                payload.siteNumber = siteSearch;
            }

            if (!payload.siteNumber && locationHint) {
                payload.siteNumber = locationHint;
            }

            if (deliveryInstructions) {
                payload.deliveryInstructions = deliveryInstructions;
            }

            if (!isOnline) {
                queueOrder(payload);
                onQueued();
                recordTelemetry({ source: "pos", type: "queue", status: "pending", message: "Order queued offline", meta: { items: cart.length, paymentMethod: method } });
                onClose();
                return;
            }

            const order = await posApi.createStoreOrder(campgroundId, payload);
            recordTelemetry({ source: "pos", type: "sync", status: "success", message: "Order processed", meta: { items: cart.length, paymentMethod: method } });
            onSuccess(order);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to process order");
            recordTelemetry({ source: "pos", type: "error", status: "failed", message: "Order failed", meta: { error: err?.message } });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Checkout - ${(totalCents / 100).toFixed(2)}</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setFulfillment("pickup")}
                            className={`p-3 rounded-lg border text-sm font-medium transition ${fulfillment === "pickup"
                                    ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                                    : "border-slate-200 hover:border-slate-300 text-slate-700"
                                }`}
                        >
                            Pickup
                        </button>
                        <button
                            onClick={() => setFulfillment("curbside")}
                            className={`p-3 rounded-lg border text-sm font-medium transition ${fulfillment === "curbside"
                                    ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                                    : "border-slate-200 hover:border-slate-300 text-slate-700"
                                }`}
                        >
                            Curbside / Site drop
                        </button>
                        <button
                            onClick={() => setFulfillment("delivery")}
                            className={`p-3 rounded-lg border text-sm font-medium transition ${fulfillment === "delivery"
                                    ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                                    : "border-slate-200 hover:border-slate-300 text-slate-700"
                                }`}
                        >
                            Delivery to site/cabin
                        </button>
                        <button
                            onClick={() => setFulfillment("table_service")}
                            className={`p-3 rounded-lg border text-sm font-medium transition ${fulfillment === "table_service"
                                    ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                                    : "border-slate-200 hover:border-slate-300 text-slate-700"
                                }`}
                        >
                            Table/QR service
                        </button>
                    </div>

                    {(fulfillment !== "pickup" || method === "charge_to_site") && (
                        <div className="space-y-2">
                            <Label htmlFor="location-hint">Site / table / delivery location</Label>
                            <Input
                                id="location-hint"
                                placeholder="e.g. A12, Cabin 3, Table 14"
                                value={method === "charge_to_site" ? siteSearch : locationHint}
                                onChange={(e) => method === "charge_to_site" ? setSiteSearch(e.target.value) : setLocationHint(e.target.value)}
                            />
                            <p className="text-xs text-slate-500">
                                Required for delivery, curbside, or table service. Charge-to-site also accepts guest name.
                            </p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="delivery-instructions">Notes for runner</Label>
                        <Input
                            id="delivery-instructions"
                            placeholder="Gate code, vehicle color, ice request, etc."
                            value={deliveryInstructions}
                            onChange={(e) => setDeliveryInstructions(e.target.value)}
                        />
                    </div>

                    <div className={`grid gap-3 ${hasWallet ? "grid-cols-2" : "grid-cols-3"}`}>
                        <button
                            onClick={() => setMethod("card")}
                            className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${method === "card"
                                    ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                                    : "border-slate-200 hover:border-slate-300 text-slate-600"
                                }`}
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="2" y="5" width="20" height="14" rx="2" />
                                <line x1="2" y1="10" x2="22" y2="10" />
                            </svg>
                            <span className="font-medium text-sm">Card</span>
                        </button>
                        <button
                            onClick={() => setMethod("cash")}
                            className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${method === "cash"
                                    ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                                    : "border-slate-200 hover:border-slate-300 text-slate-600"
                                }`}
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="1" x2="12" y2="23" />
                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                            </svg>
                            <span className="font-medium text-sm">Cash</span>
                        </button>
                        <button
                            onClick={() => setMethod("charge_to_site")}
                            className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${method === "charge_to_site"
                                    ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                                    : "border-slate-200 hover:border-slate-300 text-slate-600"
                                }`}
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 21h18M5 21V7l8-4 8 4v14" />
                                <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6v4" />
                            </svg>
                            <span className="font-medium text-sm">Site Charge</span>
                        </button>
                        {hasWallet && (
                            <button
                                onClick={() => setMethod("guest_wallet")}
                                className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${method === "guest_wallet"
                                        ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                                        : "border-slate-200 hover:border-slate-300 text-slate-600"
                                    }`}
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-3" />
                                    <path d="M21 12a2 2 0 0 0-2-2h-4a2 2 0 0 0 0 4h4a2 2 0 0 0 2-2v0Z" />
                                </svg>
                                <span className="font-medium text-sm">Wallet</span>
                                <span className="text-xs text-slate-500">${(walletBalanceCents / 100).toFixed(2)}</span>
                            </button>
                        )}
                    </div>

                    {/* Round up for charity */}
                    <RoundUpInline
                        campgroundId={campgroundId}
                        totalCents={subtotalCents}
                        onChange={setCharityDonation}
                    />

                    {offlineCardWarning && (
                        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                            Offline: card payments can't be processed right now. Switch to cash / charge to site or wait until you're back online.
                        </div>
                    )}

                    {method === "guest_wallet" && walletBalanceCents < totalCents && (
                        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                            Wallet balance (${(walletBalanceCents / 100).toFixed(2)}) is less than total (${(totalCents / 100).toFixed(2)}). Please use a different payment method or split payment.
                        </div>
                    )}

                    {method === "guest_wallet" && guestName && (
                        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                            Paying from {guestName}'s wallet
                        </div>
                    )}

                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-md border border-red-100">
                            {error}
                        </div>
                    )}

                    <div className="pt-4 flex gap-3">
                        <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
                            Cancel
                        </Button>
                        <Button
                            className="flex-1"
                            onClick={handleSubmit}
                            disabled={loading || offlineCardWarning || (method === "guest_wallet" && walletBalanceCents < totalCents)}
                        >
                            {loading ? "Processing..." : `Pay $${(totalCents / 100).toFixed(2)}`}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
