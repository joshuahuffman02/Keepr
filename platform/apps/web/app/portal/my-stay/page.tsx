"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, MapPin, Users, Loader2, MessageCircle, CalendarDays, Clock, Flame, Sparkles, Trees, Mail, Package, Truck, Store, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { differenceInCalendarDays, format, formatDistanceToNow } from "date-fns";
import { GuestChatPanel } from "@/components/portal/GuestChatPanel";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { loadQueue as loadQueueGeneric, saveQueue as saveQueueGeneric, registerBackgroundSync } from "@/lib/offline-queue";
import { randomId } from "@/lib/random-id";
import { Label } from "@/components/ui/label";
import type { AddOn } from "@campreserv/shared";

// Define local types until we have shared types fully integrated
type GuestData = {
    id: string;
    primaryFirstName: string;
    primaryLastName: string;
    email: string;
    reservations: Array<{
        id: string;
        arrivalDate: string;
        departureDate: string;
        status: string;
        adults: number;
        children: number;
        campground: {
            name: string;
            slug: string;
            heroImageUrl: string | null;
            amenities: string[];
            checkInTime: string | null;
            checkOutTime: string | null;
        };
        site: {
            name: string;
            siteNumber: string;
            siteType: string;
        };
    }>;
};

type UpsellOption = {
    id: string;
    title: string;
    description: string;
    priceCents: number;
    type: "service" | "product" | "activity";
    windowLabel: string;
};

const buildUpsellsForStay = (
    reservation: GuestData["reservations"][0],
    addOns: AddOn[]
): UpsellOption[] => {
    const arrival = new Date(reservation.arrivalDate);
    const departure = new Date(reservation.departureDate);
    const nights = Math.max(1, differenceInCalendarDays(departure, arrival));
    const guestCount = Math.max(1, reservation.adults + reservation.children);

    return addOns
        .filter((addOn) => addOn.isActive ?? true)
        .map((addOn) => {
            const pricingType = addOn.pricingType ?? "flat";
            const multiplier =
                pricingType === "per_night"
                    ? nights
                    : pricingType === "per_person"
                        ? guestCount
                        : 1;
            const windowLabel =
                pricingType === "per_night"
                    ? `Per night - ${nights} night${nights === 1 ? "" : "s"}`
                    : pricingType === "per_person"
                        ? `Per person - ${guestCount} guest${guestCount === 1 ? "" : "s"}`
                        : "One-time fee";

            return {
                id: addOn.id,
                title: addOn.name,
                description: addOn.description || "Add to your stay.",
                priceCents: addOn.priceCents * multiplier,
                type: "service",
                windowLabel,
            };
        });
};

const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function MyStayPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [guest, setGuest] = useState<GuestData | null>(null);
    const [loading, setLoading] = useState(true);
    const [token, setToken] = useState<string | null>(null);
    const [events, setEvents] = useState<any[]>([]);
    const [eventsLoading, setEventsLoading] = useState(false);
    const [products, setProducts] = useState<any[]>([]);
    const [addOns, setAddOns] = useState<AddOn[]>([]);
    const [addOnsLoading, setAddOnsLoading] = useState(false);
    const [cart, setCart] = useState<Record<string, { name: string; priceCents: number; qty: number }>>({});
    const [orderLoading, setOrderLoading] = useState(false);
    const [queuedUpsells, setQueuedUpsells] = useState(0);
    const [deliveryMode, setDeliveryMode] = useState<"delivery" | "pickup">("delivery");
    const [orders, setOrders] = useState<any[]>([]);
    const [ordersLoading, setOrdersLoading] = useState(false);
    const [commsHistory, setCommsHistory] = useState<any[]>([]);
    const [commsLoading, setCommsLoading] = useState(false);

    useEffect(() => {
        const storedToken = localStorage.getItem("campreserv:guestToken");
        if (!storedToken) {
            router.push("/portal/login");
            return;
        }
        setToken(storedToken);

        const fetchGuest = async () => {
            try {
                const data = await apiClient.getGuestMe(storedToken);
                // @ts-ignore - zod schema might need adjustment for dates vs strings
                setGuest(data);
            } catch (err) {
                console.error(err);
                // If auth fails, clear token and redirect
                localStorage.removeItem("campreserv:guestToken");
                router.push("/portal/login");
            } finally {
                setLoading(false);
            }
        };

        fetchGuest();
    }, [router]);

    const now = new Date();
    const upcoming = (guest?.reservations ?? []).filter(
        (r) => new Date(r.departureDate) >= now
    ).sort((a, b) => new Date(a.arrivalDate).getTime() - new Date(b.arrivalDate).getTime());

    const past = (guest?.reservations ?? []).filter(
        (r) => new Date(r.departureDate) < now
    ).sort((a, b) => new Date(b.arrivalDate).getTime() - new Date(a.arrivalDate).getTime());

    const currentReservation = upcoming[0];
    const upsellQueueKey = currentReservation ? `campreserv:portal:upsells:${currentReservation.campground.slug}` : null;
    const targetedUpsells = useMemo(
        () => (currentReservation ? buildUpsellsForStay(currentReservation, addOns) : []),
        [currentReservation, addOns]
    );

    useEffect(() => {
        if (!upsellQueueKey) return;
        const existing = loadQueueGeneric<any>(upsellQueueKey);
        setQueuedUpsells(existing.length);
    }, [upsellQueueKey]);

    useEffect(() => {
        const loadEvents = async () => {
            if (!token || !currentReservation) return;
            setEventsLoading(true);
            try {
                const start = currentReservation.arrivalDate;
                const end = currentReservation.departureDate;
                const data = await apiClient.getPublicEvents(token, currentReservation.campground.slug, start, end);
                setEvents(data);
            } catch (err) {
                console.error("Failed to load events", err);
                setEvents([]);
            } finally {
                setEventsLoading(false);
            }
        };
        loadEvents();
    }, [token, currentReservation]);

    useEffect(() => {
        const loadProducts = async () => {
            if (!token || !currentReservation) return;
            try {
                const data = await apiClient.getPortalProducts(token, currentReservation.campground.slug);
                setProducts(data);
            } catch (err) {
                console.error("Failed to load products", err);
                setProducts([]);
            }
        };
        loadProducts();
    }, [token, currentReservation]);

    useEffect(() => {
        const loadAddOns = async () => {
            if (!token || !currentReservation) return;
            setAddOnsLoading(true);
            try {
                const data = await apiClient.getPortalAddOns(token, currentReservation.campground.slug);
                setAddOns(data);
            } catch (err) {
                console.error("Failed to load add-ons", err);
                setAddOns([]);
            } finally {
                setAddOnsLoading(false);
            }
        };
        loadAddOns();
    }, [token, currentReservation]);

    // Load orders for this reservation (stubbed data for now)
    useEffect(() => {
        const loadOrders = async () => {
            if (!token || !currentReservation) return;
            setOrdersLoading(true);
            try {
                // Stubbed orders data - in production this would call an API
                const storedOrders = localStorage.getItem(`campreserv:orders:${currentReservation.id}`);
                if (storedOrders) {
                    setOrders(JSON.parse(storedOrders));
                } else {
                    setOrders([]);
                }
            } catch (err) {
                console.error("Failed to load orders", err);
                setOrders([]);
            } finally {
                setOrdersLoading(false);
            }
        };
        loadOrders();
    }, [token, currentReservation]);

    // Load communications history (stubbed data for now)
    useEffect(() => {
        const loadComms = async () => {
            if (!token || !currentReservation) return;
            setCommsLoading(true);
            try {
                // Stubbed comms data - in production this would call apiClient.getGuestCommsHistory
                const now = new Date();
                const stubComms = [
                    {
                        id: "c1",
                        type: "email",
                        subject: "Reservation Confirmation",
                        preview: `Your reservation at ${currentReservation.campground.name} is confirmed!`,
                        sentAt: new Date(currentReservation.arrivalDate).toISOString(),
                        status: "delivered"
                    },
                    {
                        id: "c2",
                        type: "sms",
                        subject: "Check-in Reminder",
                        preview: `Reminder: You can check in starting at ${currentReservation.campground.checkInTime || "3:00 PM"} tomorrow`,
                        sentAt: new Date(new Date(currentReservation.arrivalDate).getTime() - 24 * 60 * 60 * 1000).toISOString(),
                        status: "delivered"
                    },
                    {
                        id: "c3",
                        type: "email",
                        subject: "Welcome to Your Stay",
                        preview: "Here's everything you need to know for your stay...",
                        sentAt: currentReservation.arrivalDate,
                        status: "delivered"
                    }
                ];
                setCommsHistory(stubComms);
            } catch (err) {
                console.error("Failed to load comms history", err);
                setCommsHistory([]);
            } finally {
                setCommsLoading(false);
            }
        };
        loadComms();
    }, [token, currentReservation]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!guest) return null;

    const cartItems = Object.entries(cart).map(([id, item]) => ({ id, ...item }));
    const cartTotalCents = cartItems.reduce((sum, item) => sum + item.priceCents * item.qty, 0);

    const updateCart = (id: string, name: string, priceCents: number, delta: number) => {
        setCart(prev => {
            const next = { ...prev };
            const existing = next[id];
            const newQty = (existing?.qty || 0) + delta;
            if (newQty <= 0) {
                delete next[id];
            } else {
                next[id] = { name, priceCents, qty: newQty };
            }
            return next;
        });
    };

    const handleQueueUpsell = (upsell: UpsellOption) => {
        if (!upsellQueueKey || !currentReservation) return;
        const payload = {
            id: randomId(),
            reservationId: currentReservation.id,
            campgroundSlug: currentReservation.campground.slug,
            upsellId: upsell.id,
            title: upsell.title,
            priceCents: upsell.priceCents,
            queuedAt: new Date().toISOString(),
        };
        const existing = loadQueueGeneric<any>(upsellQueueKey);
        const next = [...existing, payload];
        saveQueueGeneric(upsellQueueKey, next);
        setQueuedUpsells(next.length);
        void registerBackgroundSync();
        toast({
            title: "Added to stay",
            description: `${upsell.title} queued. We'll sync it to your reservation.`,
        });
    };

    const placeOrder = async () => {
        if (!token || !currentReservation || cartItems.length === 0) return;
        setOrderLoading(true);
        try {
            // Create order via API
            await apiClient.createPortalOrder(token, {
                reservationId: currentReservation.id,
                items: cartItems.map((item) => ({ productId: item.id, qty: item.qty }))
            });

            // Also save to localStorage for the Orders tab
            const newOrder = {
                id: randomId(),
                reservationId: currentReservation.id,
                items: cartItems.map(item => ({
                    productId: item.id,
                    name: item.name,
                    qty: item.qty,
                    priceCents: item.priceCents
                })),
                totalCents: cartTotalCents,
                deliveryMode,
                status: "pending",
                placedAt: new Date().toISOString()
            };
            const storageKey = `campreserv:orders:${currentReservation.id}`;
            const existingOrders = JSON.parse(localStorage.getItem(storageKey) || "[]");
            localStorage.setItem(storageKey, JSON.stringify([newOrder, ...existingOrders]));
            setOrders([newOrder, ...existingOrders]);

            setCart({});
            toast({
                title: "Order placed!",
                description: deliveryMode === "delivery"
                    ? `Your order will be delivered to Site ${currentReservation.site.siteNumber}`
                    : "Your order will be ready for pickup at the office",
            });
        } catch (err) {
            console.error("Order failed", err);
            toast({
                title: "Order failed",
                description: "Please try again or contact the office.",
                variant: "destructive",
            });
        } finally {
            setOrderLoading(false);
        }
    };

    return (
        <div className="container mx-auto px-4 py-6 space-y-6">
            {/* Page Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between"
            >
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Welcome back, {guest.primaryFirstName}</h1>
                    <p className="text-muted-foreground">Here's everything about your stay</p>
                </div>
            </motion.div>
                {!currentReservation ? (
                    <Card>
                        <CardContent className="py-10 text-center space-y-4">
                            <p className="text-muted-foreground">You don't have any upcoming reservations.</p>
                            <Button onClick={() => window.location.href = '/'}>Book a Stay</Button>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        {/* Hero Section */}
                        <div className="relative rounded-xl overflow-hidden h-48 md:h-64 bg-slate-900">
                            {currentReservation.campground.heroImageUrl && (
                                <img
                                    src={currentReservation.campground.heroImageUrl}
                                    alt={currentReservation.campground.name}
                                    className="w-full h-full object-cover opacity-60"
                                />
                            )}
                            <div className="absolute inset-0 flex flex-col justify-end p-6 text-white">
                                <Badge
                                    className={`w-fit mb-2 ${currentReservation.status === 'checked_in'
                                        ? 'bg-green-500 hover:bg-green-600'
                                        : 'bg-blue-500 hover:bg-blue-600'
                                        }`}
                                >
                                    {currentReservation.status === 'checked_in' ? 'Checked In' : 'Upcoming Stay'}
                                </Badge>
                                <h2 className="text-3xl font-bold">{currentReservation.campground.name}</h2>
                                <div className="flex items-center gap-2 mt-1 text-slate-200">
                                    <MapPin className="h-4 w-4" />
                                    <span>Site {currentReservation.site.siteNumber} ({currentReservation.site.name})</span>
                                </div>
                            </div>
                        </div>

                        {/* Tabs for Stay Details, Orders, Events, History, and Messages */}
                        <Tabs defaultValue="details" className="w-full">
                            <TabsList className="grid w-full max-w-2xl grid-cols-5">
                                <TabsTrigger value="details">
                                    <Calendar className="h-4 w-4 mr-1" />
                                    <span className="hidden sm:inline">Stay</span>
                                </TabsTrigger>
                                <TabsTrigger value="orders">
                                    <Package className="h-4 w-4 mr-1" />
                                    <span className="hidden sm:inline">Orders</span>
                                </TabsTrigger>
                                <TabsTrigger value="events">
                                    <CalendarDays className="h-4 w-4 mr-1" />
                                    <span className="hidden sm:inline">Events</span>
                                </TabsTrigger>
                                <TabsTrigger value="history">
                                    <Mail className="h-4 w-4 mr-1" />
                                    <span className="hidden sm:inline">History</span>
                                </TabsTrigger>
                                <TabsTrigger value="messages">
                                    <MessageCircle className="h-4 w-4 mr-1" />
                                    <span className="hidden sm:inline">Chat</span>
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="details" className="mt-6">
                                <div className="grid md:grid-cols-3 gap-6">
                                    {/* Main Info */}
                                    <div className="md:col-span-2 space-y-6">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle>Reservation Details</CardTitle>
                                            </CardHeader>
                                            <CardContent className="grid gap-6 sm:grid-cols-2">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                                        <Calendar className="h-4 w-4" />
                                                        <span className="text-sm font-medium">Dates</span>
                                                    </div>
                                                    <p className="font-semibold">
                                                        {format(new Date(currentReservation.arrivalDate), "MMM d")} -{" "}
                                                        {format(new Date(currentReservation.departureDate), "MMM d, yyyy")}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Check-in: {currentReservation.campground.checkInTime || "3:00 PM"}
                                                        <br />
                                                        Check-out: {currentReservation.campground.checkOutTime || "11:00 AM"}
                                                    </p>
                                                </div>

                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                                        <Users className="h-4 w-4" />
                                                        <span className="text-sm font-medium">Guests</span>
                                                    </div>
                                                    <p className="font-semibold">
                                                        {currentReservation.adults} Adults, {currentReservation.children} Children
                                                    </p>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardHeader>
                                                <CardTitle>Campground Amenities</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="flex flex-wrap gap-2">
                                                    {currentReservation.campground.amenities.map((amenity) => (
                                                        <Badge key={amenity} variant="secondary">
                                                            {amenity}
                                                        </Badge>
                                                    ))}
                                                    {currentReservation.campground.amenities.length === 0 && (
                                                        <p className="text-muted-foreground text-sm">No amenities listed.</p>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <Sparkles className="h-4 w-4 text-amber-500" />
                                                        <CardTitle>Suggested add-ons</CardTitle>
                                                    </div>
                                                    <CardDescription>
                                                        Based on your dates at {currentReservation.campground.name}
                                                    </CardDescription>
                                                </div>
                                                {queuedUpsells > 0 && (
                                                    <Badge variant="secondary">{queuedUpsells} queued</Badge>
                                                )}
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                {addOnsLoading ? (
                                                    <p className="text-sm text-muted-foreground">Loading add-ons...</p>
                                                ) : targetedUpsells.length === 0 ? (
                                                    <p className="text-sm text-muted-foreground">
                                                        No add-ons available right now.
                                                    </p>
                                                ) : (
                                                    <div className="grid gap-3 sm:grid-cols-2">
                                                        {targetedUpsells.map((upsell) => {
                                                            const typeLabel = upsell.type === "service"
                                                                ? "Service"
                                                                : upsell.type === "product"
                                                                    ? "Item"
                                                                    : "Activity";
                                                            const Icon = upsell.type === "service" ? Clock : upsell.type === "product" ? Flame : Trees;
                                                            return (
                                                                <div key={upsell.id} className="border rounded-lg p-3 bg-white/60 shadow-sm space-y-2">
                                                                    <div className="flex items-start justify-between gap-2">
                                                                        <div className="space-y-1">
                                                                            <div className="flex items-center gap-2">
                                                                                <Icon className="h-4 w-4 text-primary" />
                                                                                <span className="font-semibold leading-tight">{upsell.title}</span>
                                                                            </div>
                                                                            <p className="text-sm text-muted-foreground">{upsell.description}</p>
                                                                        </div>
                                                                        <Badge variant="outline">{typeLabel}</Badge>
                                                                    </div>
                                                                    <div className="flex items-center justify-between text-sm">
                                                                        <span className="font-semibold">{formatPrice(upsell.priceCents)}</span>
                                                                        <span className="text-muted-foreground">{upsell.windowLabel}</span>
                                                                    </div>
                                                                    <Button size="sm" variant="secondary" className="w-full" onClick={() => handleQueueUpsell(upsell)}>
                                                                        Add to stay
                                                                    </Button>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                                <p className="text-xs text-muted-foreground">
                                                    Add-ons are queued locally per campground and sync when connectivity is back.
                                                </p>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {/* Sidebar Actions */}
                                    <div className="space-y-6">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle>Order to Your Site</CardTitle>
                                                <CardDescription>Charge to your reservation</CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                                {products.length === 0 ? (
                                                    <p className="text-sm text-muted-foreground">No items available.</p>
                                                ) : (
                                                    <div className="space-y-2 max-h-64 overflow-auto">
                                                        {products.map((p) => (
                                                            <div key={p.id} className="flex items-center justify-between gap-2 border rounded px-2 py-2">
                                                                <div>
                                                                    <div className="text-sm font-medium">{p.name}</div>
                                                                    <div className="text-xs text-muted-foreground">${(p.priceCents / 100).toFixed(2)}</div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <Button size="icon" variant="outline" onClick={() => updateCart(p.id, p.name, p.priceCents, -1)}>-</Button>
                                                                    <span className="w-6 text-center text-sm">{cart[p.id]?.qty || 0}</span>
                                                                    <Button size="icon" variant="outline" onClick={() => updateCart(p.id, p.name, p.priceCents, 1)}>+</Button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                <Separator />
                                                {/* Delivery Mode Selector */}
                                                <div className="space-y-2">
                                                    <Label className="text-sm font-medium">Delivery Option</Label>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setDeliveryMode("delivery")}
                                                            className={`flex items-center justify-center gap-2 p-3 border rounded-lg transition-all ${deliveryMode === "delivery"
                                                                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                                                : "border-slate-200 hover:border-slate-300"
                                                                }`}
                                                        >
                                                            <Truck className="h-4 w-4" />
                                                            <span className="text-sm font-medium">Deliver</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setDeliveryMode("pickup")}
                                                            className={`flex items-center justify-center gap-2 p-3 border rounded-lg transition-all ${deliveryMode === "pickup"
                                                                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                                                : "border-slate-200 hover:border-slate-300"
                                                                }`}
                                                        >
                                                            <Store className="h-4 w-4" />
                                                            <span className="text-sm font-medium">Pickup</span>
                                                        </button>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                        {deliveryMode === "delivery"
                                                            ? `Delivered to Site ${currentReservation.site.siteNumber}`
                                                            : "Pick up at the camp office"}
                                                    </p>
                                                </div>
                                                <Separator />
                                                <div className="flex items-center justify-between text-sm">
                                                    <span>Cart Total</span>
                                                    <span className="font-semibold">${(cartTotalCents / 100).toFixed(2)}</span>
                                                </div>
                                                <Button className="w-full" onClick={placeOrder} disabled={cartItems.length === 0 || orderLoading}>
                                                    {orderLoading ? "Placing..." : (
                                                        <span className="flex items-center gap-2">
                                                            {deliveryMode === "delivery" ? <Truck className="h-4 w-4" /> : <Store className="h-4 w-4" />}
                                                            Place Order
                                                        </span>
                                                    )}
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="events" className="mt-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Events During Your Stay</CardTitle>
                                        <CardDescription>
                                            {eventsLoading ? "Loading events..." : events.length === 0 ? "No events scheduled for your dates." : null}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {eventsLoading ? (
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                <span>Loading...</span>
                                            </div>
                                        ) : events.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">Nothing scheduled during your stay. Check back later!</p>
                                        ) : (
                                            events.map((event) => (
                                                <div key={event.id} className="flex items-start gap-3 p-3 border rounded-lg">
                                                    <div className="p-2 rounded bg-emerald-50">
                                                        <Clock className="h-4 w-4 text-emerald-600" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-semibold">{event.title || "Event"}</span>
                                                            {event.category && <Badge variant="outline">{event.category}</Badge>}
                                                        </div>
                                                        <div className="text-sm text-muted-foreground">
                                                            {format(new Date(event.startTime), "EEE, MMM d • h:mm a")}
                                                            {event.endTime ? ` - ${format(new Date(event.endTime), "h:mm a")}` : ""}
                                                        </div>
                                                        {event.location && (
                                                            <div className="text-xs text-muted-foreground">Location: {event.location}</div>
                                                        )}
                                                        {event.description && (
                                                            <div className="text-sm text-slate-700">{event.description}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="orders" className="mt-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Your Orders</CardTitle>
                                        <CardDescription>
                                            {ordersLoading ? "Loading orders..." : orders.length === 0 ? "No orders placed yet." : `${orders.length} order(s)`}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {ordersLoading ? (
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                <span>Loading...</span>
                                            </div>
                                        ) : orders.length === 0 ? (
                                            <div className="text-center py-8 space-y-4">
                                                <Package className="h-12 w-12 mx-auto text-slate-300" />
                                                <p className="text-sm text-muted-foreground">No orders yet. Browse the store or add-ons in the Stay tab!</p>
                                            </div>
                                        ) : (
                                            orders.map((order) => (
                                                <div key={order.id} className="flex items-start gap-3 p-4 border rounded-lg bg-white">
                                                    <div className={`p-2 rounded ${order.status === "delivered" ? "bg-emerald-50" :
                                                        order.status === "preparing" ? "bg-amber-50" :
                                                            "bg-blue-50"
                                                        }`}>
                                                        {order.status === "delivered" ? (
                                                            <CheckCircle className="h-5 w-5 text-emerald-600" />
                                                        ) : order.status === "preparing" ? (
                                                            <RefreshCw className="h-5 w-5 text-amber-600 animate-spin" />
                                                        ) : order.deliveryMode === "pickup" ? (
                                                            <Store className="h-5 w-5 text-blue-600" />
                                                        ) : (
                                                            <Truck className="h-5 w-5 text-blue-600" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 space-y-1">
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-semibold">Order #{order.id.slice(-6)}</span>
                                                            <Badge variant={
                                                                order.status === "delivered" ? "default" :
                                                                    order.status === "preparing" ? "secondary" :
                                                                        "outline"
                                                            }>
                                                                {order.status === "delivered" ? "Delivered" :
                                                                    order.status === "preparing" ? "Preparing" :
                                                                        order.status === "ready" ? "Ready for Pickup" :
                                                                            "Pending"}
                                                            </Badge>
                                                        </div>
                                                        <div className="text-sm text-muted-foreground">
                                                            {order.items?.length || 0} item(s) • {formatPrice(order.totalCents || 0)}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                            {order.deliveryMode === "pickup" ? (
                                                                <><Store className="h-3 w-3" /> Pickup at office</>
                                                            ) : (
                                                                <><Truck className="h-3 w-3" /> Deliver to Site {currentReservation.site.siteNumber}</>
                                                            )}
                                                        </div>
                                                        {order.placedAt && (
                                                            <div className="text-xs text-muted-foreground">
                                                                Placed {formatDistanceToNow(new Date(order.placedAt), { addSuffix: true })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="history" className="mt-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Communication History</CardTitle>
                                        <CardDescription>
                                            Emails and texts we've sent you about this stay
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {commsLoading ? (
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                <span>Loading...</span>
                                            </div>
                                        ) : commsHistory.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">No communications yet.</p>
                                        ) : (
                                            <div className="space-y-3">
                                                {commsHistory.map((comm) => (
                                                    <div key={comm.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                                                        <div className={`p-2 rounded ${comm.type === "email" ? "bg-blue-50" : "bg-emerald-50"
                                                            }`}>
                                                            {comm.type === "email" ? (
                                                                <Mail className="h-4 w-4 text-blue-600" />
                                                            ) : (
                                                                <MessageCircle className="h-4 w-4 text-emerald-600" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 space-y-1 min-w-0">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="font-medium truncate">{comm.subject}</span>
                                                                <Badge variant="outline" className="text-xs shrink-0">
                                                                    {comm.status === "delivered" ? (
                                                                        <CheckCircle className="h-3 w-3 mr-1 text-emerald-500" />
                                                                    ) : comm.status === "failed" ? (
                                                                        <AlertCircle className="h-3 w-3 mr-1 text-red-500" />
                                                                    ) : null}
                                                                    {comm.status}
                                                                </Badge>
                                                            </div>
                                                            <p className="text-sm text-muted-foreground line-clamp-2">{comm.preview}</p>
                                                            <div className="text-xs text-muted-foreground">
                                                                {format(new Date(comm.sentAt), "MMM d, yyyy 'at' h:mm a")}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="messages" className="mt-6">
                                {token && (
                                    <GuestChatPanel
                                        reservationId={currentReservation.id}
                                        token={token}
                                    />
                                )}
                            </TabsContent>
                        </Tabs>
                    </>
                )}

                {/* Past Reservations */}
                {past.length > 0 && (
                    <div className="space-y-4 pt-8 border-t">
                        <h3 className="text-lg font-semibold">Past Stays</h3>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {past.map((reservation) => (
                                <Card key={reservation.id} className="opacity-75 hover:opacity-100 transition-opacity">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base">{reservation.campground.name}</CardTitle>
                                        <CardDescription>
                                            {format(new Date(reservation.arrivalDate), "MMM d, yyyy")}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-sm text-muted-foreground">
                                            <p>Site {reservation.site.siteNumber}</p>
                                            <p>{reservation.adults} Guests</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}
        </div>
    );
}
