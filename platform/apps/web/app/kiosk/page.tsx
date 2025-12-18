"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import { recordTelemetry } from "@/lib/sync-telemetry";
import { loadQueue as loadQueueGeneric, saveQueue as saveQueueGeneric, registerBackgroundSync } from "@/lib/offline-queue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookingMap } from "@/components/maps/BookingMap";
import { Loader2, Search, CheckCircle, MapPin, Calendar, User, CreditCard, Home, RefreshCw, Flame, Snowflake, Plus, Minus, ShoppingBag, Tent, ArrowRight, Grid3X3, Zap, Droplet, Waves } from "lucide-react";
import Link from "next/link";
import { format, parseISO, addDays } from "date-fns";
import { randomId } from "@/lib/random-id";

type Reservation = {
    id: string;
    arrivalDate: string;
    departureDate: string;
    status: string;
    adults: number;
    children: number;
    totalAmount: number;
    paidAmount: number;
    site?: { id: string; name: string; siteNumber: string } | null;
    guest?: { primaryFirstName: string; primaryLastName: string; email: string } | null;
};

type Site = {
    id: string;
    name: string;
    siteNumber: string;
    siteType: string;
    hookupsPower?: boolean;
    hookupsWater?: boolean;
    hookupsSewer?: boolean;
    powerAmps?: number;
    petFriendly?: boolean;
    accessible?: boolean;
    siteClass: {
        name: string;
        defaultRate: number;
    } | null;
};

type SiteFilters = {
    siteType: string | null;
    hookups: ("power" | "water" | "sewer")[];
};

type KioskState = "home" | "lookup" | "details" | "upsell" | "payment" | "success" | "walkin-nights" | "walkin-sites" | "walkin-guest";

const INACTIVITY_TIMEOUT = 60000; // 60 seconds
const CAMPGROUND_SLUG = "camp-everyday-riverbend";

export default function KioskPage() {
    const [state, setState] = useState<KioskState>("home");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Lookup form
    const [confirmationCode, setConfirmationCode] = useState("");

    // Walk-in form
    const [nights, setNights] = useState(1);
    const [showCustomNights, setShowCustomNights] = useState(false);
    const [availableSites, setAvailableSites] = useState<Site[]>([]);
    const [selectedSite, setSelectedSite] = useState<Site | null>(null);
    const [siteFilters, setSiteFilters] = useState<SiteFilters>({ siteType: null, hookups: [] });
    const [campgroundCenter, setCampgroundCenter] = useState<{ latitude: number | null; longitude: number | null }>({
        latitude: null,
        longitude: null
    });
    const [isOnline, setIsOnline] = useState(true);
    const [queuedCheckins, setQueuedCheckins] = useState(0);
    const [queuedCheckinPending, setQueuedCheckinPending] = useState(false);
    const [conflicts, setConflicts] = useState<any[]>([]);
    const queueKey = "campreserv:kiosk:checkinQueue";
    const loadQueue = () => loadQueueGeneric<any>(queueKey);
    const saveQueue = (items: any[]) => {
        saveQueueGeneric(queueKey, items);
        setQueuedCheckins(items.length);
        setConflicts(items.filter((i) => i?.conflict));
    };
    const queueCheckIn = (payload: { reservationId: string; upsellTotal: number }) => {
        const item = {
            ...payload,
            id: randomId(),
            attempt: 0,
            nextAttemptAt: Date.now(),
            createdAt: new Date().toISOString(),
            lastError: null,
            idempotencyKey: randomId(),
            conflict: false,
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
                await apiClient.kioskCheckIn(item.reservationId, item.upsellTotal);
                recordTelemetry({ source: "kiosk", type: "sync", status: "success", message: "Queued check-in flushed", meta: { reservationId: item.reservationId } });
                setQueuedCheckinPending(false);
            } catch (err: any) {
                const attempt = (item.attempt ?? 0) + 1;
                const delay = Math.min(300000, 1000 * 2 ** attempt) + Math.floor(Math.random() * 500);
                const isConflict = err?.status === 409 || err?.status === 412 || /conflict/i.test(err?.message ?? "");
                remaining.push({ ...item, attempt, nextAttemptAt: Date.now() + delay, lastError: err?.message, conflict: isConflict });
                recordTelemetry({
                    source: "kiosk",
                    type: isConflict ? "conflict" : "error",
                    status: isConflict ? "conflict" : "failed",
                    message: isConflict ? "Check-in conflict, needs review" : "Flush failed, retry scheduled",
                    meta: { error: err?.message },
                });
            }
        }
        saveQueue(remaining);
    };

    const retryConflict = (id: string) => {
        const items = loadQueue().map((i) => (i.id === id ? { ...i, conflict: false, nextAttemptAt: Date.now() } : i));
        saveQueue(items);
        void flushQueue();
    };

    const discardConflict = (id: string) => {
        const items = loadQueue().filter((i) => i.id !== id);
        saveQueue(items);
    };
    const [guestInfo, setGuestInfo] = useState({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        plate: "",
        zipCode: ""
    });

    // Payment form
    const [cardDetails, setCardDetails] = useState({
        number: "",
        expiry: "",
        cvc: "",
        zip: ""
    });

    // Reservation data
    const [reservation, setReservation] = useState<Reservation | null>(null);

    const mapSites = availableSites.map((site, idx) => ({
        id: site.id,
        name: site.name,
        siteNumber: site.siteNumber,
        status: "available" as const,
        latitude: Number.isFinite(campgroundCenter.latitude) ? (campgroundCenter.latitude as number) + 0.0004 * Math.sin(idx) : null,
        longitude: Number.isFinite(campgroundCenter.longitude) ? (campgroundCenter.longitude as number) + 0.0004 * Math.cos(idx) : null
    }));

    // Upsell data
    const [firewoodQty, setFirewoodQty] = useState(0);
    const [iceQty, setIceQty] = useState(0);

    // Inactivity timer
    const [lastActivity, setLastActivity] = useState(Date.now());

    // Reset to home screen
    const resetKiosk = useCallback(() => {
        setState("home");
        setConfirmationCode("");
        setReservation(null);
        setFirewoodQty(0);
        setIceQty(0);
        setNights(1);
        setShowCustomNights(false);
        setAvailableSites([]);
        setSelectedSite(null);
        setGuestInfo({ firstName: "", lastName: "", email: "", phone: "", plate: "", zipCode: "" });
        setCardDetails({ number: "", expiry: "", cvc: "", zip: "" });
        setError(null);
        setLoading(false);
        setLastActivity(Date.now());
        setQueuedCheckinPending(false);
    }, []);

    // Track user activity
    const handleActivity = useCallback(() => {
        setLastActivity(Date.now());
    }, []);

    // Auto-reset after inactivity
    useEffect(() => {
        if (state === "home") return;

        const interval = setInterval(() => {
            if (Date.now() - lastActivity > INACTIVITY_TIMEOUT) {
                resetKiosk();
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [state, lastActivity, resetKiosk]);

    // Add activity listeners
    useEffect(() => {
        window.addEventListener("mousemove", handleActivity);
        window.addEventListener("touchstart", handleActivity);
        window.addEventListener("keydown", handleActivity);

        return () => {
            window.removeEventListener("mousemove", handleActivity);
            window.removeEventListener("touchstart", handleActivity);
            window.removeEventListener("keydown", handleActivity);
        };
    }, [handleActivity]);

    // Online/offline tracking + flush queued check-ins
    useEffect(() => {
        if (typeof window === "undefined") return;
        setIsOnline(navigator.onLine);
        const list = loadQueue();
        setQueuedCheckins(list.length);
        setConflicts(list.filter((i) => i?.conflict));
        const handleOnline = () => {
            setIsOnline(true);
            recordTelemetry({ source: "kiosk", type: "sync", status: "success", message: "Back online" });
            void flushQueue();
        };
        const handleOffline = () => {
            setIsOnline(false);
            recordTelemetry({ source: "kiosk", type: "cache", status: "pending", message: "Offline" });
        };
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
    }, []);

    // Fetch campground center for map positioning
    useEffect(() => {
        apiClient.getPublicCampground(CAMPGROUND_SLUG)
            .then(cg => setCampgroundCenter({
                latitude: cg?.latitude ? Number(cg.latitude) : null,
                longitude: cg?.longitude ? Number(cg.longitude) : null
            }))
            .catch(() => { /* non-blocking */ });
    }, []);

    // Lookup reservation
    const handleLookup = async () => {
        setLoading(true);
        setError(null);
        handleActivity();

        try {
            let found: Reservation | null = null;

            if (confirmationCode) {
                try {
                    const res = await apiClient.getReservation(confirmationCode.trim());
                    found = res as Reservation;
                } catch {
                    // Not found by ID
                }
            }

            if (!found) {
                setError("Reservation not found. Please check your confirmation code and try again.");
                setLoading(false);
                return;
            }

            if (found.status === "checked_in") {
                setError("This reservation has already been checked in.");
                setLoading(false);
                return;
            }

            setReservation(found);
            setState("details");
        } catch (err) {
            console.error(err);
            setError("An error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // Walk-in: Search Sites
    const handleSearchSites = async (selectedNights: number) => {
        setNights(selectedNights);
        setLoading(true);
        setError(null);
        handleActivity();

        const arrival = new Date();
        const departure = addDays(arrival, selectedNights);

        try {
            const sites = await apiClient.getPublicAvailability(CAMPGROUND_SLUG, {
                arrivalDate: format(arrival, "yyyy-MM-dd"),
                departureDate: format(departure, "yyyy-MM-dd")
            });
            setAvailableSites(sites as unknown as Site[]);
            setState("walkin-sites");
        } catch (err) {
            console.error(err);
            setError("Failed to load available sites.");
        } finally {
            setLoading(false);
        }
    };

    // Walk-in: Create Reservation & Check In
    const handleWalkInSubmit = async () => {
        if (!selectedSite) return;
        setLoading(true);
        handleActivity();

        const arrival = new Date();
        const departure = addDays(arrival, nights);

        try {
            // Validate required fields
            const zipCode = guestInfo.zipCode?.trim() || "";
            if (zipCode.length < 5 || zipCode.length > 10) {
                setError("Please enter a valid zip code (5 digits).");
                setLoading(false);
                return;
            }

            // 1. Create Reservation
            const newRes = await apiClient.createPublicReservation({
                campgroundSlug: CAMPGROUND_SLUG,
                siteId: selectedSite.id,
                arrivalDate: format(arrival, "yyyy-MM-dd"),
                departureDate: format(departure, "yyyy-MM-dd"),
                adults: 2, // Default
                children: 0,
                guest: {
                    firstName: guestInfo.firstName,
                    lastName: guestInfo.lastName,
                    email: guestInfo.email,
                    phone: guestInfo.phone,
                    zipCode: zipCode
                },
                equipment: {
                    type: "car",
                    plateNumber: guestInfo.plate
                }
            });

            // 2. Set as current reservation
            setReservation(newRes as unknown as Reservation);

            // 3. Go to Upsell (then Payment)
            setState("upsell");
        } catch (err) {
            console.error(err);
            setError("Failed to create reservation. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // Complete check-in (Used for both Lookup and Walk-in)
    const handleCheckIn = async () => {
        if (!reservation) return;
        setLoading(true);
        handleActivity();

        const upsellTotal = (firewoodQty * 1000) + (iceQty * 500); // Cents

        try {
            if (!navigator.onLine) {
                queueCheckIn({ reservationId: reservation.id, upsellTotal });
                setQueuedCheckinPending(true);
                setState("success");
                recordTelemetry({ source: "kiosk", type: "queue", status: "pending", message: "Check-in queued offline", meta: { reservationId: reservation.id, upsellTotal } });
                return;
            }
            await apiClient.kioskCheckIn(reservation.id, upsellTotal);
            recordTelemetry({ source: "kiosk", type: "sync", status: "success", message: "Check-in completed", meta: { reservationId: reservation.id } });
            setState("success");
        } catch (err) {
            console.error(err);
            setError("Failed to complete check-in. Please see front desk for assistance.");
            recordTelemetry({ source: "kiosk", type: "error", status: "failed", message: "Check-in failed", meta: { error: (err as any)?.message } });
        } finally {
            setLoading(false);
        }
    };

    const balanceDue = reservation ? reservation.totalAmount - reservation.paidAmount : 0;
    const upsellTotal = (firewoodQty * 1000) + (iceQty * 500);
    const totalDue = balanceDue + upsellTotal;
    const isWalkIn = state === "payment" && !reservation?.guest?.email; // Heuristic or check state history

    return (
        <div
            className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-emerald-900 flex items-center justify-center p-8"
            onClick={handleActivity}
        >
            {/* Home Screen */}
            {state === "home" && (
                <Card className="w-full max-w-4xl shadow-2xl bg-white/95 backdrop-blur">
                    <CardContent className="p-16 text-center space-y-12">
                        <div>
                            <h1 className="text-6xl font-bold text-green-900 mb-4">Welcome to Camp Everyday</h1>
                            <p className="text-2xl text-green-700">Please select an option to begin</p>
                        </div>

                        <div className="grid grid-cols-2 gap-8">
                            <Button
                                className="h-64 text-2xl flex flex-col gap-6 bg-green-600 hover:bg-green-700 shadow-xl transition-all hover:scale-105"
                                onClick={() => setState("lookup")}
                            >
                                <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center">
                                    <Search className="w-12 h-12" />
                                </div>
                                I have a reservation
                            </Button>

                            <Button
                                className="h-64 text-2xl flex flex-col gap-6 bg-blue-600 hover:bg-blue-700 shadow-xl transition-all hover:scale-105"
                                onClick={() => setState("walkin-nights")}
                            >
                                <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center">
                                    <Tent className="w-12 h-12" />
                                </div>
                                I need a site (Walk-in)
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Lookup Screen */}
            {state === "lookup" && (
                <Card className="w-full max-w-2xl shadow-2xl">
                    <CardHeader className="text-center pb-8 pt-12">
                        <CardTitle className="text-4xl font-bold text-gray-900">Find Reservation</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-8 px-12 pb-12">
                        <div className="space-y-4">
                            <label className="block text-lg font-medium text-gray-700">
                                Confirmation Code
                            </label>
                            <Input
                                type="text"
                                placeholder="Enter your confirmation code"
                                value={confirmationCode}
                                onChange={(e) => setConfirmationCode(e.target.value)}
                                className="h-16 text-xl px-6"
                            />
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg text-center">
                                {error}
                            </div>
                        )}

                        <div className="flex gap-4">
                            <Button variant="outline" onClick={() => setState("home")} className="h-16 px-8 text-xl">
                                Back
                            </Button>
                            <Button
                                onClick={handleLookup}
                                disabled={loading || !confirmationCode}
                                className="flex-1 h-16 text-xl bg-green-600 hover:bg-green-700"
                            >
                                {loading ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <Search className="w-6 h-6 mr-2" />}
                                Find My Reservation
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Walk-in: Nights Selection */}
            {state === "walkin-nights" && (
                <Card className="w-full max-w-3xl shadow-2xl">
                    <CardHeader className="text-center pb-8 pt-12">
                        <CardTitle className="text-4xl font-bold text-gray-900">How long are you staying?</CardTitle>
                        <CardDescription className="text-xl">Checking in for tonight, {format(new Date(), "MMM d")}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8 px-12 pb-12">
                        {!showCustomNights ? (
                            <div className="grid grid-cols-2 gap-6">
                                {[1, 2, 3].map((n) => (
                                    <Button
                                        key={n}
                                        variant="outline"
                                        className="h-40 flex flex-col gap-4 text-xl hover:border-green-500 hover:bg-green-50"
                                        onClick={() => handleSearchSites(n)}
                                    >
                                        <span className="text-6xl font-bold text-green-600">{n}</span>
                                        Night{n > 1 ? "s" : ""}
                                    </Button>
                                ))}
                                <Button
                                    variant="outline"
                                    className="h-40 flex flex-col gap-4 text-xl hover:border-blue-500 hover:bg-blue-50"
                                    onClick={() => { setShowCustomNights(true); setNights(4); }}
                                >
                                    <Grid3X3 className="w-12 h-12 text-blue-600" />
                                    Custom
                                </Button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-8 py-8">
                                <div className="flex items-center gap-6">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-20 w-20 rounded-full"
                                        onClick={() => setNights(Math.max(1, nights - 1))}
                                    >
                                        <Minus className="w-8 h-8" />
                                    </Button>
                                    <div className="text-center">
                                        <span className="text-8xl font-bold text-green-600">{nights}</span>
                                        <p className="text-xl text-gray-500 mt-2">Nights</p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-20 w-20 rounded-full"
                                        onClick={() => setNights(Math.min(30, nights + 1))}
                                    >
                                        <Plus className="w-8 h-8" />
                                    </Button>
                                </div>
                                <Button
                                    className="w-full h-16 text-xl bg-green-600 hover:bg-green-700"
                                    onClick={() => handleSearchSites(nights)}
                                >
                                    Check Availability
                                </Button>
                            </div>
                        )}
                        <Button variant="ghost" onClick={() => showCustomNights ? setShowCustomNights(false) : setState("home")} className="w-full h-12 text-lg">
                            {showCustomNights ? "Back to Options" : "Cancel"}
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Walk-in: Site Selection */}
            {state === "walkin-sites" && (() => {
                // Filter sites based on selected filters
                const filteredSites = availableSites.filter((site) => {
                    if (siteFilters.siteType && site.siteType !== siteFilters.siteType) return false;
                    if (siteFilters.hookups.includes("power") && !site.hookupsPower) return false;
                    if (siteFilters.hookups.includes("water") && !site.hookupsWater) return false;
                    if (siteFilters.hookups.includes("sewer") && !site.hookupsSewer) return false;
                    return true;
                });

                const siteTypes = [...new Set(availableSites.map((s) => s.siteType))];
                const hasHookupSites = availableSites.some((s) => s.hookupsPower || s.hookupsWater || s.hookupsSewer);

                const toggleHookup = (hookup: "power" | "water" | "sewer") => {
                    setSiteFilters((prev) => ({
                        ...prev,
                        hookups: prev.hookups.includes(hookup)
                            ? prev.hookups.filter((h) => h !== hookup)
                            : [...prev.hookups, hookup]
                    }));
                };

                return (
                <Card className="w-full max-w-5xl shadow-2xl h-[80vh] flex flex-col">
                    <CardHeader className="text-center pb-4 pt-8">
                        <CardTitle className="text-3xl font-bold text-gray-900">Select a Site</CardTitle>
                        <CardDescription className="text-lg">
                            Available for {nights} night{nights > 1 ? "s" : ""} starting tonight
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto px-8 pb-8">
                        {/* Filters */}
                        {!loading && availableSites.length > 0 && (
                            <div className="mb-6 space-y-3">
                                {/* Site Type Filter */}
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        variant={siteFilters.siteType === null ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setSiteFilters((prev) => ({ ...prev, siteType: null }))}
                                        className="h-10 px-4"
                                    >
                                        All Types
                                    </Button>
                                    {siteTypes.map((type) => (
                                        <Button
                                            key={type}
                                            variant={siteFilters.siteType === type ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setSiteFilters((prev) => ({ ...prev, siteType: type }))}
                                            className="h-10 px-4 capitalize"
                                        >
                                            {type === "rv" ? "RV" : type}
                                        </Button>
                                    ))}
                                </div>

                                {/* Hookups Filter */}
                                {hasHookupSites && (
                                    <div className="flex flex-wrap gap-2">
                                        <span className="text-sm text-gray-500 flex items-center mr-2">Hookups:</span>
                                        <Button
                                            variant={siteFilters.hookups.includes("power") ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => toggleHookup("power")}
                                            className="h-10 px-4"
                                        >
                                            <Zap className="h-4 w-4 mr-1" /> Electric
                                        </Button>
                                        <Button
                                            variant={siteFilters.hookups.includes("water") ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => toggleHookup("water")}
                                            className="h-10 px-4"
                                        >
                                            <Droplet className="h-4 w-4 mr-1" /> Water
                                        </Button>
                                        <Button
                                            variant={siteFilters.hookups.includes("sewer") ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => toggleHookup("sewer")}
                                            className="h-10 px-4"
                                        >
                                            <Waves className="h-4 w-4 mr-1" /> Sewer
                                        </Button>
                                    </div>
                                )}

                                {/* Results count */}
                                <p className="text-sm text-gray-500">
                                    Showing {filteredSites.length} of {availableSites.length} sites
                                </p>
                            </div>
                        )}

                        {loading ? (
                            <div className="flex justify-center items-center h-64">
                                <Loader2 className="w-12 h-12 animate-spin text-green-600" />
                            </div>
                        ) : filteredSites.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-2xl text-gray-500">
                                    {availableSites.length === 0
                                        ? "No sites available for these dates."
                                        : "No sites match your filters."}
                                </p>
                                <Button
                                    onClick={() => availableSites.length === 0
                                        ? setState("walkin-nights")
                                        : setSiteFilters({ siteType: null, hookups: [] })}
                                    className="mt-6"
                                >
                                    {availableSites.length === 0 ? "Try different dates" : "Clear filters"}
                                </Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {filteredSites.map((site) => (
                                            <div
                                                key={site.id}
                                                onClick={() => { setSelectedSite(site); setState("walkin-guest"); }}
                                                className="border-2 border-gray-200 rounded-xl p-6 cursor-pointer hover:border-green-500 hover:bg-green-50 transition-all"
                                            >
                                                <div className="flex justify-between items-start mb-4">
                                                    <span className="text-2xl font-bold text-gray-900">{site.name}</span>
                                                    <Badge>{site.siteType}</Badge>
                                                </div>
                                                <div className="space-y-2 text-gray-600">
                                                    <p>{site.siteClass?.name}</p>
                                                    <p className="text-xl font-bold text-green-700">
                                                        ${((site.siteClass?.defaultRate || 0) / 100).toFixed(2)} <span className="text-sm font-normal text-gray-500">/ night</span>
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="lg:col-span-1 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-semibold text-gray-800">Map view</p>
                                            <p className="text-xs text-gray-500">Tap a pin to pick a site</p>
                                        </div>
                                        <Badge variant="outline" className="text-xs">
                                            {filteredSites.length} pins
                                        </Badge>
                                    </div>
                                    <BookingMap
                                        sites={filteredSites.map((site, idx) => ({
                                            id: site.id,
                                            name: site.name,
                                            siteNumber: site.siteNumber,
                                            status: "available" as const,
                                            latitude: Number.isFinite(campgroundCenter.latitude) ? (campgroundCenter.latitude as number) + 0.0004 * Math.sin(idx) : null,
                                            longitude: Number.isFinite(campgroundCenter.longitude) ? (campgroundCenter.longitude as number) + 0.0004 * Math.cos(idx) : null,
                                        }))}
                                        campgroundCenter={campgroundCenter}
                                        selectedSiteId={selectedSite?.id}
                                        onSelectSite={(siteId) => {
                                            const target = filteredSites.find(s => s.id === siteId);
                                            if (target) {
                                                setSelectedSite(target);
                                                setState("walkin-guest");
                                            }
                                        }}
                                        isLoading={loading}
                                    />
                                </div>
                            </div>
                        )}
                    </CardContent>
                    <div className="p-6 border-t bg-gray-50 rounded-b-xl">
                        <Button variant="outline" onClick={() => setState("walkin-nights")} className="h-12 px-8">
                            Back
                        </Button>
                    </div>
                </Card>
                );
            })()}

            {/* Walk-in: Guest Info */}
            {state === "walkin-guest" && selectedSite && (
                <Card className="w-full max-w-2xl shadow-2xl">
                    <CardHeader className="text-center pb-6 pt-10">
                        <CardTitle className="text-3xl font-bold text-gray-900">Guest Information</CardTitle>
                        <CardDescription>Who is staying in {selectedSite.name}?</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 px-10 pb-10">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">First Name</label>
                                <Input
                                    value={guestInfo.firstName}
                                    onChange={e => setGuestInfo({ ...guestInfo, firstName: e.target.value })}
                                    className="h-12 text-lg"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Last Name</label>
                                <Input
                                    value={guestInfo.lastName}
                                    onChange={e => setGuestInfo({ ...guestInfo, lastName: e.target.value })}
                                    className="h-12 text-lg"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Email</label>
                            <Input
                                type="email"
                                value={guestInfo.email}
                                onChange={e => setGuestInfo({ ...guestInfo, email: e.target.value })}
                                className="h-12 text-lg"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Phone</label>
                                <Input
                                    type="tel"
                                    value={guestInfo.phone}
                                    onChange={e => setGuestInfo({ ...guestInfo, phone: e.target.value })}
                                    className="h-12 text-lg"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Vehicle Plate</label>
                                <Input
                                    value={guestInfo.plate}
                                    onChange={e => setGuestInfo({ ...guestInfo, plate: e.target.value })}
                                    className="h-12 text-lg"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Zip Code</label>
                            <Input
                                value={guestInfo.zipCode}
                                onChange={e => setGuestInfo({ ...guestInfo, zipCode: e.target.value })}
                                className="h-12 text-lg"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder="ZIP / Postal code"
                            />
                        </div>

                        <div className="flex gap-4 pt-4">
                            <Button variant="outline" onClick={() => setState("walkin-sites")} className="flex-1 h-14 text-lg">
                                Back
                            </Button>
                            <Button
                                onClick={handleWalkInSubmit}
                                disabled={loading || !guestInfo.firstName || !guestInfo.lastName || !guestInfo.email || !guestInfo.zipCode}
                                className="flex-1 h-14 text-lg bg-green-600 hover:bg-green-700"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : "Continue"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Details Screen (Lookup Flow) */}
            {state === "details" && reservation && (
                <Card className="w-full max-w-3xl shadow-2xl">
                    <CardHeader className="text-center pb-6 pt-10">
                        <CardTitle className="text-3xl font-bold text-gray-900">
                            Reservation Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6 px-10 pb-10">
                        {/* Guest Info */}
                        <div className="bg-gray-50 rounded-xl p-6">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
                                    <User className="w-7 h-7 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {reservation.guest?.primaryFirstName} {reservation.guest?.primaryLastName}
                                    </p>
                                    <p className="text-gray-500">{reservation.guest?.email}</p>
                                </div>
                            </div>
                        </div>

                        {/* Stay Details */}
                        <div className="grid grid-cols-2 gap-6">
                            <div className="bg-blue-50 rounded-xl p-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <Calendar className="w-6 h-6 text-blue-600" />
                                    <span className="text-lg font-medium text-gray-700">Check-In</span>
                                </div>
                                <p className="text-2xl font-bold text-gray-900">
                                    {format(parseISO(reservation.arrivalDate), "MMM d, yyyy")}
                                </p>
                            </div>
                            <div className="bg-blue-50 rounded-xl p-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <Calendar className="w-6 h-6 text-blue-600" />
                                    <span className="text-lg font-medium text-gray-700">Check-Out</span>
                                </div>
                                <p className="text-2xl font-bold text-gray-900">
                                    {format(parseISO(reservation.departureDate), "MMM d, yyyy")}
                                </p>
                            </div>
                        </div>

                        {/* Site Assignment */}
                        <div className="bg-green-50 rounded-xl p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <MapPin className="w-6 h-6 text-green-600" />
                                <span className="text-lg font-medium text-gray-700">Your Site</span>
                            </div>
                            <p className="text-3xl font-bold text-green-700">
                                {reservation.site?.name || reservation.site?.siteNumber || "Site TBD"}
                            </p>
                        </div>

                        <div className="flex gap-4 pt-4">
                            <Button
                                variant="outline"
                                onClick={resetKiosk}
                                className="flex-1 h-14 text-lg"
                            >
                                <RefreshCw className="w-5 h-5 mr-2" />
                                Start Over
                            </Button>

                            <Button
                                onClick={() => setState("upsell")}
                                className="flex-1 h-14 text-lg bg-green-600 hover:bg-green-700"
                            >
                                Continue
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Upsell Screen */}
            {state === "upsell" && (
                <Card className="w-full max-w-3xl shadow-2xl">
                    <CardHeader className="text-center pb-6 pt-10">
                        <CardTitle className="text-3xl font-bold text-gray-900">
                            Enhance Your Stay
                        </CardTitle>
                        <CardDescription className="text-xl text-gray-600 mt-2">
                            Add essentials now and we'll deliver them to your site!
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8 px-10 pb-10">
                        <div className="grid grid-cols-2 gap-6">
                            {/* Firewood */}
                            <div className="bg-orange-50 border-2 border-orange-100 rounded-xl p-6 flex flex-col items-center text-center">
                                <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                                    <Flame className="w-10 h-10 text-orange-600" />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900">Firewood Bundle</h3>
                                <p className="text-lg text-gray-600 mb-4">$10.00 / bundle</p>

                                <div className="flex items-center gap-4 mt-auto">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-12 w-12 rounded-full"
                                        onClick={() => setFirewoodQty(Math.max(0, firewoodQty - 1))}
                                    >
                                        <Minus className="w-6 h-6" />
                                    </Button>
                                    <span className="text-3xl font-bold w-12 text-center">{firewoodQty}</span>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-12 w-12 rounded-full"
                                        onClick={() => setFirewoodQty(firewoodQty + 1)}
                                    >
                                        <Plus className="w-6 h-6" />
                                    </Button>
                                </div>
                            </div>

                            {/* Ice */}
                            <div className="bg-cyan-50 border-2 border-cyan-100 rounded-xl p-6 flex flex-col items-center text-center">
                                <div className="w-20 h-20 bg-cyan-100 rounded-full flex items-center justify-center mb-4">
                                    <Snowflake className="w-10 h-10 text-cyan-600" />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900">Bag of Ice</h3>
                                <p className="text-lg text-gray-600 mb-4">$5.00 / bag</p>

                                <div className="flex items-center gap-4 mt-auto">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-12 w-12 rounded-full"
                                        onClick={() => setIceQty(Math.max(0, iceQty - 1))}
                                    >
                                        <Minus className="w-6 h-6" />
                                    </Button>
                                    <span className="text-3xl font-bold w-12 text-center">{iceQty}</span>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-12 w-12 rounded-full"
                                        onClick={() => setIceQty(iceQty + 1)}
                                    >
                                        <Plus className="w-6 h-6" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4 pt-4">
                            <Button
                                variant="outline"
                                onClick={() => setState(reservation?.status === "confirmed" ? "details" : "walkin-guest")}
                                className="flex-1 h-14 text-lg"
                            >
                                Back
                            </Button>

                            <Button
                                onClick={() => setState("payment")}
                                className="flex-1 h-14 text-lg bg-green-600 hover:bg-green-700"
                            >
                                Continue to Payment
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Payment Screen */}
            {state === "payment" && reservation && (
                <Card className="w-full max-w-2xl shadow-2xl">
                    <CardHeader className="text-center pb-6 pt-10">
                        <CardTitle className="text-3xl font-bold text-gray-900">
                            Confirm & Pay
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6 px-10 pb-10">
                        <div className="bg-gray-50 rounded-xl p-6 space-y-4">
                            <div className="flex justify-between text-lg text-gray-600">
                                <span>Reservation Balance</span>
                                <span>${(balanceDue / 100).toFixed(2)}</span>
                            </div>
                            {firewoodQty > 0 && (
                                <div className="flex justify-between text-lg text-gray-600">
                                    <span>Firewood ({firewoodQty}x)</span>
                                    <span>${((firewoodQty * 1000) / 100).toFixed(2)}</span>
                                </div>
                            )}
                            {iceQty > 0 && (
                                <div className="flex justify-between text-lg text-gray-600">
                                    <span>Ice ({iceQty}x)</span>
                                    <span>${((iceQty * 500) / 100).toFixed(2)}</span>
                                </div>
                            )}
                            <div className="border-t border-gray-200 pt-4 flex justify-between text-2xl font-bold text-gray-900">
                                <span>Total Due</span>
                                <span>${(totalDue / 100).toFixed(2)}</span>
                            </div>
                        </div>

                        {totalDue > 0 ? (
                            <div className="space-y-4">
                                {/* Show Card on File if available and NOT a walk-in (or if we want to allow it) */}
                                {/* For this demo, if it's a walk-in, we force card entry. If it's existing, we show card on file. */}
                                {!guestInfo.firstName ? (
                                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 flex items-center gap-4">
                                        <CreditCard className="w-8 h-8 text-blue-600" />
                                        <div>
                                            <p className="font-bold text-gray-900">Card on File</p>
                                            <p className="text-gray-600">Visa ending in 4242</p>
                                        </div>
                                        <div className="ml-auto">
                                            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Default</Badge>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                                        <h3 className="font-semibold text-gray-900">Enter Payment Details</h3>
                                        <div className="space-y-3">
                                            <Input
                                                placeholder="Card Number"
                                                className="h-12 text-lg"
                                                value={cardDetails.number}
                                                onChange={e => setCardDetails({ ...cardDetails, number: e.target.value })}
                                            />
                                            <div className="grid grid-cols-2 gap-4">
                                                <Input
                                                    placeholder="MM/YY"
                                                    className="h-12 text-lg"
                                                    value={cardDetails.expiry}
                                                    onChange={e => setCardDetails({ ...cardDetails, expiry: e.target.value })}
                                                />
                                                <Input
                                                    placeholder="CVC"
                                                    className="h-12 text-lg"
                                                    value={cardDetails.cvc}
                                                    onChange={e => setCardDetails({ ...cardDetails, cvc: e.target.value })}
                                                />
                                            </div>
                                            <Input
                                                placeholder="Zip Code"
                                                className="h-12 text-lg"
                                                value={cardDetails.zip}
                                                onChange={e => setCardDetails({ ...cardDetails, zip: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center text-green-700 font-medium">
                                No payment required.
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg text-center">
                                {error}
                            </div>
                        )}

                        <div className="flex gap-4">
                            <Button
                                variant="outline"
                                onClick={() => setState("upsell")}
                                className="flex-1 h-14 text-lg"
                            >
                                Back
                            </Button>
                            <Button
                                onClick={handleCheckIn}
                                disabled={loading || (totalDue > 0 && !!guestInfo.firstName && (!cardDetails.number || !cardDetails.expiry || !cardDetails.cvc))}
                                className="flex-1 h-14 text-lg bg-green-600 hover:bg-green-700"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                ) : (
                                    <CheckCircle className="w-5 h-5 mr-2" />
                                )}
                                {totalDue > 0 ? `Pay $${(totalDue / 100).toFixed(2)} & Check In` : "Complete Check-In"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Success Screen */}
            {state === "success" && reservation && (
                <Card className="w-full max-w-2xl shadow-2xl">
                    <CardContent className="text-center py-16 px-10">
                        <div className="mx-auto w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-8">
                            <CheckCircle className="w-14 h-14 text-green-600" />
                        </div>
                        <h1 className="text-4xl font-bold text-gray-900 mb-4">
                            Check-In Complete!
                        </h1>
                        <p className="text-xl text-gray-600 mb-8">
                            Welcome, {reservation.guest?.primaryFirstName}!
                        </p>

                        <div className="bg-green-50 rounded-xl p-8 mb-8">
                            <p className="text-lg text-gray-600 mb-2">Your site is</p>
                            <p className="text-5xl font-bold text-green-700">
                                {reservation.site?.name || reservation.site?.siteNumber || "Site TBD"}
                            </p>
                        </div>

                        {totalDue > 0 && (
                            <div className="bg-emerald-50 rounded-xl p-6 mb-8 text-left flex items-center gap-4 border border-emerald-100">
                                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                                    <CreditCard className="w-6 h-6 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="font-bold text-gray-900 text-lg">Payment Successful</p>
                                    <p className="text-gray-600">
                                        A payment of <span className="font-semibold text-emerald-700">${(totalDue / 100).toFixed(2)}</span> has been processed.
                                    </p>
                                </div>
                            </div>
                        )}

                        {(firewoodQty > 0 || iceQty > 0) && (
                            <div className="bg-orange-50 rounded-xl p-6 mb-8 text-left flex items-center gap-4">
                                <ShoppingBag className="w-8 h-8 text-orange-600" />
                                <div>
                                    <p className="font-bold text-gray-900">Add-ons Ordered</p>
                                    <p className="text-gray-600">
                                        Your firewood and ice will be delivered to your site shortly.
                                    </p>
                                </div>
                            </div>
                        )}

                        {queuedCheckinPending && (
                            <div className="bg-amber-50 rounded-xl p-6 mb-8 text-left flex items-center gap-4 border border-amber-100">
                                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                                    <RefreshCw className="w-6 h-6 text-amber-600" />
                                </div>
                                <div>
                                    <p className="font-bold text-gray-900">Queued for sync</p>
                                    <p className="text-gray-600">
                                        We saved this check-in offline and will sync it when the connection returns.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="bg-blue-50 rounded-xl p-6 text-left">
                            <div className="flex items-start gap-3">
                                <MapPin className="w-6 h-6 text-blue-600 mt-1 flex-shrink-0" />
                                <div>
                                    <p className="font-medium text-gray-900">Directions</p>
                                    <p className="text-gray-600">
                                        Follow the main road past the office. Your site will be on the right.
                                        Look for the site marker with your number.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <p className="text-sm text-gray-500 mt-8">
                            This screen will reset automatically...
                        </p>

                        <div className="flex gap-4 justify-center mt-6">
                            <Button
                                variant="outline"
                                onClick={() => window.print()}
                                className="h-12 px-8"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 mr-2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                                Print Receipt
                            </Button>
                            <Button
                                variant="outline"
                                onClick={resetKiosk}
                                className="h-12 px-8"
                            >
                                <RefreshCw className="w-5 h-5 mr-2" />
                                New Check-In
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Online/offline + queue indicator */}
            {(queuedCheckins > 0 || !isOnline) && (
                <div className="fixed top-6 right-6 flex items-center gap-2">
                    {!isOnline && <Badge variant="outline">Offline</Badge>}
                    {queuedCheckins > 0 && (
                        <Badge
                            variant="secondary"
                            title={
                                conflicts.length
                                    ? `${queuedCheckins - conflicts.length} queued, ${conflicts.length} conflicts${conflicts[0]?.lastError ? ` (last error: ${conflicts[0].lastError})` : ""}${
                                          queuedCheckins > conflicts.length
                                              ? ` • next retry ${new Date(
                                                    Math.min(
                                                        ...loadQueue()
                                                            .map((i) => i.nextAttemptAt)
                                                            .filter((n) => typeof n === "number")
                                                    )
                                                ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                                              : ""
                                      }`
                                    : `${queuedCheckins} queued`
                            }
                        >
                            {queuedCheckins} queued
                        </Badge>
                    )}
                    <Button size="sm" variant="outline" asChild>
                        <Link href="/pwa/sync-log">Sync log</Link>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => flushQueue()}>
                        Flush now
                    </Button>
                </div>
            )}

            {conflicts.length > 0 && (
                <div className="fixed top-24 right-6 w-72 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 p-3 text-sm space-y-2 shadow">
                    <div className="font-semibold">Conflicts detected</div>
                    {conflicts.map((c) => (
                        <div key={c.id} className="space-y-1">
                            <div className="text-xs">Check-in {c.id.slice(0, 8)}…</div>
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

            {/* Countdown indicator when not on home screen */}
            {state !== "home" && (
                <div className="fixed bottom-8 right-8">
                    <Badge variant="secondary" className="text-sm px-4 py-2">
                        Screen resets after inactivity
                    </Badge>
                </div>
            )}
        </div>
    );
}
