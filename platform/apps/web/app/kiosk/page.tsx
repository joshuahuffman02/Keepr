"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { apiClient } from "@/lib/api-client";
import { recordTelemetry } from "@/lib/sync-telemetry";
import { loadQueue as loadQueueGeneric, saveQueue as saveQueueGeneric, registerBackgroundSync } from "@/lib/offline-queue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookingMap } from "@/components/maps/BookingMap";
import { Loader2, Search, CheckCircle, MapPin, Calendar, User, CreditCard, Home, RefreshCw, Flame, Snowflake, Plus, Minus, ShoppingBag, Tent, ArrowRight, Grid3X3, Zap, Droplet, Waves, Tablet, AlertCircle, Mail, Car, Truck, Bike, Users, Baby, Clock } from "lucide-react";
import Link from "next/link";
import { format, parseISO, addDays } from "date-fns";
import { randomId } from "@/lib/random-id";
import confetti from "canvas-confetti";

// Storage key for kiosk device token
const KIOSK_TOKEN_KEY = "campreserv:kioskDeviceToken";
const KIOSK_CAMPGROUND_KEY = "campreserv:kioskCampground";

// Animation configs
const SPRING_CONFIG = { type: "spring" as const, stiffness: 200, damping: 20 };
const STAGGER_DELAY = 0.05;

const pageVariants = {
    initial: { opacity: 0, scale: 0.96 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.96 }
};

const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 }
};

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

type KioskState = "setup" | "home" | "lookup" | "details" | "upsell" | "payment" | "success" | "walkin-nights" | "walkin-sites" | "walkin-guest";

type CampgroundInfo = {
    id: string;
    name: string;
    slug: string;
    heroImageUrl: string | null;
    latitude: number | null;
    longitude: number | null;
    checkInTime?: string | null;
    checkOutTime?: string | null;
};

type FieldErrors = {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    zipCode?: string;
};

const INACTIVITY_TIMEOUT = 120000; // 120 seconds (increased for better UX)
const WARNING_THRESHOLD = 15000; // Show warning at 15 seconds

// Validation helpers
const validateEmail = (email: string): string => {
    if (!email) return "Email is required";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return "Please enter a valid email";
    return "";
};

const validatePhone = (phone: string): string => {
    if (!phone) return ""; // Optional
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length > 0 && cleaned.length < 10) return "Please enter a valid phone number";
    return "";
};

const formatPhone = (value: string): string => {
    const cleaned = value.replace(/\D/g, "").slice(0, 10);
    if (cleaned.length >= 6) {
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    } else if (cleaned.length >= 3) {
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    }
    return cleaned;
};

// Time-based greeting
const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning!";
    if (hour < 17) return "Good afternoon!";
    return "Good evening!";
};

// Trigger confetti celebration
const triggerCelebration = () => {
    const duration = 2000;
    const end = Date.now() + duration;

    const frame = () => {
        confetti({
            particleCount: 3,
            angle: 60,
            spread: 55,
            origin: { x: 0, y: 0.7 },
            colors: ["#22c55e", "#10b981", "#059669"]
        });
        confetti({
            particleCount: 3,
            angle: 120,
            spread: 55,
            origin: { x: 1, y: 0.7 },
            colors: ["#22c55e", "#10b981", "#059669"]
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    };
    frame();
};

export default function KioskPage() {
    const shouldReduceMotion = useReducedMotion();
    const [state, setState] = useState<KioskState>("setup");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

    // Device pairing state
    const [pairingCode, setPairingCode] = useState("");
    const [campground, setCampground] = useState<CampgroundInfo | null>(null);
    const [deviceName, setDeviceName] = useState("");

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
    const isFlushingRef = useRef(false);

    // Focus management refs
    const confirmationInputRef = useRef<HTMLInputElement>(null);
    const firstNameInputRef = useRef<HTMLInputElement>(null);

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
        if (isFlushingRef.current) return;
        if (!navigator.onLine) return;

        isFlushingRef.current = true;
        try {
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
        } finally {
            isFlushingRef.current = false;
        }
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
        zipCode: "",
        adults: 2,
        children: 0,
        vehicleType: "car" as "car" | "truck" | "rv" | "motorcycle" | "trailer"
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

    // Upsell data
    const [firewoodQty, setFirewoodQty] = useState(0);
    const [iceQty, setIceQty] = useState(0);

    // Inactivity timer with countdown
    const [lastActivity, setLastActivity] = useState(Date.now());
    const [timeRemaining, setTimeRemaining] = useState(INACTIVITY_TIMEOUT);

    // Animation spring config based on reduced motion preference
    const springConfig = shouldReduceMotion
        ? { type: "tween" as const, duration: 0.15 }
        : SPRING_CONFIG;

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
        setGuestInfo({ firstName: "", lastName: "", email: "", phone: "", plate: "", zipCode: "", adults: 2, children: 0, vehicleType: "car" });
        setCardDetails({ number: "", expiry: "", cvc: "", zip: "" });
        setError(null);
        setFieldErrors({});
        setLoading(false);
        setLastActivity(Date.now());
        setQueuedCheckinPending(false);
    }, []);

    // Track user activity
    const handleActivity = useCallback(() => {
        setLastActivity(Date.now());
    }, []);

    // Update countdown timer
    useEffect(() => {
        if (state === "home" || state === "setup" || loading) return;

        const interval = setInterval(() => {
            const remaining = Math.max(0, INACTIVITY_TIMEOUT - (Date.now() - lastActivity));
            setTimeRemaining(remaining);

            if (remaining === 0) {
                resetKiosk();
            }
        }, 100);

        return () => clearInterval(interval);
    }, [state, lastActivity, resetKiosk, loading]);

    // Add activity listeners
    useEffect(() => {
        const events = ["touchstart", "touchmove", "click", "keydown"];
        events.forEach(event => window.addEventListener(event, handleActivity, { passive: true }));

        return () => {
            events.forEach(event => window.removeEventListener(event, handleActivity));
        };
    }, [handleActivity]);

    // Focus management on state change
    useEffect(() => {
        if (state === "lookup") {
            setTimeout(() => confirmationInputRef.current?.focus(), 300);
        } else if (state === "walkin-guest") {
            setTimeout(() => firstNameInputRef.current?.focus(), 300);
        }
    }, [state]);

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

    // Validate device token on page load
    useEffect(() => {
        const validateDevice = async () => {
            const token = localStorage.getItem(KIOSK_TOKEN_KEY);

            if (!token) {
                setLoading(false);
                setState("setup");
                return;
            }

            try {
                const result = await apiClient.kioskGetDeviceInfo(token);

                if (!result.valid || !result.campground) {
                    localStorage.removeItem(KIOSK_TOKEN_KEY);
                    localStorage.removeItem(KIOSK_CAMPGROUND_KEY);
                    setLoading(false);
                    setState("setup");
                    setError("Device session expired. Please pair again.");
                    return;
                }

                setCampground(result.campground);
                setCampgroundCenter({
                    latitude: result.campground.latitude,
                    longitude: result.campground.longitude
                });
                localStorage.setItem(KIOSK_CAMPGROUND_KEY, JSON.stringify(result.campground));
                setLoading(false);
                setState("home");
            } catch (err) {
                const cached = localStorage.getItem(KIOSK_CAMPGROUND_KEY);
                if (cached) {
                    try {
                        const cachedCampground = JSON.parse(cached) as CampgroundInfo;
                        setCampground(cachedCampground);
                        setCampgroundCenter({
                            latitude: cachedCampground.latitude,
                            longitude: cachedCampground.longitude
                        });
                        setLoading(false);
                        setState("home");
                        return;
                    } catch {}
                }
                localStorage.removeItem(KIOSK_TOKEN_KEY);
                localStorage.removeItem(KIOSK_CAMPGROUND_KEY);
                setLoading(false);
                setState("setup");
                setError("Failed to validate device. Please pair again.");
            }
        };

        validateDevice();
    }, []);

    // Handle device pairing
    const handlePairing = async () => {
        if (!pairingCode || pairingCode.length !== 6) {
            setError("Please enter the 6-digit pairing code");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const result = await apiClient.kioskPairDevice(pairingCode, deviceName || undefined);

            localStorage.setItem(KIOSK_TOKEN_KEY, result.deviceToken);
            localStorage.setItem(KIOSK_CAMPGROUND_KEY, JSON.stringify(result.campground));

            setCampground(result.campground);
            setCampgroundCenter({
                latitude: result.campground.latitude,
                longitude: result.campground.longitude
            });

            setPairingCode("");
            setDeviceName("");
            setState("home");
        } catch (err: any) {
            setError(err?.message || "Invalid or expired pairing code. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // Lookup reservation with better error messages
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
                setError("We couldn't find that reservation. Please double-check your confirmation code or visit the front desk for help.");
                setLoading(false);
                return;
            }

            if (found.status === "checked_in") {
                setError("Great news - you're already checked in! Head to your site or visit the front desk if you need assistance.");
                setLoading(false);
                return;
            }

            setReservation(found);
            setState("details");
        } catch (err) {
            console.error(err);
            setError("Something went wrong. Please try again or visit the front desk.");
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
            if (!campground?.slug) {
                setError("Kiosk not configured. Please restart or contact staff.");
                setLoading(false);
                return;
            }
            const sites = await apiClient.getPublicAvailability(campground.slug, {
                arrivalDate: format(arrival, "yyyy-MM-dd"),
                departureDate: format(departure, "yyyy-MM-dd")
            });
            // Only show sites that are actually available
            const available = (sites as any[]).filter(s => s.status === "available");
            setAvailableSites(available as unknown as Site[]);
            setState("walkin-sites");
        } catch (err) {
            console.error(err);
            setError("Couldn't load available sites. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // Validate guest form with field-level errors
    const validateGuestForm = (): boolean => {
        const errors: FieldErrors = {};

        if (!guestInfo.firstName.trim()) errors.firstName = "First name is required";
        if (!guestInfo.lastName.trim()) errors.lastName = "Last name is required";

        const emailError = validateEmail(guestInfo.email);
        if (emailError) errors.email = emailError;

        const phoneError = validatePhone(guestInfo.phone);
        if (phoneError) errors.phone = phoneError;

        const zipCode = guestInfo.zipCode?.trim() || "";
        if (zipCode.length < 5 || zipCode.length > 10) {
            errors.zipCode = "Please enter a valid zip code";
        }

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Walk-in: Create Reservation & Check In
    const handleWalkInSubmit = async () => {
        if (!selectedSite) return;

        if (!validateGuestForm()) return;

        setLoading(true);
        handleActivity();

        const arrival = new Date();
        const departure = addDays(arrival, nights);

        try {
            const deviceToken = localStorage.getItem(KIOSK_TOKEN_KEY);
            if (!deviceToken) {
                setError("Kiosk not configured. Please restart or contact staff.");
                setLoading(false);
                return;
            }

            const newRes = await apiClient.kioskCreateReservation(deviceToken, {
                siteId: selectedSite.id,
                arrivalDate: format(arrival, "yyyy-MM-dd"),
                departureDate: format(departure, "yyyy-MM-dd"),
                adults: guestInfo.adults,
                children: guestInfo.children,
                guest: {
                    firstName: guestInfo.firstName,
                    lastName: guestInfo.lastName,
                    email: guestInfo.email,
                    phone: guestInfo.phone,
                    zipCode: guestInfo.zipCode.trim()
                },
                equipment: {
                    type: guestInfo.vehicleType,
                    plateNumber: guestInfo.plate
                }
            });

            setReservation(newRes as unknown as Reservation);
            setState("upsell");
        } catch (err: any) {
            console.error(err);
            const message = err?.message || "Couldn't create reservation. Please try again or visit the front desk.";
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    // Complete check-in with celebration
    const handleCheckIn = async () => {
        if (!reservation) return;
        setLoading(true);
        handleActivity();

        const upsellTotal = (firewoodQty * 1000) + (iceQty * 500);

        try {
            if (!navigator.onLine) {
                queueCheckIn({ reservationId: reservation.id, upsellTotal });
                setQueuedCheckinPending(true);
                setState("success");
                triggerCelebration();
                recordTelemetry({ source: "kiosk", type: "queue", status: "pending", message: "Check-in queued offline", meta: { reservationId: reservation.id, upsellTotal } });
                return;
            }
            await apiClient.kioskCheckIn(reservation.id, upsellTotal);
            recordTelemetry({ source: "kiosk", type: "sync", status: "success", message: "Check-in completed", meta: { reservationId: reservation.id } });
            setState("success");
            triggerCelebration();
        } catch (err) {
            console.error(err);
            setError("Check-in couldn't be completed. Please visit the front desk for assistance.");
            recordTelemetry({ source: "kiosk", type: "error", status: "failed", message: "Check-in failed", meta: { error: (err as any)?.message } });
        } finally {
            setLoading(false);
        }
    };

    // Send email receipt
    const handleEmailReceipt = async () => {
        if (!reservation?.id) return;
        try {
            // This would call an API endpoint to send receipt
            // await apiClient.sendReceipt(reservation.id);
            // For now, show a success message
        } catch (err) {
            console.error(err);
        }
    };

    const balanceDue = reservation ? reservation.totalAmount - reservation.paidAmount : 0;
    const upsellTotal = (firewoodQty * 1000) + (iceQty * 500);
    const totalDue = balanceDue + upsellTotal;
    const showTimeWarning = timeRemaining <= WARNING_THRESHOLD && state !== "home" && state !== "setup";
    const secondsRemaining = Math.ceil(timeRemaining / 1000);

    // Loading message based on current state
    const getLoadingMessage = (): string => {
        switch (state) {
            case "setup": return "Validating device...";
            case "lookup": return "Finding your reservation...";
            case "walkin-nights":
            case "walkin-sites": return "Searching available sites...";
            case "walkin-guest": return "Creating your reservation...";
            case "payment": return "Processing your check-in...";
            default: return "Loading...";
        }
    };

    return (
        <div
            className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-emerald-900 flex items-center justify-center p-6 md:p-8"
            onClick={handleActivity}
        >
            {/* Screen reader announcements */}
            <div role="status" aria-live="polite" className="sr-only">
                {state === "success" && `Check-in complete for ${reservation?.guest?.primaryFirstName}`}
                {error && error}
            </div>

            <AnimatePresence mode="wait">
                {/* Setup/Pairing Screen */}
                {state === "setup" && (
                    <motion.div
                        key="setup"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={springConfig}
                    >
                        <Card className="w-full max-w-lg shadow-2xl bg-white/95 backdrop-blur">
                            <CardHeader className="text-center pb-6 pt-10">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ ...springConfig, delay: 0.2 }}
                                    className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4"
                                >
                                    <Tablet className="w-10 h-10 text-green-600" />
                                </motion.div>
                                <CardTitle className="text-3xl font-bold text-gray-900">Kiosk Setup</CardTitle>
                                <CardDescription className="text-lg">
                                    Enter the 6-digit pairing code from your campground settings
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6 px-10 pb-10">
                                {loading ? (
                                    <div className="flex flex-col items-center gap-4 py-8">
                                        <Loader2 className="w-12 h-12 animate-spin text-green-600" />
                                        <p className="text-gray-600">{getLoadingMessage()}</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="space-y-2">
                                            <label htmlFor="pairing-code" className="block text-sm font-medium text-gray-700">
                                                Pairing Code <span className="text-red-500">*</span>
                                            </label>
                                            <Input
                                                id="pairing-code"
                                                type="text"
                                                placeholder="000000"
                                                value={pairingCode}
                                                onChange={(e) => setPairingCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                                className="h-16 text-4xl text-center tracking-[0.5em] font-mono"
                                                maxLength={6}
                                                inputMode="numeric"
                                                aria-required="true"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label htmlFor="device-name" className="block text-sm font-medium text-gray-700">
                                                Device Name (optional)
                                            </label>
                                            <Input
                                                id="device-name"
                                                type="text"
                                                placeholder="e.g., Front Gate Kiosk"
                                                value={deviceName}
                                                onChange={(e) => setDeviceName(e.target.value)}
                                                className="h-12"
                                            />
                                        </div>

                                        {error && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                role="alert"
                                                className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2"
                                            >
                                                <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                                                {error}
                                            </motion.div>
                                        )}

                                        <Button
                                            onClick={handlePairing}
                                            disabled={loading || pairingCode.length !== 6}
                                            className="w-full h-14 text-xl bg-green-600 hover:bg-green-700 active:scale-[0.98] transition-transform"
                                        >
                                            {loading ? (
                                                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                                            ) : (
                                                <CheckCircle className="w-6 h-6 mr-2" />
                                            )}
                                            Pair Device
                                        </Button>

                                        <div className="text-center text-sm text-gray-500 pt-4 border-t">
                                            <p>To get a pairing code:</p>
                                            <p className="mt-1">Dashboard → Settings → Kiosk Devices → Generate Code</p>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {/* Home Screen */}
                {state === "home" && (
                    <motion.div
                        key="home"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={springConfig}
                    >
                        <Card className="w-full max-w-4xl shadow-2xl bg-white/95 backdrop-blur">
                            <CardContent className="p-12 md:p-16 text-center space-y-10 md:space-y-12">
                                <motion.div
                                    initial={{ opacity: 0, y: -20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ ...springConfig, delay: 0.2 }}
                                >
                                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-green-900 mb-4">
                                        {getGreeting()}
                                    </h1>
                                    <p className="text-xl sm:text-2xl text-green-700">
                                        Welcome to {campground?.name || "Check-In"}
                                    </p>
                                </motion.div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ ...springConfig, delay: 0.3 }}
                                    >
                                        <Button
                                            className="w-full h-56 md:h-64 text-xl md:text-2xl flex flex-col gap-4 md:gap-6 bg-green-600 hover:bg-green-700 active:scale-[0.98] shadow-xl transition-all"
                                            onClick={() => setState("lookup")}
                                        >
                                            <div className="w-20 h-20 md:w-24 md:h-24 bg-white/20 rounded-full flex items-center justify-center">
                                                <Search className="w-10 h-10 md:w-12 md:h-12" />
                                            </div>
                                            I have a reservation
                                        </Button>
                                    </motion.div>

                                    <motion.div
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ ...springConfig, delay: 0.4 }}
                                    >
                                        <Button
                                            className="w-full h-56 md:h-64 text-xl md:text-2xl flex flex-col gap-4 md:gap-6 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] shadow-xl transition-all"
                                            onClick={() => setState("walkin-nights")}
                                        >
                                            <div className="w-20 h-20 md:w-24 md:h-24 bg-white/20 rounded-full flex items-center justify-center">
                                                <Tent className="w-10 h-10 md:w-12 md:h-12" />
                                            </div>
                                            I need a site (Walk-in)
                                        </Button>
                                    </motion.div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {/* Lookup Screen */}
                {state === "lookup" && (
                    <motion.div
                        key="lookup"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={springConfig}
                    >
                        <Card className="w-full max-w-2xl shadow-2xl">
                            <CardHeader className="text-center pb-6 md:pb-8 pt-10 md:pt-12">
                                <CardTitle className="text-3xl md:text-4xl font-bold text-gray-900">Find Reservation</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6 md:space-y-8 px-8 md:px-12 pb-10 md:pb-12">
                                <div className="space-y-4">
                                    <label htmlFor="confirmation-code" className="block text-lg font-medium text-gray-700">
                                        Confirmation Code
                                    </label>
                                    <Input
                                        ref={confirmationInputRef}
                                        id="confirmation-code"
                                        type="text"
                                        placeholder="Enter your confirmation code"
                                        value={confirmationCode}
                                        onChange={(e) => { setConfirmationCode(e.target.value); setError(null); }}
                                        className="h-14 md:h-16 text-lg md:text-xl px-6"
                                        aria-describedby={error ? "lookup-error" : undefined}
                                    />
                                </div>

                                <AnimatePresence>
                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            id="lookup-error"
                                            role="alert"
                                            className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg flex items-start gap-3"
                                        >
                                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
                                            <span>{error}</span>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="flex gap-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => setState("home")}
                                        className="h-14 md:h-16 px-6 md:px-8 text-lg md:text-xl active:scale-[0.98] transition-transform"
                                    >
                                        Back
                                    </Button>
                                    <Button
                                        onClick={handleLookup}
                                        disabled={loading || !confirmationCode}
                                        className="flex-1 h-14 md:h-16 text-lg md:text-xl bg-green-600 hover:bg-green-700 active:scale-[0.98] transition-transform"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                                                {getLoadingMessage()}
                                            </>
                                        ) : (
                                            <>
                                                <Search className="w-6 h-6 mr-2" />
                                                Find My Reservation
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {/* Walk-in: Nights Selection */}
                {state === "walkin-nights" && (
                    <motion.div
                        key="walkin-nights"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={springConfig}
                    >
                        <Card className="w-full max-w-3xl shadow-2xl">
                            <CardHeader className="text-center pb-6 md:pb-8 pt-10 md:pt-12">
                                <CardTitle className="text-3xl md:text-4xl font-bold text-gray-900">How long are you staying?</CardTitle>
                                <CardDescription className="text-lg md:text-xl">Checking in tonight, {format(new Date(), "MMMM d")}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6 md:space-y-8 px-8 md:px-12 pb-10 md:pb-12">
                                {!showCustomNights ? (
                                    <motion.div
                                        className="grid grid-cols-2 gap-4 md:gap-6"
                                        initial="hidden"
                                        animate="visible"
                                        variants={{
                                            hidden: {},
                                            visible: { transition: { staggerChildren: STAGGER_DELAY } }
                                        }}
                                    >
                                        {[1, 2, 3].map((n) => (
                                            <motion.div key={n} variants={fadeInUp}>
                                                <Button
                                                    variant="outline"
                                                    className="w-full h-32 md:h-40 flex flex-col gap-2 md:gap-4 text-xl active:scale-[0.98] active:border-green-500 active:bg-green-50 transition-all"
                                                    onClick={() => handleSearchSites(n)}
                                                >
                                                    <span className="text-5xl md:text-6xl font-bold text-green-600">{n}</span>
                                                    Night{n > 1 ? "s" : ""}
                                                </Button>
                                            </motion.div>
                                        ))}
                                        <motion.div variants={fadeInUp}>
                                            <Button
                                                variant="outline"
                                                className="w-full h-32 md:h-40 flex flex-col gap-2 md:gap-4 text-xl active:scale-[0.98] active:border-blue-500 active:bg-blue-50 transition-all"
                                                onClick={() => { setShowCustomNights(true); setNights(4); }}
                                            >
                                                <Grid3X3 className="w-10 h-10 md:w-12 md:h-12 text-blue-600" />
                                                More nights
                                            </Button>
                                        </motion.div>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        className="flex flex-col items-center gap-6 md:gap-8 py-6 md:py-8"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                    >
                                        <div className="flex items-center gap-4 md:gap-6">
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-16 w-16 md:h-20 md:w-20 rounded-full active:scale-[0.95] transition-transform"
                                                onClick={() => setNights(Math.max(1, nights - 1))}
                                                aria-label="Decrease number of nights"
                                            >
                                                <Minus className="w-6 h-6 md:w-8 md:h-8" />
                                            </Button>
                                            <div className="text-center">
                                                <motion.span
                                                    key={nights}
                                                    initial={{ scale: 1.2, opacity: 0.5 }}
                                                    animate={{ scale: 1, opacity: 1 }}
                                                    className="text-6xl md:text-8xl font-bold text-green-600"
                                                >
                                                    {nights}
                                                </motion.span>
                                                <p className="text-lg md:text-xl text-gray-500 mt-2">Nights</p>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-16 w-16 md:h-20 md:w-20 rounded-full active:scale-[0.95] transition-transform"
                                                onClick={() => setNights(Math.min(14, nights + 1))}
                                                aria-label="Increase number of nights"
                                            >
                                                <Plus className="w-6 h-6 md:w-8 md:h-8" />
                                            </Button>
                                        </div>
                                        <Button
                                            className="w-full h-14 md:h-16 text-lg md:text-xl bg-green-600 hover:bg-green-700 active:scale-[0.98] transition-transform"
                                            onClick={() => handleSearchSites(nights)}
                                            disabled={loading}
                                        >
                                            {loading ? (
                                                <>
                                                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                                                    {getLoadingMessage()}
                                                </>
                                            ) : (
                                                "Check Availability"
                                            )}
                                        </Button>
                                    </motion.div>
                                )}
                                <Button
                                    variant="ghost"
                                    onClick={() => showCustomNights ? setShowCustomNights(false) : setState("home")}
                                    className="w-full h-12 text-lg active:scale-[0.98] transition-transform"
                                >
                                    {showCustomNights ? "← Back to Options" : "Cancel"}
                                </Button>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {/* Walk-in: Site Selection */}
                {state === "walkin-sites" && (() => {
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
                        <motion.div
                            key="walkin-sites"
                            variants={pageVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            transition={springConfig}
                            className="w-full max-w-5xl"
                        >
                            <Card className="shadow-2xl h-[85vh] flex flex-col">
                                <CardHeader className="text-center pb-4 pt-6 md:pt-8">
                                    <CardTitle className="text-2xl md:text-3xl font-bold text-gray-900">Select a Site</CardTitle>
                                    <CardDescription className="text-base md:text-lg">
                                        Available for {nights} night{nights > 1 ? "s" : ""} starting tonight
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-y-auto px-6 md:px-8 pb-6 md:pb-8">
                                    {/* Filters */}
                                    {!loading && availableSites.length > 0 && (
                                        <div className="mb-4 md:mb-6 space-y-3">
                                            <div className="flex flex-wrap gap-2">
                                                <Button
                                                    variant={siteFilters.siteType === null ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => setSiteFilters((prev) => ({ ...prev, siteType: null }))}
                                                    className="h-12 px-4 active:scale-[0.98] transition-transform"
                                                >
                                                    All Types
                                                </Button>
                                                {siteTypes.map((type) => (
                                                    <Button
                                                        key={type}
                                                        variant={siteFilters.siteType === type ? "default" : "outline"}
                                                        size="sm"
                                                        onClick={() => setSiteFilters((prev) => ({ ...prev, siteType: type }))}
                                                        className="h-12 px-4 capitalize active:scale-[0.98] transition-transform"
                                                    >
                                                        {type === "rv" ? "RV" : type}
                                                    </Button>
                                                ))}
                                            </div>

                                            {hasHookupSites && (
                                                <div className="flex flex-wrap gap-2">
                                                    <span className="text-sm text-gray-500 flex items-center mr-2">Hookups:</span>
                                                    <Button
                                                        variant={siteFilters.hookups.includes("power") ? "default" : "outline"}
                                                        size="sm"
                                                        onClick={() => toggleHookup("power")}
                                                        className="h-12 px-4 active:scale-[0.98] transition-transform"
                                                    >
                                                        <Zap className="h-4 w-4 mr-1" /> Electric
                                                    </Button>
                                                    <Button
                                                        variant={siteFilters.hookups.includes("water") ? "default" : "outline"}
                                                        size="sm"
                                                        onClick={() => toggleHookup("water")}
                                                        className="h-12 px-4 active:scale-[0.98] transition-transform"
                                                    >
                                                        <Droplet className="h-4 w-4 mr-1" /> Water
                                                    </Button>
                                                    <Button
                                                        variant={siteFilters.hookups.includes("sewer") ? "default" : "outline"}
                                                        size="sm"
                                                        onClick={() => toggleHookup("sewer")}
                                                        className="h-12 px-4 active:scale-[0.98] transition-transform"
                                                    >
                                                        <Waves className="h-4 w-4 mr-1" /> Sewer
                                                    </Button>
                                                </div>
                                            )}

                                            <p className="text-sm text-gray-500">
                                                Showing {filteredSites.length} of {availableSites.length} sites
                                            </p>
                                        </div>
                                    )}

                                    {loading ? (
                                        <div className="flex flex-col justify-center items-center h-64 gap-4">
                                            <Loader2 className="w-12 h-12 animate-spin text-green-600" />
                                            <p className="text-gray-600">{getLoadingMessage()}</p>
                                        </div>
                                    ) : filteredSites.length === 0 ? (
                                        <div className="text-center py-12">
                                            <p className="text-xl md:text-2xl text-gray-500">
                                                {availableSites.length === 0
                                                    ? "No sites available for these dates."
                                                    : "No sites match your filters."}
                                            </p>
                                            <Button
                                                onClick={() => availableSites.length === 0
                                                    ? setState("walkin-nights")
                                                    : setSiteFilters({ siteType: null, hookups: [] })}
                                                className="mt-6 h-12 active:scale-[0.98] transition-transform"
                                            >
                                                {availableSites.length === 0 ? "Try different dates" : "Clear filters"}
                                            </Button>
                                        </div>
                                    ) : (
                                        <motion.div
                                            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
                                            initial="hidden"
                                            animate="visible"
                                            variants={{
                                                hidden: {},
                                                visible: { transition: { staggerChildren: STAGGER_DELAY } }
                                            }}
                                        >
                                            {filteredSites.map((site) => (
                                                <motion.div
                                                    key={site.id}
                                                    variants={fadeInUp}
                                                    onClick={() => { setSelectedSite(site); setState("walkin-guest"); }}
                                                    className="border-2 border-gray-200 rounded-xl p-5 md:p-6 cursor-pointer active:scale-[0.98] active:border-green-500 active:bg-green-50 transition-all"
                                                    role="button"
                                                    tabIndex={0}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter" || e.key === " ") {
                                                            setSelectedSite(site);
                                                            setState("walkin-guest");
                                                        }
                                                    }}
                                                    aria-label={`Select ${site.name}, ${site.siteClass?.name || site.siteType}, $${((site.siteClass?.defaultRate || 0) / 100).toFixed(2)} per night`}
                                                >
                                                    <div className="flex justify-between items-start mb-3 md:mb-4">
                                                        <span className="text-xl md:text-2xl font-bold text-gray-900">{site.name}</span>
                                                        <Badge>{site.siteType === "rv" ? "RV" : site.siteType}</Badge>
                                                    </div>
                                                    <div className="space-y-2 text-gray-600">
                                                        <p>{site.siteClass?.name}</p>
                                                        {/* Hookup badges */}
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {site.hookupsPower && (
                                                                <Badge variant="outline" className="text-xs">
                                                                    <Zap className="w-3 h-3 mr-1" />
                                                                    {site.powerAmps}A
                                                                </Badge>
                                                            )}
                                                            {site.hookupsWater && (
                                                                <Badge variant="outline" className="text-xs">
                                                                    <Droplet className="w-3 h-3 mr-1" />
                                                                    Water
                                                                </Badge>
                                                            )}
                                                            {site.hookupsSewer && (
                                                                <Badge variant="outline" className="text-xs">
                                                                    <Waves className="w-3 h-3 mr-1" />
                                                                    Sewer
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-lg md:text-xl font-bold text-green-700 pt-1">
                                                            ${((site.siteClass?.defaultRate || 0) / 100).toFixed(2)} <span className="text-sm font-normal text-gray-500">/ night</span>
                                                        </p>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </motion.div>
                                    )}
                                </CardContent>
                                <div className="p-4 md:p-6 border-t bg-gray-50 rounded-b-xl">
                                    <Button
                                        variant="outline"
                                        onClick={() => setState("walkin-nights")}
                                        className="h-12 px-8 active:scale-[0.98] transition-transform"
                                    >
                                        ← Back
                                    </Button>
                                </div>
                            </Card>
                        </motion.div>
                    );
                })()}

                {/* Walk-in: Guest Info with validation */}
                {state === "walkin-guest" && selectedSite && (
                    <motion.div
                        key="walkin-guest"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={springConfig}
                    >
                        <Card className="w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
                            <CardHeader className="text-center pb-4 md:pb-6 pt-8 md:pt-10">
                                <CardTitle className="text-2xl md:text-3xl font-bold text-gray-900">Guest Information</CardTitle>
                                <CardDescription className="text-base md:text-lg">
                                    Who's staying in <span className="font-semibold">{selectedSite.name}</span>?
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5 md:space-y-6 px-6 md:px-10 pb-8 md:pb-10">
                                {/* Name fields */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label htmlFor="first-name" className="text-sm font-medium">
                                            First Name <span className="text-red-500">*</span>
                                        </label>
                                        <Input
                                            ref={firstNameInputRef}
                                            id="first-name"
                                            value={guestInfo.firstName}
                                            onChange={e => {
                                                setGuestInfo({ ...guestInfo, firstName: e.target.value });
                                                if (fieldErrors.firstName) setFieldErrors({ ...fieldErrors, firstName: undefined });
                                            }}
                                            className={`h-12 text-lg ${fieldErrors.firstName ? "border-red-500" : ""}`}
                                            aria-invalid={!!fieldErrors.firstName}
                                            aria-describedby={fieldErrors.firstName ? "firstName-error" : undefined}
                                        />
                                        {fieldErrors.firstName && (
                                            <p id="firstName-error" className="text-sm text-red-600 flex items-center gap-1">
                                                <AlertCircle className="w-4 h-4" />
                                                {fieldErrors.firstName}
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="last-name" className="text-sm font-medium">
                                            Last Name <span className="text-red-500">*</span>
                                        </label>
                                        <Input
                                            id="last-name"
                                            value={guestInfo.lastName}
                                            onChange={e => {
                                                setGuestInfo({ ...guestInfo, lastName: e.target.value });
                                                if (fieldErrors.lastName) setFieldErrors({ ...fieldErrors, lastName: undefined });
                                            }}
                                            className={`h-12 text-lg ${fieldErrors.lastName ? "border-red-500" : ""}`}
                                            aria-invalid={!!fieldErrors.lastName}
                                            aria-describedby={fieldErrors.lastName ? "lastName-error" : undefined}
                                        />
                                        {fieldErrors.lastName && (
                                            <p id="lastName-error" className="text-sm text-red-600 flex items-center gap-1">
                                                <AlertCircle className="w-4 h-4" />
                                                {fieldErrors.lastName}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Email */}
                                <div className="space-y-2">
                                    <label htmlFor="email" className="text-sm font-medium">
                                        Email <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={guestInfo.email}
                                        onChange={e => {
                                            setGuestInfo({ ...guestInfo, email: e.target.value });
                                            if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: undefined });
                                        }}
                                        onBlur={() => {
                                            const error = validateEmail(guestInfo.email);
                                            if (error) setFieldErrors({ ...fieldErrors, email: error });
                                        }}
                                        className={`h-12 text-lg ${fieldErrors.email ? "border-red-500" : ""}`}
                                        aria-invalid={!!fieldErrors.email}
                                        aria-describedby={fieldErrors.email ? "email-error" : undefined}
                                    />
                                    {fieldErrors.email && (
                                        <p id="email-error" className="text-sm text-red-600 flex items-center gap-1">
                                            <AlertCircle className="w-4 h-4" />
                                            {fieldErrors.email}
                                        </p>
                                    )}
                                </div>

                                {/* Phone and Plate */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label htmlFor="phone" className="text-sm font-medium">Phone</label>
                                        <Input
                                            id="phone"
                                            type="tel"
                                            value={guestInfo.phone}
                                            onChange={e => {
                                                setGuestInfo({ ...guestInfo, phone: formatPhone(e.target.value) });
                                                if (fieldErrors.phone) setFieldErrors({ ...fieldErrors, phone: undefined });
                                            }}
                                            className={`h-12 text-lg ${fieldErrors.phone ? "border-red-500" : ""}`}
                                            placeholder="(555) 555-5555"
                                        />
                                        {fieldErrors.phone && (
                                            <p className="text-sm text-red-600 flex items-center gap-1">
                                                <AlertCircle className="w-4 h-4" />
                                                {fieldErrors.phone}
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="plate" className="text-sm font-medium">License Plate</label>
                                        <Input
                                            id="plate"
                                            value={guestInfo.plate}
                                            onChange={e => setGuestInfo({ ...guestInfo, plate: e.target.value.toUpperCase() })}
                                            className="h-12 text-lg"
                                            placeholder="ABC-1234"
                                        />
                                    </div>
                                </div>

                                {/* Zip Code */}
                                <div className="space-y-2">
                                    <label htmlFor="zip-code" className="text-sm font-medium">
                                        Zip Code <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        id="zip-code"
                                        value={guestInfo.zipCode}
                                        onChange={e => {
                                            setGuestInfo({ ...guestInfo, zipCode: e.target.value });
                                            if (fieldErrors.zipCode) setFieldErrors({ ...fieldErrors, zipCode: undefined });
                                        }}
                                        className={`h-12 text-lg ${fieldErrors.zipCode ? "border-red-500" : ""}`}
                                        inputMode="numeric"
                                        placeholder="12345"
                                    />
                                    {fieldErrors.zipCode && (
                                        <p className="text-sm text-red-600 flex items-center gap-1">
                                            <AlertCircle className="w-4 h-4" />
                                            {fieldErrors.zipCode}
                                        </p>
                                    )}
                                </div>

                                {/* Guest Count */}
                                <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                                    <p className="text-sm font-medium text-gray-700">Number of Guests</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex items-center justify-between bg-white rounded-lg p-3 border">
                                            <div className="flex items-center gap-2">
                                                <Users className="w-5 h-5 text-gray-500" />
                                                <span className="text-sm">Adults</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-10 w-10 rounded-full active:scale-[0.95]"
                                                    onClick={() => setGuestInfo({ ...guestInfo, adults: Math.max(1, guestInfo.adults - 1) })}
                                                    aria-label="Decrease adults"
                                                >
                                                    <Minus className="w-4 h-4" />
                                                </Button>
                                                <span className="w-8 text-center font-bold text-lg">{guestInfo.adults}</span>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-10 w-10 rounded-full active:scale-[0.95]"
                                                    onClick={() => setGuestInfo({ ...guestInfo, adults: Math.min(8, guestInfo.adults + 1) })}
                                                    aria-label="Increase adults"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between bg-white rounded-lg p-3 border">
                                            <div className="flex items-center gap-2">
                                                <Baby className="w-5 h-5 text-gray-500" />
                                                <span className="text-sm">Children</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-10 w-10 rounded-full active:scale-[0.95]"
                                                    onClick={() => setGuestInfo({ ...guestInfo, children: Math.max(0, guestInfo.children - 1) })}
                                                    aria-label="Decrease children"
                                                >
                                                    <Minus className="w-4 h-4" />
                                                </Button>
                                                <span className="w-8 text-center font-bold text-lg">{guestInfo.children}</span>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-10 w-10 rounded-full active:scale-[0.95]"
                                                    onClick={() => setGuestInfo({ ...guestInfo, children: Math.min(8, guestInfo.children + 1) })}
                                                    aria-label="Increase children"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Vehicle Type */}
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-gray-700">Vehicle Type</p>
                                    <div className="grid grid-cols-5 gap-2">
                                        {([
                                            { type: "car", icon: Car, label: "Car" },
                                            { type: "truck", icon: Truck, label: "Truck" },
                                            { type: "rv", icon: Home, label: "RV" },
                                            { type: "motorcycle", icon: Bike, label: "Bike" },
                                            { type: "trailer", icon: Tent, label: "Trailer" }
                                        ] as const).map(({ type, icon: Icon, label }) => (
                                            <Button
                                                key={type}
                                                variant={guestInfo.vehicleType === type ? "default" : "outline"}
                                                onClick={() => setGuestInfo({ ...guestInfo, vehicleType: type })}
                                                className="h-16 flex flex-col gap-1 active:scale-[0.98] transition-transform"
                                            >
                                                <Icon className="w-5 h-5" />
                                                <span className="text-xs">{label}</span>
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                <AnimatePresence>
                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            role="alert"
                                            className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-2"
                                        >
                                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                            {error}
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="flex gap-4 pt-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => setState("walkin-sites")}
                                        className="flex-1 h-14 text-lg active:scale-[0.98] transition-transform"
                                    >
                                        ← Back
                                    </Button>
                                    <Button
                                        onClick={handleWalkInSubmit}
                                        disabled={loading}
                                        className="flex-1 h-14 text-lg bg-green-600 hover:bg-green-700 active:scale-[0.98] transition-transform"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="animate-spin mr-2" />
                                                {getLoadingMessage()}
                                            </>
                                        ) : (
                                            "Continue →"
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {/* Details Screen (Lookup Flow) */}
                {state === "details" && reservation && (
                    <motion.div
                        key="details"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={springConfig}
                    >
                        <Card className="w-full max-w-3xl shadow-2xl">
                            <CardHeader className="text-center pb-4 md:pb-6 pt-8 md:pt-10">
                                <CardTitle className="text-2xl md:text-3xl font-bold text-gray-900">
                                    Reservation Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-5 md:space-y-6 px-6 md:px-10 pb-8 md:pb-10">
                                {/* Guest Info */}
                                <motion.div
                                    className="bg-gray-50 rounded-xl p-5 md:p-6"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 }}
                                >
                                    <div className="flex items-center gap-4 mb-4">
                                        <motion.div
                                            className="w-12 h-12 md:w-14 md:h-14 bg-green-100 rounded-full flex items-center justify-center"
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ ...springConfig, delay: 0.2 }}
                                        >
                                            <User className="w-6 h-6 md:w-7 md:h-7 text-green-600" />
                                        </motion.div>
                                        <div>
                                            <p className="text-xl md:text-2xl font-bold text-gray-900">
                                                {reservation.guest?.primaryFirstName} {reservation.guest?.primaryLastName}
                                            </p>
                                            <p className="text-gray-500">{reservation.guest?.email}</p>
                                        </div>
                                    </div>
                                </motion.div>

                                {/* Stay Details */}
                                <div className="grid grid-cols-2 gap-4 md:gap-6">
                                    <motion.div
                                        className="bg-blue-50 rounded-xl p-4 md:p-6"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.2 }}
                                    >
                                        <div className="flex items-center gap-2 md:gap-3 mb-2">
                                            <Calendar className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                                            <span className="text-base md:text-lg font-medium text-gray-700">Check-In</span>
                                        </div>
                                        <p className="text-xl md:text-2xl font-bold text-gray-900">
                                            {format(parseISO(reservation.arrivalDate), "MMM d, yyyy")}
                                        </p>
                                    </motion.div>
                                    <motion.div
                                        className="bg-blue-50 rounded-xl p-4 md:p-6"
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.3 }}
                                    >
                                        <div className="flex items-center gap-2 md:gap-3 mb-2">
                                            <Calendar className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                                            <span className="text-base md:text-lg font-medium text-gray-700">Check-Out</span>
                                        </div>
                                        <p className="text-xl md:text-2xl font-bold text-gray-900">
                                            {format(parseISO(reservation.departureDate), "MMM d, yyyy")}
                                        </p>
                                    </motion.div>
                                </div>

                                {/* Site Assignment */}
                                <motion.div
                                    className="bg-green-50 rounded-xl p-5 md:p-6"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.4 }}
                                >
                                    <div className="flex items-center gap-2 md:gap-3 mb-2">
                                        <MapPin className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                                        <span className="text-base md:text-lg font-medium text-gray-700">Your Site</span>
                                    </div>
                                    <p className="text-2xl md:text-3xl font-bold text-green-700">
                                        {reservation.site?.name || reservation.site?.siteNumber || "Site TBD"}
                                    </p>
                                </motion.div>

                                <div className="flex gap-4 pt-4">
                                    <Button
                                        variant="outline"
                                        onClick={resetKiosk}
                                        className="flex-1 h-12 md:h-14 text-base md:text-lg active:scale-[0.98] transition-transform"
                                    >
                                        <RefreshCw className="w-5 h-5 mr-2" />
                                        Start Over
                                    </Button>

                                    <Button
                                        onClick={() => setState("upsell")}
                                        className="flex-1 h-12 md:h-14 text-base md:text-lg bg-green-600 hover:bg-green-700 active:scale-[0.98] transition-transform"
                                    >
                                        Continue →
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {/* Upsell Screen with Skip Option */}
                {state === "upsell" && (
                    <motion.div
                        key="upsell"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={springConfig}
                    >
                        <Card className="w-full max-w-3xl shadow-2xl">
                            <CardHeader className="text-center pb-4 md:pb-6 pt-8 md:pt-10">
                                <CardTitle className="text-2xl md:text-3xl font-bold text-gray-900">
                                    Make Your Stay Special
                                </CardTitle>
                                <CardDescription className="text-lg md:text-xl text-gray-600 mt-2">
                                    We'll deliver these right to your site!
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6 md:space-y-8 px-6 md:px-10 pb-8 md:pb-10">
                                <div className="grid grid-cols-2 gap-4 md:gap-6">
                                    {/* Firewood */}
                                    <motion.div
                                        className="bg-orange-50 border-2 border-orange-100 rounded-xl p-4 md:p-6 flex flex-col items-center text-center"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.1 }}
                                    >
                                        <div className="w-16 h-16 md:w-20 md:h-20 bg-orange-100 rounded-full flex items-center justify-center mb-3 md:mb-4">
                                            <Flame className="w-8 h-8 md:w-10 md:h-10 text-orange-600" />
                                        </div>
                                        <h3 className="text-xl md:text-2xl font-bold text-gray-900">Firewood</h3>
                                        <p className="text-base md:text-lg text-gray-600 mb-3 md:mb-4">$10.00 / bundle</p>

                                        <div className="flex items-center gap-3 md:gap-4 mt-auto">
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-10 w-10 md:h-12 md:w-12 rounded-full active:scale-[0.95] transition-transform"
                                                onClick={() => setFirewoodQty(Math.max(0, firewoodQty - 1))}
                                                aria-label="Decrease firewood quantity"
                                            >
                                                <Minus className="w-5 h-5 md:w-6 md:h-6" />
                                            </Button>
                                            <motion.span
                                                key={firewoodQty}
                                                initial={{ scale: 1.3, opacity: 0.5 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                className="text-2xl md:text-3xl font-bold w-10 md:w-12 text-center"
                                            >
                                                {firewoodQty}
                                            </motion.span>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-10 w-10 md:h-12 md:w-12 rounded-full active:scale-[0.95] transition-transform"
                                                onClick={() => setFirewoodQty(Math.min(10, firewoodQty + 1))}
                                                aria-label="Increase firewood quantity"
                                            >
                                                <Plus className="w-5 h-5 md:w-6 md:h-6" />
                                            </Button>
                                        </div>
                                    </motion.div>

                                    {/* Ice */}
                                    <motion.div
                                        className="bg-cyan-50 border-2 border-cyan-100 rounded-xl p-4 md:p-6 flex flex-col items-center text-center"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.2 }}
                                    >
                                        <div className="w-16 h-16 md:w-20 md:h-20 bg-cyan-100 rounded-full flex items-center justify-center mb-3 md:mb-4">
                                            <Snowflake className="w-8 h-8 md:w-10 md:h-10 text-cyan-600" />
                                        </div>
                                        <h3 className="text-xl md:text-2xl font-bold text-gray-900">Ice</h3>
                                        <p className="text-base md:text-lg text-gray-600 mb-3 md:mb-4">$5.00 / bag</p>

                                        <div className="flex items-center gap-3 md:gap-4 mt-auto">
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-10 w-10 md:h-12 md:w-12 rounded-full active:scale-[0.95] transition-transform"
                                                onClick={() => setIceQty(Math.max(0, iceQty - 1))}
                                                aria-label="Decrease ice quantity"
                                            >
                                                <Minus className="w-5 h-5 md:w-6 md:h-6" />
                                            </Button>
                                            <motion.span
                                                key={iceQty}
                                                initial={{ scale: 1.3, opacity: 0.5 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                className="text-2xl md:text-3xl font-bold w-10 md:w-12 text-center"
                                            >
                                                {iceQty}
                                            </motion.span>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-10 w-10 md:h-12 md:w-12 rounded-full active:scale-[0.95] transition-transform"
                                                onClick={() => setIceQty(Math.min(10, iceQty + 1))}
                                                aria-label="Increase ice quantity"
                                            >
                                                <Plus className="w-5 h-5 md:w-6 md:h-6" />
                                            </Button>
                                        </div>
                                    </motion.div>
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <Button
                                        variant="ghost"
                                        onClick={() => {
                                            setFirewoodQty(0);
                                            setIceQty(0);
                                            setState("payment");
                                        }}
                                        className="flex-1 h-12 md:h-14 text-base md:text-lg active:scale-[0.98] transition-transform"
                                    >
                                        No thanks, skip
                                    </Button>

                                    <Button
                                        onClick={() => setState("payment")}
                                        className="flex-1 h-12 md:h-14 text-base md:text-lg bg-green-600 hover:bg-green-700 active:scale-[0.98] transition-transform"
                                    >
                                        {firewoodQty > 0 || iceQty > 0 ? "Add to Order →" : "Continue →"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {/* Payment Screen */}
                {state === "payment" && reservation && (
                    <motion.div
                        key="payment"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={springConfig}
                    >
                        <Card className="w-full max-w-2xl shadow-2xl">
                            <CardHeader className="text-center pb-4 md:pb-6 pt-8 md:pt-10">
                                <CardTitle className="text-2xl md:text-3xl font-bold text-gray-900">
                                    Confirm & Pay
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-5 md:space-y-6 px-6 md:px-10 pb-8 md:pb-10">
                                <motion.div
                                    className="bg-gray-50 rounded-xl p-5 md:p-6 space-y-3 md:space-y-4"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    <div className="flex justify-between text-base md:text-lg text-gray-600">
                                        <span>Reservation Balance</span>
                                        <span>${(balanceDue / 100).toFixed(2)}</span>
                                    </div>
                                    {firewoodQty > 0 && (
                                        <div className="flex justify-between text-base md:text-lg text-gray-600">
                                            <span>Firewood ({firewoodQty}x)</span>
                                            <span>${((firewoodQty * 1000) / 100).toFixed(2)}</span>
                                        </div>
                                    )}
                                    {iceQty > 0 && (
                                        <div className="flex justify-between text-base md:text-lg text-gray-600">
                                            <span>Ice ({iceQty}x)</span>
                                            <span>${((iceQty * 500) / 100).toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="border-t border-gray-200 pt-3 md:pt-4 flex justify-between text-xl md:text-2xl font-bold text-gray-900">
                                        <span>Total Due</span>
                                        <span>${(totalDue / 100).toFixed(2)}</span>
                                    </div>
                                </motion.div>

                                {totalDue > 0 ? (
                                    <div className="space-y-4">
                                        {!guestInfo.firstName ? (
                                            <motion.div
                                                className="bg-blue-50 border border-blue-200 rounded-xl p-5 md:p-6 flex items-center gap-4"
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.1 }}
                                            >
                                                <CreditCard className="w-7 h-7 md:w-8 md:h-8 text-blue-600" />
                                                <div>
                                                    <p className="font-bold text-gray-900">Card on File</p>
                                                    <p className="text-gray-600">Visa ending in 4242</p>
                                                </div>
                                                <div className="ml-auto">
                                                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Default</Badge>
                                                </div>
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                className="bg-white border border-gray-200 rounded-xl p-5 md:p-6 space-y-4"
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.1 }}
                                            >
                                                <h3 className="font-semibold text-gray-900">Enter Payment Details</h3>
                                                <div className="space-y-3">
                                                    <Input
                                                        placeholder="Card Number"
                                                        className="h-12 text-lg"
                                                        value={cardDetails.number}
                                                        onChange={e => {
                                                            const formatted = e.target.value
                                                                .replace(/\D/g, '')
                                                                .replace(/(.{4})/g, '$1 ')
                                                                .trim()
                                                                .slice(0, 19);
                                                            setCardDetails({ ...cardDetails, number: formatted });
                                                        }}
                                                        maxLength={19}
                                                        inputMode="numeric"
                                                        aria-label="Card number"
                                                    />
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <Input
                                                            placeholder="MM/YY"
                                                            className="h-12 text-lg"
                                                            value={cardDetails.expiry}
                                                            onChange={e => {
                                                                let value = e.target.value.replace(/\D/g, '').slice(0, 4);
                                                                if (value.length >= 2) {
                                                                    value = value.slice(0, 2) + '/' + value.slice(2);
                                                                }
                                                                setCardDetails({ ...cardDetails, expiry: value });
                                                            }}
                                                            maxLength={5}
                                                            inputMode="numeric"
                                                            aria-label="Expiration date"
                                                        />
                                                        <Input
                                                            type="password"
                                                            placeholder="CVC"
                                                            className="h-12 text-lg"
                                                            value={cardDetails.cvc}
                                                            onChange={e => setCardDetails({ ...cardDetails, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                                                            maxLength={4}
                                                            inputMode="numeric"
                                                            aria-label="Security code"
                                                        />
                                                    </div>
                                                    <Input
                                                        placeholder="Billing Zip Code"
                                                        className="h-12 text-lg"
                                                        value={cardDetails.zip}
                                                        onChange={e => setCardDetails({ ...cardDetails, zip: e.target.value })}
                                                        inputMode="numeric"
                                                        aria-label="Billing zip code"
                                                    />
                                                </div>
                                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                                    </svg>
                                                    Secure 256-bit encrypted payment
                                                </p>
                                            </motion.div>
                                        )}
                                    </div>
                                ) : (
                                    <motion.div
                                        className="bg-green-50 border border-green-200 rounded-xl p-5 md:p-6 text-center text-green-700 font-medium"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.1 }}
                                    >
                                        <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-600" />
                                        No payment required - you're all set!
                                    </motion.div>
                                )}

                                <AnimatePresence>
                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            role="alert"
                                            className="bg-red-50 border border-red-200 text-red-700 px-5 md:px-6 py-4 rounded-lg flex items-start gap-3"
                                        >
                                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                            {error}
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="flex gap-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => setState("upsell")}
                                        className="flex-1 h-12 md:h-14 text-base md:text-lg active:scale-[0.98] transition-transform"
                                    >
                                        ← Back
                                    </Button>
                                    <Button
                                        onClick={handleCheckIn}
                                        disabled={loading || (totalDue > 0 && !!guestInfo.firstName && (!cardDetails.number || !cardDetails.expiry || !cardDetails.cvc))}
                                        className="flex-1 h-12 md:h-14 text-base md:text-lg bg-green-600 hover:bg-green-700 active:scale-[0.98] transition-transform"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle className="w-5 h-5 mr-2" />
                                                {totalDue > 0 ? `Pay $${(totalDue / 100).toFixed(2)}` : "Complete Check-In"}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {/* Success Screen with Celebration */}
                {state === "success" && reservation && (
                    <motion.div
                        key="success"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={springConfig}
                    >
                        <Card className="w-full max-w-2xl shadow-2xl">
                            <CardContent className="text-center py-12 md:py-16 px-6 md:px-10">
                                <motion.div
                                    className="mx-auto w-20 h-20 md:w-24 md:h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 md:mb-8"
                                    initial={{ scale: 0, rotate: -180 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    transition={{ ...springConfig, delay: 0.2 }}
                                >
                                    <CheckCircle className="w-12 h-12 md:w-14 md:h-14 text-green-600" />
                                </motion.div>
                                <motion.h1
                                    className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                >
                                    Check-In Complete!
                                </motion.h1>
                                <motion.p
                                    className="text-lg md:text-xl text-gray-600 mb-6 md:mb-8"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.4 }}
                                >
                                    Welcome, {reservation.guest?.primaryFirstName}! Have a great stay!
                                </motion.p>

                                <motion.div
                                    className="bg-green-50 rounded-xl p-6 md:p-8 mb-6 md:mb-8"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.5, ...springConfig }}
                                >
                                    <p className="text-base md:text-lg text-gray-600 mb-2">Your site is</p>
                                    <motion.p
                                        className="text-4xl md:text-5xl font-bold text-green-700"
                                        initial={{ scale: 1.2, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ delay: 0.7, ...springConfig }}
                                    >
                                        {reservation.site?.name || reservation.site?.siteNumber || "Site TBD"}
                                    </motion.p>
                                </motion.div>

                                {totalDue > 0 && (
                                    <motion.div
                                        className="bg-emerald-50 rounded-xl p-5 md:p-6 mb-6 md:mb-8 text-left flex items-center gap-4 border border-emerald-100"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.6 }}
                                    >
                                        <div className="w-10 h-10 md:w-12 md:h-12 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                                            <CreditCard className="w-5 h-5 md:w-6 md:h-6 text-emerald-600" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 text-base md:text-lg">Payment Successful</p>
                                            <p className="text-gray-600">
                                                <span className="font-semibold text-emerald-700">${(totalDue / 100).toFixed(2)}</span> has been processed.
                                            </p>
                                        </div>
                                    </motion.div>
                                )}

                                {(firewoodQty > 0 || iceQty > 0) && (
                                    <motion.div
                                        className="bg-orange-50 rounded-xl p-5 md:p-6 mb-6 md:mb-8 text-left flex items-center gap-4"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.7 }}
                                    >
                                        <ShoppingBag className="w-7 h-7 md:w-8 md:h-8 text-orange-600 flex-shrink-0" />
                                        <div>
                                            <p className="font-bold text-gray-900">Add-ons Ordered</p>
                                            <p className="text-gray-600">
                                                We'll deliver your firewood and ice to your site shortly.
                                            </p>
                                        </div>
                                    </motion.div>
                                )}

                                {queuedCheckinPending && (
                                    <motion.div
                                        className="bg-amber-50 rounded-xl p-5 md:p-6 mb-6 md:mb-8 text-left flex items-center gap-4 border border-amber-100"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.7 }}
                                    >
                                        <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                                            <RefreshCw className="w-5 h-5 md:w-6 md:h-6 text-amber-600" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900">Saved Offline</p>
                                            <p className="text-gray-600">
                                                We'll sync this when the connection returns.
                                            </p>
                                        </div>
                                    </motion.div>
                                )}

                                <motion.div
                                    className="bg-blue-50 rounded-xl p-5 md:p-6 text-left"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.8 }}
                                >
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
                                </motion.div>

                                <motion.p
                                    className="text-sm text-gray-500 mt-6 md:mt-8"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 1 }}
                                >
                                    This screen will reset in a moment...
                                </motion.p>

                                <motion.div
                                    className="flex flex-wrap gap-3 md:gap-4 justify-center mt-6"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.9 }}
                                >
                                    <Button
                                        variant="outline"
                                        onClick={handleEmailReceipt}
                                        className="h-12 px-6 md:px-8 active:scale-[0.98] transition-transform"
                                    >
                                        <Mail className="w-5 h-5 mr-2" />
                                        Email Receipt
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={resetKiosk}
                                        className="h-12 px-6 md:px-8 active:scale-[0.98] transition-transform"
                                    >
                                        <RefreshCw className="w-5 h-5 mr-2" />
                                        New Check-In
                                    </Button>
                                </motion.div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Offline indicator - more prominent */}
            <AnimatePresence>
                {!isOnline && (
                    <motion.div
                        initial={{ y: -100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -100, opacity: 0 }}
                        className="fixed top-0 left-0 right-0 bg-amber-500 text-white py-3 md:py-4 px-6 shadow-lg z-50"
                    >
                        <div className="max-w-4xl mx-auto flex items-center gap-3 md:gap-4">
                            <motion.div
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                            >
                                <AlertCircle className="w-5 h-5 md:w-6 md:h-6" />
                            </motion.div>
                            <div className="flex-1">
                                <p className="font-semibold text-base md:text-lg">Limited connectivity</p>
                                <p className="text-xs md:text-sm opacity-90">Check-ins will be saved and processed when connection returns.</p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Session timeout countdown with extend button */}
            <AnimatePresence>
                {state !== "home" && state !== "setup" && !loading && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="fixed bottom-4 md:bottom-8 right-4 md:right-8"
                    >
                        <div
                            className={`flex items-center gap-2 md:gap-3 rounded-full px-4 md:px-5 py-2.5 md:py-3 shadow-lg transition-colors ${
                                showTimeWarning
                                    ? "bg-red-500 text-white"
                                    : "bg-white/90 backdrop-blur border border-gray-200 text-gray-600"
                            }`}
                        >
                            <Clock className={`w-4 h-4 md:w-5 md:h-5 ${showTimeWarning ? "animate-pulse" : ""}`} />
                            <span className="text-sm md:text-base font-medium">
                                {showTimeWarning ? `Resetting in ${secondsRemaining}s` : `${secondsRemaining}s`}
                            </span>
                            {showTimeWarning && (
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={handleActivity}
                                    className="ml-2 h-7 md:h-8 px-3 bg-white text-red-600 hover:bg-gray-100 active:scale-[0.95]"
                                >
                                    I'm here
                                </Button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Queue indicator - less technical */}
            {queuedCheckins > 0 && isOnline && (
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="fixed bottom-4 md:bottom-8 left-4 md:left-8 bg-blue-100 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg shadow-lg"
                >
                    <p className="font-medium text-sm md:text-base">
                        Processing {queuedCheckins} check-in{queuedCheckins > 1 ? "s" : ""}...
                    </p>
                </motion.div>
            )}

            {/* Conflicts - simplified for kiosk */}
            {conflicts.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="fixed top-4 md:top-6 right-4 md:right-6 w-64 md:w-72 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 p-3 text-sm space-y-2 shadow-lg z-40"
                >
                    <div className="font-semibold">Needs attention</div>
                    {conflicts.slice(0, 2).map((c) => (
                        <div key={c.id} className="flex items-center gap-2">
                            <Button size="sm" variant="secondary" onClick={() => retryConflict(c.id)} className="active:scale-[0.95]">
                                Retry
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => discardConflict(c.id)} className="active:scale-[0.95]">
                                Dismiss
                            </Button>
                        </div>
                    ))}
                </motion.div>
            )}
        </div>
    );
}
