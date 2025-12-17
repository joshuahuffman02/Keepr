"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { CampgroundCard } from "../../components/public/CampgroundCard";
import { apiClient } from "../../lib/api-client";
import { trackEvent } from "@/lib/analytics";
import { LeadCaptureForm } from "../../components/marketing/LeadCaptureForm";
import { HeroBanner } from "../../components/public/HeroBanner";
import { ValueStack } from "../../components/public/ValueStack";
import { UrgencySection } from "../../components/public/UrgencySection";
import { CamperTestimonials } from "../../components/public/CamperTestimonials";
import { OwnerCTA } from "../../components/public/OwnerCTA";

// Sample external campgrounds to mix with internal ones
const externalCampgrounds = [
    {
        id: "ext-1",
        name: "Yellowstone River RV Park",
        city: "Gardiner",
        state: "MT",
        description: "Gateway to Yellowstone National Park",
        rating: 4.7,
        reviewCount: 328,
        pricePerNight: 65,
        amenities: ["Full Hookups", "WiFi", "Pet Friendly"]
    },
    {
        id: "ext-2",
        name: "Redwood Coast Cabins",
        city: "Crescent City",
        state: "CA",
        description: "Nestled among the ancient redwoods",
        rating: 4.9,
        reviewCount: 156,
        pricePerNight: 125,
        amenities: ["Cabins", "Hiking Trails", "Fire Pits"]
    },
    {
        id: "ext-3",
        name: "Great Smoky Mountains Camp",
        city: "Gatlinburg",
        state: "TN",
        description: "Family camping in the Smokies",
        rating: 4.6,
        reviewCount: 412,
        pricePerNight: 45,
        amenities: ["Tent Sites", "Showers", "Camp Store"]
    },
    {
        id: "ext-4",
        name: "Desert Oasis RV Resort",
        city: "Palm Springs",
        state: "CA",
        description: "Luxury RV resort with pool and spa",
        rating: 4.8,
        reviewCount: 289,
        pricePerNight: 85,
        amenities: ["Pool", "Hot Tub", "Full Hookups"]
    },
    {
        id: "ext-5",
        name: "Maine Coastal Campground",
        city: "Bar Harbor",
        state: "ME",
        description: "Ocean views near Acadia National Park",
        rating: 4.5,
        reviewCount: 198,
        pricePerNight: 55,
        amenities: ["Ocean View", "Kayak Rentals", "WiFi"]
    },
    {
        id: "ext-6",
        name: "Rocky Mountain High Camp",
        city: "Estes Park",
        state: "CO",
        description: "High altitude camping adventure",
        rating: 4.7,
        reviewCount: 267,
        pricePerNight: 50,
        amenities: ["Mountain Views", "Hiking", "Wildlife"]
    }
];

export function HomeClient() {
    const [searchQuery, setSearchQuery] = useState("");
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

    // Combine and filter campgrounds
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
                isInternal: true,
                rating,
                reviewCount,
                pricePerNight: undefined,
                ratingBadge: badge,
                npsBadge,
                pastAwards: cg.pastCampgroundOfYearAwards || []
            };
        });

        const externalWithBadges = externalCampgrounds.map((cg) => ({
            ...cg,
            isInternal: false,
            ratingBadge: cg.reviewCount && cg.reviewCount > 150 ? "Popular pick" : undefined,
            npsBadge: undefined,
            pastAwards: []
        }));

        const combined = [...internal, ...externalWithBadges];

        // Build search terms from query and location filter
        const searchTerms: string[] = [];
        if (searchQuery) searchTerms.push(searchQuery.toLowerCase());
        if (searchFilters?.location) searchTerms.push(searchFilters.location.toLowerCase());

        // If no filters, return all
        if (searchTerms.length === 0) {
            return combined;
        }

        // Filter campgrounds that match ANY search term
        return combined.filter((cg) => {
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

            return searchTerms.some((term) => searchableText.includes(term));
        });
    }, [internalCampgrounds, searchQuery, searchFilters]);

    const handleSearch = (query: string, filters: typeof searchFilters) => {
        setSearchQuery(query);
        setSearchFilters(filters);
    };

    useEffect(() => {
        trackEvent("page_view", { page: "/" });
    }, []);

    return (
        <div className="min-h-screen max-w-[480px] mx-auto sm:max-w-none sm:mx-0">
            {/* Hero Section with Hormozi-style messaging */}
            <HeroBanner onSearch={handleSearch} />

            {/* Featured Campgrounds */}
            <section id="featured" className="max-w-7xl mx-auto px-6 py-16">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
                            {searchQuery ? "Search Results" : "Featured Campgrounds"}
                        </h2>
                        <p className="text-slate-600 mt-1">
                            {searchQuery
                                ? `${allCampgrounds.length} campgrounds found`
                                : "Discover top-rated destinations"}
                        </p>
                        <p className="text-xs text-slate-500 mt-2">
                            Tap the heart to save a campground. Saved lists stay on this device for now.
                        </p>
                    </div>
                    <div className="w-full sm:w-auto flex items-center gap-2">
                        <span className="text-sm text-slate-500 whitespace-nowrap">Sort by:</span>
                        <select className="flex-1 sm:flex-none w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                            <option>Recommended</option>
                            <option>Price: Low to High</option>
                            <option>Price: High to Low</option>
                            <option>Rating</option>
                            <option>Reviews</option>
                        </select>
                    </div>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-lg animate-pulse">
                                <div className="aspect-[4/3] bg-slate-200" />
                                <div className="p-5 space-y-3">
                                    <div className="h-4 bg-slate-200 rounded w-1/3" />
                                    <div className="h-5 bg-slate-200 rounded w-2/3" />
                                    <div className="h-4 bg-slate-200 rounded w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {allCampgrounds.map((campground) => {
                            const pricePerNight = "pricePerNight" in campground ? campground.pricePerNight : undefined;

                            return (
                                <CampgroundCard
                                    key={campground.id}
                                    id={campground.id}
                                    name={campground.name}
                                    slug={"slug" in campground ? campground.slug : undefined}
                                    city={campground.city || undefined}
                                    state={campground.state || undefined}
                                    country={"country" in campground ? (campground.country || undefined) : undefined}
                                    imageUrl={"heroImageUrl" in campground ? (campground.heroImageUrl || undefined) : undefined}
                                    isInternal={campground.isInternal}
                                    rating={campground.rating}
                                    reviewCount={campground.reviewCount}
                                    pricePerNight={pricePerNight}
                                    amenities={"amenities" in campground ? campground.amenities : []}
                                    npsBadge={campground.npsBadge}
                                    pastAwards={"pastAwards" in campground ? campground.pastAwards : []}
                                    onExplore={() => trackEvent("site_card_view", { campgroundId: campground.id, page: "/" })}
                                />
                            );
                        })}
                    </div>
                )}

                {!isLoading && allCampgrounds.length === 0 && (
                    <div className="text-center py-16">
                        <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h3 className="text-xl font-semibold text-slate-900 mb-2">No campgrounds found</h3>
                        <p className="text-slate-600">Try adjusting your search or filters</p>
                    </div>
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

            {/* Camper Testimonials - Social Proof Wall */}
            <CamperTestimonials />

            {/* Demo request */}
            <section className="bg-white py-16 border-y border-slate-100">
                <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
                    <div className="space-y-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">Request a demo</div>
                        <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
                            Want more bookings or a smoother operation?
                        </h2>
                        <p className="text-slate-600">
                            Tell us what you want to improve. We’ll follow up with a tailored walkthrough—no spam, no auto-sync to external tools.
                        </p>
                        <ul className="space-y-2 text-sm text-slate-700">
                            <li>• Name + email + interest captured securely</li>
                            <li>• Scoped to your selected campground (or the public demo)</li>
                            <li>• No third-party sync—stays inside Camp Everyday</li>
                        </ul>
                    </div>
                    <LeadCaptureForm
                        defaultCampgroundId="public-site"
                        defaultCampgroundName="Camp Everyday demo"
                        title="Request a walkthrough"
                    />
                </div>
            </section>




            {/* Blog CTA Section */}
            <section className="py-20 bg-slate-50">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-12">
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
                            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-slate-900 border border-slate-200 font-semibold rounded-lg hover:border-emerald-500 hover:text-emerald-600 transition-colors"
                        >
                            View All Posts
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                            </svg>
                        </Link>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        {/* Featured Blog Card 1 */}
                        <Link
                            href="/blog/camper-tips/01-first-time-camping-checklist"
                            className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 group cursor-pointer hover:shadow-md transition-shadow block"
                        >
                            <div className="p-6">
                                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 mb-2 block">
                                    Camper Tips
                                </span>
                                <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-emerald-600 transition-colors">
                                    First-Time Camping Checklist: Everything You Need
                                </h3>
                                <p className="text-slate-600 text-sm mb-4 line-clamp-3">
                                    Planning your first camping trip? The key to a great experience is preparation. This comprehensive checklist covers everything you need.
                                </p>
                                <span className="text-sm font-semibold text-slate-900 flex items-center gap-1 group-hover:gap-2 transition-all">
                                    Read Article <span aria-hidden="true">&rarr;</span>
                                </span>
                            </div>
                        </Link>

                        {/* Featured Blog Card 2 */}
                        <Link
                            href="/blog/industry/01-camping-industry-trends-2024"
                            className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 group cursor-pointer hover:shadow-md transition-shadow block"
                        >
                            <div className="p-6">
                                <span className="text-xs font-semibold uppercase tracking-wider text-violet-600 mb-2 block">
                                    Industry Trends
                                </span>
                                <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-violet-600 transition-colors">
                                    State of the Camping Industry: 2024 Trends
                                </h3>
                                <p className="text-slate-600 text-sm mb-4 line-clamp-3">
                                    Explore the latest camping industry trends for 2024. Data, insights, and what campground owners need to know about the future.
                                </p>
                                <span className="text-sm font-semibold text-slate-900 flex items-center gap-1 group-hover:gap-2 transition-all">
                                    Read Article <span aria-hidden="true">&rarr;</span>
                                </span>
                            </div>
                        </Link>

                        {/* Featured Blog Card 3 */}
                        <Link
                            href="/blog/growth/01-increase-off-season-bookings"
                            className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 group cursor-pointer hover:shadow-md transition-shadow block"
                        >
                            <div className="p-6">
                                <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-2 block">
                                    Growth
                                </span>
                                <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-amber-600 transition-colors">
                                    10 Ways to Increase Off-Season Bookings
                                </h3>
                                <p className="text-slate-600 text-sm mb-4 line-clamp-3">
                                    Boost off-season campground revenue with proven strategies. Learn events, pricing, marketing, and partnerships that fill sites.
                                </p>
                                <span className="text-sm font-semibold text-slate-900 flex items-center gap-1 group-hover:gap-2 transition-all">
                                    Read Article <span aria-hidden="true">&rarr;</span>
                                </span>
                            </div>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Owner CTA Section */}
            <OwnerCTA />
        </div>
    );
}
