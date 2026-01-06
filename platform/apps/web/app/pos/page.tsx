"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { DashboardShell } from "../../components/ui/layout/DashboardShell";
import { Badge } from "../../components/ui/badge";
import { ProductGrid } from "../../components/pos/ProductGrid";
import { CategoryTabs } from "../../components/pos/CategoryTabs";
import { CartSidebar } from "../../components/pos/CartSidebar";
import { CartDrawer } from "../../components/pos/CartDrawer";
import { FloatingCartButton } from "../../components/pos/FloatingCartButton";
import { POSCheckoutFlow } from "../../components/pos/POSCheckoutFlow";
import { ReceiptView } from "../../components/pos/ReceiptView";
import { z } from "zod";
import { recordTelemetry } from "../../lib/sync-telemetry";
import { loadQueue as loadQueueGeneric, saveQueue as saveQueueGeneric, registerBackgroundSync } from "../../lib/offline-queue";
import { Button } from "../../components/ui/button";
import { TableEmpty } from "../../components/ui/table";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Label } from "../../components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../components/ui/select";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Checkbox } from "../../components/ui/checkbox";
import { apiClient } from "../../lib/api-client";
import { randomId } from "@/lib/random-id";
import { SyncStatus } from "../../components/sync/SyncStatus";
import { SyncDetailsDrawer } from "../../components/sync/SyncDetailsDrawer";
import { useSyncStatus } from "@/contexts/SyncStatusContext";
import { VoiceCommandIndicator } from "../../components/pos/VoiceCommandIndicator";
import { useVoiceCommands } from "../../hooks/use-voice-commands";
import { haptic } from "../../hooks/use-haptic";
import { AlertTriangle, Check, Receipt, Search, ShoppingBag, X } from "lucide-react";

const posApi = {
    getProducts: (campgroundId: string, locationId?: string) =>
        locationId
            ? apiClient.getProductsForLocation(campgroundId, locationId)
            : apiClient.getProducts(campgroundId),
    getProductCategories: (campgroundId: string) => apiClient.getProductCategories(campgroundId),
    createStoreOrder: (campgroundId: string, payload: any, headers?: Record<string, string>) =>
        apiClient.createStoreOrder(campgroundId, payload),
    getLocations: (campgroundId: string) => apiClient.getStoreLocations(campgroundId),
};
const EMPTY_SELECT_VALUE = "__empty";

// Local types based on schemas
type Product = {
    id: string;
    name: string;
    description: string | null;
    priceCents: number;
    imageUrl: string | null;
    categoryId: string;
    stock?: number;
    effectivePriceCents?: number;
    effectiveStock?: number | null;
};

type Category = {
    id: string;
    name: string;
    sortOrder: number;
};

type StoreLocation = Awaited<ReturnType<typeof apiClient.getStoreLocations>>[0];

export type CartItem = Product & { qty: number; justAdded?: boolean };

type OrderAdjustmentPayload = {
    type?: "refund" | "exchange";
    items?: Array<{ itemId?: string; qty?: number; amountCents?: number }>;
    amountCents?: number;
    note?: string | null;
};

function centsFromInput(value: string, fallback: number) {
    const parsed = Number.parseFloat(value);
    if (Number.isNaN(parsed)) return fallback;
    return Math.max(0, Math.round(parsed * 100));
}

interface RefundExchangeDialogProps {
    open: boolean;
    onClose: () => void;
    orders: any[];
    defaultOrderId?: string | null;
    onSubmit: (orderId: string, payload: OrderAdjustmentPayload) => Promise<void>;
    loading?: boolean;
}

function RefundExchangeDialog({ open, onClose, orders, defaultOrderId, onSubmit, loading }: RefundExchangeDialogProps) {
    const [orderId, setOrderId] = useState<string>("");
    const [note, setNote] = useState("");
    const [overrideAmount, setOverrideAmount] = useState("");
    const [type, setType] = useState<"refund" | "exchange">("refund");
    const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (defaultOrderId) {
            setOrderId(defaultOrderId);
        } else if (orders.length > 0) {
            setOrderId(orders[0].id);
        } else {
            setOrderId("");
        }
    }, [defaultOrderId, orders, open]);

    const activeOrder = orders.find((o) => o.id === orderId);

    useEffect(() => {
        if (activeOrder?.items?.length) {
            const defaults: Record<string, boolean> = {};
            activeOrder.items.forEach((item: any) => (defaults[item.id] = true));
            setSelectedItems(defaults);
        } else {
            setSelectedItems({});
        }
        setError(null);
    }, [orderId, activeOrder?.items?.length, open]);

    const selectedLineItems = activeOrder?.items?.filter((i: any) => selectedItems[i.id]) ?? [];
    const computedAmount = selectedLineItems.reduce((sum: number, item: any) => sum + (item.totalCents ?? 0), 0);
    const amountCents = overrideAmount ? centsFromInput(overrideAmount, computedAmount) : computedAmount;

    const handleSubmit = async () => {
        if (!orderId) {
            setError("Pick an order to refund/exchange.");
            return;
        }
        if (!selectedLineItems.length) {
            setError("Select at least one item.");
            return;
        }

        try {
            setError(null);
            await onSubmit(orderId, {
                type,
                note: note || null,
                items: selectedLineItems.map((i: any) => ({
                    itemId: i.id,
                    qty: i.qty,
                    amountCents: i.totalCents ?? 0,
                })),
                amountCents,
            });
        } catch (err: any) {
            setError(err?.message || "Failed to record refund/exchange");
        }
    };

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
            <DialogContent className="sm:max-w-[560px]">
                <DialogHeader>
                    <DialogTitle>Refund or exchange</DialogTitle>
                    <DialogDescription>Select a recent order, choose items, and capture a note.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="order-select">Recent POS order</Label>
                        <Select
                            value={orderId || EMPTY_SELECT_VALUE}
                            onValueChange={(value) => setOrderId(value === EMPTY_SELECT_VALUE ? "" : value)}
                        >
                            <SelectTrigger id="order-select" className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={EMPTY_SELECT_VALUE} disabled={orders.length === 0}>
                                    {orders.length === 0 ? "No orders found" : "Select an order"}
                                </SelectItem>
                                {orders.map((order) => (
                                    <SelectItem key={order.id} value={order.id}>
                                        #{order.id.slice(0, 8)} • ${(order.totalCents / 100).toFixed(2)} • {order.createdAt ? new Date(order.createdAt).toLocaleString() : "recent"}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {activeOrder && (
                        <div className="space-y-3">
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={type === "refund" ? "default" : "outline"}
                                    onClick={() => setType("refund")}
                                >
                                    Refund
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={type === "exchange" ? "default" : "outline"}
                                    onClick={() => setType("exchange")}
                                >
                                    Exchange
                                </Button>
                            </div>

                            <div className="rounded-lg border border-border p-3">
                                <p className="text-sm font-medium mb-2">Items</p>
                                {activeOrder.items?.length ? (
                                    <div className="space-y-2">
                                        {activeOrder.items.map((item: any) => (
                                            <label key={item.id} className="flex items-center justify-between gap-3 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <Checkbox
                                                        checked={!!selectedItems[item.id]}
                                                        onCheckedChange={(checked) => setSelectedItems((prev) => ({ ...prev, [item.id]: Boolean(checked) }))}
                                                    />
                                                    <span className="text-foreground">{item.name}</span>
                                                    <span className="text-muted-foreground">× {item.qty}</span>
                                                </div>
                                                <span className="font-mono text-xs text-foreground">${((item.totalCents ?? 0) / 100).toFixed(2)}</span>
                                            </label>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="overflow-hidden rounded border border-border bg-card">
                                        <table className="w-full text-xs">
                                            <tbody>
                                                <TableEmpty>No line items available.</TableEmpty>
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="override-amount">Amount to refund/credit</Label>
                                <Input
                                    id="override-amount"
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    placeholder={`$${(computedAmount / 100).toFixed(2)}`}
                                    value={overrideAmount}
                                    onChange={(e) => setOverrideAmount(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Leave blank to use the sum of selected items (${(computedAmount / 100).toFixed(2)}).
                                </p>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="refund-note">Refund/exchange note</Label>
                                <Textarea
                                    id="refund-note"
                                    placeholder="Reason or reference (no processor call made)"
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    {error && (
                        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
                            Cancel
                        </Button>
                        <Button className="flex-1" onClick={handleSubmit} disabled={loading || !orders.length}>
                            {loading ? "Saving..." : type === "exchange" ? "Record exchange" : "Record refund"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function POSPage() {
    const [campgroundReady, setCampgroundReady] = useState(false);
    const [campgroundId, setCampgroundId] = useState<string | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [lastOrder, setLastOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [locations, setLocations] = useState<StoreLocation[]>([]);
    const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
    const [isOnline, setIsOnline] = useState(true);
    const [queuedOrders, setQueuedOrders] = useState<number>(0);
    const [conflicts, setConflicts] = useState<any[]>([]);
    const [ordersLoading, setOrdersLoading] = useState(false);
    const [recentOrders, setRecentOrders] = useState<any[]>([]);
    const [ordersError, setOrdersError] = useState<string | null>(null);
    const [isRefundOpen, setIsRefundOpen] = useState(false);
    const [selectedOrderForRefund, setSelectedOrderForRefund] = useState<string | null>(null);
    const [savingRefund, setSavingRefund] = useState(false);
    const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
    const [syncDrawerOpen, setSyncDrawerOpen] = useState(false);
    const [showSuccessCelebration, setShowSuccessCelebration] = useState(false);
    const [successOrderTotal, setSuccessOrderTotal] = useState(0);
    const [searchQuery, setSearchQuery] = useState("");
    const [showSearch, setShowSearch] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const { status: syncStatus } = useSyncStatus();

    // Voice commands for POS
    const voiceCommands = useVoiceCommands({
        commands: [
            {
                phrases: ["checkout", "pay now", "process payment"],
                action: () => {
                    if (cart.length > 0) {
                        haptic.success();
                        setIsCheckoutOpen(true);
                    }
                },
                description: "Checkout",
            },
            {
                phrases: ["clear cart", "empty cart", "start over"],
                action: () => {
                    haptic.medium();
                    clearCart();
                },
                description: "Clear Cart",
            },
        ],
    });

    const queueKey = "campreserv:pos:orderQueue";

    const loadQueue = () => loadQueueGeneric<any>(queueKey);

    const saveQueue = (items: any[]) => {
        saveQueueGeneric(queueKey, items);
        setQueuedOrders(items.length);
        setConflicts(items.filter((i) => i?.conflict));
    };

    const queueOrder = (payload: any) => {
        const item = {
            id: randomId(),
            campgroundId,
            payload,
            attempt: 0,
            nextAttemptAt: Date.now(),
            createdAt: new Date().toISOString(),
            idempotencyKey: randomId(),
        };
        const updated = [...loadQueue(), item];
        saveQueue(updated);
        void registerBackgroundSync();
    };

    const flushQueue = async () => {
        if (!navigator.onLine) return;
        const now = Date.now();
        const items = loadQueue();
        if (!items.length) return;
        const remaining: any[] = [];
        for (const item of items) {
            if (item.nextAttemptAt && item.nextAttemptAt > now) {
                remaining.push(item);
                continue;
            }
            try {
                const headers: Record<string, string> = item.idempotencyKey ? { "X-Idempotency-Key": item.idempotencyKey } : {};
                await posApi.createStoreOrder(item.campgroundId, item.payload, headers);
                recordTelemetry({ source: "pos", type: "sync", status: "success", message: "Queued order flushed", meta: { paymentMethod: item.payload.paymentMethod } });
            } catch (err: any) {
                const attempt = (item.attempt ?? 0) + 1;
                const delay = Math.min(300000, 1000 * 2 ** attempt) + Math.floor(Math.random() * 500);
                const isConflict = err?.status === 409 || err?.status === 412 || /conflict/i.test(err?.message ?? "");
                remaining.push({ ...item, attempt, nextAttemptAt: Date.now() + delay, lastError: err?.message, conflict: isConflict });
                recordTelemetry({
                    source: "pos",
                    type: isConflict ? "conflict" : "error",
                    status: isConflict ? "conflict" : "failed",
                    message: isConflict ? "Order conflict, needs review" : "Flush failed, retry scheduled",
                    meta: { error: err?.message },
                });
            }
        }
        saveQueue(remaining);
    };

    // Resolve campground selection on client to avoid SSR/CSR mismatch
    useEffect(() => {
        if (typeof window !== "undefined") {
            setCampgroundId(localStorage.getItem("campreserv:selectedCampground"));
        }
        setCampgroundReady(true);
    }, []);

    useEffect(() => {
        if (typeof window !== "undefined") {
            setIsOnline(navigator.onLine);
            const list = loadQueue();
            setQueuedOrders(list.length);
            setConflicts(list.filter((i) => i?.conflict));
            const handleOnline = () => {
                setIsOnline(true);
                void flushQueue();
            };
            const handleOffline = () => setIsOnline(false);
            window.addEventListener("online", handleOnline);
            window.addEventListener("offline", handleOffline);
            const handler = (event: MessageEvent) => {
                if (event.data?.type === "SYNC_QUEUES") {
                    void flushQueue();
                }
            };
            navigator.serviceWorker?.addEventListener("message", handler);
            return () => {
                window.removeEventListener("online", handleOnline);
                window.removeEventListener("offline", handleOffline);
                navigator.serviceWorker?.removeEventListener("message", handler);
            };
        }
    }, []);

    // Fetch locations when campground changes
    useEffect(() => {
        if (!campgroundId) return;
        posApi.getLocations(campgroundId).then((locs) => {
            setLocations(locs as StoreLocation[]);
            // Auto-select default location if none selected
            if (!selectedLocationId) {
                const defaultLoc = locs.find((l) => l.isDefault);
                if (defaultLoc) setSelectedLocationId(defaultLoc.id);
            }
        }).catch(() => setLocations([]));
    }, [campgroundId]);

    // Fetch products and categories when campground or location changes
    useEffect(() => {
        if (!campgroundId) return;
        setLoading(true);
        Promise.all([
            posApi.getProducts(campgroundId, selectedLocationId ?? undefined).catch(() => []),
            posApi.getProductCategories(campgroundId).catch(() => [])
        ]).then(([p, c]) => {
            setProducts(p as Product[]);
            setCategories(c as Category[]);
            setLoading(false);
        });
    }, [campgroundId, selectedLocationId]);

    const loadRecentOrders = async () => {
        if (!campgroundId) return;
        setOrdersLoading(true);
        setOrdersError(null);
        try {
            const data = await apiClient.getStoreOrders(campgroundId, { status: "completed" });
            setRecentOrders(Array.isArray(data) ? data.slice(0, 10) : []);
        } catch (err: any) {
            console.error(err);
            setOrdersError("Failed to load recent POS orders");
        } finally {
            setOrdersLoading(false);
        }
    };

    useEffect(() => {
        void loadRecentOrders();
    }, [campgroundId]);

    // Keyboard shortcuts for power users
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger if user is typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                // But allow Escape to close search
                if (e.key === "Escape" && showSearch) {
                    setShowSearch(false);
                    setSearchQuery("");
                }
                return;
            }

            // Cmd/Ctrl + K = Open search
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setShowSearch(true);
                setTimeout(() => searchInputRef.current?.focus(), 50);
            }

            // Cmd/Ctrl + Enter = Go to checkout (if cart has items)
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && cart.length > 0) {
                e.preventDefault();
                setIsCheckoutOpen(true);
            }

            // Escape = Close modals/search
            if (e.key === "Escape") {
                if (showSearch) {
                    setShowSearch(false);
                    setSearchQuery("");
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [cart.length, showSearch]);

    const retryConflict = (id: string) => {
        const items = loadQueue().map((i) => (i.id === id ? { ...i, conflict: false, nextAttemptAt: Date.now() } : i));
        saveQueue(items);
        void flushQueue();
    };

    const discardConflict = (id: string) => {
        const items = loadQueue().filter((i) => i.id !== id);
        saveQueue(items);
    };

    const addToCart = (product: Product) => {
        haptic.light();
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                // Mark as just added for animation, then clear after delay
                const updated = prev.map(item =>
                    item.id === product.id ? { ...item, qty: item.qty + 1, justAdded: true } : item
                );
                setTimeout(() => {
                    setCart(current => current.map(item =>
                        item.id === product.id ? { ...item, justAdded: false } : item
                    ));
                }, 600);
                return updated;
            }
            // New item - mark as just added
            setTimeout(() => {
                setCart(current => current.map(item =>
                    item.id === product.id ? { ...item, justAdded: false } : item
                ));
            }, 600);
            return [...prev, { ...product, qty: 1, justAdded: true }];
        });
    };

    const updateQty = (productId: string, delta: number) => {
        setCart(prev => {
            return prev.map(item => {
                if (item.id === productId) {
                    return { ...item, qty: Math.max(0, item.qty + delta) };
                }
                return item;
            }).filter(item => item.qty > 0);
        });
    };

    const clearCart = () => setCart([]);

    const handleCheckoutSuccess = (order: any) => {
        // Haptic success feedback
        haptic.success();

        // Calculate total for celebration
        const orderTotal = order?.totalCents ?? cart.reduce((sum, item) => sum + item.priceCents * item.qty, 0);
        setSuccessOrderTotal(orderTotal);
        setShowSuccessCelebration(true);

        // Auto-hide celebration after 2.5 seconds
        setTimeout(() => {
            setShowSuccessCelebration(false);
            setLastOrder(order);
        }, 2500);

        setCart([]);
        setIsCheckoutOpen(false);
        setIsCartDrawerOpen(false);
        recordTelemetry({ source: "pos", type: "sync", status: "success", message: "POS order completed", meta: { id: order?.id } });
        void loadRecentOrders();
    };

    const handleRefundSubmit = async (orderId: string, payload: OrderAdjustmentPayload) => {
        setSavingRefund(true);
        try {
            await apiClient.createStoreOrderAdjustment(orderId, payload, campgroundId ?? undefined);
            recordTelemetry({
                source: "pos",
                type: "sync",
                status: "success",
                message: "POS refund/exchange recorded",
                meta: { orderId, amount: payload.amountCents, kind: payload.type },
            });
            await loadRecentOrders();
            setIsRefundOpen(false);
            setSelectedOrderForRefund(null);
        } catch (err: any) {
            console.error(err);
            setOrdersError(err?.message || "Unable to record refund/exchange");
            throw err;
        } finally {
            setSavingRefund(false);
        }
    };

    // Filter by category and search query
    const filteredProducts = products.filter(p => {
        const matchesCategory = !selectedCategory || selectedCategory === "all" || p.categoryId === selectedCategory;
        const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const handleSelectCategory = (id: string) => {
        setSelectedCategory(id);
        const grid = document.getElementById("pos-product-grid");
        if (grid) {
            grid.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    const showContent = campgroundReady && campgroundId;

    if (lastOrder) {
        return (
            <DashboardShell>
                <ReceiptView order={lastOrder} onNewOrder={() => setLastOrder(null)} />
            </DashboardShell>
        );
    }

    const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);
    const totalCents = cart.reduce((sum, item) => sum + item.priceCents * item.qty, 0);

    return (
        <DashboardShell className="h-screen overflow-hidden flex flex-col">
            <div className="flex h-full gap-6 p-4 sm:p-6">
                <div className="flex-1 flex flex-col gap-4 sm:gap-6 min-w-0">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Point of Sale</h1>
                            {locations.length > 1 && (
                                <Select
                                    value={selectedLocationId || EMPTY_SELECT_VALUE}
                                    onValueChange={(value) => setSelectedLocationId(value === EMPTY_SELECT_VALUE ? null : value)}
                                >
                                    <SelectTrigger className="h-9 w-[200px] text-sm font-medium" aria-label="Location">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {locations.map((loc) => (
                                            <SelectItem key={loc.id} value={loc.id}>
                                                {loc.name}{loc.isDefault ? " (Default)" : ""}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            {locations.length === 1 && (
                                <Badge variant="secondary" className="text-xs">
                                    {locations[0].name}
                                </Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <SyncStatus
                                variant="badge"
                                showDetails={false}
                                onClick={() => setSyncDrawerOpen(true)}
                            />
                            <Button asChild size="sm" variant="outline" className="hidden md:flex">
                                <Link href="/pwa/sync-log">Sync log</Link>
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => flushQueue()} className="hidden md:flex">
                                Flush now
                            </Button>
                            <Button asChild size="sm" variant="outline" className="hidden lg:flex">
                                <Link href="/store" title="Manage products, categories, add-ons, taxes, hours, channel allotments">Manage inventory</Link>
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => {
                                    setSelectedOrderForRefund(recentOrders[0]?.id ?? null);
                                    setIsRefundOpen(true);
                                }}
                                disabled={ordersLoading}
                                className="hidden md:flex"
                            >
                                Refund / Exchange
                            </Button>
                            {/* Voice Command Indicator */}
                            <VoiceCommandIndicator
                                isListening={voiceCommands.isListening}
                                isSupported={voiceCommands.isSupported}
                                lastCommand={voiceCommands.lastCommand}
                                onToggle={voiceCommands.toggleListening}
                            />
                        </div>
                    </div>

                    {/* Quick Search Bar */}
                    <div className="relative">
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1 max-w-md">
                                <Input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder="Search products..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    aria-label="Search products"
                                    className="h-10 w-full pl-10 pr-10 text-sm"
                                />
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery("")}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        aria-label="Clear search"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                                <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px] font-mono">⌘K</kbd>
                                <span>search</span>
                                <span className="mx-1">·</span>
                                <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px] font-mono">⌘↵</kbd>
                                <span>checkout</span>
                            </div>
                        </div>
                    </div>

                    {conflicts.length > 0 && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 p-3 text-sm space-y-2">
                            <div className="font-semibold">Conflicts detected</div>
                            {conflicts.map((c) => (
                                <div key={c.id} className="flex items-center justify-between gap-2">
                                    <span className="truncate text-xs">Order {c.id.slice(0, 8)}…</span>
                                    <div className="flex items-center gap-2">
                                        <Button size="sm" variant="outline" onClick={() => retryConflict(c.id)}>
                                            Retry
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => discardConflict(c.id)}>
                                            Discard
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Low Stock Alerts */}
                    {(() => {
                        const lowStockProducts = products.filter(p => typeof p.stock === 'number' && p.stock > 0 && p.stock < 5);
                        const outOfStockProducts = products.filter(p => p.stock === 0);
                        if (lowStockProducts.length === 0 && outOfStockProducts.length === 0) return null;
                        return (
                            <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-900 p-3 text-sm space-y-2">
                                <div className="font-semibold flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4" />
                                    Inventory Alerts
                                </div>
                                {outOfStockProducts.length > 0 && (
                                    <div className="text-xs">
                                        <span className="font-medium">Out of stock:</span>{' '}
                                        {outOfStockProducts.slice(0, 3).map(p => p.name).join(', ')}
                                        {outOfStockProducts.length > 3 && ` +${outOfStockProducts.length - 3} more`}
                                    </div>
                                )}
                                {lowStockProducts.length > 0 && (
                                    <div className="text-xs">
                                        <span className="font-medium">Low stock:</span>{' '}
                                        {lowStockProducts.slice(0, 3).map(p => `${p.name} (${p.stock})`).join(', ')}
                                        {lowStockProducts.length > 3 && ` +${lowStockProducts.length - 3} more`}
                                    </div>
                                )}
                                <Link href="/store" className="text-xs text-rose-700 underline hover:text-rose-800">
                                    Manage inventory →
                                </Link>
                            </div>
                        );
                    })()}

                    {showContent ? (
                        <>
                            <CategoryTabs
                                categories={categories}
                                selected={selectedCategory}
                                onSelect={handleSelectCategory}
                            />

                            <div id="pos-product-grid" className="flex-1 overflow-y-auto min-h-0">
                                {loading ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
                                        {[...Array(8)].map((_, i) => (
                                            <div key={i} className="animate-pulse">
                                                <div className="aspect-square bg-muted rounded-lg mb-3" />
                                                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                                                <div className="h-3 bg-muted rounded w-1/2" />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <ProductGrid products={filteredProducts} onAdd={addToCart} />
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center text-muted-foreground">Please select a campground first.</div>
                        </div>
                    )}
                </div>

                {/* Desktop Cart Sidebar - hidden on mobile/tablet */}
                {showContent ? (
                    <div className="hidden xl:flex w-96 flex-shrink-0 flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden h-full">
                        <CartSidebar
                            cart={cart}
                            onUpdateQty={updateQty}
                            onClear={clearCart}
                            onCheckout={() => setIsCheckoutOpen(true)}
                        />
                    </div>
                ) : null}
            </div>

            {showContent && isCheckoutOpen && (
                <POSCheckoutFlow
                    isOpen={isCheckoutOpen}
                    onClose={() => setIsCheckoutOpen(false)}
                    cart={cart}
                    campgroundId={campgroundId}
                    locationId={selectedLocationId}
                    onSuccess={handleCheckoutSuccess}
                    onQueued={() => {
                        setIsCheckoutOpen(false);
                        setIsCartDrawerOpen(false);
                        setCart([]);
                    }}
                    isOnline={isOnline}
                    queueOrder={queueOrder}
                />
            )}

            {showContent && (
                <div className="hidden md:block border-t border-border bg-muted/40 px-6 pb-6">
                    <div className="flex items-center justify-between py-4">
                        <div>
                            <p className="text-sm font-semibold text-foreground">Recent POS orders</p>
                            <p className="text-xs text-muted-foreground">Click an order to process a refund or exchange.</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => void loadRecentOrders()} disabled={ordersLoading}>
                            Refresh
                        </Button>
                    </div>
                    {ordersError && <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{ordersError}</div>}
                    {ordersLoading ? (
                        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="animate-pulse rounded-lg border border-border bg-card p-4">
                                    <div className="flex items-start justify-between gap-2 mb-3">
                                        <div className="flex-1 space-y-2">
                                            <div className="h-4 bg-muted rounded w-32" />
                                            <div className="h-3 bg-muted rounded w-48" />
                                        </div>
                                        <div className="h-6 w-16 bg-muted rounded" />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="h-3 bg-muted rounded w-full" />
                                        <div className="h-3 bg-muted rounded w-5/6" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : recentOrders.length === 0 ? (
                        <div className="rounded-lg border-2 border-dashed border-border bg-muted p-8 text-center">
                            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                                <ShoppingBag className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <p className="text-sm font-medium text-foreground mb-1">No POS orders yet</p>
                            <p className="text-xs text-muted-foreground mb-4">Start selling by adding products to your cart</p>
                            {cart.length > 0 ? (
                                <Button size="sm" onClick={() => setIsCheckoutOpen(true)}>
                                    Checkout {cart.length} {cart.length === 1 ? 'item' : 'items'}
                                </Button>
                            ) : (
                                <Link href="/store">
                                    <Button size="sm" variant="outline">
                                        Manage inventory
                                    </Button>
                                </Link>
                            )}
                        </div>
                    ) : (
                        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                            {recentOrders.slice(0, 5).map((order) => (
                                <div key={order.id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <div className="text-sm font-semibold text-foreground">Order #{order.id.slice(0, 8)}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {order.createdAt ? new Date(order.createdAt).toLocaleString() : "recent"} • ${(order.totalCents / 100).toFixed(2)}
                                            </div>
                                            {order.siteNumber && <div className="text-xs text-muted-foreground">Site {order.siteNumber}</div>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-[11px] uppercase">{order.status}</Badge>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    setSelectedOrderForRefund(order.id);
                                                    setIsRefundOpen(true);
                                                }}
                                            >
                                                Refund/Exchange
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                                        {order.items?.slice(0, 3).map((item: any) => (
                                            <div key={item.id} className="flex justify-between">
                                                <span className="truncate">{item.name} × {item.qty}</span>
                                                <span className="font-mono">${((item.totalCents ?? 0) / 100).toFixed(2)}</span>
                                            </div>
                                        ))}
                                        {order.items?.length > 3 && <div className="text-[11px] text-muted-foreground">+{order.items.length - 3} more item(s)</div>}
                                    </div>
                                    <div className="mt-3 rounded-md border border-border bg-muted px-3 py-2">
                                        <div className="text-[11px] font-semibold text-foreground mb-1">History</div>
                                        {order.adjustments && order.adjustments.length > 0 ? (
                                            <div className="space-y-1">
                                                {order.adjustments.slice(0, 3).map((adj: any) => (
                                                    <div key={adj.id} className="flex items-center justify-between text-[11px]">
                                                        <span className="uppercase text-muted-foreground">{adj.type}</span>
                                                        <span className="font-mono text-foreground">${(adj.amountCents / 100).toFixed(2)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="overflow-hidden rounded border border-border bg-card">
                                                <table className="w-full text-xs">
                                                    <tbody>
                                                        <TableEmpty>No refunds or exchanges yet.</TableEmpty>
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <RefundExchangeDialog
                open={isRefundOpen}
                onClose={() => setIsRefundOpen(false)}
                orders={recentOrders}
                defaultOrderId={selectedOrderForRefund}
                onSubmit={handleRefundSubmit}
                loading={savingRefund}
            />

            {/* Mobile/Tablet Cart Drawer */}
            {showContent && (
                <CartDrawer
                    open={isCartDrawerOpen}
                    onOpenChange={setIsCartDrawerOpen}
                    cart={cart}
                    onUpdateQty={updateQty}
                    onClear={clearCart}
                    onCheckout={() => setIsCheckoutOpen(true)}
                />
            )}

            {/* Floating Cart Button - shown on mobile/tablet only */}
            {showContent && (
                <div className="xl:hidden">
                    <FloatingCartButton
                        itemCount={itemCount}
                        totalCents={totalCents}
                        onClick={() => setIsCartDrawerOpen(true)}
                    />
                </div>
            )}

            <SyncDetailsDrawer open={syncDrawerOpen} onOpenChange={setSyncDrawerOpen} />

            {/* Success Celebration Modal */}
            {showSuccessCelebration && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
                    <div className="bg-card rounded-2xl shadow-2xl p-8 text-center max-w-sm mx-4 motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-300">
                        {/* Success checkmark animation */}
                        <div className="relative mx-auto w-20 h-20 mb-4">
                            <div className="absolute inset-0 bg-emerald-100 rounded-full motion-safe:animate-ping opacity-75" />
                            <div className="relative flex items-center justify-center w-20 h-20 bg-emerald-500 rounded-full">
                                <Check className="w-10 h-10 text-white motion-safe:animate-in motion-safe:zoom-in motion-safe:duration-300 motion-safe:delay-150" />
                            </div>
                        </div>
                        <h2 className="text-2xl font-bold text-foreground mb-2">Order Complete!</h2>
                        <p className="text-3xl font-bold text-emerald-600 mb-1">
                            ${(successOrderTotal / 100).toFixed(2)}
                        </p>
                        <p className="text-muted-foreground text-sm">
                            Payment processed successfully
                        </p>
                        <div className="mt-4 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                            <Receipt className="w-4 h-4" />
                            Receipt ready
                        </div>
                    </div>
                </div>
            )}
        </DashboardShell>
    );
}
