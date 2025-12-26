"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { apiClient } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ProductGrid } from "@/components/pos/ProductGrid";
import { GuestCheckoutModal } from "@/components/portal/GuestCheckoutModal";
import { ShoppingCart, Trash2, Plus, Minus, Store } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { recordTelemetry } from "@/lib/sync-telemetry";
import { loadQueue as loadQueueGeneric, saveQueue as saveQueueGeneric, registerBackgroundSync } from "@/lib/offline-queue";
import { Button } from "@/components/ui/button";
import { randomId } from "@/lib/random-id";
import { SyncStatus } from "@/components/sync/SyncStatus";
import { SyncDetailsDrawer } from "@/components/sync/SyncDetailsDrawer";
import { useSyncStatus } from "@/contexts/SyncStatusContext";
import { GUEST_TOKEN_KEY, STATUS_VARIANTS } from "@/lib/portal-constants";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";
import { PortalLoadingState, EmptyState } from "@/components/portal/PortalLoadingState";
import { cn } from "@/lib/utils";

type GuestData = Awaited<ReturnType<typeof apiClient.getGuestMe>>;
type Product = Awaited<ReturnType<typeof apiClient.getProducts>>[0];

type CartItem = {
    id: string;
    name: string;
    priceCents: number;
    qty: number;
};

export default function PortalStorePage() {
    const router = useRouter();
    const { toast } = useToast();
    const [guest, setGuest] = useState<GuestData | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [isOnline, setIsOnline] = useState(true);
    const productsCacheKey = "campreserv:portalStoreProducts";
    const cartCacheKey = "campreserv:portalStoreCart";
    const orderQueueKey = "campreserv:portal:orderQueue";
    const [queuedOrders, setQueuedOrders] = useState(0);
    const [conflicts, setConflicts] = useState<any[]>([]);
    const [syncDrawerOpen, setSyncDrawerOpen] = useState(false);
    const { status: syncStatus } = useSyncStatus();

    useEffect(() => {
        if (typeof window !== "undefined") {
            setIsOnline(navigator.onLine);
            try {
                const raw = localStorage.getItem(orderQueueKey);
                const parsed = raw ? JSON.parse(raw) : [];
                const list = Array.isArray(parsed) ? parsed : [];
                setQueuedOrders(list.length);
                setConflicts(list.filter((i) => i?.conflict));
            } catch {
                setQueuedOrders(0);
            }
            const handleOnline = () => setIsOnline(true);
            const handleOffline = () => setIsOnline(false);
            window.addEventListener("online", handleOnline);
            window.addEventListener("offline", handleOffline);
            recordTelemetry({ source: "portal-store", type: "sync", status: navigator.onLine ? "success" : "pending", message: navigator.onLine ? "Online" : "Offline" });
            return () => {
                window.removeEventListener("online", handleOnline);
                window.removeEventListener("offline", handleOffline);
            };
        }
    }, []);

    // Load cached cart on mount
    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            const raw = localStorage.getItem(cartCacheKey);
            if (raw) setCart(JSON.parse(raw));
        } catch {
            // ignore
        }
    }, []);

    // Persist cart
    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            localStorage.setItem(cartCacheKey, JSON.stringify(cart));
            recordTelemetry({ source: "portal-store", type: "cache", status: "success", message: "Cart cached", meta: { items: cart.length } });
        } catch {
            // ignore
        }
    }, [cart]);

    const loadOrderQueue = () => loadQueueGeneric<any>(orderQueueKey);
    const saveOrderQueue = (items: any[]) => {
        saveQueueGeneric(orderQueueKey, items);
        setQueuedOrders(items.length);
        setConflicts(items.filter((i) => i?.conflict));
    };

    const queueOrder = (payload: any, campgroundId?: string) => {
        const item = {
            id: randomId(),
            payload,
            campgroundId,
            attempt: 0,
            nextAttemptAt: Date.now(),
            createdAt: new Date().toISOString(),
            lastError: null,
            idempotencyKey: randomId(),
            conflict: false,
        };
        const updated = [...loadOrderQueue(), item];
        saveOrderQueue(updated);
        void registerBackgroundSync();
    };

    const flushOrderQueue = async () => {
        if (!navigator.onLine) return;
        const now = Date.now();
        const items = loadOrderQueue();
        if (!items.length) return;
        const remaining: any[] = [];
        for (const item of items) {
            if (item.nextAttemptAt && item.nextAttemptAt > now) {
                remaining.push(item);
                continue;
            }
            try {
                await apiClient.createStoreOrder(item.campgroundId, item.payload);
                recordTelemetry({ source: "portal-store", type: "sync", status: "success", message: "Queued order flushed", meta: { paymentMethod: item.payload?.paymentMethod } });
            } catch (err: any) {
                const attempt = (item.attempt ?? 0) + 1;
                const delay = Math.min(300000, 1000 * 2 ** attempt) + Math.floor(Math.random() * 500);
                const isConflict = err?.status === 409 || err?.status === 412 || /conflict/i.test(err?.message ?? "");
                remaining.push({ ...item, attempt, nextAttemptAt: Date.now() + delay, lastError: err?.message, conflict: isConflict });
                recordTelemetry({
                    source: "portal-store",
                    type: isConflict ? "conflict" : "error",
                    status: isConflict ? "conflict" : "failed",
                    message: isConflict ? "Order conflict, needs review" : "Flush failed, retry scheduled",
                    meta: { error: err?.message },
                });
            }
        }
        saveOrderQueue(remaining);
    };

    useEffect(() => {
        const token = localStorage.getItem(GUEST_TOKEN_KEY);
        if (!token) {
            router.push("/portal/login");
            return;
        }

        const init = async () => {
            try {
                const guestData = await apiClient.getGuestMe(token);
                setGuest(guestData);

                // Find active reservation to get campground ID
                const activeRes = guestData.reservations.find(
                    (r) => r.status === "checked_in" || r.status === "confirmed"
                ) || guestData.reservations[0];

                if (activeRes) {
                    const productsData = await apiClient.getProducts(activeRes.campgroundId);
                    const activeProducts = productsData.filter(p => p.isActive !== false);
                    setProducts(activeProducts);
                    try {
                        localStorage.setItem(productsCacheKey, JSON.stringify(activeProducts));
                        recordTelemetry({ source: "portal-store", type: "cache", status: "success", message: "Products cached", meta: { count: activeProducts.length } });
                    } catch {
                        // ignore
                    }
                }
            } catch (err) {
                console.error(err);
                // If we have cached products, use them for offline browsing
                try {
                    const raw = localStorage.getItem(productsCacheKey);
                    if (raw) {
                        setProducts(JSON.parse(raw));
                        recordTelemetry({ source: "portal-store", type: "cache", status: "pending", message: "Loaded cached products (offline)" });
                    } else {
                        router.push("/portal/login");
                    }
                } catch {
                    router.push("/portal/login");
                }
            } finally {
                setLoading(false);
            }
        };

        init();
    }, [router]);

    useEffect(() => {
        if (isOnline) {
            void flushOrderQueue();
        }
    }, [isOnline]);

    useEffect(() => {
        const handler = (event: MessageEvent) => {
            if (event.data?.type === "SYNC_QUEUES") {
                void flushOrderQueue();
            }
        };
        navigator.serviceWorker?.addEventListener("message", handler);
        return () => navigator.serviceWorker?.removeEventListener("message", handler);
    }, []);

    const retryConflict = (id: string) => {
        const items = loadOrderQueue().map((i) => (i.id === id ? { ...i, conflict: false, nextAttemptAt: Date.now() } : i));
        saveOrderQueue(items);
        void flushOrderQueue();
    };

    const discardConflict = (id: string) => {
        const items = loadOrderQueue().filter((i) => i.id !== id);
        saveOrderQueue(items);
    };

    const addToCart = (product: Product) => {
        setCart((prev) => {
            const existing = prev.find((item) => item.id === product.id);
            if (existing) {
                return prev.map((item) =>
                    item.id === product.id ? { ...item, qty: item.qty + 1 } : item
                );
            }
            return [...prev, { id: product.id, name: product.name, priceCents: product.priceCents, qty: 1 }];
        });
        toast({
            title: "Added to cart",
            description: `${product.name} added to your cart.`,
        });
    };

    const updateQty = (id: string, delta: number) => {
        setCart((prev) => {
            return prev.map((item) => {
                if (item.id === id) {
                    return { ...item, qty: Math.max(0, item.qty + delta) };
                }
                return item;
            }).filter((item) => item.qty > 0);
        });
    };

    const clearCart = () => setCart([]);

    const totalCents = cart.reduce((sum, item) => sum + item.priceCents * item.qty, 0);
    const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);

    const openHour = Number(process.env.NEXT_PUBLIC_STORE_OPEN_HOUR ?? 8);
    const closeHour = Number(process.env.NEXT_PUBLIC_STORE_CLOSE_HOUR ?? 20);
    const isOpen = (() => {
        const now = new Date();
        const hour = now.getHours();
        return hour >= openHour && hour < closeHour;
    })();

    const filteredProducts = isOpen
        ? products
        : products.filter((p) => p.afterHoursAllowed);

    const handleCheckoutSuccess = (order: any) => {
        setIsCheckoutOpen(false);
        setIsCartOpen(false);
        clearCart();
        toast({
            title: "Order Placed!",
            description: `Order #${order.id.slice(0, 8)} has been placed successfully.`,
        });
    };

    if (loading) {
        return <PortalLoadingState variant="page" />;
    }

    if (!guest) return null;

    const activeRes = guest.reservations.find(
        (r) => r.status === "checked_in" || r.status === "confirmed"
    ) || guest.reservations[0];

    return (
        <div className="container mx-auto px-4 py-6 space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <PortalPageHeader
                    icon={<Store className="h-6 w-6 text-white" />}
                    title="Camp Store"
                    subtitle="Order to your site or pick up"
                    gradient="from-purple-500 to-pink-600"
                />
                <div className="flex items-center gap-2">
                    <SyncStatus
                        variant="badge"
                        showDetails={false}
                        onClick={() => setSyncDrawerOpen(true)}
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        className="relative min-h-[44px] min-w-[44px]"
                        onClick={() => setIsCartOpen(true)}
                        aria-label={`Shopping cart with ${totalItems} items`}
                    >
                        <ShoppingCart className="h-5 w-5" />
                        {totalItems > 0 && (
                            <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 rounded-full">
                                {totalItems}
                            </Badge>
                        )}
                    </Button>
                </div>
            </div>

            {conflicts.length > 0 && (
                <div className={cn(
                    "rounded-lg border p-3 text-sm space-y-2",
                    STATUS_VARIANTS.warning.bg,
                    STATUS_VARIANTS.warning.border,
                    STATUS_VARIANTS.warning.text
                )}>
                    <div className="font-semibold">Conflicts detected</div>
                    {conflicts.map((c) => (
                        <div key={c.id} className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs">Order {c.id.slice(0, 8)}…</span>
                            <div className="flex items-center gap-2">
                                <Button size="sm" variant="secondary" onClick={() => retryConflict(c.id)}>
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

            {!activeRes ? (
                    <div className="text-center py-10 text-muted-foreground">
                        <p>No active reservation found. You cannot place orders.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {!isOnline && (
                            <Alert>
                                <AlertTitle>Offline mode</AlertTitle>
                                <AlertDescription>
                                    Browsing cached items. Add to cart is available; checkout will resume when you&apos;re online.
                                </AlertDescription>
                            </Alert>
                        )}
                        {!isOpen && (
                            <Alert>
                                <AlertTitle>Store is closed</AlertTitle>
                                <AlertDescription>
                                    You can order selected after-hours items for pickup. Regular items are unavailable until the store opens.
                                </AlertDescription>
                            </Alert>
                        )}
                        <ProductGrid products={filteredProducts} onAdd={(product) => {
                            if (!isOpen && !product.afterHoursAllowed) return;
                            addToCart(product);
                        }} />
                    </div>
                )}

            {/* Cart Dialog (Mobile Friendly) */}
            <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
                <DialogContent className="sm:max-w-[400px] h-[80vh] flex flex-col p-0 gap-0">
                    <DialogHeader className="p-4 border-b">
                        <DialogTitle>Your Cart</DialogTitle>
                        <DialogDescription>
                            {totalItems} items • ${(totalCents / 100).toFixed(2)}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-2">
                                <ShoppingCart className="h-12 w-12 opacity-20" />
                                <p>Your cart is empty</p>
                                <Button variant="ghost" onClick={() => setIsCartOpen(false)}>
                                    Start Shopping
                                </Button>
                            </div>
                        ) : (
                            cart.map((item) => (
                                <div key={item.id} className="flex items-center justify-between bg-card p-3 rounded-lg border border-border shadow-sm">
                                    <div className="flex-1">
                                        <p className="font-medium text-foreground">{item.name}</p>
                                        <p className="text-sm text-muted-foreground">${(item.priceCents / 100).toFixed(2)}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-9 w-9"
                                            onClick={() => updateQty(item.id, -1)}
                                            aria-label={item.qty === 1 ? `Remove ${item.name} from cart` : `Decrease ${item.name} quantity`}
                                        >
                                            {item.qty === 1 ? <Trash2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                                        </Button>
                                        <span className="w-6 text-center text-sm font-medium text-foreground">{item.qty}</span>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-9 w-9"
                                            onClick={() => updateQty(item.id, 1)}
                                            aria-label={`Increase ${item.name} quantity`}
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="p-4 border-t border-border bg-muted/50">
                        <div className="flex justify-between items-center mb-4">
                            <span className="font-semibold">Total</span>
                            <span className="font-bold text-lg">${(totalCents / 100).toFixed(2)}</span>
                        </div>
                        <Button
                            className="w-full"
                            size="lg"
                            disabled={cart.length === 0}
                            onClick={() => setIsCheckoutOpen(true)}
                        >
                            {isOnline ? "Checkout" : "Queue order"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Checkout Modal */}
            {activeRes && (
                <GuestCheckoutModal
                    isOpen={isCheckoutOpen}
                    onClose={() => setIsCheckoutOpen(false)}
                    cart={cart}
                    campgroundId={activeRes.campgroundId}
                    guest={guest}
                    onSuccess={handleCheckoutSuccess}
                    isOnline={isOnline}
                    queueOrder={(payload) => queueOrder(payload, activeRes.campgroundId)}
                    onQueued={() => {
                        setIsCheckoutOpen(false);
                        setCart([]);
                        toast({ title: "Order saved offline", description: "We’ll submit it when you’re back online." });
                    }}
                />
            )}

            <SyncDetailsDrawer open={syncDrawerOpen} onOpenChange={setSyncDrawerOpen} />
        </div>
    );
}
