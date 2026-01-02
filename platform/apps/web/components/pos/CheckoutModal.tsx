"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { CartItem } from "../../app/pos/page";
import { apiClient } from "../../lib/api-client";

// Extended CartItem type that supports location-aware pricing
type ExtendedCartItem = CartItem & {
    effectivePriceCents?: number;
};
import { recordTelemetry } from "../../lib/sync-telemetry";
import { RoundUpInline } from "../checkout/RoundUpForCharity";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

type TerminalReader = {
    id: string;
    label: string;
    status: string;
    stripeReaderId: string;
};

type SavedCard = {
    id: string;
    last4: string | null;
    brand: string | null;
    isDefault: boolean;
    nickname: string | null;
};

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

type PaymentMethod = "card" | "cash" | "charge_to_site" | "guest_wallet" | "terminal" | "saved_card";

export function CheckoutModal({ isOpen, onClose, cart, campgroundId, locationId, onSuccess, onQueued, isOnline, queueOrder, guestId, guestName, walletBalanceCents = 0 }: CheckoutModalProps) {
    const [method, setMethod] = useState<PaymentMethod>("card");
    const [loading, setLoading] = useState(false);
    const [siteSearch, setSiteSearch] = useState("");
    const [fulfillment, setFulfillment] = useState<"pickup" | "curbside" | "delivery" | "table_service">("pickup");
    const [deliveryInstructions, setDeliveryInstructions] = useState("");
    const [locationHint, setLocationHint] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [charityDonation, setCharityDonation] = useState<{ optedIn: boolean; amountCents: number; charityId: string | null }>({ optedIn: false, amountCents: 0, charityId: null });

    // Terminal state
    const [readers, setReaders] = useState<TerminalReader[]>([]);
    const [selectedReaderId, setSelectedReaderId] = useState<string>("");
    const [terminalStatus, setTerminalStatus] = useState<string>("");

    // Saved cards state
    const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
    const [selectedCardId, setSelectedCardId] = useState<string>("");

    const offlineCardWarning = !isOnline && (method === "card" || method === "terminal" || method === "saved_card");
    const hasWallet = !!guestId && walletBalanceCents > 0;
    const hasSavedCards = savedCards.length > 0;
    const hasTerminal = readers.some(r => r.status === "online");

    // Fetch terminal readers on mount
    useEffect(() => {
        if (!campgroundId || !isOpen) return;
        apiClient.getTerminalReaders(campgroundId)
            .then((data) => {
                setReaders(data);
                // Auto-select first online reader
                const onlineReader = data.find(r => r.status === "online");
                if (onlineReader) setSelectedReaderId(onlineReader.id);
            })
            .catch(() => setReaders([]));
    }, [campgroundId, isOpen]);

    // Fetch saved cards if guest is selected
    useEffect(() => {
        if (!campgroundId || !guestId || !isOpen) return;
        apiClient.getChargeablePaymentMethods(campgroundId, guestId)
            .then((data) => {
                setSavedCards(data);
                // Auto-select default card
                const defaultCard = data.find(c => c.isDefault);
                if (defaultCard) setSelectedCardId(defaultCard.id);
                else if (data.length > 0) setSelectedCardId(data[0].id);
            })
            .catch(() => setSavedCards([]));
    }, [campgroundId, guestId, isOpen]);

    const subtotalCents = cart.reduce((sum, item) => sum + (item.effectivePriceCents ?? item.priceCents) * item.qty, 0);
    const totalCents = subtotalCents + (charityDonation.optedIn ? charityDonation.amountCents : 0);

    const handleSubmit = async () => {
        setLoading(true);
        setError(null);
        setTerminalStatus("");
        try {
            // Handle terminal payment separately
            if (method === "terminal") {
                if (!selectedReaderId) {
                    throw new Error("Please select a card reader");
                }
                setTerminalStatus("Creating payment...");

                // Create terminal payment
                const terminalPayment = await apiClient.createTerminalPayment(campgroundId, {
                    readerId: selectedReaderId,
                    amountCents: totalCents,
                    guestId: guestId || undefined,
                    saveCard: !!guestId, // Auto-save card if guest is linked
                    metadata: { source: "pos", fulfillment },
                });

                setTerminalStatus("Present card on reader...");

                // Process payment on reader
                const result = await apiClient.processTerminalPayment(
                    campgroundId,
                    selectedReaderId,
                    terminalPayment.paymentIntentId
                );

                if (!result.success) {
                    throw new Error(result.error || "Terminal payment failed");
                }

                setTerminalStatus("Payment successful!");
                recordTelemetry({ source: "pos", type: "sync", status: "success", message: "Terminal payment processed", meta: { items: cart.length, paymentMethod: "terminal" } });

                // Create the order with the payment reference
                const payload = {
                    items: cart.map(item => ({
                        productId: item.id,
                        qty: item.qty,
                        priceCents: item.effectivePriceCents ?? item.priceCents,
                    })),
                    paymentMethod: "card",
                    channel: "pos",
                    fulfillmentType: fulfillment,
                    locationId: locationId || undefined,
                    paymentId: result.paymentId,
                    charityDonation: charityDonation.optedIn && charityDonation.charityId ? {
                        charityId: charityDonation.charityId,
                        amountCents: charityDonation.amountCents,
                    } : undefined,
                    guestId: guestId || undefined,
                };

                const order = await posApi.createStoreOrder(campgroundId, payload);
                onSuccess(order);
                return;
            }

            // Handle saved card payment
            if (method === "saved_card") {
                if (!guestId || !selectedCardId) {
                    throw new Error("Please select a saved card");
                }

                const result = await apiClient.chargeSavedCard(campgroundId, {
                    guestId,
                    paymentMethodId: selectedCardId,
                    amountCents: totalCents,
                    description: `POS Order - ${cart.length} items`,
                    metadata: { source: "pos", fulfillment },
                });

                if (!result.success) {
                    throw new Error("Failed to charge saved card");
                }

                recordTelemetry({ source: "pos", type: "sync", status: "success", message: "Saved card charged", meta: { items: cart.length, paymentMethod: "saved_card" } });

                // Create the order with the payment reference
                const payload = {
                    items: cart.map(item => ({
                        productId: item.id,
                        qty: item.qty,
                        priceCents: item.effectivePriceCents ?? item.priceCents,
                    })),
                    paymentMethod: "card",
                    channel: "pos",
                    fulfillmentType: fulfillment,
                    locationId: locationId || undefined,
                    paymentId: result.paymentId,
                    charityDonation: charityDonation.optedIn && charityDonation.charityId ? {
                        charityId: charityDonation.charityId,
                        amountCents: charityDonation.amountCents,
                    } : undefined,
                    guestId,
                };

                const order = await posApi.createStoreOrder(campgroundId, payload);
                onSuccess(order);
                return;
            }

            // Standard payment flow (card, cash, charge_to_site, guest_wallet)
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
            setTerminalStatus("");
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
                                    : "border-border hover:border-border text-foreground"
                                }`}
                        >
                            Pickup
                        </button>
                        <button
                            onClick={() => setFulfillment("curbside")}
                            className={`p-3 rounded-lg border text-sm font-medium transition ${fulfillment === "curbside"
                                    ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                                    : "border-border hover:border-border text-foreground"
                                }`}
                        >
                            Curbside / Site drop
                        </button>
                        <button
                            onClick={() => setFulfillment("delivery")}
                            className={`p-3 rounded-lg border text-sm font-medium transition ${fulfillment === "delivery"
                                    ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                                    : "border-border hover:border-border text-foreground"
                                }`}
                        >
                            Delivery to site/cabin
                        </button>
                        <button
                            onClick={() => setFulfillment("table_service")}
                            className={`p-3 rounded-lg border text-sm font-medium transition ${fulfillment === "table_service"
                                    ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                                    : "border-border hover:border-border text-foreground"
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
                            <p className="text-xs text-muted-foreground">
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

                    <div className="grid gap-3 grid-cols-3">
                        {/* Terminal - show first if available */}
                        {readers.length > 0 && (
                            <button
                                onClick={() => setMethod("terminal")}
                                className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${method === "terminal"
                                        ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                                        : hasTerminal
                                            ? "border-border hover:border-border text-muted-foreground"
                                            : "border-border text-muted-foreground cursor-not-allowed"
                                    }`}
                                disabled={!hasTerminal}
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="2" y="3" width="20" height="14" rx="2" />
                                    <path d="M8 21h8" />
                                    <path d="M12 17v4" />
                                    <circle cx="12" cy="10" r="2" />
                                </svg>
                                <span className="font-medium text-sm">Terminal</span>
                                {hasTerminal ? (
                                    <span className="text-xs text-emerald-600">Ready</span>
                                ) : (
                                    <span className="text-xs text-muted-foreground">Offline</span>
                                )}
                            </button>
                        )}

                        {/* Saved Card - show if guest has cards on file */}
                        {hasSavedCards && (
                            <button
                                onClick={() => setMethod("saved_card")}
                                className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${method === "saved_card"
                                        ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                                        : "border-border hover:border-border text-muted-foreground"
                                    }`}
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="2" y="5" width="20" height="14" rx="2" />
                                    <line x1="2" y1="10" x2="22" y2="10" />
                                    <path d="m9 15 2 2 4-4" />
                                </svg>
                                <span className="font-medium text-sm">Card on File</span>
                                <span className="text-xs text-muted-foreground">{savedCards.length} saved</span>
                            </button>
                        )}

                        <button
                            onClick={() => setMethod("card")}
                            className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${method === "card"
                                    ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                                    : "border-border hover:border-border text-muted-foreground"
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
                                    : "border-border hover:border-border text-muted-foreground"
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
                                    : "border-border hover:border-border text-muted-foreground"
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
                                        : "border-border hover:border-border text-muted-foreground"
                                    }`}
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-3" />
                                    <path d="M21 12a2 2 0 0 0-2-2h-4a2 2 0 0 0 0 4h4a2 2 0 0 0 2-2v0Z" />
                                </svg>
                                <span className="font-medium text-sm">Wallet</span>
                                <span className="text-xs text-muted-foreground">${(walletBalanceCents / 100).toFixed(2)}</span>
                            </button>
                        )}
                    </div>

                    {/* Terminal reader selection */}
                    {method === "terminal" && readers.length > 0 && (
                        <div className="space-y-2">
                            <Label>Select reader</Label>
                            <Select value={selectedReaderId} onValueChange={setSelectedReaderId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a card reader" />
                                </SelectTrigger>
                                <SelectContent>
                                    {readers.map((reader) => (
                                        <SelectItem
                                            key={reader.id}
                                            value={reader.id}
                                            disabled={reader.status !== "online"}
                                        >
                                            {reader.label} {reader.status === "online" ? "(Ready)" : "(Offline)"}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Saved card selection */}
                    {method === "saved_card" && savedCards.length > 0 && (
                        <div className="space-y-2">
                            <Label>Select card</Label>
                            <Select value={selectedCardId} onValueChange={setSelectedCardId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a saved card" />
                                </SelectTrigger>
                                <SelectContent>
                                    {savedCards.map((card) => (
                                        <SelectItem key={card.id} value={card.id}>
                                            {card.brand} ···· {card.last4} {card.nickname && `(${card.nickname})`} {card.isDefault && "★"}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Terminal status message */}
                    {terminalStatus && (
                        <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <circle cx="12" cy="12" r="10" strokeWidth="2" opacity="0.25" />
                                <path d="M4 12a8 8 0 018-8" strokeWidth="2" />
                            </svg>
                            {terminalStatus}
                        </div>
                    )}

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
