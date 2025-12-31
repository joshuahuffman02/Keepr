"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Search } from "lucide-react";
import { CampgroundCard } from "../../components/public/CampgroundCard";
import { CategoryTabs, categories, type CategoryType } from "../../components/public/CategoryTabs";
import { LocationSections } from "../../components/public/LocationSections";
import { apiClient } from "../../lib/api-client";
import type { AdaCertificationLevel } from "../../lib/ada-accessibility";
import { trackEvent } from "@/lib/analytics";
import { HeroBanner } from "../../components/public/HeroBanner";
import { ValueStack } from "../../components/public/ValueStack";
import { UrgencySection } from "../../components/public/UrgencySection";
import { OwnerCTA } from "../../components/public/OwnerCTA";
import { CharityImpactSection } from "../../components/charity/CharityImpactSection";

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

// Blog posts data
const blogPosts = [
    {
        href: "/blog/camper-tips/01-first-time-camping-checklist",
        category: "Camper Tips",
        categoryColor: "emerald",
        title: "First-Time Camping Checklist: Everything You Need",
        description: "Planning your first camping trip? The key to a great experience is preparation. This comprehensive checklist covers everything you need."
    },
    {
        href: "/blog/industry/01-camping-industry-trends-2024",
        category: "Industry Trends",
        categoryColor: "violet",
        title: "State of the Camping Industry: 2024 Trends",
        description: "Explore the latest camping industry trends for 2024. Data, insights, and what campground owners need to know about the future."
    },
    {
        href: "/blog/growth/01-increase-off-season-bookings",
        category: "Growth",
        categoryColor: "amber",
        title: "10 Ways to Increase Off-Season Bookings",
        description: "Boost off-season campground revenue with proven strategies. Learn events, pricing, marketing, and partnerships that fill sites."
    }
];

// Blog Section with scroll animations
function BlogSection({ prefersReducedMotion }: { prefersReducedMotion: boolean | null }) {
    const blogRef = useRef(null);
    const blogInView = useInView(blogRef, { once: true, margin: "-100px" });

    const categoryColors: Record<string, string> = {
        emerald: "text-emerald-600 group-hover:text-emerald-600",
        violet: "text-violet-600 group-hover:text-violet-600",
        amber: "text-amber-600 group-hover:text-amber-600"
    };

    return (
        <section className="py-20 bg-slate-50" ref={blogRef}>
            <div className="max-w-7xl mx-auto px-6">
                <motion.div
                    className="flex flex-col md:flex-row items-center justify-between gap-8 mb-12"
                    variants={prefersReducedMotion ? undefined : fadeInUp}
                    initial="hidden"
                    animate={blogInView ? "visible" : "hidden"}
                >
                    <div>
                        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4">
                            Latest from the Blog
                        </h2>
                        <p className="text-slate-600 max-w-xl">
                            Tips, guides, and industry insights to help you get the most out of your camping experience.
                        </p>
                    </div>
                    <Link
                        href="/blog"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-white text-slate-900 border border-slate-200 font-semibold rounded-lg hover:border-emerald-500 hover:text-emerald-600 transition-colors group"
                    >
                        View All Posts
                        <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                    </Link>
                </motion.div>

                <motion.div
                    className="grid md:grid-cols-3 gap-6"
                    variants={prefersReducedMotion ? undefined : staggerContainer}
                    initial="hidden"
                    animate={blogInView ? "visible" : "hidden"}
                >
                    {blogPosts.map((post, index) => (
                        <motion.div
                            key={post.href}
                            variants={prefersReducedMotion ? undefined : scaleIn}
                            custom={index}
                        >
                            <Link
                                href={post.href}
                                className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 group cursor-pointer hover:shadow-md transition-shadow block h-full"
                            >
                                <div className="p-6">
                                    <span className={`text-xs font-semibold uppercase tracking-wider mb-2 block ${categoryColors[post.categoryColor]}`}>
                                        {post.category}
                                    </span>
                                    <h3 className={`text-lg font-bold text-slate-900 mb-2 transition-colors ${categoryColors[post.categoryColor]}`}>
                                        {post.title}
                                    </h3>
                                    <p className="text-slate-600 text-sm mb-4 line-clamp-3">
                                        {post.description}
                                    </p>
                                    <span className="text-sm font-semibold text-slate-900 flex items-center gap-1 group-hover:gap-2 transition-all">
                                        Read Article <span aria-hidden="true">→</span>
                                    </span>
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
}

// Note: External campgrounds removed - only showing campgrounds from our database

// US States for filter
const US_STATES = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

// Common amenities for filtering
const COMMON_AMENITIES = [
    "Electric Hookups", "Water Hookups", "Sewer Hookups", "WiFi",
    "Showers", "Restrooms", "Dump Station", "Laundry", "Store",
    "Pool", "Playground", "Pet Friendly", "Fishing", "Hiking"
];

export function HomeClient() {
    const [searchQuery, setSearchQuery] = useState("");
    const [stateFilter, setStateFilter] = useState<string>("");
    const [amenityFilters, setAmenityFilters] = useState<string[]>([]);
    const [activeCategory, setActiveCategory] = useState<CategoryType>("all");
    const [sortBy, setSortBy] = useState<"recommended" | "name" | "rating" | "reviews">("recommended");
    const [displayCount, setDisplayCount] = useState(24);
    const [searchFilters, setSearchFilters] = useState<{
        location: string;
        dates: { checkIn: string; checkOut: string };
        guests: number;
    } | null>(null);

    // Fetch public campgrounds from our system
    const { data: internalCampgrounds = [], isLoading } = useQuery({
        queryKey: ["public-campgrounds"],
        queryFn: () => apiClient.getPublicCampgrounds()
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

        // Apply sorting
        switch (sortBy) {
            case "name":
                filtered.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case "rating":
                filtered.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
                break;
            case "reviews":
                filtered.sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
                break;
            case "recommended":
            default:
                // Sort by a combination of rating and review count
                filtered.sort((a, b) => {
                    const scoreA = ((a.rating ?? 0) * 20) + Math.min(a.reviewCount ?? 0, 100);
                    const scoreB = ((b.rating ?? 0) * 20) + Math.min(b.reviewCount ?? 0, 100);
                    return scoreB - scoreA;
                });
                break;
        }

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

            {/* Category Navigation - Airbnb-style tabs */}
            <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-100 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-3">
                    <CategoryTabs
                        activeCategory={activeCategory}
                        onCategoryChange={(category) => {
                            setActiveCategory(category);
                            setDisplayCount(24);
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
                                {activeCategory !== "all"
                                    ? categories.find((c) => c.id === activeCategory)?.label || "Campgrounds"
                                    : searchQuery || stateFilter || amenityFilters.length > 0
                                    ? "Search Results"
                                    : "Featured Campgrounds"}
                            </h2>
                            <p className="text-slate-600 mt-1">
                                {allCampgrounds.length.toLocaleString()} campgrounds
                                {stateFilter && ` in ${stateFilter}`}
                                {amenityFilters.length > 0 && ` with ${amenityFilters.join(", ")}`}
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
                            onChange={(e) => { setStateFilter(e.target.value); setDisplayCount(24); }}
                            className="px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white min-w-[140px]"
                        >
                            <option value="">All States</option>
                            {US_STATES.map((state) => (
                                <option key={state} value={state}>{state}</option>
                            ))}
                        </select>

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

                    {/* Amenity Filter Chips */}
                    <div className="flex flex-wrap gap-2">
                        {COMMON_AMENITIES.slice(0, 8).map((amenity) => {
                            const isSelected = amenityFilters.includes(amenity);
                            return (
                                <button
                                    key={amenity}
                                    onClick={() => {
                                        if (isSelected) {
                                            setAmenityFilters(amenityFilters.filter((a) => a !== amenity));
                                        } else {
                                            setAmenityFilters([...amenityFilters, amenity]);
                                        }
                                        setDisplayCount(24);
                                    }}
                                    className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                                        isSelected
                                            ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                                            : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                                    }`}
                                >
                                    {isSelected && <span className="mr-1">&#10003;</span>}
                                    {amenity}
                                </button>
                            );
                        })}
                        {(searchQuery || stateFilter || amenityFilters.length > 0 || activeCategory !== "all") && (
                            <button
                                onClick={() => {
                                    setSearchQuery("");
                                    setStateFilter("");
                                    setAmenityFilters([]);
                                    setActiveCategory("all");
                                    setDisplayCount(24);
                                }}
                                className="px-3 py-1.5 text-sm rounded-full border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                            >
                                Clear All
                            </button>
                        )}
                    </div>
                </motion.div>

                {isLoading ? (
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
                                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                                >
                                    Load More
                                    <span className="text-emerald-200">
                                        ({Math.min(displayCount + 24, allCampgrounds.length) - displayCount} more of {allCampgrounds.length - displayCount} remaining)
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
                        <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h3 className="text-xl font-semibold text-slate-900 mb-2">No campgrounds found</h3>
                        <p className="text-slate-600">Try adjusting your search or filters</p>
                    </motion.div>
                )}
            </section>

            {/* Value Stack - Why Book With Camp Everyday */}
            <ValueStack />

            {/* Urgency Section - Popular This Weekend */}
            <UrgencySection
                campgrounds={allCampgrounds.map((cg) => ({
                    id: cg.id,
                    name: cg.name,
                    slug: "slug" in cg ? cg.slug : undefined,
                    city: cg.city || undefined,
                    state: cg.state || undefined,
                    country: "country" in cg ? (cg.country || undefined) : undefined,
                    heroImageUrl: "heroImageUrl" in cg ? (cg.heroImageUrl || undefined) : undefined,
                    isInternal: cg.isInternal,
                    rating: cg.rating,
                    reviewCount: cg.reviewCount,
                    pricePerNight: "pricePerNight" in cg ? cg.pricePerNight : undefined,
                    amenities: "amenities" in cg ? cg.amenities : [],
                    npsBadge: cg.npsBadge,
                    pastAwards: "pastAwards" in cg ? cg.pastAwards : [],
                    availableSites: Math.floor(Math.random() * 8) + 1, // Stubbed for now
                }))}
            />

            {/* Blog CTA Section */}
            <BlogSection prefersReducedMotion={prefersReducedMotion} />

            {/* Charity Impact Section */}
            <CharityImpactSection />

            {/* Owner CTA Section */}
            <OwnerCTA />
        </div>
    );
}
