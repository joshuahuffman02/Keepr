"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Search, Calendar, Sparkles } from "lucide-react";
import { CampgroundCard } from "../../components/public/CampgroundCard";
import { CategoryTabs, categories, type CategoryType } from "../../components/public/CategoryTabs";
import { LocationSections } from "../../components/public/LocationSections";
import { EventCard } from "../../components/public/EventCard";
import { apiClient } from "../../lib/api-client";
import type { AdaCertificationLevel } from "../../lib/ada-accessibility";
import { trackEvent } from "@/lib/analytics";
import { HeroBanner } from "../../components/public/HeroBanner";
import { ValueStack } from "../../components/public/ValueStack";
import { CharityImpactSection } from "../../components/charity/CharityImpactSection";
import { InlineActivityFeed } from "../../components/public/InlineActivityFeed";

// Animation variants for scroll reveal
const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } }
} as const;

const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.1, delayChildren: 0.1 }
    }
} as const;

const scaleIn = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: "easeOut" as const } }
} as const;

// US States for filter
const US_STATES = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

// Common amenities for filtering with icons
const COMMON_AMENITIES = [
    { name: "Electric Hookups", icon: "/images/icons/electric-hookup.png" },
    { name: "Water Hookups", icon: "/images/icons/water-hookup.png" },
    { name: "WiFi", icon: "/images/icons/wifi.png" },
    { name: "Showers", icon: "/images/icons/shower.png" },
    { name: "Pool", icon: "/images/icons/pool.png" },
    { name: "Playground", icon: "/images/icons/playground.png" },
    { name: "Pet Friendly", icon: "/images/icons/pet-friendly.png" },
    { name: "Fishing", icon: "/images/icons/fishing.png" },
    { name: "Hiking", icon: "/images/icons/hiking.png" },
    { name: "Store", icon: "/images/icons/store.png" },
    { name: "Campfire", icon: "/images/icons/campfire.png" },
    { name: "Biking", icon: "/images/icons/biking.png" },
];

// Event types for filter
const EVENT_TYPES = [
    { value: "activity", label: "Activities" },
    { value: "workshop", label: "Workshops" },
    { value: "entertainment", label: "Entertainment" },
    { value: "holiday", label: "Holiday Events" },
    { value: "recurring", label: "Recurring" },
    { value: "ongoing", label: "Ongoing" }
];

// Date range options for events
const DATE_RANGES = [
    { value: "this-weekend", label: "This Weekend" },
    { value: "this-week", label: "This Week" },
    { value: "this-month", label: "This Month" },
    { value: "next-month", label: "Next Month" }
];

export function HomeClient() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    // Initialize state from URL params
    const [searchQuery, setSearchQuery] = useState("");
    const [stateFilter, setStateFilter] = useState<string>(searchParams.get("state") || "");
    const [amenityFilters, setAmenityFilters] = useState<string[]>([]);
    const [activeCategory, setActiveCategory] = useState<CategoryType>(
        (searchParams.get("category") as CategoryType) || "all"
    );
    const [eventTypeFilter, setEventTypeFilter] = useState<string>(searchParams.get("eventType") || "");
    const [dateRangeFilter, setDateRangeFilter] = useState<string>(searchParams.get("dateRange") || "");
    const [sortBy, setSortBy] = useState<"recommended" | "name" | "rating" | "reviews">("recommended");
    const [displayCount, setDisplayCount] = useState(24);
    const [searchFilters, setSearchFilters] = useState<{
        location: string;
        dates: { checkIn: string; checkOut: string };
        guests: number;
    } | null>(null);

    // Update URL when filters change
    const updateUrlParams = useCallback((updates: Record<string, string | undefined>) => {
        const params = new URLSearchParams(searchParams.toString());
        Object.entries(updates).forEach(([key, value]) => {
            if (value && value !== "all" && value !== "") {
                params.set(key, value);
            } else {
                params.delete(key);
            }
        });
        const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
        router.replace(newUrl, { scroll: false });
    }, [searchParams, pathname, router]);

    // Calculate date range for events API
    const getDateRange = useCallback((range: string) => {
        const today = new Date();
        const startDate = new Date(today);
        let endDate = new Date(today);

        switch (range) {
            case "this-weekend":
                // Get Friday of this week
                const dayOfWeek = today.getDay();
                const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
                startDate.setDate(today.getDate() + daysUntilFriday);
                endDate.setDate(startDate.getDate() + 2); // Sunday
                break;
            case "this-week":
                endDate.setDate(today.getDate() + (7 - today.getDay()));
                break;
            case "this-month":
                endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                break;
            case "next-month":
                startDate.setMonth(today.getMonth() + 1, 1);
                endDate = new Date(today.getFullYear(), today.getMonth() + 2, 0);
                break;
            default:
                return { startDate: undefined, endDate: undefined };
        }

        return {
            startDate: startDate.toISOString().split("T")[0],
            endDate: endDate.toISOString().split("T")[0]
        };
    }, []);

    // Fetch public campgrounds from our system
    const { data: internalCampgrounds = [], isLoading } = useQuery({
        queryKey: ["public-campgrounds"],
        queryFn: () => apiClient.getPublicCampgrounds()
    });

    // Fetch public events when events category is active
    const { startDate, endDate } = getDateRange(dateRangeFilter);
    const { data: eventsData, isLoading: eventsLoading } = useQuery({
        queryKey: ["public-events", stateFilter, eventTypeFilter, startDate, endDate],
        queryFn: () => apiClient.searchPublicEvents({
            state: stateFilter || undefined,
            eventType: eventTypeFilter || undefined,
            startDate: startDate,
            endDate: endDate,
            limit: 100
        }),
        enabled: activeCategory === "events"
    });

    // Filter campgrounds from our database
    const allCampgrounds = useMemo(() => {
        const internal = internalCampgrounds.map((cg) => {
            const rating = cg.reviewScore ?? undefined;
            const reviewCount = cg.reviewCount ?? undefined;

            let badge: string | undefined;
            if (typeof rating === "number" && typeof reviewCount === "number") {
                if (rating >= 4.7 && reviewCount >= 100) {
                    badge = "Top rated";
                } else if (rating >= 4.5 && reviewCount >= 20) {
                    badge = "Guest favorite";
                } else if (reviewCount < 10) {
                    badge = "Rising star";
                }
            }

            // Determine NPS badge - priority order matters
            // Rising Star only shows if they don't have a higher-tier badge
            let npsBadge: { type: "world-class" | "top-campground" | "top-1" | "top-5" | "top-10" | "rising-star"; label: string } | undefined;
            if (cg.isTopCampground) {
                npsBadge = { type: "top-campground", label: "#1 Campground" };
            } else if (cg.isTop1PercentNps) {
                npsBadge = { type: "top-1", label: "Top 1%" };
            } else if (cg.isTop5PercentNps) {
                npsBadge = { type: "top-5", label: "Top 5%" };
            } else if (cg.isTop10PercentNps) {
                npsBadge = { type: "top-10", label: "Top 10%" };
            } else if (cg.isWorldClassNps) {
                npsBadge = { type: "world-class", label: "World Class Service" };
            } else if (cg.isRisingStar) {
                // Show Rising Star badge with improvement amount if available
                const improvement = cg.npsImprovement ?? 0;
                npsBadge = {
                    type: "rising-star",
                    label: improvement > 0 ? `Rising Star (+${improvement})` : "Rising Star"
                };
            }

            return {
                ...cg,
                isInternal: !cg.isExternal, // External campgrounds (RIDB) are not internal
                isExternal: cg.isExternal ?? false,
                rating,
                reviewCount,
                pricePerNight: undefined,
                ratingBadge: badge,
                npsBadge,
                pastAwards: cg.pastCampgroundOfYearAwards || [],
                adaCertificationLevel: cg.adaCertificationLevel || undefined
            };
        });

        // Only use internal campgrounds from our database
        let filtered = [...internal];

        // Apply search query filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            filtered = filtered.filter((cg) => {
                const searchableText = [
                    cg.name,
                    cg.city,
                    cg.state,
                    "country" in cg ? cg.country : "",
                    "tagline" in cg ? cg.tagline : "",
                    "amenities" in cg ? cg.amenities?.join(" ") : ""
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();
                return searchableText.includes(query);
            });
        }

        // Apply location filter from hero search
        if (searchFilters?.location) {
            const location = searchFilters.location.toLowerCase();
            filtered = filtered.filter((cg) => {
                const cgLocation = [cg.name, cg.city, cg.state].filter(Boolean).join(" ").toLowerCase();
                return cgLocation.includes(location);
            });
        }

        // Apply state filter
        if (stateFilter) {
            filtered = filtered.filter((cg) => cg.state === stateFilter);
        }

        // Apply category filter
        if (activeCategory !== "all") {
            const category = categories.find((c) => c.id === activeCategory);
            if (category && category.siteTypes.length > 0) {
                // For now, filter by amenities or name that suggest the category
                // TODO: When site types are available on campgrounds, filter by siteTypes
                filtered = filtered.filter((cg) => {
                    const name = cg.name.toLowerCase();
                    const amenitiesStr = ("amenities" in cg ? cg.amenities : [])?.join(" ").toLowerCase() || "";
                    const combined = `${name} ${amenitiesStr}`;

                    switch (activeCategory) {
                        case "rv":
                            return combined.includes("rv") || combined.includes("hookup") || combined.includes("electric");
                        case "cabins":
                            return combined.includes("cabin") || combined.includes("cottage");
                        case "tents":
                            return combined.includes("tent") || combined.includes("primitive") || combined.includes("group");
                        case "glamping":
                            return combined.includes("glamping") || combined.includes("safari") || combined.includes("dome") || combined.includes("luxury");
                        case "lodges":
                            return combined.includes("lodge") || combined.includes("hotel") || combined.includes("suite") || combined.includes("inn");
                        case "unique":
                            return combined.includes("yurt") || combined.includes("treehouse") || combined.includes("tiny") || combined.includes("airstream");
                        default:
                            return true;
                    }
                });
            }
        }

        // Apply amenity filters (must have ALL selected amenities)
        if (amenityFilters.length > 0) {
            filtered = filtered.filter((cg) => {
                const cgAmenities = ("amenities" in cg ? cg.amenities : [])?.map((a: string) => a.toLowerCase()) || [];
                return amenityFilters.every((af) =>
                    cgAmenities.some((ca: string) => ca.includes(af.toLowerCase()))
                );
            });
        }

        // Apply sorting - always prioritize internal (bookable) campgrounds first
        filtered.sort((a, b) => {
            // Internal campgrounds always come first
            if (a.isInternal && !b.isInternal) return -1;
            if (!a.isInternal && b.isInternal) return 1;

            // Then apply the selected sort within each group
            switch (sortBy) {
                case "name":
                    return a.name.localeCompare(b.name);
                case "rating":
                    return (b.rating ?? 0) - (a.rating ?? 0);
                case "reviews":
                    return (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
                case "recommended":
                default:
                    // Sort by a combination of rating and review count
                    const scoreA = ((a.rating ?? 0) * 20) + Math.min(a.reviewCount ?? 0, 100);
                    const scoreB = ((b.rating ?? 0) * 20) + Math.min(b.reviewCount ?? 0, 100);
                    return scoreB - scoreA;
            }
        });

        return filtered;
    }, [internalCampgrounds, searchQuery, searchFilters, stateFilter, activeCategory, amenityFilters, sortBy]);

    const handleSearch = (query: string, filters: typeof searchFilters) => {
        setSearchQuery(query);
        setSearchFilters(filters);
    };

    useEffect(() => {
        trackEvent("page_view", { page: "/" });
    }, []);

    // Scroll animation refs
    const featuredRef = useRef(null);
    const featuredInView = useInView(featuredRef, { once: true, margin: "-100px" });
    const prefersReducedMotion = useReducedMotion();

    return (
        <div className="min-h-screen max-w-[480px] mx-auto sm:max-w-none sm:mx-0">
            {/* Hero Section with Hormozi-style messaging */}
            <HeroBanner onSearch={handleSearch} />

            {/* Live Activity Feed - Social proof inline after hero */}
            <InlineActivityFeed className="border-b border-slate-100" />

            {/* Category Navigation - Airbnb-style tabs */}
            <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-100 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-3">
                    <CategoryTabs
                        activeCategory={activeCategory}
                        onCategoryChange={(category) => {
                            setActiveCategory(category);
                            setDisplayCount(24);
                            // Clear event-specific filters when switching away from events
                            if (category !== "events") {
                                setEventTypeFilter("");
                                setDateRangeFilter("");
                            }
                            updateUrlParams({ category, eventType: undefined, dateRange: undefined });
                        }}
                    />
                </div>
            </div>

            {/* Location-based curated sections - only show when no filters active */}
            {!isLoading && activeCategory === "all" && !searchQuery && !stateFilter && amenityFilters.length === 0 && (
                <LocationSections
                    campgrounds={allCampgrounds.map((cg) => ({
                        id: cg.id,
                        name: cg.name,
                        slug: "slug" in cg ? cg.slug : undefined,
                        city: cg.city || undefined,
                        state: cg.state || undefined,
                        country: "country" in cg ? (cg.country || undefined) : undefined,
                        heroImageUrl: "heroImageUrl" in cg ? (cg.heroImageUrl || undefined) : undefined,
                        isInternal: cg.isInternal,
                        isExternal: cg.isExternal,
                        rating: cg.rating,
                        reviewCount: cg.reviewCount,
                        pricePerNight: "pricePerNight" in cg ? cg.pricePerNight : undefined,
                        amenities: "amenities" in cg ? cg.amenities : [],
                        npsBadge: cg.npsBadge,
                        pastAwards: "pastAwards" in cg ? cg.pastAwards : [],
                        adaCertificationLevel: "adaCertificationLevel" in cg ? cg.adaCertificationLevel as AdaCertificationLevel : undefined
                    }))}
                    className="py-8 border-b border-slate-100"
                />
            )}

            {/* Featured Campgrounds */}
            <section id="featured" className="max-w-7xl mx-auto px-6 py-16" ref={featuredRef}>
                <motion.div
                    className="space-y-4 mb-8"
                    variants={prefersReducedMotion ? undefined : fadeInUp}
                    initial="hidden"
                    animate={featuredInView ? "visible" : "hidden"}
                >
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
                                {activeCategory === "events"
                                    ? "Upcoming Events"
                                    : activeCategory !== "all"
                                    ? categories.find((c) => c.id === activeCategory)?.label || "Campgrounds"
                                    : searchQuery || stateFilter || amenityFilters.length > 0
                                    ? "Search Results"
                                    : "Featured Campgrounds"}
                            </h2>
                            <p className="text-slate-600 mt-1">
                                {activeCategory === "events" ? (
                                    <>
                                        {eventsData?.total ?? 0} events
                                        {stateFilter && ` in ${stateFilter}`}
                                        {eventTypeFilter && ` - ${EVENT_TYPES.find(t => t.value === eventTypeFilter)?.label}`}
                                        {dateRangeFilter && ` (${DATE_RANGES.find(r => r.value === dateRangeFilter)?.label})`}
                                    </>
                                ) : (
                                    <>
                                        {allCampgrounds.length.toLocaleString()} campgrounds
                                        {stateFilter && ` in ${stateFilter}`}
                                        {amenityFilters.length > 0 && ` with ${amenityFilters.join(", ")}`}
                                    </>
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Search and Filters Bar */}
                    <div className="flex flex-col lg:flex-row gap-3">
                        {/* Search Input */}
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search campgrounds by name, city..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* State Filter */}
                        <select
                            value={stateFilter}
                            onChange={(e) => {
                                setStateFilter(e.target.value);
                                setDisplayCount(24);
                                updateUrlParams({ state: e.target.value || undefined });
                            }}
                            className="px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white min-w-[140px]"
                        >
                            <option value="">All States</option>
                            {US_STATES.map((state) => (
                                <option key={state} value={state}>{state}</option>
                            ))}
                        </select>

                        {/* Events-specific filters */}
                        {activeCategory === "events" && (
                            <>
                                {/* Event Type Filter */}
                                <select
                                    value={eventTypeFilter}
                                    onChange={(e) => {
                                        setEventTypeFilter(e.target.value);
                                        updateUrlParams({ eventType: e.target.value || undefined });
                                    }}
                                    className="px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white min-w-[140px]"
                                >
                                    <option value="">All Event Types</option>
                                    {EVENT_TYPES.map((type) => (
                                        <option key={type.value} value={type.value}>{type.label}</option>
                                    ))}
                                </select>

                                {/* Date Range Filter */}
                                <select
                                    value={dateRangeFilter}
                                    onChange={(e) => {
                                        setDateRangeFilter(e.target.value);
                                        updateUrlParams({ dateRange: e.target.value || undefined });
                                    }}
                                    className="px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white min-w-[140px]"
                                >
                                    <option value="">Any Time</option>
                                    {DATE_RANGES.map((range) => (
                                        <option key={range.value} value={range.value}>{range.label}</option>
                                    ))}
                                </select>
                            </>
                        )}

                        {/* Sort */}
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                            className="px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white min-w-[160px]"
                        >
                            <option value="recommended">Recommended</option>
                            <option value="name">Name A-Z</option>
                            <option value="rating">Highest Rated</option>
                            <option value="reviews">Most Reviews</option>
                        </select>
                    </div>

                    {/* Amenity Filter Chips - hide for events */}
                    <div className="flex flex-wrap gap-2">
                        {activeCategory !== "events" && COMMON_AMENITIES.slice(0, 8).map((amenity) => {
                            const isSelected = amenityFilters.includes(amenity.name);
                            return (
                                <button
                                    key={amenity.name}
                                    onClick={() => {
                                        if (isSelected) {
                                            setAmenityFilters(amenityFilters.filter((a) => a !== amenity.name));
                                        } else {
                                            setAmenityFilters([...amenityFilters, amenity.name]);
                                        }
                                        setDisplayCount(24);
                                    }}
                                    className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-full border transition-all ${
                                        isSelected
                                            ? "bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm"
                                            : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:shadow-sm"
                                    }`}
                                >
                                    <Image
                                        src={amenity.icon}
                                        alt={amenity.name}
                                        width={20}
                                        height={20}
                                        className="object-contain"
                                    />
                                    {amenity.name}
                                </button>
                            );
                        })}
                        {(searchQuery || stateFilter || amenityFilters.length > 0 || activeCategory !== "all" || eventTypeFilter || dateRangeFilter) && (
                            <button
                                onClick={() => {
                                    setSearchQuery("");
                                    setStateFilter("");
                                    setAmenityFilters([]);
                                    setActiveCategory("all");
                                    setEventTypeFilter("");
                                    setDateRangeFilter("");
                                    setDisplayCount(24);
                                    // Clear all URL params
                                    router.replace(pathname, { scroll: false });
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                            >
                                <Sparkles className="w-3.5 h-3.5" />
                                Start Fresh
                            </button>
                        )}
                    </div>
                </motion.div>

                {/* Events Grid - when events category is active */}
                {activeCategory === "events" ? (
                    eventsLoading ? (
                        <div className="space-y-8">
                            <motion.div
                                className="text-center py-4"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 }}
                            >
                                <p className="text-slate-500 text-sm flex items-center justify-center gap-2">
                                    <Calendar className="w-5 h-5 text-orange-500 animate-bounce" />
                                    Discovering upcoming events...
                                </p>
                            </motion.div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {[1, 2, 3, 4, 5, 6].map((i) => (
                                    <motion.div
                                        key={i}
                                        className="bg-white rounded-2xl overflow-hidden shadow-lg"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.1 }}
                                    >
                                        <div className="aspect-[4/3] bg-gradient-to-br from-orange-100 to-orange-200 relative overflow-hidden">
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
                                        </div>
                                        <div className="p-5 space-y-3">
                                            <div className="h-4 bg-orange-100 rounded w-1/4 animate-pulse" />
                                            <div className="h-5 bg-slate-200 rounded w-2/3 animate-pulse" />
                                            <div className="h-4 bg-slate-200 rounded w-1/2 animate-pulse" />
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    ) : eventsData?.results && eventsData.results.length > 0 ? (
                        <>
                            <motion.div
                                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                                variants={prefersReducedMotion ? undefined : staggerContainer}
                                initial="hidden"
                                animate={featuredInView ? "visible" : "hidden"}
                            >
                                {eventsData.results.slice(0, displayCount).map((event, index) => (
                                    <motion.div
                                        key={event.id}
                                        variants={prefersReducedMotion ? undefined : scaleIn}
                                        custom={index}
                                    >
                                        <EventCard {...event} />
                                    </motion.div>
                                ))}
                            </motion.div>

                            {/* Load More for Events */}
                            {eventsData.results.length > displayCount && (
                                <div className="flex justify-center mt-8">
                                    <button
                                        onClick={() => setDisplayCount((prev) => prev + 24)}
                                        className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        Load More Events
                                        <span className="text-orange-200">
                                            ({Math.min(displayCount + 24, eventsData.results.length) - displayCount} more)
                                        </span>
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <motion.div
                            className="text-center py-16"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 }}
                        >
                            <div className="relative w-32 h-32 mx-auto mb-6">
                                <Image
                                    src="/images/icons/confused-compass.png"
                                    alt="No events"
                                    fill
                                    className="object-contain"
                                    sizes="128px"
                                />
                            </div>
                            <h3 className="text-xl font-semibold text-slate-900 mb-2">No events found</h3>
                            <p className="text-slate-600">
                                {stateFilter || eventTypeFilter || dateRangeFilter
                                    ? "Try adjusting your filters to find more events"
                                    : "Check back soon for upcoming campground events"}
                            </p>
                        </motion.div>
                    )
                ) : isLoading ? (
                    <div className="space-y-8">
                        {/* Friendly loading message */}
                        <motion.div
                            className="text-center py-4"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                        >
                            <p className="text-slate-500 text-sm flex items-center justify-center gap-2">
                                <svg className="w-5 h-5 text-emerald-500 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
                                </svg>
                                Finding your perfect outdoor escape...
                            </p>
                        </motion.div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <motion.div
                                    key={i}
                                    className="bg-white rounded-2xl overflow-hidden shadow-lg"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                >
                                    <div className="aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200 relative overflow-hidden">
                                        {/* Shimmer effect */}
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
                                    </div>
                                    <div className="p-5 space-y-3">
                                        <div className="h-4 bg-slate-200 rounded w-1/3 animate-pulse" />
                                        <div className="h-5 bg-slate-200 rounded w-2/3 animate-pulse" />
                                        <div className="h-4 bg-slate-200 rounded w-1/2 animate-pulse" />
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
                        <motion.div
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                            variants={prefersReducedMotion ? undefined : staggerContainer}
                            initial="hidden"
                            animate={featuredInView ? "visible" : "hidden"}
                        >
                            {allCampgrounds.slice(0, displayCount).map((campground, index) => {
                                const pricePerNight = "pricePerNight" in campground ? campground.pricePerNight : undefined;

                                return (
                                    <motion.div
                                        key={campground.id}
                                        variants={prefersReducedMotion ? undefined : scaleIn}
                                        custom={index}
                                    >
                                        <CampgroundCard
                                            id={campground.id}
                                            name={campground.name}
                                            slug={"slug" in campground ? campground.slug : undefined}
                                            city={campground.city || undefined}
                                            state={campground.state || undefined}
                                            country={"country" in campground ? (campground.country || undefined) : undefined}
                                            imageUrl={"heroImageUrl" in campground ? (campground.heroImageUrl || undefined) : undefined}
                                            isInternal={campground.isInternal}
                                            isExternal={campground.isExternal}
                                            rating={campground.rating}
                                            reviewCount={campground.reviewCount}
                                            pricePerNight={pricePerNight}
                                            amenities={"amenities" in campground ? campground.amenities : []}
                                            npsBadge={campground.npsBadge}
                                            pastAwards={"pastAwards" in campground ? campground.pastAwards : []}
                                            adaCertificationLevel={"adaCertificationLevel" in campground ? campground.adaCertificationLevel as AdaCertificationLevel : undefined}
                                            onExplore={() => trackEvent("site_card_view", { campgroundId: campground.id, page: "/" })}
                                        />
                                    </motion.div>
                                );
                            })}
                        </motion.div>

                        {/* Load More Button */}
                        {allCampgrounds.length > displayCount && (
                            <div className="flex justify-center mt-8">
                                <button
                                    onClick={() => setDisplayCount((prev) => prev + 24)}
                                    className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium rounded-lg transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 flex items-center gap-2"
                                >
                                    <Sparkles className="w-4 h-4" />
                                    Discover More Treasures
                                    <span className="text-emerald-100 text-sm">
                                        ({allCampgrounds.length - displayCount} adventures await)
                                    </span>
                                </button>
                            </div>
                        )}
                    </>
                )}

                {!isLoading && allCampgrounds.length === 0 && (
                    <motion.div
                        className="text-center py-16"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        <div className="relative w-32 h-32 mx-auto mb-6">
                            <Image
                                src="/images/icons/lonely-tent.png"
                                alt="No results"
                                fill
                                className="object-contain"
                                sizes="128px"
                            />
                        </div>
                        <h3 className="text-xl font-semibold text-slate-900 mb-2">
                            Even our best scouts came up empty...
                        </h3>
                        <p className="text-slate-600 mb-4">
                            But new adventures await! Try adjusting your search or explore different destinations.
                        </p>
                        <button
                            onClick={() => {
                                setSearchQuery("");
                                setStateFilter("");
                                setAmenityFilters([]);
                                setActiveCategory("all");
                                router.replace(pathname, { scroll: false });
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                        >
                            <Sparkles className="w-4 h-4" />
                            Start Fresh
                        </button>
                    </motion.div>
                )}
            </section>

            {/* Charity Impact Section - The heart of Camp Everyday */}
            <CharityImpactSection />

            {/* Value Stack - Why Book With Camp Everyday (condensed) */}
            <ValueStack />
        </div>
    );
}
