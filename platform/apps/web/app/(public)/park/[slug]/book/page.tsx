"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import Link from "next/link";
import Image from "next/image";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { WaitlistDialog } from "@/components/waitlist/WaitlistDialog";
import { Badge } from "@/components/ui/badge";
import { useAnalyticsEmitters } from "./useAnalytics";
import { trackEvent } from "@/lib/analytics";
import {
    Check, Moon, CalendarDays, Caravan, Tent, Car, Home, Sparkles, Users, Lock,
    Frown, CheckCircle, Shield, CreditCard, Star, Mail, Calendar, MapPin,
    Copy, ArrowLeft, Printer, Share2, AlertCircle, Loader2, Zap
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { RoundUpForCharity } from "@/components/checkout/RoundUpForCharity";
import { BookingFormsSection } from "@/components/booking/BookingFormsSection";
import { NaturalLanguageSearch } from "@/components/booking/NaturalLanguageSearch";

const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
if (!stripeKey) {
    console.error("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not configured. Stripe payments will not work.");
}
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

type BookingStep = 1 | 2 | 3 | 4;

type AvailableSite = Awaited<ReturnType<typeof apiClient.getPublicAvailability>>[0];
type Quote = Awaited<ReturnType<typeof apiClient.getPublicQuote>>;

interface AdditionalGuest {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
}

interface ChildDetails {
    name: string;
    gender: string;
    age: string;
}

interface GuestInfo {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    zipCode: string;
    adults: number;
    children: number;
    petCount: number;
    petTypes: string[];
    additionalGuests: AdditionalGuest[];
    childrenDetails: ChildDetails[];
    stayReasonPreset: string;
    stayReasonOther: string;
    referralCode: string;
    needsAccessible: boolean;
    equipment: {
        type: string;
        length: string;
        plateNumber: string;
        plateState: string;
    };
}

const mapSiteTypeToEquipmentType = (siteType?: string | null) => {
    const normalized = (siteType || "").toLowerCase();
    if (normalized === "tent") return "tent";
    if (normalized === "trailer" || normalized === "rv") return "rv";
    if (normalized === "car") return "car";
    if (["cabin", "yurt", "glamping", "group"].includes(normalized)) return "car";
    return "car";
};

const normalizeSiteType = (siteType?: string | null) => {
    const normalized = (siteType || "").toLowerCase();
    if (["trailer", "rv"].includes(normalized)) return "rv";
    if (["car", "van"].includes(normalized)) return "car";
    if (!normalized) return "other";
    return normalized;
};

const siteTypeLabel = (siteType: string) => {
    switch (siteType) {
        case "rv":
            return "RV / Trailer";
        case "tent":
            return "Tent";
        case "cabin":
            return "Cabin";
        case "glamping":
            return "Glamping";
        case "yurt":
            return "Yurt";
        case "group":
            return "Group Site";
        case "car":
            return "Car / Van";
        default:
            return "Other";
    }
};

const matchesSiteType = (selected: string, actual?: string | null) => {
    if (!selected || selected === "all") return true;
    const normalizedSelected = normalizeSiteType(selected);
    const normalizedActual = normalizeSiteType(actual);
    return normalizedSelected === normalizedActual;
};

const formatDateInput = (date: Date) => date.toISOString().split("T")[0];
const addDaysToDate = (date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};
const getNightsBetween = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diff = endDate.getTime() - startDate.getTime();
    return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
};

// Price Estimate Component
function PriceEstimate({
    arrivalDate,
    departureDate,
    selectedSite,
    availableSites,
    selectedSiteType,
    isLoadingSites,
    step,
    campgroundSiteClasses
}: {
    arrivalDate: string;
    departureDate: string;
    selectedSite: AvailableSite | null;
    availableSites: AvailableSite[] | undefined;
    selectedSiteType: string;
    isLoadingSites: boolean;
    step: BookingStep;
    campgroundSiteClasses?: any[];
}) {
    const nights = arrivalDate && departureDate ? getNightsBetween(arrivalDate, departureDate) : 0;

    // Calculate price estimate
    const priceEstimate = useMemo(() => {
        // If we have a selected site, use its exact rate
        if (selectedSite?.siteClass?.defaultRate) {
            return {
                perNight: selectedSite.siteClass.defaultRate / 100,
                total: (selectedSite.siteClass.defaultRate / 100) * nights,
                isExact: true
            };
        }

        // Otherwise, calculate a range from available sites
        if (availableSites && availableSites.length > 0) {
            const filteredSites = availableSites.filter(site => {
                if (!site.siteClass?.defaultRate) return false;
                if (selectedSiteType === "all") return true;
                return matchesSiteType(selectedSiteType, site.siteClass?.siteType || site.siteType);
            });

            if (filteredSites.length > 0) {
                const rates = filteredSites.map(s => s.siteClass!.defaultRate / 100);
                const minRate = Math.min(...rates);
                const maxRate = Math.max(...rates);

                if (minRate === maxRate) {
                    return {
                        perNight: minRate,
                        total: minRate * nights,
                        isExact: false
                    };
                }

                return {
                    minPerNight: minRate,
                    maxPerNight: maxRate,
                    minTotal: minRate * nights,
                    maxTotal: maxRate * nights,
                    isRange: true
                };
            }
        }

        // Fall back to campground site classes if no sites loaded yet (step 1)
        if (step === 1 && campgroundSiteClasses && campgroundSiteClasses.length > 0) {
            const filteredClasses = campgroundSiteClasses.filter(sc => {
                if (!sc.defaultRate) return false;
                if (selectedSiteType === "all") return true;
                return matchesSiteType(selectedSiteType, sc.siteType);
            });

            if (filteredClasses.length > 0) {
                const rates = filteredClasses.map(sc => sc.defaultRate / 100);
                const minRate = Math.min(...rates);
                const maxRate = Math.max(...rates);

                if (minRate === maxRate) {
                    return {
                        perNight: minRate,
                        total: minRate * nights,
                        isExact: false
                    };
                }

                return {
                    minPerNight: minRate,
                    maxPerNight: maxRate,
                    minTotal: minRate * nights,
                    maxTotal: maxRate * nights,
                    isRange: true
                };
            }
        }

        return null;
    }, [selectedSite, availableSites, selectedSiteType, nights, step, campgroundSiteClasses]);

    if (!arrivalDate || !departureDate || nights < 1) {
        return null;
    }

    if (isLoadingSites && !selectedSite) {
        return (
            <div className="bg-status-success/15 border border-status-success/30 rounded-lg p-3 mb-6">
                <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-600">Calculating estimate...</div>
                    <div className="animate-pulse h-6 w-20 bg-status-success/30 rounded"></div>
                </div>
            </div>
        );
    }

    if (!priceEstimate) {
        return null;
    }

    return (
        <div className="bg-status-success/15 border border-status-success/30 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-sm text-slate-600 mb-1">
                        {step === 1 ? "Estimated price" : step === 2 && !selectedSite ? "Price range" : "Your price"}
                    </div>
                    <div className="text-xs text-slate-500">
                        {nights} {nights === 1 ? "night" : "nights"}
                    </div>
                </div>
                <div className="text-right">
                    {priceEstimate.isRange ? (
                        <>
                            <div className="text-2xl font-bold text-status-success">
                                ${priceEstimate.minTotal?.toFixed(0)} - ${priceEstimate.maxTotal?.toFixed(0)}
                            </div>
                            <div className="text-xs text-slate-500">
                                ${priceEstimate.minPerNight?.toFixed(0)} - ${priceEstimate.maxPerNight?.toFixed(0)}/night
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="text-2xl font-bold text-status-success">
                                {priceEstimate.isExact ? "" : "From "}${priceEstimate.total?.toFixed(0)}
                            </div>
                            <div className="text-xs text-slate-500">
                                ${priceEstimate.perNight?.toFixed(0)}/night
                            </div>
                        </>
                    )}
                </div>
            </div>
            {(step === 1 || (step === 2 && !selectedSite)) && (
                <div className="text-xs text-slate-500 mt-2">
                    Final price shown at checkout (excludes fees and taxes)
                </div>
            )}
        </div>
    );
}

// Progress Indicator
function BookingProgress({ currentStep }: { currentStep: BookingStep }) {
    const steps = [
        { num: 1, label: "Dates" },
        { num: 2, label: "Site" },
        { num: 3, label: "Details" },
        { num: 4, label: "Payment" }
    ];

    return (
        <div className="flex items-center justify-center gap-1 sm:gap-2 mb-8">
            {steps.map((step, idx) => (
                <div key={step.num} className="flex items-center">
                    <div
                        className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full text-sm font-semibold transition-all ${step.num < currentStep
                            ? "bg-status-success text-white"
                            : step.num === currentStep
                                ? "bg-status-success text-white ring-4 ring-status-success/30"
                                : "bg-slate-200 text-slate-500"
                            }`}
                    >
                        {step.num < currentStep ? <Check className="h-4 w-4" /> : step.num}
                    </div>
                    <span className={`ml-2 text-xs sm:text-sm font-medium hidden sm:inline ${step.num <= currentStep ? "text-status-success" : "text-slate-400"
                        }`}>
                        {step.label}
                    </span>
                    {idx < steps.length - 1 && (
                        <div className={`w-6 sm:w-12 h-1 mx-2 rounded ${step.num < currentStep ? "bg-status-success" : "bg-slate-200"
                            }`} />
                    )}
                </div>
            ))}
        </div>
    );
}

// Step 1: Date Selection
function DateStep({
    arrivalDate,
    departureDate,
    selectedSiteType,
    onArrivalChange,
    onDepartureChange,
    onSiteTypeChange,
    onNext,
    slug,
    onApplyNLSearch
}: {
    arrivalDate: string;
    departureDate: string;
    selectedSiteType: string;
    onArrivalChange: (d: string) => void;
    onDepartureChange: (d: string) => void;
    onSiteTypeChange: (type: string) => void;
    onNext: () => void;
    slug: string;
    onApplyNLSearch?: (intent: any, results: any[]) => void;
}) {
    const today = new Date().toISOString().split("T")[0];
    const isValid = arrivalDate && departureDate && arrivalDate < departureDate && arrivalDate >= today;

    const siteTypeOptions = [
        { value: "rv", label: "RV / Trailer" },
        { value: "tent", label: "Tent" },
        { value: "cabin", label: "Cabin" },
        { value: "glamping", label: "Glamping" },
        { value: "yurt", label: "Yurt" },
        { value: "group", label: "Group Site" },
        { value: "car", label: "Car / Van" },
        { value: "all", label: "All types" }
    ];

    // Get next Friday from a given date
    const getNextFriday = (from: Date) => {
        const day = from.getDay();
        const daysUntilFriday = (5 - day + 7) % 7 || 7; // If already Friday, get next Friday
        return addDaysToDate(from, daysUntilFriday);
    };

    // Quick button handlers
    const handleTonight = () => {
        const now = new Date();
        onArrivalChange(formatDateInput(now));
        onDepartureChange(formatDateInput(addDaysToDate(now, 1)));
    };

    const handleWeekend = () => {
        const now = new Date();
        const friday = getNextFriday(now);
        const sunday = addDaysToDate(friday, 2);
        onArrivalChange(formatDateInput(friday));
        onDepartureChange(formatDateInput(sunday));
    };

    const handleThreeNights = () => {
        const now = new Date();
        onArrivalChange(formatDateInput(now));
        onDepartureChange(formatDateInput(addDaysToDate(now, 3)));
    };

    const handleOneWeek = () => {
        const now = new Date();
        onArrivalChange(formatDateInput(now));
        onDepartureChange(formatDateInput(addDaysToDate(now, 7)));
    };

    const handleOneMonth = () => {
        const now = new Date();
        const departure = new Date(now);
        departure.setMonth(departure.getMonth() + 1);
        onArrivalChange(formatDateInput(now));
        onDepartureChange(formatDateInput(departure));
    };

    // Auto-populate departure when arrival changes (default 3 nights)
    const handleArrivalChange = (value: string) => {
        onArrivalChange(value);
        if (!value) return;

        const arrival = new Date(value);
        const hasDeparture = !!departureDate;
        const departure = departureDate ? new Date(departureDate) : null;

        if (!hasDeparture) {
            onDepartureChange(formatDateInput(addDaysToDate(arrival, 3)));
            return;
        }

        if (departure && departure <= arrival) {
            onDepartureChange(formatDateInput(addDaysToDate(arrival, 1)));
        }
    };

    return (
        <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">Select Your Dates</h2>

            {/* Natural Language Search */}
            {onApplyNLSearch && (
                <div className="mb-8">
                    <NaturalLanguageSearch
                        slug={slug}
                        onApplyIntent={(intent, results) => {
                            // Apply dates from intent
                            if (intent.arrivalDate) onArrivalChange(intent.arrivalDate);
                            if (intent.departureDate) onDepartureChange(intent.departureDate);
                            // Apply site type from intent
                            if (intent.siteType) onSiteTypeChange(intent.siteType);
                            // Call the parent handler with full intent and results
                            onApplyNLSearch(intent, results);
                        }}
                        className="w-full"
                    />

                    <div className="flex items-center gap-3 my-6">
                        <div className="flex-1 h-px bg-slate-200" />
                        <span className="text-sm text-slate-500">or select manually</span>
                        <div className="flex-1 h-px bg-slate-200" />
                    </div>
                </div>
            )}

            {/* Quick Booking Buttons */}
            <div className="mb-6">
                <p className="text-sm font-medium text-slate-600 mb-3 text-center">Quick Select</p>
                <div className="flex flex-wrap gap-2 justify-center">
                    <button
                        type="button"
                        onClick={handleTonight}
                        className="px-4 py-2 bg-slate-100 hover:bg-status-success/20 text-slate-700 hover:text-status-success rounded-lg text-sm font-medium transition-colors border border-slate-200 hover:border-status-success/50 inline-flex items-center gap-1"
                    >
                        <Moon className="h-4 w-4" /> Tonight
                    </button>
                    <button
                        type="button"
                        onClick={handleWeekend}
                        className="px-4 py-2 bg-slate-100 hover:bg-status-success/20 text-slate-700 hover:text-status-success rounded-lg text-sm font-medium transition-colors border border-slate-200 hover:border-status-success/50 inline-flex items-center gap-1"
                    >
                        <CalendarDays className="h-4 w-4" /> Weekend
                    </button>
                    <button
                        type="button"
                        onClick={handleThreeNights}
                        className="px-4 py-2 bg-slate-100 hover:bg-status-success/20 text-slate-700 hover:text-status-success rounded-lg text-sm font-medium transition-colors border border-slate-200 hover:border-status-success/50"
                    >
                        3 Nights
                    </button>
                    <button
                        type="button"
                        onClick={handleOneWeek}
                        className="px-4 py-2 bg-slate-100 hover:bg-status-success/20 text-slate-700 hover:text-status-success rounded-lg text-sm font-medium transition-colors border border-slate-200 hover:border-status-success/50"
                    >
                        1 Week
                    </button>
                    <button
                        type="button"
                        onClick={handleOneMonth}
                        className="px-4 py-2 bg-slate-100 hover:bg-status-success/20 text-slate-700 hover:text-status-success rounded-lg text-sm font-medium transition-colors border border-slate-200 hover:border-status-success/50"
                    >
                        1 Month
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Site type</label>
                    <select
                        value={selectedSiteType}
                        onChange={(e) => onSiteTypeChange(e.target.value)}
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-lg"
                    >
                        {siteTypeOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Check-in Date</label>
                    <input
                        type="date"
                        value={arrivalDate}
                        onChange={(e) => handleArrivalChange(e.target.value)}
                        min={today}
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-lg"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Check-out Date</label>
                    <input
                        type="date"
                        value={departureDate}
                        onChange={(e) => onDepartureChange(e.target.value)}
                        min={arrivalDate || today}
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-lg"
                    />
                </div>
                {arrivalDate && departureDate && arrivalDate >= departureDate && (
                    <p className="text-status-error text-sm">Check-out must be after check-in</p>
                )}
            </div>
            <button
                onClick={onNext}
                disabled={!isValid}
                className="w-full mt-6 py-4 bg-status-success text-white font-semibold rounded-xl hover:bg-status-success/90 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
            >
                Check Availability
            </button>
        </div>
    );
}

// Step 2: Site Selection
function SiteStep({
    sites,
    allSites,
    isLoading,
    selectedSiteId,
    onSelect,
    onNext,
    onBack,
    campgroundId,
    arrivalDate,
    departureDate,
    selectedSiteType,
    siteClasses,
    onChangeSiteType,
    currentSiteType,
    nextAvailability,
    onApplySuggestedDates,
    heroImage,
    onBookSelected,
    siteSelectionFeeCents,
    onProceedWithoutLock
}: {
    sites: AvailableSite[];
    allSites: AvailableSite[];
    isLoading: boolean;
    selectedSiteId: string | null;
    onSelect: (id: string) => void;
    onNext: () => void;
    onBack: () => void;
    campgroundId: string;
    arrivalDate: string;
    departureDate: string;
    selectedSiteType?: string;
    siteClasses?: any[];
    onChangeSiteType?: (type: string) => void;
    currentSiteType?: string;
    nextAvailability?: { arrivalDate: string; departureDate: string; site: AvailableSite } | null;
    onApplySuggestedDates?: (arrival: string, departure: string) => void;
    heroImage?: string | null;
    onBookSelected?: () => void;
    siteSelectionFeeCents?: number | null;
    onProceedWithoutLock?: () => void;
}) {
    const siteTypeIcons: Record<string, React.ReactNode> = {
        rv: <Caravan className="h-5 w-5" />,
        trailer: <Caravan className="h-5 w-5" />,
        tent: <Tent className="h-5 w-5" />,
        car: <Car className="h-5 w-5" />,
        cabin: <Home className="h-5 w-5" />,
        yurt: <Home className="h-5 w-5" />,
        group: <Users className="h-5 w-5" />,
        glamping: <Sparkles className="h-5 w-5" />
    };

    const StatusBadge = ({ status }: { status: string }) => {
        switch (status) {
            case 'available':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-status-success/15 text-status-success">Available</span>;
            case 'booked':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-status-error/15 text-status-error">Booked</span>;
            case 'maintenance':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-status-warning/15 text-status-warning">Maintenance</span>;
            case 'locked':
            default:
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">Unavailable</span>;
        }
    };

    // Amenity filter state
    const [filters, setFilters] = useState<{
        fullHookups: boolean;
        petFriendly: boolean;
        accessible: boolean;
        pullThrough: boolean;
    }>({
        fullHookups: false,
        petFriendly: false,
        accessible: false,
        pullThrough: false,
    });

    // Apply filters to sites
    const filteredSites = useMemo(() => {
        return sites.filter((site) => {
            const sc = site.siteClass;
            if (filters.fullHookups) {
                if (!(sc?.hookupsPower && sc?.hookupsWater && sc?.hookupsSewer)) return false;
            }
            if (filters.petFriendly && !sc?.petFriendly) return false;
            if (filters.accessible && !(site.accessible || sc?.accessible)) return false;

            // Type-safe access to optional properties
            type SiteWithOptional = typeof site & { pullThrough?: boolean };
            type SiteClassWithOptional = typeof sc & { rvOrientation?: string };
            const siteExtended = site as SiteWithOptional;
            const scExtended = sc as SiteClassWithOptional;

            if (filters.pullThrough && !siteExtended.pullThrough && !scExtended?.rvOrientation?.includes("pull")) return false;
            return true;
        });
    }, [sites, filters]);

    const hasActiveFilters = Object.values(filters).some(v => v);

    const availableAlternativeSites = (allSites || []).filter((site) => site.status === "available");
    const alternativeTypeSuggestions = availableAlternativeSites.reduce((acc, site) => {
        const type = normalizeSiteType(site.siteClass?.siteType || site.siteType || "other");
        if (currentSiteType && normalizeSiteType(currentSiteType) === type) return acc;
        if (!acc[type]) acc[type] = [];
        acc[type].push(site);
        return acc;
    }, {} as Record<string, AvailableSite[]>);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
                {/* Animated tent icon */}
                <div className="relative">
                    <Tent className="h-12 w-12 text-emerald-500 animate-pulse" />
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-slate-200/50 rounded-full blur-sm" />
                </div>
                <div className="text-center space-y-1">
                    <p className="text-slate-700 font-medium">Finding available sites...</p>
                    <p className="text-sm text-slate-500">We're checking what's open for your dates</p>
                </div>
                {/* Animated progress dots */}
                <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                        <div
                            key={i}
                            className="w-2 h-2 rounded-full bg-emerald-400"
                            style={{ animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite` }}
                        />
                    ))}
                </div>
            </div>
        );
    }

    if (sites.length === 0) {
        // Try to find the specific site class ID if we are filtering by type
        let waitlistSiteClassId: string | undefined;
        let waitlistLabel = "Join Waitlist";

        if (selectedSiteType && selectedSiteType !== "all" && siteClasses) {
            const matchingClasses = siteClasses.filter(sc => sc.siteType === selectedSiteType);
            if (matchingClasses.length === 1) {
                waitlistSiteClassId = matchingClasses[0].id;
                waitlistLabel = `Join ${matchingClasses[0].name} Waitlist`;
            } else if (matchingClasses.length > 1) {
                waitlistLabel = `Join ${selectedSiteType.charAt(0).toUpperCase() + selectedSiteType.slice(1)} Waitlist`;
                waitlistSiteClassId = matchingClasses[0].id;
            }
        }

        return (
            <div className="text-center py-12 space-y-5">
                <div>
                    <Frown className="h-16 w-16 text-slate-400 mx-auto" />
                    <h3 className="text-xl font-bold text-slate-900 mt-4">No Sites Available</h3>
                    <p className="text-slate-600 mt-2">Sorry, there are no sites available for your selected dates.</p>
                </div>

                {nextAvailability && onApplySuggestedDates && (
                    <div className="border border-status-success/30 bg-status-success/15 rounded-xl p-4 text-left max-w-lg mx-auto">
                        <div className="text-sm font-semibold text-status-success flex items-center gap-2">
                            <span>Next opening we found</span>
                        </div>
                        <p className="text-slate-700 mt-1">
                            {new Date(nextAvailability.arrivalDate).toLocaleDateString()} → {new Date(nextAvailability.departureDate).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-slate-600">
                            Example site: <span className="font-medium text-slate-800">{nextAvailability.site.name}</span> ({nextAvailability.site.siteClass?.name || "Any type"})
                        </p>
                        <button
                            onClick={() => onApplySuggestedDates(nextAvailability.arrivalDate, nextAvailability.departureDate)}
                            className="mt-3 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-status-success text-white text-sm font-medium hover:bg-status-success/90 transition-colors"
                        >
                            Use these dates
                        </button>
                    </div>
                )}

                {Object.keys(alternativeTypeSuggestions).length > 0 && onChangeSiteType && (
                    <div className="space-y-3 max-w-2xl mx-auto">
                        <p className="text-sm text-slate-700 font-medium">We found availability in other site types:</p>
                        <div className="flex flex-wrap gap-3 justify-center">
                            {Object.entries(alternativeTypeSuggestions).map(([type, typeSites]) => (
                                <button
                                    key={type}
                                    onClick={() => onChangeSiteType(type)}
                                    className="px-4 py-2 rounded-lg border border-status-success/30 bg-white shadow-sm hover:border-emerald-400 transition-colors text-sm font-semibold text-status-success"
                                >
                                    {siteTypeIcons[type] || <Tent className="h-5 w-5" />} {siteTypeLabel(type)} ({typeSites.length} open)
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-slate-500">Selecting switches to that site type so you can book it.</p>
                    </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <button
                        onClick={onBack}
                        className="px-6 py-3 bg-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-300 transition-colors"
                    >
                        ← Choose Different Dates
                    </button>
                    <WaitlistDialog
                        campgroundId={campgroundId}
                        arrivalDate={arrivalDate}
                        departureDate={departureDate}
                        siteTypeId={waitlistSiteClassId}
                        trigger={
                            <button className="px-6 py-3 bg-status-success text-white font-medium rounded-xl hover:bg-status-success/90 transition-colors">
                                {waitlistLabel}
                            </button>
                        }
                    />
                </div>
            </div>
        );
    }

    // Group by site class (using filtered sites)
    const sitesByClass = filteredSites.reduce((acc, site) => {
        const className = site.siteClass?.name || "Other";
        if (!acc[className]) acc[className] = [];
        acc[className].push(site);
        return acc;
    }, {} as Record<string, AvailableSite[]>);

    // Filter toggle component
    const FilterChip = ({ label, icon, active, onClick }: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void }) => (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                active
                    ? "bg-status-success/15 text-status-success border border-status-success/30"
                    : "bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200"
            }`}
        >
            {icon}
            {label}
        </button>
    );

    return (
        <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">Choose Your Site</h2>

            {/* Filter Panel */}
            <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-medium text-slate-700">Filter by:</span>
                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={() => setFilters({ fullHookups: false, petFriendly: false, accessible: false, pullThrough: false })}
                            className="text-xs text-status-success hover:text-status-success/90 font-medium"
                        >
                            Clear all
                        </button>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    <FilterChip
                        label="Full Hookups"
                        icon={<Zap className="h-3.5 w-3.5" />}
                        active={filters.fullHookups}
                        onClick={() => setFilters(f => ({ ...f, fullHookups: !f.fullHookups }))}
                    />
                    <FilterChip
                        label="Pet Friendly"
                        icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/></svg>}
                        active={filters.petFriendly}
                        onClick={() => setFilters(f => ({ ...f, petFriendly: !f.petFriendly }))}
                    />
                    <FilterChip
                        label="ADA Accessible"
                        icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="16" cy="4" r="1"/><path d="m18 19 1-7-6 1"/><path d="m5 8 3-3 5.5 3-2.36 3.5"/><path d="M4.24 14.5a5 5 0 1 0 6.88 6"/><path d="M13.76 17.5a5 5 0 0 0-6.88-6"/></svg>}
                        active={filters.accessible}
                        onClick={() => setFilters(f => ({ ...f, accessible: !f.accessible }))}
                    />
                    <FilterChip
                        label="Pull-Through"
                        icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5"/><path d="M14 17h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>}
                        active={filters.pullThrough}
                        onClick={() => setFilters(f => ({ ...f, pullThrough: !f.pullThrough }))}
                    />
                </div>
            </div>

            <p className="text-center text-slate-600 mb-2">
                {filteredSites.length} sites found
                {hasActiveFilters && filteredSites.length !== sites.length && (
                    <span className="text-slate-400"> (of {sites.length} total)</span>
                )}
            </p>
            {sites.length > 0 && sites.length <= 3 && (
                <p className="text-center text-status-warning text-sm font-semibold mb-4">
                    Only {sites.length} left for these dates. Sites are held for a short time during checkout.
                </p>
            )}

            {Object.entries(sitesByClass).map(([className, classSites]) => (
                <div key={className} className="mb-10">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-slate-600">{siteTypeIcons[classSites[0]?.siteClass?.siteType || "tent"] || <Tent className="h-5 w-5" />}</span>
                        <h3 className="text-lg font-semibold text-slate-900">{className}</h3>
                        {classSites[0]?.siteClass?.defaultRate && (
                            <span className="text-status-success font-semibold ml-auto">
                                ${(classSites[0].siteClass.defaultRate / 100).toFixed(0)}/night
                            </span>
                        )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        {classSites.map((site) => {
                            const isAvailable = site.status === 'available';
                            const selected = selectedSiteId === site.id;

                            // Type-safe access to optional photoUrl property
                            type SiteClassWithPhoto = typeof site.siteClass & { photoUrl?: string };
                            const siteClassExtended = site.siteClass as SiteClassWithPhoto;
                            const cardImage = siteClassExtended?.photoUrl || heroImage || "/placeholder.png";
                            const selectionFeeDisplay = siteSelectionFeeCents && siteSelectionFeeCents > 0
                                ? `$${(siteSelectionFeeCents / 100).toFixed(2)} site selection fee`
                                : null;
                            return (
                                <button
                                    type="button"
                                    key={site.id}
                                    onClick={() => isAvailable && onSelect(site.id)}
                                    disabled={!isAvailable}
                                    className={`group overflow-hidden rounded-2xl border transition-all text-left ${selected
                                        ? "border-emerald-500 ring-2 ring-emerald-200"
                                        : "border-slate-200 hover:border-status-success/50 hover:shadow-md"
                                        } ${!isAvailable ? "opacity-60 cursor-not-allowed" : ""}`}
                                >
                                    <div className="relative h-48 w-full overflow-hidden">
                                        <Image
                                            src={cardImage}
                                            alt={site.name}
                                            fill
                                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent" />
                                        <div className="absolute top-3 left-3 flex gap-2">
                                            <Badge variant="secondary" className="bg-black/60 text-white border-white/10">
                                                {site.siteClass?.siteType?.toUpperCase() || "SITE"}
                                            </Badge>
                                            <StatusBadge status={site.status || 'available'} />
                                        </div>
                                        {selected && (
                                            <div className="absolute bottom-3 right-3 rounded-full bg-status-success text-white text-xs px-3 py-1 shadow-lg">
                                                Selected
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4 space-y-2 bg-white">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <div className="font-semibold text-slate-900">{site.name}</div>
                                                <div className="text-xs text-slate-500">#{site.siteNumber}</div>
                                            </div>
                                            {site.siteClass?.defaultRate && (
                                                <div className="text-right">
                                                    <div className="text-lg font-bold text-status-success">
                                                        ${(site.siteClass.defaultRate / 100).toFixed(0)}
                                                    </div>
                                                    <div className="text-xs text-slate-500">per night</div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                                            {site.siteClass?.maxOccupancy && <Badge variant="outline">Up to {site.siteClass.maxOccupancy} guests</Badge>}
                                            {site.siteClass?.hookupsPower && <Badge variant="outline">Power</Badge>}
                                            {site.siteClass?.hookupsWater && <Badge variant="outline">Water</Badge>}
                                            {site.siteClass?.hookupsSewer && <Badge variant="outline">Sewer</Badge>}
                                            {site.siteClass?.petFriendly && <Badge variant="outline">Pet friendly</Badge>}
                                            {site.rigMaxLength && (
                                                <Badge variant="outline">Max {site.rigMaxLength}ft rig</Badge>
                                            )}
                                            {(site.accessible || site.siteClass?.accessible) && (
                                                <Badge variant="outline" className="border-status-success/30 text-status-success">
                                                    ADA Accessible
                                                </Badge>
                                            )}
                                        </div>
                                        {selected && (
                                            <div className="mt-3 flex flex-col gap-2">
                                                {selectionFeeDisplay ? (
                                                    <div className="text-sm text-status-success bg-status-success/15 border border-status-success/30 rounded-lg px-3 py-2 flex items-center gap-2">
                                                        <Lock className="h-4 w-4" />
                                                        <span>
                                                            Selecting this site adds {selectionFeeDisplay} (set by the campground). Fees apply only when you lock a specific site.
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                                                        Lock in this exact site. Fees, if any, are shown at checkout when the campground charges for site selection.
                                                    </div>
                                                )}
                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); onBookSelected?.(); }}
                                                        className="px-4 py-2 rounded-lg bg-status-success text-white text-sm font-semibold hover:bg-status-success/90 transition-colors"
                                                    >
                                                        Book now
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}

            <div className="flex gap-3 mt-8">
                <button
                    onClick={onBack}
                    className="flex-1 py-4 bg-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-300 transition-colors"
                >
                    ← Back
                </button>
                <button
                    onClick={onNext}
                    disabled={!selectedSiteId}
                    className="flex-1 py-4 bg-status-success text-white font-semibold rounded-xl hover:bg-status-success/90 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                >
                    Continue →
                </button>
            </div>
            <div className="mt-4">
                <button
                    type="button"
                    onClick={onProceedWithoutLock}
                    className="w-full text-sm text-status-success font-semibold underline hover:text-status-success"
                >
                    Prefer not to lock a specific site? Continue with this site type and we’ll assign the best available.
                </button>
            </div>
        </div>
    );
}

// Step 3: Guest Info
function GuestStep({
    guestInfo,
    onChange,
    onNext,
    onBack,
    maxRigLength,
    campgroundId,
    slug
}: {
    guestInfo: GuestInfo;
    onChange: (info: GuestInfo) => void;
    onNext: () => void;
    onBack: () => void;
    maxRigLength?: number | null;
    campgroundId?: string;
    slug: string;
}) {
    const emailTrackedRef = useRef(false);
    const [showPartyDetails, setShowPartyDetails] = useState(false);
    const [showStayReason, setShowStayReason] = useState(false);
    const [showEquipment, setShowEquipment] = useState(false);
    const [showPets, setShowPets] = useState(false);

    // Simplified validation - only require essential fields
    const isValid =
        guestInfo.firstName.trim() &&
        guestInfo.lastName.trim() &&
        guestInfo.email.includes("@") &&
        guestInfo.phone.trim() &&
        guestInfo.zipCode.trim().length >= 5;

    const lengthError = maxRigLength && guestInfo.equipment.length && Number(guestInfo.equipment.length) > maxRigLength
        ? `Equipment length exceeds site maximum of ${maxRigLength}ft`
        : null;

    return (
        <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">Your Information</h2>

            {/* Essential Fields Only */}
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                        <input
                            type="text"
                            value={guestInfo.firstName}
                            onChange={(e) => onChange({ ...guestInfo, firstName: e.target.value })}
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            placeholder="John"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                        <input
                            type="text"
                            value={guestInfo.lastName}
                            onChange={(e) => onChange({ ...guestInfo, lastName: e.target.value })}
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            placeholder="Doe"
                            required
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                    <input
                        type="email"
                        value={guestInfo.email}
                        onChange={(e) => {
                            const next = e.target.value;
                            onChange({ ...guestInfo, email: next });
                            if (!emailTrackedRef.current && next.includes("@") && campgroundId) {
                                emailTrackedRef.current = true;
                                trackEvent("email_signup", { campgroundId, page: `/park/${slug}/book` });
                            }
                        }}
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        placeholder="john@example.com"
                        required
                    />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                        <input
                            type="tel"
                            value={guestInfo.phone}
                            onChange={(e) => onChange({ ...guestInfo, phone: e.target.value })}
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            placeholder="(555) 123-4567"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Zip Code <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={guestInfo.zipCode}
                            onChange={(e) => onChange({ ...guestInfo, zipCode: e.target.value })}
                            className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                                guestInfo.zipCode.length > 0 && guestInfo.zipCode.length < 5
                                    ? 'border-red-300 bg-red-50'
                                    : 'border-slate-300'
                            }`}
                            placeholder="12345"
                            maxLength={10}
                            required
                            minLength={5}
                        />
                        {guestInfo.zipCode.length > 0 && guestInfo.zipCode.length < 5 && (
                            <p className="text-xs text-red-500 mt-1">Min 5 characters</p>
                        )}
                    </div>
                </div>

                {/* Note about optional details */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                    <p className="text-sm text-status-info">
                        That's all we need! You can add more details after booking if needed.
                    </p>
                </div>

                {/* Collapsible: Party Details */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setShowPartyDetails(!showPartyDetails)}
                        className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between text-left"
                    >
                        <span className="text-sm font-medium text-slate-700">Party details (optional)</span>
                        <svg
                            className={`w-5 h-5 text-slate-500 transition-transform ${showPartyDetails ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {showPartyDetails && (
                        <div className="p-4 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Adults</label>
                                    <select
                                        value={guestInfo.adults}
                                        onChange={(e) => onChange({ ...guestInfo, adults: parseInt(e.target.value) })}
                                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    >
                                        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                                            <option key={n} value={n}>{n}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Children</label>
                                    <select
                                        value={guestInfo.children}
                                        onChange={(e) => onChange({ ...guestInfo, children: parseInt(e.target.value) })}
                                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    >
                                        {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                                            <option key={n} value={n}>{n}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Additional Guests Section */}
                            {guestInfo.adults > 1 && (
                                <div className="mt-4 p-4 bg-slate-50 rounded-xl">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="text-sm font-semibold text-slate-700">Additional Adult Details</h4>
                                        {guestInfo.additionalGuests.length < guestInfo.adults - 1 && (
                                            <button
                                                type="button"
                                                onClick={() => onChange({
                                                    ...guestInfo,
                                                    additionalGuests: [...guestInfo.additionalGuests, { firstName: '', lastName: '', email: '', phone: '' }]
                                                })}
                                                className="text-sm text-status-success hover:text-status-success/90 font-medium"
                                            >
                                                + Add Guest
                                            </button>
                                        )}
                                    </div>
                                    {guestInfo.additionalGuests.map((guest, idx) => (
                                        <div key={idx} className="mb-3 p-3 bg-white rounded-lg border border-slate-200">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-xs font-medium text-slate-500">Guest {idx + 2}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => onChange({
                                                        ...guestInfo,
                                                        additionalGuests: guestInfo.additionalGuests.filter((_, i) => i !== idx)
                                                    })}
                                                    className="text-xs text-status-error hover:text-status-error/90"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="First Name"
                                                    value={guest.firstName}
                                                    onChange={(e) => {
                                                        const updated = [...guestInfo.additionalGuests];
                                                        updated[idx] = { ...guest, firstName: e.target.value };
                                                        onChange({ ...guestInfo, additionalGuests: updated });
                                                    }}
                                                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500"
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Last Name"
                                                    value={guest.lastName}
                                                    onChange={(e) => {
                                                        const updated = [...guestInfo.additionalGuests];
                                                        updated[idx] = { ...guest, lastName: e.target.value };
                                                        onChange({ ...guestInfo, additionalGuests: updated });
                                                    }}
                                                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500"
                                                />
                                                <input
                                                    type="email"
                                                    placeholder="Email (optional)"
                                                    value={guest.email}
                                                    onChange={(e) => {
                                                        const updated = [...guestInfo.additionalGuests];
                                                        updated[idx] = { ...guest, email: e.target.value };
                                                        onChange({ ...guestInfo, additionalGuests: updated });
                                                    }}
                                                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500"
                                                />
                                                <input
                                                    type="tel"
                                                    placeholder="Phone (optional)"
                                                    value={guest.phone}
                                                    onChange={(e) => {
                                                        const updated = [...guestInfo.additionalGuests];
                                                        updated[idx] = { ...guest, phone: e.target.value };
                                                        onChange({ ...guestInfo, additionalGuests: updated });
                                                    }}
                                                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    {guestInfo.additionalGuests.length === 0 && (
                                        <p className="text-xs text-slate-500">Click "+ Add Guest" to add details for additional adults</p>
                                    )}
                                </div>
                            )}

                            {/* Children Details Section */}
                            {guestInfo.children > 0 && (
                                <div className="mt-4 p-4 bg-amber-50 rounded-xl">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="text-sm font-semibold text-slate-700">Children Details</h4>
                                        {guestInfo.childrenDetails.length < guestInfo.children && (
                                            <button
                                                type="button"
                                                onClick={() => onChange({
                                                    ...guestInfo,
                                                    childrenDetails: [...guestInfo.childrenDetails, { name: '', gender: '', age: '' }]
                                                })}
                                                className="text-sm text-status-warning hover:text-status-warning/90 font-medium"
                                            >
                                                + Add Child
                                            </button>
                                        )}
                                    </div>
                                    {guestInfo.childrenDetails.map((child, idx) => (
                                        <div key={idx} className="mb-3 p-3 bg-white rounded-lg border border-amber-200">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-xs font-medium text-slate-500">Child {idx + 1}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => onChange({
                                                        ...guestInfo,
                                                        childrenDetails: guestInfo.childrenDetails.filter((_, i) => i !== idx)
                                                    })}
                                                    className="text-xs text-status-error hover:text-status-error/90"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Name"
                                                    value={child.name}
                                                    onChange={(e) => {
                                                        const updated = [...guestInfo.childrenDetails];
                                                        updated[idx] = { ...child, name: e.target.value };
                                                        onChange({ ...guestInfo, childrenDetails: updated });
                                                    }}
                                                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500"
                                                />
                                                <select
                                                    value={child.gender}
                                                    onChange={(e) => {
                                                        const updated = [...guestInfo.childrenDetails];
                                                        updated[idx] = { ...child, gender: e.target.value };
                                                        onChange({ ...guestInfo, childrenDetails: updated });
                                                    }}
                                                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500"
                                                >
                                                    <option value="">Gender</option>
                                                    <option value="male">Male</option>
                                                    <option value="female">Female</option>
                                                    <option value="other">Other</option>
                                                </select>
                                                <select
                                                    value={child.age}
                                                    onChange={(e) => {
                                                        const updated = [...guestInfo.childrenDetails];
                                                        updated[idx] = { ...child, age: e.target.value };
                                                        onChange({ ...guestInfo, childrenDetails: updated });
                                                    }}
                                                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500"
                                                >
                                                    <option value="">Age</option>
                                                    {[...Array(18)].map((_, i) => (
                                                        <option key={i} value={String(i)}>{i}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    ))}
                                    {guestInfo.childrenDetails.length === 0 && (
                                        <p className="text-xs text-slate-500">Click "+ Add Child" to add details for children</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Collapsible: Stay Reason */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setShowStayReason(!showStayReason)}
                        className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between text-left"
                    >
                        <span className="text-sm font-medium text-slate-700">Reason for stay (optional)</span>
                        <svg
                            className={`w-5 h-5 text-slate-500 transition-transform ${showStayReason ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {showStayReason && (
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Reason for stay</label>
                                <select
                                    value={guestInfo.stayReasonPreset}
                                    onChange={(e) => onChange({ ...guestInfo, stayReasonPreset: e.target.value, stayReasonOther: e.target.value === "other" ? guestInfo.stayReasonOther : "" })}
                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                >
                                    <option value="vacation">Vacation / getaway</option>
                                    <option value="family_visit">Visiting family or friends</option>
                                    <option value="event">Event or festival</option>
                                    <option value="work_remote">Working remotely</option>
                                    <option value="stopover">Road-trip stopover</option>
                                    <option value="relocation">Relocation / temporary housing</option>
                                    <option value="other">Other</option>
                                </select>
                                {guestInfo.stayReasonPreset === "other" && (
                                    <input
                                        type="text"
                                        value={guestInfo.stayReasonOther}
                                        onChange={(e) => onChange({ ...guestInfo, stayReasonOther: e.target.value })}
                                        className="mt-2 w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                        placeholder="Tell us more"
                                    />
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Referral code</label>
                                <input
                                    type="text"
                                    value={guestInfo.referralCode}
                                    onChange={(e) => onChange({ ...guestInfo, referralCode: e.target.value.trim() })}
                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    placeholder="Enter a friend's code or link code"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Collapsible: Pets */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setShowPets(!showPets)}
                        className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between text-left"
                    >
                        <span className="text-sm font-medium text-slate-700">Pets (optional)</span>
                        <svg
                            className={`w-5 h-5 text-slate-500 transition-transform ${showPets ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {showPets && (
                        <div className="p-4 space-y-3">
                            <div className="flex flex-wrap gap-3">
                                {["dog", "cat", "other"].map((petType) => {
                                    const checked = guestInfo.petTypes.includes(petType);
                                    return (
                                        <label key={petType} className="flex items-center gap-2 text-sm text-slate-700">
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => {
                                                    const next = checked
                                                        ? guestInfo.petTypes.filter((p) => p !== petType)
                                                        : [...guestInfo.petTypes, petType];
                                                    onChange({
                                                        ...guestInfo,
                                                        petTypes: next,
                                                        petCount: next.length === 0 ? 0 : Math.max(guestInfo.petCount || 0, 1)
                                                    });
                                                }}
                                                className="h-4 w-4 text-status-success border-slate-300 rounded focus:ring-emerald-500"
                                            />
                                            {petType.charAt(0).toUpperCase() + petType.slice(1)}
                                        </label>
                                    );
                                })}
                            </div>
                            {guestInfo.petTypes.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">How many pets?</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={guestInfo.petCount}
                                        onChange={(e) => onChange({ ...guestInfo, petCount: parseInt(e.target.value || "1") })}
                                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    />
                                </div>
                            )}
                            <p className="text-xs text-slate-500">
                                Used to match pet-related park policies and site eligibility.
                            </p>
                        </div>
                    )}
                </div>

                {/* Collapsible: Equipment/Vehicle */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setShowEquipment(!showEquipment)}
                        className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between text-left"
                    >
                        <span className="text-sm font-medium text-slate-700">Equipment / Vehicle (optional)</span>
                        <svg
                            className={`w-5 h-5 text-slate-500 transition-transform ${showEquipment ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {showEquipment && (
                        <div className="p-4 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                                    <select
                                        value={guestInfo.equipment.type}
                                        onChange={(e) => onChange({
                                            ...guestInfo,
                                            equipment: { ...guestInfo.equipment, type: e.target.value }
                                        })}
                                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    >
                                        <option value="rv">RV / Motorhome</option>
                                        <option value="trailer">Travel Trailer</option>
                                        <option value="tent">Tent</option>
                                        <option value="car">Car / Van</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Length (ft)</label>
                                    <input
                                        type="number"
                                        value={guestInfo.equipment.length}
                                        onChange={(e) => onChange({
                                            ...guestInfo,
                                            equipment: { ...guestInfo.equipment, length: e.target.value }
                                        })}
                                        disabled={guestInfo.equipment.type === "tent" || guestInfo.equipment.type === "car"}
                                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-100"
                                        placeholder={guestInfo.equipment.type === "tent" ? "N/A" : "e.g. 25"}
                                    />
                                </div>
                            </div>
                            {lengthError && (
                                <p className="text-status-error text-sm font-medium">{lengthError}</p>
                            )}
                            <div className="flex items-start gap-3 p-3 bg-status-success/15 border border-status-success/30 rounded-xl">
                                <input
                                    id="needs-accessible"
                                    type="checkbox"
                                    checked={guestInfo.needsAccessible}
                                    onChange={(e) => onChange({ ...guestInfo, needsAccessible: e.target.checked })}
                                    className="mt-1 h-4 w-4 text-status-success border-slate-300 rounded focus:ring-emerald-500"
                                />
                                <label htmlFor="needs-accessible" className="text-sm text-slate-700 leading-5">
                                    I need an ADA-accessible site (level pad, accessible route, proximity to facilities). We'll filter and flag sites that don't meet this.
                                </label>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Plate Number</label>
                                    <input
                                        type="text"
                                        value={guestInfo.equipment.plateNumber}
                                        onChange={(e) => onChange({
                                            ...guestInfo,
                                            equipment: { ...guestInfo.equipment, plateNumber: e.target.value }
                                        })}
                                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                        placeholder="ABC-123"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                                    <input
                                        type="text"
                                        value={guestInfo.equipment.plateState}
                                        onChange={(e) => onChange({
                                            ...guestInfo,
                                            equipment: { ...guestInfo.equipment, plateState: e.target.value }
                                        })}
                                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                        placeholder="CA"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex gap-3 mt-8">
                <button
                    onClick={onBack}
                    className="flex-1 py-4 bg-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-300 transition-colors"
                >
                    ← Back
                </button>
                <button
                    onClick={onNext}
                    disabled={!isValid || !!lengthError}
                    className="flex-1 py-4 bg-status-success text-white font-semibold rounded-xl hover:bg-status-success/90 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                >
                    Review →
                </button>
            </div>
        </div>
    );
}

// Payment Form with Stripe
function PaymentForm({
    amountCents,
    paymentIntentId,
    reservationId,
    onSuccess,
    onBack,
    isProcessing,
    setIsProcessing,
    showAch,
    showWallets,
    capabilitiesStale
}: {
    amountCents: number;
    paymentIntentId: string;
    reservationId?: string;
    onSuccess: () => void;
    onBack: () => void;
    isProcessing: boolean;
    setIsProcessing: (v: boolean) => void;
    showAch: boolean;
    showWallets: boolean;
    capabilitiesStale: boolean;
}) {
    const stripe = useStripe();
    const elements = useElements();
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stripe || !elements) return;

        setIsProcessing(true);
        setError(null);

        const { error: submitError } = await elements.submit();
        if (submitError) {
            setError(submitError.message || "An error occurred");
            setIsProcessing(false);
            return;
        }

        const { error: confirmError } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: window.location.href
            },
            redirect: "if_required"
        });

        if (confirmError) {
            setError(confirmError.message || "Payment failed");
            setIsProcessing(false);
            return;
        }

        // Confirm payment with our backend to record the payment and update reservation
        if (reservationId) {
            try {
                await apiClient.confirmPublicPaymentIntent(paymentIntentId, reservationId);
            } catch (err) {
                console.error("Failed to confirm payment with backend:", err);
                // Payment succeeded with Stripe, so we still proceed - backend can reconcile later
            }
        }

        onSuccess();
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {capabilitiesStale && (
                <div className="rounded-md border border-status-warning/30 bg-status-warning/15 px-3 py-2 text-sm text-status-warning">
                    Payment methods are refreshing with Stripe. Card checkout still works; ACH and wallets may appear once capabilities finish updating.
                </div>
            )}
            <PaymentElement />
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-700 space-y-1">
                <div className="font-semibold text-slate-900">Payment method notes</div>
                <ul className="list-disc pl-4 space-y-1">
                    <li>Cards are processed securely. A temporary authorization may appear before capture.</li>
                    {showAch && (
                        <li>ACH: Paying by bank authorizes a one-time ACH debit. Funds can take 3-5 business days to clear; ensure the account has sufficient funds.</li>
                    )}
                    {showWallets && (
                        <li>Wallets: Apple Pay or Google Pay shows up when your device and browser support it. Billing details come from your wallet.</li>
                    )}
                </ul>
            </div>
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-status-error mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                            <h4 className="font-semibold text-status-error mb-1">Payment Error</h4>
                            <p className="text-sm text-status-error mb-3">{error}</p>
                            <div className="bg-white/80 rounded-lg p-3 border border-status-error/30">
                                <p className="text-xs font-medium text-status-error mb-2">What you can try:</p>
                                <ul className="space-y-1">
                                    <li className="text-xs text-status-error flex gap-2"><span>•</span>Check your card details are correct</li>
                                    <li className="text-xs text-status-error flex gap-2"><span>•</span>Verify you have sufficient funds</li>
                                    <li className="text-xs text-status-error flex gap-2"><span>•</span>Try a different card or payment method</li>
                                    <li className="text-xs text-status-error flex gap-2"><span>•</span>Contact your bank if the issue persists</li>
                                </ul>
                            </div>
                            <button
                                type="button"
                                onClick={() => setError(null)}
                                className="mt-3 text-sm text-status-error hover:text-status-error/90 font-medium underline"
                            >
                                Dismiss and try again
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={onBack}
                    disabled={isProcessing}
                    className="flex-1 py-4 bg-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-300 disabled:opacity-50 transition-colors"
                >
                    ← Back
                </button>
                <button
                    type="submit"
                    disabled={!stripe || isProcessing}
                    className="flex-1 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 disabled:bg-slate-400 disabled:from-slate-400 disabled:to-slate-400 transition-all shadow-lg shadow-emerald-500/20 hover:shadow-xl"
                >
                    {isProcessing ? (
                        <span className="flex items-center justify-center gap-2">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Processing...
                        </span>
                    ) : (
                        <span className="flex items-center justify-center gap-2">
                            <Lock className="h-4 w-4" />
                            Pay ${(amountCents / 100).toFixed(2)}
                        </span>
                    )}
                </button>
            </div>
        </form>
    );
}

// Step 4: Review & Pay
function ReviewStep({
    slug,
    campgroundId,
    arrivalDate,
    departureDate,
    selectedSite,
    selectedSiteClassId,
    assignOnArrival,
    guestInfo,
    onBack,
    holdExpiresAt,
    onHoldExpiresAtChange,
    onComplete,
    promoCodeFromUrl,
    previewToken
}: {
    slug: string;
    campgroundId: string;
    arrivalDate: string;
    departureDate: string;
    selectedSite: AvailableSite | null;
    selectedSiteClassId: string | null;
    assignOnArrival: boolean;
    guestInfo: GuestInfo;
    onBack: () => void;
    holdExpiresAt?: Date | null;
    onHoldExpiresAtChange?: (value: Date | null) => void;
    onComplete: (reservation?: any) => void;
    promoCodeFromUrl?: string | null;
    previewToken?: string;
}) {
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
    const [reservationId, setReservationId] = useState<string | null>(null);
    const [reservation, setReservation] = useState<any>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [bookingError, setBookingError] = useState<string | null>(null);
    const [holdCountdown, setHoldCountdown] = useState<string | null>(null);
    const selectedTypeLabel = selectedSite?.siteClass?.name || siteTypeLabel(selectedSite?.siteClass?.siteType || "site");

    // Promo code state
    const [promoCode, setPromoCode] = useState("");
    const [promoInput, setPromoInput] = useState("");
    const [promoDiscount, setPromoDiscount] = useState<number>(0);
    const [promoValidating, setPromoValidating] = useState(false);
    const [promoError, setPromoError] = useState<string | null>(null);
    const [promoApplied, setPromoApplied] = useState(false);

    useEffect(() => {
        if (!holdExpiresAt) {
            setHoldCountdown(null);
            return;
        }
        const refresh = () => {
            const diff = holdExpiresAt.getTime() - Date.now();
            if (diff <= 0) {
                setHoldCountdown("Expired");
                return;
            }
            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            setHoldCountdown(`${minutes}:${seconds.toString().padStart(2, "0")}`);
        };
        refresh();
        const timer = setInterval(refresh, 1000);
        return () => clearInterval(timer);
    }, [holdExpiresAt]);

    // Tax waiver state
    const [taxWaiverSigned, setTaxWaiverSigned] = useState(false);
    const [policyAcceptances, setPolicyAcceptances] = useState<Record<string, boolean>>({});

    // Charity round-up state
    const [charityDonation, setCharityDonation] = useState<{ optedIn: boolean; amountCents: number; charityId: string | null }>({ optedIn: false, amountCents: 0, charityId: null });

    // Forms state
    const [formsComplete, setFormsComplete] = useState(true); // Default to true until we check if there are forms
    const [formResponses, setFormResponses] = useState<Record<string, any>>({});
    const handleFormsComplete = (complete: boolean, responses: Record<string, any>) => {
        setFormsComplete(complete);
        setFormResponses(responses);
    };
    // Calculate stay length for form conditions
    const stayLength = useMemo(() => {
        if (!arrivalDate || !departureDate) return 1;
        const arrival = new Date(arrivalDate);
        const departure = new Date(departureDate);
        return Math.ceil((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24));
    }, [arrivalDate, departureDate]);

    const { data: quote, isLoading: isLoadingQuote, error: quoteError } = useQuery<Quote>({
        queryKey: [
            "public-quote",
            slug,
            selectedSite?.id,
            arrivalDate,
            departureDate,
            promoApplied ? promoCode : null,
            taxWaiverSigned,
            guestInfo.referralCode || null,
            guestInfo.stayReasonPreset,
            guestInfo.stayReasonOther,
            guestInfo.adults,
            guestInfo.children,
            guestInfo.petCount,
            guestInfo.petTypes.join(","),
            previewToken
        ],
        queryFn: () =>
            apiClient.getPublicQuote(slug, {
                siteId: selectedSite!.id,
                arrivalDate,
                departureDate,
                promoCode: promoApplied ? promoCode : undefined,
                taxWaiverSigned,
                referralCode: guestInfo.referralCode || undefined,
                stayReasonPreset: guestInfo.stayReasonPreset || undefined,
                stayReasonOther: guestInfo.stayReasonPreset === "other" ? guestInfo.stayReasonOther : undefined,
                adults: guestInfo.adults,
                children: guestInfo.children,
                petCount: guestInfo.petCount || 0,
                petTypes: guestInfo.petTypes,
                previewToken: previewToken || undefined
            }),
        enabled: !!slug && !!selectedSite?.id && !!arrivalDate && !!departureDate
    });

    const policyRequirements = useMemo(() => quote?.policyRequirements ?? [], [quote]);
    const bookingPolicies = useMemo(() => {
        return policyRequirements.filter((policy) => {
            const config = (policy?.config ?? {}) as Record<string, any>;
            const enforcement = config.enforcement ?? "post_booking";
            const showDuringBooking = config.showDuringBooking ?? true;
            return showDuringBooking || enforcement === "pre_booking";
        });
    }, [policyRequirements]);
    const requiredPolicies = useMemo(() => {
        return bookingPolicies.filter((policy) => {
            const config = (policy?.config ?? {}) as Record<string, any>;
            return (config.enforcement ?? "post_booking") === "pre_booking";
        });
    }, [bookingPolicies]);

    useEffect(() => {
        if (!bookingPolicies.length) {
            setPolicyAcceptances({});
            return;
        }
        setPolicyAcceptances((prev) => {
            const next: Record<string, boolean> = {};
            for (const policy of bookingPolicies) {
                next[policy.id] = prev[policy.id] ?? false;
            }
            return next;
        });
    }, [bookingPolicies]);

    const policiesBlocking = requiredPolicies.some((policy) => !policyAcceptances[policy.id]);

    // Auto-apply promo code from URL on mount
    useEffect(() => {
        if (promoCodeFromUrl && !promoApplied && quote && campgroundId) {
            setPromoInput(promoCodeFromUrl);
            // Auto-validate
            (async () => {
                setPromoValidating(true);
                try {
                    const result = await apiClient.validatePromoCode(campgroundId, promoCodeFromUrl, quote.totalCents);
                    setPromoCode(result.code);
                    setPromoDiscount(result.discountCents);
                    setPromoApplied(true);
                } catch (err: any) {
                    setPromoError(err.message || "Invalid promo code");
                } finally {
                    setPromoValidating(false);
                }
            })();
        }
    }, [promoCodeFromUrl, quote, campgroundId, promoApplied]);

    const handleApplyPromo = async () => {
        if (!promoInput.trim() || !campgroundId || !quote) return;

        setPromoValidating(true);
        setPromoError(null);

        try {
            const result = await apiClient.validatePromoCode(campgroundId, promoInput.trim(), quote.totalCents);
            setPromoCode(result.code);
            setPromoDiscount(result.discountCents);
            setPromoApplied(true);
            setPromoError(null);
            trackEvent("deal_applied", { campgroundId, promotionId: result.promotionId, metadata: { code: result.code }, page: `/park/${slug}/book` });
        } catch (err: any) {
            setPromoError(err.message || "Invalid promo code");
            setPromoApplied(false);
            setPromoDiscount(0);
        } finally {
            setPromoValidating(false);
        }
    };

    const handleRemovePromo = () => {
        setPromoCode("");
        setPromoInput("");
        setPromoDiscount(0);
        setPromoApplied(false);
        setPromoError(null);
    };

    const { data: paymentSettings } = useQuery({
        queryKey: ["public-payment-settings", campgroundId],
        queryFn: () => apiClient.getCampgroundPaymentSettings(campgroundId),
        enabled: !!campgroundId,
        staleTime: 30_000
    });

    const CAPABILITIES_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6h

    const planDefaultFeeCents = useMemo(() => {
        switch (paymentSettings?.billingPlan) {
            case "standard":
                return 200;
            case "enterprise":
                return 100;
            default:
                return 300;
        }
    }, [paymentSettings?.billingPlan]);

    const perBookingFeeCents = useMemo(() => {
        if (paymentSettings?.perBookingFeeCents !== undefined && paymentSettings?.perBookingFeeCents !== null) {
            return paymentSettings.perBookingFeeCents;
        }
        return planDefaultFeeCents;
    }, [paymentSettings?.perBookingFeeCents, planDefaultFeeCents]);

    const passThroughFeeCents = paymentSettings?.feeMode === "pass_through" ? perBookingFeeCents : 0;

    const appliedDiscountCents = useMemo(() => {
        if (!quote) return 0;
        const discountFromQuote = quote.discountCents ?? 0;
        if (promoApplied) {
            return discountFromQuote || promoDiscount;
        }
        return discountFromQuote;
    }, [promoApplied, promoDiscount, quote]);

    const taxesCents = quote?.taxesCents ?? 0;
    const totalAfterDiscount = quote
        ? quote.totalAfterDiscountCents ?? Math.max(0, (quote.totalCents ?? 0) - appliedDiscountCents)
        : 0;
    const totalWithTaxes = quote?.totalWithTaxesCents ?? totalAfterDiscount + taxesCents;
    const charityAmountCents = charityDonation.optedIn ? charityDonation.amountCents : 0;
    const finalTotalWithFees = Math.max(0, totalWithTaxes) + passThroughFeeCents + charityAmountCents;

    // Check if waiver is required but not signed
    const waiverRequired = quote?.taxWaiverRequired ?? false;
    const waiverBlocking = waiverRequired && !taxWaiverSigned;

    const capabilities = paymentSettings?.stripeCapabilities || {};
    const capabilitiesFetchedAt = paymentSettings?.stripeCapabilitiesFetchedAt ? new Date(paymentSettings.stripeCapabilitiesFetchedAt).getTime() : 0;
    const staleCapabilities = !paymentSettings?.stripeAccountId || !capabilitiesFetchedAt || (Date.now() - capabilitiesFetchedAt > CAPABILITIES_MAX_AGE_MS);
    const achActive = capabilities?.us_bank_account_ach_payments === "active";
    const walletsActive = capabilities?.card_payments === "active" && capabilities?.transfers === "active" && (capabilities?.apple_pay === "active" || capabilities?.google_pay === "active" || capabilities?.link_payments === "active");
    const showAch = !staleCapabilities && achActive;
    const showWallets = !staleCapabilities && walletsActive;
    const paymentMethodsLabel = showAch || showWallets
        ? `We accept cards${showAch ? ", ACH bank payments" : ""}${showWallets ? ", and wallets (Apple Pay / Google Pay where supported)" : ""}.`
        : "We accept cards. Connect Stripe to enable ACH and wallets once capabilities are active.";
    const updateHoldExpiresAt = (value: Date | null) => {
        if (onHoldExpiresAtChange) onHoldExpiresAtChange(value);
    };
    const reasonLabels: Record<string, string> = {
        vacation: "Vacation / getaway",
        family_visit: "Visiting family or friends",
        event: "Event or festival",
        work_remote: "Working remotely",
        stopover: "Road-trip stopover",
        relocation: "Relocation / temporary housing",
        other: "Other"
    };
    const stayReasonLabel = guestInfo.stayReasonPreset === "other"
        ? (guestInfo.stayReasonOther || "Other")
        : (reasonLabels[guestInfo.stayReasonPreset] || guestInfo.stayReasonPreset);
    const signerName = `${guestInfo.firstName} ${guestInfo.lastName}`.trim();
    const policyAcceptancePayload = bookingPolicies
        .filter((policy) => policyAcceptances[policy.id])
        .map((policy) => ({
            templateId: policy.id,
            accepted: true,
            signerName: signerName || undefined,
            signerEmail: guestInfo.email || undefined
        }));

    const createReservationMutation = useMutation({
        mutationFn: async () => {
            let holdId: string | undefined = undefined;
            if (!assignOnArrival && campgroundId && selectedSite && arrivalDate && departureDate) {
                try {
                    type HoldResponse = { id: string; expiresAt?: string };
                    const hold = await apiClient.createHold({
                        campgroundId,
                        siteId: selectedSite.id,
                        arrivalDate,
                        departureDate
                    }) as HoldResponse;
                    holdId = hold?.id;
                    if (hold?.expiresAt) {
                        updateHoldExpiresAt(new Date(hold.expiresAt));
                    } else {
                        const defaultExpiry = new Date();
                        defaultExpiry.setMinutes(defaultExpiry.getMinutes() + 10);
                        updateHoldExpiresAt(defaultExpiry);
                    }
                } catch {
                    // proceed without hold
                    updateHoldExpiresAt(null);
                }
            }

            return apiClient.createPublicReservation({
                campgroundSlug: slug!,
                siteId: assignOnArrival ? undefined : selectedSite?.id,
                siteClassId: assignOnArrival ? selectedSiteClassId || selectedSite?.siteClass?.id : undefined,
                siteLocked: !assignOnArrival && !!selectedSite?.id,
                arrivalDate,
                departureDate,
                adults: guestInfo.adults,
                children: guestInfo.children,
                petCount: guestInfo.petCount,
                petTypes: guestInfo.petTypes,
                guest: {
                    firstName: guestInfo.firstName,
                    lastName: guestInfo.lastName,
                    email: guestInfo.email,
                    phone: guestInfo.phone,
                    zipCode: guestInfo.zipCode
                },
                additionalGuests: guestInfo.additionalGuests.length > 0
                    ? guestInfo.additionalGuests.map(g => ({
                        firstName: g.firstName || undefined,
                        lastName: g.lastName || undefined,
                        email: g.email || undefined,
                        phone: g.phone || undefined
                    }))
                    : undefined,
                childrenDetails: guestInfo.childrenDetails.length > 0
                    ? guestInfo.childrenDetails.map(c => ({
                        name: c.name || undefined,
                        gender: c.gender || undefined,
                        age: c.age ? parseInt(c.age) : undefined
                    }))
                    : undefined,
                promoCode: promoApplied ? promoCode : undefined,
                referralCode: guestInfo.referralCode || undefined,
                stayReasonPreset: guestInfo.stayReasonPreset,
                stayReasonOther: guestInfo.stayReasonPreset === "other" ? guestInfo.stayReasonOther : undefined,
                taxWaiverSigned: waiverRequired ? taxWaiverSigned : undefined,
                needsAccessible: guestInfo.needsAccessible || undefined,
                charityDonation: charityDonation.optedIn && charityDonation.charityId ? {
                    charityId: charityDonation.charityId,
                    amountCents: charityDonation.amountCents
                } : undefined,
                policyAcceptances: policyAcceptancePayload.length ? policyAcceptancePayload : undefined,
                equipment: guestInfo.equipment.type !== "tent" && guestInfo.equipment.type !== "car" ? {
                    type: guestInfo.equipment.type,
                    length: Number(guestInfo.equipment.length),
                    plateNumber: guestInfo.equipment.plateNumber || undefined,
                    plateState: guestInfo.equipment.plateState || undefined
                } : {
                    type: guestInfo.equipment.type,
                    plateNumber: guestInfo.equipment.plateNumber || undefined,
                    plateState: guestInfo.equipment.plateState || undefined
                },
                holdId
            });
        },
        onSuccess: async (reservation) => {
            setReservationId(reservation.id);
            setReservation(reservation);
            trackEvent("reservation_completed", {
                campgroundId,
                reservationId: reservation.id,
                siteId: reservation.siteId || undefined,
                page: `/park/${slug}/book`
            });

            // Submit completed form responses
            if (Object.keys(formResponses).length > 0) {
                try {
                    for (const [formTemplateId, responses] of Object.entries(formResponses)) {
                        await fetch("/api/public/forms/submit", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                formTemplateId,
                                campgroundId,
                                reservationId: reservation.id,
                                guestEmail: guestInfo.email,
                                responses
                            })
                        });
                    }
                } catch (err) {
                    console.error("Failed to submit form responses", err);
                    // Don't block payment for form submission errors
                }
            }

            // Create payment intent (using public endpoint for guest checkout)
            // Note: Server computes amount from reservation balance - we don't specify it
            try {
                const intent = await apiClient.createPublicPaymentIntent({
                    reservationId: reservation.id,
                    currency: "usd",
                    guestEmail: guestInfo.email
                });
                setPaymentIntentId(intent.id);
                setClientSecret(intent.clientSecret);
            } catch (err) {
                console.error("Failed to create payment intent", err);
                setBookingError("Failed to initialize payment. Please try again.");
            }
        },
        onError: (err: Error) => {
            setBookingError(err.message || "Failed to create reservation");
            trackEvent("reservation_abandoned", {
                campgroundId,
                page: `/park/${slug}/book`,
                metadata: { reason: err?.message }
            });
        }
    });

    const handleProceedToPayment = () => {
        setBookingError(null);
        createReservationMutation.mutate();
    };
    const formsBlocking = !formsComplete;
    const proceedDisabledReason = waiverBlocking
        ? "Please sign the tax exemption waiver to continue"
        : policiesBlocking
            ? "Please accept the required policies to continue"
            : formsBlocking
                ? "Please complete all required forms to continue"
                : undefined;

    const formatDate = (dateStr: string) =>
        new Date(dateStr).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric"
        });

    if (isLoadingQuote) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
                {/* Calculator animation */}
                <div className="relative">
                    <svg className="w-10 h-10 text-emerald-500 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-10 h-1.5 bg-slate-200/50 rounded-full blur-sm" />
                </div>
                <div className="text-center space-y-1">
                    <p className="text-slate-700 font-medium">Crunching the numbers...</p>
                    <p className="text-sm text-slate-500">Getting your best price ready</p>
                </div>
                {/* Animated progress dots */}
                <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                        <div
                            key={i}
                            className="w-2 h-2 rounded-full bg-emerald-400"
                            style={{ animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite` }}
                        />
                    ))}
                </div>
            </div>
        );
    }

    if (quoteError) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
                <p className="text-status-error font-semibold">We couldn&apos;t calculate your total.</p>
                <p className="text-sm text-slate-600">
                    {quoteError instanceof Error ? quoteError.message : "Please try again or pick a different site."}
                </p>
                <button
                    onClick={onBack}
                    className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:border-status-success/50 hover:text-status-success transition-colors"
                >
                    ← Back
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-lg mx-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">Review Your Booking</h2>

            {/* Booking Summary */}
            <div className="bg-slate-50 rounded-2xl p-6 mb-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                    <div>
                        <div className="font-semibold text-slate-900">
                            {assignOnArrival ? "Assigned on arrival" : selectedSite?.name || "Site selection"}
                        </div>
                        <div className="text-sm text-slate-500">
                            {assignOnArrival
                                ? selectedSiteClassId
                                    ? "We’ll assign within your chosen site type"
                                    : "Assignment on arrival"
                                : selectedSite?.siteClass?.name || "Site details"}
                        </div>
                    </div>
                    <Tent className="h-8 w-8 text-status-success" />
                </div>

                <div className="py-4 border-b border-slate-200 space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Check-in</span>
                        <span className="font-medium text-slate-900">{formatDate(arrivalDate)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Check-out</span>
                        <span className="font-medium text-slate-900">{formatDate(departureDate)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Nights</span>
                        <span className="font-medium text-slate-900">{quote?.nights || "--"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Guests</span>
                        <span className="font-medium text-slate-900">
                            {guestInfo.adults} adults{guestInfo.children > 0 && `, ${guestInfo.children} children`}
                        </span>
                    </div>
                    {guestInfo.stayReasonPreset && (
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Reason</span>
                            <span className="font-medium text-slate-900">{stayReasonLabel}</span>
                        </div>
                    )}
                    {guestInfo.referralCode && (
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Referral</span>
                            <span className="font-medium text-slate-900">{guestInfo.referralCode}</span>
                        </div>
                    )}
                </div>

                <div className="py-4 border-b border-slate-200 space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Guest</span>
                        <span className="font-medium text-slate-900">
                            {guestInfo.firstName} {guestInfo.lastName}
                        </span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Email</span>
                        <span className="font-medium text-slate-900">{guestInfo.email}</span>
                    </div>
                </div>

                {quote && (
                    <div className="pt-4 space-y-2" aria-live="polite">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-600">
                                ${(quote.perNightCents / 100).toFixed(2)} × {quote.nights} nights
                            </span>
                            <span className="font-medium text-slate-900">${(quote.baseSubtotalCents / 100).toFixed(2)}</span>
                        </div>
                        {quote.rulesDeltaCents !== 0 && (
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600">Adjustments</span>
                                <span className={`font-medium ${quote.rulesDeltaCents < 0 ? "text-status-success" : "text-slate-900"}`}>
                                    {quote.rulesDeltaCents < 0 ? "-" : "+"}${(Math.abs(quote.rulesDeltaCents) / 100).toFixed(2)}
                                </span>
                            </div>
                        )}
                        {appliedDiscountCents > 0 && (
                            <div className="flex justify-between text-sm text-status-success">
                                <span className="flex items-center gap-1">
                                    <svg className="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>
                                    {promoApplied ? `Promo: ${promoCode}` : "Discounts"}
                                </span>
                                <span className="font-medium">-${(appliedDiscountCents / 100).toFixed(2)}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Subtotal after discounts</span>
                            <span className="font-medium text-slate-900">${(totalAfterDiscount / 100).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Taxes</span>
                            <span className="font-medium text-slate-900">${(taxesCents / 100).toFixed(2)}</span>
                        </div>
                        {passThroughFeeCents > 0 ? (
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600">Service fee (guest pays)</span>
                                <span className="font-medium text-slate-900">${(passThroughFeeCents / 100).toFixed(2)}</span>
                            </div>
                        ) : (
                            <div className="flex justify-between text-xs text-slate-500">
                                <span>Service fee absorbed by campground</span>
                                <span aria-hidden="true">—</span>
                            </div>
                        )}
                        {charityAmountCents > 0 && (
                            <div className="flex justify-between text-sm text-pink-600">
                                <span className="flex items-center gap-1">
                                    <svg className="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                                    Charity donation
                                </span>
                                <span className="font-medium">+${(charityAmountCents / 100).toFixed(2)}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-lg font-bold pt-2 border-t border-slate-300">
                            <span className="text-slate-900">Total due</span>
                            <span className="text-status-success">${(finalTotalWithFees / 100).toFixed(2)}</span>
                        </div>
                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 space-y-1">
                            <p>{paymentMethodsLabel}</p>
                            <p className="text-slate-500">
                                Fees and taxes are itemized above. When fee pass-through is enabled, guests see the service fee as a separate line.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Promo Code Section */}
            <div className="mb-6 p-4 bg-white border border-slate-200 rounded-xl">
                <label className="block text-sm font-medium text-slate-700 mb-2">Have a promo code?</label>
                {promoApplied ? (
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-status-success" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            <span className="font-mono font-medium text-status-success">{promoCode}</span>
                            <span className="text-sm text-status-success">applied!</span>
                        </div>
                        <button
                            onClick={handleRemovePromo}
                            className="text-sm text-slate-500 hover:text-slate-700"
                        >
                            Remove
                        </button>
                    </div>
                ) : (
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={promoInput}
                            onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                            placeholder="Enter code"
                            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg font-mono uppercase focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            disabled={promoValidating}
                        />
                        <button
                            onClick={handleApplyPromo}
                            disabled={!promoInput.trim() || promoValidating || !quote}
                            className="px-4 py-2 bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                        >
                            {promoValidating ? "..." : "Apply"}
                        </button>
                    </div>
                )}
                {promoError && (
                    <p className="mt-2 text-sm text-status-error">{promoError}</p>
                )}
            </div>

            {bookingPolicies.length > 0 && (
                <div className="mb-6 p-4 bg-white border border-slate-200 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-slate-900">Park Policies & Agreements</h4>
                        <span className="text-xs text-slate-500">
                            {bookingPolicies.length} {bookingPolicies.length === 1 ? "policy" : "policies"}
                        </span>
                    </div>
                    <div className="space-y-3">
                        {bookingPolicies.map((policy) => {
                            const config = (policy?.config ?? {}) as Record<string, any>;
                            const enforcement = config.enforcement ?? "post_booking";
                            const requireSignature = config.requireSignature ?? true;
                            const showAcceptance = enforcement === "pre_booking" || requireSignature;
                            const required = enforcement === "pre_booking";
                            const badgeTone =
                                enforcement === "pre_booking"
                                    ? "bg-rose-100 text-rose-700 border-rose-200"
                                    : enforcement === "pre_checkin"
                                        ? "bg-status-warning/15 text-status-warning border-status-warning/30"
                                        : enforcement === "post_booking"
                                            ? "bg-emerald-100 text-status-success border-status-success/30"
                                            : "bg-slate-100 text-slate-700 border-slate-200";
                            const badgeLabel =
                                enforcement === "pre_booking"
                                    ? "Required before booking"
                                    : enforcement === "pre_checkin"
                                        ? "Required before check-in"
                                        : enforcement === "post_booking"
                                            ? "Sent after booking"
                                            : "Information only";
                            return (
                                <div key={policy.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="font-medium text-slate-900">{policy.name}</div>
                                            {policy.description && (
                                                <div className="text-xs text-slate-600">{policy.description}</div>
                                            )}
                                        </div>
                                        <Badge variant="outline" className={badgeTone}>{badgeLabel}</Badge>
                                    </div>
                                    {policy.content && (
                                        <details className="text-xs text-slate-600">
                                            <summary className="cursor-pointer select-none">View policy details</summary>
                                            <div className="mt-2 rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-700 whitespace-pre-wrap max-h-48 overflow-auto">
                                                {policy.content}
                                            </div>
                                        </details>
                                    )}
                                    {showAcceptance && (
                                        <label className="flex items-start gap-2 text-sm text-slate-700">
                                            <input
                                                type="checkbox"
                                                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-status-success focus:ring-emerald-500"
                                                checked={policyAcceptances[policy.id] || false}
                                                onChange={(e) =>
                                                    setPolicyAcceptances((prev) => ({ ...prev, [policy.id]: e.target.checked }))
                                                }
                                            />
                                            <span>
                                                {required ? "I agree to this policy (required to book)." : "Sign now (optional)."}
                                            </span>
                                        </label>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {policiesBlocking && (
                        <div className="mt-3 rounded-md border border-status-warning/30 bg-status-warning/15 p-3 text-xs text-status-warning">
                            Please accept the required policies to continue.
                        </div>
                    )}
                </div>
            )}

            {/* Required Forms Section */}
            <div className="mb-6">
                <BookingFormsSection
                    campgroundId={campgroundId}
                    siteClassId={selectedSiteClassId || selectedSite?.siteClass?.id}
                    guestInfo={{
                        adults: guestInfo.adults,
                        children: guestInfo.children,
                        petCount: guestInfo.petCount,
                        equipment: guestInfo.equipment
                    }}
                    stayLength={stayLength}
                    onFormsComplete={handleFormsComplete}
                />
            </div>

            {/* Tax Exemption Waiver Section */}
            {waiverRequired && (
                <div className="mb-6 p-4 bg-status-warning/15 border border-status-warning/30 rounded-xl">
                    <div className="flex items-start gap-3">
                        <svg className="w-6 h-6 text-status-warning" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>
                        <div className="flex-1">
                            <h4 className="font-semibold text-status-warning mb-2">Tax Exemption Waiver</h4>
                            <p className="text-sm text-status-warning mb-4 whitespace-pre-wrap">
                                {quote?.taxWaiverText || "By checking this box, I certify that I qualify for the tax exemption as described and agree to provide any required documentation upon check-in."}
                            </p>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={taxWaiverSigned}
                                    onChange={(e) => setTaxWaiverSigned(e.target.checked)}
                                    className="w-5 h-5 rounded border-status-warning/50 text-status-warning focus:ring-status-warning"
                                />
                                <span className="text-sm font-medium text-status-warning">
                                    I agree to the tax exemption waiver terms
                                </span>
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {/* Round Up for Charity Section */}
            <div className="mb-6">
                <RoundUpForCharity
                    campgroundId={campgroundId}
                    totalCents={Math.max(0, totalWithTaxes) + passThroughFeeCents}
                    onChange={setCharityDonation}
                />
            </div>

            {bookingError && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-status-error mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="font-medium text-status-error mb-1">Something went wrong</p>
                            <p className="text-status-error text-sm mb-3">{bookingError}</p>
                            <div className="bg-white/50 rounded-lg p-3 border border-status-error/30">
                                <p className="text-xs font-medium text-status-error mb-2">What you can try:</p>
                                <ul className="space-y-1 text-xs text-status-error">
                                    <li className="flex gap-2"><span>•</span>Wait a moment and try again</li>
                                    <li className="flex gap-2"><span>•</span>Go back and verify your information</li>
                                    <li className="flex gap-2"><span>•</span>Try a different payment method</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Trust Badges */}
            <div className="mb-6 rounded-xl border border-status-success/30 bg-gradient-to-br from-emerald-50 to-cyan-50 p-5">
                <div className="flex items-center gap-2 mb-4">
                    <Lock className="h-5 w-5 text-status-success" />
                    <h4 className="font-semibold text-slate-900">Your Payment is Secure</h4>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="flex flex-col items-center text-center p-3 bg-white rounded-lg border border-slate-100">
                        <Shield className="h-6 w-6 text-status-info mb-2" />
                        <span className="text-xs font-medium text-slate-700">256-bit SSL</span>
                    </div>
                    <div className="flex flex-col items-center text-center p-3 bg-white rounded-lg border border-slate-100">
                        <CheckCircle className="h-6 w-6 text-status-success mb-2" />
                        <span className="text-xs font-medium text-slate-700">PCI Compliant</span>
                    </div>
                    <div className="flex flex-col items-center text-center p-3 bg-white rounded-lg border border-slate-100">
                        <CreditCard className="h-6 w-6 text-purple-600 mb-2" />
                        <span className="text-xs font-medium text-slate-700">Stripe Secure</span>
                    </div>
                    <div className="flex flex-col items-center text-center p-3 bg-white rounded-lg border border-slate-100">
                        <CheckCircle className="h-6 w-6 text-pink-600 mb-2" />
                        <span className="text-xs font-medium text-slate-700">Instant Confirm</span>
                    </div>
                </div>

                <p className="text-xs text-slate-600 mt-4 text-center">
                    Your payment information is encrypted and never stored on our servers. Powered by Stripe, the same payment processor trusted by Amazon and Google.
                </p>
            </div>

            {/* Payment Section */}
            {!stripePromise ? (
                <div className="rounded-lg border border-status-error/30 bg-status-error/15 p-4 text-center">
                    <AlertCircle className="h-6 w-6 text-status-error mx-auto mb-2" />
                    <p className="text-sm font-medium text-status-error">Payment processing is not configured</p>
                    <p className="text-xs text-status-error mt-1">Please contact support to complete your booking</p>
                </div>
            ) : clientSecret ? (
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                    {holdCountdown && (
                        <div className="mb-3 flex items-center gap-2 rounded-lg border border-status-warning/30 bg-status-warning/15 px-3 py-2 text-sm text-status-warning">
                            <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>
                            <span>
                                We’re holding this site for you {holdCountdown === "Expired" ? "(hold expired — try again)" : `for ${holdCountdown} more`} before it releases.
                            </span>
                        </div>
                    )}
                    <PaymentForm
                        amountCents={finalTotalWithFees}
                        paymentIntentId={paymentIntentId!}
                        reservationId={reservation?.id}
                        onSuccess={() => onComplete(reservation)}
                        onBack={onBack}
                        isProcessing={isProcessing}
                        setIsProcessing={setIsProcessing}
                        showAch={showAch}
                        showWallets={showWallets}
                        capabilitiesStale={staleCapabilities}
                    />
                </Elements>
            ) : (
                <div className="flex gap-3">
                    <button
                        onClick={onBack}
                        disabled={createReservationMutation.isPending}
                        className="flex-1 py-4 bg-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-300 disabled:opacity-50 transition-colors"
                    >
                        ← Back
                    </button>
                    <button
                        onClick={handleProceedToPayment}
                        disabled={createReservationMutation.isPending || !quote || waiverBlocking || policiesBlocking || formsBlocking}
                        className="flex-1 py-4 bg-status-success text-white font-semibold rounded-xl hover:bg-status-success/90 disabled:bg-slate-400 transition-colors"
                        title={proceedDisabledReason}
                    >
                        {createReservationMutation.isPending ? "Creating..." : "Proceed to Payment"}
                    </button>
                </div>
            )}
        </div>
    );
}


// Success Screen
function SuccessScreen({ campgroundName, slug, reservation }: { campgroundName: string; slug: string; reservation: any }) {
    const [copied, setCopied] = useState(false);

    const handleCopyCode = () => {
        navigator.clipboard.writeText(reservation.id.slice(-8).toUpperCase());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="max-w-2xl mx-auto py-12 px-4">
            {/* Animated celebration header */}
            <motion.div
                className="text-center mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
            >
                <motion.div
                    className="mb-4 relative"
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                >
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-12 h-12 text-status-success" />
                    </div>
                    {/* Decorative sparkles */}
                    <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-amber-400" />
                    <Sparkles className="absolute -bottom-1 -left-2 w-5 h-5 text-emerald-400" />
                </motion.div>
                <motion.h2
                    className="text-4xl font-bold text-status-success mb-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                >
                    You're All Set!
                </motion.h2>
                <motion.p
                    className="text-lg text-slate-700 mb-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                >
                    Your adventure at {campgroundName} is confirmed
                </motion.p>
                <motion.div
                    className="inline-flex items-center gap-2 bg-status-success/15 border border-status-success/30 rounded-full px-6 py-3 text-sm text-status-success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6 }}
                >
                    <Mail className="h-4 w-4" />
                    <span className="font-medium">Confirmation email sent to {reservation.guest?.email || "your email"}</span>
                </motion.div>
            </motion.div>

            {/* Confirmation Details Card */}
            <motion.div
                className="bg-white border border-slate-200 rounded-2xl p-6 shadow-lg mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
            >
                <div className="flex flex-col md:flex-row justify-between gap-6 mb-6 pb-6 border-b border-slate-100">
                    <div>
                        <p className="text-sm text-slate-500 uppercase tracking-wide font-medium mb-1">Confirmation Code</p>
                        <div className="flex items-center gap-2">
                            <p className="text-3xl font-mono font-bold text-status-success">
                                {reservation.id.slice(-8).toUpperCase()}
                            </p>
                            <button
                                onClick={handleCopyCode}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Copy confirmation code"
                            >
                                {copied ? (
                                    <Check className="h-4 w-4 text-status-success" />
                                ) : (
                                    <Copy className="h-4 w-4 text-slate-500" />
                                )}
                            </button>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-slate-500 uppercase tracking-wide font-medium mb-1">Total Paid</p>
                        <p className="text-3xl font-bold text-slate-900">${(reservation.totalAmount / 100).toFixed(2)}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <p className="text-sm text-slate-500 mb-1 flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Dates
                        </p>
                        <p className="font-medium text-slate-900">
                            {new Date(reservation.arrivalDate).toLocaleDateString()} - {new Date(reservation.departureDate).toLocaleDateString()}
                        </p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 mb-1 flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Guests
                        </p>
                        <p className="font-medium text-slate-900">
                            {reservation.adults} Adults, {reservation.children} Children
                        </p>
                    </div>
                    {(reservation.siteId || reservation.siteClassId) && (
                        <div className="col-span-full">
                            <p className="text-sm text-slate-500 mb-1 flex items-center gap-2">
                                <MapPin className="h-4 w-4" />
                                Site
                            </p>
                            <p className="font-medium text-slate-900">
                                {reservation.site?.name || "Assigned on Arrival"}
                            </p>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* What Happens Next */}
            <motion.div
                className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6 mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
            >
                <h3 className="font-bold text-blue-900 mb-4 flex items-center gap-2 text-lg">
                    <Sparkles className="h-5 w-5" />
                    What happens next?
                </h3>
                <div className="space-y-4">
                    <div className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-status-info text-white rounded-full flex items-center justify-center font-bold text-sm">
                            1
                        </div>
                        <div>
                            <p className="font-medium text-blue-900">Check your email</p>
                            <p className="text-sm text-status-info">
                                We've sent your confirmation and receipt. Add it to your calendar!
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-status-info text-white rounded-full flex items-center justify-center font-bold text-sm">
                            2
                        </div>
                        <div>
                            <p className="font-medium text-blue-900">Get check-in details</p>
                            <p className="text-sm text-status-info">
                                48 hours before arrival, we'll email you check-in instructions and directions
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-status-info text-white rounded-full flex items-center justify-center font-bold text-sm">
                            3
                        </div>
                        <div>
                            <p className="font-medium text-blue-900">Pack and enjoy!</p>
                            <p className="text-sm text-status-info">
                                Check the weather, pack your gear, and get ready for an unforgettable stay
                            </p>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Actions */}
            <motion.div
                className="flex flex-col sm:flex-row gap-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
            >
                <Link
                    href={`/park/${slug}`}
                    className="flex-1 inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-200"
                >
                    <ArrowLeft className="h-5 w-5 mr-2" />
                    Back to {campgroundName}
                </Link>
                <button
                    onClick={() => window.print()}
                    className="flex-1 inline-flex items-center justify-center px-8 py-4 bg-white border-2 border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                >
                    <Printer className="h-5 w-5 mr-2" />
                    Print Confirmation
                </button>
            </motion.div>

            {/* Social Proof / Share */}
            <motion.div
                className="mt-8 p-6 bg-slate-50 rounded-xl border border-slate-200"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
            >
                <p className="text-sm text-slate-600 mb-3 text-center font-medium">
                    Know someone who'd love {campgroundName}?
                </p>
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={() => {
                            navigator.share?.({
                                title: `${campgroundName}`,
                                text: `Check out ${campgroundName}!`,
                                url: `${window.location.origin}/park/${slug}`
                            }).catch(() => {
                                navigator.clipboard.writeText(`${window.location.origin}/park/${slug}`);
                            });
                        }}
                        className="px-6 py-2 bg-status-success text-white rounded-lg text-sm font-medium hover:bg-status-success/90 transition-colors flex items-center gap-2"
                    >
                        <Share2 className="h-4 w-4" />
                        Share with Friends
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

// Main Booking Page
export default function BookingPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();

    // Initial state from URL params
    const initialArrival = searchParams.get("arrivalDate") || searchParams.get("arrival") || "";
    const initialDeparture = searchParams.get("departureDate") || searchParams.get("departure") || "";
    const initialSiteType = searchParams.get("siteType") || "all";
    const initialSiteId = searchParams.get("siteId") || null;
    // Support both "adults"/"children" params and combined "guests" param
    const guestsParam = searchParams.get("guests");
    const adultsParam = searchParams.get("adults");
    const initialAdults = adultsParam ? parseInt(adultsParam) : (guestsParam ? parseInt(guestsParam) : 1);
    const initialChildren = parseInt(searchParams.get("children") || "0");
    const initialSiteClassId = searchParams.get("siteClassId") || null;
    const initialRvLength = searchParams.get("rvLength") || "";
    const initialRvType = searchParams.get("rvType") || "";
    const previewToken = searchParams.get("token") || undefined;

    const slug = params.slug as string;
    const [step, setStep] = useState<BookingStep>(initialArrival && initialDeparture ? 2 : 1);

    const [arrivalDate, setArrivalDate] = useState(initialArrival);
    const [departureDate, setDepartureDate] = useState(initialDeparture);
    const [selectedSiteType, setSelectedSiteType] = useState(normalizeSiteType(initialSiteType || "all"));
    const [selectedSiteId, setSelectedSiteId] = useState<string | null>(initialSiteId);
    const [selectedSiteClassId, setSelectedSiteClassId] = useState<string | null>(initialSiteClassId);
    const [assignOnArrival, setAssignOnArrival] = useState(false);
    const [guestInfo, setGuestInfo] = useState<GuestInfo>({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        zipCode: "",
        adults: initialAdults,
        children: initialChildren,
        petCount: 0,
        petTypes: [],
        additionalGuests: [],
        childrenDetails: [],
        stayReasonPreset: "vacation",
        stayReasonOther: "",
        referralCode: "",
        needsAccessible: false,
        equipment: {
            type: initialRvType ? mapSiteTypeToEquipmentType(initialRvType) : mapSiteTypeToEquipmentType(initialSiteType),
            length: initialRvLength,
            plateNumber: "",
            plateState: ""
        }
    });

    // Prefill guest info from localStorage to speed repeat bookings
    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            const raw = window.localStorage.getItem("publicGuestInfo");
            if (raw) {
                const parsed = JSON.parse(raw);
                setGuestInfo((prev) => ({ ...prev, ...parsed }));
            }
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const payload = {
            firstName: guestInfo.firstName,
            lastName: guestInfo.lastName,
            email: guestInfo.email,
            phone: guestInfo.phone,
            zipCode: guestInfo.zipCode,
            adults: guestInfo.adults,
            children: guestInfo.children,
            petCount: guestInfo.petCount,
            petTypes: guestInfo.petTypes,
            stayReasonPreset: guestInfo.stayReasonPreset,
            stayReasonOther: guestInfo.stayReasonOther,
            referralCode: guestInfo.referralCode,
            needsAccessible: guestInfo.needsAccessible,
            equipment: guestInfo.equipment
        };
        try {
            window.localStorage.setItem("publicGuestInfo", JSON.stringify(payload));
        } catch {
            // ignore
        }
    }, [guestInfo]);

    const [isComplete, setIsComplete] = useState(false);
    const [confirmedReservation, setConfirmedReservation] = useState<any>(null);
    const [holdExpiresAt, setHoldExpiresAt] = useState<Date | null>(null);
    const lastAvailabilityKey = useRef<string | null>(null);
    const reservationStartLogged = useRef<boolean>(false);
    const [askQuestion, setAskQuestion] = useState("");
    const [askAnswer, setAskAnswer] = useState("");
    const [askUsage, setAskUsage] = useState<{ totalTokens: number | null } | null>(null);
    const [askLoading, setAskLoading] = useState(false);
    const [askError, setAskError] = useState<string | null>(null);
    const [nextAvailability, setNextAvailability] = useState<{ arrivalDate: string; departureDate: string; site: AvailableSite } | null>(null);
    const abandonTimerRef = useRef<NodeJS.Timeout | null>(null);
    const abandonSentRef = useRef<boolean>(false);

    const handleSiteTypeChange = (type: string) => {
        const normalizedType = normalizeSiteType(type);
        setSelectedSiteType(normalizedType);
        setSelectedSiteId(null);
        setSelectedSiteClassId(null);
        setAssignOnArrival(false);
        setGuestInfo((prev) => ({
            ...prev,
            equipment: { ...prev.equipment, type: mapSiteTypeToEquipmentType(normalizedType) }
        }));
    };

    const handleApplySuggestedDates = (arrival: string, departure: string) => {
        setArrivalDate(arrival);
        setDepartureDate(departure);
        setSelectedSiteId(null);
        setStep(2);
    };

    // Auto-set defaults if none provided to surface availability quickly
    useEffect(() => {
        if (!initialArrival || !initialDeparture) {
            const today = new Date();
            const format = (d: Date) => d.toISOString().split("T")[0];
            const depart = new Date(today);
            depart.setDate(depart.getDate() + 3);
            setArrivalDate(format(today));
            setDepartureDate(format(depart));
            setStep(2);
        }
    }, [initialArrival, initialDeparture]);

    // Keep key selections in the URL for refresh/share
    useEffect(() => {
        if (!slug) return;
        const params = new URLSearchParams(searchParams.toString());

        const apply = (key: string, value: string | null | undefined) => {
            if (value === null || value === undefined || value === "") {
                params.delete(key);
            } else {
                params.set(key, value);
            }
        };

        apply("arrivalDate", arrivalDate);
        apply("departureDate", departureDate);
        apply("siteType", selectedSiteType);
        apply("adults", guestInfo.adults ? String(guestInfo.adults) : "1");
        apply("children", guestInfo.children !== undefined ? String(guestInfo.children) : "0");

        const nextQuery = params.toString();
        const currentQuery = searchParams.toString();
        if (nextQuery === currentQuery) return;

        router.replace(`/park/${slug}/book${nextQuery ? `?${nextQuery}` : ""}`, { scroll: false });
    }, [arrivalDate, departureDate, selectedSiteType, guestInfo.adults, guestInfo.children, slug, router, searchParams]);

    // Fetch campground info (with preview token for unpublished campgrounds)
    const { data: campground, isLoading: isLoadingCampground, error: campgroundError } = useQuery({
        queryKey: ["public-campground", slug, previewToken],
        queryFn: () => apiClient.getPublicCampground(slug, previewToken),
        enabled: !!slug,
        retry: 2,
        retryDelay: (attempt) => Math.min(500 * (attempt + 1), 4000)
    });

    const siteSelectionFeeCents = useMemo(() => {
        type CampgroundWithFee = typeof campground & { siteSelectionFeeCents?: number };
        const fee = (campground as CampgroundWithFee)?.siteSelectionFeeCents;
        return typeof fee === "number" ? fee : null;
    }, [campground]);

    // Fetch availability when dates are selected
    const { data: availableSites, isLoading: isLoadingSites, error: availabilityError, refetch: refetchAvailability } = useQuery({
        queryKey: ["public-availability", slug, arrivalDate, departureDate, guestInfo.equipment.type, guestInfo.equipment.length, guestInfo.needsAccessible, previewToken],
        queryFn: () =>
            apiClient.getPublicAvailability(slug, {
                arrivalDate,
                departureDate,
                rigType: guestInfo.equipment.type,
                rigLength: guestInfo.equipment.length,
                needsAccessible: guestInfo.needsAccessible
            }, previewToken || undefined),
        enabled: !!slug && !!arrivalDate && !!departureDate && step >= 2,
        retry: 2,
        retryDelay: (attempt) => Math.min(750 * (attempt + 1), 5000)
    });

    // Filter sites based on selected site type
    const filteredSites = availableSites?.filter(site => {
        if (selectedSiteType === "all") return true;
        return matchesSiteType(selectedSiteType, site.siteClass?.siteType || site.siteType);
    }) || [];

    useEffect(() => {
        let cancelled = false;

        const findNextAvailability = async () => {
            if (step !== 2 || !slug || !arrivalDate || !departureDate) {
                setNextAvailability(null);
                return;
            }
            if (isLoadingSites || filteredSites.length > 0) {
                setNextAvailability(null);
                return;
            }

            const arrival = new Date(arrivalDate);
            if (isNaN(arrival.getTime())) {
                setNextAvailability(null);
                return;
            }
            const nights = getNightsBetween(arrivalDate, departureDate);

            for (let offset = 1; offset <= 7; offset++) {
                const nextArrivalDate = addDaysToDate(arrival, offset);
                const nextDepartureDate = addDaysToDate(nextArrivalDate, nights);
                try {
                    const res = await apiClient.getPublicAvailability(slug, {
                        arrivalDate: formatDateInput(nextArrivalDate),
                        departureDate: formatDateInput(nextDepartureDate),
                        rigType: guestInfo.equipment.type,
                        rigLength: guestInfo.equipment.length,
                        needsAccessible: guestInfo.needsAccessible
                    }, previewToken || undefined);
                    const available = res.filter((s) => s.status === "available");
                    if (available.length > 0) {
                        if (!cancelled) {
                            setNextAvailability({
                                arrivalDate: formatDateInput(nextArrivalDate),
                                departureDate: formatDateInput(nextDepartureDate),
                                site: available[0]
                            });
                        }
                        return;
                    }
                } catch {
                    // Ignore suggestion errors
                }
            }

            if (!cancelled) setNextAvailability(null);
        };

        findNextAvailability();
        return () => {
            cancelled = true;
        };
    }, [arrivalDate, departureDate, filteredSites.length, guestInfo.equipment.length, guestInfo.equipment.type, guestInfo.needsAccessible, isLoadingSites, previewToken, slug, step]);

    const selectedSite = availableSites?.find((s) => s.id === selectedSiteId) || null;

    useEffect(() => {
        if (!selectedSite) return;
        setSelectedSiteClassId((prev) => prev || selectedSite.siteClass?.id || null);
        if (selectedSiteType === "all") {
            setSelectedSiteType(normalizeSiteType(selectedSite.siteClass?.siteType || selectedSite.siteType || "all"));
        }
    }, [selectedSite, selectedSiteType]);

    // Abandoned cart: fire once after 15 minutes idle before completion
    useEffect(() => {
        if (!campground?.id || isComplete) {
            if (abandonTimerRef.current) clearTimeout(abandonTimerRef.current);
            return;
        }
        if (step >= 4) {
            if (abandonTimerRef.current) clearTimeout(abandonTimerRef.current);
            return;
        }
        if (abandonTimerRef.current) clearTimeout(abandonTimerRef.current);
        const t = setTimeout(() => {
            if (abandonSentRef.current) return;
            abandonSentRef.current = true;
            apiClient.abandonPublicCart({
                campgroundId: campground.id,
                email: guestInfo.email || undefined,
                phone: guestInfo.phone || undefined,
                abandonedAt: new Date().toISOString()
            }).catch(() => { });
        }, 15 * 60 * 1000);
        abandonTimerRef.current = t;
        return () => {
            if (t) clearTimeout(t);
        };
    }, [campground?.id, isComplete, step, guestInfo.email, guestInfo.phone]);

    const handleAsk = async () => {
        if (!campground?.id || !askQuestion.trim()) return;
        if (!campground.aiSuggestionsEnabled) {
            setAskError("AI helper is not enabled for this campground.");
            return;
        }
        setAskLoading(true);
        setAskError(null);
        try {
            const res = await apiClient.askAi({ campgroundId: campground.id, question: askQuestion.trim() });
            setAskAnswer(res.answer);
            setAskUsage(res.usage ? { totalTokens: res.usage.totalTokens } : null);
        } catch (err: any) {
            if (err?.status === 403) {
                setAskError("AI helper is not enabled for this campground.");
            } else {
                setAskError(err?.message || "Could not get an answer right now.");
            }
        } finally {
            setAskLoading(false);
        }
    };

    useAnalyticsEmitters({
        campgroundId: campground?.id,
        slug,
        arrivalDate,
        departureDate,
        equipment: guestInfo.equipment,
        availableSites,
        selectedSiteId,
        step,
        reservationStartLogged,
        lastAvailabilityKey,
    });

    if (isLoadingCampground) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-slate-50 to-white">
                {/* Animated campground icon */}
                <div className="relative">
                    <Tent className="h-12 w-12 text-emerald-500 animate-bounce" />
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 h-2 bg-slate-200/50 rounded-full blur-sm" />
                </div>
                <div className="text-center space-y-2">
                    <p className="text-slate-700 font-medium animate-pulse">Preparing your booking...</p>
                    <p className="text-sm text-slate-500">Almost ready for your adventure</p>
                </div>
                {/* Progress dots */}
                <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                        <div
                            key={i}
                            className="w-2 h-2 rounded-full bg-status-success/150"
                            style={{ animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite` }}
                        />
                    ))}
                </div>
            </div>
        );
    }

    if (campgroundError || !campground) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
                <Tent className="h-16 w-16 text-emerald-500" />
                <h1 className="text-2xl font-bold text-slate-800">Campground Not Found</h1>
                <Link
                    href="/"
                    className="px-6 py-3 bg-status-success text-white rounded-lg font-medium hover:bg-status-success/90"
                >
                    Browse All Campgrounds
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <Link href={`/park/${slug}`} className="text-status-success hover:text-status-success/90 font-medium text-sm">
                        ← Back to {campground.name}
                    </Link>
                    <h1 className="font-bold text-slate-900">Book Your Stay</h1>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-4xl mx-auto px-4 py-8">
                {isComplete && confirmedReservation ? (
                    <SuccessScreen campgroundName={campground.name} slug={slug} reservation={confirmedReservation} />
                ) : (
                    <>
                        <BookingProgress currentStep={step} />

                        {/* Price Estimate - Show from step 1 onwards, hide on step 4 */}
                        {step < 4 && (
                            <PriceEstimate
                                arrivalDate={arrivalDate}
                                departureDate={departureDate}
                                selectedSite={selectedSite}
                                availableSites={availableSites}
                                selectedSiteType={selectedSiteType}
                                isLoadingSites={isLoadingSites}
                                step={step}
                                campgroundSiteClasses={campground?.siteClasses || []}
                            />
                        )}

                        {step === 1 && (
                            <DateStep
                                arrivalDate={arrivalDate}
                                departureDate={departureDate}
                                selectedSiteType={selectedSiteType}
                                onArrivalChange={setArrivalDate}
                                onDepartureChange={setDepartureDate}
                                onSiteTypeChange={handleSiteTypeChange}
                                onNext={() => setStep(2)}
                                slug={slug}
                                onApplyNLSearch={(intent, results) => {
                                    // Store results for potential use, then move to site selection
                                    if (intent.arrivalDate && intent.departureDate) {
                                        // If we have dates, go to site selection
                                        setStep(2);
                                    }
                                }}
                            />
                        )}

                        {step === 2 && (
                            <SiteStep
                                sites={filteredSites}
                                allSites={availableSites || []}
                                isLoading={isLoadingSites}
                                selectedSiteId={selectedSiteId}
                                onSelect={(id) => {
                                    setSelectedSiteId(id);
                                    const site = (availableSites || []).find((s) => s.id === id) || null;
                                    setSelectedSiteClassId(site?.siteClass?.id || null);
                                    setAssignOnArrival(false);
                                }}
                                onNext={() => setStep(3)}
                                onBack={() => setStep(1)}
                                campgroundId={campground!.id}
                                arrivalDate={arrivalDate}
                                departureDate={departureDate}
                                selectedSiteType={selectedSiteType}
                                siteClasses={campground?.siteClasses || []}
                                onChangeSiteType={handleSiteTypeChange}
                                currentSiteType={selectedSiteType}
                                nextAvailability={nextAvailability}
                                onApplySuggestedDates={handleApplySuggestedDates}
                                onBookSelected={() => setStep(3)}
                                siteSelectionFeeCents={siteSelectionFeeCents}
                                heroImage={campground?.heroImageUrl || campground?.photos?.[0] || null}
                                onProceedWithoutLock={() => {
                                    const pool = filteredSites.length > 0 ? filteredSites : availableSites || [];
                                    const fallbackSite = pool.find((s) => s.status === "available");
                                    if (fallbackSite) {
                                        setSelectedSiteId(fallbackSite.id);
                                        setSelectedSiteClassId(fallbackSite.siteClass?.id || null);
                                    } else if ((campground?.siteClasses || []).length > 0) {
                                        const classMatch = (campground?.siteClasses || []).find((sc: any) =>
                                            selectedSiteType === "all" ? true : matchesSiteType(selectedSiteType, sc.siteType)
                                        );
                                        setSelectedSiteClassId(classMatch?.id || null);
                                        setSelectedSiteId(null);
                                    }
                                    setAssignOnArrival(true);
                                    setStep(3);
                                }}
                            />
                        )}

                        {step === 3 && (
                            <GuestStep
                                guestInfo={guestInfo}
                                onChange={setGuestInfo}
                                onNext={() => setStep(4)}
                                onBack={() => setStep(2)}
                                maxRigLength={selectedSite?.rigMaxLength}
                                campgroundId={campground?.id}
                                slug={slug}
                            />
                        )}

                        {step === 4 && (
                            <ReviewStep
                                slug={slug}
                                campgroundId={campground.id}
                                arrivalDate={arrivalDate}
                                departureDate={departureDate}
                                selectedSite={selectedSite}
                                selectedSiteClassId={selectedSiteClassId}
                                assignOnArrival={assignOnArrival}
                                guestInfo={guestInfo}
                                onBack={() => setStep(3)}
                                holdExpiresAt={holdExpiresAt}
                                onHoldExpiresAtChange={setHoldExpiresAt}
                                onComplete={(reservation) => {
                                    if (reservation) setConfirmedReservation(reservation);
                                    setIsComplete(true);
                                }}
                                promoCodeFromUrl={searchParams.get("promoCode")}
                                previewToken={previewToken}
                            />
                        )}

                    </>
                )}

                {campground?.aiSuggestionsEnabled && (
                    <div className="mt-8 border border-slate-200 rounded-lg bg-white shadow-sm p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-slate-900">Need help? Ask in natural language</h3>
                            {askUsage && askUsage.totalTokens !== null && (
                                <span className="text-xs text-slate-500">Tokens: {askUsage.totalTokens ?? "n/a"}</span>
                            )}
                        </div>
                        <p className="text-sm text-slate-600">
                            Ask how to book, change dates, apply promos, or get guidance. AI is campground-specific and never uses guest PII.
                        </p>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <input
                                value={askQuestion}
                                onChange={(e) => setAskQuestion(e.target.value)}
                                placeholder="e.g., How do I switch to a pet-friendly site for the same dates?"
                                className="flex-1 border border-slate-200 rounded-md px-3 py-2 text-sm"
                            />
                            <button
                                onClick={handleAsk}
                                disabled={askLoading || !askQuestion.trim()}
                                className="px-4 py-2 bg-status-success text-white rounded-md text-sm font-medium hover:bg-status-success/90 disabled:opacity-50"
                            >
                                {askLoading ? "Asking..." : "Ask"}
                            </button>
                        </div>
                        {askError && <div className="text-sm text-status-warning bg-status-warning/15 border border-status-warning/30 rounded-md p-2">{askError}</div>}
                        {askAnswer && (
                            <div className="text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-md p-3 whitespace-pre-wrap">
                                {askAnswer}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
