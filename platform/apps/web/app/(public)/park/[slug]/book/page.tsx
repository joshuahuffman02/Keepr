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
    Frown, CheckCircle
} from "lucide-react";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "pk_test_placeholder");

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
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 mb-6">
                <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-600">Calculating estimate...</div>
                    <div className="animate-pulse h-6 w-20 bg-emerald-200 rounded"></div>
                </div>
            </div>
        );
    }

    if (!priceEstimate) {
        return null;
    }

    return (
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 mb-6">
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
                            <div className="text-2xl font-bold text-emerald-700">
                                ${priceEstimate.minTotal?.toFixed(0)} - ${priceEstimate.maxTotal?.toFixed(0)}
                            </div>
                            <div className="text-xs text-slate-500">
                                ${priceEstimate.minPerNight?.toFixed(0)} - ${priceEstimate.maxPerNight?.toFixed(0)}/night
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="text-2xl font-bold text-emerald-700">
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
                            ? "bg-emerald-600 text-white"
                            : step.num === currentStep
                                ? "bg-emerald-600 text-white ring-4 ring-emerald-100"
                                : "bg-slate-200 text-slate-500"
                            }`}
                    >
                        {step.num < currentStep ? <Check className="h-4 w-4" /> : step.num}
                    </div>
                    <span className={`ml-2 text-xs sm:text-sm font-medium hidden sm:inline ${step.num <= currentStep ? "text-emerald-700" : "text-slate-400"
                        }`}>
                        {step.label}
                    </span>
                    {idx < steps.length - 1 && (
                        <div className={`w-6 sm:w-12 h-1 mx-2 rounded ${step.num < currentStep ? "bg-emerald-600" : "bg-slate-200"
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
    onNext
}: {
    arrivalDate: string;
    departureDate: string;
    selectedSiteType: string;
    onArrivalChange: (d: string) => void;
    onDepartureChange: (d: string) => void;
    onSiteTypeChange: (type: string) => void;
    onNext: () => void;
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

            {/* Quick Booking Buttons */}
            <div className="mb-6">
                <p className="text-sm font-medium text-slate-600 mb-3 text-center">Quick Select</p>
                <div className="flex flex-wrap gap-2 justify-center">
                    <button
                        type="button"
                        onClick={handleTonight}
                        className="px-4 py-2 bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-700 rounded-lg text-sm font-medium transition-colors border border-slate-200 hover:border-emerald-300 inline-flex items-center gap-1"
                    >
                        <Moon className="h-4 w-4" /> Tonight
                    </button>
                    <button
                        type="button"
                        onClick={handleWeekend}
                        className="px-4 py-2 bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-700 rounded-lg text-sm font-medium transition-colors border border-slate-200 hover:border-emerald-300 inline-flex items-center gap-1"
                    >
                        <CalendarDays className="h-4 w-4" /> Weekend
                    </button>
                    <button
                        type="button"
                        onClick={handleThreeNights}
                        className="px-4 py-2 bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-700 rounded-lg text-sm font-medium transition-colors border border-slate-200 hover:border-emerald-300"
                    >
                        3 Nights
                    </button>
                    <button
                        type="button"
                        onClick={handleOneWeek}
                        className="px-4 py-2 bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-700 rounded-lg text-sm font-medium transition-colors border border-slate-200 hover:border-emerald-300"
                    >
                        1 Week
                    </button>
                    <button
                        type="button"
                        onClick={handleOneMonth}
                        className="px-4 py-2 bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-700 rounded-lg text-sm font-medium transition-colors border border-slate-200 hover:border-emerald-300"
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
                    <p className="text-red-600 text-sm">Check-out must be after check-in</p>
                )}
            </div>
            <button
                onClick={onNext}
                disabled={!isValid}
                className="w-full mt-6 py-4 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
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
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Available</span>;
            case 'booked':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Booked</span>;
            case 'maintenance':
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Maintenance</span>;
            case 'locked':
            default:
                return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">Unavailable</span>;
        }
    };

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
            <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent mb-4" />
                <p className="text-slate-600">Checking availability...</p>
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
                    <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-4 text-left max-w-lg mx-auto">
                        <div className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
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
                            className="mt-3 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
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
                                    className="px-4 py-2 rounded-lg border border-emerald-200 bg-white shadow-sm hover:border-emerald-400 transition-colors text-sm font-semibold text-emerald-800"
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
                            <button className="px-6 py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors">
                                {waitlistLabel}
                            </button>
                        }
                    />
                </div>
            </div>
        );
    }

    // Group by site class
    const sitesByClass = sites.reduce((acc, site) => {
        const className = site.siteClass?.name || "Other";
        if (!acc[className]) acc[className] = [];
        acc[className].push(site);
        return acc;
    }, {} as Record<string, AvailableSite[]>);

    return (
        <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">Choose Your Site</h2>
            <p className="text-center text-slate-600 mb-2">{sites.length} sites found</p>
            {sites.length > 0 && sites.length <= 3 && (
                <p className="text-center text-amber-600 text-sm font-semibold mb-4">
                    Only {sites.length} left for these dates. Sites are held for a short time during checkout.
                </p>
            )}

            {Object.entries(sitesByClass).map(([className, classSites]) => (
                <div key={className} className="mb-10">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-slate-600">{siteTypeIcons[classSites[0]?.siteClass?.siteType || "tent"] || <Tent className="h-5 w-5" />}</span>
                        <h3 className="text-lg font-semibold text-slate-900">{className}</h3>
                        {classSites[0]?.siteClass?.defaultRate && (
                            <span className="text-emerald-700 font-semibold ml-auto">
                                ${(classSites[0].siteClass.defaultRate / 100).toFixed(0)}/night
                            </span>
                        )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        {classSites.map((site) => {
                            const isAvailable = site.status === 'available';
                            const selected = selectedSiteId === site.id;
                            const cardImage = (site.siteClass as any)?.photoUrl || heroImage || "/placeholder.png";
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
                                        : "border-slate-200 hover:border-emerald-300 hover:shadow-md"
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
                                            <div className="absolute bottom-3 right-3 rounded-full bg-emerald-600 text-white text-xs px-3 py-1 shadow-lg">
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
                                                    <div className="text-lg font-bold text-emerald-700">
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
                                                <Badge variant="outline" className="border-emerald-200 text-emerald-700">
                                                    ADA Accessible
                                                </Badge>
                                            )}
                                        </div>
                                        {selected && (
                                            <div className="mt-3 flex flex-col gap-2">
                                                {selectionFeeDisplay ? (
                                                    <div className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 flex items-center gap-2">
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
                                                        className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
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
                    className="flex-1 py-4 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                >
                    Continue →
                </button>
            </div>
            <div className="mt-4">
                <button
                    type="button"
                    onClick={onProceedWithoutLock}
                    className="w-full text-sm text-emerald-700 font-semibold underline hover:text-emerald-800"
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

    // Simplified validation - only require essential fields
    const isValid =
        guestInfo.firstName.trim() &&
        guestInfo.lastName.trim() &&
        guestInfo.email.includes("@") &&
        guestInfo.phone.trim();

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

                {/* Note about optional details */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                    <p className="text-sm text-blue-800">
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
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Zip Code</label>
                                <input
                                    type="text"
                                    value={guestInfo.zipCode}
                                    onChange={(e) => onChange({ ...guestInfo, zipCode: e.target.value })}
                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    placeholder="12345"
                                    maxLength={10}
                                />
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
                                                className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
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
                                                    className="text-xs text-red-500 hover:text-red-600"
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
                                                className="text-sm text-amber-600 hover:text-amber-700 font-medium"
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
                                                    className="text-xs text-red-500 hover:text-red-600"
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
                                <p className="text-red-600 text-sm font-medium">{lengthError}</p>
                            )}
                            <div className="flex items-start gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                                <input
                                    id="needs-accessible"
                                    type="checkbox"
                                    checked={guestInfo.needsAccessible}
                                    onChange={(e) => onChange({ ...guestInfo, needsAccessible: e.target.checked })}
                                    className="mt-1 h-4 w-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
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
                    className="flex-1 py-4 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
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
    onSuccess,
    onBack,
    isProcessing,
    setIsProcessing,
    showAch,
    showWallets,
    capabilitiesStale
}: {
    amountCents: number;
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
        } else {
            onSuccess();
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {capabilitiesStale && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
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
            {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>}
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
                    className="flex-1 py-4 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 disabled:bg-slate-400 transition-colors"
                >
                    {isProcessing ? "Processing..." : `Pay $${(amountCents / 100).toFixed(2)}`}
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
    promoCodeFromUrl
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
}) {
    const [clientSecret, setClientSecret] = useState<string | null>(null);
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
            guestInfo.stayReasonOther
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
                stayReasonOther: guestInfo.stayReasonPreset === "other" ? guestInfo.stayReasonOther : undefined
            }),
        enabled: !!slug && !!selectedSite?.id && !!arrivalDate && !!departureDate
    });

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
    const finalTotalWithFees = Math.max(0, totalWithTaxes) + passThroughFeeCents;

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

    const createReservationMutation = useMutation({
        mutationFn: async () => {
            let holdId: string | undefined = undefined;
            if (!assignOnArrival && campgroundId && selectedSite && arrivalDate && departureDate) {
                try {
                    const hold = await apiClient.createHold({
                        campgroundId,
                        siteId: selectedSite.id,
                        arrivalDate,
                        departureDate
                    });
                    holdId = (hold as any)?.id;
                    if ((hold as any)?.expiresAt) {
                        updateHoldExpiresAt(new Date((hold as any).expiresAt));
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
                arrivalDate,
                departureDate,
                adults: guestInfo.adults,
                children: guestInfo.children,
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
            // Create payment intent with discounted amount (using public endpoint for guest checkout)
            try {
                const intent = await apiClient.createPublicPaymentIntent({
                    amountCents: finalTotalWithFees,
                    currency: "usd",
                    reservationId: reservation.id,
                    guestEmail: guestInfo.email
                });
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

    const formatDate = (dateStr: string) =>
        new Date(dateStr).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric"
        });

    if (isLoadingQuote) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent mb-4" />
                <p className="text-slate-600">Calculating your total...</p>
            </div>
        );
    }

    if (quoteError) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
                <p className="text-red-600 font-semibold">We couldn&apos;t calculate your total.</p>
                <p className="text-sm text-slate-600">
                    {quoteError instanceof Error ? quoteError.message : "Please try again or pick a different site."}
                </p>
                <button
                    onClick={onBack}
                    className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
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
                    <Tent className="h-8 w-8 text-emerald-600" />
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
                                <span className={`font-medium ${quote.rulesDeltaCents < 0 ? "text-green-600" : "text-slate-900"}`}>
                                    {quote.rulesDeltaCents < 0 ? "-" : "+"}${(Math.abs(quote.rulesDeltaCents) / 100).toFixed(2)}
                                </span>
                            </div>
                        )}
                        {appliedDiscountCents > 0 && (
                            <div className="flex justify-between text-sm text-green-600">
                                <span className="flex items-center gap-1">
                                    <span aria-hidden>🏷️</span>
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
                        <div className="flex justify-between text-lg font-bold pt-2 border-t border-slate-300">
                            <span className="text-slate-900">Total due</span>
                            <span className="text-emerald-600">${(finalTotalWithFees / 100).toFixed(2)}</span>
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
                            <span className="text-green-600">✓</span>
                            <span className="font-mono font-medium text-green-700">{promoCode}</span>
                            <span className="text-sm text-green-600">applied!</span>
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
                    <p className="mt-2 text-sm text-red-600">{promoError}</p>
                )}
            </div>

            {/* Tax Exemption Waiver Section */}
            {waiverRequired && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="flex items-start gap-3">
                        <span className="text-2xl">📋</span>
                        <div className="flex-1">
                            <h4 className="font-semibold text-amber-900 mb-2">Tax Exemption Waiver</h4>
                            <p className="text-sm text-amber-800 mb-4 whitespace-pre-wrap">
                                {quote?.taxWaiverText || "By checking this box, I certify that I qualify for the tax exemption as described and agree to provide any required documentation upon check-in."}
                            </p>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={taxWaiverSigned}
                                    onChange={(e) => setTaxWaiverSigned(e.target.checked)}
                                    className="w-5 h-5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                                />
                                <span className="text-sm font-medium text-amber-900">
                                    I agree to the tax exemption waiver terms
                                </span>
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {bookingError && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                    {bookingError}
                </div>
            )}

            {/* Payment Section */}
            {clientSecret ? (
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                    {holdCountdown && (
                        <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                            <span>⏳</span>
                            <span>
                                We’re holding this site for you {holdCountdown === "Expired" ? "(hold expired — try again)" : `for ${holdCountdown} more`} before it releases.
                            </span>
                        </div>
                    )}
                    <PaymentForm
                        amountCents={finalTotalWithFees}
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
                        disabled={createReservationMutation.isPending || !quote || waiverBlocking}
                        className="flex-1 py-4 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 disabled:bg-slate-400 transition-colors"
                        title={waiverBlocking ? "Please sign the tax exemption waiver to continue" : undefined}
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
    return (
        <div className="max-w-2xl mx-auto py-12 px-4">
            <div className="text-center mb-8">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Booking Confirmed!</h2>
                <p className="text-slate-600">
                    Thank you for booking at {campgroundName}. You'll receive a confirmation email shortly.
                </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-8">
                <div className="flex flex-col md:flex-row justify-between gap-6 mb-6 pb-6 border-b border-slate-100">
                    <div>
                        <p className="text-sm text-slate-500 uppercase tracking-wide font-medium">Confirmation Code</p>
                        <p className="text-2xl font-mono font-bold text-emerald-600">{reservation.id.slice(-8).toUpperCase()}</p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 uppercase tracking-wide font-medium">Total Paid</p>
                        <p className="text-2xl font-bold text-slate-900">${(reservation.totalAmount / 100).toFixed(2)}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <p className="text-sm text-slate-500 mb-1">Dates</p>
                        <p className="font-medium text-slate-900">
                            {new Date(reservation.arrivalDate).toLocaleDateString()} - {new Date(reservation.departureDate).toLocaleDateString()}
                        </p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 mb-1">Guests</p>
                        <p className="font-medium text-slate-900">
                            {reservation.adults} Adults, {reservation.children} Children
                        </p>
                    </div>
                    {(reservation.siteId || reservation.siteClassId) && (
                        <div className="col-span-full">
                            <p className="text-sm text-slate-500 mb-1">Site</p>
                            <p className="font-medium text-slate-900">
                                {reservation.site?.name || "Assigned on Arrival"}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <div className="text-center">
                <Link
                    href={`/park/${slug}`}
                    className="inline-block px-8 py-4 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200"
                >
                    Back to Campground
                </Link>
            </div>
        </div>
    );
}

// Main Booking Page
export default function BookingPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();

    // Initial state from URL params
    const initialArrival = searchParams.get("arrivalDate") || "";
    const initialDeparture = searchParams.get("departureDate") || "";
    const initialSiteType = searchParams.get("siteType") || "all";
    const initialAdults = parseInt(searchParams.get("adults") || "1");
    const initialChildren = parseInt(searchParams.get("children") || "0");
    const initialSiteClassId = searchParams.get("siteClassId") || null;
    const initialRvLength = searchParams.get("rvLength") || "";
    const initialRvType = searchParams.get("rvType") || "";

    const slug = params.slug as string;
    const [step, setStep] = useState<BookingStep>(initialArrival && initialDeparture ? 2 : 1);

    const [arrivalDate, setArrivalDate] = useState(initialArrival);
    const [departureDate, setDepartureDate] = useState(initialDeparture);
    const [selectedSiteType, setSelectedSiteType] = useState(normalizeSiteType(initialSiteType || "all"));
    const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
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

    // Fetch campground info
    const { data: campground, isLoading: isLoadingCampground, error: campgroundError } = useQuery({
        queryKey: ["public-campground", slug],
        queryFn: () => apiClient.getPublicCampground(slug),
        enabled: !!slug,
        retry: 2,
        retryDelay: (attempt) => Math.min(500 * (attempt + 1), 4000)
    });

    const siteSelectionFeeCents = useMemo(() => {
        const fee = (campground as any)?.siteSelectionFeeCents;
        return typeof fee === "number" ? fee : null;
    }, [campground]);

    // Fetch availability when dates are selected
    const { data: availableSites, isLoading: isLoadingSites, error: availabilityError, refetch: refetchAvailability } = useQuery({
        queryKey: ["public-availability", slug, arrivalDate, departureDate, guestInfo.equipment.type, guestInfo.equipment.length, guestInfo.needsAccessible],
        queryFn: () =>
            apiClient.getPublicAvailability(slug, {
                arrivalDate,
                departureDate,
                rigType: guestInfo.equipment.type,
                rigLength: guestInfo.equipment.length,
                needsAccessible: guestInfo.needsAccessible
            }),
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
                    });
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
    }, [arrivalDate, departureDate, filteredSites.length, guestInfo.equipment.length, guestInfo.equipment.type, isLoadingSites, slug, step]);

    const selectedSite = availableSites?.find((s) => s.id === selectedSiteId) || null;

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
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent" />
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
                    className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700"
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
                    <Link href={`/park/${slug}`} className="text-emerald-600 hover:text-emerald-700 font-medium text-sm">
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
                                className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {askLoading ? "Asking..." : "Ask"}
                            </button>
                        </div>
                        {askError && <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">{askError}</div>}
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
